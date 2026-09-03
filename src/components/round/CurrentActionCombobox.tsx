import { Check } from "lucide-react";
import { useMemo } from "react";
import {
  Combobox,
  ComboboxCollection,
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
  // The combobox works on whole choices rather than on ids, because base-ui
  // reads two things off the value it is given, and an id answers neither:
  //
  //  - the text of an item, used to match it against what has been typed. With
  //    ids, "Ducha" was being compared against a uuid and nothing ever matched,
  //    so no planned action could be picked.
  //  - the text to restore into the input once the popup unmounts. A free
  //    action has no id, so that restore used to write "" back — which is what
  //    erased whatever had just been typed.
  //
  // Memoised because a round re-renders every second (useNow) and base-ui
  // watches `items` for identity changes.
  const items = useMemo<ActionChoice[]>(
    () => schedule.map(({ plannedActionId, name }) => ({ plannedActionId, name })),
    [schedule],
  );

  // The list renders whatever base-ui filtered down to, in its order, so the
  // rest of each row has to be looked up rather than indexed.
  const byId = useMemo(
    () => new Map(schedule.map((action) => [action.plannedActionId, action])),
    [schedule],
  );

  return (
    <Combobox
      items={items}
      value={value}
      inputValue={value?.name ?? ""}
      itemToStringLabel={(choice: ActionChoice) => choice.name}
      isItemEqualToValue={(item: ActionChoice, current: ActionChoice) =>
        item.plannedActionId === current.plannedActionId
      }
      onValueChange={(choice: ActionChoice | null) => {
        if (choice) onChange(choice);
      }}
      onInputValueChange={(name: string) => {
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
          <ComboboxCollection>
            {(choice: ActionChoice) => {
              const action = byId.get(choice.plannedActionId ?? "");
              if (!action) return null;
              const done = doneIds.has(action.plannedActionId);
              return (
                <ComboboxItem key={action.plannedActionId} value={choice}>
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
            }}
          </ComboboxCollection>
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
