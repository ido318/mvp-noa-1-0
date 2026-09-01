import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Table-aware Supabase mock: each table has its own FIFO queue of
// {data, error} responses, popped in the exact order the implementation
// issues queries. This lets a single test simulate e.g. the "pets" table
// being hit twice in a row (once by the shared verifyPetOwnership
// cross-check, once by the function's own follow-up query) with two
// different responses.
// ─────────────────────────────────────────────────────────────────────────────

const { queues, setQueue, popResponse } = vi.hoisted(() => {
  const queues: Record<string, Array<{ data: unknown; error: unknown }>> = {};

  function setQueue(table: string, responses: Array<{ data: unknown; error: unknown }>) {
    queues[table] = [...responses];
  }

  function popResponse(table: string): Promise<{ data: unknown; error: unknown }> {
    const queue = queues[table];
    if (!queue || queue.length === 0) {
      return Promise.reject(
        new Error(`patient-lookup-store.test: no mocked response queued for table "${table}"`),
      );
    }
    return Promise.resolve(queue.shift()!);
  }

  return { queues, setQueue, popResponse };
});

vi.mock("../../../src/lib/supabase.js", () => {
  function chainFor(table: string): Record<string, unknown> {
    const chain: Record<string, unknown> = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      in: vi.fn(() => chain),
      is: vi.fn(() => chain),
      not: vi.fn(() => chain),
      order: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      // Terminal call style #1: explicit .maybeSingle()
      maybeSingle: vi.fn(() => popResponse(table)),
      // Terminal call style #2: the query builder itself is awaited directly
      // (no .maybeSingle()/.single() call), e.g. findPetVisitIds.
      then: (onFulfilled: (v: { data: unknown; error: unknown }) => unknown, onRejected: (e: unknown) => unknown) =>
        popResponse(table).then(onFulfilled, onRejected),
    };
    return chain;
  }

  return {
    getSupabase: vi.fn(() => ({
      from: (table: string) => chainFor(table),
    })),
  };
});

import { formatDateHe } from "../../../src/lib/appointments.js";
import {
  getLastVisitPlan,
  getPatientChronicConditions,
  getPatientReminders,
  listCustomerPets,
} from "../../../src/lib/store.js";

const PHONE = "+972541234567";
const VALID_PET_ID = "11111111-1111-4111-8111-111111111111";
const CUSTOMER_ID = "cust-1";
const PET_NAME = "מיקה";
const PET_SPECIES = "כלב";
const NOT_FOUND_HE = "לא מצאתי חיה כזו ברשומות שלך.";

function ownershipQueues(matches = true) {
  setQueue("customers", [{ data: { id: CUSTOMER_ID }, error: null }]);
  setQueue(
    "pets",
    matches
      ? [{ data: { id: VALID_PET_ID, name: PET_NAME, species: PET_SPECIES }, error: null }]
      : [{ data: null, error: null }],
  );
}

