"use client";
import React from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";

const NAV_ITEMS = [
  { href: "/provider-admin/calls", label: "שיחות QA" },
  { href: "/provider-admin/improvements", label: "הצעות תיקון" },
];

export function ProviderAdminSidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="flex flex-col flex-shrink-0"
      style={{ width: "var(--sidebar-w)", background: "var(--rail-bg)" }}
    >
      <div className="px-4 py-5" style={{ borderBottom: "1px solid var(--rail-separator)" }}>
        <p className="text-[13px] font-semibold" style={{ color: "var(--rail-text-strong)" }}>
          Provider Admin
        </p>
        <p className="text-[11px]" style={{ color: "var(--rail-text-muted)" }}>Get A Vet · תומר</p>
      </div>
      <nav className="flex-1 py-3">
        {NAV_ITEMS.map((item) => {
          const active =
            pathname === item.href || pathname?.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className="flex items-center px-4 h-9 mx-2 rounded-[var(--radius-2)] text-[13px] font-medium"
              style={{
                background: active ? "var(--rail-bg-active)" : "transparent",
                color: active ? "var(--rail-text-strong)" : "var(--rail-text)",
                borderInlineStart: active ? "2px solid var(--rail-marker)" : "2px solid transparent",
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
