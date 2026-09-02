import type { RoutineWithPlans } from "@shared/types";
import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";

// Routines are small (a handful of rows with their whole tree) and change
// rarely, so every page just refetches the list it needs rather than sharing a
// cache.
export function useRoutines() {
  const [routines, setRoutines] = useState<RoutineWithPlans[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setError(null);
    try {
      setRoutines(await apiClient.get<RoutineWithPlans[]>("/routines"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar las rutinas.");
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { routines, error, loading: routines === null && error === null, refetch };
}

export function useRoutine(id: string | undefined) {
  const [routine, setRoutine] = useState<RoutineWithPlans | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(id));

  useEffect(() => {
    if (!id) {
      setRoutine(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiClient
      .get<RoutineWithPlans>(`/routines/${id}`)
      .then((data) => {
        if (!cancelled) setRoutine(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Error al cargar la rutina.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return { routine, error, loading };
}
