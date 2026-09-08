# Visit-share page redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the client-facing visit-summary page (`app/app/s/[token]/page.tsx`, opened from the SMS link) so it visually matches the clinic's real paper documents — GetaVet letterhead, patient/animal info table, structured visit fields — and add a "download PDF" button backed by the browser's print dialog.

**Architecture:** Two small pure helpers (age formatting, medical-note selection) extracted into their own files so they're unit-testable without mocking Supabase. The page itself gains three more read-only repository calls (clinic, medical notes for this visit, treating vet's profile) alongside its existing fetches, and its JSX is rewritten from rounded/zinc cards to a plain document layout with a `@media print` stylesheet. No service, repository-write, schema, or SMS-content changes.

**Tech Stack:** Next.js 16 App Router (async Server Component), Supabase (admin client, existing repositories), Tailwind CSS, Vitest for the two new pure-function tests.

---

## Reference: what already exists (do not recreate)

- `app/lib/repositories/clinic.repository.ts` — `ClinicRepository.findById(clinicId)` → `Result<Clinic | null>`. `Clinic.name` is the clinic display name; `Clinic.settings.contact` is always populated (`{ address, whatsapp, email }`, defaulted by `withClinicSettingsDefaults` in `app/lib/clinic-settings-defaults.ts` even if nothing was ever saved) — see `app/types/domain/clinic.ts`.
- `app/lib/repositories/medical-note.repository.ts` — `MedicalNoteRepository.listByVisit(visitId)` → `Result<MedicalNote[]>`, ordered `created_at` ascending. Each note has `subjective | objective | assessment | plan | status ("draft"|"approved"|"archived") | content`.
- `app/lib/repositories/profile.repository.ts` — `ProfileRepository.findByUserId(userId)` → `Result<Profile | null>`. `Profile.fullName` is `string | null`.
- `app/lib/israel-date.ts` — `formatIsraelDate(iso)` already used on the page; keep using it.
- `app/public/getavet-logo.png` — the full-color GetaVet dog mark used in the paper letterhead. Use this file (not the monochrome `logo-mark.svg` mask) so the page matches the branded paper documents.
- `Visit.clinicId` is already on the `visit` object fetched at the top of the page — no new lookup needed to get the clinic ID.

---

### Task 1: `formatPetAge` helper

**Files:**
- Create: `app/lib/pet-age.ts`
- Test: `app/tests/unit/pet-age.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// app/tests/unit/pet-age.test.ts
import { describe, expect, it } from "vitest";
import { formatPetAge } from "@/lib/pet-age";

describe("formatPetAge", () => {
  it("returns null when birthDate is null", () => {
    expect(formatPetAge(null, new Date("2026-09-07"))).toBeNull();
  });

  it("formats whole years and remaining months", () => {
    // Born 2023-08-07: exactly 3 years and 1 month before 2026-09-07.
    expect(formatPetAge("2023-08-07", new Date("2026-09-07"))).toBe("3 ש' 1 ח'");
  });

  it("formats less than a year as months only", () => {
    // Born 2026-06-07: 3 months before 2026-09-07.
    expect(formatPetAge("2026-06-07", new Date("2026-09-07"))).toBe("3 ח'");
  });

  it("formats a birth date in the current month as under a month old", () => {
    expect(formatPetAge("2026-09-01", new Date("2026-09-07"))).toBe("פחות מחודש");
  });

  it("formats whole years with no remaining months without a trailing 0 ח'", () => {
    expect(formatPetAge("2023-09-07", new Date("2026-09-07"))).toBe("3 ש'");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/unit/pet-age.test.ts`
Expected: FAIL — `Cannot find module '@/lib/pet-age'` (or similar resolution error), since the file doesn't exist yet.

- [ ] **Step 3: Write minimal implementation**

