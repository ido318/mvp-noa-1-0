# Dashboard Waitlist Screen — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give staff a dashboard view of the `waitlist` table (already written to by the voice agent's `/tools/join-waitlist` when no appointment slot is available — CLAUDE.md's own Sprint 5 backlog names this as a planned-but-not-yet-built dashboard feature) — a new "המתנה" screen, plus a waitlist-count tile added to the existing Today stat-tile row.

**Architecture:** Follows this codebase's established layered pattern exactly, 1:1 with `CalendarBlockRepository`/`CalendarBlockService` (read-only subset — no create/delete needed, entries are only ever written by the voice agent directly via Supabase): Repository (join `customers`/`pets` via existing FK constraint names) → Service → registered in `createServices()` → one GET-only API route → a new dashboard page → one new sidebar nav item → one new stat tile.

**Tech Stack:** Next.js 16, TypeScript, Supabase (`@supabase/supabase-js`), Vitest, no new dependencies.

This is Plan 2 of the dashboard redesign (see `docs/superpowers/specs/2026-08-27-dashboard-crm-redesign-design.md`), following Plan 1 (visual restyle + global search, already shipped to production).

---

## Before you start

The `waitlist` table already exists in Supabase (project `xpsuhtqfxqmnunppnyov`) with columns: `id, clinic_id, customer_id, pet_id, visit_type, preferred_start (date), preferred_end (date), status (text), notes, created_at, updated_at`. FK constraints are named `waitlist_customer_clinic_fk` (→ `customers`) and `waitlist_pet_clinic_fk` (→ `pets`) — same naming convention as `appointments_customer_clinic_fk`/`appointments_pet_clinic_fk`, which `app/lib/repositories/appointment.repository.ts` already joins against, exactly the pattern to copy.

Read `app/lib/repositories/calendar-block.repository.ts`, `app/lib/services/calendar-block.service.ts`, and `app/lib/repositories/appointment.repository.ts`'s `list()` method (for the join syntax) before starting — every file in this plan mirrors one of those three.

---

### Task 1: Waitlist domain type, repository, and service (with tests)

**Files:**
- Create: `app/types/domain/waitlist.ts`
- Modify: `app/lib/repositories/mappers.ts` (add `mapWaitlistRow`, append to end of file)
- Create: `app/lib/repositories/waitlist.repository.ts`
- Create: `app/lib/services/waitlist.service.ts`
- Test: `app/tests/unit/waitlist.service.test.ts`
- Modify: `app/lib/services/factory.ts` (register the new repository/service)

- [ ] **Step 1: Create the domain type**

```typescript
// app/types/domain/waitlist.ts
export type WaitlistEntry = {
  id: string;
  clinicId: string;
  customerId: string;
  petId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  petName: string | null;
  visitType: string;
  preferredStart: string | null;
  preferredEnd: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WaitlistListFilters = {
  clinicIds: string[];
};
```

- [ ] **Step 2: Add the row mapper**

Append to the end of `app/lib/repositories/mappers.ts`:

```typescript
export function mapWaitlistRow(row: {
  id: string;
  clinic_id: string;
  customer_id: string;
  pet_id: string | null;
  customer?: { full_name: string | null; phone: string | null } | { full_name: string | null; phone: string | null }[] | null;
  pet?: { name: string | null } | { name: string | null }[] | null;
  visit_type: string;
  preferred_start: string | null;
  preferred_end: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}): WaitlistEntry {
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
    visitType: row.visit_type,
    preferredStart: row.preferred_start,
    preferredEnd: row.preferred_end,
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
```

Add the import at the top of `mappers.ts` if a `WaitlistEntry` type import isn't already grouped with the other domain type imports there — check the existing import block at the top of the file and add `import type { WaitlistEntry } from "@/types/domain/waitlist";` following the same pattern as the other domain type imports in that file.

- [ ] **Step 3: Create the repository**

