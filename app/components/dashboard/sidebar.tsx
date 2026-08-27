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
    <li className="relative">
      <Link
        href={item.href}
        className={[
          "flex items-center gap-3 px-3 py-2.5 rounded-[var(--r-md)] text-[13.5px] font-medium transition-colors duration-150",
          active
            ? "bg-[var(--brand-50)] text-[var(--brand-700)] font-bold"
            : "text-[var(--ink-2)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]",
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
      {/* Active indicator bar */}
      {active && (
        <span
          className="absolute inset-y-1.5 -start-0 w-[3px] rounded-full bg-[var(--brand-600)]"
          aria-hidden="true"
        />
      )}
    </li>
  );
}

export function Sidebar({ openEscalations = 0, userName = "ד״ר נועה כבשני", userRole = "וטרינרית ראשית" }: SidebarProps) {
  const navItems: NavItem[] = [
    { href: "/dashboard",            label: "היום",         icon: TodayIcon },
    { href: "/dashboard/calendar",   label: "יומן",         icon: CalendarIcon },
    { href: "/dashboard/calls",      label: "שיחות",        icon: CallsIcon },
    { href: "/dashboard/escalations",label: "אסקלציות",     icon: EscalationIcon, badge: openEscalations },
    { href: "/dashboard/waitlist",    label: "המתנה",        icon: ClockIcon },
    { href: "/dashboard/clients",    label: "לקוחות",       icon: ClientsIcon },
    { href: "/dashboard/settings",   label: "הגדרות",       icon: SettingsIcon },
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
