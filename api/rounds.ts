import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { rounds } from "../db/schema/index.js";
import { roundInputSchema, roundPatchSchema } from "../shared/validation/index.js";
import { db } from "./_lib/db.js";
import { createHandler, parseLimit } from "./_lib/http.js";

const WITH_ACTIONS = { actions: true } as const;

async function list(req: VercelRequest, res: VercelResponse) {
  const id = typeof req.query.id === "string" ? req.query.id : undefined;
  if (id) {
    const round = await db.query.rounds.findFirst({
      where: eq(rounds.id, id),
      with: WITH_ACTIONS,
    });
    if (!round) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.status(200).json(round);
    return;
  }

  const routineId = typeof req.query.routineId === "string" ? req.query.routineId : undefined;
  const date = typeof req.query.date === "string" ? req.query.date : undefined;
  const from = typeof req.query.from === "string" ? req.query.from : undefined;
  const to = typeof req.query.to === "string" ? req.query.to : undefined;

  const rows = await db.query.rounds.findMany({
    where: and(
      routineId ? eq(rounds.routineId, routineId) : undefined,
      date ? eq(rounds.date, date) : undefined,
      from ? gte(rounds.date, from) : undefined,
      to ? lte(rounds.date, to) : undefined,
    ),
    orderBy: desc(rounds.date),
    limit: parseLimit(req.query.limit),
    with: WITH_ACTIONS,
  });
  res.status(200).json(rows);
}

// Idempotent per (routine, date): a routine can only be run once a day, so
// posting the same pair twice returns the round that already exists rather
// than failing. The recording page relies on this — it creates the round on the
// first edit, which can race with a second tab or a double tap.
async function create(req: VercelRequest, res: VercelResponse) {
  const input = roundInputSchema.parse(req.body);

  const [round] = await db
    .insert(rounds)
    .values({
      routineId: input.routineId,
      date: input.date,
      startedAt: input.startedAt,
      comments: input.comments,
    })
    .onConflictDoUpdate({
      target: [rounds.routineId, rounds.date],
      // Deliberately does not touch startedAt or comments: the existing round
      // is the source of truth, this only marks that it was touched again.
      set: { updatedAt: sql`now()` },
    })
    .returning();

  const full = await db.query.rounds.findFirst({
    where: eq(rounds.id, round.id),
    with: WITH_ACTIONS,
  });
  res.status(201).json(full);
}

async function update(req: VercelRequest, res: VercelResponse) {
  const id = typeof req.query.id === "string" ? req.query.id : undefined;
  if (!id) {
    res.status(400).json({ error: "Missing id" });
    return;
  }

  const input = roundPatchSchema.parse(req.body);
  const [round] = await db
    .update(rounds)
    .set({ ...input, updatedAt: sql`now()` })
    .where(eq(rounds.id, id))
    .returning();

  if (!round) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const full = await db.query.rounds.findFirst({
    where: eq(rounds.id, round.id),
    with: WITH_ACTIONS,
  });
  res.status(200).json(full);
}

async function remove(req: VercelRequest, res: VercelResponse) {
  const id = typeof req.query.id === "string" ? req.query.id : undefined;
  if (!id) {
    res.status(400).json({ error: "Missing id" });
    return;
  }
  await db.delete(rounds).where(eq(rounds.id, id));
  res.status(204).end();
}

export default createHandler({ GET: list, POST: create, PATCH: update, DELETE: remove });
