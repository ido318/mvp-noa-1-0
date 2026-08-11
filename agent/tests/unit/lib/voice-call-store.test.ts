import { beforeEach, describe, expect, it, vi } from "vitest";

const { calls, mockUpdate, mockEq, mockSelect, mockUpsert } = vi.hoisted(() => {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const mockSelect = vi.fn((...args: unknown[]) => {
    calls.push({ method: "select", args });
    return Promise.resolve({ data: [{ id: "row-1" }], error: null });
  });
  const mockEq = vi.fn((...args: unknown[]) => {
    calls.push({ method: "eq", args });
    return { select: mockSelect };
  });
  const mockUpdate = vi.fn((...args: unknown[]) => {
    calls.push({ method: "update", args });
    return { eq: mockEq };
  });
  const mockUpsert = vi.fn((...args: unknown[]) => {
    calls.push({ method: "upsert", args });
    return Promise.resolve({ error: null });
  });
  return { calls, mockUpdate, mockEq, mockSelect, mockUpsert };
});

vi.mock("../../../src/lib/supabase.js", () => ({
  getSupabase: vi.fn(() => ({
    from: vi.fn(() => ({
      update: mockUpdate,
      upsert: mockUpsert,
    })),
  })),
}));

import { saveVoiceCall } from "../../../src/lib/store.js";

describe("saveVoiceCall", () => {
  beforeEach(() => {
    calls.length = 0;
    vi.clearAllMocks();
  });

  it("updates the live Twilio row when the ElevenLabs webhook carries twilio_call_sid", async () => {
    await saveVoiceCall(
      "conv_123",
      45,
      true,
      {
        caller_number: "+972541234567",
        twilio_call_sid: "CA1234567890",
      },
      {
        transcript: [{ role: "user", message: "שלום" }],
        aiSummary: "נקבע תור",
        callCategory: "operation",
      },
    );

    expect(mockUpsert).not.toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalledOnce();
    expect(mockUpdate.mock.calls[0]?.[0]).toMatchObject({
      elevenlabs_conversation_id: "conv_123",
      status: "completed",
      duration_seconds: 45,
      from_number: "+972541234567",
      transcript: [{ role: "user", message: "שלום" }],
      ai_summary: "נקבע תור",
      call_category: "operation",
    });
    expect(mockUpdate.mock.calls[0]?.[0]).toHaveProperty("ended_at");
    expect(mockEq).toHaveBeenCalledWith("twilio_call_sid", "CA1234567890");
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("falls back to upsert by conversation id when no row matches twilio_call_sid", async () => {
    mockSelect.mockResolvedValueOnce({ data: [], error: null });

    await saveVoiceCall(
      "conv_456",
      30,
      true,
      {
        caller_number: "+972541234567",
        twilio_call_sid: "CA_stale_sid",
      },
      {},
    );

    expect(mockUpdate).toHaveBeenCalledOnce();
    expect(mockUpsert).toHaveBeenCalledOnce();
    expect(mockUpsert.mock.calls[0]?.[0]).toMatchObject({
      elevenlabs_conversation_id: "conv_456",
      status: "completed",
    });
  });

  it("marks ElevenLabs done webhook payloads as completed", async () => {
    await saveVoiceCall(
      "conv_done",
      12,
      null,
      {
        caller_number: "+972541234567",
        status: "done",
      },
      {
        transcript: [{ role: "user", message: "בדיקה" }],
        aiSummary: "השיחה הסתיימה",
        callCategory: "information",
      },
    );

    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockUpsert).toHaveBeenCalledOnce();
    expect(mockUpsert.mock.calls[0]?.[0]).toMatchObject({
      elevenlabs_conversation_id: "conv_done",
      status: "completed",
      duration_seconds: 12,
      transcript: [{ role: "user", message: "בדיקה" }],
      ai_summary: "השיחה הסתיימה",
      call_category: "information",
    });
    expect(mockUpsert.mock.calls[0]?.[0]).toHaveProperty("ended_at");
  });
});
