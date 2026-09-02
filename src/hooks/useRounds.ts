import type { RoundWithActions } from "@shared/types";
import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import type { Temporal } from "@/lib/temporal";

// Rounds for one routine over a date range, for the views. Reads are public,
// so this works without a session — which is the whole point of sharing a link.
export function useRounds(
  routineId: string | null,
  from: Temporal.PlainDate,
  to: Temporal.PlainDate,
) {
  const [rounds, setRounds] = useState<RoundWithActions[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fromKey = from.toString();
  const toKey = to.toString();

  useEffect(() => {
    if (!routineId) {
      setRounds([]);
      return;
    }
    let cancelled = false;
    setRounds(null);
    setError(null);
    apiClient
      .get<RoundWithActions[]>(
        `/rounds?routineId=${routineId}&from=${fromKey}&to=${toKey}&limit=100`,
      )
      .then((rows) => {
        if (!cancelled) setRounds(rows);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Error al cargar.");
      });
    return () => {
      cancelled = true;
    };
  }, [routineId, fromKey, toKey]);

  return { rounds, error, loading: rounds === null && error === null };
}
