# New Customer Creation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the ability to create a new customer from the dashboard — the only prior UI for this (`/dashboard/customers/new`) was deleted in the customer-360 plan because it was already dead/unreachable and pre-dated the design system; this rebuilds it properly as a modal on `/dashboard/clients`, matching the current design system.

**Architecture:** A new reusable `NewCustomerModal` component (using the existing `Modal`/`Btn`/`useToast` primitives, following the exact pattern already proven by `ApproveRejectModal` in `app/app/dashboard/page.tsx`) POSTs to the already-existing, already-validated `POST /api/customers` endpoint — no backend changes needed. Wired into `/dashboard/clients` via a new "לקוח חדש" button next to the page title, and refreshes the customer list on success.

**Tech Stack:** Next.js 16, TypeScript, existing `/api/customers` POST endpoint and `/api/me` (for `clinicId`), no new dependencies.

This is Plan 4 of the dashboard redesign (see `docs/superpowers/specs/2026-08-27-dashboard-crm-redesign-design.md`), following Plans 1-3 (visual+search, waitlist, customer 360), all already shipped to production.

---

## Before you start

`POST /api/customers` already exists and works (`app/app/api/customers/route.ts`) — it validates against `createCustomerSchema` (`app/lib/validators/customer.ts`): `clinicId` (uuid, required), `fullName` (2-120 chars, required), `phone`/`email`/`address`/`notes` (all optional), `preferredContactMethod`/`status` (optional enums). The service layer (`app/lib/services/customer.service.ts:40-43`) rejects any `clinicId` not in the actor's own clinics, so the client must supply a real `clinicId` it's actually a member of — get it from `GET /api/me` (`memberships[0].clinicId`), the same source `app/app/dashboard/layout.tsx` already uses.

Read `app/components/dashboard/ui/modal.tsx` (the reusable `Modal` component) and the `ApproveRejectModal` function in `app/app/dashboard/page.tsx` (lines ~176-238) before starting — this task's modal follows that exact structural pattern (local `useState` for loading, `useToast` for success/error feedback, `Btn` for actions), but should use the shared `Modal` component (`open`/`onClose`/`title` props) rather than hand-rolling the overlay/backdrop the way `ApproveRejectModal` does, since `Modal` already exists precisely for this.

---

### Task 1: New customer modal

**Files:**
- Create: `app/components/dashboard/new-customer-modal.tsx`
- Modify: `app/app/dashboard/clients/page.tsx`

- [ ] **Step 1: Create the modal component**

```tsx
// app/components/dashboard/new-customer-modal.tsx
"use client";
import React, { useState, FormEvent } from "react";
import { Modal } from "@/components/dashboard/ui/modal";
import { Btn } from "@/components/dashboard/ui/btn";
import { useToast } from "@/components/dashboard/ui/toast";
import type { Customer } from "@/types/domain/customer";

const inputClass =
  "w-full rounded-[var(--r-lg)] border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--faint)] focus:outline-none focus:border-[var(--brand-400)]";
const labelClass = "mb-1 block text-xs font-semibold text-[var(--ink-2)]";

interface NewCustomerModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (customer: Customer) => void;
}

export function NewCustomerModal({ open, onClose, onCreated }: NewCustomerModalProps) {
  const { toast } = useToast();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  function reset() {
    setFullName("");
    setPhone("");
    setEmail("");
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (fullName.trim().length < 2) {
      toast("שם מלא חייב להכיל לפחות 2 תווים", "error");
      return;
    }

    setLoading(true);
    try {
      const meRes = await fetch("/api/me");
      if (!meRes.ok) throw new Error();
      const me = (await meRes.json()) as { data: { memberships: { clinicId: string }[] } };
      const clinicId = me.data.memberships[0]?.clinicId;
      if (!clinicId) throw new Error();

      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clinicId,
          fullName: fullName.trim(),
          phone: phone.trim() || null,
          email: email.trim() || null,
        }),
      });
      if (!res.ok) throw new Error();

      const created = (await res.json()) as { data: Customer };
      toast("הלקוח נוסף בהצלחה", "success");
      reset();
      onCreated(created.data);
      onClose();
    } catch {
      toast("שגיאה בהוספת הלקוח", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="לקוח חדש" subtitle="הוספת לקוח ידנית לדשבורד">
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="fullName" className={labelClass}>שם מלא *</label>
          <input
            id="fullName"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className={inputClass}
            required
            minLength={2}
          />
        </div>
        <div>
          <label htmlFor="phone" className={labelClass}>טלפון</label>
          <input
            id="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={inputClass}
            dir="ltr"
          />
        </div>
        <div>
          <label htmlFor="email" className={labelClass}>אימייל</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            dir="ltr"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Btn type="button" variant="ghost" size="sm" onClick={onClose}>ביטול</Btn>
          <Btn type="submit" variant="primary" size="sm" loading={loading}>הוסף לקוח</Btn>
        </div>
      </form>
    </Modal>
  );
}
```

- [ ] **Step 2: Wire the modal into the clients page**

In `app/app/dashboard/clients/page.tsx`, import the new component:

```tsx
import { NewCustomerModal } from "@/components/dashboard/new-customer-modal";
```

Inside `export default function ClientsPage()`, add a state flag for the modal, next to the existing `selected`/`searching` state:

```tsx
  const [showNewCustomer, setShowNewCustomer] = useState(false);
```

In the header row (currently `<div className="flex items-center justify-between">` containing the "לקוחות" `<h1>` and the count `<span>`), add a button after the count span:

```tsx
        <Btn size="sm" onClick={() => setShowNewCustomer(true)}>לקוח חדש</Btn>
```

This needs the `Btn` import: `import { Btn } from "@/components/dashboard/ui/btn";` at the top.

At the end of the component's returned JSX, next to the existing `{selected && <ClientProfile .../>}` block, add:

```tsx
      <NewCustomerModal
        open={showNewCustomer}
        onClose={() => setShowNewCustomer(false)}
        onCreated={() => { void fetchData(query); }}
      />
```

- [ ] **Step 3: Run typecheck and the full test suite**

```bash
cd app && npm run typecheck && npm run test && npm run build
```

Expected: all pass/succeed.

- [ ] **Step 4: Drive the real UI to confirm the flow works end-to-end**

A dev server may already be running on port 3001 — check `lsof -i :3001` first. Log in (ask the controller for credentials — do not guess), go to `/dashboard/clients`, click "לקוח חדש", fill in a full name (e.g. a clearly-marked test name like "בדיקה אוטומטית"), submit, confirm a success toast appears, the modal closes, and the new customer appears in the list without a manual page refresh. Report DONE_WITH_CONCERNS if you cannot complete this — do not claim success without seeing it. If you do create a test customer this way, tell the controller its name so it can be identified/cleaned up later if needed — do not delete it yourself (no delete UI/API exists for customers in this codebase).

- [ ] **Step 5: Commit**

```bash
git add app/components/dashboard/new-customer-modal.tsx app/app/dashboard/clients/page.tsx
git commit -m "feat(dashboard): add new customer creation modal"
```

---

## Done criteria for this plan

- Clicking "לקוח חדש" on `/dashboard/clients` opens a modal matching the current design system.
- Submitting a valid name creates a real customer via the existing API, shows a success toast, and the new customer appears in the list immediately.
- Invalid/failed submissions show a clear error toast rather than failing silently.
- `npm run test`, `npm run typecheck`, and `npm run build` all pass in `app/`.
