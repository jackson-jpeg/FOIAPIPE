# FOIA Archive: parked, and how to bring it back

Parked on 2026-11-19 (Jackson: "back burner, cleanly"). This file is the whole story in one place.

## What it did

An internal tool for one operator running a police-accountability video channel about Tampa Bay.

1. **Discover.** Scanned Tampa Bay news (RSS every 30 min, scraped and web sources hourly) for
   police incidents, classified and ranked them with Claude.
2. **Request.** Wrote a public-records request for the bodycam footage (Florida Chapter 119) to the
   right agency and sent it from `recordsrequest@foiaarchive.com` (iCloud custom-domain mail).
3. **Track.** Read the inbox every 15 minutes, matched replies to requests, flagged deadlines daily,
   drafted appeals for denials, and graded each agency on how it answered (weekly report cards).
4. **Edit.** A video pipeline: upload the footage, cut it, subtitles, thumbnail, storage on S3/R2.
5. **Publish.** Scheduled uploads to YouTube with metadata, then pulled YouTube analytics and revenue
   daily to show what each request earned against what it cost.

Code: FastAPI + SQLAlchemy/Alembic (16 migrations) in `backend/`, Celery worker and beat on Redis,
Postgres 16; Vite + React front end in `frontend/`. Public page `/public` shows stats and agency
report cards from the API.

## What died

- **The Railway app and its database.** The front end still calls
  `https://foiapipe-production.up.railway.app/api`, which answers 404 "Application not found"
  (checked 2026-11-19). The Railway project was `foiapipe-backend` (services: API, celery-worker).
- **No copy of the data.** The nightly backup task ran `pg_dump` to a file inside the Railway
  container, never off-box, so the backups went with it. No dump exists on the VPS or the Mac.
  Every request, agency contact, article, video record and analytics row is gone. Only the seed
  data (`backend/app/seed.py`, the agency list) can be rebuilt.
- Whatever the S3/R2 bucket held is unknown: `S3_BUCKET_NAME` was set only in Railway's
  environment. If the bucket still exists, the footage in it may have survived.

What still works: the domain (Squarespace, renews 2027-02-09), the static front end on Vercel, and
this repo. The site is parked: robots.txt disallows everything, every page is noindex, the sign-in
page says "Parked. Back later." while the API does not answer, and it links `/privacy.html`.

## What a restart takes

1. **API and Postgres on the VPS** (not Railway again). A database `foiaarchive` on the box's
   `postgresql@16-main`, a systemd unit for uvicorn on a loopback port, one for the Celery worker
   and one for beat (each `Nice=19`, a `CPUQuota`, the box's rules), Redis (not on the box today:
   install it or swap Celery for a lighter queue), an nginx site `api.foiaarchive.com` with
   certbot, and the backup going off-box nightly like High Desert's (dump checked, copied to the Mac).
   Then `alembic upgrade head`, `python -m app.seed`, set `VITE_API_URL` on Vercel and redeploy.
   The sign-in page comes back by itself once `/api/health` answers 200.
2. **The records-request part.** iCloud app password for `recordsrequest@foiaarchive.com` (SMTP and
   IMAP), re-check each agency's records address in the seed (they move), and a dry run that sends
   one request to yourself before any agency gets one.
3. **The YouTube part.** A Google Cloud OAuth client with the YouTube Data and Analytics APIs, a
   fresh refresh token for the channel, and S3/R2 (or the VPS disk, sized to the Mac rule) for footage.
4. Keys it reads: `ANTHROPIC_API_KEY` (classifying and drafting), optional `OPENAI_API_KEY`,
   Twilio for text alerts (or replace with `ops-page`), Sentry (optional). Every Claude call should
   count against the studio's AI budget like Sanger's do.

Rough size: a day for 1 (the box already runs this shape for SoGoJet and High Desert), half a day
each for 2 and 3, plus the time agencies take to answer.

## Jackson's edge

Most bodycam channels stop at the video. This one should **follow each case through the court
record**: from the incident to the arrest, the charges, every hearing and the outcome, read from the
public docket (the same court-record work as ECFiler and Docket4Me). The request tracker already
keys everything on an incident; add the case number, watch the docket, and publish the follow-up
when it resolves. That turns one video per incident into a story with an ending, which is what keeps
viewers and what nobody else in the niche does.
