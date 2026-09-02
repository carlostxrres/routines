import { sql } from "drizzle-orm";
import { Temporal } from "temporal-polyfill";
import { client, db } from "./client.js";
import { performedActions, plannedActions, plans, rounds, routines } from "./schema/index.js";

// Checks the invariants the app leans on but never tests in the unit suite,
// because they live in Postgres rather than in TypeScript: the no-overlap
// EXCLUDE on plans, one round per routine and day, one recording per planned
// action per round, and what a deletion cascades to.
//
// It writes rows, so it refuses to run against a database that already has
// any. Point it at a scratch database:
//
//   podman run -d --rm --name pg -e POSTGRES_PASSWORD=test \
//     -e POSTGRES_DB=routines -p 55432:5432 postgres:16-alpine
//   DIRECT_URL=postgresql://postgres:test@127.0.0.1:55432/routines pnpm db:migrate
//   DATABASE_URL=postgresql://postgres:test@127.0.0.1:55432/routines pnpm db:verify

class NotEmptyError extends Error {}

let failures = 0;
const createdRoutineIds: string[] = [];

async function mustFail(label: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    console.log(`FAIL  ${label} — no saltó ninguna constraint`);
    failures++;
  } catch {
    console.log(`ok    ${label} — rechazado por la base de datos`);
  }
}

async function mustPass(label: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    console.log(`ok    ${label}`);
  } catch (error) {
    console.log(`FAIL  ${label} — ${(error as Error).message.split("\n")[0]}`);
    failures++;
  }
}

async function main() {
  const existing = await db.query.routines.findMany({ columns: { id: true } });
  if (existing.length > 0) {
    throw new NotEmptyError(
      "Esta comprobación escribe filas y la base de datos ya tiene rutinas, así que se detiene aquí.\n" +
        "Apúntala a una base de datos de usar y tirar (ver el comentario al principio del fichero).",
    );
  }

  const [routine] = await db.insert(routines).values({ name: "verify" }).returning();
  createdRoutineIds.push(routine.id);
  const [shower] = await db
    .insert(plannedActions)
    .values({ routineId: routine.id, name: "Ducha" })
    .returning();
  const [dressing] = await db
    .insert(plannedActions)
    .values({ routineId: routine.id, name: "Vestirse" })
    .returning();

  await mustPass("un plan abierto se inserta", () =>
    db.insert(plans).values({ routineId: routine.id, periodStart: "2026-01-01", periodEnd: null }),
  );

  await mustFail("dos planes solapados en la misma rutina", () =>
    db.insert(plans).values({ routineId: routine.id, periodStart: "2026-06-01", periodEnd: null }),
  );

  await mustPass("un plan de otra rutina sí puede solaparse", async () => {
    const [other] = await db.insert(routines).values({ name: "verify 2" }).returning();
    createdRoutineIds.push(other.id);
    await db.insert(plans).values({ routineId: other.id, periodStart: "2026-06-01" });
  });

  const [round] = await db
    .insert(rounds)
    .values({ routineId: routine.id, date: "2026-09-02", startedAt: "2026-09-02T05:00:00Z" })
    .returning();

  await mustFail("dos rounds de la misma rutina el mismo día", () =>
    db
      .insert(rounds)
      .values({ routineId: routine.id, date: "2026-09-02", startedAt: "2026-09-02T06:00:00Z" }),
  );

  await mustPass("registrar una acción planificada", () =>
    db.insert(performedActions).values({
      roundId: round.id,
      plannedActionId: shower.id,
      name: "Ducha",
      endedAt: "2026-09-02T05:10:00Z",
    }),
  );

  await mustFail("la misma acción planificada dos veces en un round", () =>
    db.insert(performedActions).values({
      roundId: round.id,
      plannedActionId: shower.id,
      name: "Ducha",
      endedAt: "2026-09-02T05:20:00Z",
    }),
  );

  // Exactly what a second tap of "Terminar acción" on an already-recorded step
  // issues: it corrects the row instead of duplicating it.
  await mustPass("el upsert corrige la acción en vez de duplicarla", async () => {
    await db
      .insert(performedActions)
      .values({
        roundId: round.id,
        plannedActionId: shower.id,
        name: "Ducha",
        endedAt: "2026-09-02T05:25:00Z",
      })
      .onConflictDoUpdate({
        target: [performedActions.roundId, performedActions.plannedActionId],
        targetWhere: sql`${performedActions.plannedActionId} is not null`,
        set: { endedAt: sql`excluded."ended_at"` },
      });

    const rows = await db.query.performedActions.findMany();
    if (rows.length !== 1) throw new Error(`se esperaba 1 fila, hay ${rows.length}`);
    // Postgres returns "2026-09-02 05:25:00+00", not ISO — parse before comparing.
    if (Temporal.Instant.from(rows[0].endedAt).toString() !== "2026-09-02T05:25:00Z") {
      throw new Error(`endedAt no se actualizó: ${rows[0].endedAt}`);
    }
  });

  await mustPass("dos acciones libres pueden repetirse en el mismo round", async () => {
    for (const at of ["05:30", "05:35"]) {
      await db.insert(performedActions).values({
        roundId: round.id,
        plannedActionId: null,
        name: "Imprevisto",
        endedAt: `2026-09-02T${at}:00Z`,
      });
    }
  });

  await mustPass("quitar una acción de la rutina conserva el histórico", async () => {
    await db.insert(performedActions).values({
      roundId: round.id,
      plannedActionId: dressing.id,
      name: "Vestirse",
      endedAt: "2026-09-02T05:40:00Z",
    });
    await db.delete(plannedActions).where(sql`${plannedActions.id} = ${dressing.id}`);

    const orphan = (await db.query.performedActions.findMany()).find(
      (row) => row.name === "Vestirse",
    );
    if (!orphan) throw new Error("la fila desapareció junto con la acción");
    if (orphan.plannedActionId !== null) throw new Error("el enlace no se puso a null");
  });

  await mustPass("borrar la rutina arrastra sus rounds y acciones", async () => {
    await db.delete(routines).where(sql`${routines.id} = ${routine.id}`);
    const remaining = await db.query.performedActions.findMany();
    if (remaining.length !== 0) throw new Error(`quedan ${remaining.length} acciones`);
  });
}

main()
  .then(async () => {
    // Leaves the database as it was found: empty.
    for (const id of createdRoutineIds) {
      await db.delete(routines).where(sql`${routines.id} = ${id}`);
    }
    console.log(failures === 0 ? "\nTodas las comprobaciones pasan." : `\n${failures} fallos.`);
    await client.end();
    process.exit(failures === 0 ? 0 : 1);
  })
  .catch(async (error) => {
    console.error(error instanceof NotEmptyError ? error.message : error);
    await client.end();
    process.exit(1);
  });
