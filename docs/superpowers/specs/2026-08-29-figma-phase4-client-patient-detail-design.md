# Figma Redesign Phase 4: Client + Patient Detail — Design Spec

**Date:** 2026-08-29
**Status:** Approved (user directed completing all remaining phases in one continuous pass). Spec kept intentionally tight — scope decisions below, not a full back-and-forth brainstorm, given the standing approval already given for phases 1-3.
**Relation to prior specs:** [2026-08-29-figma-visual-redesign-design.md](2026-08-29-figma-visual-redesign-design.md) is the roadmap; Phases 1-3 shipped. This covers `client-detail-page` (Figma node `5:5`) and `patient-detail-page` (`5:240`).

## Key finding that shapes this phase

`app/app/dashboard/clients/page.tsx` already has a working single-scroll drawer (contact, pets, appointment history, visit history, notes) and `app/app/dashboard/pets/[petId]/page.tsx` already has a working editable profile + recent visits/vaccinations — both fully functional, just plain-Tailwind styled (`zinc`/`emerald`, not the design-token system). **No `invoices`/`billing`/`payment` table, type, repository, or route exists anywhere** — confirmed by grep across `app/` and `supabase/`. Billing is the only genuinely new backend surface in this phase.

## Scope decisions (cuts from the literal Figma design, and why)

- **VIP badge / customer tags:** the 2026-08-27 spec already flagged a controlled tag vocabulary as an open decision requiring Noa's input (not to invent unilaterally). Still open — no tag/VIP UI this phase.
- **Weight trend graph:** `pets.weight` is a single current-value column, no history table exists. Building a `pet_weight_logs` table just to feed a 3-point trend card is disproportionate to the payoff. Show current weight only; skip the trend card.
- **AI-generated "active problems" / rolling clinical summary card:** inventing a new AI-generated-content feature for a veterinary medical context isn't something to add unilaterally (accuracy/liability stakes). Instead, surface the *real* data that already exists for this: `pets.allergies` and `pets.chronicConditions` (already on the `Pet` type) as plain alert banners — same visual treatment Figma uses for medical alerts, sourced from real fields instead of invented AI output.
- **תקשורת / מסמכים / מעבדה tabs (communications / documents / lab):** no backend for any of these exists yet (lab is Phase 6's job). Match the Phase 1 precedent: don't add a tab with no real content behind it. `תרופות` (medications) and `ביקורים` (visits) and `חיסונים` (vaccinations) all map directly to `visits`/`vaccinations`/`prescriptions`, which already exist — those tabs are real.
- **Billing:** new `invoices` table, UI-only per the Phase 1 spec's already-approved decision (no payment gateway; will be wired to a real processor later, per the user).

## Client detail (reskin `clients/page.tsx`'s drawer)

Restyle the existing single-scroll drawer's content to Figma's visual language (already-established tokens/components), reorganizing into the sections Figma shows that map to real data:
- Header: name, phone, contact-method badge, quick actions (call `tel:`, SMS `sms:`, WhatsApp `https://wa.me/`, email `mailto:` — all plain links, no new integration).
- Pets (existing `PetCard`s, restyled).
- Upcoming appointments (existing `/api/appointments?customerId=` data, filtered to future).
- Visit history (existing).
- **New:** Billing tab — invoices for this customer (`GET /api/invoices?customerId=`), "הפק חשבונית" button opens a create-invoice form (line items, manual total — no tax/discount engine, keep it simple).

## Patient detail (reskin `pets/[petId]/page.tsx`)

Restyle to Figma's clinical hero + tabs layout:
- Hero: current weight, age (computed from `birthDate`), owner name/phone/link, species/breed/sex, neutered badge.
- Medical alert banners: from real `allergies`/`chronicConditions` fields (skip if both null).
- Quick actions: "פתח ביקור חדש" (→ existing `/dashboard/visits/new?petId=`), "קבע תור" (→ calendar wizard), "רשום תרופה" (→ jumps to the active visit's prescription section, or if no in-progress visit, prompts to start one first), call/message owner (`tel:`/`sms:`).
- Tabs: סקירה (overview: weight/age/owner/alerts/next appointment), ביקורים (existing visits list), חיסונים (existing vaccinations list), תרופות (all prescriptions across this pet's visits — new read query joining prescriptions→visits by petId, still zero new tables), חיובים (same invoices UI as client detail, scoped by petId if set).

## New backend: `invoices`

Minimal, UI-only (no payment processing):
```
invoices: id, clinic_id, customer_id, pet_id (nullable), invoice_number (text, e.g. INV-2026-001), status (draft|sent|paid|void), issued_at, items (jsonb: [{description, quantity, unit_price}]), total (numeric, computed from items), notes, created_by_user_id, created_at, updated_at, deleted_at
```
Repository + `GET/POST /api/invoices`, `GET/PATCH /api/invoices/:id` (status changes: mark sent/paid/void), following the exact existing pattern (`appointment.repository.ts` / `/api/appointments` as the template — versioned optimistic-concurrency PATCH, clinic-scoped RLS).

## Explicitly out of scope

- Real payment processing (Stripe/Cardcom/etc.) — UI/data model only, per already-approved Phase 1 decision.
- Weight history, AI clinical summaries, customer tags, lab/communications/documents tabs — all cut above with reasoning.
