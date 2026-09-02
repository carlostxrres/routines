import type { RoutineWithPlans } from "@shared/types";
import type { RoutineInput } from "@shared/validation";
import { parseDate, type Temporal, today } from "@/lib/temporal";

// The shape the routine editor holds while you type. It mirrors the API
// payload, with two differences: times are "HH:MM" (what <input type="time">
// speaks) and plan actions carry no position, since their order is the array
// order.

export type DraftPlannedAction = { id: string; name: string; equipment: string };
export type DraftPlanAction = { plannedActionId: string; lengthMinutes: number };

export type DraftPlan = {
  id: string;
  startTime: string | null;
  periodStart: string;
  periodEnd: string | null;
  actions: DraftPlanAction[];
};

export type RoutineDraft = {
  name: string;
  // Shared by every plan of the routine: editing a name here changes it
  // everywhere, which is the point — the id is what ties the history together.
  //
  // Actions no plan uses any more are kept rather than pruned. They cost one
  // row, they stay available in the "reusar acción" picker, and deleting one
  // would sever the link from every round that ever recorded it.
  plannedActions: DraftPlannedAction[];
  plans: DraftPlan[];
};

// <input type="time"> wants "HH:MM"; Postgres hands back "HH:MM:SS".
export function toInputTime(value: string | null): string {
  return value === null ? "" : value.slice(0, 5);
}

export function emptyDraft(startDate: Temporal.PlainDate = today()): RoutineDraft {
  return {
    name: "",
    plannedActions: [],
    plans: [
      {
        id: crypto.randomUUID(),
        startTime: "07:00",
        periodStart: startDate.toString(),
        periodEnd: null,
        actions: [],
      },
    ],
  };
}

export function draftFromRoutine(routine: RoutineWithPlans): RoutineDraft {
  return {
    name: routine.name,
    plannedActions: routine.plannedActions.map((action) => ({
      id: action.id,
      name: action.name,
      equipment: action.equipment,
    })),
    plans: [...routine.plans]
      .sort((a, b) => (a.periodStart < b.periodStart ? -1 : 1))
      .map((plan) => ({
        id: plan.id,
        startTime: toInputTime(plan.startTime) || null,
        periodStart: plan.periodStart,
        periodEnd: plan.periodEnd,
        actions: [...plan.actions]
          .sort((a, b) => a.position - b.position)
          .map((action) => ({
            plannedActionId: action.plannedActionId,
            lengthMinutes: action.lengthMinutes,
          })),
      })),
  };
}

export function draftToInput(draft: RoutineDraft): RoutineInput {
  return {
    name: draft.name.trim(),
    plannedActions: draft.plannedActions.map((action) => ({
      id: action.id,
      name: action.name.trim(),
      equipment: action.equipment.trim(),
    })),
    plans: draft.plans.map((plan) => ({
      id: plan.id,
      startTime: plan.startTime,
      periodStart: plan.periodStart,
      periodEnd: plan.periodEnd,
      actions: plan.actions,
    })),
  };
}

// A new plan almost always continues where the last one stopped — a changed
// start time, a holiday schedule — so it starts the day after the latest plan
// ends and inherits its actions. The previous open-ended plan gets closed off
// the day before, which is also what keeps plans_no_overlap satisfied.
export function appendPlan(draft: RoutineDraft): RoutineDraft {
  const plans = [...draft.plans];
  const last = plans[plans.length - 1];
  const start = last ? nextDay(last.periodEnd ?? today().toString()) : today().toString();

  if (last && last.periodEnd === null) {
    plans[plans.length - 1] = { ...last, periodEnd: previousDay(start) };
  }

  plans.push({
    id: crypto.randomUUID(),
    startTime: last?.startTime ?? null,
    periodStart: start,
    periodEnd: null,
    actions: last ? last.actions.map((action) => ({ ...action })) : [],
  });

  return { ...draft, plans };
}

function nextDay(date: string) {
  return shiftDay(date, 1);
}

function previousDay(date: string) {
  return shiftDay(date, -1);
}

function shiftDay(date: string, days: number) {
  return parseDate(date).add({ days }).toString();
}
