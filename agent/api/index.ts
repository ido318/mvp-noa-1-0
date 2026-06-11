// Vercel serverless entry point. Local dev still uses src/index.ts (node server).
import { handle } from "hono/vercel";
import { createApp } from "../src/server/app.js";

const app = createApp();

export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const DELETE = handle(app);
export const PATCH = handle(app);
