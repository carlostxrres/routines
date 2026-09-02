import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, asc, eq, notInArray, sql } from "drizzle-orm";
import { planActions, plannedActions, plans, routines } from "../db/schema/index.js";
import { routineInputSchema } from "../shared/validation/index.js";
import { db } from "./_lib/db.js";
import { createHandler } from "./_lib/http.js";

// A routine is only meaningful together with its plans and the actions they
// share, so this endpoint reads and writes the whole tree in one payload —
// the same shape the routine editor holds in a form.
const WITH_TREE = {
  plannedActions: true,
  plans: { with: { actions: true } },
} as const;

async function list(req: VercelRequest, res: VercelResponse) {
  const id = typeof req.query.id === "string" ? req.query.id : undefined;

  if (id) {
    const routine = await db.query.routines.findFirst({
      where: eq(routines.id, id),
      with: WITH_TREE,
    });
    if (!routine) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.status(200).json(routine);
    return;
  }

  const rows = await db.query.routines.findMany({
    orderBy: asc(routines.name),
    with: WITH_TREE,
  });
  res.status(200).json(rows);
}

// Writes the whole tree inside one transaction.
//
// The one asymmetry worth knowing: planned actions are *upserted by id* while
// plan actions are deleted and reinserted. A planned action's id is what ties
// a round recorded in March to one recorded in October, so it has to survive
// every edit; a plan action is a pure join row (which action, how long, in what
// order) with nothing referencing it.
async function writeTree(routineId: string, input: unknown) {
  const parsed = routineInputSchema.parse(input);

  return db.transaction(async (tx) => {
    const [routine] = await tx
      .insert(routines)
      .values({ id: routineId, name: parsed.name })
      .onConflictDoUpdate({ target: routines.id, set: { name: parsed.name } })
      .returning();

    if (parsed.plannedActions.length > 0) {
      await tx
        .insert(plannedActions)
        .values(
          parsed.plannedActions.map((action) => ({
            id: action.id,
            routineId,
            name: action.name,
            equipment: action.equipment,
          })),
        )
        .onConflictDoUpdate({
          target: plannedActions.id,
          set: {
            name: sqlExcluded("name"),
            equipment: sqlExcluded("equipment"),
          },
        });
    }

    // Removing an action from a routine nulls the link on any round that
    // recorded it (ON DELETE SET NULL); the denormalised name keeps the
    // history readable.
    const keptActionIds = parsed.plannedActions.map((action) => action.id);
    await tx
      .delete(plannedActions)
      .where(
        keptActionIds.length > 0
          ? and(
              eq(plannedActions.routineId, routineId),
              notInArray(plannedActions.id, keptActionIds),
            )
          : eq(plannedActions.routineId, routineId),
      );

    const keptPlanIds = parsed.plans.map((plan) => plan.id);
    await tx
      .delete(plans)
      .where(
        keptPlanIds.length > 0
          ? and(eq(plans.routineId, routineId), notInArray(plans.id, keptPlanIds))
          : eq(plans.routineId, routineId),
      );

    for (const plan of parsed.plans) {
      await tx
        .insert(plans)
        .values({
          id: plan.id,
          routineId,
          startTime: plan.startTime,
          periodStart: plan.periodStart,
          periodEnd: plan.periodEnd,
        })
        .onConflictDoUpdate({
          target: plans.id,
          set: {
            startTime: sqlExcluded("start_time"),
            periodStart: sqlExcluded("period_start"),
            periodEnd: sqlExcluded("period_end"),
          },
        });

      await tx.delete(planActions).where(eq(planActions.planId, plan.id));
      if (plan.actions.length > 0) {
        await tx.insert(planActions).values(
          plan.actions.map((action, position) => ({
            planId: plan.id,
            plannedActionId: action.plannedActionId,
            lengthMinutes: action.lengthMinutes,
            // Order is the array order: the editor never renumbers anything.
            position,
          })),
        );
      }
    }

    return routine;
  });
}

async function create(req: VercelRequest, res: VercelResponse) {
  const id = crypto.randomUUID();
  await writeTree(id, req.body);
  const routine = await db.query.routines.findFirst({
    where: eq(routines.id, id),
    with: WITH_TREE,
  });
  res.status(201).json(routine);
}

async function update(req: VercelRequest, res: VercelResponse) {
  const id = typeof req.query.id === "string" ? req.query.id : undefined;
  if (!id) {
    res.status(400).json({ error: "Missing id" });
    return;
  }

  const existing = await db.query.routines.findFirst({ where: eq(routines.id, id) });
  if (!existing) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  await writeTree(id, req.body);
  const routine = await db.query.routines.findFirst({
    where: eq(routines.id, id),
    with: WITH_TREE,
  });
  res.status(200).json(routine);
}

async function remove(req: VercelRequest, res: VercelResponse) {
  const id = typeof req.query.id === "string" ? req.query.id : undefined;
  if (!id) {
    res.status(400).json({ error: "Missing id" });
    return;
  }
  await db.delete(routines).where(eq(routines.id, id));
  res.status(204).end();
}

export default createHandler({ GET: list, POST: create, PATCH: update, DELETE: remove });

// Keeps the onConflictDoUpdate sets readable: `excluded` is the row Postgres
// would have inserted.
function sqlExcluded(column: string) {
  return sql.raw(`excluded."${column}"`);
}
