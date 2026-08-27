# Dashboard Foundation: Visual Restyle + Global Search — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the first, most visible piece of the dashboard CRM redesign: a cooler, more professional visual palette across every screen, and a working global header search (customers + pets) — the search input already exists visually in the header but does nothing today.

**Architecture:** Pure CSS custom-property swap in `app/app/globals.css` (no component changes needed — every component already references `var(--brand-*)` etc. via Tailwind arbitrary values, so retheming the tokens retheme the whole app). The search input in `components/dashboard/header.tsx` becomes a real debounced typeahead against the already-existing `GET /api/search?entity=customers|pets&q=` endpoint, rendering a results dropdown, and navigating to `/dashboard/clients?customerId=<id>` on click — which requires one small addition to `app/app/dashboard/clients/page.tsx` to read that query param and auto-open the existing profile drawer.

**Tech Stack:** Next.js 16 (App Router), Tailwind v4 (CSS custom properties as the actual design tokens), TypeScript, no new dependencies.

This is Plan 1 of the dashboard redesign (see `docs/superpowers/specs/2026-08-27-dashboard-crm-redesign-design.md`). Later plans (customer 360° profile, waitlist screen, Today KPI strip, vaccination reminders) build on top of this one and are written separately.

---

## Before you start

Read these two files in full — every task below assumes you've seen them:
- `app/app/globals.css` (full design token list)
- `app/components/dashboard/header.tsx` (current, non-functional search input)

Confirm the dev server can run: `cd app && PORT=3001 npm run dev` (must be port 3001 — `APP_BASE_URL` in `.env.local` is hardcoded to it and server-side fetches will fail on any other port). Login at `http://localhost:3001/login` with whatever credentials the user gives you.

---

### Task 1: Retheme design tokens (cool slate/teal palette)

**Files:**
- Modify: `app/app/globals.css:4-74` (the `:root` token block)

The current palette is a warm terracotta/orange brand (`--brand-*`) with warm-neutral grays (`--ink`, `--muted`, `--line`, `--bg`, etc). Replace it with a cool slate/teal palette. Keep every **token name** identical — only change the hex values — so every other file in the codebase (which references `var(--brand-600)` etc. via Tailwind arbitrary values) picks up the new look with zero other changes.

- [x] **Step 1: Replace the `:root` token block**

Open `app/app/globals.css` and replace lines 4–74 (from `:root {` through the closing `}` right before `/* ─── Tailwind theme extension ─── */`) with:

```css
:root {
  /* Brand (teal — professional/clinical) */
  --brand-900: #0B4F4A;
  --brand-700: #0F766E;
  --brand-600: #14877D;
  --brand-500: #2DA89D;
  --brand-400: #5CC0B6;
  --brand-200: #A9E0D9;
  --brand-100: #D3EEEA;
  --brand-50:  #EEF8F6;

  /* Coral (Tomer identity — the medical cross in the logo) */
  --coral-700: #C9494E;
  --coral-600: #E0696D;
  --coral-500: #F0888B;
  --coral-100: #FBD9DA;
  --coral-50:  #FDEFEF;

  /* Amber (warnings / medium urgency) */
  --amber-600: #D97706;
  --amber-500: #F59E0B;
  --amber-200: #FCD9A0;
  --amber-100: #FDEBC8;
  --amber-50:  #FEF6E9;

  /* Red (high urgency / errors) */
  --red-700: #B91C1C;
  --red-600: #DC2626;
  --red-500: #EF4444;
  --red-100: #FCE2E2;
  --red-50:  #FEF2F2;

  /* Cool neutrals (slate) */
  --ink:       #1F2933;
  --ink-2:     #42505E;
  --muted:     #6B7785;
  --faint:     #97A2AD;
  --line:      #E2E8ED;
  --line-2:    #EEF2F5;
  --bg:        #F4F6F8;
  --surface:   #FFFFFF;
  --surface-2: #F9FAFB;

  /* Layout */
  --side-w:   248px;
  --header-h: 68px;

  /* Radius */
  --r-sm: 8px;
  --r-md: 12px;
  --r-lg: 16px;
  --r-xl: 22px;

  /* Shadows */
  --sh-sm:  0 1px 2px rgba(16,40,56,.05), 0 1px 3px rgba(16,40,56,.04);
  --sh-md:  0 2px 8px rgba(16,40,56,.07), 0 1px 4px rgba(16,40,56,.05);
  --sh-lg:  0 6px 24px rgba(16,40,56,.10);
  --sh-pop: 0 18px 50px rgba(13,40,56,.18);

  /* Easing */
  --ease: cubic-bezier(.4,0,.2,1);

  /* Appointment type colors */
  --type-checkup-fg:  #0F766E; --type-checkup-bg:  #EEF8F6;
  --type-vaccine-fg:  #5B7CFA; --type-vaccine-bg:  #EEF1FE;
  --type-surgery-fg:  #E0696D; --type-surgery-bg:  #FBEAEB;
  --type-neutering-fg: #E0696D; --type-neutering-bg: #FBEAEB;
  --type-home_visit-fg: #2DA89D; --type-home_visit-bg: #EEF8F6;
  --type-phone_consultation-fg: #5B7CFA; --type-phone_consultation-bg: #EEF1FE;
  --type-followup-fg: #C2891E; --type-followup-bg: #FBF2DD;
}
```

