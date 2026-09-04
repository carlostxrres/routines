import type { RoundWithActions } from "@shared/types";
import { CalendarOff } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { RoundTimeline } from "@/components/round/RoundTimeline";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { useRoundsFeed } from "@/hooks/useRoundsFeed";
import { useSettings } from "@/hooks/useSettings";
import { actionColorMap } from "@/lib/actionColors";
import {
  planForDate,
  plannedSchedule,
  type RoundSummary,
  type ScheduledAction,
  summarizeRound,
} from "@/lib/schedule";
import {
  formatDayLong,
  formatDeviation,
  nowInstant,
  parseDate,
  type Temporal,
  today,
} from "@/lib/temporal";
import type { ViewProps } from "@/views/types";

// The plan-vs-real comparison of the recording page, but backwards through
// time: one card per day, newest first, more days as you scroll. Each card is
// the same RoundTimeline that /rounds/:id draws live, so a day read here and
// the same day read there look identical.

type Day = {
  round: RoundWithActions;
  schedule: ScheduledAction[];
  summary: RoundSummary;
};

export function DriftsView({ routine }: ViewProps) {
  const { settings } = useSettings();
  const { rounds, error, loading, done, loadMore } = useRoundsFeed(routine.id);

  // Frozen on mount rather than useNow(): RoundTimeline only reads `now` for
  // the hatched in-progress bar, and a per-second tick would repaint a feed of
  // dozens of cards. Closed rounds ignore it entirely.
  const [now] = useState<Temporal.Instant>(() => nowInstant());

  // One palette for the whole feed. The feed crosses several Plans of the same
  // routine, so it can't be built from a single one: the current plan's order
  // comes first, so colours match the recording page and /views/week, then
  // every remaining action of the routine, so one dropped from today's plan
  // still gets a colour of its own instead of falling back to the grey that
  // means "outside the plan".
  const colors = useMemo(() => {
    const plan = planForDate(routine, today()) ?? routine.plans[routine.plans.length - 1];
    const schedule = plan ? plannedSchedule(plan, routine.plannedActions) : [];
    const ids = schedule.map((action) => action.plannedActionId);
    const seen = new Set(ids);
    for (const action of routine.plannedActions) {
      if (!seen.has(action.id)) ids.push(action.id);
    }
    return actionColorMap(ids, settings?.chartHue ?? 30);
  }, [routine, settings?.chartHue]);

  const days = useMemo<Day[]>(
    () =>
      (rounds ?? []).map((round) => {
        const plan = planForDate(routine, parseDate(round.date));
        // No plan covers that date any more: the round still has a real track,
        // it just has nothing left to be compared against.
        const schedule = plan ? plannedSchedule(plan, routine.plannedActions) : [];
        return { round, schedule, summary: summarizeRound(round, schedule) };
      }),
    [rounds, routine],
  );

  const sentinelRef = useInfiniteScroll(loadMore, { enabled: !done && !loading && !error });

  return (
    <div className="flex flex-col gap-3">
      {error && <p className="text-sm text-destructive">{error}</p>}
      {rounds === null && !error && <Skeleton className="h-72 w-full" />}

      {rounds?.length === 0 && !error && (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CalendarOff />
            </EmptyMedia>
            <EmptyTitle>Todavía no hay Rounds</EmptyTitle>
            <EmptyDescription>
              No hay ningún Round de "{routine.name}" que comparar con su plan.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button render={<Link to="/rounds/new" />}>Registrar un Round</Button>
          </EmptyContent>
        </Empty>
      )}

      {days.map((day) => (
        <DriftCard key={day.round.id} day={day} colors={colors} now={now} />
      ))}

      {days.length > 0 && (
        <>
          <div ref={sentinelRef} aria-hidden />
          {loading && <Skeleton className="h-40 w-full" />}
          {/* The observer stays off while there is an error, so without this
              a failed page would leave the feed silently stuck. */}
          {error && !loading && (
            <Button variant="outline" onClick={loadMore}>
              Reintentar
            </Button>
          )}
          {done && !loading && (
            <p className="py-2 text-center text-xs text-muted-foreground">No hay más Rounds.</p>
          )}
        </>
      )}
    </div>
  );
}

function DriftCard({
  day,
  colors,
  now,
}: {
  day: Day;
  colors: Map<string, string>;
  now: Temporal.Instant;
}) {
  const { round, schedule, summary } = day;
  const deviation = Math.round(summary.deviationSeconds);
  // formatDeviation calls anything under 30s "en punto"; use the same
  // threshold, so a day that reads as on time is never painted as late.
  const late = deviation >= 30;

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <Link
          to={`/rounds/${round.id}`}
          className="flex items-baseline justify-between gap-2 text-sm hover:underline"
        >
          <span className="font-medium">{formatDayLong(parseDate(round.date))}</span>
          <span className={`tabular-nums ${late ? "text-destructive" : "text-muted-foreground"}`}>
            {formatDeviation(deviation)}
          </span>
        </Link>
        <RoundTimeline round={round} schedule={schedule} colors={colors} now={now} />
      </CardContent>
    </Card>
  );
}

// Calls `onReach` when the returned ref scrolls into view. The default root is
// the viewport, which is correct here: AppLayout has no scrolling container of
// its own, the window is what scrolls.
//
// The observer is torn down and rebuilt whenever `enabled` or `onReach`
// changes — that is, after every page. Rebuilding it while the sentinel is
// still on screen fires it again, which is exactly what keeps a tall screen
// filling itself; useRoundsFeed is what stops the same page being asked for
// twice.
function useInfiniteScroll(onReach: () => void, { enabled }: { enabled: boolean }) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!enabled || !node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) onReach();
      },
      // Start the next page a screenful early, so the feed rarely shows a gap.
      { rootMargin: "400px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled, onReach]);

  return ref;
}
