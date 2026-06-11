import { Hono } from "hono";
import { getEnv } from "../../lib/env.js";
import { processNotifications } from "../../services/notification.processor.js";
import { logger } from "../../lib/logger.js";

export const jobsRoutes = new Hono();

jobsRoutes.post("/process-notifications", async (c) => {
  const authHeader = c.req.header("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token || token !== getEnv().JOBS_BEARER_TOKEN) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await c.req.json().catch(() => ({}));
  const appointmentId = typeof body.appointmentId === "string" ? body.appointmentId : undefined;
  const clinicId = typeof body.clinicId === "string" ? body.clinicId : undefined;

  try {
    const result = await processNotifications({ appointmentId, clinicId });
    logger.info(result, "processNotifications complete");
    return c.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ error: message }, "processNotifications failed");
    return c.json({ error: message }, 500);
  }
});
