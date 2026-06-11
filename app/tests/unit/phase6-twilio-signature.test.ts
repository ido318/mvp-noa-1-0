import twilio from "twilio";
import { describe, expect, it } from "vitest";
import {
  mapTwilioCallStatus,
  sanitizeTwilioMetadata,
  validateTwilioSignature,
} from "@/lib/integrations/twilio/signature";

describe("phase6 twilio signature", () => {
  const authToken = "test-auth-token";
  const url = "https://example.com/api/webhooks/twilio/voice/inbound";
  const params = {
    CallSid: "CA123",
    From: "+972501234567",
    To: "+972359012345",
    CallStatus: "ringing",
  };

  it("accepts valid Twilio signatures", () => {
    const signature = twilio.getExpectedTwilioSignature(authToken, url, params);
    expect(validateTwilioSignature(authToken, signature, url, params)).toBe(true);
  });

  it("rejects invalid signatures", () => {
    expect(validateTwilioSignature(authToken, "bad-signature", url, params)).toBe(false);
  });

  it("maps Twilio statuses to domain enum", () => {
    expect(mapTwilioCallStatus("in-progress")).toBe("in_progress");
    expect(mapTwilioCallStatus("no-answer")).toBe("no_answer");
    expect(mapTwilioCallStatus("completed")).toBe("completed");
  });

  it("sanitizes metadata without phone numbers", () => {
    expect(
      sanitizeTwilioMetadata({
        CallStatus: "completed",
        Direction: "inbound",
        Digits: "1",
        ParentCallSid: "CA-parent",
        From: "+972501234567",
      }),
    ).toEqual({
      callStatus: "completed",
      direction: "inbound",
      digits: "1",
      parentCallSid: "CA-parent",
    });
  });
});
