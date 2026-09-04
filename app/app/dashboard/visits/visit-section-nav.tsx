import React from "react";

// Anchor slugs are derived from these — keep them stable and in sync with
// the matching `id` attributes in visit-workspace.tsx / [visitId]/page.tsx.
const SECTIONS = [
  "Reason & Pre-Visit",
  "Anamnesis",
  "Vitals",
  "Physical Exam",
  "SOAP",
  "Actions",
];

const SECTION_LABELS: Record<string, string> = {
  "Reason & Pre-Visit": "רקע לביקור",
  "Anamnesis": "אנמנזה",
  "Vitals": "מדדים חיוניים",
  "Physical Exam": "בדיקה גופנית",
  "SOAP": "SOAP",
  "Actions": "סיום ביקור",
};

export function VisitSectionNav() {
  return (
    <nav className="flex flex-wrap gap-1.5">
      {SECTIONS.map((section) => (
        <a
          key={section}
          href={`#${section.toLowerCase().replaceAll(" ", "-").replaceAll("&", "and")}`}
          className="rounded-[10px] bg-[var(--surface-2)] px-3 py-1.5 text-xs font-semibold text-[var(--ink-2)] hover:bg-[var(--line-2)]"
        >
          {SECTION_LABELS[section] ?? section}
        </a>
      ))}
    </nav>
  );
}
