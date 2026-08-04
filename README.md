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
2. The student opens their link, enters a lead's name/email/company/public
   social links, and picks a channel (email, LinkedIn, Meta DM, WhatsApp).
3. The app researches the lead's company from public information only (web
   search — no scraping behind logins, no paid enrichment), surfaces likely
   operational gaps, and drafts **two** message options — channel-appropriate,
   written in the student's own voice, and informed by whatever has
   previously worked for that student on that channel.
4. The student copies whichever draft they like and sends it themselves.
   There's no auto-send in this build, on any channel — see
   `../SYO_Outreach_Agent_Plan.docx` (the plan shared with the team) for why.
5. Every copied draft is logged; if the student later marks what happened
   to it (reply / booked / no reply / not interested — via `POST
   /api/outcomes`), future drafts for that student get better informed by
   what's actually worked.

## Explicitly not in this build

- **Login/accounts.** Each student gets an individual link instead — see
  the plan doc for when full auth might get revisited.
- **Auto-send**, on any channel — copy-to-send only.
- **Reply monitoring** — depends on auto-send/inbox access, which isn't
  wired up here.

## Setup

```
npm install
cp .env.example .env   # fill in ANTHROPIC_API_KEY + your own Upstash Redis
npm run dev
```

Open http://localhost:3000 — create a student agent there, then open its
`/agent/<id>` link.

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
src/tools/outreachMemory.ts      log_message / update_outcome / get_outreach_context /
                                 get_performance_summary — hosted port of the
                                 original Stage 1 local MCP server's logic
src/tools/companyGapAnalysis.ts  researches a lead's public company info (web search)
src/outreachAgent.ts             builds the drafting prompt (tone + history + gap
                                 analysis + channel-specific writing rules) and
                                 generates two draft options
app/page.tsx                     create/list student agents
app/agent/[id]/page.tsx          the student-facing tool: lead form, channel picker,
                                 gap-analysis summary, two drafts, copy-to-send
app/api/agents/                  CRUD for student agents
app/api/generate/                gap analysis + drafting, per request
app/api/outcomes/                log / update outcome / performance summary
```

## Deploying

Same pattern as any Next.js app on Vercel: push to its own GitHub repo,
import at vercel.com/new, add `ANTHROPIC_API_KEY` as an env var, connect a
**new** Upstash Redis database from the Storage tab, deploy.

## Channel writing rules

The per-channel drafting rules baked into `src/outreachAgent.ts`
(`CHANNEL_RULES`) are distilled from internal research on what performs on
each channel — subject-line length and structure for email, the
connection-note/DM structure for LinkedIn, casual short-form for Meta DMs,
and WhatsApp's template-vs-freeform-window split. Update that object
directly if the guidance changes.
