import type { PerformedAction, RoundWithActions } from "@shared/types";
import { describe, expect, it } from "vitest";
import { AFTER_WORK_ACTIONS, buildRoutine, MORNING_ROUTINE } from "@/lib/__fixtures__/routines";
import {
  currentStretchSeconds,
  isRoundDone,
  isRoutineCurrent,
  nextPlannedAction,
  performedSegments,
  planForDate,
  plannedSchedule,
  plannedTotalSeconds,
  roundElapsedSeconds,
  secondsByPlannedAction,
  summarizeRound,
} from "@/lib/schedule";
import { parseDate, Temporal } from "@/lib/temporal";

const morningPlan = MORNING_ROUTINE.plans[0];
const morningSchedule = plannedSchedule(morningPlan, MORNING_ROUTINE.plannedActions);

function startTimes(schedule: ReturnType<typeof plannedSchedule>) {
  return schedule.map((action) => action.startTime?.toString({ smallestUnit: "minute" }) ?? null);
}

describe("plannedSchedule", () => {
  it("reproduces the 'Hora inicio' column of docs/idea.md for 'Mañanas'", () => {
    // The doc's own table, verbatim — except its last row, see below.
    expect(startTimes(morningSchedule).slice(0, 12)).toEqual([
      "07:00", // Levantarse
      "07:05", // Ducha
      "07:15", // Secarse y peinarse
      "07:22", // Hacer la cama
      "07:27", // Vestirse
      "07:32", // Desayuno
      "07:47", // Preparar bocadillo y ensalada
      "07:57", // Recoger cocina
      "08:02", // Lavarse los dientes
      "08:05", // Mochila, llaves, abrigo, zapatos
      "08:10", // Colchón para imprevistos
      "08:15", // Salir de casa
    ]);
  });

  it("starts the last action when the previous one ends, not when it finishes", () => {
    // docs/idea.md lists 8:35 against "Llegar al trabajo", but that is when the
    // 20-minute commute *ends*: it starts at 8:15, right after "Salir de casa"
    // (length 0). The routine as a whole runs 07:00 -> 08:35.
    const commute = morningSchedule[morningSchedule.length - 1];
    expect(commute.name).toBe("Llegar al trabajo");
    expect(commute.startTime?.toString({ smallestUnit: "minute" })).toBe("08:15");
    expect(commute.startTime?.add(commute.length).toString({ smallestUnit: "minute" })).toBe(
      "08:35",
    );
    expect(plannedTotalSeconds(morningSchedule)).toBe(95 * 60);
  });

  it("carries equipment and cumulative offsets through", () => {
    const breakfast = morningSchedule[5];
    expect(breakfast.name).toBe("Desayuno");
    expect(breakfast.equipment).toBe("Comida: desayuno");
    expect(breakfast.offset.total("minute")).toBe(32);
    expect(breakfast.length.total("minute")).toBe(15);
  });

  it("returns offsets but no clock times when the plan has no start time", () => {
    const afterWork = buildRoutine({
      id: "routine-2",
      name: "After work",
      actions: AFTER_WORK_ACTIONS,
      plans: [{ id: "plan-2", startTime: null, periodStart: "2026-09-02", periodEnd: null }],
    });
    const schedule = plannedSchedule(afterWork.plans[0], afterWork.plannedActions);

    expect(schedule.every((action) => action.startTime === null)).toBe(true);
    // "Salir del trabajo" (0) -> "Ir al gimnasio" (15) -> "Cambiarse" (5)
    expect(schedule.map((action) => action.offset.total("minute")).slice(0, 4)).toEqual([
      0, 0, 15, 20,
    ]);
    expect(plannedTotalSeconds(schedule)).toBe(160 * 60);
  });

  it("orders by position, not by array order", () => {
    const shuffled = {
      ...morningPlan,
      actions: [...morningPlan.actions].reverse(),
    };
    expect(startTimes(plannedSchedule(shuffled, MORNING_ROUTINE.plannedActions))).toEqual(
      startTimes(morningSchedule),
    );
  });
});

