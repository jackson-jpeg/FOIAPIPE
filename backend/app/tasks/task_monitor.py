"""Celery task monitoring — records task start/complete/failure to task_runs table."""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone

from celery.signals import task_prerun, task_postrun, task_failure

logger = logging.getLogger(__name__)


def _run_sync(coro):
    """Run async code synchronously in Celery signal handlers."""
    import asyncio
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


async def _record_task_start(task_id: str, task_name: str):
    from app.database import async_session_factory
    from app.models.task_run import TaskRun, TaskRunStatus

    async with async_session_factory() as db:
        run = TaskRun(
            task_name=task_name,
            celery_task_id=task_id,
            started_at=datetime.now(timezone.utc),
            status=TaskRunStatus.started,
        )
        db.add(run)
        await db.commit()


async def _record_task_complete(task_id: str, task_name: str, retval):
    from sqlalchemy import select

    from app.database import async_session_factory
    from app.models.task_run import TaskRun, TaskRunStatus

    async with async_session_factory() as db:
        result = await db.execute(
            select(TaskRun)
            .where(TaskRun.celery_task_id == task_id)
            .order_by(TaskRun.started_at.desc())
            .limit(1)
        )
        run = result.scalar_one_or_none()
        if run:
            now = datetime.now(timezone.utc)
            run.status = TaskRunStatus.success
            run.completed_at = now
            if run.started_at:
                run.duration_seconds = (now - run.started_at).total_seconds()
            # Summarize result
            try:
                if isinstance(retval, dict):
                    run.result_summary = json.dumps(retval)[:500]
                elif retval is not None:
                    run.result_summary = str(retval)[:500]
            except Exception:
                pass
            await db.commit()


async def _record_task_failure(task_id: str, task_name: str, exception):
    from sqlalchemy import select

    from app.database import async_session_factory
    from app.models.task_run import TaskRun, TaskRunStatus

    async with async_session_factory() as db:
        result = await db.execute(
            select(TaskRun)
            .where(TaskRun.celery_task_id == task_id)
            .order_by(TaskRun.started_at.desc())
            .limit(1)
        )
        run = result.scalar_one_or_none()
        if run:
            now = datetime.now(timezone.utc)
            run.status = TaskRunStatus.failure
            run.completed_at = now
            if run.started_at:
                run.duration_seconds = (now - run.started_at).total_seconds()
            run.error_message = str(exception)[:1000]
            await db.commit()


@task_prerun.connect
def on_task_prerun(sender=None, task_id=None, task=None, **kwargs):
    """Record task start."""
    try:
        task_name = sender.name if sender else "unknown"
        _run_sync(_record_task_start(task_id, task_name))
    except Exception as e:
        logger.debug(f"Task monitor prerun error: {e}")


@task_postrun.connect
def on_task_postrun(sender=None, task_id=None, task=None, retval=None, **kwargs):
    """Record task completion."""
    try:
        task_name = sender.name if sender else "unknown"
        _run_sync(_record_task_complete(task_id, task_name, retval))
    except Exception as e:
        logger.debug(f"Task monitor postrun error: {e}")


@task_failure.connect
def on_task_failure(sender=None, task_id=None, exception=None, **kwargs):
    """Record task failure."""
    try:
        task_name = sender.name if sender else "unknown"
        _run_sync(_record_task_failure(task_id, task_name, exception))
    except Exception as e:
        logger.debug(f"Task monitor failure error: {e}")
