import { describe, expect, it } from "vitest";
import { createAuditLogSchema } from "@/lib/validators/audit";
import { createAIEventSchema } from "@/lib/validators/ai-event";

describe("validators", () => {
  it("rejects invalid audit log payloads", () => {
    const result = createAuditLogSchema.safeParse({
      actorType: "user",
      actorId: "",
      action: "test",
      entityType: "profile",
      entityId: "1",
    });

    expect(result.success).toBe(false);
  });

  it("accepts valid AI event payloads", () => {
    const result = createAIEventSchema.safeParse({
      clinicId: "00000000-0000-4000-8000-000000000001",
      sourceType: "test",
      agentName: "tomer",
      eventType: "foundation_check",
    });

    expect(result.success).toBe(true);
  });
});
