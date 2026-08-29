# Figma Redesign Phase 3: Calendar + Appointment Flow — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the calendar's appointment blocks clickable (they currently do nothing), replace the broken single-page "new appointment" form (hardcodes the first customer/pet, no picker) with a real 5-step booking wizard, and fix a latent bug where the Today page's approve/reject flow always sends an empty phone number.

**Architecture:** One small backend fix (join+map `customers.phone` onto appointment rows, since neither the calendar nor plain appointments list currently selects it) feeds two new client components: `AppointmentDrawer` (opens on block click, reuses the extracted `ApproveRejectModal`) and `NewAppointmentWizard` (a 5-step `Modal`, replacing the deleted `appointments/new` page). Both are wired into the existing `calendar/page.tsx`; no new API routes are needed — `/api/calendar`, `/api/calendar/availability`, `/api/appointments/*`, `/api/customers*`, `/api/search` already cover everything.

**Tech Stack:** Next.js 16 (App Router), React, Tailwind v4 + CSS-var tokens, existing `Drawer`/`Modal`/`Btn`/`Badge`/`Card` primitives, Vitest for the two backend-logic tests.

**Spec:** [docs/superpowers/specs/2026-08-29-figma-phase3-calendar-appointments-design.md](../specs/2026-08-29-figma-phase3-calendar-appointments-design.md)