```typescript
// app/lib/pet-age.ts

/**
 * Formats a pet's age from its birth date, matching the "X ש' Y ח'" style
 * used on the clinic's paper documents. Returns null when there is no birth
 * date to compute from.
 */
export function formatPetAge(birthDate: string | null, now: Date = new Date()): string | null {
  if (!birthDate) return null;

  const birth = new Date(birthDate);
  let years = now.getFullYear() - birth.getFullYear();
  let months = now.getMonth() - birth.getMonth();

  if (now.getDate() < birth.getDate()) {
    months -= 1;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  if (years <= 0 && months <= 0) return "פחות מחודש";
  if (years <= 0) return `${months} ח'`;
  if (months === 0) return `${years} ש'`;
  return `${years} ש' ${months} ח'`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run tests/unit/pet-age.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add app/lib/pet-age.ts app/tests/unit/pet-age.test.ts
git commit -m "feat: add formatPetAge helper for visit-share page"
```

---

### Task 2: `selectVisitMedicalNote` helper

**Files:**
- Create: `app/lib/visit-medical-note.ts`
- Test: `app/tests/unit/visit-medical-note.test.ts`

**Why this exists:** `MedicalNoteRepository.listByVisit` returns every note for a visit (draft, approved, archived, addenda) ordered oldest-first. The share page needs one note to source its SOAP fields from: prefer the most recent **approved** note; if none is approved, fall back to the most recent note of any status; if there are no notes at all, return `null` so the page falls back to the visit's free-text summary.

- [ ] **Step 1: Write the failing test**

```typescript
// app/tests/unit/visit-medical-note.test.ts
import { describe, expect, it } from "vitest";
import { selectVisitMedicalNote } from "@/lib/visit-medical-note";
import type { MedicalNote } from "@/types/domain/medical-note";

function note(overrides: Partial<MedicalNote>): MedicalNote {
  return {
    id: "note-id",
    clinicId: "clinic-id",
    visitId: "visit-id",
    noteType: "soap_full",
    content: "",
    subjective: null,
    objective: null,
    assessment: null,
    plan: null,
    parentNoteId: null,
    status: "draft",
    approvedByUserId: null,
    approvedAt: null,
    version: 1,
    authorUserId: "user-id",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    deletedAt: null,
    ...overrides,
  };
}

