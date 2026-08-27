import { describe, it, expect, vi, beforeEach } from "vitest";
import { enqueueDueVaccinationReminders } from "../../../src/lib/vaccinationReminders.js";

// ─────────────────────────────────────────────────────────────────────────────
// Mock Supabase — "vaccinations" select chain + "notifications_log" upsert
// ─────────────────────────────────────────────────────────────────────────────

const mockUpsert = vi.fn().mockResolvedValue({ error: null });
const mockFrom = vi.fn();

vi.mock("../../../src/lib/supabase.js", () => ({
  getSupabase: () => ({
    from: mockFrom,
  }),
}));

function makeVaccinationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "vacc-1",
    vaccine_name: "משושה",
    next_due_at: "2026-09-01",
    clinic_id: "clinic-1",
    pet: { name: "ביסלי" },
    customer: { id: "cust-1", full_name: "שרה", phone: "+972501234567" },
    ...overrides,
  };
}

/** Chainable mock for `.from("vaccinations").select().gte().lte().is().returns()` */
function vaccinationsChain(resolveValue: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  chain["select"] = vi.fn().mockReturnValue(chain);
  chain["gte"] = vi.fn().mockReturnValue(chain);
  chain["lte"] = vi.fn().mockReturnValue(chain);
  chain["is"] = vi.fn().mockReturnValue(chain);
  chain["returns"] = vi.fn().mockResolvedValue(resolveValue);
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUpsert.mockResolvedValue({ error: null });
  mockFrom.mockImplementation((table: string) => {
    if (table === "notifications_log") return { upsert: mockUpsert };
    throw new Error(`unexpected table in default mockFrom: ${table}`);
  });
});

describe("enqueueDueVaccinationReminders", () => {
  it("queries vaccinations for rows due within the next 14 days", async () => {
    const chain = vaccinationsChain({ data: [], error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === "vaccinations") return chain;
      if (table === "notifications_log") return { upsert: mockUpsert };
      throw new Error(`unexpected table: ${table}`);
    });

    await enqueueDueVaccinationReminders();

    expect(mockFrom).toHaveBeenCalledWith("vaccinations");
    expect(chain["gte"]).toHaveBeenCalledWith(
      "next_due_at",
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    );
    expect(chain["lte"]).toHaveBeenCalledWith(
      "next_due_at",
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    );

    // Assert the window is ~14 days wide.
    const gteCall = (chain["gte"] as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const lteCall = (chain["lte"] as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const start = new Date(gteCall[1] as string);
    const end = new Date(lteCall[1] as string);
    const diffDays = Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60_000));
    expect(diffDays).toBe(14);
  });

  it("builds the SMS body via smsTemplates.vaccination_reminder and upserts with vaccination_id", async () => {
    const row = makeVaccinationRow();
    const chain = vaccinationsChain({ data: [row], error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === "vaccinations") return chain;
      if (table === "notifications_log") return { upsert: mockUpsert };
      throw new Error(`unexpected table: ${table}`);
    });

    const result = await enqueueDueVaccinationReminders();

    expect(mockUpsert).toHaveBeenCalledTimes(1);
    const [payload, options] = mockUpsert.mock.calls[0]!;
    expect(payload).toMatchObject({
      clinic_id: "clinic-1",
      customer_id: "cust-1",
      vaccination_id: "vacc-1",
      phone: "+972501234567",
      type: "vaccination_reminder",
      status: "pending",
    });
    expect(payload.body).toContain("שרה");
    expect(payload.body).toContain("ביסלי");
    expect(payload.body).toContain("משושה");
    expect(options).toEqual({ onConflict: "vaccination_id,type", ignoreDuplicates: true });

    expect(result).toEqual({ scanned: 1, enqueued: 1, skippedNoPhone: 0, failed: 0 });
  });

  it("skips a vaccination whose linked customer has no phone number", async () => {
    const row = makeVaccinationRow({
      customer: { id: "cust-2", full_name: "דני", phone: null },
    });
    const chain = vaccinationsChain({ data: [row], error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === "vaccinations") return chain;
      if (table === "notifications_log") return { upsert: mockUpsert };
      throw new Error(`unexpected table: ${table}`);
    });

    const result = await enqueueDueVaccinationReminders();

    expect(mockUpsert).not.toHaveBeenCalled();
    expect(result).toEqual({ scanned: 1, enqueued: 0, skippedNoPhone: 1, failed: 0 });
  });

  it("handles a mix of due vaccinations, enqueuing only the ones with a phone", async () => {
    const withPhone = makeVaccinationRow({ id: "vacc-1", customer: { id: "cust-1", full_name: "שרה", phone: "+972501234567" } });
    const withoutPhone = makeVaccinationRow({ id: "vacc-2", customer: { id: "cust-2", full_name: "דני", phone: null } });
    const chain = vaccinationsChain({ data: [withPhone, withoutPhone], error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === "vaccinations") return chain;
      if (table === "notifications_log") return { upsert: mockUpsert };
      throw new Error(`unexpected table: ${table}`);
    });

    const result = await enqueueDueVaccinationReminders();

    expect(mockUpsert).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ scanned: 2, enqueued: 1, skippedNoPhone: 1, failed: 0 });
  });

  it("throws when the vaccinations query returns an error", async () => {
    const chain = vaccinationsChain({ data: null, error: { message: "DB error" } });
    mockFrom.mockImplementation((table: string) => {
      if (table === "vaccinations") return chain;
      if (table === "notifications_log") return { upsert: mockUpsert };
      throw new Error(`unexpected table: ${table}`);
    });

    await expect(enqueueDueVaccinationReminders()).rejects.toThrow(
      "enqueueDueVaccinationReminders: failed to query vaccinations",
    );
  });

  it("returns zeros without upserting when no vaccinations are due", async () => {
    const chain = vaccinationsChain({ data: [], error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === "vaccinations") return chain;
      if (table === "notifications_log") return { upsert: mockUpsert };
      throw new Error(`unexpected table: ${table}`);
    });

    const result = await enqueueDueVaccinationReminders();

    expect(mockUpsert).not.toHaveBeenCalled();
    expect(result).toEqual({ scanned: 0, enqueued: 0, skippedNoPhone: 0, failed: 0 });
  });
});