**Deliberately deferred (not a placeholder — a real scope cut, noted here so it isn't silently dropped):** Figma's drawer also shows an "ערוך תור" (edit) button for changing an existing appointment's date/type. This plan ships cancel/no-show + approve/reject + the two navigation links, but not full in-place editing — that's materially the wizard's steps 3-4 applied to an existing row, and is a reasonable follow-up rather than part of this phase.

---

### Task 1: Backend — select and map `customerPhone` onto appointment rows

**Files:**
- Modify: `app/types/domain/appointment.ts`
- Modify: `app/lib/repositories/appointment.repository.ts:34-38`
- Modify: `app/lib/repositories/mappers.ts:226-273` (`mapAppointmentRow`)
- Modify: `app/tests/unit/appointment-calendar-details.test.ts`

Today, `app/app/dashboard/page.tsx` casts appointments to `Appointment & { phone?: string | null }` and reads `.phone` to call the approve/reject SMS endpoints — but neither `AppointmentRepository.list()`'s Supabase select nor `mapAppointmentRow` ever populate it, so it's always `undefined` and the approve/reject calls silently send an empty phone. Fixing this properly (adding the field to the real type + repository + mapper) is needed for the new drawer's approve/reject anyway, so it's fixed once, here.

- [ ] **Step 1: Write the failing test**

In `app/tests/unit/appointment-calendar-details.test.ts`, extend the existing test file:

```ts
import { describe, expect, it } from "vitest";
import { mapAppointmentRow } from "@/lib/repositories/mappers";

const baseAppointmentRow = {
  id: "appointment-1",
  clinic_id: "clinic-1",
  customer_id: "customer-1",
  pet_id: "pet-1",
  appointment_type: "checkup" as const,
  status: "scheduled" as const,
  source: "phone" as const,
  scheduled_at: "2026-06-21T06:00:00.000Z",
  duration_minutes: 40,
  reason: "בדיקה כללית",
  notes: null,
  version: 0,
  cancelled_at: null,
  cancelled_by_user_id: null,
  cancellation_reason: null,
  created_by_user_id: null,
  created_at: "2026-06-20T20:00:00.000Z",
  updated_at: "2026-06-20T20:00:00.000Z",
  deleted_at: null,
};

describe("calendar appointment details", () => {
  it("maps joined customer and pet details for rich calendar blocks", () => {
    const appointment = mapAppointmentRow({
      ...baseAppointmentRow,
      customer: { full_name: "יעל ברקוביץ׳", phone: "+972501234567" },
      pet: { name: "לונה", species: "dog" },
    });

    expect(appointment.customerName).toBe("יעל ברקוביץ׳");
    expect(appointment.customerPhone).toBe("+972501234567");
    expect(appointment.petName).toBe("לונה");
    expect(appointment.petSpecies).toBe("dog");
  });

  it("defaults customerPhone to null when the customer join has no phone", () => {
    const appointment = mapAppointmentRow({
      ...baseAppointmentRow,
      customer: { full_name: "יעל ברקוביץ׳", phone: null },
      pet: { name: "לונה", species: "dog" },
    });

    expect(appointment.customerPhone).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/unit/appointment-calendar-details.test.ts`
Expected: FAIL — `customer: { full_name, phone }` doesn't match `mapAppointmentRow`'s current parameter type (`{ full_name: string | null }`), and `appointment.customerPhone` is `undefined`, not `"+972501234567"`.

- [ ] **Step 3: Add `customerPhone` to the domain type**

In `app/types/domain/appointment.ts`, in the `Appointment` type, add the field right after `customerName`:

```ts
  customerName?: string | null;
  customerPhone?: string | null;
  petName?: string | null;
```

- [ ] **Step 4: Select `phone` in the repository join**

In `app/lib/repositories/appointment.repository.ts`, change the `list()` method's select (currently at lines 34-38):

```ts
      .select(`
        *,
        customer:customers!appointments_customer_clinic_fk(full_name, phone),
        pet:pets!appointments_pet_clinic_fk(name, species)
      `)
```

- [ ] **Step 5: Map it in `mapAppointmentRow`**

In `app/lib/repositories/mappers.ts`, update the row parameter type and mapping (around lines 226-259):

```ts
export function mapAppointmentRow(row: {
  id: string;
  clinic_id: string;
  customer_id: string;
  pet_id: string;
  customer?: { full_name: string | null; phone?: string | null } | { full_name: string | null; phone?: string | null }[] | null;
  pet?: { name: string | null; species: string | null } | { name: string | null; species: string | null }[] | null;
  appointment_type: AppointmentType;
  status: AppointmentStatus;
  source: AppointmentSource;
  scheduled_at: string;
  duration_minutes: number;
  reason: string | null;
  notes: string | null;
  version: number;
  cancelled_at: string | null;
  cancelled_by_user_id: string | null;
  cancellation_reason: string | null;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}): Appointment {
  const customer = Array.isArray(row.customer) ? row.customer[0] : row.customer;
  const pet = Array.isArray(row.pet) ? row.pet[0] : row.pet;

  return {
    id: row.id,
    clinicId: row.clinic_id,
    customerId: row.customer_id,
    petId: row.pet_id,
    customerName: customer?.full_name ?? null,
    customerPhone: customer?.phone ?? null,
    petName: pet?.name ?? null,
    petSpecies: pet?.species ?? null,
    appointmentType: row.appointment_type,
    status: row.status,
    source: row.source,
    scheduledAt: row.scheduled_at,
    durationMinutes: row.duration_minutes,
    reason: row.reason,
    notes: row.notes,
    version: row.version,
    cancelledAt: row.cancelled_at,
    cancelledByUserId: row.cancelled_by_user_id,
    cancellationReason: row.cancellation_reason,
    createdByUserId: row.created_by_user_id,
```

(Leave the remaining `createdAt`/`updatedAt`/`deletedAt` lines below this untouched — only the lines shown above change.)

- [ ] **Step 6: Run test to verify it passes**

Run: `cd app && npx vitest run tests/unit/appointment-calendar-details.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 7: Commit**

```bash
cd /Users/idoamsalem/mvp-noa-1-0
git add app/types/domain/appointment.ts app/lib/repositories/appointment.repository.ts app/lib/repositories/mappers.ts app/tests/unit/appointment-calendar-details.test.ts
git commit -m "$(cat <<'EOF'
fix: select and map customer phone onto appointment rows

The Today page's approve/reject flow has been calling
/api/appointments/:id/approve|reject with an always-empty phone
(DashboardAppointment.phone was never actually populated by any
endpoint). Joins customers.phone in AppointmentRepository.list() and
maps it to the new Appointment.customerPhone field, so both the
existing Today flow and the new appointment drawer (next commit) have
a real phone number to send the confirmation SMS to.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Extract `ApproveRejectModal` to a shared component

**Files:**
- Create: `app/components/dashboard/approve-reject-modal.tsx`
- Modify: `app/app/dashboard/page.tsx`

- [ ] **Step 1: Create the shared component**

Create `app/components/dashboard/approve-reject-modal.tsx`:

```tsx
"use client";
import React, { useState } from "react";
import { Btn } from "@/components/dashboard/ui/btn";
import { useToast } from "@/components/dashboard/ui/toast";

export function ApproveRejectModal({
  mode,
  appointmentId,
  phone,
  customerName,
  petName,
  onConfirm,
  onClose,
}: {
  mode: "approve" | "reject";
  appointmentId: string;
  phone: string;
  customerName: string;
  petName: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  async function handleConfirm() {
    setLoading(true);
    try {
      const res = await fetch(`/api/appointments/${appointmentId}/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, customerName, petName }),
      });
      if (!res.ok) throw new Error();
      toast(mode === "approve" ? "התור אושר ונשלח SMS ללקוח" : "התור נדחה ונשלח SMS ללקוח", "success");
      onConfirm();
    } catch {
      toast("שגיאה בעדכון התור", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-[var(--r-xl)] bg-[var(--surface)] p-6 shadow-[var(--sh-lg)] modal-enter"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="text-[15px] font-bold text-[var(--ink)]">
          {mode === "approve" ? "אישור תור עיקור/סירוס" : "דחיית תור עיקור/סירוס"}
        </h3>
        <p className="mt-2 text-sm text-[var(--ink-2)]">
          {mode === "approve"
            ? `האם לאשר את תורו של ${petName}? לאחר האישור ישלח SMS ל-${customerName}.`
            : `האם לדחות את תורו של ${petName}? לאחר הדחייה ישלח SMS ביטול ל-${customerName}.`}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Btn variant="ghost" size="sm" onClick={onClose}>ביטול</Btn>
          <Btn
            variant={mode === "approve" ? "primary" : "danger"}
            size="sm"
            loading={loading}
            onClick={handleConfirm}
          >
            {mode === "approve" ? "אשר תור" : "דחה תור"}
          </Btn>
        </div>
      </div>
    </div>
  );
}
```

This is a verbatim move of the existing `ApproveRejectModal` from `app/app/dashboard/page.tsx` (just now exported from its own file) — no behavior change in this step.

- [ ] **Step 2: Update `dashboard/page.tsx` to import it and use the real phone field**

In `app/app/dashboard/page.tsx`:

1. Delete the entire local `function ApproveRejectModal(...) { ... }` block (lines 27-93).
2. Add the import, alongside the other component imports:

```tsx
import { ApproveRejectModal } from "@/components/dashboard/approve-reject-modal";
```

3. Delete the now-unused local type `type DashboardAppointment = Appointment & { phone?: string | null };` (line 21) and replace every `DashboardAppointment` reference in the file with `Appointment` (there are 3: the `appointments` state type, the `modal` state type, and the API response cast type) — since `Appointment` now has `customerPhone` for real, the local alias is no longer needed.
4. In the JSX where `ApproveRejectModal` is rendered, change `phone={modal.appt.phone ?? ""}` to `phone={modal.appt.customerPhone ?? ""}`.

- [ ] **Step 3: Run typecheck**

Run: `cd app && npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Run the test suite**

