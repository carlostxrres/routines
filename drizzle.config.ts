import { defineConfig } from "drizzle-kit";

// drizzle-kit needs the direct (non-pooled) connection: DDL commands don't
// work reliably through Supabase's Supavisor pooler in transaction mode.
const directUrl = process.env.DIRECT_URL;
if (!directUrl) {
  throw new Error("DIRECT_URL is not set");
}

export default defineConfig({
  schema: "./db/schema/index.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: directUrl,
  },
  strict: true,
});
