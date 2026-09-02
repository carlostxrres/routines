import { Plus, Trash2 } from "lucide-react";
import { useMemo } from "react";
import { DatePicker } from "@/components/DatePicker";
import { Field } from "@/components/forms/Field";
import { PlanActionRow } from "@/components/routine/PlanActionRow";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { DraftPlan, DraftPlannedAction } from "@/lib/routineDraft";
import { plannedSchedule, plannedTotalSeconds } from "@/lib/schedule";
import { formatSeconds, parseDate } from "@/lib/temporal";

export function PlanEditor({
  plan,
  index,
  plannedActions,
  canRemove,
  onChange,
  onRemove,
  onPlannedActionChange,
  onAddPlannedAction,
}: {
  plan: DraftPlan;
  index: number;
  plannedActions: DraftPlannedAction[];
  canRemove: boolean;
  onChange: (plan: DraftPlan) => void;
  onRemove: () => void;
  onPlannedActionChange: (id: string, patch: Partial<DraftPlannedAction>) => void;
  onAddPlannedAction: (action: DraftPlannedAction) => void;
}) {
  const byId = useMemo(
    () => new Map(plannedActions.map((action) => [action.id, action])),
    [plannedActions],
  );

  // The same maths the recording page uses, run against the draft.
  const schedule = useMemo(
    () =>
      plannedSchedule(
        {
          startTime: plan.startTime,
          actions: plan.actions.map((action, position) => ({ ...action, position })),
        },
        plannedActions,
      ),
    [plan.startTime, plan.actions, plannedActions],
  );

  // Actions of the routine this plan doesn't use — either dropped from it, or
  // only ever used by a different plan. Re-adding one keeps its id, and with it
  // the whole history recorded against it.
  const unused = plannedActions.filter(
    (action) => !plan.actions.some((planAction) => planAction.plannedActionId === action.id),
  );

  function updateActions(actions: DraftPlan["actions"]) {
    onChange({ ...plan, actions });
  }

  function addNewAction() {
    const action = { id: crypto.randomUUID(), name: "", equipment: "" };
    onAddPlannedAction(action);
    updateActions([...plan.actions, { plannedActionId: action.id, lengthMinutes: 5 }]);
  }

  function reuseAction(plannedActionId: string) {
    updateActions([...plan.actions, { plannedActionId, lengthMinutes: 5 }]);
  }

  function moveAction(from: number, delta: -1 | 1) {
    const to = from + delta;
    if (to < 0 || to >= plan.actions.length) return;
    const actions = [...plan.actions];
    [actions[from], actions[to]] = [actions[to], actions[from]];
    updateActions(actions);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span>Plan {index + 1}</span>
          <span className="text-sm font-normal text-muted-foreground">
            {plan.actions.length} acciones · {formatSeconds(plannedTotalSeconds(schedule))}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-3">
          <label
            htmlFor={`plan-${plan.id}-fixed-start`}
            className="flex items-center justify-between gap-3 text-sm"
          >
            <span>Hora de inicio fija</span>
            <Switch
              id={`plan-${plan.id}-fixed-start`}
              checked={plan.startTime !== null}
              onCheckedChange={(checked) =>
                onChange({ ...plan, startTime: checked ? "07:00" : null })
              }
            />
          </label>
          {plan.startTime !== null ? (
            <Field label="Empieza a las" htmlFor={`plan-${plan.id}-start`}>
              <Input
                id={`plan-${plan.id}-start`}
                type="time"
                value={plan.startTime}
                onChange={(event) => onChange({ ...plan, startTime: event.target.value })}
              />
            </Field>
          ) : (
            <p className="text-sm text-muted-foreground">
              Sin hora fija: las acciones se miden desde que empieza el Round.
            </p>
          )}
        </div>

        <Field label="Desde" htmlFor={`plan-${plan.id}-from`}>
          <DatePicker
            id={`plan-${plan.id}-from`}
            value={parseDate(plan.periodStart)}
            onChange={(date) => onChange({ ...plan, periodStart: date.toString() })}
          />
        </Field>

        <div className="flex flex-col gap-3">
          <label
            htmlFor={`plan-${plan.id}-open-ended`}
            className="flex items-center justify-between gap-3 text-sm"
          >
            <span>Sin fecha de fin</span>
            <Switch
              id={`plan-${plan.id}-open-ended`}
              checked={plan.periodEnd === null}
              onCheckedChange={(checked) =>
                onChange({ ...plan, periodEnd: checked ? null : plan.periodStart })
              }
            />
          </label>
          {plan.periodEnd !== null && (
            <Field label="Hasta" htmlFor={`plan-${plan.id}-to`}>
              <DatePicker
                id={`plan-${plan.id}-to`}
                value={parseDate(plan.periodEnd)}
                onChange={(date) => onChange({ ...plan, periodEnd: date.toString() })}
              />
            </Field>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Acciones</span>
          <ul className="flex flex-col gap-2">
            {plan.actions.map((planAction, actionIndex) => {
              const plannedAction = byId.get(planAction.plannedActionId);
              if (!plannedAction) return null;
              return (
                <PlanActionRow
                  key={planAction.plannedActionId}
                  action={{ ...plannedAction, lengthMinutes: planAction.lengthMinutes }}
                  scheduled={schedule[actionIndex]}
                  isFirst={actionIndex === 0}
                  isLast={actionIndex === plan.actions.length - 1}
                  onNameChange={(name) => onPlannedActionChange(plannedAction.id, { name })}
                  onEquipmentChange={(equipment) =>
                    onPlannedActionChange(plannedAction.id, { equipment })
                  }
                  onLengthChange={(lengthMinutes) =>
                    updateActions(
                      plan.actions.map((item, i) =>
                        i === actionIndex ? { ...item, lengthMinutes } : item,
                      ),
                    )
                  }
                  onMove={(delta) => moveAction(actionIndex, delta)}
                  onRemove={() => updateActions(plan.actions.filter((_, i) => i !== actionIndex))}
                />
              );
            })}
          </ul>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="lg" onClick={addNewAction}>
              <Plus />
              Añadir acción
            </Button>
            {unused.length > 0 && (
              <Select
                items={unused.map((a) => ({ value: a.id, label: a.name || "Sin nombre" }))}
                value={null}
                onValueChange={(value) => value && reuseAction(value)}
              >
                <SelectTrigger className="w-auto">
                  <SelectValue placeholder="Reusar acción" />
                </SelectTrigger>
                <SelectContent>
                  {unused.map((action) => (
                    <SelectItem key={action.id} value={action.id}>
                      {action.name || "Sin nombre"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {canRemove && (
          <Button variant="destructive" size="lg" onClick={onRemove}>
            <Trash2 />
            Eliminar este plan
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
