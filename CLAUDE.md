# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

**Tomer** — a Hebrew-speaking voice AI agent for Dr. Noa Cabasheny's veterinary clinic (Get A Vet). Tomer answers inbound calls via Twilio + ElevenLabs Conversational AI when the vet is unavailable.

Three npm workspaces, one Supabase project:
- `agent/` — Hono server (Node.js 20, ESM) that bridges Twilio → ElevenLabs and exposes tool endpoints
- `app/` — Next.js 16 dashboard for the clinic staff to view calls, customers, and visits
- `packages/shared/` — `@tomer/shared`: Jerusalem-timezone math, frozen SMS wording, visit-type durations/labels, phone normalisation, and price-list SMS segments; both `agent/` and `app/` import it, never reimplement it (see "packages/shared" below)

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
         → Twilio voice_url = https://api.elevenlabs.io/twilio/inbound-call   (ElevenLabs native integration)
         → ElevenLabs "Tomer" agent (Hebrew conversation)
              ├── POST /tools/lookup-customer  → customers + pets (Supabase)
              └── POST /tools/escalate-to-noa → escalations table (Supabase)
         → call ends → POST /hooks/call-ended
         → upsert to voice_calls table
```
**Verified 2026-08-29:** the number's Twilio `voice_url` points directly at ElevenLabs' native inbound-call webhook, not at our own server. `agent/src/server/routes/twilio.ts`'s `/twilio/voice` and `/twilio/status` routes are currently **dead code in production** (kept for reference / possible fallback, not wired to the live number). Root cause + history: see the 2026-08-25 outage where someone re-pointed `voice_url` at our server and broke calls — if "Tomer" ever goes silent again, check `voice_url` on the Twilio number first.

### Agent (`agent/src/`)
- `server/app.ts` — Hono app factory, mounts all route groups
- `server/routes/twilio.ts` — Twilio webhook, validates signature, returns ElevenLabs signed URL via TwiML `<Stream>` — **currently dead code in production**, see "Call flow" above
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
- `lib/notifications.ts` — enqueue/cancel/reschedule SMS notifications; Jerusalem time math comes from `@tomer/shared`
- `lib/env.ts` — typed env validation (throws on startup if vars are missing)
- `services/sms.templates.ts` — thin re-export of `@tomer/shared`'s `smsTemplates` (8 approved Hebrew templates, wording frozen — do not change); kept as a shim so existing `../services/sms.templates.js` imports don't need to change
- `services/sms.service.ts` — Twilio SMS wrapper: `sendSms(to, body)`
- `services/notification.processor.ts` — atomic-claim processor: UPDATE WHERE status='pending' RETURNING *; 5-min stuck-row recovery
- `services/triage.service.ts` — `decideTriage({ text, now })` → 4 decisions + `isWithinBusinessHours`; 4 fixed Hebrew scripts (frozen)
- `knowledge/red-flags.ts` — 16 Hebrew red flags (TypeScript const); wording frozen — do not change without Noa's approval

### packages/shared (`@tomer/shared`)
Single source of truth for the two things that were independently reimplemented in both `agent/` and `app/` until 2026-09 (see the 2026-09-02 audit — that drift caused a real bug: the dashboard's vaccination-reminder SMS briefly diverged from the frozen wording before both sides were unified here):
- `src/israel-time.ts` — all Jerusalem-timezone math: `israelDateIso`, `israelDayOfWeek`, `israelLocalToUtcIso`, `israelDateAtHour`, `israelDayHourMinute`, `formatAppointmentDateTime`, plus the app-facing `formatIsraelDate`/`formatIsraelTime`/`formatIsraelDateTime`/`israelDayUtcRange`.
- `src/sms-templates.ts` — the 8 frozen Hebrew SMS templates (`smsTemplates`) + `CLINIC_LOCATION`/`HOME_VISIT_LOCATION`.
- `src/visit-types.ts` — `VISIT_TYPE_CONFIG` (durations, buffers, labels, approval flag).
- `src/pricing.ts` — booking-SMS `price` segments from clinic `price_list_items` (`agentQuotable`, no invented 150₪ fallback).
- `src/phone.ts` — Israeli E.164 normalisation shared by agent and app.

Ships compiled (`dist/`, built via `tsc`) — both `agent/` and `app/` depend on it as a normal package (`@tomer/shared`). `agent/lib/notifications.ts`, `agent/lib/appointments.ts`, `agent/services/triage.service.ts`, `agent/services/sms.templates.ts` (shim), `app/lib/israel-date.ts` (shim), `app/lib/appointment-rules.ts`, `app/lib/services/dashboard-notifications.service.ts`, and `app/app/api/calendar/availability/route.ts` all import from it — **never re-add a local Jerusalem-time or SMS-template implementation in either workspace.**

Every workspace's `predev`/`prebuild`/`pretypecheck`/`pretest` npm script rebuilds it automatically (`npm run build --prefix ../packages/shared`), so `cd agent && npm run dev` etc. keep working unchanged. `agent/Dockerfile`'s build context is the repo root (`agent/fly.toml`'s `[build] context = ".."`), not `agent/`, specifically so it can reach this package.

### App (`app/`)
Architecture is layered: `UI (page.tsx) → API route → Service → Repository → Supabase`

- `lib/services/factory.ts` — creates all services from Supabase clients; call `createServices()` in each API route
- `lib/api/auth-guard.ts` — `requireAuth()` used at the top of every protected API route
- `lib/supabase/server.ts` / `admin.ts` — server-side Supabase clients (server uses user session cookies; admin uses service role key)
- `app/proxy.ts` — redirects unauthenticated users away from `/dashboard/*` (Next.js 16 proxy; not `middleware.ts`)
- `lib/repositories/` — one file per entity, thin wrappers around Supabase queries
- `lib/validators/` — Zod schemas for request validation
- `lib/israel-date.ts` — thin re-export of `@tomer/shared` (kept so the ~20 existing importers don't need to change)
- `types/domain/` — shared domain types; `types/api/` — request/response shapes

### Supabase
- **Cloud project:** `xpsuhtqfxqmnunppnyov` (account: voxly ai, region: eu-central-1, Frankfurt) — `https://xpsuhtqfxqmnunppnyov.supabase.co`
  Old projects (deleted): `ssfkximqwyzqlsgwfbye` (Seoul), `voxly-tomer` (`grbgkjjtyfohzulssuga`).
- Migrations in `supabase/migrations/` — run in timestamp order; 50+ files. Applied versions can drift from local filenames (they are applied from here, which stamps its own timestamp), so check `list_migrations` against the directory rather than assuming they match. This branch adds `20260919153000_increment_visit_share_view.sql`.
- pg_cron **active** (verified 2026-08-29): `process-sms-notifications` (every 15 min) and `send-vaccination-reminders` (daily 06:00) are both scheduled and active in `cron.job`. The weekly `analyze-tomer-conversations` job (prompt learning loop) documented below has **not** been created yet.
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
10. **תשלומים/חשבוניות — פאזה 2 נפתחה חלקית (2026-09-07):** נועה ביקשה לאפשר שליחת קישור תשלום/חשבונית ללקוח. מומש: מחירון עריך (`price_list_items`, `/dashboard/settings`), הוספת חיוב לביקור מהמחירון או כפריט חד-פעמי (`VisitChargesPanel`), ואינטגרציית **Green Invoice** ליצירת חשבונית + שליחת קישור תשלום ב-SMS — **פעולה ידנית בלבד מהדשבורד** אחרי סיום ביקור (`POST /api/invoices/[invoiceId]/send-payment-link`), לא ע"י תומר בשיחה חיה ולא אוטומטית. **עדיין לא בפאזה זו:** וובהוק/סנכרון אוטומטי של סטטוס תשלום מ-Green Invoice בחזרה למערכת (נועה ממשיכה לסמן תשלום שהתקבל ידנית, כמו היום); שינוי לזרימת התמחור המוקדם של תומר בשיחה (`agent/src/lib/notifications.ts:VISIT_PRICE`) — זו הערכת מחיר לפני ביקור, נשארת נפרדת מהחיוב בפועל בסוף הביקור. לפני production: לוודא מול נועה/Green Invoice שהחשבון מוגדר לתשלום מקוון (`GREEN_INVOICE_ENV=live`).

## כללי עבודה

- עבודה בשלבים: תוכנית → אישור → ביצוע → עצירה לאישור.
  אל תתקדם בלי אישור מפורש.
- בסוף כל משימה: הצע commit מסודר (`feat`/`fix`/`chore`), ודא שאין
  קבצי env או קבצים זמניים ב-staging.
- אסור לקמט קבצי `.env`, סודות, או קבצי `*.timestamp-*.mjs`.
- תקשורת עם המשתמש בעברית. קוד והודעות commit באנגלית.
- תיעוד מרכזי בנושן: דף Voxly-Tomer (`36f1354b584881b587c5c6f42a6bf6c7`).
- **נוהל worktree/session:** יותר מ-session אחד עובד לעיתים על אותו repo במקביל (ראה זיכרון "Graphite Pro concurrent session", "PIMS parallel initiative"). לפני עבודה על התיקייה הראשית — `git worktree list` כדי לבדוק אם יש worktree/branch פעיל אחר, ולהעדיף `git worktree add` לעבודה מבודדת על פני checkout ישיר בתיקייה הראשית. תסמינים אופייניים לתקרית כזו: קבצים שהשתנו בלי שביקשת (למשל `lang="he"`→`lang="he-IL"` שהופיע ב-worktree אחר), או נעילת gpg/git תקועה (`gpg failed to sign the data ... waiting for lock (held by <pid>)`) — אם ה-PID כבר לא רץ (`ps -p <pid>`), זו נעילה תקועה (`~/.gnupg/public-keys.d/pubring.db.lock` וכדומה) שבטוח למחוק.

## cron (pg_cron)

**✅ סטטוס (אומת 2026-09-18):** שלושת ה-jobs רצים ומחזירים 200 מהסוכן. שתי תקלות שונות הובילו לכאן, ושתיהן נראו זהות מבחוץ — "job פעיל, אף אחד לא שם לב ששום דבר לא קרה":

1. **`extensions.http_post` (תוקן 2026-09-05).** הפונקציה לא קיימת בפרויקט — pg_net מתקין ל-schema בשם `net`. pg_cron רשם את השגיאה ב-`cron.job_run_details` והמשיך, ולכן ה-SMS המתוזמנים נערמו ב-`notifications_log` בסטטוס `pending` ותזכורות החיסון לא נשלחו. רק `booking_confirmation` עבד — הסוכן שולח אותו ישירות, לא דרך התור. תוקן ע"י הרצת `supabase/scripts/cron-jobs.sql`.
2. **timeout של pg_net על `analyze-tomer-conversations` (תוקן 2026-09-18).** ה-job הוגדר עם `timeout_milliseconds := 10000`, אבל `/jobs/analyze-conversations` ממתין לסבב Claude המלא לפני שהוא משיב — ~4.5 דקות במדידה (19 שיחות מסומנות, 38 קבוצות). כל הרצה מאז ההגדרה נקטעה ב-10 שניות. **pg_cron רשם `status='succeeded'`** כי `net.http_post` רק מכניס לתור בהצלחה — הכישלון האמיתי נרשם ב-`net._http_response.error_msg`. תוקן ל-`300000`.

**לכן לא מספיק לבדוק ש-job "פעיל", ואפילו לא ש-`cron.job_run_details` מראה `succeeded`.** `succeeded` = הבקשה נכנסה לתור. התשובה האמיתית של הסוכן נמצאת ב-`net._http_response`:

```sql
-- שלב 1: pg_cron הצליח להריץ את הפקודה?
select jobid, status, return_message, start_time
from cron.job_run_details order by start_time desc limit 10;

-- שלב 2: מה הסוכן באמת החזיר? (זו הבדיקה שמגלה timeout)
select id, status_code, left(content, 300) as content, error_msg, created
from net._http_response order by id desc limit 10;
```

⚠️ `net._http_response` נשמר לזמן קצוב (~6 שעות). ל-jobs יומיים/שבועיים השורה כבר תימחק עד שתסתכל. להרצה ידנית מיידית בלי לחשוף את הטוקן מה-Vault:

```sql
do $$ declare c text; begin select command into c from cron.job where jobid = 4; execute c; end $$;
-- ואז לחכות ולקרוא את net._http_response
```

שלושת ה-jobs, כולם מול `https://voxly-agent.fly.dev`:

| jobid | jobname | schedule | timeout | סטטוס (2026-09-18) |
|---|---|---|---|---|
| 1 | `process-sms-notifications` | `*/15 * * * *` | 10s | ✅ 200, `{"processed":0,...}` |
| 3 | `send-vaccination-reminders` | `0 6 * * *` | 10s | ✅ 200, `{"scanned":0,"enqueued":0,...}` |
| 4 | `analyze-tomer-conversations` | `0 6 * * 0` | 300s | ✅ 200, `{"ranAnalysis":true,"flaggedCallCount":19,...}` — הרצה מוצלחת ראשונה אי פעם |

הטוקן נשמר ב-Supabase Vault (`tomer_jobs_bearer_token`), לא בטקסט הפקודה.

`ANTHROPIC_API_KEY` מוגדר ב-Fly secrets.

**⚠️ תקלה שתוקנה 2026-08-29 בדרך:** טבלת `call_reviews` בענן הייתה קיימת עם סכמה שונה לגמרי ממה שהמיגרציה המקורית (`20260828000022_prompt_learning_loop.sql`) וה-agent code ציפו לו — מישהו יצר/שינה אותה ישירות ב-SQL editor בלי מיגרציה, וה-`create table if not exists` פשוט no-op-ה. זה שבר בשקט את `logConversation.ts` (0 שורות ב-`call_reviews` מאז 28.8) וגרם ל-`analyzeConversations.ts` (וממילא ל-job הזה) לזרוק שגיאת עמודה חסרה. תוקן: `agent/src/lib/learning/logConversation.ts` + `analyzeConversations.ts` עודכנו להתאים לסכמה האמיתית בענן (`conversation_id`, `agent_id`, `version_id`, `call_successful`, `evaluation_criteria_results`, `data_collection_results`, `flagged_reasons` וכו'), ומיגרציה `20260829002217_call_reviews_clinic_id.sql` הוסיפה את `clinic_id` שהיה חסר. אם משהו דומה קורה שוב (עמודה/טבלה "לא קיימת" למרות שהמיגרציה "רצה בהצלחה") — תמיד לבדוק את הסכמה בפועל בענן מול קובץ המיגרציה, לא להניח שהם זהים.

```sql
SELECT cron.schedule(
  'process-sms-notifications',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://<AGENT_PUBLIC_URL>/jobs/process-notifications',
    headers := jsonb_build_object(
      'Authorization', 'Bearer <JOBS_BEARER_TOKEN>',
      'Content-Type', 'application/json'
    ),
    body    := '{}'::jsonb
  );
  $$
);
```

לביטול: `SELECT cron.unschedule('process-sms-notifications');`

**cron שני — לולאת שיפור פרומפט (prompt learning loop), שבועי — רשום כ-jobid 4 (ראה הטבלה למעלה), פעיל ומאומת. ה-SQL למטה לתיעוד/שחזור — שים לב ל-`timeout_milliseconds`, בלעדיו pg_net קוטע את הניתוח אחרי 5 שניות:**

```sql
SELECT cron.schedule(
  'analyze-tomer-conversations',
  '0 6 * * 0',
  $$
  SELECT net.http_post(
    url     := 'https://<AGENT_PUBLIC_URL>/jobs/analyze-conversations',
    headers := jsonb_build_object(
      'Authorization', 'Bearer <JOBS_BEARER_TOKEN>',
      'Content-Type', 'application/json'
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 300000
  );
  $$
);
```

דורש `ANTHROPIC_API_KEY` מוגדר ב-agent/ (אופציונלי — אם חסר, ה-job מחזיר שגיאה ברורה ולא נופל בשקט).
לביטול: `SELECT cron.unschedule('analyze-tomer-conversations');`

---

## משימות פתוחות

ראה Backlog בדף הנושן.

### ספרינט 2 — הושלם (2026-06-12) ✅
- SMS pipeline: `notifications_log`, atomic-claim processor, DB trigger, 6 templates ✅
- migration 20260612000015 הוחל על cloud ✅
- 149 טסטים עוברים ✅
- pg_cron: הופעל ✅ (ראה "cron (pg_cron)" למעלה)

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

**Deploy — הושלם (2026-08-28, ראה `docs/DEPLOYMENT_STATUS.md`) ✅**
- Agent: **Fly.io** (`voxly-agent`, region `fra`) — `https://voxly-agent.fly.dev`, `/health` מחזיר 200 (לא Vercel כפי שתוכנן במקור)
- App: **Vercel** (`get-a-vrt-d`) — production ב-`https://voxly-app-chi.vercel.app`, auto-deploy על כל push ל-`main`
- ElevenLabs post-call webhook מוגדר ומאומת: `https://voxly-agent.fly.dev/hooks/call-ended` ✅
- Twilio voice_url מצביע נכון לאינטגרציה הנייטיבית של ElevenLabs ✅ (ראה "Call flow" למעלה)
- pg_cron: כל 3 ה-jobs פעילים ✅ (ראה "cron (pg_cron)" למעלה)

### ספרינט 5 (עתידי)
- ~~דשבורד: ניהול `calendar_blocks` (UI לחסימת חופשות)~~ ✅ כבר בנוי (`app/app/dashboard/calendar/page.tsx`)
- ~~דשבורד: תצוגת `waitlist`~~ ✅ כבר בנוי (`/dashboard/waitlist`)
- ~~`npm audit`~~ ✅ נקי (0 חולשות, agent + app) — נבדק 2026-08-29
- ~~שדרוג ל-`@elevenlabs/elevenlabs-js`~~ ✅ הושלם (2026-09-05) — שני נתוני שימוש (`agent/src/server/routes/twilio.ts` הלא-פעיל, ו-`app/lib/learning/elevenlabsTesting.ts` החי) עודכנו ל-API המקונן/camelCase החדש
- ~~customer tags (`customers.tags`)~~ ✅ הושלם (2026-09-05) — עמודת `text[]` + אינדקס GIN, עורך תגיות בכרטיס/מגירת הלקוח

> הערה (2026-09-05): `npm audit` מראה כיום חולשה מודרטית אחת (`qs`, נמשכת ע"י `twilio` בשני החבילות) — לא קשורה לשדרוג ElevenLabs, לא תוקנה כאן.
