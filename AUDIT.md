# Project Audit Report

Repository: `ido318/mvp-noa-1-0`  
Branch audited: `cursor/project-audit-report-0667` from `main` @ `4d2822f`  
Date: 2026-09-17  
Scope: investigation and written report only. No code fixes or refactors were made.

## Executive Summary

The repository is in much better shape than the older `AUDIT_REPORT.md` suggests: the monorepo builds, typechecks, lints, and unit tests pass; conflict markers were not found; `.env` files are ignored; and the shared package now centralizes critical SMS wording and Jerusalem-time helpers.

The most urgent issue is dependency security: `npm audit` reports a **critical Next.js advisory** against the exact production dashboard version. The next most important findings are correctness/security issues in billing/payment references, login redirect sanitization, concurrent visit opening, vaccination reminder timing, dashboard availability status filters, and a destructive reset script that is not clinic-scoped.

## Verification Commands Run

| Command | Result |
|---|---|
| `npm install` | Passed. Installed 559 packages. Reported 2 vulnerabilities: 1 critical, 1 moderate. Also warned that `scmp@2.1.0` and `eslint@9.39.5` are deprecated/unsupported. |
| `npm run typecheck:all` | Passed. Agent and app TypeScript checks both succeeded. |
| `npm run lint --workspace=agent && npm run lint --workspace=app` | Passed with 4 warnings in app code/tests. |
| `npm run test:all` | Passed. Agent: 33 files / 303 tests passed. App: 95 files passed, 9 skipped; 486 passed, 17 skipped. Vitest warned about `__dirname` in `app/vitest.config.ts`. |
| `npm run build --workspace=agent && npm run build --workspace=app` | Passed. Next.js production build generated 57 routes plus Proxy middleware. |
| `npm run test:integration --workspace=app` | Failed before running tests: `Error: supabase CLI not found in PATH.` |
| `npm audit --workspaces --omit=dev` and `npm audit --workspaces` | Failed with 2 advisories: critical `next`, moderate `qs`. |
| `npm outdated --workspaces` | Exited non-zero as expected; showed several patch/minor updates and major updates available. |
| conflict marker search `^(<<<<<<<|=======|>>>>>>>)` | No matches. |
| secret-pattern search | No real secrets found; matches were placeholders, test keys, docs URLs, or lockfile integrity strings. |
| `git worktree list` / branch scan | Only `/workspace` worktree. Several stale remote branches are behind `origin/main`; two prior audit branches are divergent by one commit. |

## Findings

### Critical

#### C1. Production dependency audit reports critical Next.js vulnerabilities

- **Where:** `app/package.json` pins `next` to `16.3.2`; `npm audit --workspaces` reports `next 16.0.0 - 16.3.2`.
- **What is wrong:** The installed dashboard framework version is covered by two critical advisories:
  - `GHSA-p293-qw3h-jr36`: unauthenticated RCE on Windows-hosted servers.
  - `GHSA-2xp9-vwfh-vxw4`: unauthenticated RCE in Image Optimization API when AVIF files are used.
- **Why it matters:** Even if the current deployment is Linux/Vercel, this is a production-facing web app dependency with a critical advisory. Audit also says the available fix is `next@16.3.5`.
- **Suggested fix:** Upgrade `next` and matching `eslint-config-next` to the patched `16.3.5` line, run `npm install`, then rerun typecheck/lint/test/build. Do this in a dedicated fix PR, not as part of this report-only PR.

### High

#### H1. Login redirect accepts an unsanitized `next` URL and passes it to `router.push`

