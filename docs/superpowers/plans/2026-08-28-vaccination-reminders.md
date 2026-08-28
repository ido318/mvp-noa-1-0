# Vaccination Reminder SMS — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically remind customers by SMS 14 days before their pet's next vaccination is due, using data that already exists (`vaccinations.next_due_at`), reusing the existing SMS pipeline (`notifications_log` + `notification.processor.ts` + Twilio) rather than building a new one. The reminder invites the customer to call and book — booking then happens through the normal channels (Tomer or the dashboard), which already write to `appointments`. Also shows `next_due_at` on the pet detail page so staff can see it too.

**Approved wording (user-selected "Option A", 2026-08-28 — still Ido, not yet Noa's final sign-off; do not change the wording without asking):**
```
שלום {customerName}, כאן תומר מ-Get A Vet 💉
הגיע הזמן לחיסון הבא של {petName} ({vaccineName}) — מומלץ לתאם בקרוב לשמירה על הבריאות.
לתיאום תור נוח — חייגו אלינו בכל עת.
בריאות ל{petName} 🐾 תומר, Get A Vet
```

**Architecture:** `notifications_log` is currently shaped entirely around appointment-triggered SMS (`UNIQUE(appointment_id, type)` for idempotency) — a vaccination reminder has no appointment yet, so this plan adds a nullable `vaccination_id` column and a second, independent `UNIQUE(vaccination_id, type)` constraint (Postgres treats each NULL as distinct, so this doesn't affect existing appointment-based rows at all). A new `enqueueDueVaccinationReminders()` function scans `vaccinations` for rows due in the next 14 days and inserts pending rows the same way `enqueueNotification` does. Sending itself needs **zero changes** — `notification.processor.ts` already sends whatever's `pending` in `notifications_log` regardless of what it's attached to, since the message body is pre-rendered at enqueue time.

**Important — working directory hazard:** another Claude session has substantial *uncommitted* work sitting in this same checkout, including modified `agent/src/server/routes/jobs.ts` and `agent/src/lib/env.ts` and a new untracked migration file. **Do not edit `agent/src/server/routes/jobs.ts`** — instead this plan adds a brand-new route file (`agent/src/server/routes/vaccinationReminders.ts`) mounted separately in `app/server/app.ts` (a currently-clean file), specifically to avoid touching a file another session is actively mid-edit on. Before running any `git add`, run `git status --short` first — if you see files modified that you didn't touch (e.g. `agent/.env.example`, `agent/src/lib/env.ts`, `agent/src/server/routes/jobs.ts`, anything under `*/lib/learning/`, anything about `prompt-suggestion`), those belong to the other session — never stage or commit them, and never run `git add -A` or `git add .` in this repo for any task in this plan. Always `git add` exact file paths.

**Tech Stack:** Node/TypeScript (agent/), Supabase Postgres migration, Vitest, existing Twilio SMS pipeline. No new dependencies.

This is Plan 5 of the dashboard/agent improvement work (see `docs/superpowers/specs/2026-08-27-dashboard-crm-redesign-design.md` for the original dashboard spec — this plan extends beyond it into `agent/`).

---

## Before you start

Read `agent/src/lib/notifications.ts` in full (306 lines, especially `enqueueNotification` and `scheduleBookingNotifications`) and `agent/src/services/notification.processor.ts` in full (125 lines) — this plan's new enqueue function mirrors `enqueueNotification`'s shape closely but is NOT a call to it (that function requires `appointmentId: string`, non-optional). Read `agent/src/services/sms.templates.ts` for the exact template-authoring convention (the `Require<T, K>` pattern, `requireFields` runtime guard). Read `agent/src/server/app.ts` (confirmed clean, not touched by the other session) to see how route files get mounted.

Confirm current DB state before writing the migration: `notifications_log_appt_type_unique` is `UNIQUE (appointment_id, type)`, `appointment_id` is nullable, `notifications_log_type_check` is a CHECK constraint whitelisting exact type strings (currently: booking_confirmation, morning_reminder, post_visit_followup, reschedule_update, cancellation_update, client_cancellation_confirmation, arrival_reminder) — confirmed live via direct Supabase inspection on 2026-08-28, but re-verify yourself before writing the `DROP CONSTRAINT`/`ADD CONSTRAINT` migration step in case it's changed.

---

### Task 1: Migration + SMS template

**Files:**
- Create: `supabase/migrations/20260828000030_vaccination_reminders.sql`
- Modify: `agent/src/services/sms.templates.ts`
- Test: `agent/tests/unit/sms.templates.test.ts` (create if it doesn't already exist — check first)

- [x] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260828000030_vaccination_reminders.sql
-- Vaccination reminder SMS: notifications_log currently only supports
-- appointment-attached notifications. A vaccination reminder has no
-- appointment yet -- that's the point, it's inviting the customer to book
-- one. Add a nullable vaccination_id + its own idempotency constraint,
-- independent of the existing appointment_id one.

alter table public.notifications_log
  add column if not exists vaccination_id uuid references public.vaccinations(id) on delete set null;

alter table public.notifications_log
  add constraint notifications_log_vaccination_type_unique unique (vaccination_id, type);

alter table public.notifications_log drop constraint if exists notifications_log_type_check;

alter table public.notifications_log add constraint notifications_log_type_check
  check (type = any (array[
    'booking_confirmation'::text,
    'morning_reminder'::text,
    'post_visit_followup'::text,
    'reschedule_update'::text,
    'cancellation_update'::text,
    'client_cancellation_confirmation'::text,
    'arrival_reminder'::text,
    'vaccination_reminder'::text
  ]));
```

- [x] **Step 2: Apply the migration to the live Supabase project**

Use the Supabase MCP tool (`apply_migration`) with project id `xpsuhtqfxqmnunppnyov`, name `vaccination_reminders`, and the SQL above. After applying, verify directly:

```sql
select conname, pg_get_constraintdef(oid) as def from pg_constraint where conrelid = 'notifications_log'::regclass and conname like '%vaccination%';
```

Expect to see both the new FK and the new unique constraint. Also confirm the file at `supabase/migrations/20260828000030_vaccination_reminders.sql` exists on disk with the exact SQL that was applied (migrations must be committed to git too, not just applied live — this repo's convention per `docs/PRODUCTION_SETUP_CHECKLIST.md` and existing migration files is that the file IS the source of truth, applied migrations without a matching committed file are a drift risk).

- [x] **Step 3: Add the SMS template**

Check if `agent/tests/unit/sms.templates.test.ts` already exists — if so, read it to match its existing test style exactly. If not, this is a new test file.

Add to `agent/src/services/sms.templates.ts`, following the exact existing pattern (a new `Require<...>` type alias for the fields this template needs, added to the `smsTemplates` object):

```typescript
export type VaccinationReminderData = Require<SmsTemplateData, "vaccineName" | "petName">;
```

This requires adding `vaccineName?: string;` to the `SmsTemplateData` interface at the top of the file (it isn't there yet — every other template's fields are already declared, `vaccineName` is new).

Add the template function to the `smsTemplates` object (place it after `client_cancellation_confirmation`, the last entry):

```typescript
  vaccination_reminder: (d: VaccinationReminderData) => {
    requireFields(d, ["vaccineName", "petName"], "vaccination_reminder");
    return (
      `שלום ${d.customerName}, כאן תומר מ-Get A Vet 💉\n` +
      `הגיע הזמן לחיסון הבא של ${d.petName} (${d.vaccineName}) — מומלץ לתאם בקרוב לשמירה על הבריאות.\n` +
      `לתיאום תור נוח — חייגו אלינו בכל עת.\n` +
      `בריאות ל${d.petName} 🐾 תומר, Get A Vet`
    );
  },
```

Write a test (new file `agent/tests/unit/sms.templates.test.ts` if none exists, otherwise add to the existing one) asserting the rendered string contains the customer name, pet name, vaccine name, and the exact opening line `"שלום X, כאן תומר מ-Get A Vet 💉"` — follow whatever assertion style the rest of the test suite already uses for other templates if a test file exists; if creating fresh, simple `expect(result).toContain(...)` assertions are fine.

- [x] **Step 4: Run the agent test suite and typecheck**

```bash
cd agent && npm run test && npm run typecheck
```

Expected: all pass.

- [x] **Step 5: Commit — exact files only, never `git add -A`**

```bash
git status --short
```

Confirm only your own files show as changed/new before staging:

```bash
git add supabase/migrations/20260828000030_vaccination_reminders.sql agent/src/services/sms.templates.ts agent/tests/unit/sms.templates.test.ts
git commit -m "feat(agent): add vaccination_reminder notification type and SMS template"
```

If `git status --short` shows OTHER modified/untracked files you didn't touch, do not include them — that's the other session's work, leave it alone.

---

### Task 2: Enqueue logic + scheduled job route

**Files:**
- Create: `agent/src/lib/vaccinationReminders.ts`
- Create: `agent/tests/unit/lib/vaccinationReminders.test.ts`
- Create: `agent/src/server/routes/vaccinationReminders.ts`
- Modify: `agent/src/server/app.ts`

- [x] **Step 1: Write the failing test for the enqueue query logic**

Read `agent/tests/unit/lib/notifications.test.ts` first for the existing mocking convention for `getSupabase()` in this test suite, then write `agent/tests/unit/lib/vaccinationReminders.test.ts` following that exact convention. Test that `enqueueDueVaccinationReminders`:
1. Queries `vaccinations` for rows where `next_due_at` is between today and 14 days from now.
2. For each due vaccination, builds the SMS body via `smsTemplates.vaccination_reminder` and calls the same upsert-with-`ignoreDuplicates` pattern as `enqueueNotification`, but targeting `vaccination_id` instead of `appointment_id`.
3. Skips any vaccination whose linked customer has no phone number (can't SMS a null phone).

- [x] **Step 2: Run it, confirm it fails, then implement**

```bash
cd agent && npx vitest run tests/unit/lib/vaccinationReminders.test.ts
```

Then write `agent/src/lib/vaccinationReminders.ts`:

```typescript
import { getSupabase } from "./supabase.js";
import { smsTemplates } from "../services/sms.templates.js";
import { logger } from "./logger.js";

const REMINDER_WINDOW_DAYS = 14;

type DueVaccinationRow = {
  id: string;
  vaccine_name: string;
  next_due_at: string;
  pet: { name: string } | { name: string }[] | null;
  customer: { id: string; full_name: string; phone: string | null } | { id: string; full_name: string; phone: string | null }[] | null;
  clinic_id: string;
};

export type EnqueueVaccinationRemindersResult = {
  scanned: number;
  enqueued: number;
  skippedNoPhone: number;
};

/**
 * Scans vaccinations due within REMINDER_WINDOW_DAYS and enqueues a
 * vaccination_reminder SMS for each one that doesn't already have one
 * (idempotent via the notifications_log_vaccination_type_unique constraint).
 */
export async function enqueueDueVaccinationReminders(): Promise<EnqueueVaccinationRemindersResult> {
  const result: EnqueueVaccinationRemindersResult = { scanned: 0, enqueued: 0, skippedNoPhone: 0 };

  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const windowEnd = new Date(today.getTime() + REMINDER_WINDOW_DAYS * 24 * 60 * 60_000);
  const windowEndIso = windowEnd.toISOString().slice(0, 10);

  const { data, error } = await getSupabase()
    .from("vaccinations")
    .select(`
      id, vaccine_name, next_due_at, clinic_id,
      pet:pets!vaccinations_pet_clinic_fk(name),
      customer:customers!vaccinations_customer_clinic_fk(id, full_name, phone)
    `)
    .gte("next_due_at", todayIso)
    .lte("next_due_at", windowEndIso)
    .is("deleted_at", null)
    .returns<DueVaccinationRow[]>();

  if (error) throw new Error(`enqueueDueVaccinationReminders: failed to query vaccinations: ${error.message}`);
  if (!data) return result;

  result.scanned = data.length;

  for (const row of data) {
    const pet = Array.isArray(row.pet) ? row.pet[0] : row.pet;
    const customer = Array.isArray(row.customer) ? row.customer[0] : row.customer;
    if (!pet || !customer) continue;

    if (!customer.phone) {
      result.skippedNoPhone++;
      logger.warn({ vaccinationId: row.id, customerId: customer.id }, "vaccination reminder skipped — no phone on file");
      continue;
    }

    const body = smsTemplates.vaccination_reminder({
      customerName: customer.full_name,
      petName: pet.name,
      vaccineName: row.vaccine_name,
    });

    const { error: insertErr } = await getSupabase()
      .from("notifications_log")
      .upsert(
        {
          clinic_id:       row.clinic_id,
          customer_id:     customer.id,
          vaccination_id:  row.id,
          phone:           customer.phone,
          type:            "vaccination_reminder",
          body,
          scheduled_for:   new Date().toISOString(),
          status:          "pending",
        },
        { onConflict: "vaccination_id,type", ignoreDuplicates: true },
      );

    if (insertErr) {
      logger.error({ vaccinationId: row.id, error: insertErr.message }, "failed to enqueue vaccination reminder");
      continue;
    }
    result.enqueued++;
  }

  return result;
}
```

The FK constraint names above (`vaccinations_pet_clinic_fk`, `vaccinations_customer_clinic_fk`) were confirmed directly against the live DB on 2026-08-28 — they're composite keys (`(pet_id, clinic_id)` and `(customer_id, clinic_id)` respectively, same convention as `appointments_customer_clinic_fk`), already correct as written above. No need to re-verify, but do a sanity check if the query errors unexpectedly.

- [x] **Step 3: Run the test, confirm it passes**

```bash
cd agent && npx vitest run tests/unit/lib/vaccinationReminders.test.ts
```

- [x] **Step 4: Add the job route (new file, do NOT touch `jobs.ts`)**

```typescript
// agent/src/server/routes/vaccinationReminders.ts
import { Hono } from "hono";
import { getEnv } from "../../lib/env.js";
import { enqueueDueVaccinationReminders } from "../../lib/vaccinationReminders.js";
import { logger } from "../../lib/logger.js";

export const vaccinationReminderRoutes = new Hono();

vaccinationReminderRoutes.post("/send-vaccination-reminders", async (c) => {
  const authHeader = c.req.header("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token || token !== getEnv().JOBS_BEARER_TOKEN) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const result = await enqueueDueVaccinationReminders();
    logger.info(result, "enqueueDueVaccinationReminders complete");
    return c.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ error: message }, "enqueueDueVaccinationReminders failed");
    return c.json({ error: message }, 500);
  }
});
```

This reuses the exact same Bearer-token auth pattern already used in `jobs.ts` (duplicated here deliberately, not imported/shared, specifically to avoid touching that file while it's being concurrently edited by another session).

Mount it in `agent/src/server/app.ts` — add the import next to the other route imports:

```typescript
import { vaccinationReminderRoutes } from "./routes/vaccinationReminders.js";
```

And add a new `app.route()` call next to `app.route("/jobs", jobsRoutes);`:

```typescript
app.route("/jobs", vaccinationReminderRoutes);
```

(Hono supports mounting multiple routers at the same prefix as long as their internal paths don't collide — `jobsRoutes` has `/process-notifications` and `/analyze-conversations`; this adds `/send-vaccination-reminders`, no collision.)

- [x] **Step 5: Run the full agent test suite, typecheck, and build**

```bash
cd agent && npm run test && npm run typecheck && npm run build
```

Expected: all pass.

- [x] **Step 6: Verify against the live database (read-only query, safe)**

Query Supabase directly (via whatever DB access is available) to confirm there's at least one real vaccination with a `next_due_at` inside the next 14 days, so you know the manual trigger test below will actually exercise the enqueue path rather than silently finding nothing. If none exist, note that in your report — that's fine, it just means Step 7 below will report `enqueued: 0`, which is still a valid, correct result to verify (not a failure).

- [x] **Step 7: Manually trigger the new endpoint against the LOCAL dev agent server (not production) to verify it works end to end**

Do not call this against the deployed Fly.io agent — this is local-only verification. Start the agent locally if not already running (`cd agent && npm run dev`, requires `.env` — check with the controller if you don't have one, do not guess or fabricate env values), then:

```bash
curl -s -X POST http://localhost:3000/jobs/send-vaccination-reminders \
  -H "Authorization: Bearer $JOBS_BEARER_TOKEN"
```

Report the exact JSON response. If you cannot get a local agent server running (missing `.env`), report DONE_WITH_CONCERNS and explain exactly what's blocking it — do not fabricate a result.

- [x] **Step 8: Commit — exact files only**

```bash
git status --short
```

Confirm only your own files, then:

```bash
git add agent/src/lib/vaccinationReminders.ts agent/tests/unit/lib/vaccinationReminders.test.ts agent/src/server/routes/vaccinationReminders.ts agent/src/server/app.ts
git commit -m "feat(agent): add vaccination reminder enqueue job"
```

---

### Task 3: Show next-due date on the pet detail page

**Files:**
- Modify: `app/app/dashboard/pets/[petId]/page.tsx`

- [x] **Step 1: Add the due date to each vaccination row**

This file currently renders (around line 142):

```tsx
{(vaccinationsData?.items ?? []).slice(0, 5).map((v) => (
  <li key={v.id} className="text-sm text-zinc-600">
    {v.vaccineName} · {formatIsraelDate(v.administeredAt)}
  </li>
))}
```

Change it to also show `nextDueAt` when present, following this file's own existing (pre-design-system) `zinc` styling convention exactly — do not retheme this file, that's out of scope:

```tsx
{(vaccinationsData?.items ?? []).slice(0, 5).map((v) => (
  <li key={v.id} className="text-sm text-zinc-600">
    {v.vaccineName} · {formatIsraelDate(v.administeredAt)}
    {v.nextDueAt && (
      <span className="text-zinc-400"> · הבא: {formatIsraelDate(v.nextDueAt)}</span>
    )}
  </li>
))}
```

- [x] **Step 2: Run typecheck, tests, and build**

```bash
cd app && npm run typecheck && npm run test && npm run build
```

- [x] **Step 3: Drive the real UI to confirm**

Log in (ask the controller for credentials), navigate to a pet detail page for a pet with at least one vaccination that has `next_due_at` set, confirm the "הבא: <date>" text appears next to that vaccination. If no such pet/vaccination exists in this clinic's real data, confirm instead that vaccinations without a due date render without the extra text (no crash, no "הבא: null" or similar). Report DONE_WITH_CONCERNS if you cannot verify this in a real browser.

- [x] **Step 4: Commit**

```bash
git status --short
git add app/app/dashboard/pets/\[petId\]/page.tsx
git commit -m "feat(dashboard): show next vaccination due date on pet detail page"
```

---

## Done criteria for this plan

- `notifications_log` supports vaccination-attached rows without breaking anything appointment-attached.
- A vaccination due within 14 days gets exactly one `vaccination_reminder` SMS enqueued (verified idempotent — running the job twice doesn't double-enqueue).
- The reminder SMS uses the approved "Option A" wording exactly.
- The pet detail page shows the next due date per vaccination.
- `npm run test`, `npm run typecheck`, and `npm run build` all pass in both `agent/` and `app/`.
- Nothing belonging to the other concurrent session's uncommitted work was staged or committed at any point.

## Explicitly NOT in this plan (deploy is a separate, later decision)

This plan does **not** include deploying the agent to Fly.io or activating pg_cron to actually start sending real SMS automatically — those are the steps that make this go live and send real messages to real customers. Once this plan's code is committed and verified locally/via tests, stop and check with the user before:
1. `flyctl deploy` for the `agent/` app (ships the new code to production, but the job still won't fire on its own).
2. Wiring `POST /jobs/send-vaccination-reminders` into pg_cron (per the "הפעלת cron" section of `CLAUDE.md`) — this is the step that actually makes reminders start going out automatically, and per CLAUDE.md's frozen-template rule, the wording should get final confirmation from Noa (not just Ido) before that happens, since at that point it starts reaching real customers unattended.
