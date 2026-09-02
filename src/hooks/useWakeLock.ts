import { useCallback, useEffect, useRef, useState } from "react";

// Keeps the phone's screen on while a round is being recorded — the whole
// point is not having to unlock the phone between actions.
//
// Two things the API makes the caller handle: the browser silently releases
// the lock whenever the page is hidden (so it has to be re-requested on
// visibilitychange), and it can reject outright (unsupported, or the battery
// saver is on), which is reported back so the UI can turn the toggle off.
export function useWakeLock() {
  const [enabled, setEnabled] = useState(false);
  const [supported] = useState(() => typeof navigator !== "undefined" && "wakeLock" in navigator);
  const sentinelRef = useRef<WakeLockSentinel | null>(null);

  const release = useCallback(async () => {
    const sentinel = sentinelRef.current;
    sentinelRef.current = null;
    await sentinel?.release().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!enabled || !supported) {
      release();
      return;
    }

    let cancelled = false;

    async function acquire() {
      if (document.visibilityState !== "visible" || sentinelRef.current) return;
      try {
        const sentinel = await navigator.wakeLock.request("screen");
        if (cancelled) {
          await sentinel.release().catch(() => undefined);
          return;
        }
        sentinelRef.current = sentinel;
        sentinel.addEventListener("release", () => {
          sentinelRef.current = null;
        });
      } catch {
        if (!cancelled) setEnabled(false);
      }
    }

    acquire();
    document.addEventListener("visibilitychange", acquire);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", acquire);
      release();
    };
  }, [enabled, supported, release]);

  return { enabled, setEnabled, supported };
}