- **Where:** `app/app/login/page.tsx` derives `nextPath = params.next ?? "/dashboard"`; `app/app/login/login-form.tsx` calls `router.push(nextPath)` after successful login.
- **What is wrong:** Direct visits such as `/login?next=javascript:...` or external/scheme URLs are not rejected in the login page. `app/proxy.ts` sets a safe path when it redirects from `/dashboard`, but it does not protect direct `/login?next=...` requests.
- **Why it matters:** Next.js explicitly warns not to pass untrusted URLs to `router.push`; `javascript:` URLs can become an XSS vector, and external URLs can become an open redirect after login.
- **Suggested fix:** Centralize a `safeNextPath()` helper that only permits single-slash internal paths, e.g. `value.startsWith("/") && !value.startsWith("//")`, and falls back to `/dashboard`. Use the same helper in login and auth-confirm flows.

#### H2. Payment rows can reference invoices from another clinic

- **Where:** `app/lib/services/payment.service.ts` only checks `actor.clinicIds.includes(input.clinicId)`; `app/lib/repositories/payment.repository.ts` inserts the client-supplied `invoice_id`; `supabase/migrations/20260901010129_phase10_inventory_billing_core.sql` defines `payments.invoice_id uuid not null references public.invoices(id)` without a composite `(invoice_id, clinic_id)` FK.
- **What is wrong:** A user can submit a payment with a clinic they belong to and an arbitrary invoice UUID. RLS checks only the inserted payment row's `clinic_id`, while the database does not enforce that the referenced invoice has the same `clinic_id`.
- **Why it matters:** This breaks tenant data integrity and can create cross-clinic payment references if an invoice UUID leaks or is guessed.
- **Suggested fix:** Add `UNIQUE (id, clinic_id)` on `invoices`, replace child FKs with composite `(invoice_id, clinic_id)` references where `clinic_id` is duplicated, and have `PaymentService` load the invoice by id and derive `clinicId` server-side before insertion.

#### H3. Visit charges can be re-reviewed and invoiced more than once

- **Where:** `app/lib/repositories/visit-charge.repository.ts`:
  - `review()` updates any charge id in actor clinics to `status: "reviewed"` without checking current status/version.
  - `markInvoiced()` updates by id only, without `status = 'reviewed'` or clinic scoping.
  - `app/lib/services/visit-charge.service.ts#createInvoiceFromVisit` creates the invoice first, then marks charges invoiced in a separate query.
- **What is wrong:** An API caller can re-review an `invoiced` or `void` charge. Two concurrent `createInvoiceFromVisit` calls can both read the same reviewed charges, create two invoices, then both mark the same charges invoiced.
- **Why it matters:** This can duplicate bills or regress a charge from `invoiced` back to `reviewed`, undermining billing integrity.
- **Suggested fix:** Move invoice creation plus charge state transition into a single DB RPC/transaction. Guard updates with `clinic_id`, `status = 'reviewed'`, and optionally `version`. Make `review()` only transition `pending -> reviewed`.

#### H4. Opening a visit from a checked-in appointment is not atomic and lacks a unique appointment-to-visit invariant

- **Where:** `app/lib/services/appointment.service.ts#openVisitFromAppointment`; `app/lib/repositories/visit.repository.ts#findByAppointment` and `#create`; `supabase/migrations/20260528000008_medical_records.sql` defines `visits.appointment_id` but no unique active index.
- **What is wrong:** The service checks for an existing visit, then creates a visit, then updates the appointment to `in_visit`. Two concurrent requests can both observe "no visit" before either insert. There is no database uniqueness constraint preventing multiple live visits for the same appointment.
- **Why it matters:** A double-click or retry can create duplicate visits, and if the later appointment version update fails after visit creation, an orphan/duplicate visit remains.
- **Suggested fix:** Add a partial unique index on active `visits(appointment_id)` where `appointment_id is not null and deleted_at is null`, and wrap "create visit + mark appointment in_visit" in a single RPC/transaction.

#### H5. Dashboard-created vaccination reminders defeat the documented 14-day reminder window

