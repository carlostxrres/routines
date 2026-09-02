import { ChevronDown, ChevronUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ScheduledAction } from "@/lib/schedule";

// One action inside a plan. The name and the equipment belong to the shared
// PlannedAction (editing them here changes every plan of the routine); the
// length belongs to this plan alone.
export function PlanActionRow({
  action,
  scheduled,
  isFirst,
  isLast,
  onNameChange,
  onEquipmentChange,
  onLengthChange,
  onMove,
  onRemove,
}: {
  action: { name: string; equipment: string; lengthMinutes: number };
  scheduled: ScheduledAction | undefined;
  isFirst: boolean;
  isLast: boolean;
  onNameChange: (name: string) => void;
  onEquipmentChange: (equipment: string) => void;
  onLengthChange: (minutes: number) => void;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
}) {
  const startLabel = scheduled?.startTime
    ? scheduled.startTime.toString({ smallestUnit: "minute" })
    : `+${Math.round(scheduled?.offset.total("minute") ?? 0)}m`;

  return (
    <li className="flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex items-center gap-2">
        <span className="w-14 shrink-0 font-mono text-sm text-muted-foreground tabular-nums">
          {startLabel}
        </span>
        <Input
          aria-label="Nombre de la acción"
          value={action.name}
          onChange={(event) => onNameChange(event.target.value)}
          placeholder="Nombre"
          className="flex-1"
        />
        <Button variant="ghost" size="icon" aria-label="Quitar acción" onClick={onRemove}>
          <X />
        </Button>
      </div>
      <div className="flex items-center gap-2 pl-16">
        <Input
          aria-label="Equipamiento"
          value={action.equipment}
          onChange={(event) => onEquipmentChange(event.target.value)}
          placeholder="Equipamiento (opcional)"
          className="flex-1"
        />
        <div className="flex items-center gap-1">
          <Input
            aria-label="Duración en minutos"
            type="number"
            inputMode="numeric"
            min={0}
            max={1440}
            value={action.lengthMinutes}
            onChange={(event) => onLengthChange(Math.max(0, Number(event.target.value) || 0))}
          />
          <span className="text-sm text-muted-foreground">min</span>
        </div>
        <div className="flex">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Subir"
            disabled={isFirst}
            onClick={() => onMove(-1)}
          >
            <ChevronUp />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Bajar"
            disabled={isLast}
            onClick={() => onMove(1)}
          >
            <ChevronDown />
          </Button>
        </div>
      </div>
    </li>
  );
}
