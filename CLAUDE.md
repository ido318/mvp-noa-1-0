# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

**Tomer** — a Hebrew-speaking voice AI agent for Dr. Noa Cabasheny's veterinary clinic (Get A Vet). Tomer answers inbound calls via Twilio + ElevenLabs Conversational AI when the vet is unavailable.

Two packages, one Supabase project:
- `agent/` — Hono server (Node.js 20, ESM) that bridges Twilio → ElevenLabs and exposes tool endpoints
- `app/` — Next.js 16 dashboard for the clinic staff to view calls, customers, and visits

## Commands

### Root (runs across both workspaces)
```bash
npm run test:all          # run all tests (agent + app)
npm run typecheck:all     # typecheck both packages
```

### Agent (`cd agent`)
```bash
npm run dev               # start with hot reload (requires .env)
npm run build             # tsc compile to dist/
npm run test              # vitest run
npm run typecheck         # tsc --noEmit
```

### App (`cd app`)
```bash
npm run dev               # Next.js dev server on :3001
npm run build             # production build
npm run test              # vitest run (unit tests only)
npm run test:integration  # integration tests (requires live Supabase)
npm run seed:all          # seed dev user + demo data (requires local Supabase)
```

### Single test file
```bash
# Agent
cd agent && npx vitest run src/tests/foo.test.ts

# App
cd app && npx vitest run tests/unit/foo.test.ts
```

### Database
```bash
supabase start            # start local Supabase (from repo root or supabase/)
supabase db reset         # re-run all migrations + seed
```

## Architecture

### Call flow
```
[Caller] → [Twilio Israeli number]
         → POST /twilio/voice        (agent/)
         → ElevenLabs signed URL
         → ElevenLabs "Tomer" agent (Hebrew conversation)
              ├── POST /tools/lookup-customer  → customers + pets (Supabase)
              └── POST /tools/escalate-to-noa → escalations table (Supabase)
         → call ends → POST /hooks/call-ended
         → upsert to voice_calls table
```

### Agent (`agent/src/`)
- `server/app.ts` — Hono app factory, mounts all route groups
- `server/routes/twilio.ts` — Twilio webhook, validates signature, returns ElevenLabs signed URL via TwiML `<Stream>`
- `server/routes/tools.ts` — ElevenLabs tool endpoints (`/tools/lookup-customer`, `/tools/escalate-to-noa`); all protected by `verifyElevenLabsSignature`
- `server/routes/hooks.ts` — `/hooks/call-ended` webhook from ElevenLabs; upserts to `voice_calls`
- `lib/store.ts` — all Supabase data access for the agent (customers lookup, escalation insert, voice call upsert)
- `lib/env.ts` — typed env validation (throws on startup if vars are missing)

### App (`app/`)
Architecture is layered: `UI (page.tsx) → API route → Service → Repository → Supabase`

- `lib/services/factory.ts` — creates all services from Supabase clients; call `createServices()` in each API route
- `lib/api/auth-guard.ts` — `requireAuth()` used at the top of every protected API route
- `lib/supabase/server.ts` / `admin.ts` — server-side Supabase clients (server uses user session cookies; admin uses service role key)
- `app/middleware.ts` — redirects unauthenticated users away from `/dashboard/*`
- `lib/repositories/` — one file per entity, thin wrappers around Supabase queries
- `lib/validators/` — Zod schemas for request validation
- `types/domain/` — shared domain types; `types/api/` — request/response shapes

### Supabase
- **Cloud project:** `xpsuhtqfxqmnunppnyov` (account: voxly ai, region: eu-central-1, Frankfurt) — `https://xpsuhtqfxqmnunppnyov.supabase.co`
  Old projects (deleted): `ssfkximqwyzqlsgwfbye` (Seoul), `voxly-tomer` (`grbgkjjtyfohzulssuga`).
- Migrations in `supabase/migrations/` — run in timestamp order; all 12 applied to cloud as of 2026-06-11
- RLS is enabled on all tables; the app uses the anon key + user session for data access, the service role key only for admin operations (audit logs, AI events, health checks)
- Multi-tenant by `clinic_id` — every data table has a `clinic_id` column
- Clinic seed: Get A Vet → `AGENT_CLINIC_ID=37681721-a59f-40d5-a041-ad15a49ecf29`

## Key Patterns

**API routes** in `app/` follow this pattern:
```ts
const { auth, customer } = await createServices();
const actor = await requireAuth(auth);
// validate with zod, call service, return ok/error response
```

**Tool endpoints** in `agent/` validate the ElevenLabs HMAC signature before handling (`/tools/*` middleware in `tools.ts`). Responses to ElevenLabs tools must be `{ result: string }`.

**Phone normalisation** — Israeli numbers are normalised to E.164 (`054...` → `+97254...`) in `agent/lib/store.ts:normalisePhone`.

**Tests** — `app/tests/unit/` tests are pure unit tests with mocked services. `app/tests/integration/` hit a real local Supabase (set `RUN_INTEGRATION_TESTS=true`). Agent tests live in `agent/src/tests/` (or alongside source).

## Environment Variables

See `agent/.env.example` and `app/.env.example`.

Agent-only: `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID`, `ELEVENLABS_WEBHOOK_SECRET`, `AGENT_CLINIC_ID`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, `PUBLIC_BASE_URL`, `PORT`

App-only: `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `OPENAI_API_KEY`, `APP_ENV`

Shared (same Supabase project): `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

---

## החלטות מחייבות — אל תשנה בלי אישור מפורש

- נתיב הקול היחיד: Twilio → ElevenLabs (הסוכן "תומר").
  ה-DTMF service בארכיון (`docs/archive/`) — לא מחזירים אותו לנתיב הריצה.
- סכמת Supabase אחת. אסור ליצור טבלאות `voxly_*` — בוטלו.
  הסוכן כותב ל: `customers`, `escalations`, `voice_calls` (תמיד עם `clinic_id`).
- שתי סכמות env נפרדות (`agent/src/lib/env.ts`, `app/lib/env.ts`) — לא מאחדים.
- `last_visit` הוסר מה-MVP — בעתיד ייגזר מטבלת `appointments`.

## כללי עבודה

- עבודה בשלבים: תוכנית → אישור → ביצוע → עצירה לאישור.
  אל תתקדם בלי אישור מפורש.
- בסוף כל משימה: הצע commit מסודר (`feat`/`fix`/`chore`), ודא שאין
  קבצי env או קבצים זמניים ב-staging.
- אסור לקמט קבצי `.env`, סודות, או קבצי `*.timestamp-*.mjs`.
- תקשורת עם המשתמש בעברית. קוד והודעות commit באנגלית.
- תיעוד מרכזי בנושן: דף Voxly-Tomer (`36f1354b584881b587c5c6f42a6bf6c7`).

## משימות פתוחות

ראה Backlog בדף הנושן: חיבור פרויקטי Vercel, שדרוג ל-`@elevenlabs/elevenlabs-js`, `npm audit`.
(migration `20260611000012` — הושלם 2026-06-11)