```typescript
// app/lib/repositories/waitlist.repository.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError, err, ok, type Result } from "@/lib/errors/app-error";
import { mapWaitlistRow } from "@/lib/repositories/mappers";
import type { WaitlistEntry, WaitlistListFilters } from "@/types/domain/waitlist";

export class WaitlistRepository {
  constructor(private readonly client: SupabaseClient) {}

  async list(filters: WaitlistListFilters): Promise<Result<WaitlistEntry[]>> {
    const { data, error } = await this.client
      .from("waitlist")
      .select(`
        *,
        customer:customers!waitlist_customer_clinic_fk(full_name, phone),
        pet:pets!waitlist_pet_clinic_fk(name)
      `)
      .in("clinic_id", filters.clinicIds)
      .order("created_at", { ascending: true });

    if (error) return err(AppError.externalProvider("Failed to list waitlist entries", error));
    return ok((data ?? []).map(mapWaitlistRow));
  }
}
```

- [ ] **Step 4: Write the failing service test**

```typescript
// app/tests/unit/waitlist.service.test.ts
import { describe, expect, it, vi } from "vitest";
import { WaitlistService } from "@/lib/services/waitlist.service";
import type { WaitlistRepository } from "@/lib/repositories/waitlist.repository";
import type { ServiceActor } from "@/lib/services/service-context";

const ownerActor: ServiceActor = {
  userId: "00000000-0000-4000-8000-000000000001",
  clinicIds: ["00000000-0000-4000-8000-000000000010"],
  defaultClinicId: "00000000-0000-4000-8000-000000000010",
  memberships: [{ clinicId: "00000000-0000-4000-8000-000000000010", role: "owner" }],
};

function makeRepository(): WaitlistRepository {
  return {
    list: vi.fn().mockResolvedValue({
      ok: true,
      value: [
        {
          id: "wl-1",
          clinicId: ownerActor.defaultClinicId!,
          customerId: "cust-1",
          petId: "pet-1",
          customerName: "דנה כהן",
          customerPhone: "+972501234567",
          petName: "רקס",
          visitType: "vaccination",
          preferredStart: "2026-09-01",
          preferredEnd: "2026-09-10",
          status: "pending",
          notes: null,
          createdAt: "2026-08-20T10:00:00.000Z",
          updatedAt: "2026-08-20T10:00:00.000Z",
        },
      ],
    }),
  } as unknown as WaitlistRepository;
}

describe("WaitlistService", () => {
  it("lists only actor clinics", async () => {
    const repository = makeRepository();
    const service = new WaitlistService(repository);

    const result = await service.listEntries(ownerActor);

    expect(repository.list).toHaveBeenCalledWith({ clinicIds: ownerActor.clinicIds });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(1);
    expect(result.value[0].customerName).toBe("דנה כהן");
  });
});
```

- [ ] **Step 5: Run the test to verify it fails**

```bash
cd app && npx vitest run tests/unit/waitlist.service.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/services/waitlist.service'`.

- [ ] **Step 6: Write the service**

```typescript
// app/lib/services/waitlist.service.ts
import type { Result } from "@/lib/errors/app-error";
import type { WaitlistRepository } from "@/lib/repositories/waitlist.repository";
import type { ServiceActor } from "@/lib/services/service-context";
import type { WaitlistEntry } from "@/types/domain/waitlist";

export class WaitlistService {
  constructor(private readonly repository: WaitlistRepository) {}

  async listEntries(actor: ServiceActor): Promise<Result<WaitlistEntry[]>> {
    return this.repository.list({ clinicIds: actor.clinicIds });
  }
}
```

- [ ] **Step 7: Run the test to verify it passes**

```bash
cd app && npx vitest run tests/unit/waitlist.service.test.ts
```

Expected: PASS (1 test).

- [ ] **Step 8: Register in the service factory**

