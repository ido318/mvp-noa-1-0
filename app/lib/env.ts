import { z } from "zod";

const serverSchema = z.object({
  APP_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_BASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

function parseEnv() {
  const client = clientSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });

  if (!client.success) {
    throw new Error(
      `Invalid public environment variables: ${client.error.message}`,
    );
  }

  const server = serverSchema.safeParse({
    APP_ENV: process.env.APP_ENV,
    APP_BASE_URL: process.env.APP_BASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });

  if (!server.success) {
    throw new Error(
      `Invalid server environment variables: ${server.error.message}`,
    );
  }

  return {
    ...client.data,
    ...server.data,
  };
}

export type Env = ReturnType<typeof parseEnv>;

let cachedEnv: Env | null = null;

export function getEnv(): Env {
  if (!cachedEnv) {
    cachedEnv = parseEnv();
  }
  return cachedEnv;
}

export function resetEnvCache(): void {
  cachedEnv = null;
}
