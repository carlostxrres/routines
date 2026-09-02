import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { Tip } from "@/components/Tip";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useRounds } from "@/hooks/useRounds";
import { useSettings } from "@/hooks/useSettings";
import { actionColorMap, FREE_ACTION_COLOR } from "@/lib/actionColors";
import { performedSegments, planForDate, plannedSchedule } from "@/lib/schedule";
import {
  formatClock,
  formatSeconds,
  formatWeekRange,
  hourOfDay,
  today,
  weekDays as weekDaysOf,
} from "@/lib/temporal";
import type { ViewProps } from "@/views/types";

// Where the routine actually sat in the day, across a week. Unlike a generic
// calendar this crops the vertical axis to the hours that have something in
// them — a morning routine occupies 90 minutes, and showing 24 hours would
// squash it into a sliver.

const PADDING_HOURS = 0.5;

type Block = {
  id: string;
  dayIndex: number;
  startHour: number;
  endHour: number;
  name: string;
  color: string;
  durationSeconds: number;
  endLabel: string;
};

export function WeekView({ routine }: ViewProps) {
  const { settings } = useSettings();
  const weekStartDay = settings?.weekStartDay ?? 1;
  const [anchor, setAnchor] = useState(() => today());

  const days = useMemo(() => weekDaysOf(anchor, weekStartDay), [anchor, weekStartDay]);
  const { rounds, error, loading } = useRounds(routine.id, days[0], days[6]);

  const colors = useMemo(() => {
    const plan = planForDate(routine, anchor) ?? routine.plans[routine.plans.length - 1];
    const schedule = plan ? plannedSchedule(plan, routine.plannedActions) : [];
    return actionColorMap(
      schedule.map((action) => action.plannedActionId),
      settings?.chartHue ?? 30,
    );
  }, [routine, anchor, settings?.chartHue]);

  const blocks = useMemo<Block[]>(() => {
    const dayKeys = days.map((day) => day.toString());
    const result: Block[] = [];

    for (const round of rounds ?? []) {
      const dayIndex = dayKeys.indexOf(round.date);
      if (dayIndex === -1) continue;

      for (const segment of performedSegments(round)) {
        const startHour = hourOfDay(segment.startedAt);
        let endHour = hourOfDay(segment.endedAt);
        // A routine that runs past midnight would wrap to a smaller number;
        // clamp it to the end of the day rather than drawing it upside down.
        if (endHour < startHour) endHour = 24;
        result.push({
          id: segment.id,
          dayIndex,
          startHour,
          endHour,
          name: segment.name,
          color: segment.plannedActionId
            ? (colors.get(segment.plannedActionId) ?? FREE_ACTION_COLOR)
            : FREE_ACTION_COLOR,
          durationSeconds: Math.round(segment.duration.total("second")),
          endLabel: formatClock(segment.endedAt),
        });
      }
    }
    return result;
  }, [rounds, days, colors]);

  // The visible hour band: only what this week actually uses.
  const [minHour, maxHour] = useMemo(() => {
    if (blocks.length === 0) return [6, 12];
    const lowest = Math.min(...blocks.map((block) => block.startHour));
    const highest = Math.max(...blocks.map((block) => block.endHour));
    return [
      Math.max(0, Math.floor(lowest - PADDING_HOURS)),
      Math.min(24, Math.ceil(highest + PADDING_HOURS)),
    ];
  }, [blocks]);

  const span = Math.max(maxHour - minHour, 1);
  const hourTicks = Array.from({ length: span + 1 }, (_, index) => minHour + index);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="outline"
          size="icon"
          aria-label="Semana anterior"
          onClick={() => setAnchor((current) => current.subtract({ days: 7 }))}
        >
          <ChevronLeft />
        </Button>
        <span className="text-sm text-muted-foreground">{formatWeekRange(days)}</span>
        <Button
          variant="outline"
          size="icon"
          aria-label="Semana siguiente"
          onClick={() => setAnchor((current) => current.add({ days: 7 }))}
        >
          <ChevronRight />
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {loading && <Skeleton className="h-72 w-full" />}

      {!loading && blocks.length === 0 && (
        <p className="text-sm text-muted-foreground">Sin Rounds de esta rutina esta semana.</p>
      )}

      {!loading && blocks.length > 0 && (
        <div className="flex gap-1">
          <div className="relative w-10 shrink-0" style={{ height: `${span * 44}px` }}>
            {hourTicks.map((hour) => (
              <span
                key={hour}
                className="absolute right-1 -translate-y-1/2 text-xs text-muted-foreground tabular-nums"
                style={{ top: `${((hour - minHour) / span) * 100}%` }}
              >
                {String(hour).padStart(2, "0")}
              </span>
            ))}
          </div>

          <div className="grid flex-1 grid-cols-7 gap-1">
            {days.map((day, dayIndex) => (
              <div key={day.toString()} className="flex flex-col gap-1">
                <span className="text-center text-xs text-muted-foreground">
                  {day.toLocaleString("es-ES", { weekday: "narrow" })}
                  <span className="ml-0.5 tabular-nums">{day.day}</span>
                </span>
                <div
                  className="relative flex-1 rounded-md bg-muted"
                  style={{ height: `${span * 44}px` }}
                >
                  {blocks
                    .filter((block) => block.dayIndex === dayIndex)
                    .map((block) => (
                      <Tip
                        key={block.id}
                        content={`${block.name} · ${formatSeconds(block.durationSeconds)} · acaba a las ${block.endLabel}`}
                        label={block.name}
                        className="absolute inset-x-0 rounded-sm"
                        style={{
                          top: `${((block.startHour - minHour) / span) * 100}%`,
                          // Zero-length actions still need to be visible.
                          height: `max(2px, ${((block.endHour - block.startHour) / span) * 100}%)`,
                          backgroundColor: block.color,
                        }}
                      />
                    ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
