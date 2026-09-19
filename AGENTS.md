# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## What This Is

**Tomer** — a Hebrew-speaking voice AI agent for Dr. Noa Cabasheny's veterinary clinic (Get A Vet). Tomer answers inbound calls via Twilio + ElevenLabs Conversational AI when the vet is unavailable.

Three npm workspaces, one Supabase project:
- `agent/` — Hono server (Node.js 20, ESM) that bridges Twilio → ElevenLabs and exposes tool endpoints
- `app/` — Next.js 16 dashboard for the clinic staff to view calls, customers, and visits
- `packages/shared/` — `@tomer/shared`: Jerusalem-timezone math, frozen SMS wording (8 templates), visit-type durations/labels, phone normalisation, and price-list SMS segments. Both `agent/` and `app/` import it — never reimplement it.

## Commands

### Root (runs across both workspaces)
```bash
npm run test:all          # run all tests (agent + app)
npm run typecheck:all     # typecheck both packages
npm run lint:all          # lint agent + app
npm run build:all         # build agent + app
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
cd agent && npx vitest run tests/unit/foo.test.ts

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
         → Twilio voice_url = https://api.elevenlabs.io/twilio/inbound-call
           (ElevenLabs native inbound — not our /twilio/voice)
         → ElevenLabs "Tomer" agent (Hebrew conversation)
              ├── POST /tools/lookup-customer  → customers + pets (Supabase)
              └── POST /tools/escalate-to-noa → escalations table (Supabase)
         → call ends → POST /hooks/call-ended
         → upsert to voice_calls table
```

`agent/src/server/routes/twilio.ts` (`/twilio/voice`, `/twilio/status`) is dead code in production, kept as a possible fallback. If Tomer goes silent, check the Twilio number's `voice_url` first.

### Agent (`agent/src/`)
- `server/app.ts` — Hono app factory, mounts all route groups
- `server/routes/twilio.ts` — Twilio webhook fallback (TwiML `<Stream>`); **not** the live production `voice_url`
- `server/routes/tools.ts` — ElevenLabs tool endpoints (all behind a Bearer check on `TOOLS_BEARER_TOKEN`, not HMAC — see Key Patterns):
  - `/tools/lookup-customer` — find customer + pets by phone
  - `/tools/escalate-to-noa` — create escalation record
  - `/tools/check-availability` — free slots by visit type + date (14-day window, calendar_blocks aware)
  - `/tools/book-appointment` — atomic booking; neutering → `pending_approval`
  - `/tools/cancel-or-reschedule` — 4-hour rule enforced; late = `late_cancellation`
  - `/tools/join-waitlist` — write to `waitlist` table
  - `/tools/triage-pet-case` — local triage engine
- `server/routes/hooks.ts` — `/hooks/call-ended` webhook from ElevenLabs; upserts to `voice_calls`
- `server/routes/jobs.ts` — `POST /jobs/process-notifications` (Bearer token auth); triggers SMS processor
- `lib/store.ts` — all Supabase data access for the agent
- `lib/appointments.ts` — slot logic: re-exports `VISIT_TYPE_CONFIG` from `@tomer/shared`, plus `generateSlotsForVisitType`, `isWithin14Days`, `isTooLateToCancel`
- `lib/notifications.ts` — enqueue/cancel/reschedule SMS notifications; DST-correct Jerusalem time helpers
- `lib/env.ts` — typed env validation (throws on startup if vars are missing)
- `services/sms.templates.ts` — thin re-export of `@tomer/shared`'s `smsTemplates` (8 approved Hebrew templates, wording frozen — do not change)
- `services/sms.service.ts` — Twilio SMS wrapper: `sendSms(to, body)`
- `services/notification.processor.ts` — atomic-claim processor: UPDATE WHERE status='pending' RETURNING *; 5-min stuck-row recovery
- `services/triage.service.ts` — `decideTriage({ text, now })` → 4 decisions + `isWithinBusinessHours`; 4 fixed Hebrew scripts (frozen)
- `knowledge/red-flags.ts` — 16 Hebrew red flags (TypeScript const); wording frozen — do not change without Noa's approval

### App (`app/`)
Architecture is layered: `UI (page.tsx) → API route → Service → Repository → Supabase`

- `lib/services/factory.ts` — creates all services from Supabase clients; call `createServices()` in each API route
- `lib/api/auth-guard.ts` — `requireAuth()` used at the top of every protected API route
- `lib/supabase/server.ts` / `admin.ts` — server-side Supabase clients (server uses user session cookies; admin uses service role key)
- `app/proxy.ts` — redirects unauthenticated users away from `/dashboard/*` (Next.js 16 proxy; not `middleware.ts`)
- `lib/repositories/` — one file per entity, thin wrappers around Supabase queries
- `lib/validators/` — Zod schemas for request validation
- `types/domain/` — shared domain types; `types/api/` — request/response shapes

### Supabase
- **Cloud project:** `xpsuhtqfxqmnunppnyov` (account: voxly ai, region: eu-central-1, Frankfurt) — `https://xpsuhtqfxqmnunppnyov.supabase.co`
  Old projects (deleted): `ssfkximqwyzqlsgwfbye` (Seoul), `voxly-tomer` (`grbgkjjtyfohzulssuga`).
