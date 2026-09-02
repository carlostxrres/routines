import type { PlanWithActions, RoutineWithPlans } from "@shared/types";

// The two routines written out in docs/idea.md, used both by the tests and by
// db/seed.ts so the schedule maths is checked against the spec itself.

export type SeedAction = { name: string; lengthMinutes: number; equipment?: string };

export const MORNING_ACTIONS: SeedAction[] = [
  { name: "Levantarse", lengthMinutes: 5 },
  { name: "Ducha", lengthMinutes: 10 },
  { name: "Secarse y peinarse", lengthMinutes: 7 },
  { name: "Hacer la cama", lengthMinutes: 5 },
  { name: "Vestirse", lengthMinutes: 5 },
  { name: "Desayuno", lengthMinutes: 15, equipment: "Comida: desayuno" },
  {
    name: "Preparar bocadillo y ensalada",
    lengthMinutes: 10,
    equipment: "Comida: bocadillos y ensalada",
  },
  { name: "Recoger cocina", lengthMinutes: 5 },
  { name: "Lavarse los dientes", lengthMinutes: 3 },
  { name: "Mochila, llaves, abrigo, zapatos", lengthMinutes: 5 },
  { name: "Colchón para imprevistos", lengthMinutes: 5 },
  { name: "Salir de casa", lengthMinutes: 0 },
  { name: "Llegar al trabajo", lengthMinutes: 20 },
];

export const AFTER_WORK_ACTIONS: SeedAction[] = [
  { name: "Salir del trabajo", lengthMinutes: 0 },
  { name: "Ir al gimnasio", lengthMinutes: 15 },
  { name: "Cambiarse", lengthMinutes: 5, equipment: "Ropa de deporte" },
  { name: "Entrenamiento", lengthMinutes: 60, equipment: "Gimnasio" },
  { name: "Ducharse", lengthMinutes: 10, equipment: "Toalla, gel" },
  { name: "Vestirse", lengthMinutes: 5 },
  { name: "Ir al supermercado", lengthMinutes: 10 },
  { name: "Hacer la compra", lengthMinutes: 20, equipment: "Lista de la compra" },
  { name: "Volver a casa", lengthMinutes: 15 },
  { name: "Guardar la compra", lengthMinutes: 10, equipment: "Nevera, despensa" },
  { name: "Colchón para imprevistos", lengthMinutes: 10 },
  { name: "Llegar a casa / rutina terminada", lengthMinutes: 0 },
];

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
