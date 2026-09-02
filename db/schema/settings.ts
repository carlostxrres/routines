import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

// Single-user app: this table only ever holds one row, keyed by the fixed id
// "default".
export const appSettings = pgTable("app_settings", {
  id: text("id").primaryKey().default("default"),
  // Every timestamptz is stored as an absolute instant; this is the zone it is
  // shown in. See src/lib/temporal.ts.
  timeZone: text("time_zone").notNull().default("Europe/Madrid"),
  // 0=Sun..6=Sat, matching the week view's convention.
  weekStartDay: integer("week_start_day").notNull().default(1),
  // Base hue (0-359) for the per-action colours; the rest are derived from it
  // by the golden angle. See src/lib/actionColors.ts.
  chartHue: integer("chart_hue").notNull().default(30),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
});
