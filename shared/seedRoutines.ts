// The two routines written out in docs/idea.md, kept as plain data so both the
// seed script and the schedule tests work from the spec itself rather than
// from a copy of it.

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

export const SEED_ROUTINES = [
  { name: "Mañanas", startTime: "07:00:00", actions: MORNING_ACTIONS },
  { name: "After work", startTime: null, actions: AFTER_WORK_ACTIONS },
] as const;