Run: `cd app && npm run test`
Expected: all tests pass (137 total after Task 1's 2 new tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/idoamsalem/mvp-noa-1-0
git add app/components/dashboard/approve-reject-modal.tsx app/app/dashboard/page.tsx
git commit -m "$(cat <<'EOF'
refactor: extract ApproveRejectModal to a shared component

Moves it out of dashboard/page.tsx so the new appointment-detail
drawer (calendar redesign) can reuse the same approve/reject flow
instead of building a second one. Also switches from the fictional
DashboardAppointment.phone to the now-real Appointment.customerPhone.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Calendar — reconcile visit labels to the single source of truth

**Files:**
- Modify: `app/app/dashboard/calendar/page.tsx`

- [ ] **Step 1: Remove the duplicate label map, keep only colors**

In `app/app/dashboard/calendar/page.tsx`, delete the `VISIT_LABELS` map (lines 90-102) and the `visitLabel` function (lines 130-132). Add this import at the top of the file, alongside the existing `appointment-rules` import:

```ts
import { toIsraelLocalIso, VISIT_TYPE_CONFIG } from "@/lib/appointment-rules";
```

Then add a small local wrapper right where `visitLabel` used to be (keeps every call site — `ApptBlock`, `CALENDAR_LEGEND`-style usages — unchanged):

```ts
function visitLabel(type: string) {
  return VISIT_TYPE_CONFIG[type as keyof typeof VISIT_TYPE_CONFIG]?.labelHe ?? type;
}
```

`VISIT_ACCENTS` (the color map) stays exactly as-is — it's a presentation-only concern `VISIT_TYPE_CONFIG` doesn't own, so there's no duplication to remove there.

- [ ] **Step 2: Run typecheck**

Run: `cd app && npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/idoamsalem/mvp-noa-1-0
git add app/app/dashboard/calendar/page.tsx
git commit -m "$(cat <<'EOF'
refactor: calendar page uses VISIT_TYPE_CONFIG as its label source

Removes the page's own parallel VISIT_LABELS map (checkup -> "בדיקה"
etc.) in favor of the shared VISIT_TYPE_CONFIG.labelHe already used by
the booking form - one less place to update when a visit type's label
changes.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Add a 14-day booking window helper (used by the wizard's date step)

**Files:**
- Modify: `app/lib/appointment-rules.ts`
- Create: `app/tests/unit/appointment-rules.test.ts`

The binding 14-day booking window rule (root `CLAUDE.md`: "חלון קביעה: 14 יום קדימה בלבד") is already enforced by the agent side (`agent/lib/appointments.ts`'s `isWithin14Days`) but has no app-side equivalent — needed so the new wizard's date step can't let staff pick a date more than 14 days out.

- [ ] **Step 1: Write the failing test**

Create `app/tests/unit/appointment-rules.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getBookableDates } from "@/lib/appointment-rules";

