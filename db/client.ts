import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

// Uses the Supabase pooler (Supavisor, port 6543) connection string.
// Serverless functions open/close connections per invocation, so `max: 1`
// avoids exhausting the pool; prepared statements aren't supported in
// transaction-pooling mode.
export const client = postgres(connectionString, { max: 1, prepare: false });

export const db = drizzle(client, { schema });
