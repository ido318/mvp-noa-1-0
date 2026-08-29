# Figma Redesign Phase 2: Today Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Redesign the `/dashboard` main content to match the Figma `today-dashboard` screen while preserving the existing data sources and workflows.

**Architecture:** Keep `/dashboard` as a client-rendered Next.js App Router page, but split the large `page.tsx` into a thin data/container component plus focused local view-model and UI section modules. Phase 2 changes presentation and derived display data only; it does not add database columns, API routes, new dashboard destinations, Google Calendar, billing, prescriptions, or encounter/SOAP logic.

**Tech Stack:** Next.js 16 App Router, React 19 client components, TypeScript, Tailwind v4 classes backed by the Phase 1 CSS tokens, existing dashboard UI primitives, Vitest, Playwright CLI for visual verification.

**Spec:** `docs/superpowers/specs/2026-08-29-figma-visual-redesign-design.md`

---

## Design Target

Use Figma file `6YZZTnWcdXD7Dj8MqGJ7IF`, page `Page 2`, node `4:7` (`today-dashboard`).

The target visual structure is:

- page title area: `היום במרפאה`
- primary quick action: `יצירה מהירה`
- four top metric cards in one row:
  - `תורים היום`
  - `ממתינים`
  - `בטיפול`
  - `דורשים תשומת לב`
- two-column desktop content:
  - wide right/main area: `סדר יום תורים` list
  - narrow side area: `דורש תשומת לב` + `פעילות אחרונה`
- list-row treatment instead of the current tall timeline as the primary view
- existing appointment approval modal behavior remains available for `pending_approval`

Data mapping for Phase 2:

| Figma label | Existing source | Mapping |
|---|---|---|
| `תורים היום` | `appointments` from `/api/appointments?date=YYYY-MM-DD` | `todayAppts.length` |
| `ממתינים` | `waitlist` from `/api/waitlist` | `waitlistCount` |
| `בטיפול` | existing appointment statuses + active calls | `appointments.status === "confirmed" || "scheduled"` currently in-progress for the day; if no richer visit state exists, label remains a count of active scheduled work |
| `דורשים תשומת לב` | `/api/escalations?status=open` + `pending_approval` appointments | `escalations.length + pending.length` |
| `סדר יום תורים` | `todayAppts` | sorted appointment rows |
| `דורש תשומת לב` | `pending` first, then `escalations` | top 3 actionable items |
| `פעילות אחרונה` | `todayCalls`, approvals, appointments | use existing data only; no audit-log API in this phase |

---

### Task 1: Refresh Figma Context Before Editing

**Files:**
- Read only: Figma node `4:7`
- Read only: `app/app/dashboard/page.tsx`
- Read only: `app/components/dashboard/ui/*`
- Read only: `app/components/dashboard/icons.tsx`

- [x] **Step 1: Load the design-to-code instructions**

Read the `figma-design-to-code` skill before calling Figma design context.

Expected: the skill requires `get_design_context` on the target node before code edits and requires adapting the generated reference to the local stack.

- [x] **Step 2: Fetch the current Figma design context**

Call Figma `get_design_context` for:

```text
fileKey: 6YZZTnWcdXD7Dj8MqGJ7IF
nodeId: 4:7
format: html
skillNames: resource:figma-design-to-code
```

Expected: context includes the `today-dashboard` frame, stat cards, appointment list, attention panel, activity panel, and any image/icon assets used by the node.

- [x] **Step 3: Re-check local reusable components**

Run:

```bash
find app/components/dashboard/ui -maxdepth 1 -type f -print | sort
sed -n '1,260p' app/components/dashboard/icons.tsx
sed -n '1,520p' app/app/dashboard/page.tsx
```

Expected: reuse `Card`, `Badge`, `Btn`, `TypePill`, `UrgencyMeter`, `EmptyState`, `Skeleton`, `PhoneIcon`, `ClockIcon`, `SparkleIcon`, `CheckIcon`, `XIcon`, `UserIcon`, and existing Phase 1 tokens.

- [x] **Step 4: Gate before implementation**

Record a short note in the implementation log or final report:

```text
G1 PASS - today-dashboard node 4:7 loaded; main content contains four metrics, schedule list, attention panel, activity panel.
G2-G4 PASS - Next.js/React/Tailwind token stack; existing dashboard UI primitives and hand-rolled icons reused; no new DB/API work.
```

Do not edit code until this gate passes.

---

### Task 2: Add a Pure View-Model Layer for Today Dashboard

**Files:**
- Create: `app/app/dashboard/today-dashboard-model.ts`
- Create: `app/tests/unit/today-dashboard-model.test.ts`

- [x] **Step 1: Write the failing test**

Create `app/tests/unit/today-dashboard-model.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Appointment } from "@/types/domain/appointment";
import type { Escalation } from "@/types/domain/escalation";
import type { VoiceCall } from "@/types/domain/voice-call";
import { buildTodayDashboardModel } from "@/app/dashboard/today-dashboard-model";

const baseAppointment: Appointment = {
  id: "appt-1",
  clinicId: "clinic-1",
  customerId: "customer-1",
  petId: "pet-1",
  customerName: "דנה כהן",
  petName: "לונה",
  petSpecies: "dog",
  appointmentType: "checkup",
  status: "scheduled",
  source: "phone",
  scheduledAt: "2026-08-29T06:30:00.000Z",
  durationMinutes: 40,
  reason: "בדיקה כללית",
  notes: null,
  version: 1,
  cancelledAt: null,
  cancelledByUserId: null,
  cancellationReason: null,
  createdByUserId: null,
  createdAt: "2026-08-28T12:00:00.000Z",
  updatedAt: "2026-08-28T12:00:00.000Z",
  deletedAt: null,
};

const escalation: Escalation = {
  id: "esc-1",
  clinicId: "clinic-1",
  voiceCallId: null,
  elevenLabsConversationId: null,
  reason: "ספקית דם מראה אנמיה חריפה",
  urgency: 9,
  resolvedAt: null,
  resolvedBy: null,
  notes: null,
  createdAt: "2026-08-29T07:15:00.000Z",
  updatedAt: "2026-08-29T07:15:00.000Z",
  afterHours: false,
};

const call: VoiceCall = {
  id: "call-1",
  clinicId: "clinic-1",
  customerId: null,
  direction: "inbound",
  status: "completed",
  fromNumber: "+972501234567",
  toNumber: "+972359012345",
  twilioCallSid: null,
  twilioParentCallSid: null,
  elevenLabsConversationId: null,
  agentName: "Tomer",
  startedAt: "2026-08-29T08:00:00.000Z",
  endedAt: "2026-08-29T08:03:00.000Z",
  durationSeconds: 180,
  recordingUrl: null,
  recordingStoragePath: null,
  transcript: null,
  aiSummary: "לקוחה ביקשה לקבוע חיסון.",
  callCategory: "operation",
  metadata: {},
  createdAt: "2026-08-29T08:00:00.000Z",
  updatedAt: "2026-08-29T08:03:00.000Z",
};

describe("buildTodayDashboardModel", () => {
  it("maps existing dashboard data into Figma-style metrics and sections", () => {
    const pendingApproval = {
      ...baseAppointment,
      id: "appt-2",
      petName: "צ'אקי",
      appointmentType: "neutering" as const,
      status: "pending_approval" as const,
      scheduledAt: "2026-08-29T08:00:00.000Z",
    };

    const model = buildTodayDashboardModel({
      today: "2026-08-29",
      appointments: [pendingApproval, baseAppointment],
      escalations: [escalation],
      todayCalls: [call],
      waitlistCount: 4,
    });

    expect(model.metrics).toEqual([
      { label: "תורים היום", value: 2, tone: "brand" },
      { label: "ממתינים", value: 4, tone: "amber" },
      { label: "בטיפול", value: 1, tone: "coral" },
      { label: "דורשים תשומת לב", value: 2, tone: "red" },
    ]);
    expect(model.scheduleRows.map((row) => row.id)).toEqual(["appt-1", "appt-2"]);
    expect(model.attentionItems).toHaveLength(2);
    expect(model.attentionItems[0]).toMatchObject({ kind: "pending_approval", title: "צ'אקי ממתין לאישור" });
    expect(model.activityItems[0]).toMatchObject({ title: "שיחה הושלמה", subtitle: "לקוחה ביקשה לקבוע חיסון." });
  });
});
```