describe("getBookableDates", () => {
  it("returns exactly 14 consecutive ISO dates starting today", () => {
    const dates = getBookableDates("2026-08-29");

    expect(dates).toHaveLength(14);
    expect(dates[0]).toBe("2026-08-29");
    expect(dates[13]).toBe("2026-09-11");
  });

  it("crosses a month boundary correctly", () => {
    const dates = getBookableDates("2026-08-20");

    expect(dates[0]).toBe("2026-08-20");
    expect(dates.at(-1)).toBe("2026-09-02");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/unit/appointment-rules.test.ts`
Expected: FAIL — `getBookableDates` is not exported from `@/lib/appointment-rules`.

- [ ] **Step 3: Add the helper**

In `app/lib/appointment-rules.ts`, add near the other exported functions (after `getClinicHoursForDate`):

```ts
export const BOOKING_WINDOW_DAYS = 14;

export function getBookableDates(fromDate: string): string[] {
  const [year, month, day] = fromDate.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, day));
  return Array.from({ length: BOOKING_WINDOW_DAYS }, (_, i) => {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run tests/unit/appointment-rules.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
cd /Users/idoamsalem/mvp-noa-1-0
git add app/lib/appointment-rules.ts app/tests/unit/appointment-rules.test.ts
git commit -m "$(cat <<'EOF'
feat: add getBookableDates helper for the 14-day booking window

App-side equivalent of the agent's isWithin14Days - needed so the new
booking wizard's date picker can't offer a date beyond the binding
14-day-ahead rule (CLAUDE.md, decided 2026-06-11).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Appointment-detail drawer

**Files:**
- Create: `app/app/dashboard/calendar/appointment-drawer.tsx`
- Modify: `app/app/dashboard/calendar/page.tsx`

- [ ] **Step 1: Create the drawer component**

Create `app/app/dashboard/calendar/appointment-drawer.tsx`:

```tsx
"use client";
import React, { useState } from "react";
import Link from "next/link";
import { Drawer } from "@/components/dashboard/ui/drawer";
import { Badge } from "@/components/dashboard/ui/badge";
import { Btn } from "@/components/dashboard/ui/btn";
import { AnimalIcon } from "@/components/dashboard/icons";
import { ApproveRejectModal } from "@/components/dashboard/approve-reject-modal";
import { useToast } from "@/components/dashboard/ui/toast";
import { VISIT_TYPE_CONFIG } from "@/lib/appointment-rules";
import { formatIsraelDateTime } from "@/lib/israel-date";
import type { Appointment } from "@/types/domain/appointment";

function visitLabel(type: string) {
  return VISIT_TYPE_CONFIG[type as keyof typeof VISIT_TYPE_CONFIG]?.labelHe ?? type;
}

const STATUS_LABEL: Record<string, string> = {
  scheduled: "מתוכנן",
  confirmed: "מאושר",
  completed: "הושלם",
  cancelled: "בוטל",
  no_show: "לא הגיע",
  pending_approval: "ממתין לאישור",
  late_cancellation: "ביטול מאוחר",
};

export function AppointmentDrawer({
  appointment,
  onClose,
  onChanged,
}: {
  appointment: Appointment | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [approveRejectMode, setApproveRejectMode] = useState<"approve" | "reject" | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState<"cancelled" | "no_show" | null>(null);
  const [savingStatus, setSavingStatus] = useState(false);
  const { toast } = useToast();

  async function applyStatus(status: "cancelled" | "no_show") {
    if (!appointment) return;
    setSavingStatus(true);
    try {
      const res = await fetch(`/api/appointments/${appointment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: appointment.version, status }),
      });
      if (!res.ok) throw new Error();
      toast(status === "cancelled" ? "התור בוטל" : "התור סומן כלא הגיע", "success");
      setConfirmingCancel(null);
      onChanged();
      onClose();
    } catch {
      toast("עדכון התור נכשל", "error");
    } finally {
      setSavingStatus(false);
    }
  }

  return (
    <>
      <Drawer open={appointment != null} onClose={onClose} title={appointment?.petName ?? undefined} width={420}>
        {appointment && (
          <div className="space-y-5 p-6">
            <div className="flex items-center gap-3">
              <AnimalIcon species={appointment.petSpecies ?? "dog"} size={28} />
              <div className="min-w-0">
                <p className="truncate text-[16px] font-extrabold text-[var(--ink)]">{appointment.petName ?? "חיה"}</p>
                <p className="truncate text-[13px] text-[var(--muted)]">{appointment.customerName ?? "לקוח"}</p>
              </div>
              <Badge color={appointment.status === "pending_approval" ? "amber" : "muted"} className="ms-auto">
                {STATUS_LABEL[appointment.status] ?? appointment.status}
              </Badge>
            </div>

            <dl className="space-y-2 text-[13px]">
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--muted)]">סוג תור</dt>
                <dd className="font-semibold text-[var(--ink)]">{visitLabel(appointment.appointmentType)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--muted)]">מועד</dt>
                <dd className="font-semibold text-[var(--ink)]">{formatIsraelDateTime(appointment.scheduledAt)}</dd>
              </div>
              {appointment.reason && (
                <div className="flex justify-between gap-3">
                  <dt className="text-[var(--muted)]">סיבה</dt>
                  <dd className="font-semibold text-[var(--ink)]">{appointment.reason}</dd>
                </div>
              )}
              {appointment.notes && (
                <div className="flex justify-between gap-3">
                  <dt className="text-[var(--muted)]">הערות</dt>
                  <dd className="font-semibold text-[var(--ink)]">{appointment.notes}</dd>
                </div>
              )}
            </dl>

            <div className="flex flex-col gap-2 border-t border-[var(--line-2)] pt-4">
              <Link href={`/dashboard/pets/${appointment.petId}`} className="text-[13px] font-semibold text-[var(--brand-600)] hover:underline">
                פתח כרטיס מטופל ←
              </Link>
              {(appointment.status === "confirmed" || appointment.status === "completed") && (
                <Link
                  href={`/dashboard/visits/new?appointmentId=${appointment.id}`}
                  className="text-[13px] font-semibold text-[var(--brand-600)] hover:underline"
                >
                  התחל ביקור ←
                </Link>
              )}
            </div>

            {appointment.status === "pending_approval" ? (
              <div className="flex gap-2 border-t border-[var(--line-2)] pt-4">
                <Btn variant="soft" onClick={() => setApproveRejectMode("approve")}>אשר תור</Btn>
                <Btn variant="dangerSoft" onClick={() => setApproveRejectMode("reject")}>דחה תור</Btn>
              </div>
            ) : appointment.status !== "cancelled" && appointment.status !== "no_show" ? (
              confirmingCancel ? (
                <div className="space-y-2 border-t border-[var(--line-2)] pt-4">
                  <p className="text-[13px] font-semibold text-[var(--ink)]">
                    {confirmingCancel === "cancelled" ? "לבטל את התור?" : "לסמן כלא הגיע?"}
                  </p>
                  <div className="flex gap-2">
                    <Btn variant="ghost" size="sm" onClick={() => setConfirmingCancel(null)}>חזרה</Btn>
                    <Btn variant="danger" size="sm" loading={savingStatus} onClick={() => applyStatus(confirmingCancel)}>
                      כן, אישור
                    </Btn>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2 border-t border-[var(--line-2)] pt-4">
                  <Btn variant="dangerSoft" size="sm" onClick={() => setConfirmingCancel("cancelled")}>ביטול תור</Btn>
                  <Btn variant="dangerSoft" size="sm" onClick={() => setConfirmingCancel("no_show")}>סימון כלא הגיע</Btn>
                </div>
              )
            ) : null}
          </div>
        )}
      </Drawer>

      {appointment && approveRejectMode && (
        <ApproveRejectModal
          mode={approveRejectMode}
          appointmentId={appointment.id}
          phone={appointment.customerPhone ?? ""}
          customerName={appointment.customerName ?? ""}
          petName={appointment.petName ?? ""}
          onConfirm={() => {
            setApproveRejectMode(null);
            onChanged();
            onClose();
          }}
          onClose={() => setApproveRejectMode(null)}
        />
      )}
    </>
  );
}
```

- [ ] **Step 2: Wire it into the calendar page**

In `app/app/dashboard/calendar/page.tsx`:

1. Add the import:

```tsx
import { AppointmentDrawer } from "@/app/dashboard/calendar/appointment-drawer";
```

2. Add state for the selected appointment, right after the existing `calendarError` state:

```tsx
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
```

3. Give `ApptBlock` a click handler. Change its signature and root element:

```tsx
function ApptBlock({ appt, onClick }: { appt: Appointment; onClick: () => void }) {
  const top  = topPx(appt.scheduledAt);
  const h    = heightPx(appt.durationMinutes);
  const accent = appointmentAccent(appt.appointmentType, appt.status);
  const petName = appt.petName ?? "חיה";
  const customerName = appt.customerName ?? "לקוח";
  const title = `${petName} · ${customerName} · ${visitLabel(appt.appointmentType)}`;

  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute inset-x-3 z-10 overflow-hidden rounded-[12px] border px-3 py-2.5 text-start text-[12px] shadow-[0_10px_22px_rgba(31,41,51,0.10)] transition-transform hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(31,41,51,0.16)]"
      style={{
        top: `${top}px`,
        height: `${Math.max(h, 72)}px`,
        borderColor: accent.border,
        backgroundColor: accent.bg,
        color: accent.text,
        minHeight: "72px",
      }}
      title={title}
    >
