import type {
  PerformedAction,
  PlannedAction,
  PlanWithActions,
  RoundWithActions,
  RoutineWithPlans,
} from "@shared/types";
import { instantAt, parseDate, parseInstant, parseTime, Temporal } from "@/lib/temporal";

// All of this app's time arithmetic, with no React and no fetching, so it can
// be tested directly against the tables in docs/idea.md.

// ---------------------------------------------------------------------------
// The plan side
// ---------------------------------------------------------------------------

export type ScheduledAction = {
  plannedActionId: string;
  name: string;
  equipment: string;
  length: Temporal.Duration;
  // How far into the routine this action begins. Always meaningful, even for a
  // plan with no fixed start time.
  offset: Temporal.Duration;
  // Wall-clock start, or null when the plan has no fixed start time ("After
  // work" begins whenever work ends).
  startTime: Temporal.PlainTime | null;
};

// The Plan of `routine` that covers `date`, or null if none does. The
// plans_no_overlap constraint guarantees at most one, so the first match is
// the answer.
export function planForDate(
  routine: RoutineWithPlans,
  date: Temporal.PlainDate,
): PlanWithActions | null {
  const iso = date.toString();
  return (
    routine.plans.find(
      (plan) => plan.periodStart <= iso && (plan.periodEnd === null || iso <= plan.periodEnd),
    ) ?? null
  );
}

// Every date on which `routine` has a plan is a date a Round can exist for.
export function coversDate(routine: RoutineWithPlans, date: Temporal.PlainDate): boolean {
  return planForDate(routine, date) !== null;
}

// A routine is "current" if any of its plans reaches today or beyond. The
// /routines list hides the rest by default.
export function isRoutineCurrent(routine: RoutineWithPlans, today: Temporal.PlainDate): boolean {
  const iso = today.toString();
  return routine.plans.some((plan) => plan.periodEnd === null || plan.periodEnd >= iso);
}

// The plan's actions in order, each with its cumulative offset and — when the
// plan has a start time — the clock time it is expected to begin at. This is
// the column "Hora inicio" of the tables in docs/idea.md.
export function plannedSchedule(
  plan: PlanWithActions,
  plannedActions: PlannedAction[],
): ScheduledAction[] {
  const byId = new Map(plannedActions.map((action) => [action.id, action]));
  const start = plan.startTime === null ? null : parseTime(plan.startTime);

  let offset = Temporal.Duration.from({ minutes: 0 });
  const schedule: ScheduledAction[] = [];

  for (const planAction of [...plan.actions].sort((a, b) => a.position - b.position)) {
    const plannedAction = byId.get(planAction.plannedActionId);
    if (!plannedAction) continue; // defensive: the API always sends both together

    schedule.push({
      plannedActionId: plannedAction.id,
      name: plannedAction.name,
      equipment: plannedAction.equipment,
      length: Temporal.Duration.from({ minutes: planAction.lengthMinutes }),
      offset,
      // PlainTime#add wraps at midnight, which is what a wall clock does for a
      // routine that crosses it.
      startTime: start === null ? null : start.add(offset),
    });
    offset = offset.add({ minutes: planAction.lengthMinutes });
  }

  return schedule;
}

export function plannedTotalSeconds(schedule: ScheduledAction[]): number {
  return schedule.reduce((total, action) => total + action.length.total("second"), 0);
}

// The plan laid onto the absolute timeline of a given day, so it can be drawn
// against a round's real timestamps. Anchored on the plan's start time when it
// has one, and on the round's own start otherwise.
export function plannedInstants(
  schedule: ScheduledAction[],
  date: Temporal.PlainDate,
  fallbackStart: Temporal.Instant,
  timeZone?: string,
): { action: ScheduledAction; startsAt: Temporal.Instant; endsAt: Temporal.Instant }[] {
  const anchor =
    schedule[0]?.startTime === null || schedule.length === 0
      ? fallbackStart
      : instantAt(date, schedule[0].startTime, timeZone);

  return schedule.map((action) => {
    const startsAt = anchor.add(action.offset);
    return { action, startsAt, endsAt: startsAt.add(action.length) };
  });
}

