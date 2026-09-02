import type { RoundWithActions, RoutineWithPlans } from "@shared/types";
import { CalendarDays, MoreVertical } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/hooks/useAuth";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { useRoutines } from "@/hooks/useRoutines";
import { apiClient } from "@/lib/api-client";
import { planForDate, plannedSchedule, summarizeRound } from "@/lib/schedule";
import { formatDayShort, formatDeviation, parseDate } from "@/lib/temporal";

const PAGE_SIZE = 100;

export function RoundsPage() {
  const { session } = useAuth();
  const { routines } = useRoutines();
  const { confirm, dialog } = useConfirmDialog();
  const [rounds, setRounds] = useState<RoundWithActions[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setRounds(await apiClient.get<RoundWithActions[]>(`/rounds?limit=${PAGE_SIZE}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar el historial.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const byRoutine = useMemo(
    () => new Map((routines ?? []).map((routine) => [routine.id, routine])),
    [routines],
  );

  async function handleDelete(round: RoundWithActions) {
    const confirmed = await confirm({
      title: "¿Eliminar este Round?",
      description: "Se borrarán todas sus acciones. Esta acción no se puede deshacer.",
      confirmLabel: "Eliminar",
    });
    if (!confirmed) return;
    try {
      await apiClient.delete(`/rounds/${round.id}`);
      toast.success("Round eliminado.");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo eliminar.");
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <PageHeader title="Historial" description="Todos los Rounds registrados." />

      {error && <p className="text-sm text-destructive">{error}</p>}
      {rounds === null && !error && <Skeleton className="h-48 w-full" />}

      {rounds?.length === 0 && (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CalendarDays />
            </EmptyMedia>
            <EmptyTitle>Todavía no hay Rounds</EmptyTitle>
            <EmptyDescription>
              Registra tu primera rutina desde la pestaña "Registrar".
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      {rounds && rounds.length > 0 && (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Día</TableHead>
                <TableHead>Rutina</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
                <TableHead className="text-right">Desvío</TableHead>
                {session && <TableHead />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rounds.map((round) => (
                <RoundRow
                  key={round.id}
                  round={round}
                  routine={byRoutine.get(round.routineId)}
                  canEdit={Boolean(session)}
                  onDelete={() => handleDelete(round)}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {dialog}
    </div>
  );
}

function RoundRow({
  round,
  routine,
  canEdit,
  onDelete,
}: {
  round: RoundWithActions;
  routine: RoutineWithPlans | undefined;
  canEdit: boolean;
  onDelete: () => void;
}) {
  const date = parseDate(round.date);
  // A round can outlive the plan it was recorded against (a plan deleted, a
  // period narrowed), so there may be nothing to compare it to.
  const plan = routine ? planForDate(routine, date) : null;
  const schedule = routine && plan ? plannedSchedule(plan, routine.plannedActions) : [];
  const summary = schedule.length > 0 ? summarizeRound(round, schedule) : null;

  return (
    <TableRow>
      <TableCell className="whitespace-nowrap">
        <Link to={`/rounds/${round.id}`} className="font-medium">
          {formatDayShort(date, true)}
        </Link>
      </TableCell>
      <TableCell className="max-w-32 truncate">{routine?.name ?? "—"}</TableCell>
      <TableCell className="text-right tabular-nums">
        {round.actions.length}
        {schedule.length > 0 && <span className="text-muted-foreground">/{schedule.length}</span>}
      </TableCell>
      <TableCell className="text-right whitespace-nowrap tabular-nums text-muted-foreground">
        {summary ? formatDeviation(Math.round(summary.deviationSeconds)) : "—"}
      </TableCell>
      {canEdit && (
        <TableCell className="w-10">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon" aria-label="Opciones" />}
            >
              <MoreVertical />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem render={<Link to={`/rounds/${round.id}`} />}>
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={onDelete}>
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      )}
    </TableRow>
  );
}
