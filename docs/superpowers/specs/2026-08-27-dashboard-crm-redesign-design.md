# Dashboard CRM Redesign — Design Spec

**Date:** 2026-08-27
**Status:** Approved by user (Ido), pending implementation plan.

## Problem

The clinic dashboard (`app/`) grew screen-by-screen across several sprints (היום, יומן, שיחות, אסקלציות, לקוחות, plus a second/older `customers` page, and thin/placeholder `pets`, `visits`, `appointments` pages). The result: duplicated entity screens, no single place to see a customer's full picture, no way to search across everything, no daily at-a-glance status, and no recall/reminder workflow — despite the underlying data (pets, vaccinations with `next_due_at`, appointments, calls) already existing in Supabase. User's own words: "עיצוב ויזואלי, זרימת עבודה איטית, מידע חסר/לא ברור, כאילו לא זורם" — and wants it to feel like a fast, practical CRM.

## Chosen approach: customer-centric hybrid (Approach C)

Keep the existing task-oriented screens (Today, Calendar, Calls, Escalations) for daily operational flow, but consolidate all customer/pet/appointment/visit data into one customer-centric profile instead of four separate flat entity lists. Reuse existing UI patterns/components (`components/dashboard/ui/`) rather than rebuilding from scratch.

## Navigation (replaces current 8+ scattered items)

היום | יומן | לקוחות | שיחות | אסקלציות | המתנה *(new)* | הגדרות

Removed as standalone nav items — folded into the customer profile: `customers` (old/duplicate page — delete outright), `pets`, `visits`, `appointments`.

## Screens

### 1. היום (Today) — enhanced
- New top KPI strip: appointments today / pending approvals / open escalations / waitlist count.
- New global search in the header (customer name / pet name / phone number).
- Existing timeline (08:00–20:00 + pending_approval) stays below, unchanged in behavior.

### 2. לקוחות (Customers) — new 360° profile, the centerpiece
- List view: existing `clients` page's table/drawer pattern, kept.
- Customer detail (drawer or full page — implementation plan should pick based on existing drawer pattern reuse) shows:
  - Header: name, phone, contact method, **tags** (new), free-text notes (existing `customers.notes` field).
  - Tabs/sections: **Pets** (from `pets`, each showing species/breed/vaccination status) → **Appointments** (from `appointments`) → **Visits** (from `visits`, reusing existing visit sub-sections: notes, prescriptions, vaccinations, AI summary, share) → **Calls** (from `voice_calls`, reusing `calls` page's row/drawer pattern).
- This absorbs the old `customers`, `pets`, `visits`, `appointments` top-level pages.

### 3. המתנה (Waitlist) — new
Simple table over the existing `waitlist` table: customer, desired visit type, date registered, notes. No new backend needed — table already exists (used by the voice agent's `/tools/join-waitlist`), just never had a dashboard view.

### 4. Vaccination reminders — new feature, cuts across Today + Customer profile
- Data already exists: `vaccinations.next_due_at`.
- **New scheduled job** (extend `services/notification.processor.ts` / `agent/lib/notifications.ts` patterns) that finds vaccinations due soon and sends an automatic SMS to the customer.
- **New Hebrew SMS template required** — per CLAUDE.md, the 6 existing templates are frozen; this is a 7th template and needs Noa's explicit sign-off on wording before shipping (do not invent wording unilaterally).
- Booking after the reminder happens through **existing channels only** — the customer calls Tomer (who already has `book-appointment` for `visit_type: vaccination`) or staff books manually in the dashboard. Both paths already write to `appointments`, which the Calendar already reads — **no new two-way SMS/booking integration needed**.
- Dashboard visibility: a "upcoming/sent reminders" list (where exactly — Today KPI strip badge + a section on the customer's Pets tab — implementation plan to confirm placement).

### 5. Global search — new
Header-level search across `customers.full_name`, `customers.phone`, `pets.name`. Opens directly into the matched customer's profile.

## Data model changes needed
- `customers`: new `tags` column (array of text, or a small `customer_tags` lookup table if we want a controlled/colored vocabulary — implementation plan to decide, controlled vocabulary preferred to avoid free-text drift, e.g. `VIP`, `בעל חוב`, `רגיש/לחוצה`).
- New migration for the above; follow existing migration numbering in `supabase/migrations/`.
- No new tables needed for waitlist or vaccination reminders (data already exists) — only a new `notifications`-style row type / template for the reminder SMS, matching the existing `notifications_log` pattern from Sprint 2.

## Visual direction

Cooler, clinical/modern palette (slate/teal), clean thin borders instead of the current warm terracotta brand palette's soft shadows — closer to a Notion/Linear-style professional CRM feel. This is a real branding shift from the current `--brand-*` orange tokens in `app/globals.css` — new tokens needed, applied consistently across all screens. User chose this direction (option "B") over a lighter refinement of the existing warm palette during visual review.

## Explicitly out of scope (Phase 2 / not now)
- Two-way SMS booking (customer replies to book) — reminder SMS just points back to existing booking channels.
- Billing/payments (already Phase 2 per CLAUDE.md).
- `calendar_blocks` management UI (separate Sprint 5 item per CLAUDE.md backlog).

## Open questions for implementation planning
- Exact controlled vocabulary + colors for customer tags.
- Exact "due soon" window for vaccination reminders (e.g., 14 days out?) and re-send/snooze behavior.
- Where in the UI reminders-sent history lives (Today KPI badge vs. dedicated small view).
- Whether customer profile is a full page route or an expanded drawer (existing codebase leans on drawers for calls/escalations — recommend following that precedent for consistency, but confirm in the plan given how much more content a 360° profile holds).
