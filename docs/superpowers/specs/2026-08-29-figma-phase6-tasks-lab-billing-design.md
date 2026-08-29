# Figma Redesign Phase 6: Tasks, Lab, Billing List — Design Spec

**Date:** 2026-08-29
**Status:** Approved (standing approval to complete all phases).
**Relation to prior specs:** [2026-08-29-figma-visual-redesign-design.md](2026-08-29-figma-visual-redesign-design.md) — roadmap. Covers `tasks-inbox` (Figma node `42:8`), `laboratory-dashboard` (`42:284`), `billing-invoice` (`42:528`, top-level list). `settings-page` (`42:679`) is **not** covered — research found `app/app/dashboard/settings/page.tsx` is already a real, working, fully token-styled page (clinic profile, business hours, visit prices, account) — no work needed there.

## Research findings

- **Tasks:** 100% greenfield — no table, type, repository, route anywhere.
- **Lab:** 100% greenfield — same.
- **Billing (top-level, clinic-wide list):** the per-customer/per-pet `InvoicesSection` + `/api/invoices` backend already exist (Phase 4) and already support an unscoped clinic-wide query (`listInvoicesSchema`'s `customerId`/`petId` are both optional) — only a new page is needed, no backend change.
- `ClinicRole` = `"owner" | "admin" | "staff" | "veterinarian"`.

## Scope decisions

- **Tasks inbox:** Figma's mockup shows a *unified* inbox mixing manually-created tasks with auto-surfaced items from other domains (lab result flagged, prescription refill request, callback reminder, pending appointment approval, overdue invoice). Building genuine manual tasks is straightforward; auto-generating "prescription refill request" or "callback request" items has **no real signal behind it** in the data model — inventing one would be exactly the kind of unreviewed business logic this project has been avoiding at every phase. This phase builds:
  - A real `tasks` table (title, description, priority, due date, assignee, status, optionally linked to a customer/pet) with full CRUD.
  - The inbox page aggregates that table with two *real* existing signals: `pending_approval` appointments (already exist) and `sent`/unpaid invoices (already exist, Phase 4). It does **not** fabricate lab-flagged or prescription-refill task rows — once Lab (this same phase, see below) ships, a flagged lab result becomming a task is a natural, real follow-up, but wiring that cross-reference is deferred to keep this phase's scope reviewable in one pass.
- **Lab:** new `lab_orders` table — clinic-scoped, linked to a pet (and optionally the visit that ordered it), test name, status (`ordered` → `in_progress` → `completed`), free-text result, a `flagged` boolean the vet sets when a result is abnormal, ordered/completed timestamps. Mirrors the existing `prescriptions`/`vaccinations` modeling pattern (simple direct CRUD, no external lab API integration — there is none to integrate with).
- **Billing (top-level):** new `/dashboard/billing` page — all invoices for the clinic, filterable by status, reusing the exact existing `/api/invoices` GET with no `customerId`/`petId`. No backend changes.
- **Nav:** משימות, מעבדה, and חיובים get real sidebar entries now (Phase 1 explicitly deferred them until their pages existed — this is that point). Three new icon components needed (list-check, microscope, credit-card) since none of the existing icon set covers them.
- **Settings:** no changes.

## Explicitly out of scope

- Auto-generated "prescription refill request" / "callback request" task sources (no real signal exists).
- External lab system integration (order transmission, result import) — this is a manual-entry system, like every other clinical record in this app.
- Cross-linking a flagged lab result into the tasks inbox automatically (real, reasonable follow-up; deferred to keep this phase's diff reviewable).
- Any settings-page changes (already complete).
