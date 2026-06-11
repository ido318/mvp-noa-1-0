import { matchRedFlags, type RedFlag } from "./redFlagMatcher.js";
import { scoreUrgency } from "./urgencyScorer.js";

export type PetType = "כלב" | "חתול" | "אחר";

export type TriagePetCaseInput = {
  symptoms_he: string;
  duration_he?: string;
  pet_type: PetType;
  pet_age_years?: number;
  pet_weight_kg?: number;
  additional_signs_he?: string[];
};

export type TriageDecision =
  | "appointment_request"
  | "notify_noa"
  | "emergency_referral"
  | "unsupported_pet"
  | "collect_more_info";

export type TriagePetCaseOutput = {
  decision: TriageDecision;
  urgency_score: number;
  red_flags_matched: string[];
  reason_for_agent_en: string;
  safe_customer_message_he: string;
  next_question_he?: string;
  requires_noa_followup: boolean;
};

export function triagePetCase(input: TriagePetCaseInput): TriagePetCaseOutput {
  if (input.pet_type === "אחר") {
    return {
      decision: "unsupported_pet",
      urgency_score: 0,
      red_flags_matched: [],
      reason_for_agent_en: "Pet type not supported (not dog or cat)",
      safe_customer_message_he:
        "מצטערים, המרפאה מטפלת בכלבים וחתולים בלבד. נשמח להפנות אותך לרופא וטרינרי המתמחה בחיות אקזוטיות.",
      requires_noa_followup: false,
    };
  }

  const flags = matchRedFlags(
    input.symptoms_he,
    input.additional_signs_he ?? [],
    input.pet_type,
  );

  const score = scoreUrgency(flags, {
    petAgeYears: input.pet_age_years,
    petWeightKg: input.pet_weight_kg,
    durationHe: input.duration_he,
  });

  const flagIds = flags.map((f) => f.id);

  if (flags.length > 0 || score >= 8) {
    return {
      decision: "emergency_referral",
      urgency_score: score,
      red_flags_matched: flagIds,
      reason_for_agent_en: `Red flags detected: ${flagIds.join(", ")} (score ${score}/10)`,
      safe_customer_message_he: buildEmergencyMessage(flags),
      next_question_he: flags.length > 0 ? flags[0]!.safe_question_he : undefined,
      requires_noa_followup: true,
    };
  }

  if (score >= 4) {
    return {
      decision: "notify_noa",
      urgency_score: score,
      red_flags_matched: [],
      reason_for_agent_en: `Urgency score ${score}/10 — needs vet attention this week`,
      safe_customer_message_he:
        "נועה תיצור איתך קשר בהקדם. בינתיים, אם המצב מחמיר — פנה/י ישר לחירום וטרינרי.",
      requires_noa_followup: true,
    };
  }

  if (!input.symptoms_he || input.symptoms_he.trim().length < 5) {
    return {
      decision: "collect_more_info",
      urgency_score: 1,
      red_flags_matched: [],
      reason_for_agent_en: "Insufficient symptoms info",
      safe_customer_message_he: "כדי שאוכל לעזור, תוכל/י לספר לי יותר על הסימפטומים?",
      next_question_he: "מה בדיוק שמת/שמת לב אצל החיה?",
      requires_noa_followup: false,
    };
  }

  return {
    decision: "appointment_request",
    urgency_score: score,
    red_flags_matched: [],
    reason_for_agent_en: `Non-urgent case (score ${score}/10)`,
    safe_customer_message_he: "זה לא נשמע דחוף. נשמח לקבוע תור לבדיקה. מתי נוח לך?",
    requires_noa_followup: false,
  };
}

function buildEmergencyMessage(flags: RedFlag[]): string {
  if (flags.length === 0) {
    return "זה נשמע דחוף. ממליץ/ממליצה לפנות עכשיו לחירום וטרינרי 24/7 ולא להמתין.";
  }
  return (
    `זה נשמע דחוף מאוד — ${flags[0]!.name_he} דורש/ת טיפול מיידי. ` +
    "אנא פנה/י עכשיו לבית חולים וטרינרי 24/7 ואל תמתין/מתיני."
  );
}
