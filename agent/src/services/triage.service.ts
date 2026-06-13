import { matchRedFlags as _matchRedFlags, type RedFlag } from "../triage/redFlagMatcher.js";
import { scoreUrgency as _scoreUrgency } from "../triage/urgencyScorer.js";

export type { RedFlag };

export type TriageDecision =
  | "emergency_referral"    // urgency >= 8, any time
  | "urgent_callback"       // urgency 4-7, within business hours
  | "after_hours_referral"  // urgency 4-7, outside business hours
  | "routine";              // urgency < 4, or no flags + no time pressure

export type TriageResult = {
  decision: TriageDecision;
  urgency: number;
  matchedFlags: string[];       // flag ids
  withinBusinessHours: boolean;
};

// ── 4 fixed Hebrew scripts — wording approved by Dr. Noa. Do not change. ───

export const EMERGENCY_SCRIPT =
  'מצב החיה נשמע חירום רפואי. פנו עכשיו לבית חולים וטרינרי הפועל 24 שעות באזורכם — אל תמתינו.';

export const URGENT_CALLBACK_SCRIPT =
  'קיבלתי, אני מעביר את הפנייה לד"ר נועה עכשיו ומנסה למצוא לכם חלון לשיחה קצרה עוד היום. ' +
  'חשוב: אם המצב מחמיר בינתיים — פנו לבית חולים וטרינרי, אל תמתינו.';

export const AFTER_HOURS_SCRIPT =
  'המרפאה סגורה כרגע וד"ר נועה אינה זמינה. ' +
  'אני יכול לקחת פרטים ולקבוע תור או להעביר בקשה שנועה תחזור אליכם כשהמרפאה נפתחת. ' +
  'אם בינתיים מופיע קושי נשימה, התמוטטות, דימום שלא עוצר, חשד להרעלה, בטן נפוחה וקשה, או החמרה חדה — פנו מיד לבית חולים וטרינרי 24/7. ' +
  'רוצים שאבדוק תור קרוב אצל ד"ר נועה?';

export const ROUTINE_SCRIPT =
  'תודה שתיארתם. לא זיהיתי סימנים שמצריכים טיפול חירום, ואשמח לקבוע תור לבדיקה אצל ד"ר נועה — ' +
  'מתי נוח לכם? ואם משהו משתנה או מחמיר — התקשרו אלינו מיד.';

// ── Business-hours check (Asia/Jerusalem, DST-correct via Intl) ─────────────

function israelParts(d: Date): { day: number; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jerusalem",
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(d);

  const weekdayStr = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
  const DAY_MAP: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  const day = DAY_MAP[weekdayStr] ?? 0;
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const minute = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);

  return { day, hour, minute };
}

/**
 * Returns true if `now` falls within Get A Vet business hours:
 * Sun–Thu 08:00–20:00, Fri 08:30–13:00, Sat closed.
 * All times in Asia/Jerusalem (DST-correct).
 */
export function isWithinBusinessHours(now: Date): boolean {
  const { day, hour, minute } = israelParts(now);
  const totalMin = hour * 60 + minute;

  if (day >= 0 && day <= 4) {  // Sun–Thu
    return totalMin >= 8 * 60 && totalMin < 20 * 60;
  }
  if (day === 5) {  // Friday
    return totalMin >= 8 * 60 + 30 && totalMin < 13 * 60;
  }
  return false;  // Saturday
}

// ── Public re-exports for tests ──────────────────────────────────────────────

export function matchRedFlags(text: string): RedFlag[] {
  return _matchRedFlags(text);
}

export function scoreUrgency(flags: RedFlag[], durationHint?: string): number {
  return _scoreUrgency(flags, { durationHe: durationHint });
}

// ── Core decision ─────────────────────────────────────────────────────────────

export function decideTriage(input: { text: string; now: Date }): TriageResult {
  const { text, now } = input;

  const flags = _matchRedFlags(text);
  // Pass full text as duration hint so "פתאום"/"עכשיו" affect base score
  const urgency = _scoreUrgency(flags, { durationHe: text });
  const matchedFlags = flags.map((f) => f.id);
  const withinBusinessHours = isWithinBusinessHours(now);

  let decision: TriageDecision;
  if (urgency >= 8) {
    decision = "emergency_referral";
  } else if (urgency >= 4 && withinBusinessHours) {
    decision = "urgent_callback";
  } else if (urgency >= 4 && !withinBusinessHours) {
    decision = "after_hours_referral";
  } else {
    decision = "routine";
  }

  return { decision, urgency, matchedFlags, withinBusinessHours };
}