- [x] **Step 2: Run the test to verify RED**

Run:

```bash
cd app && npx vitest run tests/unit/today-dashboard-model.test.ts
```

Expected: FAIL because `today-dashboard-model` does not exist.

- [x] **Step 3: Implement the model**

Create `app/app/dashboard/today-dashboard-model.ts`:

```ts
import { formatIsraelTime, israelDateIso } from "@/lib/israel-date";
import type { Appointment } from "@/types/domain/appointment";
import type { Escalation } from "@/types/domain/escalation";
import type { VoiceCall } from "@/types/domain/voice-call";

export type MetricTone = "brand" | "amber" | "coral" | "red";

export type TodayMetric = {
  label: string;
  value: number;
  tone: MetricTone;
};

export type TodayScheduleRow = {
  id: string;
  time: string;
  petName: string;
  customerName: string;
  appointmentType: string;
  status: Appointment["status"];
  reason: string;
  appointment: Appointment;
};

export type TodayAttentionItem = {
  id: string;
  kind: "pending_approval" | "escalation";
  title: string;
  subtitle: string;
  tone: "amber" | "red";
  urgency?: number;
  appointment?: Appointment;
  escalation?: Escalation;
};

export type TodayActivityItem = {
  id: string;
  title: string;
  subtitle: string;
  time: string;
  tone: "brand" | "muted";
};

export type TodayDashboardModel = {
  metrics: TodayMetric[];
  scheduleRows: TodayScheduleRow[];
  attentionItems: TodayAttentionItem[];
  activityItems: TodayActivityItem[];
};

type Input = {
  today: string;
  appointments: Appointment[];
  escalations: Escalation[];
  todayCalls: VoiceCall[];
  waitlistCount: number;
};

export function buildTodayDashboardModel({
  today,
  appointments,
  escalations,
  todayCalls,
  waitlistCount,
}: Input): TodayDashboardModel {
  const todayAppointments = appointments
    .filter((appointment) => israelDateIso(appointment.scheduledAt) === today)
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

  const pendingApprovals = todayAppointments.filter((appointment) => appointment.status === "pending_approval");
  const activeCareCount = todayAppointments.filter((appointment) =>
    appointment.status === "scheduled" || appointment.status === "confirmed"
  ).length;

  return {
    metrics: [
      { label: "תורים היום", value: todayAppointments.length, tone: "brand" },
      { label: "ממתינים", value: waitlistCount, tone: "amber" },
      { label: "בטיפול", value: activeCareCount, tone: "coral" },
      { label: "דורשים תשומת לב", value: escalations.length + pendingApprovals.length, tone: "red" },
    ],
    scheduleRows: todayAppointments.map((appointment) => ({
      id: appointment.id,
      time: formatIsraelTime(appointment.scheduledAt),
      petName: appointment.petName ?? "מטופל ללא שם",
      customerName: appointment.customerName ?? "לקוח ללא שם",
      appointmentType: appointment.appointmentType,
      status: appointment.status,
      reason: appointment.reason ?? "ללא סיבת ביקור",
      appointment,
    })),
    attentionItems: [
      ...pendingApprovals.map((appointment): TodayAttentionItem => ({
        id: `pending-${appointment.id}`,
        kind: "pending_approval",
        title: `${appointment.petName ?? "מטופל"} ממתין לאישור`,
        subtitle: `${formatIsraelTime(appointment.scheduledAt)} · ${appointment.customerName ?? "לקוח ללא שם"}`,
        tone: "amber",
        appointment,
      })),
      ...escalations.map((escalation): TodayAttentionItem => ({
        id: `escalation-${escalation.id}`,
        kind: "escalation",
        title: escalation.reason,
        subtitle: escalation.afterHours ? "נוצר אחרי שעות הפעילות" : formatIsraelTime(escalation.createdAt),
        tone: escalation.urgency >= 8 ? "red" : "amber",
        urgency: escalation.urgency,
        escalation,
      })),
    ].slice(0, 3),
    activityItems: todayCalls.slice(0, 4).map((call) => ({
      id: call.id,
      title: call.status === "completed" ? "שיחה הושלמה" : "שיחה נכנסת",
      subtitle: call.aiSummary ?? call.fromNumber,
      time: formatIsraelTime(call.startedAt),
      tone: call.status === "completed" ? "brand" : "muted",
    })),
  };
}
```