- **Where:** `app/lib/services/medical-record.service.ts#recordVaccination`; `app/lib/services/dashboard-notifications.service.ts#enqueueVaccinationReminder`; `agent/src/lib/vaccinationReminders.ts#enqueueDueVaccinationReminders`; `docs/superpowers/plans/2026-08-28-vaccination-reminders.md`.
- **What is wrong:** The plan and agent job say vaccination reminders are enqueued for vaccinations due within the next 14 days. The dashboard instead upserts a `vaccination_reminder` immediately when a vaccination is recorded and sets `scheduled_for` to `${nextDueAt}T06:00:00.000Z`. Because both paths use `ON CONFLICT (vaccination_id,type) ... ignoreDuplicates`, the future dashboard row blocks the cron job from inserting the intended "due within 14 days" reminder.
- **Why it matters:** A vaccination recorded months ahead will not get the intended 14-day-ahead SMS; it will send on the due date, and at 06:00 UTC rather than 06:00 Jerusalem time.
- **Suggested fix:** Decide one ownership model. Prefer letting the agent's daily job own the 14-day scan, or compute `scheduled_for = next_due_at - 14 days at 08:00 Asia/Jerusalem` in the dashboard. Add tests asserting `scheduled_for`, not only SMS body/dedupe.

#### H6. Dashboard calendar availability ignores `checked_in` and `in_visit` appointments

- **Where:** `app/lib/services/calendar.service.ts#availabilityByDate` filters active appointments to `scheduled`, `confirmed`, and `pending_approval`; `agent/src/lib/store.ts#checkAvailability` and the DB exclusion constraint also treat `checked_in` and `in_visit` as active.
- **What is wrong:** The app's availability calculation does not match the active-status set enforced by `appointments_no_active_overlap`.
- **Why it matters:** The dashboard can show slots as available while a checked-in/in-visit appointment occupies the time. A later insert/update may be rejected by the DB constraint, or staff may see misleading availability.
- **Suggested fix:** Share the active appointment status list across app, agent, and migrations, and include `checked_in` / `in_visit` in dashboard availability.

#### H7. `reset-clinic-data.mjs` deletes all tenant data, not one clinic

- **Where:** `app/scripts/reset-clinic-data.mjs`, especially `DELETE_ORDER` and `admin.from(table).delete().not("id", "is", null)`.
- **What is wrong:** The script is described as clearing pilot clinic data, but it deletes every row in each listed table. There is no `clinic_id` filter and no project-ref/environment confirmation beyond `--confirm`.
- **Why it matters:** The database is explicitly multi-tenant by `clinic_id`; running this against production after adding another clinic would wipe operational data for every clinic.
- **Suggested fix:** Require a `CLINIC_ID` and project-ref confirmation, count/delete only rows with that `clinic_id`, and refuse to run for tables that cannot be safely clinic-scoped.

#### H8. Production docs still contradict the verified Twilio/ElevenLabs call path

- **Where:** `README.md` still diagrams `Twilio -> POST /twilio/voice -> agent`; `docs/DEPLOYMENT_STATUS.md` and `docs/PRODUCTION_SETUP_CHECKLIST.md` tell operators to point Twilio Voice to `https://voxly-agent.fly.dev/twilio/voice`; `CLAUDE.md` says the verified production path is Twilio's native ElevenLabs inbound-call URL and warns that repointing Twilio at the app broke calls.
- **What is wrong:** The repo has two live-looking sets of operational instructions for mutually exclusive voice routing.
- **Why it matters:** Following the stale checklist can reproduce the prior outage class and make Tomer go silent.
- **Suggested fix:** Update README/deployment/checklist docs so there is one source of truth: current production Twilio `voice_url` should point to ElevenLabs native inbound-call unless there is a deliberate fallback migration plan.

### Medium

#### M1. SQL trigger contains hard-coded SMS templates and a fixed clinic location