In `app/lib/services/factory.ts`:
1. Add `import { WaitlistRepository } from "@/lib/repositories/waitlist.repository";` grouped with the other repository imports (alphabetically, after `VoiceCallRepository`... actually place it alphabetically near `VisitShareRepository`/`VisitRepository` — just keep the existing alphabetical grouping convention in that import block).
2. Add `import { WaitlistService } from "@/lib/services/waitlist.service";` grouped with the other service imports the same way.
3. Inside `createServices()`, add `const waitlistRepository = new WaitlistRepository(supabase);` next to the other repository instantiations (e.g. right after `const calendarBlockRepository = ...` line).
4. Inside the returned object, add `waitlist: new WaitlistService(waitlistRepository),` next to `calendarBlock: new CalendarBlockService(calendarBlockRepository),`.

- [ ] **Step 9: Run the full test suite and typecheck**

```bash
cd app && npm run test && npm run typecheck
```

Expected: all tests pass (including the new one), typecheck clean.

- [ ] **Step 10: Commit**

```bash
git add app/types/domain/waitlist.ts app/lib/repositories/mappers.ts app/lib/repositories/waitlist.repository.ts app/lib/services/waitlist.service.ts app/tests/unit/waitlist.service.test.ts app/lib/services/factory.ts
git commit -m "feat(dashboard): add waitlist repository and service"
```

---

### Task 2: Waitlist API route, dashboard page, and nav item

**Files:**
- Create: `app/app/api/waitlist/route.ts`
- Create: `app/app/dashboard/waitlist/page.tsx`
- Modify: `app/components/dashboard/sidebar.tsx`
- Modify: `app/app/dashboard/page.tsx` (add a 4th stat tile)

- [ ] **Step 1: Create the API route**

```typescript
// app/app/api/waitlist/route.ts
import { getActorAndServices } from "@/lib/api/actor";
import { createRequestId } from "@/lib/api/request-id";
import { handleRouteError, jsonSuccess } from "@/lib/api/response";

export async function GET() {
  const requestId = createRequestId();

  try {
    const { actor, waitlist } = await getActorAndServices();
    const result = await waitlist.listEntries(actor);
    if (!result.ok) return handleRouteError(result.error, requestId);
    return jsonSuccess({ items: result.value }, 200, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
```

- [ ] **Step 2: Create the dashboard page**

