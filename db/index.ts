import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getServerEnv } from "@/lib/env";
import * as schema from "./schema";

const { DATABASE_URL } = getServerEnv();

const client = postgres(DATABASE_URL, { prepare: false });
export const db = drizzle(client, { schema });
