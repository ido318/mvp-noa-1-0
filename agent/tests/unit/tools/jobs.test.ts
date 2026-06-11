import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { jobsRoutes } from "../../../src/server/routes/jobs.js";

vi.mock("../../../src/services/notification.processor.js", () => ({
  processNotifications: vi.fn().mockResolvedValue({
    processed: 1,
    sent: 1,
    failed: 0,
    deferred: 0,
  }),
}));

import { processNotifications } from "../../../src/services/notification.processor.js";

// JOBS_BEARER_TOKEN is set in tests/setup.ts: "test-bearer-token-1234567"
const VALID_TOKEN = "test-bearer-token-1234567";

function makeApp() {
  const app = new Hono();
  app.route("/jobs", jobsRoutes);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(processNotifications).mockResolvedValue({ processed: 1, sent: 1, failed: 0, deferred: 0 });
});

describe("POST /jobs/process-notifications", () => {
  it("returns 401 with no Authorization header", async () => {
    const app = makeApp();
    const res = await app.request("/jobs/process-notifications", { method: "POST" });
    expect(res.status).toBe(401);
    expect(processNotifications).not.toHaveBeenCalled();
  });

  it("returns 401 with wrong token", async () => {
    const app = makeApp();
    const res = await app.request("/jobs/process-notifications", {
      method:  "POST",
      headers: { Authorization: "Bearer wrong-token" },
    });
    expect(res.status).toBe(401);
    expect(processNotifications).not.toHaveBeenCalled();
  });

  it("returns 401 with malformed Authorization (no Bearer prefix)", async () => {
    const app = makeApp();
    const res = await app.request("/jobs/process-notifications", {
      method:  "POST",
      headers: { Authorization: VALID_TOKEN },
    });
    expect(res.status).toBe(401);
  });

  it("returns 200 and calls processNotifications with valid token", async () => {
    const app = makeApp();
    const res = await app.request("/jobs/process-notifications", {
      method:  "POST",
      headers: { Authorization: `Bearer ${VALID_TOKEN}`, "Content-Type": "application/json" },
      body:    JSON.stringify({}),
    });
    expect(res.status).toBe(200);
    expect(processNotifications).toHaveBeenCalledOnce();

    const body = await res.json() as { processed: number; sent: number };
    expect(body.processed).toBe(1);
    expect(body.sent).toBe(1);
  });

  it("passes appointmentId from body to processNotifications", async () => {
    const app = makeApp();
    await app.request("/jobs/process-notifications", {
      method:  "POST",
      headers: { Authorization: `Bearer ${VALID_TOKEN}`, "Content-Type": "application/json" },
      body:    JSON.stringify({ appointmentId: "appt-123" }),
    });
    expect(processNotifications).toHaveBeenCalledWith(
      expect.objectContaining({ appointmentId: "appt-123" }),
    );
  });

  it("passes clinicId from body to processNotifications", async () => {
    const app = makeApp();
    await app.request("/jobs/process-notifications", {
      method:  "POST",
      headers: { Authorization: `Bearer ${VALID_TOKEN}`, "Content-Type": "application/json" },
      body:    JSON.stringify({ clinicId: "clinic-456" }),
    });
    expect(processNotifications).toHaveBeenCalledWith(
      expect.objectContaining({ clinicId: "clinic-456" }),
    );
  });

  it("returns 500 when processNotifications throws", async () => {
    vi.mocked(processNotifications).mockRejectedValueOnce(new Error("DB down"));
    const app = makeApp();
    const res = await app.request("/jobs/process-notifications", {
      method:  "POST",
      headers: { Authorization: `Bearer ${VALID_TOKEN}`, "Content-Type": "application/json" },
      body:    JSON.stringify({}),
    });
    expect(res.status).toBe(500);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("DB down");
  });
});
