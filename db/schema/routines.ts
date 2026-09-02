import { relations } from "drizzle-orm";
import {
  date,
  index,
  integer,
  pgTable,
  text,
  time,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

// A Routine is a purpose ("Mañanas"), not a schedule. Its schedule lives in
// Plans, so the start time or the list of actions can change over time
// (holidays, a new job) without breaking comparability across the history.
export const routines = pgTable("routines", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
});

// The stable identity of "the same action" across every Plan of a Routine —
// this id is what ties a round from March to a round from October in the
// charts, so it must survive plan edits.
export const plannedActions = pgTable("planned_actions", {
  id: uuid("id").primaryKey().defaultRandom(),
  routineId: uuid("routine_id")
    .notNull()
    .references(() => routines.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  // Materials the action needs ("Comida: desayuno"). Usually empty.
  equipment: text("equipment").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
});

// One version of a Routine's schedule, valid over a date range. Two Plans of
// the same Routine may never overlap — enforced by an EXCLUDE constraint added
// by hand in the migration, since drizzle-kit can't express one.
export const plans = pgTable(
  "plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    routineId: uuid("routine_id")
      .notNull()
      .references(() => routines.id, { onDelete: "cascade" }),
    // null when the routine has no fixed start ("After work" begins whenever
    // work ends), in which case the schedule is relative, not clock time.
    startTime: time("start_time"),
    periodStart: date("period_start").notNull(),
    // null = still in force.
    periodEnd: date("period_end"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("plans_routine_period_idx").on(table.routineId, table.periodStart)],
);

// The join row that gives an action its length *in this plan*: the same
// PlannedAction can take 15 minutes in one plan and 25 in another.
export const planActions = pgTable(
  "plan_actions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "cascade" }),
    plannedActionId: uuid("planned_action_id")
      .notNull()
      .references(() => plannedActions.id, { onDelete: "cascade" }),
    lengthMinutes: integer("length_minutes").notNull().default(0),
    position: integer("position").notNull(),
  },
  (table) => [unique("plan_actions_plan_action_unique").on(table.planId, table.plannedActionId)],
);

export const routinesRelations = relations(routines, ({ many }) => ({
  plannedActions: many(plannedActions),
  plans: many(plans),
}));

export const plannedActionsRelations = relations(plannedActions, ({ one, many }) => ({
  routine: one(routines, { fields: [plannedActions.routineId], references: [routines.id] }),
  planActions: many(planActions),
}));

export const plansRelations = relations(plans, ({ one, many }) => ({
  routine: one(routines, { fields: [plans.routineId], references: [routines.id] }),
  actions: many(planActions),
}));

export const planActionsRelations = relations(planActions, ({ one }) => ({
  plan: one(plans, { fields: [planActions.planId], references: [plans.id] }),
  plannedAction: one(plannedActions, {
    fields: [planActions.plannedActionId],
    references: [plannedActions.id],
  }),
}));
