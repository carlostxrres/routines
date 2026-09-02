import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq, sql } from "drizzle-orm";
import { appSettings } from "../db/schema/index.js";
import { settingsPatchSchema } from "../shared/validation/index.js";
import { db } from "./_lib/db.js";
import { createHandler } from "./_lib/http.js";

const SINGLETON_ID = "default";

async function loadOrCreate() {
  const existing = await db.query.appSettings.findFirst({
    where: eq(appSettings.id, SINGLETON_ID),
  });
  if (existing) return existing;

  const [created] = await db
    .insert(appSettings)
    .values({ id: SINGLETON_ID })
    .onConflictDoNothing()
    .returning();
  return (
    created ?? (await db.query.appSettings.findFirst({ where: eq(appSettings.id, SINGLETON_ID) }))
  );
}

async function read(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json(await loadOrCreate());
}

async function update(req: VercelRequest, res: VercelResponse) {
  const input = settingsPatchSchema.parse(req.body);
  await loadOrCreate();

  const [row] = await db
    .update(appSettings)
    .set({ ...input, updatedAt: sql`now()` })
    .where(eq(appSettings.id, SINGLETON_ID))
    .returning();

  res.status(200).json(row);
}

export default createHandler({ GET: read, PATCH: update });
