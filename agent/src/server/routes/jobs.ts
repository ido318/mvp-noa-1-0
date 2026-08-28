import { Hono } from "hono";
import { getEnv } from "../../lib/env.js";
import { processNotifications } from "../../services/notification.processor.js";
import { analyzeConversations } from "../../lib/learning/analyzeConversations.js";
import { logger } from "../../lib/logger.js";
import { isValidBearerToken } from "../middleware/bearerAuth.js";

export const jobsRoutes = new Hono();

jobsRoutes.post("/process-notifications", async (c) => {
  if (!isValidBearerToken(c.req.header("Authorization"), getEnv().JOBS_BEARER_TOKEN)) {
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

jobsRoutes.post("/analyze-conversations", async (c) => {
  const env = getEnv();

  if (!isValidBearerToken(c.req.header("Authorization"), env.JOBS_BEARER_TOKEN)) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await c.req.json().catch(() => ({}));
  const clinicId = typeof body.clinicId === "string" ? body.clinicId : env.AGENT_CLINIC_ID;

  try {
    const result = await analyzeConversations(clinicId);
    logger.info(result, "analyzeConversations complete");
    return c.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ error: message }, "analyzeConversations failed");
    return c.json({ error: message }, 500);
  }
});
