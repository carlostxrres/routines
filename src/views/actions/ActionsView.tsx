import { ChartLine } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type ChartConfig, ChartContainer, ChartTooltip } from "@/components/ui/chart";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { useRounds } from "@/hooks/useRounds";
import { useSettings } from "@/hooks/useSettings";
import { actionColorMap } from "@/lib/actionColors";
import { planForDate, plannedSchedule, secondsByPlannedAction } from "@/lib/schedule";
import { formatDayShort, formatSeconds, parseDate, today } from "@/lib/temporal";
import { cn } from "@/lib/utils";
import type { ViewProps } from "@/views/types";

const WINDOW_DAYS = 60;

// How long each action took, day by day. One line per planned action, sharing
// the palette with the recording timeline so an action is the same colour
// everywhere.
export function ActionsView({ routine }: ViewProps) {
  const { settings } = useSettings();
  const to = today();
  const from = to.subtract({ days: WINDOW_DAYS });
  const { rounds, error, loading } = useRounds(routine.id, from, to);

  // The actions of the plan in force now: the ones worth plotting. Older
  // actions still have their data, they just aren't part of the routine today.
  const schedule = useMemo(() => {
    const plan = planForDate(routine, to) ?? routine.plans[routine.plans.length - 1];
    return plan ? plannedSchedule(plan, routine.plannedActions) : [];
  }, [routine, to]);

  const colors = useMemo(
    () =>
      actionColorMap(
        schedule.map((action) => action.plannedActionId),
        settings?.chartHue ?? 30,
      ),
    [schedule, settings?.chartHue],
  );

  // Thirteen lines at once is unreadable, so tapping a chip isolates one.
  const [focused, setFocused] = useState<string | null>(null);

  const data = useMemo(() => {
    if (!rounds) return [];
    return [...rounds]
      .sort((a, b) => (a.date < b.date ? -1 : 1))
      .map((round) => {
        const seconds = secondsByPlannedAction(round);
        const row: Record<string, string | number> = { day: round.date };
        for (const [plannedActionId, value] of seconds) {
          row[plannedActionId] = Math.round(value);
        }
        return row;
      });
  }, [rounds]);

  const chartConfig = useMemo(
    () =>
      Object.fromEntries(
        schedule.map((action) => [
          action.plannedActionId,
          { label: action.name, color: colors.get(action.plannedActionId) },
        ]),
      ) satisfies ChartConfig,
    [schedule, colors],
  );

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (loading) return <Skeleton className="h-72 w-full" />;
  if (data.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ChartLine />
          </EmptyMedia>
          <EmptyTitle>Sin datos que dibujar</EmptyTitle>
          <EmptyDescription>
            No hay ningún Round de "{routine.name}" en los últimos {WINDOW_DAYS} días.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button render={<Link to="/rounds/new" />}>Registrar un Round</Button>
        </EmptyContent>
      </Empty>
    );
  }

  const visible = focused ? schedule.filter((a) => a.plannedActionId === focused) : schedule;

  return (
    <div className="flex flex-col gap-3">
      <ChartContainer config={chartConfig} className="aspect-auto h-[45vh] w-full">
        <LineChart data={data} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="day"
            tickFormatter={(value: string) => formatDayShort(parseDate(value))}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={24}
          />
          <YAxis
            tickFormatter={(value: number) => formatSeconds(value)}
            tickLine={false}
            axisLine={false}
            width={48}
          />
          <ChartTooltip
            content={({ active, label, payload }) =>
              active && payload?.length ? (
                <div className="rounded-lg border bg-popover p-2 text-xs shadow-md">
                  <p className="mb-1 font-medium">
                    {formatDayShort(parseDate(String(label)), true)}
                  </p>
                  {payload.map((entry) => (
                    <p key={String(entry.dataKey)} className="flex items-center gap-2">
                      <span
                        className="size-2 rounded-full"
                        style={{ backgroundColor: entry.color }}
                      />
                      <span className="flex-1">{chartConfig[String(entry.dataKey)]?.label}</span>
                      <span className="tabular-nums">{formatSeconds(Number(entry.value))}</span>
                    </p>
                  ))}
                </div>
              ) : null
            }
          />
          {visible.map((action) => (
            <Line
              key={action.plannedActionId}
              type="monotone"
              dataKey={action.plannedActionId}
              stroke={colors.get(action.plannedActionId)}
              strokeWidth={2}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ChartContainer>

      <div className="flex flex-wrap gap-1.5">
        {schedule.map((action) => {
          const active = focused === action.plannedActionId;
          return (
            <button
              key={action.plannedActionId}
              type="button"
              onClick={() => setFocused(active ? null : action.plannedActionId)}
            >
              <Badge
                variant={active ? "default" : "outline"}
                className={cn("gap-1.5", focused && !active && "opacity-50")}
              >
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: colors.get(action.plannedActionId) }}
                />
                {action.name}
              </Badge>
            </button>
          );
        })}
      </div>
    </div>
  );
}
