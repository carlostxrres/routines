import { Check } from "lucide-react";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import type { ScheduledAction } from "@/lib/schedule";
import { formatSeconds } from "@/lib/temporal";
import { cn } from "@/lib/utils";

export type ActionChoice = {
  // null for a free action: something the user typed that isn't in the plan.
  plannedActionId: string | null;
  name: string;
};

// What the user is doing right now. It defaults to the next unrecorded step of
// the plan, so on a normal day this control is never touched — but it doubles
// as the way to record something unplanned (type it) and the way to correct a
// step already marked done (pick it again).
export function CurrentActionCombobox({
  schedule,
  doneIds,
  value,
  onChange,
}: {
  schedule: ScheduledAction[];
  doneIds: Set<string>;
  value: ActionChoice | null;
  onChange: (choice: ActionChoice) => void;
}) {
  return (
    <Combobox
      items={schedule.map((action) => action.plannedActionId)}
      value={value?.plannedActionId ?? null}
      inputValue={value?.name ?? ""}
      onValueChange={(plannedActionId) => {
        const action = schedule.find((item) => item.plannedActionId === plannedActionId);
        if (action) onChange({ plannedActionId: action.plannedActionId, name: action.name });
      }}
      onInputValueChange={(name) => {
        // Typing detaches the selection: whatever is in the box is now a free
        // action unless it matches a planned one exactly.
        const matched = schedule.find(
          (action) => action.name.toLowerCase() === name.trim().toLowerCase(),
        );
        onChange({ plannedActionId: matched?.plannedActionId ?? null, name });
      }}
    >
      <ComboboxInput
        aria-label="Acción actual"
        placeholder="¿Qué estás haciendo?"
        className="h-12 text-base"
      />
      <ComboboxContent>
        <ComboboxEmpty>Se registrará como acción libre.</ComboboxEmpty>
        <ComboboxList>
          {schedule.map((action) => {
            const done = doneIds.has(action.plannedActionId);
            return (
              <ComboboxItem key={action.plannedActionId} value={action.plannedActionId}>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className={cn("truncate", done && "text-muted-foreground line-through")}>
                    {action.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {action.startTime
                      ? action.startTime.toString({ smallestUnit: "minute" })
                      : `+${Math.round(action.offset.total("minute"))}m`}
                    {" · "}
                    {formatSeconds(action.length.total("second"))}
                    {action.equipment && ` · ${action.equipment}`}
                  </span>
                </div>
                {done && <Check className="size-4 shrink-0 text-muted-foreground" />}
              </ComboboxItem>
            );
          })}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