```

(Keep the rest of the JSX body identical — only the wrapping element changes from `<div ...>` to `<button type="button" onClick={onClick} ...>`, and its closing tag from `</div>` to `</button>`.)

4. `DayColumn` needs to pass the click handler through. Update its props and the `appointments.map` call:

```tsx
function DayColumn({
  day,
  appointments,
  blocks,
  isToday,
  onDeleteBlock,
  onSelectAppointment,
}: {
  day: Date;
  appointments: Appointment[];
  blocks: CalendarBlock[];
  isToday: boolean;
  onDeleteBlock: (blockId: string) => void;
  onSelectAppointment: (appt: Appointment) => void;
}) {
```

and further down:

```tsx
      {appointments.map(appt => (
        <ApptBlock key={appt.id} appt={appt} onClick={() => onSelectAppointment(appt)} />
      ))}
```

5. Pass it down from the main render (in the `weekDays.map` that renders `DayColumn`):

```tsx
                <DayColumn
                  key={i}
                  day={day}
                  appointments={apptForDay(day)}
                  blocks={blocksForDay(day)}
                  isToday={isoOfDate(day) === today}
                  onDeleteBlock={deleteBlock}
                  onSelectAppointment={setSelectedAppointment}
                />
```

6. Render the drawer at the end of the page, just before the final closing `</div></div>`:

```tsx
      <AppointmentDrawer
        appointment={selectedAppointment}
        onClose={() => setSelectedAppointment(null)}
        onChanged={() => void fetchData()}
      />
```

7. Update the header hint text, which currently promises functionality that (as of this task) actually exists — no change needed, it already reads "בחרו תור כדי לשנות מועד" ("select an appointment to change its time"), which is now true for the cancel/no-show/approve/reject part (full time-change is the deferred "edit" feature noted at the top of this plan) — leave the copy as-is.

- [ ] **Step 3: Run typecheck**

Run: `cd app && npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Manual browser verification**

Start the app against local Supabase (see Task 7's setup) and confirm: clicking an appointment block opens the drawer with correct details; a `pending_approval` appointment shows approve/reject buttons that open the existing confirmation modal; a normal appointment shows the cancel/no-show flow and updates the block after confirming; the "פתח כרטיס מטופל" link navigates to the pet page.

- [ ] **Step 5: Commit**

```bash
cd /Users/idoamsalem/mvp-noa-1-0
git add app/app/dashboard/calendar/appointment-drawer.tsx app/app/dashboard/calendar/page.tsx
git commit -m "$(cat <<'EOF'
feat: clicking a calendar appointment opens a detail drawer

Appointment blocks had no click handler at all despite the page's own
hint text promising it. Adds AppointmentDrawer: shows appointment
details, reuses the shared ApproveRejectModal for pending_approval
(neutering) appointments, and adds cancel/no-show actions with no
4-hour late-cancellation penalty (that rule only applies to
customer-initiated phone cancellations through Tomer).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: New-appointment wizard, replacing the broken single-page form

**Files:**
- Create: `app/app/dashboard/calendar/new-appointment-wizard.tsx`
- Modify: `app/app/dashboard/calendar/page.tsx`
- Modify: `app/app/dashboard/today-dashboard-sections.tsx`
- Modify: `app/app/dashboard/appointments/page.tsx`
- Delete: `app/app/dashboard/appointments/new/page.tsx`
- Delete: `app/app/dashboard/appointments/appointment-form.tsx`

- [ ] **Step 1: Create the wizard component**

Create `app/app/dashboard/calendar/new-appointment-wizard.tsx`:

```tsx
"use client";
import React, { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/dashboard/ui/modal";
import { Btn } from "@/components/dashboard/ui/btn";
import { AnimalIcon } from "@/components/dashboard/icons";
import { useToast } from "@/components/dashboard/ui/toast";
import { VISIT_TYPE_CONFIG, effectiveDuration, getBookableDates } from "@/lib/appointment-rules";
import { formatIsraelDate, formatIsraelTime } from "@/lib/israel-date";
import type { AppointmentType } from "@/types/domain/appointment";
import type { Customer } from "@/types/domain/customer";
import type { Pet } from "@/types/domain/pet";

type Step = 1 | 2 | 3 | 4 | 5;

const VISIT_TYPES = Object.keys(VISIT_TYPE_CONFIG) as AppointmentType[];

export function NewAppointmentWizard({
  open,
  onClose,
  clinicId,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  clinicId: string;
  onCreated: () => void;
}) {
  const [step, setStep] = useState<Step>(1);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [pets, setPets] = useState<Pet[]>([]);
  const [pet, setPet] = useState<Pet | null>(null);
  const [visitType, setVisitType] = useState<AppointmentType>("checkup");
  const [date, setDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<string[]>([]);
  const [slot, setSlot] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const bookableDates = useMemo(() => getBookableDates(new Date().toISOString().slice(0, 10)), []);

  useEffect(() => {
    if (!open) {
      setStep(1);
      setCustomerQuery("");
      setCustomerResults([]);
      setCustomer(null);
      setPets([]);
      setPet(null);
      setVisitType("checkup");
      setDate(null);
      setSlots([]);
      setSlot(null);
      setReason("");
    }
  }, [open]);

  useEffect(() => {
    const trimmed = customerQuery.trim();
    if (trimmed.length < 2) { setCustomerResults([]); return; }
    const t = setTimeout(() => {
      void (async () => {
        const res = await fetch(`/api/search?entity=customers&q=${encodeURIComponent(trimmed)}`);
        if (!res.ok) return;
        const data = await res.json() as { data: { customers: Customer[] } };
        setCustomerResults(data.data.customers);
      })();
    }, 300);
    return () => clearTimeout(t);
  }, [customerQuery]);

  useEffect(() => {
    if (!customer) { setPets([]); return; }
    void (async () => {
      const res = await fetch(`/api/customers/${customer.id}/pets`);
      if (!res.ok) return;
      const data = await res.json() as { data: { items: Pet[] } };
      setPets(data.data.items);
    })();
  }, [customer]);

  useEffect(() => {
    if (!date) { setSlots([]); return; }
    setSlot(null);
    void (async () => {
      const res = await fetch(
        `/api/calendar/availability?clinicId=${encodeURIComponent(clinicId)}&date=${encodeURIComponent(date)}&visitType=${encodeURIComponent(visitType)}`,
      );
      if (!res.ok) { setSlots([]); return; }
      const data = await res.json() as { data: { availableSlots: string[] } };
      setSlots(data.data.availableSlots);
    })();
  }, [date, visitType, clinicId]);

  async function submit() {
    if (!customer || !pet || !slot) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clinicId,
          customerId: customer.id,
          petId: pet.id,
          appointmentType: visitType,
          source: "front_desk",
          scheduledAt: slot,
          durationMinutes: effectiveDuration(visitType),
          reason: reason.trim() || null,
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null) as { error?: { message?: string } } | null;
        throw new Error(payload?.error?.message ?? "קביעת התור נכשלה");
      }
      toast("התור נקבע בהצלחה", "success");
      onCreated();
      onClose();
    } catch (error) {
      toast(error instanceof Error ? error.message : "קביעת התור נכשלה", "error");
    } finally {
      setSubmitting(false);
    }
  }

  const STEP_TITLES: Record<Step, string> = {
    1: "בחירת לקוח",
    2: "בחירת מטופל",
    3: "סוג תור",
    4: "מועד ותאריך",
    5: "אישור",
  };

  const canAdvance =
    (step === 1 && customer != null) ||
    (step === 2 && pet != null) ||
    (step === 3 && visitType != null) ||
    (step === 4 && slot != null) ||
    step === 5;

  return (
    <Modal open={open} onClose={onClose} title="תור חדש" subtitle={`שלב ${step} מתוך 5 · ${STEP_TITLES[step]}`} maxWidth={480}>
      <div className="space-y-4">
        {step === 1 && (
          <div className="space-y-2">
            <input
              autoFocus
              type="search"
              placeholder="חיפוש לפי שם או טלפון..."
              value={customerQuery}
              onChange={(e) => setCustomerQuery(e.target.value)}
              className="h-10 w-full rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--bg)] px-3 text-sm outline-none focus:border-[var(--brand-400)]"
            />
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {customerResults.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCustomer(c)}
                  className={[
                    "flex w-full items-center justify-between rounded-[var(--r-md)] border px-3 py-2 text-start text-sm transition-colors",
                    customer?.id === c.id
                      ? "border-[var(--brand-400)] bg-[var(--brand-50)]"
                      : "border-[var(--line)] hover:bg-[var(--surface-2)]",
                  ].join(" ")}
                >
                  <span className="font-semibold text-[var(--ink)]">{c.fullName}</span>
                  <span className="text-[var(--muted)]">{c.phone ?? c.email ?? ""}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-1">
            {pets.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">ללקוח זה אין מטופלים רשומים.</p>
            ) : pets.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPet(p)}
                className={[
                  "flex w-full items-center gap-3 rounded-[var(--r-md)] border px-3 py-2.5 text-start text-sm transition-colors",
                  pet?.id === p.id
                    ? "border-[var(--brand-400)] bg-[var(--brand-50)]"
                    : "border-[var(--line)] hover:bg-[var(--surface-2)]",
                ].join(" ")}
              >
                <AnimalIcon species={p.species} size={20} />
                <span className="font-semibold text-[var(--ink)]">{p.name}</span>
                <span className="text-[var(--muted)]">{p.breed ?? p.species}</span>
              </button>
            ))}
          </div>
        )}

        {step === 3 && (
          <div className="grid grid-cols-2 gap-2">
            {VISIT_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setVisitType(type)}
                className={[
                  "rounded-[var(--r-md)] border px-3 py-2.5 text-start text-sm transition-colors",
                  visitType === type
                    ? "border-[var(--brand-400)] bg-[var(--brand-50)]"
                    : "border-[var(--line)] hover:bg-[var(--surface-2)]",
                ].join(" ")}
              >
                <p className="font-semibold text-[var(--ink)]">{VISIT_TYPE_CONFIG[type].labelHe}</p>
                <p className="text-[var(--muted)]">{VISIT_TYPE_CONFIG[type].durationMin} דק'</p>
              </button>
            ))}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {bookableDates.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDate(d)}
                  className={[
                    "rounded-[var(--r-md)] border px-2.5 py-1.5 text-xs font-semibold transition-colors",
                    date === d
                      ? "border-[var(--brand-400)] bg-[var(--brand-50)] text-[var(--brand-700)]"
                      : "border-[var(--line)] text-[var(--ink-2)] hover:bg-[var(--surface-2)]",
                  ].join(" ")}
                >
                  {formatIsraelDate(d)}
                </button>
              ))}
            </div>
            {date && (
              <div className="flex flex-wrap gap-1.5">
                {slots.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">אין תורים פנויים בתאריך זה.</p>
                ) : slots.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSlot(s)}
                    className={[
                      "rounded-[var(--r-md)] border px-3 py-1.5 text-sm font-semibold transition-colors",
                      slot === s
                        ? "border-[var(--brand-400)] bg-[var(--brand-50)] text-[var(--brand-700)]"
                        : "border-[var(--line)] text-[var(--ink-2)] hover:bg-[var(--surface-2)]",
                    ].join(" ")}
                  >
                    {formatIsraelTime(s)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 5 && customer && pet && slot && (
          <div className="space-y-3">
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between"><dt className="text-[var(--muted)]">לקוח</dt><dd className="font-semibold text-[var(--ink)]">{customer.fullName}</dd></div>
              <div className="flex justify-between"><dt className="text-[var(--muted)]">מטופל</dt><dd className="font-semibold text-[var(--ink)]">{pet.name}</dd></div>
              <div className="flex justify-between"><dt className="text-[var(--muted)]">סוג תור</dt><dd className="font-semibold text-[var(--ink)]">{VISIT_TYPE_CONFIG[visitType].labelHe}</dd></div>
              <div className="flex justify-between"><dt className="text-[var(--muted)]">מועד</dt><dd className="font-semibold text-[var(--ink)]">{formatIsraelDate(slot)} {formatIsraelTime(slot)}</dd></div>
            </dl>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="סיבת הביקור (אופציונלי)"
              rows={2}
              className="w-full rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm outline-none focus:border-[var(--brand-400)]"
            />
          </div>
        )}

        <div className="flex justify-between border-t border-[var(--line-2)] pt-4">
          <Btn variant="ghost" size="sm" onClick={() => (step === 1 ? onClose() : setStep((s) => (s - 1) as Step))}>
            {step === 1 ? "ביטול" : "חזרה"}
          </Btn>
          {step === 5 ? (
            <Btn size="sm" loading={submitting} onClick={submit}>קביעת תור</Btn>
          ) : (
            <Btn size="sm" disabled={!canAdvance} onClick={() => setStep((s) => (s + 1) as Step)}>הבא</Btn>
          )}
        </div>
      </div>
    </Modal>
  );
}
```

- [ ] **Step 2: Wire the wizard into the calendar page and support `?newAppointment=1`**

In `app/app/dashboard/calendar/page.tsx`:

1. Add imports:

```tsx
import { useSearchParams } from "next/navigation";
import { NewAppointmentWizard } from "@/app/dashboard/calendar/new-appointment-wizard";
```

2. Add state, next to `selectedAppointment`:

```tsx
  const searchParams = useSearchParams();
  const [wizardOpen, setWizardOpen] = useState(searchParams.get("newAppointment") === "1");
