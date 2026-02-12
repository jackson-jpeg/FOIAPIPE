"""Celery tasks for FOIA request management."""

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


def _run_async(coro):
    """Helper to run async code in sync Celery tasks."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


async def _check_inbox_async():
    from sqlalchemy import select

    from app.database import async_session_factory
    from app.models.foia_request import FoiaRequest, FoiaStatus
    from app.models.foia_status_change import FoiaStatusChange
    from app.services.email_monitor import check_inbox
    from app.services.notification_sender import send_notification

    responses = await check_inbox()
    if not responses:
        return {"processed": 0}

    async with async_session_factory() as db:
        processed = 0
        for resp in responses:
            if resp.get("error"):
                continue
            case_number = resp.get("case_number")
            if not case_number:
                continue

            result = await db.execute(
                select(FoiaRequest).where(FoiaRequest.case_number == case_number)
            )
            foia = result.scalar_one_or_none()
            if not foia:
                logger.warning(
                    f"Received email for unknown case number: {case_number}"
                )
                continue

            response_type = resp.get("response_type", "unknown")

            # AI reclassification for ambiguous results
            if response_type in ("unknown", "processing"):
                try:
                    from app.services.ai_client import classify_email_response
                    ai_result = await classify_email_response(
                        subject=resp.get("subject", ""), body=resp.get("body", ""),
                        case_number=case_number,
                    )
                    if ai_result and ai_result.get("response_type") not in (None, "unknown"):
                        response_type = ai_result["response_type"]
                        # Supplement regex-missed fields
                        if ai_result.get("estimated_cost") and not resp.get("estimated_cost"):
                            resp["estimated_cost"] = ai_result["estimated_cost"]
                        if ai_result.get("fee_waiver") and not resp.get("fee_waiver"):
                            resp["fee_waiver"] = ai_result["fee_waiver"]
                        if ai_result.get("extension_days") and not resp.get("extension_days"):
                            resp["extension_days"] = ai_result["extension_days"]
                except Exception as e:
                    logger.warning(f"AI classification failed, keeping regex result: {e}")

            status_map = {
                "acknowledged": FoiaStatus.acknowledged,
                "fulfilled": FoiaStatus.fulfilled,
                "denied": FoiaStatus.denied,
                "processing": FoiaStatus.processing,
                "cost_estimate": FoiaStatus.processing,
                "fee_waiver": FoiaStatus.processing,
                "extension": FoiaStatus.processing,
            }

            old_status = foia.status
            new_status = status_map.get(response_type)

            if new_status and new_status != old_status:
                # Record audit trail BEFORE status change
                audit_entry = FoiaStatusChange(
                    foia_request_id=foia.id,
                    from_status=old_status.value,
                    to_status=new_status.value,
                    changed_by="email_monitor",
                    reason=f"Agency email response: {response_type}",
                    extra_metadata={
                        "from": resp.get("from"),
                        "subject": resp.get("subject"),
                        "date": resp.get("date"),
                        "has_attachments": resp.get("has_attachments"),
                        "attachment_keys": resp.get("attachment_keys", []),
                        "fee_waiver": resp.get("fee_waiver"),
                        "extension_days": resp.get("extension_days"),
                    },
                )
                db.add(audit_entry)

                # Update status
                foia.status = new_status
                if response_type == "acknowledged":
                    foia.acknowledged_at = datetime.now(timezone.utc)
                elif response_type == "fulfilled":
                    foia.fulfilled_at = datetime.now(timezone.utc)

                logger.info(
                    f"Updated FOIA {case_number}: {old_status.value} → {new_status.value}"
                )

            # Update cost estimate
            if resp.get("estimated_cost") is not None:
                foia.estimated_cost = resp["estimated_cost"]

            # Handle fee waiver decision
            fee_waiver = resp.get("fee_waiver")
            if fee_waiver == "granted":
                foia.payment_status = "fee_waived"
            elif fee_waiver == "denied":
                foia.payment_status = "fee_waiver_denied"

            # Handle timeline extension — push due_date forward
            extension_days = resp.get("extension_days")
            if extension_days and foia.due_date:
                foia.due_date = foia.due_date + timedelta(days=extension_days)
                logger.info(f"Extended due date for {case_number} by {extension_days} days")

            # Store response email (with dedup check)
            if not foia.response_emails:
                foia.response_emails = []
            dedup_key = f"{resp.get('subject', '')}|{resp.get('date', '')}"
            existing_keys = {
                f"{e.get('subject', '')}|{e.get('date', '')}"
                for e in foia.response_emails
            }
            if dedup_key not in existing_keys:
                foia.response_emails = foia.response_emails + [resp]

            processed += 1

            # Send multi-channel notification (email + SMS + in-app)
            notification_event_map = {
                "acknowledged": "foia_acknowledged",
                "fulfilled": "foia_fulfilled",
                "denied": "foia_denied",
                "processing": "foia_acknowledged",
                "cost_estimate": "foia_acknowledged",
                "fee_waiver": "foia_acknowledged",
                "extension": "foia_acknowledged",
            }
            notification_title_map = {
                "acknowledged": "FOIA Acknowledged",
                "fulfilled": "FOIA Fulfilled — Records Available",
                "denied": "FOIA Denied",
                "processing": "FOIA Processing",
                "cost_estimate": f"FOIA Cost Estimate: ${resp.get('estimated_cost', '?')}",
                "fee_waiver": f"Fee Waiver {(fee_waiver or 'update').title()}",
                "extension": f"Timeline Extended +{extension_days or '?'} Days",
            }
            event_type = notification_event_map.get(response_type, "foia_acknowledged")
            title = notification_title_map.get(response_type, "FOIA Update")
            attachments_note = ""
            if resp.get("attachment_keys"):
                attachments_note = f" ({len(resp['attachment_keys'])} attachments saved)"

            try:
                await send_notification(event_type, {
                    "title": title,
                    "message": f"Case {case_number}: {resp.get('subject', 'Agency response received')}{attachments_note}",
                    "link": f"/foia?detail={foia.id}",
                })
            except Exception as e:
                logger.error(f"Notification send failed for {case_number}: {e}")

        await db.commit()
        return {"processed": processed}


async def _check_deadlines_async():
    from sqlalchemy import select, and_

    from app.database import async_session_factory
    from app.models.foia_request import FoiaRequest, FoiaStatus
    from app.services.notification_sender import send_notification

    async with async_session_factory() as db:
        now = datetime.now(timezone.utc)
        approaching = now + timedelta(days=3)

        stmt = select(FoiaRequest).where(
            and_(
                FoiaRequest.status.in_([
                    FoiaStatus.submitted,
                    FoiaStatus.acknowledged,
                    FoiaStatus.processing,
                ]),
                FoiaRequest.due_date.isnot(None),
                FoiaRequest.due_date <= approaching,
            )
        )
        results = (await db.execute(stmt)).scalars().all()

        notifications = []
        for foia in results:
            if foia.due_date and foia.due_date <= now:
                notifications.append({
                    "type": "foia_overdue",
                    "title": f"FOIA Overdue: {foia.case_number}",
                    "message": f"FOIA request {foia.case_number} is past due.",
                    "link": f"/foia?detail={foia.id}",
                })
            elif foia.due_date:
                days = (foia.due_date - now).days
                notifications.append({
                    "type": "foia_deadline",
                    "title": f"FOIA Due Soon: {foia.case_number}",
                    "message": f"FOIA request {foia.case_number} is due in {days} days.",
                    "link": f"/foia?detail={foia.id}",
                })

        for notif in notifications:
            try:
                await send_notification(notif["type"], notif)
            except Exception as e:
                logger.error(f"Notification error: {e}")

        return {"checked": len(results), "notifications": len(notifications)}


async def _log_auto_submit_decision(db, article, agency, decision, reason,
                                     daily_count, agency_week_count, estimated_cost):
    """Log every auto-submit decision to the audit trail."""
    from app.models.audit_log import AuditLog, AuditAction
    audit = AuditLog(
        action=AuditAction.foia_auto_submit_decision,
        user="auto_submit_system",
        resource_type="news_article",
        resource_id=str(article.id),
        details={
            "decision": decision,
            "reason": reason,
            "article_id": str(article.id),
            "article_headline": (article.headline or "")[:150],
            "agency_name": agency.name if agency else None,
            "agency_id": str(agency.id) if agency else None,
            "estimated_cost": estimated_cost,
            "severity_score": getattr(article, "severity_score", None),
            "agency_week_count": agency_week_count,
            "daily_count": daily_count,
        },
        success=True,
    )
    db.add(audit)
    try:
        await db.flush()
    except Exception:
        pass


async def _auto_submit_async(article_id: str):
    from sqlalchemy import and_, func, or_, select
    from sqlalchemy.exc import IntegrityError

    from app.database import async_session_factory
    from app.models.agency import Agency
    from app.models.app_setting import AppSetting
    from app.models.foia_request import FoiaRequest, FoiaStatus
    from app.models.foia_status_change import FoiaStatusChange
    from app.models.news_article import NewsArticle
    from app.models.notification import Notification, NotificationChannel, NotificationType
    from app.services.cache import publish_sse
    from app.services.email_sender import send_foia_email
    from app.services.foia_generator import (
        assign_case_number,
        generate_pdf,
        generate_request_text,
    )
    from app.services.storage import upload_file

    async with async_session_factory() as db:
        # ── Safety Check 1: Auto-submit mode (off / dry_run / live) ───────
        mode_setting = (
            await db.execute(
                select(AppSetting).where(AppSetting.key == "auto_submit_mode")
            )
        ).scalar_one_or_none()

        if mode_setting:
            auto_submit_mode = mode_setting.value
        else:
            # Backwards compat: fall back to old boolean toggle
            legacy_setting = (
                await db.execute(
                    select(AppSetting).where(AppSetting.key == "auto_submit_enabled")
                )
            ).scalar_one_or_none()
            if legacy_setting and legacy_setting.value == "true":
                auto_submit_mode = "live"
            else:
                auto_submit_mode = "off"

        if auto_submit_mode == "off":
            logger.info("Auto-submit mode is off, skipping")
            return {"skipped": True, "reason": "Auto-submit mode is off"}

        # ── Safety Check 2: Daily quota ───────────────────────────────────
        max_per_day_setting = (
            await db.execute(
                select(AppSetting).where(AppSetting.key == "max_auto_submits_per_day")
            )
        ).scalar_one_or_none()

        max_per_day = int(max_per_day_setting.value) if max_per_day_setting else 5
        today_start = datetime.now(timezone.utc).replace(
            hour=0, minute=0, second=0, microsecond=0
        )

        today_count = (
            await db.execute(
                select(func.count(FoiaRequest.id))
                .where(FoiaRequest.is_auto_submitted == True)
                .where(FoiaRequest.submitted_at >= today_start)
            )
        ).scalar_one()

        # ── Fetch article + agency early (needed for cooldown + cost cap) ─
        article = (
            await db.execute(
                select(NewsArticle).where(NewsArticle.id == article_id)
            )
        ).scalar_one_or_none()

        if not article or not article.detected_agency:
            return {"error": "Article not found or no agency detected"}

        agency = (
            await db.execute(
                select(Agency).where(Agency.name == article.detected_agency)
            )
        ).scalar_one_or_none()

        if not agency or not agency.foia_email:
            return {"error": "Agency not found or no email"}

        if today_count >= max_per_day:
            logger.warning(
                f"Daily auto-submit quota reached ({today_count}/{max_per_day})"
            )
            await _log_auto_submit_decision(
                db, article, agency, "skipped", "daily_quota",
                today_count, 0, None,
            )
            await db.commit()
            return {
                "skipped": True,
                "reason": f"Daily quota reached ({today_count}/{max_per_day})",
            }

        # ── Safety Check 2.5: Per-agency weekly cooldown ──────────────────
        max_per_agency_week_setting = (
            await db.execute(
                select(AppSetting).where(
                    AppSetting.key == "max_auto_submits_per_agency_per_week"
                )
            )
        ).scalar_one_or_none()

        max_per_agency_week = (
            int(max_per_agency_week_setting.value)
            if max_per_agency_week_setting
            else 3
        )
        week_ago = datetime.now(timezone.utc) - timedelta(days=7)

        agency_week_count = (
            await db.execute(
                select(func.count(FoiaRequest.id)).where(
                    and_(
                        FoiaRequest.is_auto_submitted == True,
                        FoiaRequest.agency_id == agency.id,
                        or_(
                            FoiaRequest.submitted_at >= week_ago,
                            and_(
                                FoiaRequest.status == FoiaStatus.draft,
                                FoiaRequest.created_at >= week_ago,
                            ),
                        ),
                    )
                )
            )
        ).scalar_one()

        if agency_week_count >= max_per_agency_week:
            logger.warning(
                f"Agency weekly cooldown reached for {agency.name} "
                f"({agency_week_count}/{max_per_agency_week})"
            )
            await _log_auto_submit_decision(
                db, article, agency, "skipped", "agency_cooldown",
                today_count, agency_week_count, None,
            )
            await db.commit()
            return {
                "skipped": True,
                "reason": f"Agency weekly cooldown ({agency_week_count}/{max_per_agency_week})",
            }

        # ── Safety Check 2.6: Cost cap ────────────────────────────────────
        cost_cap_setting = (
            await db.execute(
                select(AppSetting).where(AppSetting.key == "auto_submit_cost_cap")
            )
        ).scalar_one_or_none()

        cost_cap = float(cost_cap_setting.value) if cost_cap_setting else 50.00
        estimated_cost = None

        try:
            from app.services.cost_predictor import predict_foia_cost
            incident_type = getattr(article, "incident_type", None)
            cost_prediction = await predict_foia_cost(
                db, str(agency.id), incident_type
            )
            estimated_cost = cost_prediction.get("estimated_cost")
        except Exception as e:
            logger.warning(f"Cost prediction failed, proceeding without cap: {e}")

        if estimated_cost is not None and float(estimated_cost) > cost_cap:
            logger.warning(
                f"Cost cap exceeded for {agency.name}: "
                f"${estimated_cost} > ${cost_cap}"
            )
            await _log_auto_submit_decision(
                db, article, agency, "skipped", "cost_cap",
                today_count, agency_week_count, float(estimated_cost),
            )
            await db.commit()
            return {
                "skipped": True,
                "reason": f"Cost cap exceeded (${estimated_cost} > ${cost_cap})",
            }

        # ── Safety Check 3: Idempotency (already filed?) ──────────────────
        existing_foia = (
            await db.execute(
                select(FoiaRequest).where(
                    FoiaRequest.news_article_id == article.id
                )
            )
        ).scalar_one_or_none()

        if existing_foia:
            logger.info(
                f"FOIA already filed for article {article.id} (case {existing_foia.case_number})"
            )
            return {
                "skipped": True,
                "reason": "FOIA already filed",
                "case_number": existing_foia.case_number,
            }

        case_number = await assign_case_number(db)
        request_text = generate_request_text(
            incident_description=article.headline or "incident",
            incident_date=(
                article.published_at.strftime("%B %d, %Y")
                if article.published_at
                else None
            ),
            agency_name=agency.name,
            custom_template=agency.foia_template,
        )

        response_days = agency.avg_response_days or 30
        now = datetime.now(timezone.utc)

        # Create FOIA request — status depends on mode
        initial_status = (
            FoiaStatus.draft if auto_submit_mode == "dry_run" else FoiaStatus.ready
        )
        foia = FoiaRequest(
            case_number=case_number,
            agency_id=agency.id,
            news_article_id=article.id,
            status=initial_status,
            request_text=request_text,
            is_auto_submitted=True,
        )
        db.add(foia)

        try:
            await db.flush()  # Get ID for audit trail
        except IntegrityError:
            # Race condition caught: another process created a FOIA for this article-agency pair
            await db.rollback()
            logger.info(
                f"Duplicate FOIA prevented by database constraint for article {article.id} "
                f"(article-agency pair already exists)"
            )
            # Find the existing FOIA to return its case number
            existing = (
                await db.execute(
                    select(FoiaRequest).where(
                        FoiaRequest.news_article_id == article.id,
                        FoiaRequest.agency_id == agency.id,
                    )
                )
            ).scalar_one_or_none()
            return {
                "skipped": True,
                "reason": "Duplicate prevented by database constraint",
                "case_number": existing.case_number if existing else "unknown",
            }

        try:
            # Generate PDF (used by both dry_run and live)
            pdf_bytes = generate_pdf(request_text, case_number)

            # Upload PDF to S3 (useful for review in both modes)
            storage_key = f"foia/{case_number}.pdf"
            try:
                upload_file(pdf_bytes, storage_key, content_type="application/pdf")
                foia.pdf_storage_key = storage_key
            except Exception as s3_err:
                logger.error(f"S3 upload failed for {case_number}: {s3_err}")

            if auto_submit_mode == "dry_run":
                # ── DRY RUN: draft only, no email ─────────────────────────
                # foia.status is already draft from creation above
                # Do NOT send email, do NOT mark article as filed

                notification = Notification(
                    type=NotificationType.foia_submitted,
                    channel=NotificationChannel.in_app,
                    title=f"Dry Run: FOIA {case_number} drafted for {agency.name}",
                    message=(
                        f"Auto-submit dry run created draft FOIA {case_number} "
                        f"for: {(article.headline or '')[:120]}"
                    ),
                    link=f"/foia?detail={foia.id}",
                )
                db.add(notification)

                await _log_auto_submit_decision(
                    db, article, agency, "dry_run", "dry_run_mode",
                    today_count, agency_week_count,
                    float(estimated_cost) if estimated_cost else None,
                )
                await db.commit()

                await publish_sse("foia_dry_run", {
                    "case_number": case_number,
                    "agency": agency.name,
                })

                logger.info(
                    f"Dry-run FOIA {case_number} drafted for article {article.id}"
                )
                return {
                    "case_number": case_number,
                    "agency": agency.name,
                    "mode": "dry_run",
                }

            else:
                # ── LIVE: send email + mark submitted ─────────────────────
                subject = f"Public Records Request - {case_number}"
                email_result = await send_foia_email(
                    to_email=agency.foia_email,
                    subject=subject,
                    body_text=request_text,
                    pdf_bytes=pdf_bytes,
                    pdf_filename=f"{case_number}.pdf",
                )

                if not email_result.get("success"):
                    raise Exception(f"Email failed: {email_result.get('message')}")

                # Email sent successfully — mark as submitted
                foia.status = FoiaStatus.submitted
                foia.submitted_at = now
                foia.due_date = now + timedelta(days=response_days)
                article.auto_foia_filed = True

                # Record status change audit trail
                audit_entry = FoiaStatusChange(
                    foia_request_id=foia.id,
                    from_status=FoiaStatus.ready.value,
                    to_status=FoiaStatus.submitted.value,
                    changed_by="auto_submit_system",
                    reason=f"Auto-submitted from article: {article.headline}",
                    extra_metadata={
                        "article_id": str(article.id),
                        "agency_email": agency.foia_email,
                    },
                )
                db.add(audit_entry)

                await _log_auto_submit_decision(
                    db, article, agency, "filed", "live_submission",
                    today_count, agency_week_count,
                    float(estimated_cost) if estimated_cost else None,
                )
                await db.commit()

                logger.info(
                    f"Auto-submitted FOIA {case_number} for article {article.id}"
                )
                return {"case_number": case_number, "agency": agency.name}

        except Exception as e:
            logger.error(f"Auto-submit failed for article {article.id}: {e}")

            # Create error notification for manual review
            notification = Notification(
                type=NotificationType.system_error,
                channel=NotificationChannel.in_app,
                title="Auto-Submit Failed",
                message=f"Failed to auto-submit FOIA {case_number} for: {article.headline}. Error: {str(e)[:200]}",
                link=f"/news?article={article.id}",
            )
            db.add(notification)
            await db.commit()

            return {"error": str(e), "case_number": case_number}


@celery_app.task(name="app.tasks.foia_tasks.check_foia_inbox", bind=True, max_retries=3)
def check_foia_inbox(self):
    """Check IMAP inbox for FOIA responses."""
    logger.info("Checking FOIA inbox")
    try:
        async def _locked_check():
            from app.services.cache import LockError, distributed_lock, publish_sse
            try:
                async with distributed_lock("foia-inbox-check", timeout=300):
                    result = await _check_inbox_async()
                    if result and result.get("processed", 0) > 0:
                        await publish_sse("foia_response", {"processed": result["processed"]})
                    return result
            except LockError:
                logger.info("Inbox check already running, skipping")
                return {"skipped": True, "reason": "lock_held"}
        result = _run_async(_locked_check())
        logger.info(f"Inbox check complete: {result}")
        return result
    except Exception as exc:
        logger.error(f"Inbox check failed: {exc}")
        raise self.retry(exc=exc, countdown=60)


@celery_app.task(name="app.tasks.foia_tasks.check_foia_deadlines")
def check_foia_deadlines():
    """Check for approaching and overdue FOIA deadlines."""
    logger.info("Checking FOIA deadlines")
    try:
        result = _run_async(_check_deadlines_async())
        logger.info(f"Deadline check: {result}")
        return result
    except Exception as e:
        logger.error(f"Deadline check failed: {e}")
        return {"error": str(e)}


@celery_app.task(name="app.tasks.foia_tasks.auto_submit_foia")
def auto_submit_foia(article_id: str):
    """Auto-generate and submit a FOIA for an eligible article."""
    logger.info(f"Auto-submitting FOIA for article {article_id}")
    try:
        result = _run_async(_auto_submit_async(article_id))
        logger.info(f"Auto-submit result: {result}")
        return result
    except Exception as e:
        logger.error(f"Auto-submit failed: {e}")
        return {"error": str(e)}
