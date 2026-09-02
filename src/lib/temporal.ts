// The single place this app touches a date/time library.
//
// Everything above this module works in Temporal types; everything below it
// (the API, Postgres, react-day-picker, Intl) works in strings or `Date`.
// Keeping both boundaries here is what lets `biome.json` veto the `Date`
// global across the rest of `src/`.
//
// Temporal is not in Node 22 nor in most stable browsers yet, so it comes
// from `temporal-polyfill` — re-exported here so no other file imports it.
import { Temporal } from "temporal-polyfill";

export { Temporal };

// ---------------------------------------------------------------------------
// Display time zone
// ---------------------------------------------------------------------------

// Set once from app_settings on load (see useSettings). A module-level value
// rather than context because the pure helpers below aren't React code — every
// function still takes an explicit `timeZone` override.
let displayTimeZone = "Europe/Madrid";

export function getTimeZone(): string {
  return displayTimeZone;
}

export function setTimeZone(timeZone: string): void {
  displayTimeZone = timeZone;
}

// ---------------------------------------------------------------------------
// Wire format <-> Temporal
//
// The wire format is whatever Postgres round-trips through Drizzle:
//   date        -> "YYYY-MM-DD"        -> Temporal.PlainDate
//   time        -> "HH:MM:SS"          -> Temporal.PlainTime
//   timestamptz -> ISO-8601 w/ offset  -> Temporal.Instant
//
// An Instant is a fixed point on the timeline with no zone attached, which is
// exactly what a timestamptz is. It becomes a ZonedDateTime only when we need
// to show it on a clock (see `zoned` below).
// ---------------------------------------------------------------------------

export function parseDate(value: string): Temporal.PlainDate {
  return Temporal.PlainDate.from(value);
}

export function serializeDate(date: Temporal.PlainDate): string {
  return date.toString();
}

export function parseTime(value: string): Temporal.PlainTime {
  return Temporal.PlainTime.from(value);
}

// Postgres `time` wants seconds; PlainTime#toString already emits "HH:MM:SS".
export function serializeTime(time: Temporal.PlainTime): string {
  return time.toString();
}

export function parseInstant(value: string): Temporal.Instant {
  return Temporal.Instant.from(value);
}

export function serializeInstant(instant: Temporal.Instant): string {
  return instant.toString();
}

export function zoned(
  instant: Temporal.Instant,
  timeZone: string = getTimeZone(),
): Temporal.ZonedDateTime {
  return instant.toZonedDateTimeISO(timeZone);
}

// ---------------------------------------------------------------------------
// Now
// ---------------------------------------------------------------------------

export function nowInstant(): Temporal.Instant {
  return Temporal.Now.instant();
}

export function today(timeZone: string = getTimeZone()): Temporal.PlainDate {
  return Temporal.Now.plainDateISO(timeZone);
}

// The instant at which `time` occurs on `date` in `timeZone`. Used to place a
// plan's expected schedule (plain wall-clock times) onto the same axis as the
// round's real timestamps. Resolves DST gaps/overlaps with Temporal's
// "compatible" default, matching what a wall clock would show.
export function instantAt(
  date: Temporal.PlainDate,
  time: Temporal.PlainTime,
  timeZone: string = getTimeZone(),
): Temporal.Instant {
  return date.toZonedDateTime({ timeZone, plainTime: time }).toInstant();
}

// ---------------------------------------------------------------------------
// Formatting (es-ES)
// ---------------------------------------------------------------------------

// "07:32"
export function formatClock(
  value: Temporal.Instant | Temporal.PlainTime,
  timeZone: string = getTimeZone(),
): string {
  const time = value instanceof Temporal.Instant ? zoned(value, timeZone).toPlainTime() : value;
  return time.toLocaleString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

// "2 sept" / "mié, 2 sept"
export function formatDayShort(date: Temporal.PlainDate, withWeekday = false): string {
  return date.toLocaleString("es-ES", {
    weekday: withWeekday ? "short" : undefined,
    day: "numeric",
    month: "short",
  });
}

// "2 de septiembre de 2026"
export function formatDayLong(date: Temporal.PlainDate): string {
  return date.toLocaleString("es-ES", { day: "numeric", month: "long", year: "numeric" });
}

// A duration as "45s" / "15m" / "1h 05m". Seconds only show below a minute,
// where they're the whole point (an action that took 12s).
export function formatDuration(duration: Temporal.Duration): string {
  const totalSeconds = Math.round(duration.total("second"));
  return formatSeconds(totalSeconds);
}

export function formatSeconds(totalSeconds: number): string {
  const sign = totalSeconds < 0 ? "-" : "";
  const abs = Math.abs(totalSeconds);
  const hours = Math.floor(abs / 3600);
  const minutes = Math.floor((abs % 3600) / 60);
  const seconds = abs % 60;
  if (hours > 0) return `${sign}${hours}h ${String(minutes).padStart(2, "0")}m`;
  if (minutes > 0) return `${sign}${minutes}m`;
  return `${sign}${seconds}s`;
}

// "+3m" / "-1m" / "en punto" — a round's deviation from its plan.
export function formatDeviation(totalSeconds: number): string {
  if (Math.abs(totalSeconds) < 30) return "en punto";
  return `${totalSeconds > 0 ? "+" : "−"}${formatSeconds(Math.abs(totalSeconds))}`;
}

// ---------------------------------------------------------------------------
// `Date` boundary
//
// react-day-picker (and anything else that predates Temporal) speaks `Date`.
// These two functions are the only sanctioned crossing point.
// ---------------------------------------------------------------------------

// biome-ignore lint/style/noRestrictedGlobals: react-day-picker boundary
export function toLegacyDate(date: Temporal.PlainDate): Date {
  // Noon, not midnight: a `Date` built from a plain calendar date is
  // interpreted in the runtime's zone, and midnight in a zone behind UTC
  // rolls back a day. Noon has ~12h of slack in either direction.
  // biome-ignore lint/style/noRestrictedGlobals: react-day-picker boundary
  return new Date(date.year, date.month - 1, date.day, 12);
}

// biome-ignore lint/style/noRestrictedGlobals: react-day-picker boundary
export function fromLegacyDate(date: Date): Temporal.PlainDate {
  return new Temporal.PlainDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

// ---------------------------------------------------------------------------
// Weeks
// ---------------------------------------------------------------------------

// `weekStartDay` follows the settings table's 0=Sun..6=Sat convention;
// Temporal's dayOfWeek is 1=Mon..7=Sun.
export function startOfWeek(date: Temporal.PlainDate, weekStartDay = 1): Temporal.PlainDate {
  const target = weekStartDay === 0 ? 7 : weekStartDay;
  return date.subtract({ days: (date.dayOfWeek - target + 7) % 7 });
}

export function weekDays(date: Temporal.PlainDate, weekStartDay = 1): Temporal.PlainDate[] {
  const start = startOfWeek(date, weekStartDay);
  return Array.from({ length: 7 }, (_, index) => start.add({ days: index }));
}

// "2 sept – 8 sept 2026"
export function formatWeekRange(days: Temporal.PlainDate[]): string {
  const first = days[0];
  const last = days[days.length - 1];
  return `${formatDayShort(first)} – ${formatDayLong(last)}`;
}

// Hour of day (0..24, fractional) for an instant, in the display zone — the
// vertical axis of the week view.
export function hourOfDay(instant: Temporal.Instant, timeZone: string = getTimeZone()): number {
  const time = zoned(instant, timeZone).toPlainTime();
  return time.hour + time.minute / 60 + time.second / 3600;
}
