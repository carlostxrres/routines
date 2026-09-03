import type { RoutineWithPlans } from "@shared/types";
import { CalendarX, Check, Eraser, Loader2, MoreVertical, Redo2, Undo2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { DatePicker } from "@/components/DatePicker";
import { Field } from "@/components/forms/Field";
import { PageHeader } from "@/components/PageHeader";
import { type ActionChoice, CurrentActionCombobox } from "@/components/round/CurrentActionCombobox";
import { CurrentActionTimer } from "@/components/round/CurrentActionTimer";
import { RoundTimeline } from "@/components/round/RoundTimeline";
import { SignInEmpty } from "@/components/SignInEmpty";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { useNow } from "@/hooks/useNow";
import { useRound } from "@/hooks/useRound";
import { useRoutines } from "@/hooks/useRoutines";
import { useSettings } from "@/hooks/useSettings";
import { useWakeLock } from "@/hooks/useWakeLock";
import { actionColorMap } from "@/lib/actionColors";
import { apiClient } from "@/lib/api-client";
import {
  coversDate,
  nextPlannedAction,
  planForDate,
  plannedSchedule,
  summarizeRound,
} from "@/lib/schedule";
import {
  formatClock,
  formatDeviation,
  formatSeconds,
  getTimeZone,
  instantAt,
  nowInstant,
  parseDate,
  parseInstant,
  parseTime,
  today,
} from "@/lib/temporal";

export function RoundPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { session } = useAuth();
  const { settings } = useSettings();
  const { routines } = useRoutines();
  const { confirm, dialog } = useConfirmDialog();
  const wakeLock = useWakeLock();
  const now = useNow();

  const [date, setDate] = useState(() => today());
  const [routineId, setRoutineId] = useState<string | null>(null);
  const [choice, setChoice] = useState<ActionChoice | null>(null);
  const [manualTime, setManualTime] = useState("");

  const round = useRound({
    routineId,
    date: date.toString(),
    onCreated: (createdId) => navigate(`/rounds/${createdId}`, { replace: true }),
  });

  // Arriving at /rounds/:id: the round decides the date and the routine, not
  // the other way round.
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    apiClient
      .get<{ routineId: string; date: string }>(`/rounds/${id}`)
      .then((loaded) => {
        if (cancelled) return;
        setRoutineId(loaded.routineId);
        setDate(parseDate(loaded.date));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Routines that actually have a plan on the selected day — the rest can't be
  // recorded and shouldn't be offered.
  const available = useMemo(
    () => (routines ?? []).filter((routine) => coversDate(routine, date)),
    [routines, date],
  );

  // Default to the only sensible choice rather than making the user pick.
  useEffect(() => {
    if (routineId && available.some((routine) => routine.id === routineId)) return;
    setRoutineId(available[0]?.id ?? null);
  }, [available, routineId]);

  const routine = available.find((item) => item.id === routineId) ?? null;
  const plan = routine ? planForDate(routine, date) : null;
  const schedule = useMemo(
    () => (routine && plan ? plannedSchedule(plan, routine.plannedActions) : []),
    [routine, plan],
  );
  const colors = useMemo(
    () =>
      actionColorMap(
        schedule.map((action) => action.plannedActionId),
        settings?.chartHue ?? 30,
      ),
    [schedule, settings?.chartHue],
  );
  const doneIds = useMemo(
    () =>
      new Set(
        (round.round?.actions ?? [])
          .map((action) => action.plannedActionId)
          .filter((value): value is string => value !== null),
      ),
    [round.round],
  );

  // "Acción actual" follows the plan on its own; the user only touches it to
  // record something unplanned or to correct a step.
  const suggested = useMemo(
    () => nextPlannedAction(schedule, round.round),
    [schedule, round.round],
  );
  useEffect(() => {
    setChoice(
      suggested ? { plannedActionId: suggested.plannedActionId, name: suggested.name } : null,
    );
  }, [suggested]);

  const summary = round.round ? summarizeRound(round.round, schedule) : null;

  // What the timer needs: how long the chosen action should take, and what
  // comes after it. A free action isn't in the schedule, so `current` is -1 and
  // there is nothing to compare against — but the plan's first unrecorded step
  // is still what you'll go back to, so that's what "Siguiente" shows.
  const current = schedule.findIndex(
    (action) => action.plannedActionId === choice?.plannedActionId,
  );
  const nextAction =
    current === -1
      ? suggested
      : (schedule.slice(current + 1).find((action) => !doneIds.has(action.plannedActionId)) ??
        null);

  function finish(endedAt = nowInstant()) {
    if (!choice?.name.trim()) return;
    round.finishAction({
      plannedActionId: choice.plannedActionId,
      name: choice.name.trim(),
      endedAt,
    });
    setManualTime("");
  }

  // "Terminar acción" at a time other than now — for when you remember two
  // steps later that you finished breakfast at 7:45.
  function finishAt(value: string) {
    if (!/^\d{2}:\d{2}$/.test(value)) return;
    finish(instantAt(date, parseTime(value), getTimeZone()));
  }

  async function handleClear() {
    const confirmed = await confirm({
      title: "¿Vaciar este Round?",
      description: "Se borrarán todas las acciones registradas. Puedes deshacerlo con Atrás.",
      confirmLabel: "Vaciar",
    });
    if (confirmed) round.clearActions();
  }

  if (!session) {
    return (
      <div className="p-4">
        <SignInEmpty description="Registrar un Round requiere iniciar sesión. Los Rounds ya registrados se pueden consultar sin cuenta." />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <PageHeader
        title="Registrar"
        description={
          round.round
            ? `Empezado a las ${formatClock(parseInstant(round.round.startedAt))}`
            : "Marca cada acción según la terminas."
        }
        action={
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon-lg" aria-label="Opciones del Round" />}
            >
              {round.saving ? <Loader2 className="animate-spin" /> : <MoreVertical />}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {id ? (
                <DropdownMenuItem render={<Link to="/rounds/new" />}>
                  Guardar y empezar otro
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem disabled>Aún sin crear</DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled={!round.canUndo} onClick={round.undo}>
                <Undo2 />
                Atrás
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!round.canRedo} onClick={round.redo}>
                <Redo2 />
                Adelante
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={!wakeLock.supported}
                onClick={() => wakeLock.setEnabled(!wakeLock.enabled)}
              >
                {wakeLock.enabled && <Check />}
                Mantener pantalla encendida
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                disabled={!round.round?.actions.length}
                onClick={handleClear}
              >
                <Eraser />
                Vaciar Round
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      <Card>
        <CardContent className="flex flex-col gap-3">
          <Field label="Día" htmlFor="round-date">
            <DatePicker
              id="round-date"
              value={date}
              onChange={setDate}
              isDisabled={(candidate) =>
                (routines ?? []).every((item) => !coversDate(item, candidate))
              }
            />
          </Field>
          <Field label="Rutina" htmlFor="round-routine">
            <Select
              items={available.map((item) => ({ value: item.id, label: item.name }))}
              value={routineId}
              onValueChange={(value) => setRoutineId(value)}
            >
              <SelectTrigger id="round-routine" className="w-full">
                <SelectValue placeholder="Elige una rutina" />
              </SelectTrigger>
              <SelectContent>
                {available.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </CardContent>
      </Card>

      {routines === null && <Skeleton className="h-48 w-full" />}

      {routines !== null && !plan && <NoPlanEmpty routines={routines} />}

      {plan && (
        <>
          <Card>
            <CardContent className="flex flex-col gap-4">
              <RoundTimeline round={round.round} schedule={schedule} colors={colors} now={now} />
              {summary && summary.segments.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  {summary.segments.length} de {schedule.length} acciones ·{" "}
                  {formatDeviation(Math.round(summary.deviationSeconds))} frente al plan
                </p>
              )}
              <Field label="Comentarios del Round" htmlFor="round-comments">
                <Textarea
                  id="round-comments"
                  rows={2}
                  value={round.round?.comments ?? ""}
                  placeholder="Cómo ha ido, qué se ha torcido…"
                  onChange={(event) => round.setComments(event.target.value)}
                  disabled={!round.round}
                />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-col gap-3">
              <Field label="Acción actual" htmlFor="current-action">
                <CurrentActionCombobox
                  schedule={schedule}
                  doneIds={doneIds}
                  value={choice}
                  onChange={setChoice}
                />
              </Field>

              <CurrentActionTimer
                round={round.round}
                expected={schedule[current]?.length ?? null}
                next={nextAction}
                now={now}
              />

              {/* The only control that matters mid-routine: one thumb, one tap. */}
              <Button
                className="h-20 text-lg"
                disabled={!choice?.name.trim()}
                onClick={() => finish()}
              >
                Terminar acción
              </Button>

              <div className="flex items-end gap-2">
                <Field label="…o a otra hora:" htmlFor="manual-time">
                  <Input
                    id="manual-time"
                    type="time"
                    value={manualTime}
                    onChange={(event) => setManualTime(event.target.value)}
                  />
                </Field>
                <Button
                  variant="outline"
                  size="lg"
                  disabled={!manualTime || !choice?.name.trim()}
                  onClick={() => finishAt(manualTime)}
                >
                  Marcar
                </Button>
              </div>
            </CardContent>
          </Card>

          {summary && summary.segments.length > 0 && (
            <Card>
              <CardContent className="flex flex-col gap-2">
                <span className="text-sm font-medium">Registrado</span>
                <ul className="flex flex-col gap-1 text-sm">
                  {summary.segments.map((segment) => (
                    <li key={segment.id} className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{
                            backgroundColor: segment.plannedActionId
                              ? colors.get(segment.plannedActionId)
                              : "var(--muted-foreground)",
                          }}
                        />
                        <span className="truncate">{segment.name}</span>
                      </span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {formatClock(segment.endedAt)} ·{" "}
                        {formatSeconds(Math.round(segment.duration.total("second")))}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {dialog}
    </div>
  );
}

function NoPlanEmpty({ routines }: { routines: RoutineWithPlans[] }) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <CalendarX />
        </EmptyMedia>
        <EmptyTitle>Ninguna rutina cubre este día</EmptyTitle>
        <EmptyDescription>
          {routines.length === 0
            ? "Todavía no has creado ninguna rutina."
            : "Ninguno de los planes de tus rutinas incluye la fecha seleccionada."}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button render={<Link to="/routines/new" />}>Crear una rutina</Button>
      </EmptyContent>
    </Empty>
  );
}