- **Where:** `supabase/migrations/20260612000015_notifications.sql#appointments_notify_dashboard_change`; app code otherwise uses `@tomer/shared` in `packages/shared/src/sms-templates.ts`.
- **What is wrong:** Dashboard cancellation/reschedule notifications generated by the DB trigger are not built from the shared frozen SMS templates. The reschedule body hard-codes `📍 הקליניקה, גרציאני 6 ת"א`, so rescheduled `home_visit` appointments can receive the wrong location. The trigger also only skips `status = 'pending'` rows on cancellation, unlike the TypeScript helper that also skips `processing`.
- **Why it matters:** This reintroduces SMS wording drift and customer-facing mistakes even after the code-level shared package fixed earlier drift.
- **Suggested fix:** Replace the trigger-generated body path with an app/agent-owned enqueue path that uses shared templates, or ship a new migration updating the trigger to match shared behavior, including visit-type-aware location and `processing` handling.

#### M2. Approved pending appointments do not get `arrival_reminder`

- **Where:** `agent/src/lib/notifications.ts#scheduleBookingNotifications` enqueues `arrival_reminder`; `app/lib/services/dashboard-notifications.service.ts#enqueueApprovalNotifications` enqueues only booking confirmation, morning reminder, and post-visit follow-up.
- **What is wrong:** App-approved `pending_approval` appointments follow a different notification schedule than agent-created appointments.
- **Why it matters:** Neutering/surgery approvals from the dashboard miss the 2-hour arrival confirmation path that the rest of the appointment pipeline supports.
- **Suggested fix:** Add `arrival_reminder` to dashboard approval notifications and cover it in `app/tests/unit/sms-template-parity.test.ts`.

#### M3. Appointment overlap races in the dashboard become provider errors

- **Where:** `app/lib/services/appointment.service.ts#createAppointment` and `#updateAppointment` pre-check overlaps; `app/lib/repositories/appointment.repository.ts#create` / `#updateVersioned` map all insert/update DB errors to external provider errors.
- **What is wrong:** The DB exclusion constraint is the real race-proof guard, but app repository methods do not translate `23P01` / `appointments_no_active_overlap` into a 409 conflict the way `agent/src/lib/store.ts#bookAppointment` does.
- **Why it matters:** Two staff actions racing for the same slot can surface as a generic 502 instead of a recoverable "slot was just taken" conflict.
- **Suggested fix:** Map exclusion constraint errors in the appointment repository to `AppError.conflict`, and add a unit test that simulates a `23P01`.

#### M4. Raw provider/database error details are returned to API clients

- **Where:** `app/lib/api/response.ts#jsonError` includes `error.details`; many repositories use `AppError.externalProvider(..., error)` with raw Supabase/Twilio/Green Invoice details.
- **What is wrong:** Internal provider payloads, SQL constraint names, table names, and third-party response bodies can be serialized into authenticated API responses.
- **Why it matters:** This leaks implementation detail and can expose sensitive operational metadata. It also couples client behavior to provider-specific errors.
- **Suggested fix:** Log raw details server-side with `requestId`; return sanitized details to clients, especially for `EXTERNAL_PROVIDER_ERROR`.

#### M5. Search filters interpolate user input into PostgREST `.or(...)` expressions

- **Where:** `app/lib/repositories/customer.repository.ts#list` and `app/lib/repositories/pet.repository.ts#list`.
- **What is wrong:** Search uses strings like ``.or(`full_name.ilike.%${filters.query}%,...`)``. Input is length-limited but not escaped for PostgREST filter syntax (`%`, `_`, comma, parentheses, operator fragments).
- **Why it matters:** RLS and `clinic_id` filters still limit tenant scope, but malformed or crafted search terms can change the intended filter expression or cause query parse errors.
- **Suggested fix:** Escape PostgREST pattern/control characters, use separate safe `ilike` filters where possible, or move search to an RPC/full-text function with bound parameters.

#### M6. Inventory adjustment is non-atomic and can lose concurrent updates

- **Where:** `app/lib/repositories/inventory.repository.ts#adjust`.
- **What is wrong:** The code reads `quantity_on_hand`, computes `next`, updates without a version predicate, then inserts the inventory transaction in a separate statement.
- **Why it matters:** Two concurrent adjustments can overwrite each other, and a transaction insert failure can leave stock changed without an audit transaction.
- **Suggested fix:** Move inventory adjustment plus transaction insert into a single DB RPC using `UPDATE ... SET quantity_on_hand = quantity_on_hand + delta WHERE ... AND quantity_on_hand + delta >= 0 RETURNING *`.

