# SYO Outreach Agent

Standalone app — separate repo, separate deploy URL, separate Redis
database from anything else. Gives each Scale Your Offers student a
shareable link to their own outreach drafting agent: informed by their own
tone, their own outreach history, and public research on each lead's
company.

## What it does

1. You (or whoever sets a student up) create an agent: student name, niche,
   a tone-reference sample of their own writing, and any background
   materials. This saves and gets a shareable link: `/agent/<id>`.
2. The student opens their link and lands on a left-nav of channels
   (Email, WhatsApp, LinkedIn, Meta DM) — **only Email is built out**; the
   others are visibly present but disabled ("· soon") until they're built.
3. On the Email page, the student:
   - Connects their own Gmail account (OAuth — see Setup below)
   - Uploads a CSV of leads (`name, email, company, companyWebsite,
     socialLinks`)
   - Clicks "Generate drafts" — for each lead, the app researches the
     company from public info only (web search, no scraping behind
     logins, no paid enrichment), surfaces likely operational gaps, and
     drafts **two** message options in the student's own voice, informed
     by whatever's previously worked for that student
   - Reviews each lead's two drafts and either **approves one** (which
     unlocks Send) or **rejects both**
   - Clicks **Send** — the approved draft goes out through the student's
     own connected Gmail account
4. A dashboard at the top of the Email page shows totals sent, reply rate,
   and booked rate, computed from the same outreach-memory logic as Stage 1.
   Every sent message is logged so future drafts get better informed by what
   actually worked.

## Explicitly not in this build

- **Login/accounts.** Each student gets an individual link instead — see
  the plan doc for when full auth might get revisited.
- **Auto-send on LinkedIn/Meta/WhatsApp** — those channels aren't built yet.
  When they are, per the earlier plan, they should stay copy-to-send
  (platform ToS risk), unlike email.
- **Reply/bounce monitoring, warm-up ramping, suppression lists, multi-step
  sequences.** A companion tool (an internal cold-email sequencer) has all
  of this built for a different use case — one team, high-volume, shared
  mailboxes — and it's a bigger lift than this stage needs. Worth revisiting
  if/when reply-tracking becomes a real ask.
- **Large-batch generation.** `/api/leads/generate` processes leads
  sequentially in one request — fine for realistic batch sizes (tens of
  leads), but a very large CSV can hit Vercel's serverless function time
  limit. If that becomes a real constraint, this is the point where
  generation would need to move to a background job/queue instead.

## Setup

```
npm install
cp .env.example .env   # fill in ANTHROPIC_API_KEY, Redis, and Google OAuth creds
npm run dev
```

Open http://localhost:3000 — create a student agent there, then open its
`/agent/<id>` link (redirects straight to `/agent/<id>/email`).

### Google OAuth (Gmail send)

See the comments in `.env.example` for the full setup steps (Google Cloud
Console → OAuth Client ID → enable Gmail API → redirect URI → scopes). One
thing worth knowing ahead of time: a newly-created OAuth app starts in
"Testing" mode, capped at 100 test users, until it goes through Google's
verification process for sensitive scopes like `gmail.send` — that
verification has real lead time (a privacy policy, a demo video, etc.), so
worth starting early if you expect more than ~100 students to connect
their own Gmail eventually.

### Redis

This app needs **its own** Upstash Redis database — do not point it at
another project's instance. On Vercel: Storage tab -> connect a new
Upstash for Redis database to *this* project -> env vars are injected
automatically. Locally, create a free Upstash database and copy its REST
URL/token into `.env`.

## Project structure

```
src/types.ts                    shared types
src/agentStore.ts                persistence for student agents (Redis)
src/leadStore.ts                 persistence for uploaded leads + their draft/approval/send status
src/gmailAccountStore.ts         persistence for each agent's connected Gmail account
src/tools/outreachMemory.ts      log_message / update_outcome / get_outreach_context /
                                 get_performance_summary — hosted port of the
                                 original Stage 1 local MCP server's logic
src/tools/companyGapAnalysis.ts  researches a lead's public company info (web search)
src/tools/gmail.ts               Gmail OAuth + send — ported from a reference
                                 cold-email-sequencer tool, trimmed to just connect + send
src/outreachAgent.ts             builds the drafting prompt (tone + history + gap
                                 analysis + channel-specific writing rules) and
                                 generates two draft options

app/page.tsx                     create/list student agents
app/agent/[id]/layout.tsx        left-nav channel sidebar (Email active, others "· soon")
app/agent/[id]/page.tsx          redirects to /agent/[id]/email
app/agent/[id]/email/page.tsx    the Email channel: dashboard, Gmail connect + signature,
                                 CSV lead upload, generate drafts, review/approve/reject, send

app/api/agents/                  CRUD for student agents
app/api/generate/                single-lead gap analysis + drafting (used ad hoc)
app/api/leads/                   bulk lead upload + list
app/api/leads/generate/          batch gap analysis + drafting for uploaded leads
app/api/leads/[id]/              approve/reject a lead's drafts
app/api/leads/[id]/send/         sends the approved draft via the connected Gmail account
app/api/gmail/connect/           starts the Gmail OAuth flow for an agent
app/api/gmail/callback/          OAuth callback — stores tokens
app/api/gmail/account/           connection status, signature, disconnect
app/api/outcomes/                log / update outcome / performance summary
```

