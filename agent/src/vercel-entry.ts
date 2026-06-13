// Vercel serverless entry point. Local dev still uses src/index.ts (node server).
import { handle } from "@hono/node-server/vercel";
import { createApp } from "./server/app.js";

const app = createApp();
export default handle(app);
