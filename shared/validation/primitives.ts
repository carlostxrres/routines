import { Temporal } from "temporal-polyfill";
import { z } from "zod";

// "YYYY-MM-DD" — a Postgres `date`, a Temporal.PlainDate on the client.
export const dateString = z.iso.date();

// "HH:MM" or "HH:MM:SS" — a Postgres `time`, a Temporal.PlainTime on the client.
export const timeString = z.iso.time();

// An absolute instant with an explicit offset — a Postgres `timestamptz`, a
// Temporal.Instant on the client. The offset is required: a timestamp without
// one is ambiguous, and this app's whole point is measuring elapsed time.
//
// Parsed with Temporal rather than matched with z.iso.datetime, because both
// spellings have to be accepted. The client sends canonical ISO
// ("2026-09-02T05:25:00.000Z"), but Postgres hands timestamptz back as
// "2026-09-02 05:25:00+00" — a space instead of the T, and a two-digit offset
// — and the client echoes those values straight back when it PATCHes a round
// it just loaded. z.iso.datetime rejects that form, which used to turn every
// edit of an already-saved round into a 400.
//
// Whatever comes in, what leaves here is canonical, so that is what gets
// stored and compared.
export const instantString = z.string().transform((value, ctx) => {
  try {
    return Temporal.Instant.from(value).toString();
  } catch {
    ctx.addIssue({ code: "custom", message: "Fecha y hora no válidas." });
    return z.NEVER;
  }
});

export const shortText = z.string().trim().min(1).max(120);
export const noteText = z.string().trim().max(2000);
