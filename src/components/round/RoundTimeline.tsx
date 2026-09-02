import type { RoundWithActions } from "@shared/types";
import { useMemo } from "react";
import { Tip } from "@/components/Tip";
import { FREE_ACTION_COLOR } from "@/lib/actionColors";
import { performedSegments, type ScheduledAction } from "@/lib/schedule";
import { formatSeconds, parseInstant, type Temporal } from "@/lib/temporal";

// Plan on top, what actually happened underneath, both on the same axis:
// seconds elapsed since the round started. Because they share a zero, being
// ahead or behind is visible as the right edge of the lower track sitting
// before or after the right edge of the upper one — no numbers needed.
//
// Plain divs rather than Recharts: this repaints every second on a phone
// mid-routine, and it is two rows of rectangles.

const TRACK_HEIGHT = "h-7";
const MIN_LABEL_PERCENT = 12; // below this a segment is too narrow for its name

export function RoundTimeline({
  round,
  schedule,
  colors,
  now,
}: {
  round: RoundWithActions | null;
  schedule: ScheduledAction[];
  colors: Map<string, string>;
  now: Temporal.Instant;
}) {
  const segments = useMemo(() => (round ? performedSegments(round) : []), [round]);

  const startedAt = round ? parseInstant(round.startedAt) : null;
  const performedSeconds = segments.reduce(
    (total, segment) => total + segment.duration.total("second"),
    0,
  );

  // The action in progress: from the last thing finished to right now.
  const lastEnd = segments[segments.length - 1]?.endedAt ?? startedAt;
  const inProgressSeconds =
    lastEnd && now.epochMilliseconds > lastEnd.epochMilliseconds
      ? lastEnd.until(now).total("second")
      : 0;

  const plannedSeconds = schedule.reduce(
    (total, action) => total + action.length.total("second"),
    0,
  );
  // One shared scale, so the two tracks stay comparable. Guarded against zero
  // for an empty plan and an untouched round.
  const scale = Math.max(plannedSeconds, performedSeconds + inProgressSeconds, 1);

  return (
    <div className="flex flex-col gap-2">
      <Track label="Plan">
        {schedule.map((action) => (
          <Segment
            key={action.plannedActionId}
            left={(action.offset.total("second") / scale) * 100}
            width={(action.length.total("second") / scale) * 100}
            color={colors.get(action.plannedActionId) ?? FREE_ACTION_COLOR}
            tip={`${action.name} · ${formatSeconds(action.length.total("second"))}`}
          />
        ))}
      </Track>

      <Track label="Real">
        {startedAt &&
          segments.map((segment) => (
            <Segment
              key={segment.id}
              left={(startedAt.until(segment.startedAt).total("second") / scale) * 100}
              width={(segment.duration.total("second") / scale) * 100}
              color={
                segment.plannedActionId
                  ? (colors.get(segment.plannedActionId) ?? FREE_ACTION_COLOR)
                  : FREE_ACTION_COLOR
              }
              tip={`${segment.name} · ${formatSeconds(segment.duration.total("second"))}`}
              label={segment.name}
            />
          ))}
        {startedAt && inProgressSeconds > 0 && (
          <Tip
            content={`En curso · ${formatSeconds(Math.round(inProgressSeconds))}`}
            label="Acción en curso"
            // The action in progress: hatched rather than solid, because its
            // length is still growing.
            className="absolute inset-y-0 rounded-sm bg-[repeating-linear-gradient(45deg,var(--muted-foreground)_0_2px,transparent_2px_6px)] opacity-60"
            style={{
              left: `${((performedSeconds / scale) * 100).toFixed(3)}%`,
              width: `${((inProgressSeconds / scale) * 100).toFixed(3)}%`,
            }}
          />
        )}
      </Track>

      <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
        <span>0</span>
        <span>
          {formatSeconds(Math.round(performedSeconds + inProgressSeconds))} de{" "}
          {formatSeconds(plannedSeconds)} previstos
        </span>
      </div>
    </div>
  );
}

function Track({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-8 shrink-0 text-xs text-muted-foreground">{label}</span>
      <div className={`relative flex-1 overflow-hidden rounded-md bg-muted ${TRACK_HEIGHT}`}>
        {children}
      </div>
    </div>
  );
}

function Segment({
  left,
  width,
  color,
  tip,
  label,
}: {
  left: number;
  width: number;
  color: string;
  tip: string;
  label?: string;
}) {
  return (
    <Tip
      content={tip}
      label={tip}
      className="absolute inset-y-0 flex items-center overflow-hidden px-1 text-[10px] font-medium text-background text-xl"
      style={{
        left: `${left.toFixed(3)}%`,
        // Zero-length actions ("Salir de casa") would otherwise be invisible.
        width: `max(2px, ${width.toFixed(3)}%)`,
        backgroundColor: color,
      }}
    >
      {(width >= MIN_LABEL_PERCENT && label) ?? label}
    </Tip>
  );
}
