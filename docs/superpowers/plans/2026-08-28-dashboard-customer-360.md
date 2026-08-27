# Customer 360° Profile — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the customer profile (the drawer on `/dashboard/clients`) the single place staff look for a customer's full picture — it already shows contact info, pets, and appointment history; this plan adds visit/medical history, then removes the now-redundant standalone "חיות מחמד" and "תיקים רפואיים" nav items and deletes the old, fully-superseded `/dashboard/customers/*` pages (unreachable from nav, pre-dates the current design system, replaced by `/dashboard/clients`).

**Architecture:** Purely additive on the data side (`GET /api/visits?customerId=` already exists and already supports this exact filter — confirmed by reading `app/lib/repositories/visit.repository.ts` and `app/app/api/visits/route.ts`, zero backend work needed). The risky part is deletion, so this plan is deliberately conservative: it removes only navigation entries and pages already confirmed unreachable/superseded, and it does NOT delete `/dashboard/pets/[petId]` or `/dashboard/visits/[visitId]` detail pages or the `/dashboard/pets` and `/dashboard/records` LIST pages themselves (only their sidebar links) — those routes may still be linked from elsewhere and deleting the pages is out of scope for this plan. Two existing links into the now-dead `/dashboard/customers/[id]` route get repointed to `/dashboard/clients?customerId=`.

**Tech Stack:** Next.js 16, TypeScript, existing `/api/visits` and `/api/pets` and `/api/appointments` endpoints (all already built, no new API routes in this plan).

This is Plan 3 of the dashboard redesign (see `docs/superpowers/specs/2026-08-27-dashboard-crm-redesign-design.md`), following Plan 1 (visual restyle + search) and Plan 2 (waitlist), both already shipped to production.

---

## Before you start

Read `app/app/dashboard/clients/page.tsx` in full (330 lines) — the `ClientProfile` component (lines ~66-222) already fetches and renders pets (`/api/pets?customerId=`) and appointment history (`/api/appointments?customerId=`) in exactly the pattern this plan's Task 1 adds a third section in. Also read `app/components/dashboard/sidebar.tsx` (107 lines) for the nav item list, and confirm for yourself that `grep -rln "dashboard/customers" app components` (from `app/`) finds exactly two link sites outside the `app/dashboard/customers/` directory itself: `app/dashboard/pets/[petId]/page.tsx:54` and `app/dashboard/voice/[callId]/page.tsx:88` — both are what Task 2 repoints.

---

### Task 1: Add a visit-history section to the customer profile drawer

**Files:**
- Modify: `app/app/dashboard/clients/page.tsx`

- [ ] **Step 1: Add visit state and fetch to `ClientProfile`**

In `app/app/dashboard/clients/page.tsx`, the `ClientProfile` component currently has (around lines 73-107):

```tsx
  const [pets, setPets] = useState<Pet[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [petsLoading, setPetsLoading] = useState(true);
  const [apptLoading, setApptLoading] = useState(true);
```

...followed by two `useEffect` hooks that each fetch pets and appointments respectively. Add a third state pair and a third `useEffect`, following the exact same pattern:

```tsx
  const [visits, setVisits] = useState<Visit[]>([]);
  const [visitsLoading, setVisitsLoading] = useState(true);
```

Add the import at the top of the file (next to the existing `Appointment`/`Pet` type imports):

```tsx
import type { Visit } from "@/types/domain/visit";
```

Add a third `useEffect`, placed after the existing appointments-fetching one:

```tsx
  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/visits?customerId=${customer.id}&limit=10`);
      if (res.ok) {
        const d = await res.json() as { data: { items: Visit[] } };
        setVisits(d.data.items ?? []);
      }
      setVisitsLoading(false);
    })();
  }, [customer.id]);
