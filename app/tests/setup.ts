import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
// Extends `expect` with DOM matchers (toBeInTheDocument, etc.) for React
// Testing Library component tests. A no-op for plain (non-DOM) unit tests.
import "@testing-library/jest-dom/vitest";

function loadEnvFile(filename: string) {
  const path = resolve(process.cwd(), filename);
  if (!existsSync(path)) return;

  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;
    const key = trimmed.slice(0, separatorIndex);
    const value = trimmed.slice(separatorIndex + 1);
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

if (process.env.RUN_INTEGRATION_TESTS === "true") {
  loadEnvFile(".env.local");
} else {
  process.env.APP_ENV ??= "test";
  process.env.APP_BASE_URL ??= "http://localhost:3000";
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://127.0.0.1:54321";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
}
