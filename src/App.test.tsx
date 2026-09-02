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

  get.mockImplementation((path: string) => {
    if (path.startsWith("/settings")) return Promise.resolve(settings);
    if (path.startsWith("/routines")) return Promise.resolve([structuredClone(routine)]);
    if (path.startsWith("/rounds")) return Promise.resolve([]);
    return Promise.reject(new Error(`Unmocked GET ${path}`));
  });
});

async function renderApp(path: string) {
  route(path);
  const { default: App } = await import("@/App");
  return render(<App />);
}

describe("the recording page", () => {
  it("proposes the first action of the plan and records it with one tap", async () => {
    await renderApp("/rounds/new");

    // The routine covering today is selected without the user choosing it, and
    // "Acción actual" is already the plan's first step.
    expect(await screen.findByDisplayValue("Levantarse")).toBeDefined();

    const created = {
      id: "round-1",
      routineId: routine.id,
      date: today,
      startedAt: `${today}T05:00:00.000Z`,
      comments: "",
      createdAt: `${today}T05:00:00.000Z`,
      updatedAt: `${today}T05:00:00.000Z`,
      actions: [],
    };
    post.mockResolvedValueOnce(created);
    post.mockResolvedValue({});
    get.mockImplementation((path: string) => {
      if (path.startsWith("/settings")) return Promise.resolve(settings);
      if (path.startsWith("/routines")) return Promise.resolve([structuredClone(routine)]);
      if (path.startsWith("/rounds/round-1")) return Promise.resolve(created);
      if (path.startsWith("/rounds")) return Promise.resolve([]);
      return Promise.reject(new Error(`Unmocked GET ${path}`));
    });

    fireEvent.click(screen.getByRole("button", { name: "Terminar acción" }));

    // The round row is created by the first edit...
    await waitFor(() => {
      expect(post).toHaveBeenCalledWith("/rounds", expect.objectContaining({ date: today }));
    });
    // ...and the tap itself is one small write.
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

  it("invites a sign-in instead of redirecting when there is no session", async () => {
    const { supabase } = await import("@/lib/supabase");
    vi.mocked(supabase.auth.getSession).mockResolvedValueOnce({ data: { session: null } } as never);

    await renderApp("/rounds/new");

    expect(await screen.findByText("Inicia sesión")).toBeDefined();
  });
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
