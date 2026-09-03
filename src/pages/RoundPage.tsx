import type { RoundWithActions, RoutineWithPlans } from "@shared/types";
import {
  CalendarX,
  Check,
  CircleCheckBig,
  Eraser,
  Flag,
  Loader2,
  MoreVertical,
  Play,
  Redo2,
  RotateCcw,
  Undo2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { DatePicker } from "@/components/DatePicker";
import { Field } from "@/components/forms/Field";
import { PageHeader } from "@/components/PageHeader";
import { type ActionChoice, CurrentActionCombobox } from "@/components/round/CurrentActionCombobox";
import { CurrentActionTimer } from "@/components/round/CurrentActionTimer";
import { PerformedActionList } from "@/components/round/PerformedActionList";
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
  isRoundDone,
  nextPlannedAction,
  planForDate,
  plannedSchedule,
  roundElapsedSeconds,
  stretchOrigin,
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
  Temporal,
  today,
} from "@/lib/temporal";

// A round has three phases, and the big button says which one you are in:
//
//   idle     no round row yet          → "Empezar"
//   running  started, not closed       → "Terminar acción"
//   done     closed (`endedAt` set)    → the closing card, no button at all
//
// The start matters as much as the end: the row used to be created by the
// first "Terminar acción", which stamped `startedAt` and the first action's
// `endedAt` in the same instant and so recorded every first step as lasting
// zero seconds.

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
  // Only what the user picked *instead of* what the plan proposes. Null means
  // "follow the plan", which is where every tap leaves it — see `choice`.
  const [override, setOverride] = useState<ActionChoice | null>(null);
  const [manualTime, setManualTime] = useState("");
  const [manualError, setManualError] = useState<string | null>(null);

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
  // record something unplanned or to correct a step, and every tap hands it
  // back to the plan. Deriving it instead of mirroring it into state is what
  // stops a free action from staying in the box after being recorded — the
  // plan's next step is only ever one `setOverride(null)` away.
  const suggested = useMemo(
    () => nextPlannedAction(schedule, round.round),
    [schedule, round.round],
  );
  const choice = useMemo<ActionChoice | null>(
    () =>
      override ??
      (suggested ? { plannedActionId: suggested.plannedActionId, name: suggested.name } : null),
    [override, suggested],
  );

  const summary = round.round ? summarizeRound(round.round, schedule) : null;
  const finished = isRoundDone(round.round);
  const canRecord = Boolean(choice?.name.trim());
  // The plan is exhausted and nothing has been typed in its place: the only
  // thing left to do is close the round. This is exactly where the button used
  // to grey out with no explanation.
  const readyToClose = round.round !== null && !finished && suggested === null && !canRecord;

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
    // Hand the box back to the plan, whatever was in it.
    setOverride(null);
    setManualTime("");
    setManualError(null);
  }

  // A time typed as HH:MM, on the round's own day. Null when it isn't a time
  // yet or when it hasn't happened.
  function manualInstant(value: string): Temporal.Instant | null {
    if (!/^\d{2}:\d{2}$/.test(value)) {
      setManualError("Escribe una hora como 07:32.");
      return null;
    }
    const instant = instantAt(date, parseTime(value), getTimeZone());
    if (Temporal.Instant.compare(instant, nowInstant()) > 0) {
      setManualError("Esa hora todavía no ha llegado.");
      return null;
    }
    return instant;
  }

  // Starting late: you got up at 7:00 and only reached for the phone at 7:20.
  function startAt(value: string) {
    const instant = manualInstant(value);
    if (!instant) return;
    setManualError(null);
    setManualTime("");
    round.start(instant);
  }

  // "Terminar acción" at a time other than now — for when you remember two
  // steps later that you finished breakfast at 7:45. Anything at or before the
  // start of the current stretch would give the step a zero or negative
  // length, which used to be accepted in silence.
  function finishAt(value: string) {
    if (!round.round) return;
    const instant = manualInstant(value);
    if (!instant) return;
    const origin = stretchOrigin(round.round);
    if (Temporal.Instant.compare(instant, origin) <= 0) {
      setManualError(`Este tramo empezó a las ${formatClock(origin)}: tiene que ser posterior.`);
      return;
    }
    finish(instant);
  }

  // Closing the round. When the plan has been recorded to the end, the round
  // really ended at that last tap — the minutes spent writing the comments
  // afterwards are not part of it. Closing early (a routine abandoned halfway,
  // from the menu) ends it now.
  function finishRound() {
    const current = round.round;
    if (!current) return;
    const endedAt =
      suggested === null && current.actions.length > 0 ? stretchOrigin(current) : nowInstant();
    round.finishRound(endedAt);
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
        description={describeRound(round.round, now)}
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
                <DropdownMenuItem disabled>Aún sin empezar</DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              {finished ? (
                <DropdownMenuItem onClick={round.reopenRound}>
                  <RotateCcw />
                  Reabrir el Round
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem disabled={!round.round} onClick={finishRound}>
                  <Flag />
                  Terminar el Round
                </DropdownMenuItem>
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

          {finished ? (
            <RoundDoneCard
              recorded={summary?.segments.length ?? 0}
              planned={schedule.length}
              deviationSeconds={summary?.deviationSeconds ?? 0}
              elapsedSeconds={roundElapsedSeconds(round.round, now)}
              onReopen={round.reopenRound}
            />
          ) : (
            <Card>
              <CardContent className="flex flex-col gap-3">
                <Field label="Acción actual" htmlFor="current-action">
                  <CurrentActionCombobox
                    schedule={schedule}
                    doneIds={doneIds}
                    value={choice}
                    onChange={setOverride}
                  />
                </Field>

                <CurrentActionTimer
                  round={round.round}
                  expected={schedule[current]?.length ?? null}
                  next={nextAction}
                  now={now}
                />

                {/* The only control that matters mid-routine: one thumb, one
                    tap. It never goes dead — it always names the next thing
                    there is to do, including closing the round. */}
                {round.round === null ? (
                  <Button className="h-20 text-lg" onClick={() => round.start()}>
                    <Play />
                    Empezar ahora
                  </Button>
                ) : readyToClose ? (
                  <Button className="h-20 text-lg" onClick={finishRound}>
                    <Flag />
                    Terminar el Round
                  </Button>
                ) : (
                  <Button className="h-20 text-lg" disabled={!canRecord} onClick={() => finish()}>
                    Terminar acción
                  </Button>
                )}

                {!readyToClose && (
                  <div className="flex items-end gap-2">
                    <div className="min-w-0 flex-1">
                      <Field
                        label={round.round === null ? "…o empecé a las:" : "…o la terminé a las:"}
                        htmlFor="manual-time"
                        error={manualError ?? undefined}
                      >
                        <Input
                          id="manual-time"
                          type="time"
                          value={manualTime}
                          onChange={(event) => {
                            setManualTime(event.target.value);
                            setManualError(null);
                          }}
                        />
                      </Field>
                    </div>
                    <Button
                      variant="outline"
                      size="lg"
                      disabled={!manualTime || (round.round !== null && !canRecord)}
                      onClick={() =>
                        round.round === null ? startAt(manualTime) : finishAt(manualTime)
                      }
                    >
                      {round.round === null ? "Empezar" : "Marcar"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {summary && summary.segments.length > 0 && (
            <Card>
              <CardContent className="flex flex-col gap-2">
                <span className="text-sm font-medium">Registrado</span>
                <PerformedActionList
                  segments={summary.segments}
                  date={date}
                  colors={colors}
                  onUpdate={round.updateAction}
                  onRemove={round.removeAction}
                />
              </CardContent>
            </Card>
          )}
        </>
      )}

      {dialog}
    </div>
  );
}

// The header's one line of status, which is also the only place the round's
// start and end are shown as clock times.
function describeRound(round: RoundWithActions | null, now: Temporal.Instant): string {
  if (!round) return "Marca cada acción según la terminas.";
  const started = formatClock(parseInstant(round.startedAt));
  if (round.endedAt === null) return `Empezado a las ${started}`;
  const ended = formatClock(parseInstant(round.endedAt));
  const total = formatSeconds(Math.round(roundElapsedSeconds(round, now)));
  return `${started} – ${ended} · ${total}`;
}

function RoundDoneCard({
  recorded,
  planned,
  deviationSeconds,
  elapsedSeconds,
  onReopen,
}: {
  recorded: number;
  planned: number;
  deviationSeconds: number;
  elapsedSeconds: number;
  onReopen: () => void;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 text-center">
        <CircleCheckBig className="size-8 text-muted-foreground" />
        <div className="flex flex-col gap-1">
          <p className="font-medium">Round terminado</p>
          <p className="text-sm text-muted-foreground">
            {recorded} de {planned} acciones · {formatSeconds(Math.round(elapsedSeconds))} ·{" "}
            {formatDeviation(Math.round(deviationSeconds))} frente al plan
          </p>
        </div>
        {/* Both ways out, at the moment they're actually wanted: this used to
            live in the ⋮ menu, where nobody looks once they've finished. */}
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
          <Button variant="outline" onClick={onReopen}>
            <RotateCcw />
            Reabrir
          </Button>
          <Button render={<Link to="/rounds/new" />}>Empezar otro</Button>
        </div>
      </CardContent>
    </Card>
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
