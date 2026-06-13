import { describe, it, expect, vi } from "vitest";
import { Hono } from "hono";

// Must match JOBS_BEARER_TOKEN set in tests/setup.ts
function toolHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "Authorization": "Bearer test-bearer-token-1234567",
  };
}
// Alias used throughout this file
const signedHeaders = (_body: string) => toolHeaders();

import { toolsRoutes } from "../../../src/server/routes/tools.js";

// Mock the Supabase-backed store so tests don't touch the network
vi.mock("../../../src/lib/store.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/lib/store.js")>();
  return {
    ...actual,
    findCustomerByPhone: vi.fn().mockResolvedValue(null),
    addEscalation: vi.fn().mockResolvedValue(undefined),
  };
});

import { addEscalation } from "../../../src/lib/store.js";

function makeApp() {
  const app = new Hono();
  app.route("/", toolsRoutes);
  return app;
}

describe("POST /tools/escalate-to-noa", () => {
  it("returns confirmation with low urgency", async () => {
    const res = await makeApp().request("/tools/escalate-to-noa", {
      method: "POST",
      headers: signedHeaders(JSON.stringify({ reason: "לקוח מבקש שיחה עם נועה", urgency: 3 })),
      body: JSON.stringify({ reason: "לקוח מבקש שיחה עם נועה", urgency: 3 }),
    });
    expect(res.status).toBe(200);
    const json = await res.json() as { result: string };
    expect(json.result).toContain("נועה");
    expect(json.result).toContain("3/10");
    expect(vi.mocked(addEscalation)).toHaveBeenCalledWith({
      reason: "לקוח מבקש שיחה עם נועה",
      urgency: 3,
    });
  });

  it("returns confirmation with high urgency (>=7)", async () => {
    const res = await makeApp().request("/tools/escalate-to-noa", {
      method: "POST",
      headers: signedHeaders(JSON.stringify({ reason: "כלב מקיא דם", urgency: 9 })),
      body: JSON.stringify({ reason: "כלב מקיא דם", urgency: 9 }),
    });
    expect(res.status).toBe(200);
    const json = await res.json() as { result: string };
    expect(json.result).toContain("9/10");
  });
});
