import { Temporal } from "temporal-polyfill";
import { SEED_ROUTINES } from "../shared/seedRoutines.js";
import { client, db } from "./client.js";
import { planActions, plannedActions, plans, routines } from "./schema/index.js";

// Creates the two routines of docs/idea.md so the recording page can be tried
// out without typing 25 actions by hand after every database reset.
//
// Idempotent by name: running it twice does not duplicate anything, and it
// leaves an existing routine of the same name untouched rather than
// overwriting edits made in the app.
async function seed() {
  const existing = await db.query.routines.findMany({ columns: { name: true } });
  const existingNames = new Set(existing.map((routine) => routine.name));

  // Plans start today, so the seeded routines are immediately usable.
  const today = Temporal.Now.plainDateISO("Europe/Madrid").toString();

  for (const seedRoutine of SEED_ROUTINES) {
    if (existingNames.has(seedRoutine.name)) {
      console.log(`- "${seedRoutine.name}" ya existe, se deja como está.`);
      continue;
    }

    await db.transaction(async (tx) => {
      const [routine] = await tx.insert(routines).values({ name: seedRoutine.name }).returning();

      const actions = await tx
        .insert(plannedActions)
        .values(
          seedRoutine.actions.map((action) => ({
            routineId: routine.id,
            name: action.name,
            equipment: action.equipment ?? "",
          })),
        )
        .returning();

      const [plan] = await tx
        .insert(plans)
        .values({
          routineId: routine.id,
          startTime: seedRoutine.startTime,
          periodStart: today,
          periodEnd: null,
        })
        .returning();

      await tx.insert(planActions).values(
        seedRoutine.actions.map((action, position) => ({
          planId: plan.id,
          plannedActionId: actions[position].id,
          lengthMinutes: action.lengthMinutes,
          position,
        })),
      );
    });

    console.log(`+ "${seedRoutine.name}" creada con ${seedRoutine.actions.length} acciones.`);
  }
}

seed()
  .then(() => client.end())
  .catch(async (error) => {
    console.error(error);
    await client.end();
    process.exit(1);
  });