```

3. Replace the "תור חדש" `<Link>` (currently `href="/dashboard/appointments/new"`) with a button:

```tsx
          <Btn size="md" className="h-10 rounded-[12px]" onClick={() => setWizardOpen(true)}>
            <PlusIcon size={15} />
            תור חדש
          </Btn>
```

(The `Link` import at the top of the file is still used elsewhere on the page for `"/dashboard/calls"` etc. — if this was the only usage, leave the import; typecheck will catch it if not, and it is not the only one.)

4. Render the wizard near the drawer, at the end of the page:

```tsx
      <NewAppointmentWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        clinicId={clinicId ?? ""}
        onCreated={() => void fetchData()}
      />
```

- [ ] **Step 3: Point the Today page's "quick create" at the calendar wizard**

In `app/app/dashboard/today-dashboard-sections.tsx`, `TodayPageHeading`, change:

```tsx
      <Link
        href="/dashboard/appointments/new"
```
to
```tsx
      <Link
        href="/dashboard/calendar?newAppointment=1"
```

- [ ] **Step 4: Fix the legacy appointments list page's now-dead link**

In `app/app/dashboard/appointments/page.tsx`, change the "New appointment" link's `href` from `/dashboard/appointments/new` to `/dashboard/calendar?newAppointment=1` (this page isn't part of this phase's redesign — it's not in the sidebar nav — this is only fixing the dangling link left by deleting `/new` in the next step).

- [ ] **Step 5: Delete the old form and page**

```bash
git rm app/app/dashboard/appointments/new/page.tsx app/app/dashboard/appointments/appointment-form.tsx
```

- [ ] **Step 6: Run typecheck**

Run: `cd app && npm run typecheck`
Expected: no errors (confirms nothing else imported the deleted files).

- [ ] **Step 7: Run the test suite**

Run: `cd app && npm run test`
Expected: all tests pass.

- [ ] **Step 8: Manual browser verification**

With the app running against local Supabase: click "תור חדש" on the calendar, walk through all 5 steps with real seeded data (search an existing customer, pick a pet, pick a visit type, pick a date/slot, confirm) and verify the appointment appears on the calendar afterward. Then click "יצירה מהירה" on the Today page and confirm it lands on `/dashboard/calendar` with the wizard already open.

- [ ] **Step 9: Commit**

```bash
cd /Users/idoamsalem/mvp-noa-1-0
git add app/app/dashboard/calendar/new-appointment-wizard.tsx app/app/dashboard/calendar/page.tsx app/app/dashboard/today-dashboard-sections.tsx app/app/dashboard/appointments/page.tsx
git commit -m "$(cat <<'EOF'
feat: real 5-step booking wizard, replacing the broken new-appointment form

