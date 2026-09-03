// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, it } from "vitest";
import { type ActionChoice, CurrentActionCombobox } from "@/components/round/CurrentActionCombobox";
import { MORNING_ROUTINE } from "@/lib/__fixtures__/routines";
import { plannedSchedule } from "@/lib/schedule";

// The combobox is controlled by RoundPage, so the bugs it had only show up when
// what it reports is fed straight back to it — which is what this harness does.

afterEach(cleanup);

const schedule = plannedSchedule(MORNING_ROUTINE.plans[0], MORNING_ROUTINE.plannedActions);

function Harness({ onChoice }: { onChoice?: (choice: ActionChoice) => void } = {}) {
  const [choice, setChoice] = useState<ActionChoice | null>(null);
  return (
    <CurrentActionCombobox
      schedule={schedule}
      doneIds={new Set()}
      value={choice}
      onChange={(next) => {
        setChoice(next);
        onChoice?.(next);
      }}
    />
  );
}

function input() {
  return screen.getByRole("combobox", { name: "Acción actual" });
}

// The popup opens from the trigger; jsdom never delivers the real input events
// base-ui opens on, so open it explicitly and then type into the field.
function type(text: string) {
  fireEvent.click(screen.getByRole("button"));
  const field = input();
  fireEvent.focus(field);
  fireEvent.change(field, { target: { value: text } });
}

it("filters the plan's actions by name, not by id", async () => {
  render(<Harness />);
  type("duc");

  // Regression: the items used to be the raw plannedActionIds, so "duc" was
  // matched against a uuid and the list came back empty.
  expect(await screen.findByRole("option", { name: /Ducha/ })).toBeDefined();
  expect(screen.queryByRole("option", { name: /Desayuno/ })).toBeNull();
});

it("selects an existing action and keeps its id", async () => {
  const seen: ActionChoice[] = [];
  render(<Harness onChoice={(choice) => seen.push(choice)} />);
  type("duc");

  fireEvent.click(await screen.findByRole("option", { name: /Ducha/ }));

  const ducha = schedule.find((action) => action.name === "Ducha");
  await waitFor(() => {
    expect((input() as HTMLInputElement).value).toBe("Ducha");
  });
  expect(seen.at(-1)).toEqual({ plannedActionId: ducha?.plannedActionId, name: "Ducha" });
});

it("keeps free text after the popup closes", async () => {
  render(<Harness />);
  type("Regar las plantas");

  await waitFor(() => {
    expect(screen.getByText("Se registrará como acción libre.")).toBeDefined();
  });

  // Regression: closing used to restore the label of the selected value, and a
  // free action has none — so base-ui wrote "" back and the text vanished.
  fireEvent.keyDown(input(), { key: "Escape" });
  fireEvent.blur(input());

  await waitFor(() => {
    expect(screen.queryByRole("option", { name: /Ducha/ })).toBeNull();
  });
  expect((input() as HTMLInputElement).value).toBe("Regar las plantas");
});
