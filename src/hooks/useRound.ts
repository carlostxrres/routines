import type { PerformedAction, RoundWithActions } from "@shared/types";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import { nowInstant, serializeInstant, type Temporal } from "@/lib/temporal";

// The recording page's state.
//
// Local state is the source of truth while you tap: every change lands in the
// UI immediately and is *then* pushed to the server by a serialized queue. A
// failed write rolls the round back to the last state the server confirmed and
// offers a retry, so a dropped connection can never leave the screen showing
// something that was never saved.
//
// Writes are expressed as whole desired states rather than as individual calls,
// which is what makes undo/redo work: restoring an old snapshot goes through
// exactly the same diffing code as any other edit.

export type RoundDraft = RoundWithActions;

type UseRoundOptions = {
  routineId: string | null;
  date: string | null;
  // Called with the id of a round created by the first edit, so the page can
  // swap /rounds/new for /rounds/:id.
  onCreated?: (roundId: string) => void;
};

export function useRound({ routineId, date, onCreated }: UseRoundOptions) {
  // Round plus undo history in one piece of state: every operation is a single
  // transition, so there is never a render where the round has moved but the
  // history hasn't.
  const [state, setState] = useState<{
    round: RoundWithActions | null;
    past: RoundWithActions[];
    future: RoundWithActions[];
  }>({ round: null, past: [], future: [] });
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(0);

  // The last state the server confirmed: both the diff base for the next write
  // and the rollback target when one fails.
  const serverRef = useRef<RoundWithActions | null>(null);
  // Serializes writes so two fast taps can't interleave.
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());
  // Bumped on every write; a settled write only adopts the server's copy if no
  // newer edit happened while it was in flight.
  const revisionRef = useRef(0);
  // Lets a failed write offer a retry without `sync` having to close over
  // `enqueue`, which is declared after it.
  const enqueueRef = useRef<(target: RoundWithActions) => void>(() => undefined);

  // ---- loading -----------------------------------------------------------

  useEffect(() => {
    if (!routineId || !date) {
      serverRef.current = null;
      setState({ round: null, past: [], future: [] });
      return;
    }
    let cancelled = false;
    setLoading(true);
    apiClient
      .get<RoundWithActions[]>(`/rounds?routineId=${routineId}&date=${date}`)
      .then((rows) => {
        if (cancelled) return;
        const found = rows[0] ?? null;
        serverRef.current = found;
        setState({ round: found, past: [], future: [] });
      })
      .catch((err) => {
        if (!cancelled) toast.error(err instanceof Error ? err.message : "Error al cargar.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [routineId, date]);

  // ---- writing -----------------------------------------------------------

  const sync = useCallback(async (target: RoundWithActions) => {
    const revision = ++revisionRef.current;

    try {
      const saved = await reconcile(serverRef.current, target);
      serverRef.current = saved;
      // Only adopt the server's copy if nothing was tapped while this was in
      // flight; otherwise the newer local state stands and its own sync will
      // reconcile from here.
      if (revisionRef.current === revision) {
        setState((current) => ({ ...current, round: saved }));
      }
    } catch (err) {
      const rollback = serverRef.current;
      setState((current) => ({ ...current, round: rollback }));
      toast.error(err instanceof Error ? err.message : "No se pudo guardar.", {
        action: { label: "Reintentar", onClick: () => enqueueRef.current(target) },
      });
    }
  }, []);

  const enqueue = useCallback(
    (target: RoundWithActions) => {
      setPending((count) => count + 1);
      queueRef.current = queueRef.current
        .then(() => sync(target))
        .finally(() => setPending((count) => count - 1));
    },
    [sync],
  );
  enqueueRef.current = enqueue;

  // Applies a new state locally, records the previous one for undo, and queues
  // the write.
  const apply = useCallback(
    (previous: RoundWithActions, next: RoundWithActions) => {
      setState((current) => ({ round: next, past: [...current.past, previous], future: [] }));
      enqueue(next);
    },
    [enqueue],
  );

  // The round row does not exist until it is started. Creating it is the only
  // write that can't be optimistic, since everything else needs its id.
  //
  // `startedAt` is a parameter rather than always `now` because the round can
  // be started retroactively: you got up at 7:00 and only reached for the
  // phone at 7:20.
  const ensureRound = useCallback(
    async (startedAt: Temporal.Instant = nowInstant()): Promise<RoundWithActions | null> => {
      if (state.round) return state.round;
      if (!routineId || !date) return null;

      try {
        const created = await apiClient.post<RoundWithActions>("/rounds", {
          routineId,
          date,
          startedAt: serializeInstant(startedAt),
          endedAt: null,
          comments: "",
        });
        serverRef.current = created;
        setState({ round: created, past: [], future: [] });
        onCreated?.(created.id);
        return created;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo crear el Round.");
        return null;
      }
    },
    [state.round, routineId, date, onCreated],
  );

  // ---- operations --------------------------------------------------------

  // One tap of "Terminar acción". A planned action already recorded is
  // corrected in place rather than duplicated — that is how the user amends a
  // mistake, by re-selecting a step and finishing it again.
  const finishAction = useCallback(
    async (input: { plannedActionId: string | null; name: string; endedAt: Temporal.Instant }) => {
      const current = await ensureRound();
      // A closed round records nothing: reopen it first. The page doesn't offer
      // the button, but undo/redo can land here.
      if (!current || current.endedAt !== null) return;

      const endedAt = serializeInstant(input.endedAt);
      const existing =
        input.plannedActionId === null
          ? undefined
          : current.actions.find((action) => action.plannedActionId === input.plannedActionId);

      const actions = existing
        ? current.actions.map((action) =>
            action.id === existing.id ? { ...action, endedAt, name: input.name } : action,
          )
        : [
            ...current.actions,
            {
              id: crypto.randomUUID(),
              roundId: current.id,
              plannedActionId: input.plannedActionId,
              name: input.name,
              endedAt,
              comments: "",
              createdAt: endedAt,
            } satisfies PerformedAction,
          ];

      apply(current, { ...current, actions });
    },
    [ensureRound, apply],
  );

  const updateAction = useCallback(
    (actionId: string, patch: Partial<Pick<PerformedAction, "endedAt" | "name" | "comments">>) => {
      const round = state.round;
      if (!round) return;
      apply(round, {
        ...round,
        actions: round.actions.map((action) =>
          action.id === actionId ? { ...action, ...patch } : action,
        ),
      });
    },
    [state.round, apply],
  );

  const removeAction = useCallback(
    (actionId: string) => {
      const round = state.round;
      if (!round) return;
      apply(round, {
        ...round,
        actions: round.actions.filter((action) => action.id !== actionId),
      });
    },
    [state.round, apply],
  );

  const clearActions = useCallback(() => {
    const round = state.round;
    if (!round) return;
    apply(round, { ...round, actions: [] });
  }, [state.round, apply]);

  const setComments = useCallback(
    (comments: string) => {
      const round = state.round;
      if (!round) return;
      apply(round, { ...round, comments });
    },
    [state.round, apply],
  );

  const setStartedAt = useCallback(
    (startedAt: Temporal.Instant) => {
      const round = state.round;
      if (!round) return;
      apply(round, { ...round, startedAt: serializeInstant(startedAt) });
    },
    [state.round, apply],
  );

  // Closing and reopening are ordinary edits, so they undo like everything
  // else: "Atrás" after an accidental "Terminar Round" puts it back in play.
  const finishRound = useCallback(
    (endedAt: Temporal.Instant) => {
      const round = state.round;
      if (!round) return;
      apply(round, { ...round, endedAt: serializeInstant(endedAt) });
    },
    [state.round, apply],
  );

  const reopenRound = useCallback(() => {
    const round = state.round;
    if (!round) return;
    apply(round, { ...round, endedAt: null });
  }, [state.round, apply]);

  // ---- undo / redo -------------------------------------------------------
  //
  // Restoring a snapshot goes through the same reconcile() as any other edit,
  // so undo needs no inverse operations of its own.

  const undo = useCallback(() => {
    const previous = state.past[state.past.length - 1];
    if (!previous || !state.round) return;
    setState({
      round: previous,
      past: state.past.slice(0, -1),
      future: [state.round, ...state.future],
    });
    enqueue(previous);
  }, [state, enqueue]);

  const redo = useCallback(() => {
    const [next, ...rest] = state.future;
    if (!next || !state.round) return;
    setState({ round: next, past: [...state.past, state.round], future: rest });
    enqueue(next);
  }, [state, enqueue]);

  return {
    round: state.round,
    loading,
    saving: pending > 0,
    start: ensureRound,
    finishAction,
    updateAction,
    removeAction,
    clearActions,
    setComments,
    setStartedAt,
    finishRound,
    reopenRound,
    undo,
    redo,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
  };
}

// Turns "the round should look like this" into the row writes that get it
// there, then reads the round back so the client and the server agree.
async function reconcile(
  base: RoundWithActions | null,
  target: RoundWithActions,
): Promise<RoundWithActions> {
  const baseActions = new Map((base?.actions ?? []).map((action) => [action.id, action]));

  for (const action of baseActions.values()) {
    if (!target.actions.some((candidate) => candidate.id === action.id)) {
      await apiClient.delete(`/performed-actions/${action.id}`);
    }
  }

  for (const action of target.actions) {
    const existing = baseActions.get(action.id);
    if (!existing) {
      await apiClient.post("/performed-actions", {
        id: action.id,
        roundId: target.id,
        plannedActionId: action.plannedActionId,
        name: action.name,
        endedAt: action.endedAt,
        comments: action.comments,
      });
      continue;
    }
    if (
      existing.endedAt !== action.endedAt ||
      existing.name !== action.name ||
      existing.comments !== action.comments
    ) {
      await apiClient.patch(`/performed-actions/${action.id}`, {
        endedAt: action.endedAt,
        name: action.name,
        comments: action.comments,
      });
    }
  }

  if (
    base?.comments !== target.comments ||
    base?.startedAt !== target.startedAt ||
    base?.endedAt !== target.endedAt
  ) {
    await apiClient.patch(`/rounds/${target.id}`, {
      comments: target.comments,
      startedAt: target.startedAt,
      endedAt: target.endedAt,
    });
  }

  return apiClient.get<RoundWithActions>(`/rounds/${target.id}`);
}
