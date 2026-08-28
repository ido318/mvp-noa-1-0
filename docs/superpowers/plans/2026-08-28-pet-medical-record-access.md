# Pet Medical Record Access from Customer Profile — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let staff go customer → pet → full medical record (the record page already exists and is complete — visit history, vaccinations, notes, "new visit" button — it's just unreachable from the customer profile drawer today), and let staff add a brand-new pet for a customer on the spot (walk-in scenario, no prior Tomer call).

**Architecture:** `/dashboard/pets/[petId]` already IS the medical record page — no new page needed. This plan (1) makes the pet cards already shown in the customer profile drawer clickable links to it, and (2) adds the one missing backend piece (`POST /api/pets` — the service/repository logic already exists, just no route exposes it) plus a small "הוסף חיה" modal on the customer profile, mirroring `NewCustomerModal` exactly.

**Tech Stack:** Next.js 16, TypeScript. No new dependencies, no migration — `createPetSchema`/`PetService.createPet`/`PetRepository.insert` already exist and are already tested.

This is Plan 6 of the dashboard work (see `docs/superpowers/specs/2026-08-27-dashboard-crm-redesign-design.md`), following Plans 1-5.

---

## Before you start

Read `app/app/dashboard/pets/[petId]/page.tsx` in full — confirm for yourself it already has everything a "medical record" needs (visit history with links to each visit's prescriptions/notes/AI summary via `/dashboard/visits/[id]`, vaccinations with due dates, a "+ ביקור חדש" button, an edit form). Read `app/components/dashboard/new-customer-modal.tsx` in full — this plan's new pet modal mirrors it almost exactly. Read `app/lib/services/pet.service.ts`'s `createPet` method and `app/lib/validators/pet.ts`'s `createPetSchema` — both already exist and are unit-tested; this plan only adds the missing route on top of them.

---

### Task 1: `POST /api/pets` route

**Files:**
- Modify: `app/app/api/pets/route.ts`
- Test: `app/tests/unit/phase2-api-routes.test.ts` (already tests `GET /api/pets` at line ~83 — add the new POST tests inside the same `describe("phase2 API routes", ...)` block, following its exact `import("@/app/api/pets/route")` + mocked-service pattern, don't create a separate file)

- [ ] **Step 1: Add the POST handler**

Append to `app/app/api/pets/route.ts` (keep the existing `GET` handler untouched):

```typescript
import { createPetSchema } from "@/lib/validators/pet";

export async function POST(request: Request) {
  const requestId = createRequestId();

  try {
    const { actor, pet } = await getActorAndServices();
    const body = parseOrThrow(createPetSchema, await request.json());
    const result = await pet.createPet(actor, body);
    if (!result.ok) return handleRouteError(result.error, requestId);
    return jsonSuccess(result.value, 201, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
```

Add the `createPetSchema` import at the top of the file alongside the existing imports (the file currently defines its own local `listPetsSchema` with `z` already imported — add `createPetSchema` as a named import from `@/lib/validators/pet` rather than redefining it).

- [ ] **Step 2: Write a test for the new route**

Follow the exact pattern of an existing POST-route test in this codebase (e.g. `app/tests/unit/` — find a test for `POST /api/customers` or similar and mirror its mocking/assertion style exactly). Cover: successful creation (201, correct body), and a validation failure (missing required `name`/`species` → 400).

- [ ] **Step 3: Run typecheck and the full test suite**

```bash
cd app && npm run typecheck && npm run test
```

- [ ] **Step 4: Commit**

```bash
git status --short
git add app/app/api/pets/route.ts app/tests/unit/phase2-api-routes.test.ts
git commit -m "feat(api): add POST /api/pets endpoint"
```

---

### Task 2: Make pet cards clickable + add "הוסף חיה" (Add Pet) modal

**Files:**
- Create: `app/components/dashboard/new-pet-modal.tsx`
- Modify: `app/app/dashboard/clients/page.tsx`

- [ ] **Step 1: Create the Add Pet modal**

Mirror `app/components/dashboard/new-customer-modal.tsx` almost exactly — same `Modal`/`Btn`/`useToast` structure, same `useEffect` reset-on-close pattern (that file already has the fix from Plan 4's code review — copy that pattern too, don't reintroduce the stale-form bug). Fields: name (required), species (required — use a simple `<select>` with common options `כלב`/`חתול`/`אחר`, matching how `AnimalAvatar`/`petMeta` elsewhere in this codebase already only special-case dog/cat), breed (optional text), sex (optional select: `זכר`/`נקבה`/ blank).

```tsx
// app/components/dashboard/new-pet-modal.tsx
"use client";
import React, { useState, useEffect, FormEvent } from "react";
import { Modal } from "@/components/dashboard/ui/modal";
import { Btn } from "@/components/dashboard/ui/btn";
import { useToast } from "@/components/dashboard/ui/toast";
import type { Pet } from "@/types/domain/pet";

const inputClass =
  "w-full rounded-[var(--r-lg)] border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--faint)] focus:outline-none focus:border-[var(--brand-400)]";
const labelClass = "mb-1 block text-xs font-semibold text-[var(--ink-2)]";

interface NewPetModalProps {
  open: boolean;
  onClose: () => void;
  customerId: string;
  clinicId: string;
  onCreated: (pet: Pet) => void;
}

export function NewPetModal({ open, onClose, customerId, clinicId, onCreated }: NewPetModalProps) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [species, setSpecies] = useState("כלב");
  const [breed, setBreed] = useState("");
  const [sex, setSex] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setName("");
      setSpecies("כלב");
      setBreed("");
      setSex("");
    }
  }, [open]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (name.trim().length < 1) {
      toast("שם החיה נדרש", "error");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/pets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clinicId,
          customerId,
          name: name.trim(),
          species,
          breed: breed.trim() || null,
          sex: sex || null,
        }),
      });
      if (!res.ok) throw new Error();

      const created = (await res.json()) as { data: Pet };
      toast("החיה נוספה בהצלחה", "success");
      onCreated(created.data);
      onClose();
    } catch {
      toast("שגיאה בהוספת החיה", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="הוספת חיית מחמד" subtitle="חיה חדשה ללקוח זה">
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="petName" className={labelClass}>שם החיה *</label>
          <input
            id="petName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            required
          />
        </div>
        <div>
          <label htmlFor="petSpecies" className={labelClass}>מין החיה *</label>
          <select
            id="petSpecies"
            value={species}
            onChange={(e) => setSpecies(e.target.value)}
            className={inputClass}
          >
            <option value="כלב">כלב</option>
            <option value="חתול">חתול</option>
            <option value="אחר">אחר</option>
          </select>
        </div>
        <div>
          <label htmlFor="petBreed" className={labelClass}>גזע</label>
          <input
            id="petBreed"
            value={breed}
            onChange={(e) => setBreed(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="petSex" className={labelClass}>זכר/נקבה</label>
          <select
            id="petSex"
            value={sex}
            onChange={(e) => setSex(e.target.value)}
            className={inputClass}
          >
            <option value="">לא צוין</option>
            <option value="male">זכר</option>
            <option value="female">נקבה</option>
          </select>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Btn type="button" variant="ghost" size="sm" onClick={onClose}>ביטול</Btn>
          <Btn type="submit" variant="primary" size="sm" loading={loading}>הוסף חיה</Btn>
        </div>
      </form>
    </Modal>
  );
}
```

Note: `clinicId` isn't currently a field on the `Customer` type available inside `ClientProfile` — check `app/types/domain/customer.ts`, it has `clinicId: string;` on `Customer` already, so `customer.clinicId` is available directly (no extra `/api/me` fetch needed here, unlike `NewCustomerModal` which had no customer object yet to read a clinicId from).

- [ ] **Step 2: Wire pet cards to link to the medical record page + add the "הוסף חיה" button**

In `app/app/dashboard/clients/page.tsx`'s `PetCard` component, wrap the existing `<Card>` content in a `Link` to `/dashboard/pets/${pet.id}` (matching how `ClientCard` already does `onClick`/navigation — but here use an actual `<Link>` since this should be a normal navigable link, not a client-state drawer). Add `import Link from "next/link";` if not already imported (it was added in Plan 3 — check first, don't duplicate the import).

```tsx
function PetCard({ pet }: { pet: Pet }) {
  const age = petAge(pet.birthDate);
  return (
    <Link href={`/dashboard/pets/${pet.id}`}>
      <Card className="transition hover:border-[var(--brand-300)] hover:shadow-[var(--sh-sm)]">
        {/* ...existing card content, unchanged... */}
      </Card>
    </Link>
  );
}
```

Then, in the "Pets" section header inside `ClientProfile` (currently just a label `חיות מחמד (N)`), add a small "+ הוסף חיה" trigger next to it, and render the new modal. Add state:

```tsx
  const [showNewPet, setShowNewPet] = useState(false);
```

Change the pets section header from:
```tsx
<p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
  חיות מחמד ({petsLoading ? "…" : pets.length})
</p>
```
to:
```tsx
<div className="mb-2 flex items-center justify-between">
  <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
    חיות מחמד ({petsLoading ? "…" : pets.length})
  </p>
  <button
    onClick={() => setShowNewPet(true)}
    className="text-xs font-semibold text-[var(--brand-600)] hover:underline"
  >
    + הוסף חיה
  </button>
</div>
```

And render the modal at the end of `ClientProfile`'s returned JSX, alongside the drawer's closing tags:
```tsx
      <NewPetModal
        open={showNewPet}
        onClose={() => setShowNewPet(false)}
        customerId={customer.id}
        clinicId={customer.clinicId}
        onCreated={(newPet) => setPets((prev) => [...prev, newPet])}
      />
```

Add the import: `import { NewPetModal } from "@/components/dashboard/new-pet-modal";`.

- [ ] **Step 3: Run typecheck, tests, and build**

```bash
cd app && npm run typecheck && npm run test && npm run build
```

- [ ] **Step 4: Drive the real UI to confirm the full flow**

Log in (ask the controller for credentials — do not guess). On `/dashboard/clients`, open a real customer with at least one pet, click the pet card, confirm it navigates to `/dashboard/pets/[petId]` and shows that pet's medical record (visit history, vaccinations, etc.). Go back, click "+ הוסף חיה", fill in a clearly-marked test pet name (e.g. "בדיקה - חיה חדשה"), submit, confirm a success toast and the new pet appears in the customer's pet list immediately. Report DONE_WITH_CONCERNS if you cannot verify this live — do not claim success without seeing it.

- [ ] **Step 5: Commit**

```bash
git status --short
git add app/components/dashboard/new-pet-modal.tsx app/app/dashboard/clients/page.tsx
git commit -m "feat(dashboard): make pet cards open the medical record, add pet creation"
```

---

## Done criteria for this plan

- Clicking any pet in a customer's profile opens that pet's full medical record page.
- "+ הוסף חיה" in the customer profile creates a real pet and it appears immediately, no page reload.
- The full walk-in flow works end to end: לקוח חדש (Plan 4) → הוסף חיה (this plan) → תיק רפואי נפתח מיד (this plan, links straight to the existing `/dashboard/pets/[petId]` which already supports "+ ביקור חדש").
- `npm run test`, `npm run typecheck`, and `npm run build` all pass in `app/`.
