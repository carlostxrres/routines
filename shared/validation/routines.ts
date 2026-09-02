import { z } from "zod";
import { dateString, shortText, timeString } from "./primitives.js";

// Ids are supplied by the client (crypto.randomUUID) rather than assigned by
// the database. A PlannedAction's id is the thread tying rounds across months
// together, so a plan's actions have to be able to point at brand-new planned
// actions inside the very same payload.
const plannedActionInputSchema = z.object({
  id: z.uuid(),
  name: shortText,
  equipment: z.string().trim().max(200).default(""),
});

const planActionInputSchema = z.object({
  plannedActionId: z.uuid(),
  // 0 is legitimate: "Salir de casa" is an instant, not a span.
  lengthMinutes: z
    .int()
    .min(0)
    .max(24 * 60),
});

const planInputSchema = z.object({
  id: z.uuid(),
  // null when the routine has no fixed start time.
  startTime: timeString.nullable(),
  periodStart: dateString,
  // null = open-ended.
  periodEnd: dateString.nullable(),
  // Order is the array order; `position` is derived from the index server-side
  // so the client never has to renumber anything when reordering.
  actions: z.array(planActionInputSchema),
});

export const routineInputSchema = z
  .object({
    name: shortText,
    plannedActions: z.array(plannedActionInputSchema),
    plans: z.array(planInputSchema).min(1),
  })
  .superRefine((input, ctx) => {
    const knownActionIds = new Set(input.plannedActions.map((action) => action.id));

    input.plans.forEach((plan, planIndex) => {
      if (plan.periodEnd !== null && plan.periodEnd < plan.periodStart) {
        ctx.addIssue({
          code: "custom",
          path: ["plans", planIndex, "periodEnd"],
          message: "El fin del periodo es anterior a su inicio.",
        });
      }

      plan.actions.forEach((action, actionIndex) => {
        if (!knownActionIds.has(action.plannedActionId)) {
          ctx.addIssue({
            code: "custom",
            path: ["plans", planIndex, "actions", actionIndex, "plannedActionId"],
            message: "La acción no pertenece a esta rutina.",
          });
        }
      });

      // Mirrors the plans_no_overlap EXCLUDE constraint so the user gets a
      // field-level message instead of a 500 from Postgres.
      for (let other = 0; other < planIndex; other++) {
        const previous = input.plans[other];
        const overlaps =
          plan.periodStart <= (previous.periodEnd ?? "9999-12-31") &&
          previous.periodStart <= (plan.periodEnd ?? "9999-12-31");
        if (overlaps) {
          ctx.addIssue({
            code: "custom",
            path: ["plans", planIndex, "periodStart"],
            message: "Este periodo se solapa con el de otro plan de la misma rutina.",
          });
          break;
        }
      }
    });
  });

export type RoutineInput = z.infer<typeof routineInputSchema>;
