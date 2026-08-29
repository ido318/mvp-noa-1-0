# Figma Visual Redesign — Design Spec

**Date:** 2026-08-29
**Status:** Phases 1-2 shipped (tokens + sidebar, today dashboard). Phase 3 (calendar + appointment flow) approved and spec'd, see [2026-08-29-figma-phase3-calendar-appointments-design.md](2026-08-29-figma-phase3-calendar-appointments-design.md), pending implementation plan. Phases 4-6 are still a roadmap, each needs its own approval + spec/plan before implementation.
**Relation to prior spec:** [2026-08-27-dashboard-crm-redesign-design.md](2026-08-27-dashboard-crm-redesign-design.md) already shipped the current information architecture (nav items, customer-centric profile, teal `--brand-*` palette). This spec layers a new visual language on top of that IA, sourced from a Figma file the clinic's designer produced, and extends the IA with a few new screens the designer added (patient medical record, clinical encounter/SOAP workspace, prescriptions, billing tab).

## Source

Figma file `6YZZTnWcdXD7Dj8MqGJ7IF` ("Untitled"), page "Page 2". Branded "אנימליה קליניק" in the file — a generic placeholder brand, not real; all copy must be re-targeted to the actual clinic branding already in the app (clinic name comes from `clinics` table / session, not hardcoded).

Note: the file also contains an unrelated "Page 1" (a generic "SmartCRM" sales/deals template) — not used for anything here.

8 real designed screens as of 2026-08-29 (4 apparent "duplicates" turned out to be empty placeholder frames and were discarded):
1. `today-dashboard` (node `4:7`)
2. `calendar-week-view` (node `4:271`)
3. `appointment-detail-drawer` (node `4:476`)
4. `new-appointment-flow` (node `4:611`)
5. `client-detail-page` (node `5:5`)
6. `patient-detail-page` (node `5:240`)
7. `encounter-workspace` (node `5:465`)
8. `prescription-flow` (node `5:821`)

**Added 2026-08-29 (4 more screens, filling in previously-undesigned nav items):**
9. `tasks-inbox` (node `42:8`) — unified task queue (prescription renewal requests, lab-result reviews, callback requests, overdue-payment reminders), tabs by urgency/category
10. `laboratory-dashboard` (node `42:284`) — lab order/result tracking, external-lab sync status
11. `billing-invoice` (node `42:528`) — single invoice detail view (line items, totals, send)
12. `settings-page` (node `42:679`) — settings shell with a left sub-nav (clinic details, staff/roles, visit-type templates & durations, service catalog, drug/inventory management, vaccination formulary, AI settings, communication/automation settings, billing & payments, integrations)

Still undesigned: תקשורת (communications) and מרשמים as a standalone list (a "מרשמים" tab exists inside `tasks-inbox`, but no dedicated prescriptions-list screen).

**Flag for later:** `settings-page`'s "סוגי תורים ומשך זמן" sub-section designs an editable UI for appointment-type durations — today these are hardcoded constants (`VISIT_TYPE_CONFIG` in `agent/lib/appointments.ts`) and documented in root `CLAUDE.md` as a binding decision ("משכי ביקורים... הוחלט בפגישה 2026-06-11"). Making them editable means introducing a DB-backed config table the agent reads at runtime instead of a TS constant — a real architecture change, not just a visual one. Out of scope for now; needs its own explicit sign-off when we get to that phase, not to be built as a side effect of "matching the Figma design."

## Full roadmap (for context — only Phase 1 is being planned/built now)

| Phase | Scope | Notes |
|---|---|---|
| **1** | Design tokens + shared shell (sidebar + header) | This spec. No page content changes. |
| **2** | Today dashboard | Shipped using existing `dashboard/page.tsx` data; no DB/API changes |
| 3 | Calendar week view + appointment drawer + new-appointment modal | Existing data (`appointments`, `calendar_blocks`) |
| 4 | Client detail + Patient detail pages (incl. billing tab as UI-only, no payment gateway yet — will be wired to a real processor later) | Some new fields/empty states, no schema blockers |
| 5 | Encounter workspace (SOAP) + Prescription flow | Needs new DB tables/columns — biggest phase |
| 6 | Tasks inbox + Laboratory dashboard + Billing/invoice (top-level) + Settings page | Added 2026-08-29; needs new DB tables (tasks, lab orders, invoices) and scoping of which settings sub-sections are real vs. deferred |

Sidebar items still with no corresponding Figma screen (תקשורת, מרשמים as a standalone list, דוחות) stay exactly as they are today (existing pages/placeholders) until/unless designed later — only their nav-item visual styling updates in Phase 1.

## Phase 1 scope: design tokens + shared shell

### Token mapping

