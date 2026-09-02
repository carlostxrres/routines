import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq, sql } from "drizzle-orm";
import { performedActions, rounds } from "../db/schema/index.js";
import {
  performedActionInputSchema,
  performedActionPatchSchema,
} from "../shared/validation/index.js";
import { db } from "./_lib/db.js";
import { createHandler } from "./_lib/http.js";

// The hot path: one row per tap of "Terminar acción", so the payload stays as
// small as possible.

async function touchRound(roundId: string) {
  await db.update(rounds).set({ updatedAt: sql`now()` }).where(eq(rounds.id, roundId));
}

// Upsert, not insert. A planned action can only appear once in a round
// (performed_actions_round_planned_unique), so re-selecting a step already
// marked done and finishing it again corrects the original instead of
// duplicating it. Free actions have a null plannedActionId, which the partial
// index ignores, so they simply always insert.
async function upsert(req: VercelRequest, res: VercelResponse) {
  const input = performedActionInputSchema.parse(req.body);

  const [action] = await db
    .insert(performedActions)
    .values({
      roundId: input.roundId,
      plannedActionId: input.plannedActionId,
      name: input.name,
      endedAt: input.endedAt,
      comments: input.comments,
    })
    .onConflictDoUpdate({
      target: [performedActions.roundId, performedActions.plannedActionId],
      targetWhere: sql`${performedActions.plannedActionId} is not null`,
      set: {
        endedAt: sql`excluded."ended_at"`,
        name: sql`excluded."name"`,
        comments: sql`excluded."comments"`,
      },
    })
    .returning();

  await touchRound(input.roundId);
  res.status(201).json(action);
}

async function update(req: VercelRequest, res: VercelResponse) {
  const id = typeof req.query.id === "string" ? req.query.id : undefined;
  if (!id) {
    res.status(400).json({ error: "Missing id" });
    return;
  }

  const input = performedActionPatchSchema.parse(req.body);
  const [action] = await db
    .update(performedActions)
    .set(input)
    .where(eq(performedActions.id, id))
    .returning();

  if (!action) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  await touchRound(action.roundId);
  res.status(200).json(action);
}

// Deletes one action (?id=) or empties a whole round (?roundId=), which is what
// "Vaciar Round" does.
async function remove(req: VercelRequest, res: VercelResponse) {
  const id = typeof req.query.id === "string" ? req.query.id : undefined;
  const roundId = typeof req.query.roundId === "string" ? req.query.roundId : undefined;

  if (id) {
    const [action] = await db
      .delete(performedActions)
      .where(eq(performedActions.id, id))
      .returning();
    if (action) await touchRound(action.roundId);
    res.status(204).end();
    return;
  }

  if (roundId) {
    await db.delete(performedActions).where(eq(performedActions.roundId, roundId));
    await touchRound(roundId);
    res.status(204).end();
    return;
  }

  res.status(400).json({ error: "Missing id or roundId" });
}

export default createHandler({ POST: upsert, PATCH: update, DELETE: remove });
