import type { RoundWithActions } from "@shared/types";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { parseDate, serializeDate } from "@/lib/temporal";

// Rounds of one routine, newest first, page by page — the /views/drifts feed.
//
// Unlike useRounds, which asks for a fixed window of dates, this walks
// backwards through the whole history. No new API is needed: /rounds already
// orders by date descending, and a routine has at most one Round per date, so
// the date of the last row on a page is a unique cursor for the next one.
const DEFAULT_PAGE_SIZE = 10;

export function useRoundsFeed(routineId: string | null, pageSize = DEFAULT_PAGE_SIZE) {
  const [rounds, setRounds] = useState<RoundWithActions[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  // The scroll sentinel can fire again before a page lands, and React state
  // won't have caught up yet — this is what stops the same page being asked
  // for twice.
  const loadingRef = useRef(false);
  // Bumped on every routine change, so a page still in flight for the previous
  // routine can't append itself to the new feed.
  const requestRef = useRef(0);

  const fetchPage = useCallback(
    async (before: string | null) => {
      if (!routineId || loadingRef.current) return;

      const request = requestRef.current;
      loadingRef.current = true;
      setLoading(true);
      setError(null);

      const query = before === null ? "" : `&to=${before}`;
      try {
        const rows = await apiClient.get<RoundWithActions[]>(
          `/rounds?routineId=${routineId}${query}&limit=${pageSize}`,
        );
        if (request !== requestRef.current) return;
        setRounds((current) => [...(current ?? []), ...rows]);
        // A short page means there is nothing older left to ask for.
        if (rows.length < pageSize) setDone(true);
      } catch (err) {
        if (request !== requestRef.current) return;
        setError(err instanceof Error ? err.message : "Error al cargar.");
      } finally {
        if (request === requestRef.current) {
          loadingRef.current = false;
          setLoading(false);
        }
      }
    },
    [routineId, pageSize],
  );

  // First page, and a full reset whenever the routine changes.
  useEffect(() => {
    requestRef.current += 1;
    loadingRef.current = false;
    setRounds(routineId ? null : []);
    setError(null);
    setLoading(false);
    setDone(!routineId);
    if (routineId) fetchPage(null);
  }, [routineId, fetchPage]);

  const loadMore = useCallback(() => {
    if (done || loadingRef.current || !rounds?.length) return;
    const oldest = rounds[rounds.length - 1];
    // Exclusive cursor: the day before the oldest one already shown.
    fetchPage(serializeDate(parseDate(oldest.date).subtract({ days: 1 })));
  }, [done, rounds, fetchPage]);

  return { rounds, error, loading, done, loadMore };
}
