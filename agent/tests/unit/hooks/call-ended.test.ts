import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHmac } from "node:crypto";
import { Hono } from "hono";
import { hooksRoutes } from "../../../src/server/routes/hooks.js";

vi.mock("../../../src/lib/store.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/lib/store.js")>();
  return { ...actual, saveVoiceCall: vi.fn().mockResolvedValue(undefined) };
});

// SECRET must match ELEVENLABS_WEBHOOK_SECRET set in tests/setup.ts
const SECRET = "test-secret";

function sign(body: string, timestamp = String(Math.floor(Date.now() / 1000))): string {
  const sig = createHmac("sha256", SECRET)
    .update(`${timestamp}.${body}`)
    .digest("hex");
  return `t=${timestamp},v0=${sig}`;
}

function makeApp() {
  const app = new Hono();
  app.route("/", hooksRoutes);
  return app;
}

const payload = JSON.stringify({ conversation_id: "conv_test123", duration_seconds: 45, success: true });

describe("POST /hooks/call-ended", () => {
  it("returns 200 with valid signature", async () => {
    const res = await makeApp().request("/hooks/call-ended", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "elevenlabs-signature": sign(payload),
      },
      body: payload,
    });
    expect(res.status).toBe(200);
    const json = await res.json() as { ok: boolean };
    expect(json.ok).toBe(true);
  });

  it("returns 401 with wrong signature", async () => {
    const res = await makeApp().request("/hooks/call-ended", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "elevenlabs-signature": "t=1234567890,v0=badhash",
      },
      body: payload,
    });
    expect(res.status).toBe(401);
  });

  it("returns 401 with missing signature header", async () => {
    const res = await makeApp().request("/hooks/call-ended", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
    });
    expect(res.status).toBe(401);
  });
});