```

- [ ] **Step 2: Render the visit-history section**

In the drawer body, after the existing "Appointment history" `<div>` block (which ends right before the "Notes" section), add a new section following the exact same structural pattern as the pets/appointments sections above it:

```tsx
          {/* Visit history */}
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
              ביקורים רפואיים ({visitsLoading ? "…" : visits.length})
            </p>
            {visitsLoading ? (
              <Skeleton className="h-24" />
            ) : visits.length === 0 ? (
              <p className="text-sm text-[var(--faint)]">אין ביקורים רשומים</p>
            ) : (
              <div className="rounded-[var(--r-lg)] border border-[var(--line)] divide-y divide-[var(--line-2)]">
                {visits.map(visit => (
                  <Link
                    key={visit.id}
                    href={`/dashboard/visits/${visit.id}`}
                    className="flex items-center justify-between px-3 py-2.5 hover:bg-[var(--surface-2)] transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-[var(--ink)]">{fmtDate(visit.startedAt)}</p>
                      <p className="truncate text-xs text-[var(--muted)]">{visit.chiefComplaint ?? "ללא תלונה ראשית"}</p>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-1.5">
                      {visit.aiVisitSummary && <Badge color="brand">AI</Badge>}
                      <span className={[
                        "text-[11px] font-semibold px-2 py-0.5 rounded-full",
                        visit.status === "completed" ? "bg-[#E9F5EF] text-[#2F7D5B]"
                          : visit.status === "cancelled" ? "bg-[var(--line-2)] text-[var(--muted)]"
                          : "bg-[var(--brand-50)] text-[var(--brand-700)]",
                      ].join(" ")}>
                        {visit.status === "completed" ? "הושלם" : visit.status === "cancelled" ? "בוטל" : "בטיפול"}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

```

This needs `Link` from `next/link` — check the top of the file; `ClientsPage` (the default export, different component in the same file) may already import it for the "new customer" affordance, or it may not be imported at all yet in this file. Add `import Link from "next/link";` at the top if it isn't already there.

- [ ] **Step 3: Run typecheck and the full test suite**

```bash
cd app && npm run typecheck && npm run test
```

Expected: both clean/passing — this is a UI-only addition with no new pure logic, so no new unit test is expected (consistent with how the existing pets/appointments sections in this same component have no dedicated tests either).

- [ ] **Step 4: Drive the real UI to confirm the visit section renders**

A dev server may already be running on port 3001 — check `lsof -i :3001` first. Log in (ask the controller for credentials — do not guess), go to `/dashboard/clients`, click a customer who has at least one visit (query Supabase or check the app if you need to find one), confirm the drawer now shows a "ביקורים רפואיים" section between the appointment history and the notes, with clickable rows linking to `/dashboard/visits/[id]`. If no customer in this clinic's data has any visits, confirm instead that the section renders its correct empty state ("אין ביקורים רשומים") rather than crashing or staying blank. Report DONE_WITH_CONCERNS if you cannot complete this — do not claim success without seeing it.

- [ ] **Step 5: Commit**

```bash
git add app/app/dashboard/clients/page.tsx
git commit -m "feat(dashboard): add visit history to customer profile drawer"
```

---

### Task 2: Declutter navigation and remove the dead customers pages

**Files:**
- Modify: `app/components/dashboard/sidebar.tsx`
- Delete: `app/app/dashboard/customers/page.tsx`
- Delete: `app/app/dashboard/customers/customer-form.tsx`
- Delete: `app/app/dashboard/customers/[customerId]/page.tsx`
- Delete: `app/app/dashboard/customers/new/page.tsx`
- Modify: `app/app/dashboard/pets/[petId]/page.tsx`
- Modify: `app/app/dashboard/voice/[callId]/page.tsx`

**Do NOT delete** `app/app/dashboard/pets/page.tsx`, `app/app/dashboard/pets/[petId]/page.tsx`, `app/app/dashboard/records/page.tsx`, or any `app/app/dashboard/visits/*` page — only their sidebar nav entries for pets/records are being removed in this task; the pages themselves stay live and reachable (e.g. via the new visit-history links added in Task 1, or direct URL) since other code may still depend on them and auditing every possible reference is out of this plan's scope.

- [ ] **Step 1: Remove the pets and records nav items**

In `app/components/dashboard/sidebar.tsx`, the `navItems` array currently has (after Plan 2 added the waitlist entry):

```tsx
  const navItems: NavItem[] = [
    { href: "/dashboard",            label: "היום",         icon: TodayIcon },
    { href: "/dashboard/calendar",   label: "יומן",         icon: CalendarIcon },
    { href: "/dashboard/calls",      label: "שיחות",        icon: CallsIcon },
    { href: "/dashboard/escalations",label: "אסקלציות",     icon: EscalationIcon, badge: openEscalations },
    { href: "/dashboard/waitlist",   label: "המתנה",        icon: ClockIcon },
    { href: "/dashboard/clients",    label: "לקוחות",       icon: ClientsIcon },
    { href: "/dashboard/pets",       label: "חיות מחמד",    icon: PetsIcon },
    { href: "/dashboard/records",    label: "תיקים רפואיים",icon: RecordsIcon },
    { href: "/dashboard/settings",   label: "הגדרות",       icon: SettingsIcon },
  ];
```

Remove the `"/dashboard/pets"` and `"/dashboard/records"` lines. Also remove the now-unused `PetsIcon`/`RecordsIcon` from the icon import line at the top of the file if nothing else in this file uses them (check first — they shouldn't be used anywhere else in this file).

- [ ] **Step 2: Delete the dead customers pages**

```bash
git rm app/app/dashboard/customers/page.tsx
git rm app/app/dashboard/customers/customer-form.tsx
git rm app/app/dashboard/customers/\[customerId\]/page.tsx
git rm app/app/dashboard/customers/new/page.tsx
```

If `git rm` leaves an empty `app/app/dashboard/customers/` directory, that's fine — empty directories aren't tracked by git and won't appear in `git status`.

- [ ] **Step 3: Repoint the two broken links**

In `app/app/dashboard/pets/[petId]/page.tsx:54`, change:
```tsx
<Link href={`/dashboard/customers/${pet.customerId}`} className="text-sm text-emerald-700">
```
to:
```tsx
<Link href={`/dashboard/clients?customerId=${pet.customerId}`} className="text-sm text-emerald-700">
```

In `app/app/dashboard/voice/[callId]/page.tsx:88`, change:
```tsx
href={`/dashboard/customers/${call.customerId}`}
```
to:
```tsx
href={`/dashboard/clients?customerId=${call.customerId}`}
```

(Leave the rest of both files untouched — their styling is out of scope for this task, only the broken link target is being fixed.)

- [ ] **Step 4: Run the full test suite, typecheck, and build**

```bash
cd app && npm run test && npm run typecheck && npm run build
```

Expected: all pass. The build step is the important one here — it will fail loudly if any other file still imports something from the deleted `app/dashboard/customers/*` files, which would mean this task missed a reference.

- [ ] **Step 5: Drive the real UI to confirm nothing broke**

Log in, confirm the sidebar no longer shows "חיות מחמד" or "תיקים רפואיים", confirm `/dashboard/pets/[petId]` (open any pet from a customer's profile drawer) still loads and its "בעלים" / owner link now goes to `/dashboard/clients?customerId=...` and correctly opens that customer's drawer (this reuses the deep-link behavior already built in Plan 1's search task), and confirm `/dashboard/customers` now 404s (expected — it's deleted) rather than crashing the whole app.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(dashboard): consolidate nav around customer profile, remove dead customers pages"
```

---

## Done criteria for this plan

- Customer profile drawer shows contact info, tags-free notes, pets, appointment history, AND visit history in one place.
- Sidebar no longer shows "חיות מחמד" or "תיקים רפואיים" as separate items.
- `/dashboard/customers` and its subroutes are gone; nothing else in the app links to them anymore.
- `npm run test`, `npm run typecheck`, and `npm run build` all pass in `app/`.
