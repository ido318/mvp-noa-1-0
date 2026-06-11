import { createRequire } from "module";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { readFileSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));

export type RedFlag = {
  id: string;
  name_he: string;
  urgency: number;
  applies_to: string[];
  safe_question_he: string;
};

type RawRedFlag = RedFlag & {
  triggers_he: string[];
};

let _flags: RawRedFlag[] | null = null;

function loadFlags(): RawRedFlag[] {
  if (_flags) return _flags;
  const path = join(__dirname, "../knowledge/red_flags.json");
  _flags = JSON.parse(readFileSync(path, "utf-8")) as RawRedFlag[];
  return _flags;
}

export function matchRedFlags(
  symptoms: string,
  additionalSigns: string[] = [],
  petSpecies?: string,
): RedFlag[] {
  const flags = loadFlags();
  const haystack = [symptoms, ...additionalSigns].join(" ").toLowerCase();

  const matched: RedFlag[] = [];
  for (const flag of flags) {
    if (petSpecies && !flag.applies_to.includes(petSpecies)) continue;

    const hit = flag.triggers_he.some((trigger) =>
      haystack.includes(trigger.toLowerCase()),
    );
    if (hit) {
      matched.push({
        id: flag.id,
        name_he: flag.name_he,
        urgency: flag.urgency,
        applies_to: flag.applies_to,
        safe_question_he: flag.safe_question_he,
      });
    }
  }

  return matched;
}
