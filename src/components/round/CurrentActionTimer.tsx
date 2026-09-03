import type { RoundWithActions } from "@shared/types";
import { currentStretchSeconds, type ScheduledAction } from "@/lib/schedule";
import { formatStopwatch, type Temporal } from "@/lib/temporal";
import { cn } from "@/lib/utils";

// The number you look at mid-routine: how long you have been on the current
// action, against how long it was meant to take. Everything here is mm:ss —
// `formatSeconds`' "15m" is the right shape for a summary and the wrong one for
// a clock that ticks.
//
// No interval of its own: the page already re-renders every second off
// `useNow()`, so `now` arrives as a prop exactly like RoundTimeline's.

export function CurrentActionTimer({
  round,
  expected,
  next,
  now,
}: {
  round: RoundWithActions | null;
  // null for a free action — something typed that isn't in the plan, and so has
  // nothing to be compared against.
  expected: Temporal.Duration | null;
  next: ScheduledAction | null;
  now: Temporal.Instant;
}) {
  // The round row is only created by "Empezar", so until then there is no
  // instant to count from.
  const started = round !== null;
  const elapsed = currentStretchSeconds(round, now);
  // A zero-length step ("Salir de casa", "Llegar a casa") is a marker rather
  // than a duration, so it gets no limit and can never run over one.
  const targetSeconds = expected?.total("second") ?? 0;
  const over = started && targetSeconds > 0 && elapsed > targetSeconds;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between gap-2">
        {/* min-w-0 so a long action name shrinks instead of squeezing the
            clock, and two lines before ellipsis — the useful half of "Preparar
            bocadillo y ensalada" is the half `truncate` would eat. */}
        <p className="line-clamp-2 min-w-0 text-xs text-muted-foreground">
          {next ? <>Siguiente: {next.name}</> : "Última acción del plan."}
        </p>

        {/* Hard right, and never compressed: the running number is the one
            thing you glance at without stopping. */}
        <div className="flex shrink-0 flex-col items-end">
          {/* tabular-nums: without it the digits change width and the whole
              number jitters once a second. leading-none so the limit underneath
              reads as part of the same number rather than a separate line.

              The label is real text rather than an aria-label so it survives
              translation and needs no role on a plain span; and no aria-live,
              because announcing a new value every second makes a screen reader
              useless. */}
          <span
            className={cn(
              "text-4xl font-semibold leading-none tabular-nums",
              !started && "text-muted-foreground",
              over && "text-destructive",
            )}
          >
            <span className="sr-only">Tiempo en la acción actual: </span>
            {started ? formatStopwatch(elapsed) : "--:--"}
          </span>
          {targetSeconds > 0 && (
            <span className="mt-1 text-xs text-muted-foreground tabular-nums">
              de {formatStopwatch(targetSeconds)}
              {over && (
                <span className="text-destructive">
                  {" · +"}
                  {formatStopwatch(elapsed - targetSeconds)}
                </span>
              )}
            </span>
          )}
        </div>
      </div>

      {/* Full width rather than under the clock: two columns of prose on a
          phone is mush. */}
      {!started && (
        <p className="text-xs text-muted-foreground">El cronómetro arranca al pulsar Empezar.</p>
      )}
    </div>
  );
}
