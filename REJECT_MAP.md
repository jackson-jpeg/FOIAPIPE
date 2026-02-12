# REJECT MAP — Binding "Don't Do" Decisions

These are deliberate architectural and product decisions. Do not revisit unless explicitly instructed.

---

## Safety

1. **No auto-submit of FOIA requests.** `auto_submit_enabled` must always default to `false`. Every FOIA submission to a government agency requires explicit manual trigger. FOIA requests are legally binding public records requests.

2. **No real email sending without confirmation.** The email sender must never silently send to agency email addresses. All sends must be logged and auditable.

3. **No secrets in git.** `.env` is gitignored. Only `.env.example` (with placeholder values) is tracked. Never commit API keys, passwords, or tokens.

## Architecture

4. **No multi-tenant auth.** Single admin user only. No user registration, no role-based access control. If multi-user is needed later, it's a new phase.

5. **No SQLite for tests.** Tests must use PostgreSQL (`foiaarchive_test` database) because the app uses Postgres-specific features (UUID, JSONB, pg_trgm, enum types).

6. **No ORM model changes without Alembic migration.** Never modify model columns and expect them to auto-apply. Always generate and review a migration.

7. **No synchronous database access in FastAPI routes.** All DB operations must use async SQLAlchemy (`AsyncSession`).

## Product

8. **No AI-generated FOIA request text without human review.** The classifier is keyword-based (Phase 2). Even when AI is added later, generated request text must be reviewable before submission.

9. **No automatic video publishing.** YouTube uploads must be manually triggered and reviewed.

10. **No scraping behind paywalls or login walls.** Only publicly accessible RSS feeds and article pages. Respect robots.txt.

## Infrastructure

11. **No Docker in development for app code.** Docker is for Postgres and Redis only. Backend and frontend run natively for fast iteration.

12. **No Kubernetes.** Deployment target is Railway. Keep it simple.

13. **No monorepo tooling (nx, turborepo).** The project is small enough for plain npm + pip.