## Deploying

Same pattern as any Next.js app on Vercel: push to its own GitHub repo,
import at vercel.com/new, add `ANTHROPIC_API_KEY` as an env var, connect a
**new** Upstash Redis database from the Storage tab, deploy.

## Reply/bounce tracking + do-not-contact list (email only)

Not webhook-driven — Gmail doesn't offer a simple per-message webhook for
this. Instead, `/api/cron/poll-replies` re-checks each sent email's Gmail
thread for a reply, and separately searches each connected inbox for
bounce-shaped messages, matching them back to the right lead. Ported from a
reference cold-email-sequencer tool's polling approach (see
`src/tools/gmail.ts`).

- A reply containing the word "stop" is treated as an unsubscribe: the lead
  is marked unsubscribed and their email is added to the do-not-contact list.
  Any other reply is marked "replied."
- A bounce is detected by searching the inbox for delivery-failure-shaped
  messages and matching the failed address back to a lead; also
  auto-added to the do-not-contact list.
- The do-not-contact list is checked before any new lead is added (via CSV
  or the single-lead form) — a suppressed email is silently skipped. It's
  also viewable/manageable (manual add/remove) on the Email page.
- **"Booked" is never automatic** — knowing someone replied isn't the same
  as knowing they booked a call. Every sent email also has a manual "Mark
  outcome" dropdown so a student can record that themselves, on any channel,
  without waiting for the poller.

**Scheduling it:** no Vercel Cron config needed — this app uses a free
external scheduler instead, which sidesteps Vercel Hobby's once-per-day cron
limit entirely. Any scheduler that can send a custom header works (e.g.
cron-job.org, EasyCron):
1. Create a job that sends a **GET** request to:
   `https://<your-domain>/api/cron/poll-replies`
2. Add a custom header: `Authorization: Bearer <your CRON_SECRET value>`
3. Set the schedule (e.g. every 30 minutes, or hourly)

Set `CRON_SECRET` (any random string, e.g. from `openssl rand -hex 32`) as
an env var in Vercel — it's what the endpoint checks the header against, so
random internet requests can't trigger it. Test it manually anytime with:
`curl -H "Authorization: Bearer $CRON_SECRET" https://<your-domain>/api/cron/poll-replies`

## Invite-only login

There's no public signup anywhere in this app, by design. The flow:

1. You (or whoever has the admin password) go to `/admin`, enter the admin
   password, and invite a student by email + name.
2. That creates their agent and a login for them, and emails them a
   temporary password (via Resend — see env vars below). The email includes
   a login link.
3. They log in at `/login`, get forced to set their own password on first
   login, then land on their agent's Email page.
4. `middleware.ts` protects every `/agent/[id]/*` **page** — a logged-in
   student can only reach the agent tied to their own login, and anyone
   without a valid session gets redirected to `/login`.

**Scope limit, stated plainly:** this locks down pages and the
agent-creation endpoint. It does **not** yet re-check session ownership
inside every individual API route under `/api/leads`, `/api/generate`,
`/api/gmail`, `/api/outcomes`, `/api/suppression` — those still trust
whatever `agentId` is passed in the request body/query. Real follow-up
hardening, not done in this pass.

**Env vars needed** (see `.env.example` for details):
- `ADMIN_SECRET` — the password for `/admin`
- `RESEND_API_KEY` — for sending invite emails (separate from the
  per-student Gmail OAuth used for outreach). Sending to arbitrary
  recipients typically needs a verified sending domain in Resend's
  dashboard — check their current docs.
- `RESEND_FROM_EMAIL` (optional) — defaults to `onboarding@resend.dev`
- `APP_URL` (optional) — used in the invite email's login link; falls back
  to the request's own host if unset

## Channel writing rules

The per-channel drafting rules baked into `src/outreachAgent.ts`
(`CHANNEL_RULES`) are distilled from internal research on what performs on
each channel — subject-line length and structure for email, the
connection-note/DM structure for LinkedIn, casual short-form for Meta DMs,
and WhatsApp's template-vs-freeform-window split. Update that object
directly if the guidance changes.
