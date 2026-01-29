import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/env";
import * as schema from "./schema";

// Detect if we're running against Supabase (production/preview) vs local Docker
// Local Supabase uses port 54322 and doesn't support pgbouncer parameter
const isLocalSupabase = env.DATABASE_URL.includes(":54322");

// Use pgBouncer for connection pooling on serverless (Vercel) with Supabase
// Skip for local development since local Supabase doesn't have pgBouncer
const connectionString =
  isLocalSupabase || env.DATABASE_URL.includes("pgbouncer=true")
    ? env.DATABASE_URL
    : env.DATABASE_URL.includes("?")
      ? `${env.DATABASE_URL}&pgbouncer=true`
      : `${env.DATABASE_URL}?pgbouncer=true`;

const client = postgres(connectionString, { prepare: false });
export const db = drizzle(client, { schema });