describe("planForDate", () => {
  const routine = buildRoutine({
    plans: [
      { id: "plan-old", startTime: "07:00:00", periodStart: "2026-01-01", periodEnd: "2026-08-31" },
      { id: "plan-new", startTime: "06:30:00", periodStart: "2026-09-01", periodEnd: null },
    ],
  });

  it("picks exactly one plan on the changeover day", () => {
    expect(planForDate(routine, parseDate("2026-08-31"))?.id).toBe("plan-old");
    expect(planForDate(routine, parseDate("2026-09-01"))?.id).toBe("plan-new");
  });

  it("includes both period boundaries", () => {
    expect(planForDate(routine, parseDate("2026-01-01"))?.id).toBe("plan-old");
  });

  it("returns null outside every period", () => {
    expect(planForDate(routine, parseDate("2025-12-31"))).toBeNull();
  });

  it("treats a null periodEnd as still in force", () => {
    expect(planForDate(routine, parseDate("2030-05-05"))?.id).toBe("plan-new");
    expect(isRoutineCurrent(routine, parseDate("2030-05-05"))).toBe(true);
  });

  it("reports a routine whose plans have all expired as not current", () => {
    const expired = buildRoutine({
      plans: [
        { id: "plan-x", startTime: null, periodStart: "2024-01-01", periodEnd: "2024-12-31" },
      ],
    });
    expect(isRoutineCurrent(expired, parseDate("2026-09-02"))).toBe(false);
  });
});

// ---------------------------------------------------------------------------

const ROUND_START = "2026-09-02T05:00:00.000Z"; // 07:00 in Europe/Madrid

function performed(
  index: number,
  endedAt: string,
  overrides: Partial<PerformedAction> = {},
): PerformedAction {
  return {
    id: `performed-${index}`,
    roundId: "round-1",
    plannedActionId: `routine-1-action-${index}`,
    // Out-of-range indices are how the tests build free actions; `overrides`
    // always supplies a real name in that case.
    name: MORNING_ROUTINE.plannedActions[index]?.name ?? "Acción libre",
    endedAt,
    comments: "",
    createdAt: `2026-09-02T05:00:0${index}.000Z`,
    ...overrides,
  };
}

function buildRound(actions: PerformedAction[], endedAt: string | null = null): RoundWithActions {
  return {
    id: "round-1",
    routineId: "routine-1",
    date: "2026-09-02",
    startedAt: ROUND_START,
    endedAt,
    comments: "",
    createdAt: ROUND_START,
    updatedAt: ROUND_START,
    actions,
  };
}

describe("performedSegments", () => {
  it("chains each action from the end of the previous one", () => {
    const round = buildRound([
      performed(0, "2026-09-02T05:06:00.000Z"), // Levantarse: 6 min
      performed(1, "2026-09-02T05:18:00.000Z"), // Ducha: 12 min
      performed(2, "2026-09-02T05:24:30.000Z"), // Secarse: 6 min 30 s
    ]);

    expect(performedSegments(round).map((s) => s.duration.total("minute"))).toEqual([6, 12, 6.5]);
    expect(performedSegments(round)[0].startedAt.toString()).toBe(
      Temporal.Instant.from(ROUND_START).toString(),
    );
  });

  it("orders by endedAt, so an out-of-order recording still reads correctly", () => {
    const round = buildRound([
      performed(2, "2026-09-02T05:24:00.000Z"),
      performed(0, "2026-09-02T05:06:00.000Z"),
      performed(1, "2026-09-02T05:18:00.000Z"),
    ]);
    expect(performedSegments(round).map((s) => s.name)).toEqual([
      "Levantarse",
      "Ducha",
      "Secarse y peinarse",
    ]);
  });

  it("only shifts the amended action and its successor when a step is corrected", () => {
    const before = buildRound([
      performed(0, "2026-09-02T05:06:00.000Z"),
      performed(1, "2026-09-02T05:18:00.000Z"),
      performed(2, "2026-09-02T05:24:00.000Z"),
    ]);
    const after = buildRound([
      performed(0, "2026-09-02T05:06:00.000Z"),
      performed(1, "2026-09-02T05:20:00.000Z"), // corrected: +2 min
      performed(2, "2026-09-02T05:24:00.000Z"),
    ]);

    expect(performedSegments(before).map((s) => s.duration.total("minute"))).toEqual([6, 12, 6]);
    expect(performedSegments(after).map((s) => s.duration.total("minute"))).toEqual([6, 14, 4]);
  });

  it("gives free actions a null plannedActionId but a real duration", () => {
    const round = buildRound([
      performed(0, "2026-09-02T05:06:00.000Z"),
      performed(99, "2026-09-02T05:11:00.000Z", {
        plannedActionId: null,
        name: "Buscar las llaves",
      }),
    ]);
    const segments = performedSegments(round);
    expect(segments[1].plannedActionId).toBeNull();
    expect(segments[1].duration.total("minute")).toBe(5);
    expect(secondsByPlannedAction(round).size).toBe(1);
  });
});

