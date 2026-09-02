import { useEffect, useState } from "react";
import { nowInstant, type Temporal } from "@/lib/temporal";

// A clock that ticks while a round is open, so the live timeline and the
// elapsed counter keep moving without every consumer wiring its own interval.
export function useNow(intervalMs = 1000): Temporal.Instant {
  const [now, setNow] = useState(nowInstant);

  useEffect(() => {
    const id = setInterval(() => setNow(nowInstant()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