- Migrations in `supabase/migrations/` — run in timestamp order; 50+ files. Applied versions can drift from local filenames, so check the applied list against the directory rather than assuming they match. This branch adds `20260919153000_increment_visit_share_view.sql`.
- pg_cron **not yet active** — see "הפעלת cron" below; activate manually after Vercel deploy
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

**Tool endpoints** in `agent/` require a Bearer token (`TOOLS_BEARER_TOKEN`), sent by ElevenLabs as a static request header — ElevenLabs ConvAI tool calls are not HMAC-signed. HMAC (`verifyElevenLabsSignature`) guards `/hooks/call-ended` only. Configuring `/tools/*` for HMAC per the old wording here breaks every tool call. Responses to ElevenLabs tools must be `{ result: string }`.

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

## הפעלת cron (אחרי Vercel deploy)

**הרץ את `supabase/scripts/cron-jobs.sql`** ב-SQL editor של Supabase, אחרי החלפת
שני ה-placeholders (`<AGENT_PUBLIC_URL>`, `<JOBS_BEARER_TOKEN>`). הסקריפט מגדיר
את שלושת ה-jobs ובטוח להרצה חוזרת.

⚠️ **`net.http_post`, לא `extensions.http_post`.** הגרסה הקודמת של הקטע הזה קראה
ל-`extensions.http_post` — פונקציה שלא קיימת בפרויקט (pg_net מתקין ל-schema בשם
`net`). כל שלושת ה-jobs נכשלו בכל הרצה מאז שהוגדרו, בזמן שהם נראו `active`, וכל
ה-SMS המתוזמנים נערמו ב-`notifications_log` בסטטוס `pending`. אל תיצור job מהזיכרון
או מקטע ישן — השתמש בסקריפט.

**בדיקה שה-job באמת עובד** (לא מספיק ש-`active=true`):

```sql
select jobid, status, return_message, start_time
from cron.job_run_details order by start_time desc limit 10;
```

לביטול: `SELECT cron.unschedule('process-sms-notifications');`

---

## משימות פתוחות

ראה Backlog בדף הנושן: חיבור פרויקטי Vercel, שדרוג ל-`@elevenlabs/elevenlabs-js`, `npm audit`.

### ספרינט 2 — הושלם (2026-06-12) ✅
- SMS pipeline: `notifications_log`, atomic-claim processor, DB trigger, 6 templates ✅
- migration 20260612000015 הוחל על cloud ✅
- 149 טסטים עוברים ✅
- pg_cron: ממתין להפעלה ידנית אחרי Vercel deploy (ראה "הפעלת cron" למעלה)

### ספרינט 3 — הושלם (2026-06-12) ✅
- מנוע טריאז': `decideTriage` עם 4 decisions + `isWithinBusinessHours` ✅
- 16 דגלים אדומים ב-TypeScript (`knowledge/red-flags.ts`) ✅
- 4 scripts Hebrew קבועים (frozen) ✅
- `/tools/triage-pet-case` מחזיר `{result: string}` + escalation + urgent_callback slot ✅
- 187 טסטים עוברים ✅

### ספרינט 4 — הושלם (2026-06-12) ✅

**Stage 0 — תשתית + אבטחה:**
- migration 20260612000017 הוחל על cloud ✅ (`transcript`, `ai_summary`, `call_category`, `recording_storage_path` ב-`voice_calls`)
- bucket `call-recordings` (private, 50MB) קיים בענן + RLS policy ✅
- תיקון SMS bug — תור `pending_approval` (עיקור/סירוס) לא שולח SMS בקביעה; רק בעת אישור ✅
- `/hooks/call-ended` מועשר: transcript, ai_summary, call_category, הקלטה ל-Storage ✅
- `verifyElevenLabsSignature` מאמת timestamp (חלון 300 שניות) נגד replay attacks ✅
- `callClassifier.ts` + `VALID_CALL_CATEGORIES` (single source of truth) ✅
- 199 agent + 55 app טסטים עוברים ✅

**Stage 1 — דשבורד CRM:**
- CSS design tokens (RTL, Heebo, `--brand-*`, keyframes) ✅
- Shell: sidebar + header + ToastProvider ✅
- 14 רכיבי UI: btn, badge, type-pill, call-status, urgency-meter, avatar, card, empty-state, skeleton, modal, drawer, toast ✅
- 7 API routes: escalations CRUD, approve/reject appointments, recording signed URL, pets list ✅
- 5 מסכים: היום (timeline 08:00–20:00 + pending_approval), יומן (week calendar RTL), שיחות (table + CallDrawer + audio), אסקלציות (resolve flow), לקוחות (profile drawer) ✅
- Placeholders: pets, records, settings ✅

**פתוח לשלב ה-deploy (לאחר ספרינט 5):**
- Vercel deploy — `agent/` + `app/` (שני פרויקטים נפרדים)
- הגדרת ElevenLabs post-call webhook: URL = `https://<AGENT_PUBLIC_URL>/hooks/call-ended`, Secret = `ELEVENLABS_WEBHOOK_SECRET`
- הפעלת pg_cron (ראה "הפעלת cron" למעלה) — דורש `CREATE EXTENSION pg_cron` אם לא קיים, ואז הרצת ה-SQL עם ה-URL האמיתי

### ספרינט 5 (עתידי)
- דשבורד: ניהול `calendar_blocks` (UI לחסימת חופשות)
- דשבורד: תצוגת `waitlist`
- שדרוג ל-`@elevenlabs/elevenlabs-js`
- `npm audit` + dependency cleanup
