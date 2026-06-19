import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const FILES = [
  "app/dashboard/visits/page.tsx",
  "app/dashboard/visits/new/page.tsx",
  "app/dashboard/visits/[visitId]/page.tsx",
  "app/dashboard/visits/visit-form.tsx",
  "app/dashboard/visits/visit-actions.tsx",
  "app/dashboard/visits/visit-ai-summary-section.tsx",
  "app/dashboard/visits/visit-notes-section.tsx",
  "app/dashboard/visits/visit-prescriptions-section.tsx",
  "app/dashboard/visits/visit-vaccinations-section.tsx",
  "app/dashboard/pets/[petId]/page.tsx",
  "app/dashboard/voice/[callId]/page.tsx",
  "app/dashboard/voice/page.tsx",
];

const FORBIDDEN_COPY = [
  "Visit not found",
  "Back to visits",
  "New visit",
  "Chief complaint",
  "Manual visit summary",
  "Visit summaries",
  "Failed to",
  "Saving...",
  "Creating...",
  "No notes yet",
  "No prescriptions yet",
  "No vaccinations",
  "Medication name",
  "Vaccine name",
  "Batch number",
  "Generate draft",
  "Accept summary",
  "Recent visits",
  "Medical history",
  "Voice call detail",
  "Open recording",
];

describe("Hebrew dashboard copy", () => {
  it("keeps medical, pet and call workflow UI copy in Hebrew", () => {
    const combined = FILES.map((file) => readFileSync(join(process.cwd(), file), "utf8")).join("\n");

    for (const phrase of FORBIDDEN_COPY) {
      expect(combined).not.toContain(phrase);
    }
  });
});
