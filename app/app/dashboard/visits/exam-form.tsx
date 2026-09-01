"use client";
import { Badge } from "@/components/dashboard/ui/badge";
import React from "react";

const SYSTEMS = [
  "General",
  "Eyes/Ears/Nose/Throat",
  "Cardiovascular",
  "Respiratory",
  "Gastrointestinal",
  "Musculoskeletal",
  "Skin/Coat",
  "Neurological",
];

export function ExamForm() {
  return (
    <div id="physical-exam" className="grid gap-2 sm:grid-cols-2">
      {SYSTEMS.map((system) => (
        <div key={system} className="rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface-2)] p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-[var(--ink)]">{system}</p>
            <Badge tone="done">תקין</Badge>
          </div>
        </div>
      ))}
    </div>
  );
}
