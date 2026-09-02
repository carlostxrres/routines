import { AFTER_WORK_ACTIONS, MORNING_ACTIONS, type SeedAction } from "@shared/seedRoutines";
import type { PlanWithActions, RoutineWithPlans } from "@shared/types";

export { AFTER_WORK_ACTIONS, MORNING_ACTIONS };

// The two routines written out in docs/idea.md, used both by the tests and by
// db/seed.ts so the schedule maths is checked against the spec itself.

// Deterministic ids keep failures readable ("action-3" rather than a uuid).
function actionId(prefix: string, index: number) {
  return `${prefix}-action-${index}`;
}

const CREATED_AT = "2026-01-01T00:00:00.000Z";

export function buildRoutine({
  id = "routine-1",
  name = "Mañanas",
  actions = MORNING_ACTIONS,
  plans,
}: {
  id?: string;
  name?: string;
  actions?: SeedAction[];
  plans: { id: string; startTime: string | null; periodStart: string; periodEnd: string | null }[];
}): RoutineWithPlans {
  const plannedActions = actions.map((action, index) => ({
    id: actionId(id, index),
    routineId: id,
    name: action.name,
    equipment: action.equipment ?? "",
    createdAt: CREATED_AT,
  }));

  const builtPlans: PlanWithActions[] = plans.map((plan) => ({
    id: plan.id,
    routineId: id,
    startTime: plan.startTime,
    periodStart: plan.periodStart,
    periodEnd: plan.periodEnd,
    createdAt: CREATED_AT,
    actions: actions.map((action, index) => ({
      id: `${plan.id}-pa-${index}`,
      planId: plan.id,
      plannedActionId: actionId(id, index),
      lengthMinutes: action.lengthMinutes,
      position: index,
    })),
  }));

  return { id, name, createdAt: CREATED_AT, plannedActions, plans: builtPlans };
}

export const MORNING_ROUTINE = buildRoutine({
  plans: [{ id: "plan-1", startTime: "07:00:00", periodStart: "2026-09-02", periodEnd: null }],
});