- [x] **Step 4: Run the model test to verify GREEN**

Run:

```bash
cd app && npx vitest run tests/unit/today-dashboard-model.test.ts
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add app/app/dashboard/today-dashboard-model.ts app/tests/unit/today-dashboard-model.test.ts
git commit -m "feat: add today dashboard view model"
```

---

### Task 3: Build Figma-Style Today Dashboard UI Sections

**Files:**
- Create: `app/app/dashboard/today-dashboard-sections.tsx`
- Modify: `app/app/dashboard/page.tsx`

- [x] **Step 1: Create the UI section module**

Create `app/app/dashboard/today-dashboard-sections.tsx` with these exported components:

```tsx
"use client";
import React from "react";
import { Badge } from "@/components/dashboard/ui/badge";
import { Btn } from "@/components/dashboard/ui/btn";
import { Card } from "@/components/dashboard/ui/card";
import { EmptyState } from "@/components/dashboard/ui/empty-state";
import { TypePill } from "@/components/dashboard/ui/type-pill";
import { UrgencyMeter } from "@/components/dashboard/ui/urgency-meter";
import { CheckIcon, ClockIcon, PhoneIcon, PlusIcon, SparkleIcon, UserIcon, XIcon } from "@/components/dashboard/icons";
import type { Appointment } from "@/types/domain/appointment";
import type { TodayActivityItem, TodayAttentionItem, TodayMetric, TodayScheduleRow } from "./today-dashboard-model";

const metricToneClasses: Record<TodayMetric["tone"], { bar: string; value: string }> = {
  brand: { bar: "bg-[var(--brand-600)]", value: "text-[var(--brand-600)]" },
  amber: { bar: "bg-[var(--amber-600)]", value: "text-[var(--amber-600)]" },
  coral: { bar: "bg-[var(--coral-600)]", value: "text-[var(--coral-600)]" },
  red: { bar: "bg-[var(--red-600)]", value: "text-[var(--red-600)]" },
};

export function TodayPageHeading() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-[28px] font-extrabold leading-tight text-[var(--ink)]">היום במרפאה</h1>
      <Btn type="button" className="shadow-[var(--sh-md)]">
        <PlusIcon size={16} />
        יצירה מהירה
      </Btn>
    </div>
  );
}

export function TodayMetrics({ metrics }: { metrics: TodayMetric[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => {
        const tone = metricToneClasses[metric.tone];
        return (
          <Card key={metric.label} className="relative min-h-[84px] overflow-hidden p-4">
            <span className={["absolute end-4 top-5 h-10 w-1 rounded-full", tone.bar].join(" ")} />
            <p className="text-[13px] font-semibold text-[var(--ink-2)]">{metric.label}</p>
            <p className={["mt-2 text-[30px] font-extrabold leading-none tabular-nums", tone.value].join(" ")}>
              {metric.value}
            </p>
          </Card>
        );
      })}
    </div>
  );
}

export function ScheduleList({
  rows,
  onApprove,
  onReject,
}: {
  rows: TodayScheduleRow[];
  onApprove: (appointment: Appointment) => void;
  onReject: (appointment: Appointment) => void;
}) {
  return (
    <Card noPad className="overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4">
        <h2 className="text-[17px] font-extrabold text-[var(--ink)]">סדר יום תורים</h2>
        <a href="/dashboard/calendar" className="text-[13px] font-semibold text-[var(--brand-600)] hover:underline">
          לוח שנה מלא ←
        </a>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<ClockIcon size={28} />}
          title="אין תורים להיום"
          subtitle="כשיהיו תורים להיום הם יופיעו כאן"
          className="py-12"
        />
      ) : (
        <div className="space-y-3 px-5 pb-5">
          {rows.map((row) => {
            const isPending = row.status === "pending_approval";
            return (
              <div
                key={row.id}
                className="grid min-h-[56px] grid-cols-[64px_40px_1fr_auto] items-center gap-3 rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2.5"
              >
                <div className="text-[16px] font-extrabold tabular-nums text-[var(--ink)]">{row.time}</div>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--line-2)] text-[13px] font-bold text-[var(--ink-2)]">
                  {row.petName.slice(0, 1)}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-[14px] font-bold text-[var(--ink)]">{row.petName}</p>
                    <TypePill type={row.appointmentType} />
                  </div>
                  <p className="mt-0.5 truncate text-[12px] text-[var(--muted)]">{row.reason} · {row.customerName}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge color={isPending ? "amber" : "muted"}>
                    {isPending ? "ממתין" : row.status === "completed" ? "הושלם" : "מתוכנן"}
                  </Badge>
                  {isPending && (
                    <div className="flex gap-1">
                      <Btn size="sm" variant="soft" onClick={() => onApprove(row.appointment)}>
                        <CheckIcon size={12} />
                        אשר
                      </Btn>
                      <Btn size="sm" variant="dangerSoft" onClick={() => onReject(row.appointment)}>
                        <XIcon size={12} />
                        דחה
                      </Btn>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

export function AttentionPanel({
  items,
  onApprove,
  onReject,
}: {
  items: TodayAttentionItem[];
  onApprove: (appointment: Appointment) => void;
  onReject: (appointment: Appointment) => void;
}) {
  return (
    <Card noPad className="overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4">
        <SparkleIcon size={16} className="text-[var(--red-600)]" />
        <h2 className="text-[16px] font-extrabold text-[var(--ink)]">דורש תשומת לב</h2>
      </div>
      {items.length === 0 ? (
        <EmptyState title="אין נושאים דחופים" subtitle="המרפאה נקייה מפריטים לטיפול מיידי" className="py-10" />
      ) : (
        <div className="space-y-3 px-5 pb-5">
          {items.map((item) => (
            <div key={item.id} className="rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface-2)] p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-[var(--ink)]">{item.title}</p>
                  <p className="mt-1 text-[12px] text-[var(--muted)]">{item.subtitle}</p>
                </div>
                <Badge color={item.tone}>{item.kind === "pending_approval" ? "היום" : "דחוף"}</Badge>
              </div>
              {item.urgency != null && <UrgencyMeter value={item.urgency} className="mt-3" />}
              {item.appointment && (
                <div className="mt-3 flex gap-1.5">
                  <Btn size="sm" variant="soft" onClick={() => onApprove(item.appointment!)}>
                    <CheckIcon size={12} />
                    אשר
                  </Btn>
                  <Btn size="sm" variant="dangerSoft" onClick={() => onReject(item.appointment!)}>
                    <XIcon size={12} />
                    דחה
                  </Btn>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export function RecentActivityPanel({ items }: { items: TodayActivityItem[] }) {
  return (
    <Card noPad className="overflow-hidden">
      <div className="px-5 py-4">
        <h2 className="text-[16px] font-extrabold text-[var(--ink)]">פעילות אחרונה</h2>
      </div>
      {items.length === 0 ? (
        <EmptyState title="אין פעילות אחרונה" subtitle="שיחות ועדכונים מהיום יופיעו כאן" className="py-10" />
      ) : (
        <div className="space-y-4 px-5 pb-5">
          {items.map((item) => (
            <div key={item.id} className="flex gap-3">
              <span className="mt-1 h-2 w-2 rounded-full bg-[var(--brand-600)]" />
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-[var(--ink)]">{item.title}</p>
                <p className="truncate text-[12px] text-[var(--ink-2)]">{item.subtitle}</p>
                <p className="mt-0.5 text-[11px] text-[var(--muted)]">{item.time}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export function TodayEmptyState() {
  return (
    <EmptyState
      icon={<UserIcon size={32} />}
      title="אין פעילות להיום"
      subtitle="כשיהיו תורים, שיחות או פריטים לטיפול הם יופיעו כאן"
    />
  );
}

export function CallShortcut() {
  return (
    <a
      href="/dashboard/calls"
      className="inline-flex items-center gap-2 text-[13px] font-semibold text-[var(--brand-600)] hover:underline"
    >
      <PhoneIcon size={14} />
      כל השיחות
    </a>
  );
}
```