beforeEach(() => {
  for (const key of Object.keys(queues)) delete queues[key];
  vi.clearAllMocks();
  vi.useFakeTimers();
  // Israel is UTC+3 (DST) in June — 09:00 UTC is 12:00 local, date unaffected.
  vi.setSystemTime(new Date("2026-06-15T09:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("listCustomerPets", () => {
  it("returns a generic unknown-customer message and no pets for an unrecognised phone", async () => {
    setQueue("customers", [{ data: null, error: null }]);

    const { result, pets } = await listCustomerPets(PHONE);

    expect(result).toContain("לא מוכר");
    expect(pets).toEqual([]);
  });

  it("reports zero pets for a known customer with none registered", async () => {
    setQueue("customers", [{ data: { full_name: "דנה כהן", pets: [] }, error: null }]);

    const { result, pets } = await listCustomerPets(PHONE);

    expect(result).toContain("לא נמצאו חיות רשומות");
    expect(result).toContain("דנה כהן");
    expect(pets).toEqual([]);
  });

  it("names the single pet and includes its id for later tool calls", async () => {
    setQueue("customers", [
      {
        data: { full_name: "דנה כהן", pets: [{ id: VALID_PET_ID, name: PET_NAME, species: PET_SPECIES }] },
        error: null,
      },
    ]);

    const { result, pets } = await listCustomerPets(PHONE);

    expect(result).toContain(PET_NAME);
    expect(result).toContain(VALID_PET_ID);
    expect(pets).toEqual([{ id: VALID_PET_ID, name: PET_NAME, species: PET_SPECIES }]);
  });

  it("lists every pet with disambiguating detail when the customer has more than one", async () => {
    const petTwo = { id: "22222222-2222-4222-8222-222222222222", name: "לונה", species: "חתול" };
    setQueue("customers", [
      {
        data: {
          full_name: "דנה כהן",
          pets: [{ id: VALID_PET_ID, name: PET_NAME, species: PET_SPECIES }, petTwo],
        },
        error: null,
      },
    ]);

    const { result, pets } = await listCustomerPets(PHONE);

    expect(result).toContain(PET_NAME);
    expect(result).toContain(petTwo.name);
    expect(result).toContain(VALID_PET_ID);
    expect(result).toContain(petTwo.id);
    expect(result).toContain("לאיזו חיה");
    expect(pets).toHaveLength(2);
  });
});

describe("pet-scoped lookups — shared ownership cross-check", () => {
  it("getPatientReminders rejects a malformed pet_id without querying Supabase", async () => {
    const result = await getPatientReminders(PHONE, "not-a-uuid");
    expect(result).toBe(NOT_FOUND_HE);
  });

  it("getPatientChronicConditions rejects a malformed pet_id without querying Supabase", async () => {
    const result = await getPatientChronicConditions(PHONE, "not-a-uuid");
    expect(result).toBe(NOT_FOUND_HE);
  });

  it("getLastVisitPlan rejects a malformed pet_id without querying Supabase", async () => {
    const result = await getLastVisitPlan(PHONE, "not-a-uuid");
    expect(result).toBe(NOT_FOUND_HE);
  });

  it("getPatientReminders rejects a well-formed pet_id owned by a different customer", async () => {
    ownershipQueues(false);
    const result = await getPatientReminders(PHONE, VALID_PET_ID);
    expect(result).toBe(NOT_FOUND_HE);
  });

  it("getPatientChronicConditions rejects a well-formed pet_id owned by a different customer", async () => {
    ownershipQueues(false);
    const result = await getPatientChronicConditions(PHONE, VALID_PET_ID);
    expect(result).toBe(NOT_FOUND_HE);
  });

  it("getLastVisitPlan rejects a well-formed pet_id owned by a different customer", async () => {
    ownershipQueues(false);
    const result = await getLastVisitPlan(PHONE, VALID_PET_ID);
    expect(result).toBe(NOT_FOUND_HE);
  });

  it("rejects when the phone itself is unknown", async () => {
    setQueue("customers", [{ data: null, error: null }]);
    const result = await getPatientReminders(PHONE, VALID_PET_ID);
    expect(result).toBe(NOT_FOUND_HE);
  });
});

describe("getPatientReminders", () => {
  it("reports no reminders when the pet has none pending", async () => {
    ownershipQueues(true);
    setQueue("vaccinations", [{ data: [], error: null }]);

    const result = await getPatientReminders(PHONE, VALID_PET_ID);
    expect(result).toContain("אין תזכורות חיסון ממתינות");
    expect(result).toContain(PET_NAME);
  });

  it("splits vaccinations into overdue and upcoming (60-day window), excluding far-future ones", async () => {
    ownershipQueues(true);
    setQueue("vaccinations", [
      {
        data: [
          { vaccine_name: "חיסון משושה", next_due_at: "2026-05-01" }, // overdue
          { vaccine_name: "חיסון כלבת", next_due_at: "2026-06-20" }, // upcoming, within 60 days
          { vaccine_name: "חיסון מרובע", next_due_at: "2026-12-25" }, // far beyond window
        ],
        error: null,
      },
    ]);

    const result = await getPatientReminders(PHONE, VALID_PET_ID);

    expect(result).toContain("באיחור");
    expect(result).toContain("חיסון משושה");
    expect(result).toContain("קרובים");
    expect(result).toContain("חיסון כלבת");
    expect(result).not.toContain("חיסון מרובע");
  });

  it("gives a positive message when all recorded reminders fall outside the 60-day window", async () => {
    ownershipQueues(true);
    setQueue("vaccinations", [
      { data: [{ vaccine_name: "חיסון מרובע", next_due_at: "2026-12-25" }], error: null },
    ]);

    const result = await getPatientReminders(PHONE, VALID_PET_ID);
    expect(result).toContain("אין תזכורות חיסון קרובות");
  });
});

describe("getPatientChronicConditions", () => {
  it("combines pets.chronic_conditions and medical_records.active_problem_list with a prioritization instruction", async () => {
    ownershipQueues(true);
    setQueue("pets", [
      { data: { id: VALID_PET_ID, name: PET_NAME, species: PET_SPECIES }, error: null }, // ownership check
      { data: { chronic_conditions: "אי ספיקת כליות כרונית" }, error: null }, // direct chronic_conditions query
    ]);
    setQueue("medical_records", [
      {
        data: { active_problem_list: [{ condition: "סוכרת" }, { condition: "דלקת מפרקים", severity: "moderate" }] },
        error: null,
      },
    ]);

    const result = await getPatientChronicConditions(PHONE, VALID_PET_ID);

    expect(result).toContain("אי ספיקת כליות כרונית");
    expect(result).toContain("סוכרת");
    expect(result).toContain("דלקת מפרקים");
    expect(result).toContain('אם בעל החיה מדווח כרגע על החמרה במצב');
  });

  it("returns a plain no-known-conditions message when both sources are empty", async () => {
    ownershipQueues(true);
    setQueue("pets", [
      { data: { id: VALID_PET_ID, name: PET_NAME, species: PET_SPECIES }, error: null },
      { data: { chronic_conditions: null }, error: null },
    ]);
    setQueue("medical_records", [{ data: null, error: null }]);

    const result = await getPatientChronicConditions(PHONE, VALID_PET_ID);
    expect(result).toContain("אין רשומות של מצבים כרוניים");
    expect(result).not.toContain("החמרה");
  });
});

describe("getLastVisitPlan", () => {
  it("returns the approved soap_full note's plan, dated, and filters strictly by note_type + status", async () => {
    ownershipQueues(true);
    setQueue("visits", [{ data: [{ id: "visit-1" }], error: null }]);
    setQueue("medical_notes", [
      { data: { plan: "יש להמשיך תרופה X למשך שבוע", created_at: "2026-06-10T08:00:00Z" }, error: null },
    ]);

    const result = await getLastVisitPlan(PHONE, VALID_PET_ID);

    expect(result).toContain("יש להמשיך תרופה X למשך שבוע");
    expect(result).toContain(formatDateHe("2026-06-10"));
  });

  it("ignores a draft soap_full note's plan and falls back to the visit summary instead", async () => {
    ownershipQueues(true);
    setQueue("visits", [
      { data: [{ id: "visit-1" }], error: null }, // findPetVisitIds
      { data: { manual_visit_summary: "בדיקה שגרתית, הכל תקין", ai_visit_summary: null }, error: null }, // fallback
    ]);
    // Simulating real DB behaviour: a query filtered to status='approved' finds
    // nothing when only a draft soap_full note exists for this pet's visits.
    setQueue("medical_notes", [{ data: null, error: null }]);

    const result = await getLastVisitPlan(PHONE, VALID_PET_ID);

    expect(result).toContain("לא נמצאה תוכנית טיפול מאושרת");
    expect(result).toContain("בדיקה שגרתית, הכל תקין");
    expect(result).not.toContain("תרופה");
  });

  it("falls back to ai_visit_summary when manual_visit_summary is empty", async () => {
    ownershipQueues(true);
    setQueue("visits", [
      { data: [], error: null }, // no visits at all — medical_notes is never queried
      { data: { manual_visit_summary: null, ai_visit_summary: "סיכום AI: מצב יציב" }, error: null },
    ]);

    const result = await getLastVisitPlan(PHONE, VALID_PET_ID);
    expect(result).toContain("סיכום AI: מצב יציב");
  });

  it("reports no follow-up plan on record when nothing at all is found", async () => {
    ownershipQueues(true);
    setQueue("visits", [
      { data: [], error: null },
      { data: null, error: null },
    ]);

    const result = await getLastVisitPlan(PHONE, VALID_PET_ID);
    expect(result).toContain("לא נמצאה תוכנית המשך רשומה");
  });
});