- [x] **Step 2: Confirm no other file hardcodes the old hex values**

```bash
cd app && grep -rn "7C3F1E\|BC5E2C\|D06B33\|E88858\|EE9E6D\|F6CDAF\|FBE3D2\|FDF3EB" --include="*.tsx" --include="*.ts" --include="*.css" . | grep -v node_modules
```

Expected: no output (every component references the CSS variables, not raw hex — if this prints anything, that file hardcodes an old brand color and needs the same hex swap applied by hand before continuing).

- [x] **Step 3: Visually verify with the running dev server**

```bash
cd app && PORT=3001 npm run dev &
sleep 4
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/dashboard
```

Expected: `307` (redirect to login — confirms the server started cleanly). Then open `http://localhost:3001/dashboard` in a real browser (or drive it with Playwright per the `run` skill), log in, and confirm the sidebar/header/KPI cards/badges now render in the cool teal/slate palette instead of orange.

- [x] **Step 4: Commit**

```bash
git add app/app/globals.css
git commit -m "feat(dashboard): retheme to cool slate/teal palette"
```

---

### Task 2: Wire up the global header search

**Files:**
- Create: `app/lib/search/format-search-results.ts`
- Test: `app/tests/unit/format-search-results.test.ts`
- Modify: `app/components/dashboard/header.tsx`
- Modify: `app/app/dashboard/clients/page.tsx`

The header's search `<input>` currently has no `onChange`, no state, and does nothing. `GET /api/search?entity=customers&q=...` and `GET /api/search?entity=pets&q=...` already exist and work (see `app/app/api/search/route.ts`) — this task only adds frontend wiring.

