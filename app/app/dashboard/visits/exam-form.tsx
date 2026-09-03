"use client";
import { Badge } from "@/components/dashboard/ui/badge";
import React from "react";

const SYSTEMS = [
  "כללי",
  "עיניים/אוזניים/אף/גרון",
  "לב וכלי דם",
  "נשימה",
  "מערכת עיכול",
  "שרירים ושלד",
  "עור ופרווה",
  "נוירולוגי",
];

export function ExamForm() {
  return (
    <div id="physical-exam" className="grid gap-2 sm:grid-cols-2">
      {SYSTEMS.map((system) => (
        <div key={system} className="rounded-[var(--radius-2)] border border-[var(--border-hairline)] bg-[var(--surface-sunken)] p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-[var(--text-primary)]">{system}</p>
            <Badge tone="done">תקין</Badge>
          </div>
        </div>
      ))}
    </div>
  );
}
