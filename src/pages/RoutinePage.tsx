import { routineInputSchema } from "@shared/validation";
import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Field } from "@/components/forms/Field";
import { PageHeader } from "@/components/PageHeader";
import { PlanEditor } from "@/components/routine/PlanEditor";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { useRoutine } from "@/hooks/useRoutines";
import { apiClient } from "@/lib/api-client";
import {
  appendPlan,
  type DraftPlan,
  type DraftPlannedAction,
  draftFromRoutine,
  draftToInput,
  emptyDraft,
  type RoutineDraft,
} from "@/lib/routineDraft";

export function RoutinePage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { routine, error: loadError, loading } = useRoutine(id);
  const { confirm, dialog } = useConfirmDialog();

  const [draft, setDraft] = useState<RoutineDraft>(() => emptyDraft());
  const [issues, setIssues] = useState<Map<string, string>>(new Map());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (routine) setDraft(draftFromRoutine(routine));
  }, [routine]);

  function updatePlan(index: number, plan: DraftPlan) {
    setDraft((current) => ({
      ...current,
      plans: current.plans.map((item, i) => (i === index ? plan : item)),
    }));
  }

  function updatePlannedAction(actionId: string, patch: Partial<DraftPlannedAction>) {
    setDraft((current) => ({
      ...current,
      plannedActions: current.plannedActions.map((action) =>
        action.id === actionId ? { ...action, ...patch } : action,
      ),
    }));
  }

  async function handleSave() {
    const input = draftToInput(draft);
    const parsed = routineInputSchema.safeParse(input);
    if (!parsed.success) {
      // Keyed by the issue's path so each field can show its own message; the
      // schema's superRefine already points at the exact plan and action.
      setIssues(new Map(parsed.error.issues.map((issue) => [issue.path.join("."), issue.message])));
      toast.error("Revisa los campos marcados.");
      return;
    }

    setIssues(new Map());
    setSaving(true);
    try {
      if (id) {
        await apiClient.patch(`/routines/${id}`, parsed.data);
        toast.success("Rutina guardada.");
      } else {
        const created = await apiClient.post<{ id: string }>("/routines", parsed.data);
        toast.success("Rutina creada.");
        navigate(`/routines/${created.id}`, { replace: true });
        return;
      }
      navigate("/routines");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemovePlan(index: number) {
    const confirmed = await confirm({
      title: "¿Eliminar este plan?",
      description:
        "Los Rounds registrados durante su periodo se conservan, pero dejarán de tener un plan con el que compararse.",
      confirmLabel: "Eliminar",
    });
    if (!confirmed) return;
    setDraft((current) => ({
      ...current,
      plans: current.plans.filter((_, i) => i !== index),
    }));
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <PageHeader
        title={id ? "Editar rutina" : "Nueva rutina"}
        description="Los planes describen cómo ha sido esta rutina en cada periodo."
      />

      {loadError && <p className="text-sm text-destructive">{loadError}</p>}

      <Card>
        <CardContent>
          <Field label="Nombre" htmlFor="routine-name" error={issues.get("name")}>
            <Input
              id="routine-name"
              value={draft.name}
              placeholder="Mañanas"
              onChange={(event) =>
                setDraft((current) => ({ ...current, name: event.target.value }))
              }
            />
          </Field>
        </CardContent>
      </Card>

      {draft.plans.map((plan, index) => (
        <div key={plan.id} className="flex flex-col gap-1">
          <PlanEditor
            plan={plan}
            index={index}
            plannedActions={draft.plannedActions}
            canRemove={draft.plans.length > 1}
            onChange={(next) => updatePlan(index, next)}
            onRemove={() => handleRemovePlan(index)}
            onPlannedActionChange={updatePlannedAction}
            onAddPlannedAction={(action) =>
              setDraft((current) => ({
                ...current,
                plannedActions: [...current.plannedActions, action],
              }))
            }
          />
          {[`plans.${index}.periodStart`, `plans.${index}.periodEnd`]
            .map((path) => issues.get(path))
            .filter(Boolean)
            .map((message) => (
              <p key={message} className="text-sm text-destructive">
                {message}
              </p>
            ))}
        </div>
      ))}

      <Button variant="outline" size="lg" onClick={() => setDraft(appendPlan)}>
        <Plus />
        Añadir plan
      </Button>

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="lg"
          className="flex-1"
          onClick={() => navigate("/routines")}
        >
          Cancelar
        </Button>
        <Button size="lg" className="flex-1" disabled={saving} onClick={handleSave}>
          {saving ? "Guardando…" : "Guardar"}
        </Button>
      </div>

      {dialog}
    </div>
  );
}
