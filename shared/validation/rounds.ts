import { z } from "zod";
import { dateString, instantString, noteText, shortText } from "./primitives.js";

export const roundInputSchema = z.object({
  routineId: z.uuid(),
  date: dateString,
  // Where the clock starts for this round. Every action's duration is measured
  // forward from here, so it is stored explicitly and stays editable.
  startedAt: instantString,
  // Null while the round is running. Nullable rather than optional so a PATCH
  // can reopen a closed round by sending it explicitly.
  endedAt: instantString.nullable().default(null),
  comments: noteText.default(""),
});

// PATCH /api/rounds: everything about a round is editable after the fact.
export const roundPatchSchema = roundInputSchema.partial();

export const performedActionInputSchema = z.object({
  // Optional and client-supplied, so the recording page can render a new
  // action optimistically under the id it will actually have.
  id: z.uuid().optional(),
  roundId: z.uuid(),
  // null for a free action typed into the combobox.
  plannedActionId: z.uuid().nullable().default(null),
  // Denormalised: a free action has no other name, and a planned one keeps a
  // readable label if the action is later removed from the routine.
  name: shortText,
  endedAt: instantString,
  comments: noteText.default(""),
});

export const performedActionPatchSchema = performedActionInputSchema
  .omit({ roundId: true, plannedActionId: true })
  .partial();

export type RoundInput = z.infer<typeof roundInputSchema>;
export type RoundPatch = z.infer<typeof roundPatchSchema>;
export type PerformedActionInput = z.infer<typeof performedActionInputSchema>;
export type PerformedActionPatch = z.infer<typeof performedActionPatchSchema>;
