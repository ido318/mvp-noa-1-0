# Figma Redesign Phase 1: Design Tokens + Shared Shell — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update the dashboard's CSS design tokens and the shared sidebar to match the clinic designer's Figma visual language, without changing any page content, routes, or data fetching.

**Architecture:** Pure token-value + presentational-component change. `app/app/globals.css`'s existing `--brand-*`/`--ink`/`--muted`/`--line` CSS custom properties get their values updated (one new token, `--brand-800`, added to fill a gap in the existing 900→50 scale); `app/components/dashboard/sidebar.tsx`'s nav item list and active/inactive styling are updated. `app/components/dashboard/header.tsx` needs no code changes — every color it uses is already token-driven, so it repaints automatically once the tokens change.

**Tech Stack:** Next.js 16 (App Router), React, Tailwind v4 (`@theme inline` + arbitrary-value `var(--token)` classes), plain CSS custom properties — no component library, no icon library (hand-rolled SVG icon factory in `app/components/dashboard/icons.tsx`).

**Spec:** [docs/superpowers/specs/2026-08-29-figma-visual-redesign-design.md](../specs/2026-08-29-figma-visual-redesign-design.md)

---

### Task 1: Update design tokens to match the Figma palette

**Files:**
- Modify: `app/app/globals.css:4-74`

The Figma file's colors are exactly the Tailwind default teal/slate scale (confirmed by exact hex match). Update existing token values and add one new token (`--brand-800`) for the active-nav text color, which has no existing equivalent.

- [x] **Step 1: Update the `:root` token block**

Replace the `:root { ... }` block (lines 4-74 of `app/app/globals.css`) with:

```css
:root {
  /* Brand (teal — professional/clinical) */
  --brand-900: #0B4F4A;
  --brand-800: #115E59;
  --brand-700: #0F766E;
  --brand-600: #0D9488;
  --brand-500: #2DA89D;
  --brand-400: #5CC0B6;
  --brand-200: #A9E0D9;
  --brand-100: #CCFBF1;
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
  --ink:       #0F172A;
  --ink-2:     #475569;
  --muted:     #94A3B8;
  --faint:     #97A2AD;
  --line:      #E2E8F0;
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

Only `--brand-600`, `--brand-100`, `--ink`, `--ink-2`, `--muted`, `--line` changed value, and `--brand-800` was added. Everything else (shadows, radii, coral/amber/red scales, appointment-type colors, layout vars) is untouched.

- [x] **Step 2: Visual sanity check**

Run: `cd app && npm run dev`
Open `http://localhost:3001/dashboard` in a browser. Confirm the page still renders (no broken CSS var references) and text/borders look slightly cooler/darker than before — this is expected from the `--ink`/`--line` updates. Full nav restyle comes in Task 2; don't judge the sidebar yet.

- [x] **Step 3: Commit**

```bash
cd /Users/idoamsalem/mvp-noa-1-0
git add app/app/globals.css
git commit -m "$(cat <<'EOF'
feat: update dashboard design tokens to match Figma palette

Aligns --brand-600/100, --ink, --ink-2, --muted, --line with the
Tailwind teal/slate scale the clinic designer's Figma file uses;
adds --brand-800 for the active-nav text color introduced in the
next commit. No component changes yet.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Restyle the sidebar nav (pill active state, renamed labels)

**Files:**
- Modify: `app/components/dashboard/sidebar.tsx`

Changes: active nav item becomes a full rounded pill (`--brand-100` bg + `--brand-800` bold text) instead of a transparent background with a 3px inset bar; two labels change (`אסקלציות` → `תשומת לב`, `לקוחות` → `לקוחות ומטופלים`) — routes and all other behavior (badge count, active-path matching) are unchanged. No new nav items — see the spec's "Nav items, restyled only" section for why תקשורת/משימות/מרשמים/מעבדה/דוחות aren't added yet (no page exists for them today).

- [x] **Step 1: Replace the file**

Replace the full contents of `app/components/dashboard/sidebar.tsx` with:

```tsx
"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import {
  TodayIcon, CalendarIcon, CallsIcon, EscalationIcon,
  ClientsIcon, SettingsIcon, ClockIcon,
} from "@/components/dashboard/icons";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  badge?: number;
}

interface SidebarProps {
  openEscalations?: number;
  userName?: string;
  userRole?: string;
}

function NavLink({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const active = pathname === item.href || pathname.startsWith(item.href + "/");

  return (
    <li>
      <Link
        href={item.href}
        className={[
          "flex items-center gap-3 px-3 py-2.5 rounded-[var(--r-md)] text-[13.5px] transition-colors duration-150",
          active
            ? "bg-[var(--brand-100)] text-[var(--brand-800)] font-semibold"
            : "text-[var(--ink-2)] font-medium hover:bg-[var(--surface-2)] hover:text-[var(--ink)]",
        ].join(" ")}
      >
        <item.icon size={18} className="flex-shrink-0" />
        <span className="flex-1">{item.label}</span>
        {item.badge != null && item.badge > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--red-500)] text-white text-[10px] font-bold px-1">
            {item.badge}
          </span>
        )}
      </Link>
    </li>
  );
}

