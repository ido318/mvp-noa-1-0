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
- `server/routes/tools.ts` — ElevenLabs tool endpoints (all protected by `verifyElevenLabsSignature`):
  - `/tools/lookup-customer` — find customer + pets by phone
  - `/tools/escalate-to-noa` — create escalation record
  - `/tools/check-availability` — free slots by visit type + date (14-day window, calendar_blocks aware)
  - `/tools/book-appointment` — atomic booking; neutering → `pending_approval`
  - `/tools/cancel-or-reschedule` — 4-hour rule enforced; late = `late_cancellation`
  - `/tools/join-waitlist` — write to `waitlist` table
  - `/tools/triage-pet-case` — local triage engine
- `server/routes/hooks.ts` — `/hooks/call-ended` webhook from ElevenLabs; upserts to `voice_calls`
- `lib/store.ts` — all Supabase data access for the agent
- `lib/appointments.ts` — slot logic: `VISIT_TYPE_CONFIG`, `generateSlotsForVisitType`, `isWithin14Days`, `isTooLateToCancel`
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
- Migrations in `supabase/migrations/` — run in timestamp order; 14 migrations total (through `20260612000014_sprint1_appointments.sql`)
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

**Tests** — `app/tests/unit/` tests are pure unit tests with mocked services. `app/tests/integration/` hit a real local Supabase (set `RUN_INTEGRATION_TESTS=true`). Agent tests live in `agent/tests/unit/`.

## Environment Variables

See `agent/.env.example` and `app/.env.example`.

Agent-only: `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID`, `ELEVENLABS_WEBHOOK_SECRET`, `AGENT_CLINIC_ID`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, `PUBLIC_BASE_URL`, `PORT`

App-only: `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `OPENAI_API_KEY`, `APP_ENV`

Shared (same Supabase project): `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

---

## החלטות מחייבות — אל תשנה בלי אישור מפורש

### ארכיטקטורה
- נתיב הקול היחיד: Twilio → ElevenLabs (הסוכן "תומר").
  ה-DTMF service בארכיון (`docs/archive/`) — לא מחזירים אותו לנתיב הריצה.
- סכמת Supabase אחת. אסור ליצור טבלאות `voxly_*` — בוטלו.
  הסוכן כותב ל: `customers`, `escalations`, `voice_calls`, `appointments`, `waitlist` (תמיד עם `clinic_id`).
- שתי סכמות env נפרדות (`agent/src/lib/env.ts`, `app/lib/env.ts`) — לא מאחדים.
- `last_visit` הוסר מה-MVP — בעתיד ייגזר מטבלת `appointments`.

### יומן ותורים (הוחלט בפגישה 2026-06-11)
1. **יומן פנימי בלבד** — אין אינטגרציה ל-Google Calendar/Waze בפיילוט. טבלת `appointments` בלבד.
2. **תומר קובע תורים סופית** — חריג: עיקור/סירוס (`neutering`) → סטטוס `pending_approval`, ממתין לאישור נועה בדשבורד.
3. **חלון קביעה: 14 יום קדימה בלבד** — `isWithin14Days()` ב-`appointments.ts`.
4. **ביטול/הזזה — כלל 4 שעות:**
   - ≥ 4 שעות לפני → ביטול חינם (`cancelled`)
   - < 4 שעות → `late_cancellation` (חיוב מלא — סימון בלבד, אין סליקה בפיילוט)
5. **משכי ביקורים (effective = visit + buffer, מאוחסן ב-`duration_minutes`):**
   | סוג | ביקור | באפר | effective |
   |---|---|---|---|
   | `checkup` | 30 דק' | 10 דק' | 40 דק' |
   | `home_visit` | 60 דק' | 30 דק' | 90 דק' |
   | `vaccination` | 20 דק' | 10 דק' | 30 דק' |
   | `phone_consultation` | 20 דק' | 0 | 20 דק' |
   | `neutering` | 30 דק' | 10 דק' | 40 דק' |
6. **שעות פעילות:** א'-ה' 08:00-20:00, ו' 08:30-13:00, שבת סגור.
7. **חסימות יומן:** טבלת `calendar_blocks` — נועה חוסמת חופשות, תומר מציע תורים רק אחרי החזרה.
8. **אין תור פנוי:** רישום ל-`waitlist` + "אם המצב מחמיר — פנה לבית חולים וטרינרי".
9. **שינוי תור ע"י נועה בדשבורד → SMS עדכון ללקוח** (שיחה יוצאת = פאזה 2, לא עכשיו).
10. **תשלומים/חשבוניות = פאזה 2** — לא לבנות עכשיו.

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

### ספרינט 2 (עתידי)
- דשבורד: תצוגת `pending_approval` ואישור/דחיה של תורי עיקור/סירוס
- דשבורד: ניהול `calendar_blocks` (UI לחסימת חופשות)
- דשבורד: תצוגת `waitlist`
- SMS עדכון ללקוח כשנועה מזיזה תור (Twilio Messaging)
- migration `20260612000014` — להחיל על cloud (sprint 1 הושלם 2026-06-11)