```tsx
// app/app/dashboard/waitlist/page.tsx
"use client";
import React, { useEffect, useState } from "react";
import { Card } from "@/components/dashboard/ui/card";
import { EmptyState } from "@/components/dashboard/ui/empty-state";
import { Skeleton } from "@/components/dashboard/ui/skeleton";
import { TypePill } from "@/components/dashboard/ui/type-pill";
import { ClockIcon, PhoneIcon } from "@/components/dashboard/icons";
import type { WaitlistEntry } from "@/types/domain/waitlist";

const TZ = "Asia/Jerusalem";
function fmtDate(iso: string | null) {
  if (!iso) return null;
  return new Intl.DateTimeFormat("he-IL", { timeZone: TZ, day: "numeric", month: "short" }).format(new Date(iso));
}
function fmtDateTime(iso: string) {
  return new Intl.DateTimeFormat("he-IL", { timeZone: TZ, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

function WaitlistRow({ entry }: { entry: WaitlistEntry }) {
  const range = entry.preferredStart
    ? entry.preferredEnd && entry.preferredEnd !== entry.preferredStart
      ? `${fmtDate(entry.preferredStart)} – ${fmtDate(entry.preferredEnd)}`
      : fmtDate(entry.preferredStart)
    : null;

  return (
    <div className="flex items-center gap-3 px-[18px] py-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-[13.5px] font-bold text-[var(--ink)]">{entry.customerName ?? "לקוח לא ידוע"}</p>
          {entry.petName && <span className="text-xs text-[var(--muted)]">· {entry.petName}</span>}
        </div>
        <div className="mt-1 flex items-center gap-3 text-xs text-[var(--muted)]">
          {entry.customerPhone && (
            <a href={`tel:${entry.customerPhone}`} className="flex items-center gap-1 hover:text-[var(--brand-600)]">
              <PhoneIcon size={12} /> {entry.customerPhone}
            </a>
          )}
          {range && (
            <span className="flex items-center gap-1">
              <ClockIcon size={12} /> {range}
            </span>
          )}
        </div>
        {entry.notes && <p className="mt-1 text-xs text-[var(--faint)]">{entry.notes}</p>}
      </div>
      <TypePill type={entry.visitType} />
      <span className="flex-shrink-0 text-[11px] text-[var(--faint)]">{fmtDateTime(entry.createdAt)}</span>
    </div>
  );
}

export default function WaitlistPage() {
  const [items, setItems] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/waitlist");
      if (res.ok) {
        const d = await res.json() as { data: { items: WaitlistEntry[] } };
        setItems(d.data.items ?? []);
      }
      setLoading(false);
    })();
  }, []);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-[var(--ink)]">המתנה</h1>
        <span className="text-sm text-[var(--muted)]">{items.length} רשומים</span>
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<ClockIcon size={32} />}
          title="אין ממתינים כרגע"
          subtitle="לקוחות שתומר לא מצא עבורם תור פנוי יופיעו כאן"
        />
      ) : (
        <Card noPad>
          <div className="divide-y divide-[var(--line-2)]">
            {items.map((entry) => <WaitlistRow key={entry.id} entry={entry} />)}
          </div>
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Add the sidebar nav item**

In `app/components/dashboard/sidebar.tsx`, import `ClockIcon` alongside the other icon imports (add it to the existing `import { TodayIcon, CalendarIcon, ... } from "@/components/dashboard/icons";` line), then add a new entry to the `navItems` array, right after the `"אסקלציות"` entry and before `"לקוחות"`:

```typescript
{ href: "/dashboard/waitlist",    label: "המתנה",        icon: ClockIcon },
```

- [ ] **Step 4: Add a 4th stat tile to the Today page**

In `app/app/dashboard/page.tsx`, add state for the waitlist count and a 4th `StatTile`. Find the existing `fetchData` callback (the one that fetches appointments/escalations/calls) and add a parallel fetch for `/api/waitlist`, following the exact same `if (res.ok) { ... }` pattern already used for the other three fetches in that function. Add `const [waitlistCount, setWaitlistCount] = useState(0);` next to the other `useState` declarations near the top of the component, and inside `fetchData`, alongside the existing `apptRes`/`escRes`/`callRes` fetches, add a fourth parallel fetch to `/api/waitlist` and on success call `setWaitlistCount((d.data.items ?? []).length)`.

Then change the stat tile grid from `grid-cols-3` to `grid-cols-4` and add a 4th tile after the escalations one:

```tsx
<StatTile label="ממתינים" value={waitlistCount} />
```

- [ ] **Step 5: Run the full test suite and typecheck**

```bash
cd app && npm run test && npm run typecheck && npm run build
```

Expected: all pass, production build succeeds (confirms the new route/page compile correctly).

- [ ] **Step 6: Drive the real UI to confirm the waitlist screen renders**

A dev server may already be running on port 3001 — check `lsof -i :3001` before starting a new one; if not running, `cd app && PORT=3001 npm run dev &`. Log in (ask the controller for credentials — do not guess), click "המתנה" in the sidebar, confirm the page loads without error (either showing real waitlist entries or the empty state if there are none), and confirm the Today page's stat-tile row now shows 4 tiles including "ממתינים". Report DONE_WITH_CONCERNS if you cannot complete this verification — do not claim success without having seen it.

- [ ] **Step 7: Commit**

```bash
git add app/app/api/waitlist/route.ts app/app/dashboard/waitlist/page.tsx app/components/dashboard/sidebar.tsx app/app/dashboard/page.tsx
git commit -m "feat(dashboard): add waitlist screen and Today stat tile"
```

---

## Done criteria for this plan

- `/dashboard/waitlist` shows real data from the `waitlist` table (or the empty state if none exists), with customer name, phone, pet, visit type, preferred date range, and notes.
- Sidebar shows a new "המתנה" nav item between אסקלציות and לקוחות.
- Today page's stat-tile row shows 4 tiles including a waitlist count.
- `npm run test`, `npm run typecheck`, and `npm run build` all pass in `app/`.
