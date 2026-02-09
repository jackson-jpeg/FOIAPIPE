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
    from app.services.email_monitor import check_inbox

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
                continue

            response_type = resp.get("response_type", "unknown")
            status_map = {
                "acknowledged": FoiaStatus.acknowledged,
                "fulfilled": FoiaStatus.fulfilled,
                "denied": FoiaStatus.denied,
                "processing": FoiaStatus.processing,
                "cost_estimate": FoiaStatus.processing,
            }

            if response_type in status_map:
                foia.status = status_map[response_type]
                if response_type == "acknowledged":
                    foia.acknowledged_at = datetime.now(timezone.utc)
                elif response_type == "fulfilled":
                    foia.fulfilled_at = datetime.now(timezone.utc)

            if resp.get("estimated_cost") is not None:
                foia.estimated_cost = resp["estimated_cost"]

            # Store response email
            if not foia.response_emails:
                foia.response_emails = []
            foia.response_emails = foia.response_emails + [resp]

            processed += 1

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


async def _auto_submit_async(article_id: str):
    from sqlalchemy import select

    from app.database import async_session_factory
    from app.models.agency import Agency
    from app.models.foia_request import FoiaRequest, FoiaStatus
    from app.models.news_article import NewsArticle
    from app.services.email_sender import send_foia_email
    from app.services.foia_generator import (
        assign_case_number,
        generate_pdf,
        generate_request_text,
    )

    async with async_session_factory() as db:
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

        case_number = await assign_case_number(db)
        request_text = generate_request_text(
            incident_description=article.headline or "incident",
            incident_date=(
                article.published_at.strftime("%B %d, %Y")
                if article.published_at
                else None
            ),
            agency_name=agency.name,
        )

        foia = FoiaRequest(
            case_number=case_number,
            agency_id=agency.id,
            news_article_id=article.id,
            status=FoiaStatus.submitted,
            request_text=request_text,
            submitted_at=datetime.now(timezone.utc),
            due_date=datetime.now(timezone.utc) + timedelta(days=30),
            is_auto_submitted=True,
        )
        db.add(foia)

        # Generate and send
        pdf_bytes = generate_pdf(request_text, case_number)
        subject = f"Public Records Request - {case_number}"
        await send_foia_email(
            to_email=agency.foia_email,
            subject=subject,
            body_text=request_text,
            pdf_bytes=pdf_bytes,
            pdf_filename=f"{case_number}.pdf",
        )

        article.auto_foia_filed = True
        await db.commit()

        return {"case_number": case_number, "agency": agency.name}


@celery_app.task(name="app.tasks.foia_tasks.check_foia_inbox", bind=True, max_retries=3)
def check_foia_inbox(self):
    """Check IMAP inbox for FOIA responses."""
    logger.info("Checking FOIA inbox")
    try:
        result = _run_async(_check_inbox_async())
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