appointments/new/page.tsx hardcoded the first customer and first pet
returned by the API with no picker at all. Replaces it with a 5-step
modal wizard (customer search, pet select, visit type, date/slot via
the already-built availability endpoint, confirm) reachable from the
calendar's "תור חדש" button and the Today page's "יצירה מהירה" via
?newAppointment=1. Deletes the old single-page form.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Typecheck + full test suite one more time, clean**

```bash
cd /Users/idoamsalem/mvp-noa-1-0/app
npm run typecheck
npm run test
```

Expected: 0 typecheck errors; all tests pass.

- [ ] **Step 2: Browser QA against local Supabase**

Reuse the same local-Supabase setup from Phase 1 (Docker + `supabase start` + a temporary `app/.env.development.local` pointing at `http://127.0.0.1:54321` with the local anon/service-role keys + `npm run seed:all`, per `app/.env.example`'s documented local-dev values) — do **not** point at the production `app/.env.local`. Log in as `owner@noas-clinic.local` / `dev-password-change-me`, then walk:
- `/dashboard/calendar` — click a scheduled appointment → drawer opens, cancel it, confirm it disappears/updates on the grid.
- Click a `pending_approval` appointment (seed data may need a manual one created via the wizard with visit type `neutering`, since that's the only type with `requiresApproval: true`) → approve/reject buttons work.
- "תור חדש" end-to-end through all 5 steps.
- `/dashboard` (Today) → "יצירה מהירה" lands on the calendar with the wizard open.

Delete the temporary `.env.development.local` and any screenshot artifacts afterward, same as Phase 1.

- [ ] **Step 3: Update spec status**

In `docs/superpowers/specs/2026-08-29-figma-visual-redesign-design.md`, update the `**Status:**` line to mark Phase 3 shipped, matching the pattern used for Phases 1-2.

- [ ] **Step 4: Commit**

```bash
cd /Users/idoamsalem/mvp-noa-1-0
git add docs/superpowers/specs/2026-08-29-figma-visual-redesign-design.md
git commit -m "$(cat <<'EOF'
docs: mark Figma redesign Phase 3 as shipped

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Self-review notes

- **Spec coverage:** Section A (calendar visual pass + label reconciliation) → Task 3. Section B (drawer, approve/reject reuse, cancel with no penalty logic, medical-record/start-visit links) → Tasks 1, 2, 5. Section C (5-step wizard) → Tasks 4, 6. The spec's two open questions are resolved during planning: `/api/calendar/availability` does return exactly `{availableSlots: string[]}`, ready to use as-is; `ApproveRejectModal`'s location was confirmed (local to `dashboard/page.tsx`) and Task 2 extracts it.
- **Deferred scope, called out explicitly (not silently dropped):** the drawer's "ערוך תור" (edit) action — noted at the top of this plan and in Task 5's step 1 comment.
- **Type consistency:** `Appointment.customerPhone` (Task 1) is threaded through consistently — `mapAppointmentRow` (Task 1), `ApproveRejectModal`'s `phone` prop (Task 2, Task 5), `AppointmentDrawer` (Task 5). `getBookableDates` (Task 4) and `VISIT_TYPE_CONFIG`/`effectiveDuration` (already existing) are the only two `appointment-rules.ts` exports the wizard (Task 6) needs, and both are used with matching signatures.
- **No new API routes needed** — confirmed during research that `/api/calendar`, `/api/calendar/availability`, `/api/appointments` (POST/PATCH), `/api/appointments/:id/approve|reject`, `/api/customers/:id/pets`, and `/api/search?entity=customers` already exist and match the shapes used above.