The one piece of real logic worth unit-testing in isolation is merging the two separate search calls (customers + pets, each pet needing its owner's name for display) into one flat, ranked list of dropdown rows — everything else is plain fetch/state/render wiring with no established component-test pattern in this codebase (`tests/` only covers `.test.ts` logic files under a Node vitest environment — there are zero `.tsx`/jsdom component tests anywhere in this repo despite `@testing-library/react` being installed unused; introducing that harness is out of scope for this task). Verify the UI wiring itself by driving the running app.

- [x] **Step 1: Write the failing test for result formatting**

```typescript
// app/tests/unit/format-search-results.test.ts
import { describe, it, expect } from "vitest";
import { formatSearchResults } from "@/lib/search/format-search-results";
import type { Customer } from "@/types/domain/customer";
import type { Pet } from "@/types/domain/pet";

function makeCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: "cust-1",
    clinicId: "clinic-1",
    fullName: "דנה כהן",
    phone: "+972501234567",
    email: null,
    address: null,
    preferredContactMethod: "phone",
    notes: null,
    status: "active",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    deletedAt: null,
    ...overrides,
  };
}

function makePet(overrides: Partial<Pet> = {}): Pet {
  return {
    id: "pet-1",
    clinicId: "clinic-1",
    customerId: "cust-1",
    name: "רקס",
    species: "כלב",
    breed: null,
    sex: null,
    birthDate: null,
    weight: null,
    chipNumber: null,
    isNeutered: false,
    allergies: null,
    chronicConditions: null,
    currentMedications: null,
    notes: null,
    profileImageUrl: null,
    status: "active",
    ...overrides,
  } as Pet;
}

describe("formatSearchResults", () => {
  it("returns a customer row with the customer's own id as the target customerId", () => {
    const rows = formatSearchResults([makeCustomer()], []);
    expect(rows).toEqual([
      { kind: "customer", id: "cust-1", customerId: "cust-1", title: "דנה כהן", subtitle: "+972501234567" },
    ]);
  });

  it("returns a pet row that links back to the pet's owner via customerId", () => {
    const rows = formatSearchResults([], [makePet()]);
    expect(rows).toEqual([
      { kind: "pet", id: "pet-1", customerId: "cust-1", title: "רקס", subtitle: "כלב" },
    ]);
  });

  it("puts customers before pets and caps the combined list at 8", () => {
    const customers = Array.from({ length: 5 }, (_, i) => makeCustomer({ id: `c${i}`, fullName: `לקוח ${i}` }));
    const pets = Array.from({ length: 5 }, (_, i) => makePet({ id: `p${i}`, name: `חיה ${i}` }));
    const rows = formatSearchResults(customers, pets);
    expect(rows).toHaveLength(8);
    expect(rows.slice(0, 5).every((r) => r.kind === "customer")).toBe(true);
    expect(rows.slice(5).every((r) => r.kind === "pet")).toBe(true);
  });
});
```

- [x] **Step 2: Run the test to verify it fails**

```bash
cd app && npx vitest run tests/unit/format-search-results.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/search/format-search-results'`.

- [x] **Step 3: Write the implementation**

```typescript
// app/lib/search/format-search-results.ts
import type { Customer } from "@/types/domain/customer";
import type { Pet } from "@/types/domain/pet";

export type SearchResultRow = {
  kind: "customer" | "pet";
  id: string;
  customerId: string;
  title: string;
  subtitle: string;
};

const MAX_RESULTS = 8;

export function formatSearchResults(customers: Customer[], pets: Pet[]): SearchResultRow[] {
  const customerRows: SearchResultRow[] = customers.map((c) => ({
    kind: "customer",
    id: c.id,
    customerId: c.id,
    title: c.fullName,
    subtitle: c.phone ?? c.email ?? "",
  }));

  const petRows: SearchResultRow[] = pets.map((p) => ({
    kind: "pet",
    id: p.id,
    customerId: p.customerId,
    title: p.name,
    subtitle: p.species,
  }));

  return [...customerRows, ...petRows].slice(0, MAX_RESULTS);
}
```

- [x] **Step 4: Run the test to verify it passes**

```bash
cd app && npx vitest run tests/unit/format-search-results.test.ts
```

Expected: PASS (3 tests).

- [x] **Step 5: Commit the tested logic**

```bash
git add app/lib/search/format-search-results.ts app/tests/unit/format-search-results.test.ts
git commit -m "feat(dashboard): add global search result formatting"
```

- [x] **Step 6: Wire the header UI to the search API**

Replace the entire contents of `app/components/dashboard/header.tsx` with:

```tsx
"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SearchIcon, BellIcon } from "@/components/dashboard/icons";
import { formatSearchResults, type SearchResultRow } from "@/lib/search/format-search-results";
import type { Customer } from "@/types/domain/customer";
import type { Pet } from "@/types/domain/pet";

interface HeaderProps {
  clinicName?: string;
  clinicLocation?: string;
  openEscalations?: number;
}

export function Header({
  clinicName = "Get A Vet",
  clinicLocation = "מגדלי גינדי TLV · תל אביב",
  openEscalations = 0,
}: HeaderProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultRow[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    setLoading(true);
    const t = setTimeout(() => {
      void (async () => {
        try {
          const [customersRes, petsRes] = await Promise.all([
            fetch(`/api/search?entity=customers&q=${encodeURIComponent(trimmed)}`),
            fetch(`/api/search?entity=pets&q=${encodeURIComponent(trimmed)}`),
          ]);
          const customersData = customersRes.ok
            ? (await customersRes.json()) as { data: { customers: Customer[] } }
            : { data: { customers: [] } };
          const petsData = petsRes.ok
            ? (await petsRes.json()) as { data: { pets: Pet[] } }
            : { data: { pets: [] } };
          setResults(formatSearchResults(customersData.data.customers, petsData.data.pets));
          setOpen(true);
        } finally {
          setLoading(false);
        }
      })();
    }, 300);

    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const goToResult = useCallback((row: SearchResultRow) => {
    setOpen(false);
    setQuery("");
    router.push(`/dashboard/clients?customerId=${row.customerId}`);
  }, [router]);

  return (
    <header
      className="flex items-center gap-4 px-6 bg-[var(--surface)] border-b border-[var(--line)] flex-shrink-0"
      style={{ height: "var(--header-h)" }}
    >
      {/* Search */}
      <div className="relative flex-1 max-w-[440px]" ref={containerRef}>
        <label className="flex items-center gap-2 px-3 h-9 rounded-[var(--r-md)] bg-[var(--surface-2)] border border-[var(--line)] text-[var(--faint)] focus-within:border-[var(--brand-300)] focus-within:ring-2 focus-within:ring-[var(--brand-100)] transition-all">
          <SearchIcon size={16} className="flex-shrink-0" />
          <input
            type="search"
            placeholder="חיפוש לקוח, חיה..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => { if (results.length > 0) setOpen(true); }}
            className="flex-1 bg-transparent text-[13.5px] text-[var(--ink)] placeholder:text-[var(--faint)] outline-none"
          />
          {loading && (
            <span className="h-3.5 w-3.5 rounded-full border-2 border-[var(--brand-400)] border-t-transparent animate-spin" />
          )}
        </label>

        {open && (
          <div className="absolute top-full mt-2 w-full rounded-[var(--r-lg)] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--sh-lg)] overflow-hidden z-30">
            {results.length === 0 ? (
              <p className="px-4 py-3 text-[13px] text-[var(--faint)]">אין תוצאות</p>
            ) : (
              <ul>
                {results.map((row) => (
                  <li key={`${row.kind}-${row.id}`}>
                    <button
                      onClick={() => goToResult(row)}
                      className="flex w-full items-center justify-between px-4 py-2.5 text-start hover:bg-[var(--surface-2)] transition-colors"
                    >
                      <span className="text-[13.5px] font-semibold text-[var(--ink)]">{row.title}</span>
                      <span className="text-[11px] text-[var(--muted)]">
                        {row.kind === "pet" ? `🐾 ${row.subtitle}` : row.subtitle}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Clinic info */}
      <div className="text-end">
        <p className="text-[13.5px] font-semibold text-[var(--ink)]">{clinicName}</p>
        <p className="text-[11px] text-[var(--muted)]">{clinicLocation}</p>
      </div>

      {/* Separator */}
      <div className="h-7 w-px bg-[var(--line)]" />

      {/* Bell */}
      <Link
        href="/dashboard/escalations"
        className="relative flex items-center justify-center h-9 w-9 rounded-[var(--r-md)] text-[var(--ink-2)] hover:bg-[var(--surface-2)] hover:text-[var(--brand-600)] transition-colors"
        aria-label={`${openEscalations} אסקלציות פתוחות`}
      >
        <BellIcon size={20} />
        {openEscalations > 0 && (
          <span className="absolute -top-0.5 -end-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-[var(--red-500)] text-white text-[9px] font-bold px-1 leading-none">
            {openEscalations}
          </span>
        )}
      </Link>
    </header>
  );
}
```

- [x] **Step 7: Make the clients page open a customer's profile when linked to via `?customerId=`**

In `app/app/dashboard/clients/page.tsx`, add the `useSearchParams` import at the top (next to the existing `react` import on line 2):

```tsx
import { useSearchParams } from "next/navigation";
```

Then inside `export default function ClientsPage()` (currently starting at line 243), add this effect right after the existing `useEffect` that debounces `query` (currently lines 272–275):

```tsx
  // Deep-link: /dashboard/clients?customerId=<id> opens that customer's profile directly
  const searchParams = useSearchParams();
  useEffect(() => {
    const customerId = searchParams.get("customerId");
    if (!customerId) return;
    void (async () => {
      const res = await fetch(`/api/customers/${customerId}`);
      if (res.ok) {
        const d = await res.json() as { data: Customer };
        setSelected(d.data);
      }
    })();
  }, [searchParams]);
```

- [x] **Step 8: Run the full unit test suite to confirm nothing broke**

```bash
cd app && npm run test
```

Expected: all existing tests still PASS, plus the 3 new `format-search-results` tests.

- [x] **Step 9: Drive the real UI to confirm the search works end-to-end**

```bash
cd app && PORT=3001 npm run dev &
sleep 4
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/dashboard
```

Then, in a real browser (or via Playwright per the `run` skill) at `http://localhost:3001/dashboard`: log in, type at least 2 characters of a real customer or pet name into the header search box, confirm a dropdown appears within ~300ms with matching results, click one, and confirm it navigates to `/dashboard/clients?customerId=...` with that customer's profile drawer already open.

- [x] **Step 10: Commit**

```bash
git add app/components/dashboard/header.tsx app/app/dashboard/clients/page.tsx
git commit -m "feat(dashboard): wire up global header search to existing search API"
```

---

## Done criteria for this plan

- Every screen renders in the new cool slate/teal palette (no orange left).
- Typing 2+ characters in the header search shows live, real results from Supabase.
- Clicking a result opens that customer's existing profile drawer, whether it's a customer or one of their pets.
- `npm run test` and `npm run typecheck` both pass in `app/`.
