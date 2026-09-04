// @vitest-environment jsdom
import type { RoundWithActions } from "@shared/types";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { buildRoutine } from "@/lib/__fixtures__/routines";
import { DriftsView } from "@/views/drifts/DriftsView";

// The feed's own logic is the cursor pagination: /rounds has no offset, so
// each page is fetched with `to=` the day before the oldest one already shown.
// Getting that wrong repeats a day forever, which is exactly what these check.

const get = vi.fn();

vi.mock("@/lib/api-client", () => ({
  apiClient: { get: (path: string) => get(path) },
}));

vi.mock("@/hooks/useSettings", () => ({
  useSettings: () => ({ settings: { chartHue: 30, timeZone: "Europe/Madrid" } }),
}));

// jsdom has no IntersectionObserver; this one hands the callback back so the
// test can decide when the sentinel comes into view.
let reachBottom: (() => void) | null = null;

beforeEach(() => {
  get.mockReset();
  reachBottom = null;
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      // Not a parameter property: erasableSyntaxOnly bans those.
      callback: IntersectionObserverCallback;
      constructor(callback: IntersectionObserverCallback) {
        this.callback = callback;
      }
      observe() {
        reachBottom = () =>
          this.callback(
            [{ isIntersecting: true } as IntersectionObserverEntry],
            this as unknown as IntersectionObserver,
          );
      }
      disconnect() {
        reachBottom = null;
      }
      unobserve() {}
    },
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const routine = buildRoutine({
  plans: [{ id: "plan-1", startTime: "07:00:00", periodStart: "2026-01-01", periodEnd: null }],
});

// A round with one finished action, so the "Real" track has something to draw.
function round(date: string): RoundWithActions {
  return {
    id: `round-${date}`,
    routineId: routine.id,
    date,
    startedAt: `${date}T05:00:00.000Z`,
    endedAt: `${date}T05:12:00.000Z`,
    comments: "",
    createdAt: `${date}T05:00:00.000Z`,
    updatedAt: `${date}T05:12:00.000Z`,
    actions: [
      {
        id: `action-${date}`,
        roundId: `round-${date}`,
        plannedActionId: routine.plannedActions[0].id,
        name: routine.plannedActions[0].name,
        endedAt: `${date}T05:07:00.000Z`,
        comments: "",
        createdAt: `${date}T05:07:00.000Z`,
      },
    ],
  };
}

function days(from: number, count: number) {
  return Array.from({ length: count }, (_, index) =>
    round(`2026-09-${String(from - index).padStart(2, "0")}`),
  );
}

function view() {
  return render(
    <MemoryRouter>
      <DriftsView routine={routine} />
    </MemoryRouter>,
  );
}

it("lists a card per day, newest first, and links each to its Round", async () => {
  get.mockResolvedValueOnce(days(20, 3));
  view();

  const links = await screen.findAllByRole("link");
  expect(links.map((link) => link.getAttribute("href"))).toEqual([
    "/rounds/round-2026-09-20",
    "/rounds/round-2026-09-19",
    "/rounds/round-2026-09-18",
  ]);
  expect(get).toHaveBeenCalledTimes(1);
  expect(get.mock.calls[0][0]).not.toContain("&to=");
});

it("asks for the next page from the day before the oldest one shown", async () => {
  get.mockResolvedValueOnce(days(20, 10)).mockResolvedValueOnce(days(10, 2));
  view();

  await screen.findByRole("link", { name: /^11 de septiembre/ });
  reachBottom?.();

  await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
  // Oldest shown was the 11th, so the cursor is the 10th — inclusive `to`
  // would hand back the 11th again.
  expect(get.mock.calls[1][0]).toContain("to=2026-09-10");
  expect(await screen.findByRole("link", { name: /^9 de septiembre/ })).toBeDefined();
  expect(screen.getAllByRole("link")).toHaveLength(12);
});

it("stops once a short page comes back", async () => {
  get.mockResolvedValueOnce(days(20, 3));
  view();

  expect(await screen.findByText("No hay más Rounds.")).toBeDefined();
  reachBottom?.();
  await waitFor(() => expect(get).toHaveBeenCalledTimes(1));
});

it("offers to record one when the routine has no Rounds", async () => {
  get.mockResolvedValueOnce([]);
  view();

  expect(await screen.findByText("Todavía no hay Rounds")).toBeDefined();
  expect(screen.getByRole("link", { name: "Registrar un Round" }).getAttribute("href")).toBe(
    "/rounds/new",
  );
});