- [x] **Step 2: Wire the new model and sections into `page.tsx`**

Modify `app/app/dashboard/page.tsx`:

- keep existing fetching, approval/reject modal, `todayIso`, and `israelDayUtcRange`
- remove the old inline `StatTile`, `Timeline`, `TimelineAppointment`, old escalation card, and old calls card from the rendered JSX
- import and use:

```ts
import { buildTodayDashboardModel } from "./today-dashboard-model";
import {
  AttentionPanel,
  RecentActivityPanel,
  ScheduleList,
  TodayEmptyState,
  TodayMetrics,
  TodayPageHeading,
} from "./today-dashboard-sections";
```

Inside `TodayPage`, after `completedCalls` is removed, add:

```ts
const model = buildTodayDashboardModel({
  today,
  appointments,
  escalations,
  todayCalls,
  waitlistCount,
});
```

Replace the return body with:

```tsx
return (
  <div className="space-y-5 p-6">
    <TodayPageHeading />
    <TodayMetrics metrics={model.metrics} />

    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_408px]">
      <ScheduleList
        rows={model.scheduleRows}
        onApprove={(appt) => setModal({ mode: "approve", appt })}
        onReject={(appt) => setModal({ mode: "reject", appt })}
      />
      <div className="space-y-5">
        <AttentionPanel
          items={model.attentionItems}
          onApprove={(appt) => setModal({ mode: "approve", appt })}
          onReject={(appt) => setModal({ mode: "reject", appt })}
        />
        <RecentActivityPanel items={model.activityItems} />
      </div>
    </div>

    {model.scheduleRows.length === 0 && model.attentionItems.length === 0 && model.activityItems.length === 0 && (
      <TodayEmptyState />
    )}

    {modal && (
      <ApproveRejectModal
        mode={modal.mode}
        appointmentId={modal.appt.id}
        phone={modal.appt.phone ?? ""}
        customerName={modal.appt.customerName ?? ""}
        petName={modal.appt.petName ?? ""}
        onConfirm={() => {
          setModal(null);
          void fetchData();
        }}
        onClose={() => setModal(null)}
      />
    )}
  </div>
);
```

