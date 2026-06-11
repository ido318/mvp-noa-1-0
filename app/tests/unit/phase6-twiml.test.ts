import { describe, expect, it } from "vitest";
import {
  buildInitialInboundTwiml,
  buildMenuResponseTwiml,
} from "@/lib/integrations/twilio/twiml";

describe("phase6 twiml", () => {
  it("builds Hebrew inbound greeting with Gather", () => {
    const twiml = buildInitialInboundTwiml();
    expect(twiml).toContain('language="he-IL"');
    expect(twiml).toContain("<Gather");
    expect(twiml).toContain("input=\"dtmf\"");
    expect(twiml).toContain("מרפאה הווטרינרית");
    expect(twiml).toContain("<Hangup/>");
  });

  it("builds menu responses for DTMF digits", () => {
    expect(buildMenuResponseTwiml("1")).toContain("לקביעת תור");
    expect(buildMenuResponseTwiml("2")).toContain("שיחזור");
    expect(buildMenuResponseTwiml("9")).toContain("אינה תקינה");
  });
});
