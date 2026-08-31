import React from "react";

const SECTIONS = [
  "Reason & Pre-Visit",
  "Anamnesis",
  "Vitals",
  "Physical Exam",
  "SOAP",
  "Actions",
];

export function VisitSectionNav() {
  return (
    <nav className="flex flex-wrap gap-1.5">
      {SECTIONS.map((section) => (
        <a
          key={section}
          href={`#${section.toLowerCase().replaceAll(" ", "-").replaceAll("&", "and")}`}
          className="rounded-[10px] bg-[var(--surface-2)] px-3 py-1.5 text-xs font-semibold text-[var(--ink-2)] hover:bg-[var(--line-2)]"
        >
          {section}
        </a>
      ))}
    </nav>
  );
}
