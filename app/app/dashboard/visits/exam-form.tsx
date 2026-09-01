"use client";
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
            <span className="rounded-full bg-[#E9F5EF] px-2 py-0.5 text-[11px] font-semibold text-[#2F7D5B]">Normal</span>
          </div>
        </div>
      ))}
    </div>
  );
}
