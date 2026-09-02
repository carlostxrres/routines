import type {
  appSettings,
  performedActions,
  planActions,
  plannedActions,
  plans,
  rounds,
  routines,
} from "../db/schema/index.js";

export type Routine = typeof routines.$inferSelect;
export type PlannedAction = typeof plannedActions.$inferSelect;
export type Plan = typeof plans.$inferSelect;
export type PlanAction = typeof planActions.$inferSelect;
export type Round = typeof rounds.$inferSelect;
export type PerformedAction = typeof performedActions.$inferSelect;
export type AppSettings = typeof appSettings.$inferSelect;

export type PlanWithActions = Plan & { actions: PlanAction[] };

// What /api/routines returns and accepts: a routine is only meaningful with
// its plans and the actions they share.
export type RoutineWithPlans = Routine & {
  plannedActions: PlannedAction[];
  plans: PlanWithActions[];
};

export type RoundWithActions = Round & { actions: PerformedAction[] };