- [x] **Step 3: Run TypeScript**

Run:

```bash
cd app && npm run typecheck
```

Expected: PASS. If it fails because `modal.appt` needs the enriched `phone` fields, update the `EnrichedAppointment` type in `page.tsx` and cast only at the boundary where data arrives from `/api/appointments`.

- [x] **Step 4: Commit**

```bash
git add app/app/dashboard/page.tsx app/app/dashboard/today-dashboard-sections.tsx
git commit -m "feat: redesign today dashboard main content"
```

---

### Task 4: Preserve the Voice Calls API Fix with a Source-Level Regression Test

**Files:**
- Create: `app/tests/unit/today-dashboard-source.test.ts`

- [x] **Step 1: Write the test**

Create `app/tests/unit/today-dashboard-source.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("today dashboard API requests", () => {
  it("uses a UTC datetime range for today's voice calls request", () => {
    const source = readFileSync(join(process.cwd(), "app/dashboard/page.tsx"), "utf8");

    expect(source).toContain("israelDayUtcRange(today)");
    expect(source).toContain("encodeURIComponent(callRange.from)");
    expect(source).toContain("encodeURIComponent(callRange.to)");
    expect(source).not.toContain("fetch(`/api/voice/calls?from=${today}&to=${today}`)");
  });
});
```

- [x] **Step 2: Run the test**

Run:

```bash
cd app && npx vitest run tests/unit/today-dashboard-source.test.ts
```

Expected: PASS.

- [x] **Step 3: Commit**

