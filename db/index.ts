import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/env";
import * as schema from "./schema";

// Detect environment
const isLocalSupabase = env.DATABASE_URL.includes(":54322");
const isProduction = process.env.NODE_ENV === "production";

// For Supabase production: ensure using pooler connection string
// Supabase pooler uses port 6543 (transaction mode) instead of 5432 (direct)
// The pgbouncer=true param is for older setups, but doesn't hurt
const connectionString =
  isLocalSupabase || env.DATABASE_URL.includes("pgbouncer=true")
    ? env.DATABASE_URL
    : env.DATABASE_URL.includes("?")
      ? `${env.DATABASE_URL}&pgbouncer=true`
      : `${env.DATABASE_URL}?pgbouncer=true`;

// Connection pool configuration optimized for each environment
const poolConfig = {
  prepare: false, // Required for transaction pooling mode
  // Serverless: keep max LOW because each function instance creates its own pool
  // Local: can be slightly higher since it's a single long-running process
  max: isProduction ? 1 : 10,
  idle_timeout: isProduction ? 0 : 20, // Serverless: close immediately when idle
  connect_timeout: 10,
};

// Singleton pattern prevents multiple clients during Next.js hot reload (dev only)
const globalForDb = globalThis as unknown as {
  client: ReturnType<typeof postgres> | undefined;
};

const client = globalForDb.client ?? postgres(connectionString, poolConfig);

// Only cache in development - serverless functions are stateless anyway
if (!isProduction) {
  globalForDb.client = client;
}

export const db = drizzle(client, { schema });
