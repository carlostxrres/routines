import type { PerformedAction } from "@shared/types";
import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { Field } from "@/components/forms/Field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FREE_ACTION_COLOR } from "@/lib/actionColors";
import type { PerformedSegment } from "@/lib/schedule";
import {
  formatClock,
  formatSeconds,
  getTimeZone,
  instantAt,
  parseTime,
  serializeInstant,
  type Temporal,
} from "@/lib/temporal";

// What has already been recorded, and the only place it can be corrected.
//
// The rows stay as quiet as they were when this was a read-only list — you
// glance at them mid-routine, you don't operate them. Editing is one tap away
// behind a pencil, and every edit goes through the same undoable `apply()` as a
// tap on the big button, so nothing here needs a confirmation dialog.

export function PerformedActionList({
  segments,
  date,
  colors,
  onUpdate,
  onRemove,
}: {
  segments: PerformedSegment[];
  // The round's day: a time typed as HH:MM is meaningless without it.
  date: Temporal.PlainDate;
  colors: Map<string, string>;
  onUpdate: (
    actionId: string,
    patch: Partial<Pick<PerformedAction, "endedAt" | "name" | "comments">>,
  ) => void;
  onRemove: (actionId: string) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <ul className="flex flex-col gap-1 text-sm">
      {segments.map((segment) => (
        <li key={segment.id} className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{
                  backgroundColor: segment.plannedActionId
                    ? colors.get(segment.plannedActionId)
                    : FREE_ACTION_COLOR,
                }}
              />
              <span className="truncate">{segment.name}</span>
            </span>
            <span className="flex shrink-0 items-center gap-1">
              <span className="tabular-nums text-muted-foreground">
                {formatClock(segment.endedAt)} ·{" "}
                {formatSeconds(Math.round(segment.duration.total("second")))}
              </span>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Corregir ${segment.name}`}
                aria-expanded={editing === segment.id}
                onClick={() => setEditing(editing === segment.id ? null : segment.id)}
              >
                <Pencil />
              </Button>
            </span>
          </div>

          {editing === segment.id && (
            <SegmentEditor
              segment={segment}
              date={date}
              onUpdate={(patch) => onUpdate(segment.id, patch)}
              onRemove={() => {
                setEditing(null);
                onRemove(segment.id);
              }}
            />
          )}
        </li>
      ))}
    </ul>
  );
}

function SegmentEditor({
  segment,
  date,
  onUpdate,
  onRemove,
}: {
  segment: PerformedSegment;
  date: Temporal.PlainDate;
  onUpdate: (patch: Partial<Pick<PerformedAction, "endedAt" | "name" | "comments">>) => void;
  onRemove: () => void;
}) {
  // Local drafts so a half-typed name doesn't queue a write per keystroke; each
  // field commits on blur.
  const [name, setName] = useState(segment.name);
  const [time, setTime] = useState(formatClock(segment.endedAt));
  const [comments, setComments] = useState(segment.comments);

  function commitTime() {
    if (!/^\d{2}:\d{2}$/.test(time)) {
      setTime(formatClock(segment.endedAt));
      return;
    }
    const endedAt = instantAt(date, parseTime(time), getTimeZone());
    // `endedAt` is the order, so moving one step past its neighbours simply
    // re-sorts the round — that's the point, and it needs no guard here.
    onUpdate({ endedAt: serializeInstant(endedAt) });
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border bg-muted/40 p-3">
      <div className="flex gap-2">
        <div className="min-w-0 flex-1">
          <Field label="Nombre" htmlFor={`name-${segment.id}`}>
            <Input
              id={`name-${segment.id}`}
              value={name}
              onChange={(event) => setName(event.target.value)}
              onBlur={() => {
                const trimmed = name.trim();
                if (!trimmed) {
                  setName(segment.name);
                  return;
                }
                if (trimmed !== segment.name) onUpdate({ name: trimmed });
              }}
            />
          </Field>
        </div>
        <div className="w-32 shrink-0">
          <Field label="Terminó a las" htmlFor={`time-${segment.id}`}>
            <Input
              id={`time-${segment.id}`}
              type="time"
              value={time}
              onChange={(event) => setTime(event.target.value)}
              onBlur={commitTime}
            />
          </Field>
        </div>
      </div>

      <Field label="Comentario" htmlFor={`comments-${segment.id}`}>
        <Textarea
          id={`comments-${segment.id}`}
          rows={2}
          value={comments}
          placeholder="Qué pasó en este paso…"
          onChange={(event) => setComments(event.target.value)}
          onBlur={() => {
            if (comments !== segment.comments) onUpdate({ comments });
          }}
        />
      </Field>

      {/* No confirmation: this goes through the same undo stack as everything
          else, and saying so is friendlier than a modal. */}
      <Button variant="outline" className="text-destructive" onClick={onRemove}>
        <Trash2 />
        Eliminar el paso (se deshace con Atrás)
      </Button>
    </div>
  );
}
