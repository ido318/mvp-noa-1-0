import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";

const { mockGetSignedUrl, mockSaveIncomingVoiceCall } = vi.hoisted(() => ({
  mockGetSignedUrl: vi.fn(),
  mockSaveIncomingVoiceCall: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("elevenlabs", () => ({
  ElevenLabsClient: vi.fn(function ElevenLabsClient() {
    return {
    conversationalAi: {
      getSignedUrl: mockGetSignedUrl,
    },
    };
  }),
}));

vi.mock("../../../src/lib/store.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/lib/store.js")>();
  return {
    ...actual,
    saveIncomingVoiceCall: mockSaveIncomingVoiceCall,
  };
});

import { twilioRoutes } from "../../../src/server/routes/twilio.js";

function makeApp() {
  const app = new Hono();
  app.route("/", twilioRoutes);
  return app;
}

describe("POST /twilio/voice live call tracking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSignedUrl.mockResolvedValue({
      signed_url: "wss://elevenlabs.test/stream?token=a&mode=voice",
    });
  });

  it("creates an in-progress voice call before returning TwiML", async () => {
    const body = new URLSearchParams({
      CallSid: "CA1234567890",
      From: "+972541234567",
      To: "+972535648742",
    });

    const res = await makeApp().request("/twilio/voice", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    expect(res.status).toBe(200);
    expect(mockSaveIncomingVoiceCall).toHaveBeenCalledWith({
      twilioCallSid: "CA1234567890",
      fromNumber: "+972541234567",
      toNumber: "+972535648742",
      status: "in_progress",
      metadata: {
        CallSid: "CA1234567890",
        From: "+972541234567",
        To: "+972535648742",
      },
    });

    const xml = await res.text();
    expect(xml).toContain('name="caller_number" value="+972541234567"');
    expect(xml).toContain('name="twilio_call_sid" value="CA1234567890"');
  });
});