```bash
git add app/tests/unit/today-dashboard-source.test.ts
git commit -m "test: lock today dashboard voice-call date range"
```

---

### Task 5: Browser QA Against Figma Phase 2

**Files:**
- No committed files.
- Temporary artifacts only under `output/playwright/`, then delete or leave untracked.

- [x] **Step 1: Start or reuse the app dev server**

Run:

```bash
cd app && npm run dev
```

If Next reports an existing server, use the printed URL instead of starting another one.

- [x] **Step 2: Open `/dashboard` and authenticate with the local dev user if needed**

Use Playwright CLI:

```bash
export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
export PWCLI="$CODEX_HOME/skills/playwright/scripts/playwright_cli.sh"
"$PWCLI" open http://localhost:3000/dashboard
```

If redirected to `/login`, use the local dev credentials configured for the app environment.

- [x] **Step 3: Verify desktop layout**

Run:

```bash
"$PWCLI" resize 1440 900
"$PWCLI" goto http://localhost:3000/dashboard
"$PWCLI" eval "() => ({
  title: document.body.innerText.includes('היום במרפאה'),
  quickAction: document.body.innerText.includes('יצירה מהירה'),
  metrics: ['תורים היום','ממתינים','בטיפול','דורשים תשומת לב'].every((text) => document.body.innerText.includes(text)),
  schedule: document.body.innerText.includes('סדר יום תורים'),
  attention: document.body.innerText.includes('דורש תשומת לב'),
  activity: document.body.innerText.includes('פעילות אחרונה'),
  horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
})"
```

Expected:

```json
{
  "title": true,
  "quickAction": true,
  "metrics": true,
  "schedule": true,
  "attention": true,
  "activity": true,
  "horizontalOverflow": false
}
```

- [x] **Step 4: Verify mobile layout**

Run:

```bash
"$PWCLI" resize 390 844
"$PWCLI" goto http://localhost:3000/dashboard
"$PWCLI" eval "() => ({
  horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  titleVisible: document.body.innerText.includes('היום במרפאה'),
  scheduleVisible: document.body.innerText.includes('סדר יום תורים')
})"
```

Expected:

```json
{
  "horizontalOverflow": false,
  "titleVisible": true,
  "scheduleVisible": true
}
```

- [x] **Step 5: Verify the voice-calls request still returns 200**

Run:

```bash
"$PWCLI" requests | rg "api/voice/calls"
```

Expected: latest `/api/voice/calls?...` request uses URL-encoded ISO datetimes and returns `[200] OK`, not `[400] Bad Request`.

---

### Task 6: Final Verification and Push Checkpoint

**Files:**
- Whatever Phase 2 implementation changed.

- [x] **Step 1: Run app checks**

Run each command separately:

```bash
cd app && npm run lint
cd app && npm run typecheck
cd app && npm run test
cd app && npm run build
```

Expected:

- lint exits 0
- typecheck exits 0
- tests pass; skipped tests may remain skipped
- production build exits 0

- [x] **Step 2: Check Git status**

Run:

```bash
git status --short --branch
```

Expected: clean except allowed local-only `.vscode/`.

- [x] **Step 3: Commit final cleanups if needed**

If Task 5 or Task 6 required small fixes, commit them:

```bash
git add app/app/dashboard app/tests/unit
git commit -m "fix: polish today dashboard redesign"
```

- [x] **Step 4: Stop and ask before push**

Do not push automatically. Report:

```text
Phase 2 complete locally. Awaiting explicit approval to push origin/main.
```

---

## Self-Review Notes

- Phase 2 is limited to `/dashboard` main content. Sidebar/header were Phase 1 and should not be reworked here.
- No migration is planned.
- No API route is planned.
- No new npm package is planned.
- `today-dashboard` uses generic Figma brand copy; implementation must keep the real app brand/session behavior and not hardcode `אנימליה קליניק`.
- `יצירה מהירה` in this phase is a visual action. If it needs a full create menu, that should be scoped explicitly before implementation; otherwise it can be a non-submitting button or route to the existing new appointment flow only if a clear existing route is selected during implementation.