describe("currentStretchSeconds", () => {
  const at = (iso: string) => Temporal.Instant.from(iso);

  it("is zero while there is no round to count from", () => {
    expect(currentStretchSeconds(null, at("2026-09-02T05:04:00.000Z"))).toBe(0);
  });

  it("counts from the round's start while nothing has been recorded", () => {
    expect(currentStretchSeconds(buildRound([]), at("2026-09-02T05:04:00.000Z"))).toBe(4 * 60);
  });

  it("counts from the last thing recorded, not from the round's start", () => {
    const round = buildRound([
      performed(0, "2026-09-02T05:06:00.000Z"),
      performed(1, "2026-09-02T05:18:00.000Z"),
    ]);
    expect(currentStretchSeconds(round, at("2026-09-02T05:21:30.000Z"))).toBe(210);
  });

  it("is zero when the last thing recorded was marked at a time still to come", () => {
    const round = buildRound([performed(0, "2026-09-02T05:30:00.000Z")]);
    expect(currentStretchSeconds(round, at("2026-09-02T05:10:00.000Z"))).toBe(0);
  });

  // Without this, opening yesterday's round from the history showed a
  // stopwatch counting the hours since it was recorded, and the timeline drew
  // an "in progress" bar long enough to squash both tracks flat.
  it("stops at the round's end however long ago that was", () => {
    const round = buildRound(
      [performed(0, "2026-09-02T05:06:00.000Z")],
      "2026-09-02T05:06:00.000Z",
    );
    expect(currentStretchSeconds(round, at("2026-09-03T09:00:00.000Z"))).toBe(0);
  });

  it("keeps the leftover of a round closed mid-action, frozen at its real length", () => {
    const round = buildRound(
      [performed(0, "2026-09-02T05:06:00.000Z")],
      "2026-09-02T05:11:00.000Z",
    );
    expect(currentStretchSeconds(round, at("2026-09-03T09:00:00.000Z"))).toBe(5 * 60);
  });
});

describe("roundElapsedSeconds", () => {
  const at = (iso: string) => Temporal.Instant.from(iso);

  it("runs from the round's start to now while it is open", () => {
    expect(roundElapsedSeconds(buildRound([]), at("2026-09-02T05:20:00.000Z"))).toBe(20 * 60);
  });

  it("runs from the round's start to its end once it is closed", () => {
    const round = buildRound([], "2026-09-02T06:15:00.000Z");
    expect(roundElapsedSeconds(round, at("2026-09-03T09:00:00.000Z"))).toBe(75 * 60);
  });
});

describe("isRoundDone", () => {
  it("separates a round still in play from one that has been closed", () => {
    expect(isRoundDone(null)).toBe(false);
    expect(isRoundDone(buildRound([]))).toBe(false);
    expect(isRoundDone(buildRound([], "2026-09-02T06:15:00.000Z"))).toBe(true);
  });
});

describe("nextPlannedAction", () => {
  it("returns the first action of the plan for an empty round", () => {
    expect(nextPlannedAction(morningSchedule, buildRound([]))?.name).toBe("Levantarse");
  });

  it("skips every action already recorded, whatever the order they came in", () => {
    const round = buildRound([
      performed(2, "2026-09-02T05:24:00.000Z"),
      performed(0, "2026-09-02T05:06:00.000Z"),
      performed(1, "2026-09-02T05:18:00.000Z"),
    ]);
    expect(nextPlannedAction(morningSchedule, round)?.name).toBe("Hacer la cama");
  });

  it("ignores free actions when deciding what comes next", () => {
    const round = buildRound([
      performed(0, "2026-09-02T05:06:00.000Z"),
      performed(99, "2026-09-02T05:11:00.000Z", { plannedActionId: null, name: "Imprevisto" }),
    ]);
    expect(nextPlannedAction(morningSchedule, round)?.name).toBe("Ducha");
  });

  it("returns null once the whole plan is recorded", () => {
    const round = buildRound(
      MORNING_ROUTINE.plannedActions.map((_, index) =>
        performed(index, `2026-09-02T06:${String(index).padStart(2, "0")}:00.000Z`),
      ),
    );
    expect(nextPlannedAction(morningSchedule, round)).toBeNull();
  });
});

describe("summarizeRound", () => {
  it("compares only against the part of the plan that has been reached", () => {
    // Levantarse planned 5 min, took 6. Ducha planned 10, took 12.
    const round = buildRound([
      performed(0, "2026-09-02T05:06:00.000Z"),
      performed(1, "2026-09-02T05:18:00.000Z"),
    ]);
    const summary = summarizeRound(round, morningSchedule);

    expect(summary.plannedSeconds).toBe(15 * 60);
    expect(summary.performedSeconds).toBe(18 * 60);
    expect(summary.deviationSeconds).toBe(3 * 60);
    expect(summary.progress).toBeCloseTo(2 / 13);
  });

  it("reports no deviation for an empty round rather than the whole plan", () => {
    const summary = summarizeRound(buildRound([]), morningSchedule);
    expect(summary.deviationSeconds).toBe(0);
    expect(summary.progress).toBe(0);
  });
});