#### M7. Child tables duplicate `clinic_id` without composite foreign keys

- **Where:** `supabase/migrations/20260901010129_phase10_inventory_billing_core.sql`:
  - `inventory_transactions.item_id uuid references public.inventory_items(id)`
  - `payments.invoice_id uuid references public.invoices(id)`
  - `visit_charges.invoice_id uuid references public.invoices(id)`
- **What is wrong:** These tables carry a `clinic_id` and an FK to another clinic-scoped table, but the FK does not enforce that both clinic ids match.
- **Why it matters:** RLS `WITH CHECK (is_clinic_member(clinic_id))` validates only the child row's clinic. Direct Supabase clients or future API bugs can create cross-clinic references.
- **Suggested fix:** Add `UNIQUE (id, clinic_id)` to referenced tables where missing and use composite FKs from child `(id, clinic_id)` pairs.

#### M8. Visit/pricing configuration remains duplicated across app, agent, and knowledge base

- **Where:** `agent/src/lib/appointments.ts`, `app/lib/appointment-rules.ts`, `agent/src/lib/notifications.ts#VISIT_PRICE`, `app/lib/services/dashboard-notifications.service.ts#VISIT_PRICES`, and `agent/src/knowledge/kb/pricing_and_visits.md`.
- **What is wrong:** Durations currently match, but there is no shared source of truth for visit type metadata/pricing. One visible mismatch: both SMS price maps use `vaccination: "150 ₪"` while the knowledge base says vaccination prices depend on the specific vaccine and lists separate prices.
- **Why it matters:** Tomer and SMS confirmations can give customer-facing prices that diverge from the approved KB or dashboard price list.
- **Suggested fix:** Move visit type metadata and pre-visit price display rules into `@tomer/shared` or a database-backed settings source, and add parity tests against the KB/price-list policy.

#### M9. App integration tests cannot run in the current cloud environment

- **Where:** `app/scripts/with-supabase-env.sh` requires `supabase` CLI; command `npm run test:integration --workspace=app` fails with `Error: supabase CLI not found in PATH.`
- **What is wrong:** The repo advertises integration tests, but this environment cannot execute them.
- **Why it matters:** Schema/RLS regressions are exactly the class of issues unit tests miss.
- **Suggested fix:** Install Supabase CLI in the Cloud Agent environment or document a Docker/local fallback. Keep the failure mode explicit.

#### M10. Lint passes with warnings and CI may not treat warning regressions as failures

- **Where:** `npm run lint --workspace=app` reports 4 warnings:
  - `app/lib/services/appointment.service.ts:518` unused `params`
  - `app/lib/services/price-list-item.service.ts:1` unused `ok`
  - `app/tests/unit/prompt-consolidation-provider.test.ts:5` unused `_model`
  - `app/tests/unit/prompt-suggestion.repository-race-guard.test.ts:45` unused `_omit`
- **What is wrong:** The lint command exits 0 despite warnings.
- **Why it matters:** Warning creep can hide real issues over time.
- **Suggested fix:** Clean existing warnings and consider `eslint --max-warnings=0` in CI.

#### M11. Vitest config uses future-incompatible `__dirname`

- **Where:** `app/vitest.config.ts` imports `path` and uses `path.resolve(__dirname, ".")`.
- **What is wrong:** Vitest warns that `__dirname` is unsupported by the future native config loader.
- **Why it matters:** A future Vite/Vitest upgrade can break tests.
- **Suggested fix:** Replace with `import.meta.dirname` or a `fileURLToPath(import.meta.url)` helper.

### Low

#### L1. README and agent docs are stale about monorepo shape and auth mechanics

