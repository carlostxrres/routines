// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildRoutine } from "@/lib/__fixtures__/routines";
import { Temporal } from "@/lib/temporal";

// A render test rather than a unit test: it is the only thing that exercises
// the real component tree — providers, router, base-ui components and the
// recording flow — end to end without a database.

const session = { user: { id: "user-1", email: "carlos@example.com" }, access_token: "token" };

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session } })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signOut: vi.fn(),
    },
  },
}));

const get = vi.fn();
const post = vi.fn();
const patch = vi.fn();
const remove = vi.fn();

vi.mock("@/lib/api-client", () => ({
  apiClient: {
    get: (path: string) => get(path),
    post: (path: string, body: unknown) => post(path, body),
    patch: (path: string, body: unknown) => patch(path, body),
    delete: (path: string) => remove(path),
  },
}));

const today = Temporal.Now.plainDateISO("Europe/Madrid").toString();

const routine = buildRoutine({
  plans: [{ id: "plan-1", startTime: "07:00:00", periodStart: today, periodEnd: null }],
});

const settings = {
  id: "default",
  timeZone: "Europe/Madrid",
  weekStartDay: 1,
  chartHue: 30,
  updatedAt: `${today}T00:00:00.000Z`,
};

function route(path: string) {
  window.history.pushState({}, "", path);
}

// Vitest is not running with `globals`, so testing-library's automatic
// cleanup never registers itself.
afterEach(cleanup);

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  patch.mockReset();
  remove.mockReset();

  get.mockImplementation(defaultGet);
});

function defaultGet(path: string) {
  if (path.startsWith("/settings")) return Promise.resolve(settings);
  // The real API returns one object for /routines/<id> and a list for /routines.
  if (path.startsWith("/routines/")) return Promise.resolve(structuredClone(routine));
  if (path.startsWith("/routines")) return Promise.resolve([structuredClone(routine)]);
  if (path.startsWith("/rounds")) return Promise.resolve([]);
  return Promise.reject(new Error(`Unmocked GET ${path}`));
}

async function renderApp(path: string) {
  route(path);
  const { default: App } = await import("@/App");
  return render(<App />);
}

// A round row as the API returns it, with whatever actions the test needs.
function buildRound(overrides: Record<string, unknown> = {}) {
  return {
    id: "round-1",
    routineId: routine.id,
    date: today,
    startedAt: `${today}T05:00:00.000Z`,
    endedAt: null,
    comments: "",
    createdAt: `${today}T05:00:00.000Z`,
    updatedAt: `${today}T05:00:00.000Z`,
    actions: [],
    ...overrides,
  };
}