describe("selectVisitMedicalNote", () => {
  it("returns null for an empty list", () => {
    expect(selectVisitMedicalNote([])).toBeNull();
  });

  it("prefers the most recent approved note over a later draft", () => {
    const approved = note({ id: "approved", status: "approved", createdAt: "2026-01-01T00:00:00.000Z" });
    const laterDraft = note({ id: "later-draft", status: "draft", createdAt: "2026-01-02T00:00:00.000Z" });
    expect(selectVisitMedicalNote([approved, laterDraft])?.id).toBe("approved");
  });

  it("picks the most recent approved note when there are several", () => {
    const older = note({ id: "older-approved", status: "approved", createdAt: "2026-01-01T00:00:00.000Z" });
    const newer = note({ id: "newer-approved", status: "approved", createdAt: "2026-01-03T00:00:00.000Z" });
    expect(selectVisitMedicalNote([older, newer])?.id).toBe("newer-approved");
  });

  it("falls back to the most recent note of any status when none is approved", () => {
    const older = note({ id: "older-draft", status: "draft", createdAt: "2026-01-01T00:00:00.000Z" });
    const newer = note({ id: "newer-draft", status: "draft", createdAt: "2026-01-02T00:00:00.000Z" });
    expect(selectVisitMedicalNote([older, newer])?.id).toBe("newer-draft");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/unit/visit-medical-note.test.ts`
Expected: FAIL — `Cannot find module '@/lib/visit-medical-note'`

- [ ] **Step 3: Write minimal implementation**

```typescript
// app/lib/visit-medical-note.ts
import type { MedicalNote } from "@/types/domain/medical-note";

/**
 * Picks the note to source a visit's SOAP fields from: the most recent
 * approved note, falling back to the most recent note of any status. Input
 * may be in any order. Returns null when there are no notes at all.
 */
export function selectVisitMedicalNote(notes: MedicalNote[]): MedicalNote | null {
  if (notes.length === 0) return null;

  const byNewestFirst = [...notes].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const newestApproved = byNewestFirst.find((n) => n.status === "approved");
  return newestApproved ?? byNewestFirst[0];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run tests/unit/visit-medical-note.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add app/lib/visit-medical-note.ts app/tests/unit/visit-medical-note.test.ts
git commit -m "feat: add selectVisitMedicalNote helper for visit-share page"
```

---

### Task 3: Rewrite the visit-share page

**Files:**
- Modify: `app/app/s/[token]/page.tsx` (full rewrite of the component body; imports and data-fetching section are extended, not replaced wholesale)

- [ ] **Step 1: Add the new imports and repository fetches**

Replace the top of the file (imports) with:

```tsx
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { VisitRepository } from "@/lib/repositories/visit.repository";
import { PrescriptionRepository } from "@/lib/repositories/prescription.repository";
import { PetRepository } from "@/lib/repositories/pet.repository";
import { CustomerRepository } from "@/lib/repositories/customer.repository";
import { VisitShareRepository } from "@/lib/repositories/visit-share.repository";
import { ClinicRepository } from "@/lib/repositories/clinic.repository";
import { MedicalNoteRepository } from "@/lib/repositories/medical-note.repository";
import { ProfileRepository } from "@/lib/repositories/profile.repository";
import { formatIsraelDate } from "@/lib/israel-date";
import { formatPetAge } from "@/lib/pet-age";
import { selectVisitMedicalNote } from "@/lib/visit-medical-note";
```

Then replace the body of `VisitSharePage` from the existing `Promise.all` block down to (but not including) the final `return` with:

```tsx
  const [petResult, customerResult, prescriptionsResult, clinicResult, medicalNotesResult] =
    await Promise.all([
      new PetRepository(admin).findById(visit.petId),
      new CustomerRepository(admin).findById(visit.customerId),
      new PrescriptionRepository(admin).listByVisit(visit.id),
      new ClinicRepository(admin).findById(visit.clinicId),
      new MedicalNoteRepository(admin).listByVisit(visit.id),
    ]);

  const pet = petResult.ok ? petResult.value : null;
  const customer = customerResult.ok ? customerResult.value : null;
  const prescriptions = prescriptionsResult.ok
    ? prescriptionsResult.value.filter((p) => p.status === "active")
    : [];
  const clinic = clinicResult.ok ? clinicResult.value : null;
  const medicalNote = medicalNotesResult.ok ? selectVisitMedicalNote(medicalNotesResult.value) : null;

  const vetProfileResult = visit.createdByUserId
    ? await new ProfileRepository(admin).findByUserId(visit.createdByUserId)
    : null;
  const vetName = vetProfileResult?.ok ? (vetProfileResult.value?.fullName ?? null) : null;

  const age = formatPetAge(pet?.birthDate ?? null);

  const soapSections = medicalNote
    ? {
        history: medicalNote.subjective,
        findings: medicalNote.objective,
        diagnosis: medicalNote.assessment,
        treatment: medicalNote.plan,
      }
    : null;
  const hasSoapContent =
    soapSections !== null &&
    (soapSections.history || soapSections.findings || soapSections.diagnosis || soapSections.treatment);
  const freeTextSummary = visit.aiVisitSummary ?? visit.manualVisitSummary;
```

- [ ] **Step 2: Run the typechecker to catch mistakes early**

Run: `cd app && npx tsc --noEmit`
Expected: no errors reported for the data-fetching section above (the file may still fail to compile if the old JSX below references variables you just removed, e.g. `petName`/`customerName`/`summary` — that's expected and gets fixed in the next steps).

- [ ] **Step 3: Replace `ExpiredNotice` with the plain-document error state**

```tsx
function ExpiredNotice() {
  return (
    <main dir="rtl" className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 bg-white p-6 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset, no Next Image optimization needed for a tiny error state */}
      <img src="/getavet-logo.png" alt="Get A Vet" className="h-12 w-auto" />
      <h1 className="text-lg font-semibold text-zinc-900">הקישור אינו זמין</h1>
      <p className="text-sm text-zinc-600">
        ייתכן שהקישור פג תוקף או בוטל. לפרטים, אנא פנו ישירות למרפאה.
      </p>
    </main>
  );
}
```

- [ ] **Step 4: Replace the final `return` with the document-style layout**

```tsx
  const clinicName = clinic?.name ?? "Get A Vet";
  const clinicAddress = clinic?.settings.contact.address ?? "";
  const clinicPhone = clinic?.settings.contact.whatsapp ?? "";
  const clinicEmail = clinic?.settings.contact.email ?? "";

  const animalInfoFields: Array<[string, string | null]> = [
    ["שם החיה", pet?.name ?? null],
    ["סוג", pet?.species ?? null],
    ["גזע", pet?.breed ?? null],
    ["מין", pet?.sex ?? null],
    ["גיל", age],
    ["שבב", pet?.chipNumber ?? null],
  ].filter(([, value]) => value !== null) as Array<[string, string]>;

  return (
    <main dir="rtl" className="mx-auto min-h-screen max-w-2xl bg-white p-6 text-zinc-900 print:p-0">
      <PrintButton />

      <header className="mb-5 flex items-start justify-between border-b border-zinc-300 pb-4">
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset */}
          <img src="/getavet-logo.png" alt={clinicName} className="h-14 w-auto" />
          <div className="text-sm text-zinc-700">
            <p className="text-base font-semibold text-zinc-900">{clinicName}</p>
            {clinicAddress ? <p>{clinicAddress}</p> : null}
            {clinicPhone ? <p>{clinicPhone}</p> : null}
            {clinicEmail ? <p>{clinicEmail}</p> : null}
          </div>
        </div>
        <div className="text-left text-sm text-zinc-700">
          {customer?.fullName ? <p>לקוח: {customer.fullName}</p> : null}
          <p>תאריך: {formatIsraelDate(visit.startedAt)}</p>
        </div>
      </header>

      {animalInfoFields.length > 0 ? (
        <table className="mb-5 w-full border-collapse text-sm">
          <thead>
            <tr>
              {animalInfoFields.map(([label]) => (
                <th key={label} className="border-b border-zinc-300 pb-1 text-right font-medium text-zinc-500">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {animalInfoFields.map(([label, value]) => (
                <td key={label} className="pt-1 font-medium text-zinc-900">
                  {value}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      ) : null}

      <section className="mb-5 space-y-3 border-b border-zinc-200 pb-4 text-sm">
        {vetName ? (
          <p>
            <span className="font-medium text-zinc-500">הרופא: </span>
            {vetName}
          </p>
        ) : null}

        {hasSoapContent ? (
          <>
            {soapSections?.history ? (
              <p>
                <span className="block font-medium text-zinc-500">היסטוריה/סיבת הביקור:</span>
                <span className="whitespace-pre-wrap text-zinc-800">{soapSections.history}</span>
              </p>
            ) : null}
            {soapSections?.findings ? (
              <p>
                <span className="block font-medium text-zinc-500">ממצאים ובדיקות:</span>
                <span className="whitespace-pre-wrap text-zinc-800">{soapSections.findings}</span>
              </p>
            ) : null}
            {soapSections?.diagnosis ? (
              <p>
                <span className="block font-medium text-zinc-500">אבחנה:</span>
                <span className="whitespace-pre-wrap text-zinc-800">{soapSections.diagnosis}</span>
              </p>
            ) : null}
            {soapSections?.treatment ? (
              <p>
                <span className="block font-medium text-zinc-500">הטיפול:</span>
                <span className="whitespace-pre-wrap text-zinc-800">{soapSections.treatment}</span>
              </p>
            ) : null}
          </>
        ) : freeTextSummary ? (
          <p>
            <span className="block font-medium text-zinc-500">סיכום הביקור:</span>
            <span className="whitespace-pre-wrap text-zinc-800">{freeTextSummary}</span>
          </p>
        ) : null}
      </section>

      {prescriptions.length > 0 ? (
        <section className="mb-5 text-sm">
          <h2 className="mb-2 font-medium text-zinc-500">מרשמים:</h2>
          <ul className="space-y-2">
            {prescriptions.map((rx) => (
              <li key={rx.id} className="border-b border-zinc-100 pb-2">
                <p className="font-semibold text-zinc-900">{rx.medicationName}</p>
                <p className="whitespace-pre-wrap text-zinc-800">{rx.instructions}</p>
                {rx.notes ? <p className="text-xs text-zinc-500">{rx.notes}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <footer className="mt-6 text-center text-xs text-zinc-400 print:mt-3">
        הודעה זו נשלחה ממרפאת {clinicName}. אין להשיב להודעה זו.
      </footer>
    </main>
  );
}
```

- [ ] **Step 5: Make the print button a Client Component boundary**

`VisitSharePage` is an async Server Component, and `onClick`/`window.print` require a Client Component. `PrintButton` was already referenced in Step 4's JSX — create the file it comes from:

Create `app/app/s/[token]/print-button.tsx`:

```tsx
"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="mb-4 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 print:hidden"
    >
      הורדת PDF
    </button>
  );
}
```

In `page.tsx`, add the import alongside the others from Step 1:

```tsx
import { PrintButton } from "./print-button";
```

- [ ] **Step 6: Run the full typecheck**

Run: `cd app && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Run the app's existing unit test suite**

Run: `cd app && npx vitest run`
Expected: all tests pass, including the two new files from Tasks 1–2. If any pre-existing test asserts on the old rounded-card markup or the old `ExpiredNotice` copy of this page, update that test's assertions to match the new markup (keep the assertions meaningful — check for the real text/labels that now appear, e.g. `"הורדת PDF"`, `"היסטוריה/סיבת הביקור"`) rather than deleting the test.

- [ ] **Step 8: Manual verification in the browser**

Run: `cd app && npm run dev`

1. In Supabase Studio (or via an existing seeded visit share), find a live `visit_shares.token` for a completed visit that has prescriptions and/or a medical note, and open `http://localhost:3001/s/<token>`.
2. Confirm: clinic logo, name, address, phone, email appear top-right (RTL first column); customer name + visit date appear top-left; the animal-info row shows the fields that exist for that pet; the visit section shows SOAP-labeled fields (or the free-text summary if the visit has no medical note); prescriptions list correctly.
3. Click "הורדת PDF" and confirm the browser print dialog opens with the button hidden in the preview and a clean, mostly-white page.
4. Open the page for a token pointing at a revoked/expired share (or an unknown token) and confirm the `ExpiredNotice` still renders with the branded logo.

- [ ] **Step 9: Commit**

```bash
git add app/app/s/\[token\]/page.tsx app/app/s/\[token\]/print-button.tsx
git commit -m "feat: restyle visit-share page to match GetaVet paper documents"
```

---

## Self-review notes (for whoever executes this plan)

- Step 1 of Task 3 removes the old `petName`/`customerName`/`summary` variables the current JSX reads — the typecheck in Step 2 will show errors in the (still-old) JSX until Steps 3–5 replace it. That's expected; don't stop to "fix" it before Step 5.
- `pet.sex` in the domain type is a free-text `string | null` (e.g. "ז/מ" per the sample documents) — it is rendered as-is, no enum mapping needed.
- `Clinic.settings.contact.whatsapp` is reused as the displayed "phone" line since there is no separate phone field in `ClinicContactInfo` — this mirrors what the clinic already edits in the dashboard settings page.