Keep the existing token *architecture* (`app/app/globals.css` CSS custom properties) — do not rename variables or introduce a parallel system. Update values to match the Figma palette, which is already close (both are teal-based, per the 2026-08-27 spec's chosen direction):

| Token | Current | Figma value | Action |
|---|---|---|---|
| `--brand-600` (primary actions/active) | `#14877D` | `#0D9488` (Tailwind teal-600) | update |
| `--brand-100` (light teal fills) | `#D3EEEA` | `#CCFBF1` (Tailwind teal-100) | update |
| `--brand-800` (active-nav text) | *(doesn't exist)* | `#115E59` (Tailwind teal-800) | **add** — natural gap in the existing 900→50 scale |
| `--ink` (primary text) | `#1F2933` | `#0F172A` (Tailwind slate-900) | update |
| `--ink-2` / secondary text | `#42505E` | `#475569` (Tailwind slate-600) | update |
| `--muted` | `#6B7785` | `#94A3B8` (Tailwind slate-400) | update |
| `--line` (borders) | `#E2E8ED` | `#E2E8F0` (Tailwind slate-200) | update |

The Figma file's colors turn out to be exactly the Tailwind default teal/slate scale — confirmed by matching hex values above — so remaining tokens (`--brand-900/700/500/400/200/50`, `--faint`, `--line-2`) are left as-is for Phase 1 (already close enough) rather than guessed at; revisit only if a later phase's screenshot comparison shows a mismatch.

Active-nav item: full pill using `--brand-100` background + `--brand-800` text (replacing the current 3px inset-bar + `--brand-50` background + `--brand-700` text treatment).

### Font

Keep **Heebo** (already the established, deliberately-chosen font per `app/app/layout.tsx` and CLAUDE.md Stage 1 notes) instead of switching to the Figma file's Rubik. Both are geometric-humanist Hebrew sans-serifs with a very similar feel; switching fonts is a bigger brand decision than "implement the Figma visuals" calls for, and isn't worth the churn (new font load, retested line-heights across every screen) for a redesign that's meant to refine, not rebrand.

### Sidebar (`app/components/dashboard/sidebar.tsx`)

- Restyle active nav item: rounded-full/pill background (`--brand-100`-equivalent), bold semibold text, matching Figma's `nav-item-0` treatment — replacing the current 3px inset-bar active indicator.
- Restyle inactive nav items/hover per Figma (transparent bg, `--ink-2` text, subtle hover bg).
- Icons: the app has its own hand-rolled stroke-icon set (`app/components/dashboard/icons.tsx`, a shared `icon(path, viewBox)` factory), not a library — `TodayIcon`/`CalendarIcon`/`CallsIcon`/`EscalationIcon`/`ClientsIcon`/`ClockIcon`/`SettingsIcon` already exist and already visually match the Figma icon set (layout-dashboard/calendar/phone/triangle-alert/users/clock/settings), so no new icons are needed for the 7-item Phase 1 nav.
- Nav items, restyled only — **only items with a real, working destination today** get a sidebar entry; a nav item with no page behind it is a dead link, worse than no nav item, and contradicts "leave undesigned sections as they currently exist" (today, only `הגדרות` has both a nav slot and a page — תקשורת/משימות/מרשמים/מעבדה/דוחות have neither, so they're not added to the sidebar yet; they'll be added in the phase that actually ships their page):

  היום · לוח שנה · לקוחות ומטופלים · שיחות · תשומת לב · המתנה · הגדרות

  - "אסקלציות" is renamed **"תשומת לב"** (route stays `/dashboard/escalations`, label only) — echoes the Figma today-dashboard's own "דורש תשומת לב" card heading, and reads more natural than the loanword "אסקלציות."
  - "לקוחות" is renamed **"לקוחות ומטופלים"** (route stays `/dashboard/clients`, label only), matching Figma.
  - "שיחות" and "המתנה" keep their current routes/behavior, just restyled.
  - When Phase 6 (or a later phase) ships a real page for תקשורת/משימות/מרשמים/מעבדה/דוחות, that phase's plan adds its nav item + icon at that time — not before.

### Header (`app/components/dashboard/header.tsx`)

Restyle to match Figma's shared top-bar treatment (search bar style, spacing, notification bell) — page-specific title/actions (e.g. "יצירה מהירה" button, per-page titles) are out of scope for Phase 1 since those belong to each page's own content, built in later phases.

### Explicitly out of scope for Phase 1

- Any page content/layout change (today dashboard body, calendar grid, etc.) — Phases 2+.
- New DB tables/columns (prescriptions, encounter clinical fields, invoices) — Phase 4/5.
- New nav destinations for תקשורת/משימות/מרשמים/מעבדה/דוחות — stay on existing pages/placeholders.
- Rebuilding existing shared UI primitives (`Btn`, `Badge`, `Card`, etc. in `app/components/dashboard/ui/`) — only their token-driven colors change automatically via the CSS var updates above; no component rewrites needed.

## Open questions for implementation planning

- Final confirmed hex values for status/urgency colors (not yet extracted from Figma) — pull during implementation rather than guessing.
- Confirm `lucide-react` (or current icon lib) has exact matches for all Figma icons; note any gaps.
- Final nav item order — quick confirmation once assembled.