export function Sidebar({ openEscalations = 0, userName = "ד״ר נועה כבשני", userRole = "וטרינרית ראשית" }: SidebarProps) {
  const navItems: NavItem[] = [
    { href: "/dashboard",            label: "היום",              icon: TodayIcon },
    { href: "/dashboard/calendar",   label: "לוח שנה",           icon: CalendarIcon },
    { href: "/dashboard/clients",    label: "לקוחות ומטופלים",   icon: ClientsIcon },
    { href: "/dashboard/calls",      label: "שיחות",             icon: CallsIcon },
    { href: "/dashboard/escalations",label: "תשומת לב",          icon: EscalationIcon, badge: openEscalations },
    { href: "/dashboard/waitlist",   label: "המתנה",             icon: ClockIcon },
    { href: "/dashboard/settings",   label: "הגדרות",            icon: SettingsIcon },
  ];

  return (
    <aside
      className="flex flex-col h-full bg-[var(--surface)] border-e border-[var(--line)]"
      style={{ width: "var(--side-w)" }}
    >
      {/* Logo */}
      <div className="px-5 py-5 border-b border-[var(--line-2)] flex-shrink-0">
        <Image src="/getavet-logo.png" alt="Get A Vet" width={138} height={81} priority className="w-[138px] h-auto" />
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-0.5">
          {navItems.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}
        </ul>
      </nav>

      {/* User card */}
      <div className="flex-shrink-0 border-t border-[var(--line-2)] px-4 py-4">
        <div className="flex items-center gap-3">
          <span
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-white text-xs font-bold"
            style={{ background: "linear-gradient(135deg, var(--brand-400), var(--brand-600))" }}
          >
            נכ
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-[var(--ink)] truncate">{userName}</p>
            <p className="text-[11px] text-[var(--muted)]">{userRole}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
```

What changed vs. the original: the `active` branch of `NavLink`'s class list swaps `bg-[var(--brand-50)] text-[var(--brand-700)] font-bold` for `bg-[var(--brand-100)] text-[var(--brand-800)] font-semibold`; the inactive branch adds an explicit `font-medium` (Figma uses medium weight for inactive items, the old code relied on the browser default); the `<li>` no longer needs `relative` and the trailing "Active indicator bar" `<span>` is deleted (no 3px inset bar in the new design); `navItems` reorders to match Figma (לקוחות ומטופלים moves up, calendar renamed), and the two labels change.

- [x] **Step 2: Run typecheck**

Run: `cd app && npm run typecheck`
Expected: no errors (this is a pure JSX/class-name change, no type surface changed).

- [x] **Step 3: Run the existing test suite**

Run: `cd app && npm run test`
Expected: all existing tests still pass — there is no test file for `sidebar.tsx` today (it's a presentational component with no prior coverage), so this is purely a regression check on everything else.

- [x] **Step 4: Manual browser verification**

With `npm run dev` still running from Task 1, open each of these routes and confirm: the sidebar shows 7 items in the new order with the two renamed labels, the current page's nav item renders as a filled teal pill (not the old inset bar), the red escalation-count badge on "תשומת לב" still appears when there are open escalations, and RTL layout (icon+label order, pill alignment) looks correct:
- `/dashboard` (היום should be active)
- `/dashboard/calendar`
- `/dashboard/clients`
- `/dashboard/calls`
- `/dashboard/escalations` (must show "תשומת לב" as the label, active pill)
- `/dashboard/waitlist`
- `/dashboard/settings`

- [x] **Step 5: Commit**

```bash
cd /Users/idoamsalem/mvp-noa-1-0
git add app/components/dashboard/sidebar.tsx
git commit -m "$(cat <<'EOF'
feat: restyle sidebar nav to match Figma (pill active state)

Active nav item is now a full teal pill instead of a transparent
background + inset bar. Renames two labels to match the designer's
copy: אסקלציות -> תשומת לב, לקוחות -> לקוחות ומטופלים (routes
unchanged). No new nav items yet - see the Phase 1 spec for why.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Update the design spec status and wrap up Phase 1

**Files:**
- Modify: `docs/superpowers/specs/2026-08-29-figma-visual-redesign-design.md`

- [x] **Step 1: Mark Phase 1 as shipped in the spec header**

In `docs/superpowers/specs/2026-08-29-figma-visual-redesign-design.md`, change the `**Status:**` line from:

```
**Status:** Phase 1 approved by user (Ido), pending implementation plan. Phases 2-5 are a roadmap, each needs its own approval before implementation.
```

to:

```
**Status:** Phase 1 shipped (tokens + sidebar). Phases 2-6 are a roadmap, each needs its own approval + spec/plan before implementation.
```

- [x] **Step 2: Commit**

```bash
cd /Users/idoamsalem/mvp-noa-1-0
git add docs/superpowers/specs/2026-08-29-figma-visual-redesign-design.md
git commit -m "$(cat <<'EOF'
docs: mark Figma redesign Phase 1 as shipped

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Self-review notes

- **Spec coverage:** Token mapping table → Task 1. Sidebar active/inactive restyle + nav merge decision → Task 2. Header → explicitly no code change needed (confirmed every color in `header.tsx` is `var(--token)`-driven, so Task 1 repaints it automatically); Step 2/4 manual checks cover verifying it still looks right. Font decision (keep Heebo) → no task needed, it's a "don't change" decision.
- **Nav items without a page today** (תקשורת/משימות/מרשמים/מעבדה/דוחות): deliberately excluded from Task 2's `navItems` array — the spec was corrected during planning to reflect this (see spec's "Nav items, restyled only" section). Flagging this explicitly since it's a change from an earlier, looser reading of the spec.
- **Icons:** confirmed `app/components/dashboard/icons.tsx` already has hand-rolled icons matching every Figma icon needed for the 7 Phase 1 nav items — no new icon components needed this phase.
