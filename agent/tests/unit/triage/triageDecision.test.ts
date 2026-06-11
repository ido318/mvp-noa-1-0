import { describe, it, expect } from "vitest";
import { triagePetCase } from "../../../src/triage/triageDecision.js";

// ── חוק ברזל: כל 12 דגלי החירום → emergency_referral ────────────────────────

const EMERGENCY_CASES: { label: string; symptoms_he: string; pet_type: "כלב" | "חתול" }[] = [
  { label: "קושי נשימה", symptoms_he: "הכלב לא נושם", pet_type: "כלב" },
  { label: "לשון סגולה", symptoms_he: "לשון סגולה ופה פתוח", pet_type: "כלב" },
  { label: "חוסר הכרה", symptoms_he: "הכלב התמוטט ולא מגיב", pet_type: "כלב" },
  { label: "פרכוסים", symptoms_he: "יש פרכוסים וגוף מתכווץ", pet_type: "חתול" },
  { label: "דימום משמעותי", symptoms_he: "דם לא עוצר מהפצע", pet_type: "כלב" },
  { label: "חשד הרעלה", symptoms_he: "בלע כדורים שמצא על הרצפה", pet_type: "כלב" },
  { label: "טראומה — נפגע ממכונית", symptoms_he: "נפגע ממכונית ברחוב", pet_type: "כלב" },
  { label: "GDV — בטן נפוחה", symptoms_he: "בטן נפוחה מאוד ומנסה להקיא", pet_type: "כלב" },
  { label: "חתול לא מטיל שתן", symptoms_he: "לא עשה פיפי כבר יומיים", pet_type: "חתול" },
  { label: "הקאה עם דם", symptoms_he: "הקיא דם שחור", pet_type: "כלב" },
  { label: "כאב קיצוני", symptoms_he: "צועק מכאב כשנוגעים בו", pet_type: "חתול" },
  { label: "מכת חום", symptoms_he: "נשאר ברכב ועכשיו לא זז", pet_type: "כלב" },
  { label: "פצע פתוח עמוק", symptoms_he: "נשך כלב גדול ויש פצע עמוק", pet_type: "כלב" },
];

describe("triagePetCase — חוק ברזל: 0 false negatives בחירום", () => {
  for (const tc of EMERGENCY_CASES) {
    it(`${tc.label} → emergency_referral`, () => {
      const out = triagePetCase({
        symptoms_he: tc.symptoms_he,
        pet_type: tc.pet_type,
      });
      expect(out.decision).toBe("emergency_referral");
      expect(out.urgency_score).toBeGreaterThanOrEqual(8);
      expect(out.requires_noa_followup).toBe(true);
    });
  }
});

// ── חיה לא נתמכת ─────────────────────────────────────────────────────────────

describe("triagePetCase — unsupported_pet", () => {
  it("חיה אחרת → unsupported_pet", () => {
    const out = triagePetCase({ symptoms_he: "לא אוכל", pet_type: "אחר" });
    expect(out.decision).toBe("unsupported_pet");
  });
});

// ── מקרים שגרתיים ─────────────────────────────────────────────────────────────

describe("triagePetCase — non-emergency decisions", () => {
  it("שיעול שגרתי → appointment_request", () => {
    const out = triagePetCase({
      symptoms_he: "שיעול קל מאתמול",
      pet_type: "כלב",
      duration_he: "כבר שבוע",
    });
    expect(out.decision).toBe("appointment_request");
    expect(out.urgency_score).toBeLessThan(8);
  });

  it("תסמינים 'פתאום' ללא דגל → notify_noa (score=5)", () => {
    const out = triagePetCase({
      symptoms_he: "לא אוכל ושותה מעט",
      pet_type: "כלב",
      duration_he: "פתאום היום",
    });
    expect(out.decision).toBe("notify_noa");
    expect(out.urgency_score).toBe(5);
  });

  it("תסמינים 'יומיים' ללא דגל → notify_noa (score=4)", () => {
    const out = triagePetCase({
      symptoms_he: "לא אוכל ושותה מעט",
      pet_type: "חתול",
      duration_he: "כבר יומיים",
    });
    expect(out.decision).toBe("notify_noa");
  });
});

// ── אין אבחנה בפלט ─────────────────────────────────────────────────────────────

const FORBIDDEN_MEDICAL_TERMS = [
  "דלקת", "אנטיביוטיקה", "פרצטמול", "אמוקסיצילין",
  "טיפול ביתי", "תן לו", "תני לה", "מינון",
];

describe("triagePetCase — אסור: אבחנה או המלצת תרופה", () => {
  const testCases = [...EMERGENCY_CASES, { label: "שיעול", symptoms_he: "שיעול", pet_type: "כלב" as const }];

  for (const tc of testCases) {
    it(`${tc.label} — פלט לא מכיל מילים רפואיות אסורות`, () => {
      const out = triagePetCase({ symptoms_he: tc.symptoms_he, pet_type: tc.pet_type });
      const allText = [
        out.safe_customer_message_he,
        out.reason_for_agent_en,
        out.next_question_he ?? "",
      ]
        .join(" ")
        .toLowerCase();

      for (const term of FORBIDDEN_MEDICAL_TERMS) {
        expect(allText, `נמצאה מילה אסורה: "${term}"`).not.toContain(term.toLowerCase());
      }
    });
  }
});
