import type { RoutineWithPlans } from "@shared/types";
import { ListChecks, MoreVertical, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useAuth";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { useRoutines } from "@/hooks/useRoutines";
import { apiClient } from "@/lib/api-client";
import {
  isRoutineCurrent,
  planForDate,
  plannedSchedule,
  plannedTotalSeconds,
} from "@/lib/schedule";
import { formatDayShort, formatSeconds, parseDate, parseTime, today } from "@/lib/temporal";

function RoutineCard({ routine, onDeleted }: { routine: RoutineWithPlans; onDeleted: () => void }) {
  const { session } = useAuth();
  const { confirm, dialog } = useConfirmDialog();
  const now = today();
  const activePlan = planForDate(routine, now);
  const plan = activePlan ?? routine.plans[routine.plans.length - 1] ?? null;
  const schedule = plan ? plannedSchedule(plan, routine.plannedActions) : [];

  async function handleDelete() {
    const confirmed = await confirm({
      title: `¿Eliminar "${routine.name}"?`,
      description:
        "Se borrarán también todos sus Rounds registrados. Esta acción no se puede deshacer.",
      confirmLabel: "Eliminar",
    });
    if (!confirmed) return;
    try {
      await apiClient.delete(`/routines/${routine.id}`);
      toast.success("Rutina eliminada.");
      onDeleted();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo eliminar.");
    }
  }

  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3">
        <Link to={`/routines/${routine.id}`} className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="font-medium">{routine.name}</span>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary">
              {plan?.startTime
                ? parseTime(plan.startTime).toString({ smallestUnit: "minute" })
                : "Hora variable"}
            </Badge>
            <Badge variant="outline">{schedule.length} acciones</Badge>
            <Badge variant="outline">{formatSeconds(plannedTotalSeconds(schedule))}</Badge>
            {!activePlan && <Badge variant="outline">Sin plan vigente</Badge>}
          </div>
          {plan && (
            <span className="text-sm text-muted-foreground">
              {formatDayShort(parseDate(plan.periodStart))}
              {" → "}
              {plan.periodEnd ? formatDayShort(parseDate(plan.periodEnd)) : "sin fin"}
              {routine.plans.length > 1 && ` · ${routine.plans.length} planes`}
            </span>
          )}
        </Link>
        {session && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon-lg" aria-label="Opciones" />}
            >
              <MoreVertical />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem render={<Link to={`/routines/${routine.id}`} />}>
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={handleDelete}>
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </CardContent>
      {dialog}
    </Card>
  );
}

export function RoutinesPage() {
  const { session } = useAuth();
  const { routines, error, loading, refetch } = useRoutines();
  const navigate = useNavigate();
  // Old routines pile up but stay relevant to the charts, so they're hidden
  // here rather than deleted.
  const [showPast, setShowPast] = useState(false);

  const visible = useMemo(() => {
    if (!routines) return [];
    const now = today();
    return showPast ? routines : routines.filter((routine) => isRoutineCurrent(routine, now));
  }, [routines, showPast]);

  const hiddenCount = (routines?.length ?? 0) - visible.length;

  return (
    <div className="flex flex-col gap-4 p-4">
      <PageHeader
        title="Rutinas"
        description="Cada rutina agrupa los planes que ha tenido a lo largo del tiempo."
        action={
          session ? (
            <Button render={<Link to="/routines/new" />} size="lg">
              <Plus />
              Nueva
            </Button>
          ) : undefined
        }
      />

      {error && <p className="text-sm text-destructive">{error}</p>}

      {loading && (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      )}

      {!loading && visible.length === 0 && (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ListChecks />
            </EmptyMedia>
            <EmptyTitle>
              {routines?.length ? "Ninguna rutina vigente" : "Todavía no hay rutinas"}
            </EmptyTitle>
            <EmptyDescription>
              {routines?.length
                ? "Todas tus rutinas tienen planes que ya han terminado."
                : "Crea una rutina con sus acciones y sus duraciones previstas para empezar a registrar Rounds."}
            </EmptyDescription>
          </EmptyHeader>
          {session && (
            <EmptyContent>
              <Button onClick={() => navigate("/routines/new")}>Crear una rutina</Button>
            </EmptyContent>
          )}
        </Empty>
      )}

      <div className="flex flex-col gap-3">
        {visible.map((routine) => (
          <RoutineCard key={routine.id} routine={routine} onDeleted={refetch} />
        ))}
      </div>

      {(hiddenCount > 0 || showPast) && (
        <label
          htmlFor="show-past-routines"
          className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm"
        >
          <span className="text-muted-foreground">
            Mostrar rutinas antiguas
            {hiddenCount > 0 && !showPast && ` (${hiddenCount})`}
          </span>
          <Switch id="show-past-routines" checked={showPast} onCheckedChange={setShowPast} />
        </label>
      )}
    </div>
  );
}
