import { z } from "zod";

// "YYYY-MM-DD" — a Postgres `date`, a Temporal.PlainDate on the client.
export const dateString = z.iso.date();

// "HH:MM" or "HH:MM:SS" — a Postgres `time`, a Temporal.PlainTime on the client.
export const timeString = z.iso.time();

// An absolute instant with an explicit offset — a Postgres `timestamptz`, a
// Temporal.Instant on the client. The offset is required: a timestamp without
// one is ambiguous, and this app's whole point is measuring elapsed time.
export const instantString = z.iso.datetime({ offset: true });

export const shortText = z.string().trim().min(1).max(120);
export const noteText = z.string().trim().max(2000);
