# Figma Redesign Phase 3: Calendar + Appointment Flow — Design Spec

**Date:** 2026-08-29
**Status:** Approved by user (Ido), pending implementation plan.
**Relation to prior specs:** [2026-08-29-figma-visual-redesign-design.md](2026-08-29-figma-visual-redesign-design.md) is the overall roadmap (Phases 1-6); Phase 1 (tokens+shell) and Phase 2 (today dashboard) are shipped. This spec covers Phase 3: `calendar-week-view` (Figma node `4:271`), `appointment-detail-drawer` (`4:476`), `new-appointment-flow` (`4:611`).

## Finding that shapes this phase

A pre-implementation survey found clicking an appointment block on `app/app/dashboard/calendar/page.tsx` today does **nothing** — `ApptBlock` has no click handler at all, despite the page's own header text ("בחרו תור כדי לשנות מועד") promising it does. `appointments/new/page.tsx` hardcodes the *first* customer and *first* pet returned by the API with no picker UI. Meanwhile every backend piece needed (`/api/calendar`, `/api/calendar-blocks`, `/api/appointments` CRUD, `/api/appointments/:id/approve`, `/api/appointments/:id/reject`) already exists and works — `approve`/`reject` in particular are fully implemented server-side but called from **zero** UI anywhere. So this phase is a real feature build on the frontend, not just a visual reskin, even though it's scoped by Figma screens that look like "just" a drawer and a modal.

## A. Calendar week view (`app/app/dashboard/calendar/page.tsx`)

Cosmetic pass, reusing everything that already works:
- Apply Phase 1/2 token language (pill-style status accents, `--brand-*`/`--ink`/`--line` vars) to `ApptBlock` and `CalendarBlockOverlay` rendering — same visual family as the sidebar/today dashboard, not a new system.
- Reconcile the page's own `VISIT_LABELS`/`VISIT_ACCENTS` maps (lines ~90-128) — a second, parallel Hebrew-label/color system — into the single existing source of truth, `VISIT_TYPE_CONFIG.labelHe` from `app/lib/appointment-rules.ts`. One less place to update when a visit type's label changes.
- No data-fetching changes (`/api/calendar`, `/api/calendar-blocks` stay as-is, including the 5s poll).

## B. Appointment-detail drawer (new)

Clicking an `ApptBlock` opens `app/components/dashboard/ui/drawer.tsx` (already used by escalations/calls/clients — first use in calendar) instead of doing nothing:
- Content: customer name, pet name/species, visit type (via `VISIT_TYPE_CONFIG`), scheduled time, reason/notes, status — all already present on the `Appointment` object (`customerName`, `petName`, `petSpecies` are denormalized fields already in the API response, confirmed by the survey — no new API needed).
- Actions:
  - **`pending_approval` appointments (neutering):** reuse the existing `ApproveRejectModal` from `app/app/dashboard/page.tsx` (already built for the Today page) rather than building a second approve/reject UI — extract it to a shared location if it isn't already, and open it from the drawer.
  - **Cancel / reschedule:** a plain status change via the existing `PATCH /api/appointments/:id` (`{version, status}`), no 4-hour late-cancellation penalty logic applied. That rule exists to decide whether the *customer* gets billed for a late phone cancellation through Tomer — it's not relevant when Noa cancels/reschedules directly from the dashboard (confirmed with the user: staff-side changes and Tomer-side customer changes are two distinct paths, only the latter is penalty-bearing).
  - **"פתח כרטיס רפואי" (open medical record):** links to the existing `/dashboard/pets/[petId]` page. That page hasn't been redesigned yet (Phase 4) — this just points at what already works rather than building or blocking on a page this phase doesn't own.
  - **"התחל ביקור" (start visit):** links to the existing `/dashboard/visits/new?appointmentId=...` flow (unchanged, already used by the current appointment detail page).

## C. New-appointment wizard (biggest piece — real feature, not styling)

Replaces `app/app/dashboard/appointments/new/page.tsx`'s current single-page hardcoded-customer form with a 5-step modal (`app/components/dashboard/ui/modal.tsx`), triggered from a "יצירה מהירה"/"תור חדש" button on the calendar (and, later, reusable from other entry points):
1. **בחירת לקוח** — search-as-you-type over customers (reuse the header's existing customer-search pattern/API rather than inventing a new one).
2. **בחירת מטופל** — the selected customer's pets (`GET /api/customers/:id/pets`, already used today).
3. **סוג תור** — `VISIT_TYPE_CONFIG` options (checkup/vaccination/etc.), same source of truth as A.
4. **מועד ותאריך** — date/time picker constrained to clinic hours + the existing 14-day-ahead rule (`isWithin14Days`) and calendar-blocks awareness; reuse `GET /api/calendar/availability` if it already returns free slots (needs a quick check during planning — the survey flagged this route as "found, not yet read").
5. **אישור** — summary + submit, `POST /api/appointments` (unchanged payload shape, `durationMinutes: effectiveDuration(type)`).

Out of scope for this phase: creating a *new* customer inline mid-wizard (Figma doesn't show this either) — if the searched customer doesn't exist, the flow points staff to the existing "לקוח חדש" entry point elsewhere in the app rather than duplicating that form here.

## Explicitly out of scope for Phase 3

- Patient/client detail pages (Phase 4).
- Any new DB tables/columns — this phase is 100% frontend against already-existing endpoints.
- Two-way SMS notifying the customer of a staff-initiated reschedule (still Phase 2 of the *original* 2026-08-27 spec's "not now" list — unchanged).

## Open questions for implementation planning

- Whether `GET /api/calendar/availability` already returns exactly what step 4 needs, or needs a small shape adjustment — confirm by reading the route during planning rather than assuming.
- Exact current location/props of `ApproveRejectModal` in `dashboard/page.tsx`, to decide the cleanest way to share it with the drawer (extract to `components/dashboard/` vs. import directly).