- **Where:** `README.md` says "Two packages" even though `package.json` has `agent`, `app`, and `packages/shared`; `AGENTS.md` still says 15 migrations and six SMS templates; `CLAUDE.md` still says `app/middleware.ts` and says `/tools/*` uses ElevenLabs HMAC even though `agent/src/server/routes/tools.ts` uses a bearer token.
- **Why it matters:** Humans and coding agents can make wrong assumptions.
- **Suggested fix:** Consolidate `README.md`, `AGENTS.md`, and `CLAUDE.md` into one current source of truth or add a freshness checklist.

#### L2. Root scripts do not include build/lint aggregators

- **Where:** root `package.json` has `test:*` and `typecheck:*`, but no `lint:all` or `build:all`.
- **Why it matters:** The expected full verification sequence is spread across package scripts/docs.
- **Suggested fix:** Add root `lint:all` and `build:all` scripts.

#### L3. `npm ls --workspaces --depth=0` reports extraneous packages

- **Where:** root `node_modules` after `npm install` reports extraneous `@emnapi/*`, `@img/sharp-wasm32`, `@napi-rs/wasm-runtime`, and `@tybys/wasm-util`.
- **Why it matters:** This is probably optional dependency fallout from Next/sharp, but it makes dependency tree health noisy.
- **Suggested fix:** Reproduce on a clean checkout after the Next upgrade; if still present, inspect lockfile optional dependency handling.

#### L4. Dead or confusing notification helpers/tests remain

- **Where:** `app/lib/services/dashboard-notifications.service.ts#enqueueRejectionNotification` is only referenced by tests; `agent/src/lib/notifications.ts#enqueueRescheduleNotification` appears test-only.
- **Why it matters:** Dead helpers make it harder to know whether DB trigger or TypeScript code owns notification behavior.
- **Suggested fix:** Either wire these helpers into the real flow or delete/archive them with the tests after replacing trigger-owned SMS behavior.

#### L5. Prior audit/tool reports are tracked at repo root

- **Where:** `AUDIT_REPORT.md` and `tomer-tools-audit.md`.
- **Why it matters:** They contain useful history, but some findings are now fixed and can mislead readers unless clearly marked as historical.
- **Suggested fix:** Move historical reports under `docs/archive/` or add a banner pointing to the latest audit.

#### L6. Stale/divergent remote branches should be cleaned up

- **Where:** `git branch -r` shows several branches far behind `origin/main` (`origin/chore/clinic-reset-and-users`, `origin/pims-gap-closure`, `origin/feat/clients-bolder`, etc.) and two prior audit branches that are one commit ahead but behind main.
- **Why it matters:** Branch clutter increases the chance of someone opening old work against current production.
- **Suggested fix:** Review whether the ahead audit commits are intentionally preserved, then delete merged/stale branches.

#### L7. Public visit-share view counter can lose increments

- **Where:** `app/lib/repositories/visit-share.repository.ts#recordView` does `view_count = currentCount + 1` from a previously read value.
- **Why it matters:** Concurrent views can undercount. This is analytics-only, not access control.
- **Suggested fix:** Use an RPC or SQL increment expression.

#### L8. Small code hygiene issues remain in production-adjacent files

- **Where:** `app/lib/learning/elevenlabsTesting.ts` repeats the same `if (!current.platformSettings)` guard twice; `.air/worktree.json` contains dummy macOS setup with `EXAMPLE_KEY`.
- **Why it matters:** Low direct risk, but these are signs of cleanup debt.
- **Suggested fix:** Remove duplicate checks and archive/remove unused local tooling config if it is not part of the project workflow.

## Notable Non-Findings

- No merge conflict markers were found.
- No real committed `.env` files or obvious secrets were found.
- The current app and agent production builds succeed.
- App API routes are broadly guarded: only logout, health, and intentionally retired Twilio webhook routes lack the standard auth helper.
- Provider-admin API/pages are protected by `requireProviderAdmin`.
- The older critical findings around deleted pets in `lookup-customer`, create-or-find races for customers/pets, and shared SMS wording appear fixed in current `main`.
