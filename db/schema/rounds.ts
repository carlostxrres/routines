import { relations, sql } from "drizzle-orm";
import {
  date,
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { plannedActions, routines } from "./routines.js";

// What the user actually did on one day for one Routine. At most one per
// (routine, date), which is why the recording UI never asks which Plan to use:
// the date picks it.
export const rounds = pgTable(
  "rounds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    routineId: uuid("routine_id")
      .notNull()
      .references(() => routines.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    // The clock start of the round. Every action's duration is measured from
    // here forward, so it is set when the round is created and stays editable.
    startedAt: timestamp("started_at", { withTimezone: true, mode: "string" }).notNull(),
    // When the round was called done. Null while it is still running: this is
    // what separates a live round from a closed one, and what stops the
    // recording page's stopwatch from counting a finished round forever.
    endedAt: timestamp("ended_at", { withTimezone: true, mode: "string" }),
    comments: text("comments").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("rounds_routine_date_unique").on(table.routineId, table.date),
    index("rounds_date_idx").on(table.date),
  ],
);

// One recorded step. Only the *end* is stored: the UI captures exactly one
// instant per action (the "Terminar acción" tap), and every duration is derived
// from consecutive endedAt values (see src/lib/schedule.ts). There is no
// position column on purpose — endedAt is the order, so the two can't drift
// apart when the user goes back to amend a step.
export const performedActions = pgTable(
  "performed_actions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roundId: uuid("round_id")
      .notNull()
      .references(() => rounds.id, { onDelete: "cascade" }),
    // null for a free action typed into the combobox. Set null (not cascade)
    // when a PlannedAction is deleted from a routine: `name` below keeps the
    // history readable.
    plannedActionId: uuid("planned_action_id").references(() => plannedActions.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true, mode: "string" }).notNull(),
    comments: text("comments").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // A planned action is recorded at most once per round, which is what makes
    // "Terminar acción" an upsert and lets the user re-select a step already
    // marked done in order to correct it. Partial, so free actions (null) can
    // repeat as many times as needed.
    uniqueIndex("performed_actions_round_planned_unique")
      .on(table.roundId, table.plannedActionId)
      .where(sql`${table.plannedActionId} is not null`),
    index("performed_actions_round_ended_idx").on(table.roundId, table.endedAt),
  ],
);

export const roundsRelations = relations(rounds, ({ one, many }) => ({
  routine: one(routines, { fields: [rounds.routineId], references: [routines.id] }),
  actions: many(performedActions),
}));

export const performedActionsRelations = relations(performedActions, ({ one }) => ({
  round: one(rounds, { fields: [performedActions.roundId], references: [rounds.id] }),
  plannedAction: one(plannedActions, {
    fields: [performedActions.plannedActionId],
    references: [plannedActions.id],
  }),
}));
