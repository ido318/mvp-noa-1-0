import { RED_FLAGS } from "../knowledge/red-flags.js";

export type RedFlag = {
  id: string;
  name_he: string;
  urgency: number;
  applies_to: string[];
  safe_question_he: string;
};

export function matchRedFlags(
  symptoms: string,
  additionalSigns: string[] = [],
  petSpecies?: string,
): RedFlag[] {
  const haystack = [symptoms, ...additionalSigns].join(" ").toLowerCase();

  const matched: RedFlag[] = [];
  for (const flag of RED_FLAGS) {
    if (petSpecies && !flag.applies_to.includes(petSpecies)) continue;

    const hit = flag.triggers_he.some((trigger) =>
      haystack.includes(trigger.toLowerCase()),
    );
    if (hit) {
      matched.push({
        id: flag.id,
        name_he: flag.name_he,
        urgency: flag.urgency,
        applies_to: [...flag.applies_to],
        safe_question_he: flag.safe_question_he,
      });
    }
  }

  return matched;
}