// ---------------------------------------------------------------------------
// The round side
// ---------------------------------------------------------------------------

export type PerformedSegment = {
  id: string;
  plannedActionId: string | null;
  name: string;
  comments: string;
  startedAt: Temporal.Instant;
  endedAt: Temporal.Instant;
  duration: Temporal.Duration;
};

// Recorded actions in the order they actually happened. `endedAt` *is* the
// order — there is no position column — so an amended step slots back into
// place on its own. created_at breaks ties for two actions ended in the same
// instant.
export function orderedActions(round: RoundWithActions): PerformedAction[] {
  return [...round.actions].sort((a, b) => {
    if (a.endedAt !== b.endedAt) return a.endedAt < b.endedAt ? -1 : 1;
    return a.createdAt < b.createdAt ? -1 : 1;
  });
}

// The chain that turns single instants into spans: each action runs from the
// end of the previous one (or from the round's start, for the first).
export function performedSegments(round: RoundWithActions): PerformedSegment[] {
  let cursor = parseInstant(round.startedAt);

  return orderedActions(round).map((action) => {
    const endedAt = parseInstant(action.endedAt);
    const segment: PerformedSegment = {
      id: action.id,
      plannedActionId: action.plannedActionId,
      name: action.name,
      comments: action.comments,
      startedAt: cursor,
      endedAt,
      duration: cursor.until(endedAt),
    };
    cursor = endedAt;
    return segment;
  });
}

// The action the user is presumed to be doing right now: the first one in the
// plan that hasn't been recorded yet. This is what "Acción actual" defaults to,
// and it is what makes the happy path a single repeated tap.
export function nextPlannedAction(
  schedule: ScheduledAction[],
  round: RoundWithActions | null,
): ScheduledAction | null {
  const done = new Set(
    (round?.actions ?? [])
      .map((action) => action.plannedActionId)
      .filter((id): id is string => id !== null),
  );
  return schedule.find((action) => !done.has(action.plannedActionId)) ?? null;
}

export function isActionDone(round: RoundWithActions | null, plannedActionId: string): boolean {
  return (round?.actions ?? []).some((action) => action.plannedActionId === plannedActionId);
}

// ---------------------------------------------------------------------------
// Comparing the two
// ---------------------------------------------------------------------------

export type RoundSummary = {
  segments: PerformedSegment[];
  performedSeconds: number;
  plannedSeconds: number;
  // Positive = the round took longer than the plan.
  deviationSeconds: number;
  // How much of the plan has been recorded, 0..1.
  progress: number;
};

export function summarizeRound(round: RoundWithActions, schedule: ScheduledAction[]): RoundSummary {
  const segments = performedSegments(round);
  const performedSeconds = segments.reduce(
    (total, segment) => total + segment.duration.total("second"),
    0,
  );

  // Only the part of the plan that has actually been reached is comparable: a
  // half-recorded round is not "45 minutes ahead of schedule".
  const done = new Set(segments.map((segment) => segment.plannedActionId));
  const reached = schedule.filter((action) => done.has(action.plannedActionId));
  const plannedSeconds = plannedTotalSeconds(reached);

  return {
    segments,
    performedSeconds,
    plannedSeconds,
    deviationSeconds: performedSeconds - plannedSeconds,
    progress: schedule.length === 0 ? 0 : reached.length / schedule.length,
  };
}

// Per-action durations for one round, keyed by planned action id — the input to
// the /views/actions chart, which plots one line per action across days.
export function secondsByPlannedAction(round: RoundWithActions): Map<string, number> {
  const totals = new Map<string, number>();
  for (const segment of performedSegments(round)) {
    if (segment.plannedActionId === null) continue;
    const seconds = segment.duration.total("second");
    totals.set(segment.plannedActionId, (totals.get(segment.plannedActionId) ?? 0) + seconds);
  }
  return totals;
}

export function roundDate(round: RoundWithActions): Temporal.PlainDate {
  return parseDate(round.date);
}