describe("the recording page", () => {
  it("starts the round explicitly, then records the first action with one tap", async () => {
    await renderApp("/rounds/new");

    // The routine covering today is selected without the user choosing it, and
    // "Acción actual" is already the plan's first step.
    expect(await screen.findByDisplayValue("Levantarse")).toBeDefined();

    const created = buildRound();
    post.mockResolvedValueOnce(created);
    post.mockResolvedValue({});
    get.mockImplementation((path: string) =>
      path.startsWith("/rounds/round-1") ? Promise.resolve(created) : defaultGet(path),
    );

    // "Empezar" is its own tap: it creates the row and stamps startedAt, so
    // the first action has a stretch to be measured over instead of ending in
    // the same instant it began.
    fireEvent.click(screen.getByRole("button", { name: "Empezar ahora" }));

    await waitFor(() => {
      expect(post).toHaveBeenCalledWith("/rounds", expect.objectContaining({ date: today }));
    });
    expect(post).not.toHaveBeenCalledWith("/performed-actions", expect.anything());

    // Only now does the big button become the one you tap all the way down.
    fireEvent.click(await screen.findByRole("button", { name: "Terminar acción" }));

    await waitFor(() => {
      expect(post).toHaveBeenCalledWith(
        "/performed-actions",
        expect.objectContaining({
          roundId: "round-1",
          name: "Levantarse",
          plannedActionId: routine.plannedActions[0].id,
        }),
      );
    });
  });

  it("shows the current action's stopwatch stopped until the round exists", async () => {
    await renderApp("/rounds/new");
    await screen.findByDisplayValue("Levantarse");

    // No round row yet, so there is no instant to count from — but the plan
    // already knows how long "Levantarse" should take and what follows it.
    expect(screen.getByText("--:--")).toBeDefined();
    expect(screen.getByText("de 05:00")).toBeDefined();
    expect(screen.getByText("Siguiente: Ducha")).toBeDefined();
  });

  it("offers to close the round once the plan has been recorded to the end", async () => {
    // Every planned action already recorded: there is nothing left to tap, and
    // this is exactly where the button used to grey out with no explanation.
    const endedAt = `${today}T06:30:00.000Z`;
    const last = routine.plannedActions.length - 1;
    const actions = routine.plannedActions.map((action, index) => ({
      id: `performed-${index}`,
      roundId: "round-1",
      plannedActionId: action.id,
      name: action.name,
      // The last step is the one the round really ended on.
      endedAt:
        index === last ? endedAt : `${today}T05:${String(index + 5).padStart(2, "0")}:00.000Z`,
      comments: "",
      createdAt: `${today}T05:00:00.000Z`,
    }));
    const closed = buildRound({ actions });

    get.mockImplementation((path: string) =>
      path.startsWith("/rounds/round-1")
        ? Promise.resolve(closed)
        : path.startsWith("/rounds")
          ? Promise.resolve([closed])
          : defaultGet(path),
    );
    patch.mockResolvedValue({});

    await renderApp("/rounds/round-1");

    fireEvent.click(await screen.findByRole("button", { name: "Terminar el Round" }));

    // The round ended when the last step was marked, not when the button was
    // eventually pressed.
    await waitFor(() => {
      expect(patch).toHaveBeenCalledWith(
        "/rounds/round-1",
        expect.objectContaining({ endedAt: Temporal.Instant.from(endedAt).toString() }),
      );
    });
  });

  it("freezes a closed round instead of counting the hours since it ended", async () => {
    const closed = buildRound({ endedAt: `${today}T05:40:00.000Z` });
    get.mockImplementation((path: string) =>
      path.startsWith("/rounds/round-1")
        ? Promise.resolve(closed)
        : path.startsWith("/rounds")
          ? Promise.resolve([closed])
          : defaultGet(path),
    );

    await renderApp("/rounds/round-1");

    // The closing card replaces the recording controls entirely.
    expect(await screen.findByText("Round terminado")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Terminar acción" })).toBeNull();
    expect(screen.getByRole("button", { name: "Reabrir" })).toBeDefined();
  });

  it("invites a sign-in instead of redirecting when there is no session", async () => {
    const { supabase } = await import("@/lib/supabase");
    vi.mocked(supabase.auth.getSession).mockResolvedValueOnce({ data: { session: null } } as never);

    await renderApp("/rounds/new");

    expect(await screen.findByText("Inicia sesión")).toBeDefined();
  });
});

describe("pages that need a session", () => {
  // None of these redirect: a link shared with someone else has to land on the
  // page it names, not on a login form.
  it.each(["/rounds/new", "/routines/new", "/routines/routine-1", "/settings"])(
    "%s prompts to sign in in place",
    async (path) => {
      const { supabase } = await import("@/lib/supabase");
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
      } as never);

      await renderApp(path);

      expect(await screen.findByText("Inicia sesión")).toBeDefined();
      expect(window.location.pathname).toBe(path);

      vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session } } as never);
    },
  );
});

describe("the app shell", () => {
  it("renders the routines list", async () => {
    await renderApp("/routines");
    expect(await screen.findByText("Mañanas")).toBeDefined();
  });

  it("renders the four navigation tabs on every page", async () => {
    await renderApp("/views");
    const nav = await screen.findByRole("navigation", { name: "Secciones" });
    expect([...nav.querySelectorAll("a")].map((link) => link.textContent)).toEqual([
      "Inicio",
      "Registrar",
      "Rutinas",
      "Ajustes",
    ]);
  });
});
