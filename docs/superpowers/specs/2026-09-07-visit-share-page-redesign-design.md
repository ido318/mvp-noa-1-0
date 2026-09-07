# Visit-share page redesign — design spec

Date: 2026-09-07

## Problem

When a visit is closed, the clinic sends the client an SMS with a link
(`visit-share.service.ts` → `/s/[token]`) to a page showing the visit summary
and active prescriptions. The page (`app/app/s/[token]/page.tsx`) is currently
a generic minimal Tailwind layout (rounded cards, zinc palette) that looks
nothing like the clinic's actual paper documents.

Dr. Noa's clinic already produces branded paper documents (visit summary,
animal case file, receipt) with a consistent look: the GetaVet logo (pink dog
mark), a header block with clinic name/address/phone/email on one side and
client name/date on the other, a patient/animal info table, and a
structured visit entry (vet name, history/reason, findings, diagnosis,
treatment, prescription).

Goal: make the `/s/[token]` page visually match that paper-document style,
using the brand assets and data already in the system, and let the client
download it as a PDF from their phone.

## Scope

- **In scope:** `app/app/s/[token]/page.tsx` only — presentation and the
  additional read queries needed to populate it. No changes to
  `visit-share.service.ts`, the SMS body, token/expiry/RLS logic, or any
  database schema.
- **Out of scope (explicitly deferred):** a full chronological medical
  record (all past visits/vaccinations/prescriptions for the pet) — the user
  confirmed this is a *separate future feature* ("תיק רפואי"), not part of
  this page. This page shows **only the single visit** the SMS was sent for.
- No new "case number" field — the paper document's מספר תיק has no digital
  equivalent and is omitted entirely, per explicit decision.

## Data needed (all already modeled)

- `Visit` (existing fetch) — `chiefComplaint`, `startedAt`, `createdByUserId`.
- `Pet` (existing fetch) — add `breed`, `sex`, `birthDate` (→ compute age),
  `chipNumber`, `species` to what's already selected.
- `Customer` (existing fetch) — `fullName` (already used).
- **New:** `MedicalNoteRepository.listByVisit(visitId)` — pull the visit's
  SOAP note (if one exists) for `subjective` / `objective` / `assessment` /
  `plan`. Use the latest `approved` note; if none, fall back to the
  latest note of any status; if none at all, fall back to
  `visit.aiVisitSummary ?? visit.manualVisitSummary` as free text (today's
  behavior), rendered under a single "סיכום הביקור" heading instead of the
  four SOAP sections.
- **New:** `ProfileRepository.findByUserId(visit.createdByUserId)` → vet's
  `fullName`, shown as "הרופא: ד"ר …". If `createdByUserId` is null or the
  profile lookup fails, omit the line (no placeholder text).
- `Prescription` (existing fetch, unchanged) — active prescriptions for the
  visit, rendered same as today.

## Age computation

Add a small helper (colocated in the page file — this is the only caller)
that computes "X ש' Y ח'" (years/months) style age text from
`pet.birthDate`, matching the paper document's format. If `birthDate` is
null, omit the age field from the table.

## Layout

Replace the current rounded-card/zinc-palette layout with a plain
white-background, RTL, print-document look:

1. **Header** — two-column row:
   - Right (in RTL, visually first): GetaVet logo mark (`/logo-mark.svg`) +
     clinic name "גט א וט", address "גרציאני 6 תל אביב", phone, email —
     static constants matching the paper letterhead.
   - Left: customer name ("לקוח: …") and visit date ("תאריך: …"), same as
     the paper document's top-right block.
   - Thin bottom border, no rounded corners, no colored background.

2. **Animal info table** — one row/table (not a card) with columns: שם
   החיה, סוג, גזע, מין, גיל, שבב — populated from `Pet`, omitting any column
   whose value is null.

3. **Visit block** (the single visit only):
   - "הרופא:" line (vet full name), if available.
   - "היסטוריה/סיבת הביקור:" — `chiefComplaint` and/or SOAP `subjective`.
   - "ממצאים ובדיקות:" — SOAP `objective` (omit section if absent).
   - "אבחנה:" — SOAP `assessment` (omit section if absent).
   - "הטיפול:" — SOAP `plan` (omit section if absent).
   - If no SOAP note exists at all: single "סיכום הביקור" section with the
     free-text summary, as today.
   - Plain text sections separated by thin horizontal rules, matching the
     paper document's field-label / value pattern — no card backgrounds.

4. **Prescriptions** — same content as today (medication name,
   instructions, notes), restyled to match the plain document look (no
   rounded/zinc card chrome).

5. **Footer** — existing disclaimer line, unchanged content.

6. **"הורדת PDF" button** — visible on-screen only (`print:hidden`), calls
   `window.print()`. Add a `@media print` block that:
   - Hides the button itself.
   - Sets a white background and A4-friendly margins.
   - Removes any remaining screen-only chrome (e.g. `min-h-screen` full
     background color).

## Error/empty states

- `ExpiredNotice` component: unchanged behavior, but restyle to match the
  same plain document aesthetic (logo + message, no card).
- Missing optional fields (breed, sex, chip, age, vet name, SOAP sections)
  are simply omitted from the layout — never rendered as empty/placeholder
  rows. This mirrors current behavior for `petName`/`customerName` blocks.

## Testing

- Existing tests referencing this page (if any) should be checked for
  selector/text assumptions that the restyle would break.
- Add/extend a unit or component-level test for the new age-computation
  helper (birthDate → age string, null → omitted).
- No new integration test needed — no new service/repository behavior,
  only new read calls using existing repository methods
  (`MedicalNoteRepository.listByVisit`, `ProfileRepository.findByUserId`)
  and one new small pure helper.
