# Figma Redesign Phase 5: Encounter Workspace + Prescriptions — Design Spec

**Date:** 2026-08-29
**Status:** Approved (standing approval to complete all phases). Kept tight per the same rationale as Phase 4's spec.
**Relation to prior specs:** [2026-08-29-figma-visual-redesign-design.md](2026-08-29-figma-visual-redesign-design.md) — roadmap. Covers `encounter-workspace` (Figma node `5:465`) and `prescription-flow` (`5:821`).

## Key finding (already recorded in the roadmap doc)

`visits`, `medical_notes` (with `soap_subjective/objective/assessment/plan` note types already defined), `prescriptions`, `vaccinations`, and AI visit-summary generation are **all already built and functional** — `app/app/dashboard/visits/[visitId]/page.tsx` plus its six section components (`visit-actions`, `visit-ai-summary-section`, `visit-notes-section`, `visit-prescriptions-section`, `visit-share-section`, `visit-vaccinations-section`) and `visit-form.tsx`/`visits/new/page.tsx`. All of it works, all of it is plain `zinc`/`emerald` Tailwind with no design tokens. **This phase is a restyle + reorganization, not new functionality** — the opposite of what the original 6-phase roadmap assumed ("biggest phase, needs new DB tables").

## Scope

- Restyle all 7 files (page + 6 sections + the new-visit form/page) from `zinc-*`/`emerald-*` classes to the established `var(--token)` system, matching Phase 1-4's visual language. **No logic changes** — every fetch, state machine, and validation stays exactly as it is.
- Reorganize `visits/[visitId]/page.tsx`'s stacked full-width cards into a layout closer to Figma's `encounter-workspace`: a left rail of section anchors (קבלה, ממצאים, בדיקה, הערכה, תוכנית, מרשמים) is Figma's structure, but since the real data model is "chief complaint + a flat list of typed notes" rather than 5 distinct SOAP fields, this phase does **not** invent a fixed one-note-per-section-type UI — it keeps the existing "pick a note type, write it, see the list" pattern (already correct for the data model) and just visually groups notes by type under labeled headings that echo Figma's SOAP sections, rather than fabricating a rigid form the schema doesn't back.
- `prescription-flow`: Figma's modal has more structured fields (dosage, frequency, route, duration, refills) than the current schema (`medicationName` + free-text `instructions`). Per the same reasoning as Phase 4's billing-total decision (don't invent unreviewed structure), this phase does **not** add new prescription columns — it restyles the existing medication-name + instructions form into a cleaner modal-style UI (matching Figma's visual container), with instructions as guided free text (a placeholder suggesting "מינון, תדירות, משך, הנחיות מיוחדות" so the existing single field still captures what Figma's structured fields would have). Structured dosage/frequency/route as separate DB columns is a real, reasonable follow-up but is new schema for existing working data — out of scope for a visual pass.
- AI summary section keeps its exact existing safety copy ("טיוטות AI מחייבות בדיקה ואישור של וטרינר... לא לשליחה ישירה ללקוח") verbatim — this is safety-relevant text, not decorative, and isn't Figma's concern to restyle away.

## Explicitly out of scope

- New prescription fields (dosage/frequency/route/duration as structured columns).
- A literal 5-fixed-field SOAP form — the existing typed-note-list pattern is kept (matches the actual schema).
- Any change to the visit-share SMS flow's behavior, wording, or the frozen AI-safety copy.
