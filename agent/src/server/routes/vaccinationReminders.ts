import { Hono } from "hono";
import { getEnv } from "../../lib/env.js";
import { enqueueDueVaccinationReminders } from "../../lib/vaccinationReminders.js";
import { logger } from "../../lib/logger.js";
import { isValidBearerToken } from "../middleware/bearerAuth.js";

export const vaccinationReminderRoutes = new Hono();

vaccinationReminderRoutes.post("/send-vaccination-reminders", async (c) => {
  if (!isValidBearerToken(c.req.header("Authorization"), getEnv().JOBS_BEARER_TOKEN)) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const result = await enqueueDueVaccinationReminders();
    logger.info(result, "enqueueDueVaccinationReminders complete");
    return c.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ error: message }, "enqueueDueVaccinationReminders failed");
    return c.json({ error: message }, 500);
  }
});
