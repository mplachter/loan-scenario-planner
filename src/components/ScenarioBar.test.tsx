import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ScenarioBar } from "@/components/ScenarioBar";
import { DEFAULT_INPUTS } from "@/lib/defaults";
import type { Scenario } from "@/lib/scenarios";

function scenario(overrides: Partial<Scenario> = {}): Scenario {
  return {
    id: "s1",
    name: "Scenario 1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    inputs: DEFAULT_INPUTS,
    ...overrides,
  };
}

function renderBar(
  scenarios: Scenario[],
  activeScenarioId: string,
  overrides: Partial<{
    onSelect: ReturnType<typeof vi.fn>;
    onCreate: ReturnType<typeof vi.fn>;
    onRename: ReturnType<typeof vi.fn>;
    onDelete: ReturnType<typeof vi.fn>;
    onDuplicate: ReturnType<typeof vi.fn>;
  }> = {},
) {
  const onSelect = overrides.onSelect ?? vi.fn();
  const onCreate = overrides.onCreate ?? vi.fn();
  const onRename = overrides.onRename ?? vi.fn();
  const onDelete = overrides.onDelete ?? vi.fn();
  const onDuplicate = overrides.onDuplicate ?? vi.fn();
  render(
    <ScenarioBar
      scenarios={scenarios}
      activeScenarioId={activeScenarioId}
      onSelect={onSelect}
      onCreate={onCreate}
      onRename={onRename}
      onDelete={onDelete}
      onDuplicate={onDuplicate}
    />,
  );
  return { onSelect, onCreate, onRename, onDelete, onDuplicate };
}

describe("ScenarioBar", () => {
  it("calls onSelect with the scenario id when its button is clicked", async () => {
    const scenarios = [scenario({ id: "s1", name: "Scenario 1" })];
    const { onSelect } = renderBar(scenarios, "s1");

    await userEvent.click(screen.getByRole("button", { name: "Scenario 1" }));

    expect(onSelect).toHaveBeenCalledWith("s1");
  });

  it("only shows the rename pencil for the active scenario", () => {
    const scenarios = [
      scenario({ id: "s1", name: "Scenario 1" }),
      scenario({ id: "s2", name: "Scenario 2" }),
    ];
    renderBar(scenarios, "s1");

    expect(
      screen.getByRole("button", { name: "Rename Scenario 1" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Rename Scenario 2" }),
    ).not.toBeInTheDocument();
  });

  it("commits a rename on blur after editing via the pencil button", async () => {
    const scenarios = [scenario({ id: "s1", name: "Scenario 1" })];
    const { onRename } = renderBar(scenarios, "s1");

    await userEvent.click(
      screen.getByRole("button", { name: "Rename Scenario 1" }),
    );
    const input = screen.getByDisplayValue("Scenario 1");
    await userEvent.clear(input);
    await userEvent.type(input, "Refi plan");
    await userEvent.tab();

    expect(onRename).toHaveBeenCalledWith("s1", "Refi plan");
  });

  it("cancels the rename on Escape without calling onRename", async () => {
    const scenarios = [scenario({ id: "s1", name: "Scenario 1" })];
    const { onRename } = renderBar(scenarios, "s1");

    await userEvent.dblClick(
      screen.getByRole("button", { name: "Scenario 1" }),
    );
    const input = screen.getByDisplayValue("Scenario 1");
    await userEvent.type(input, " extra{Escape}");

    expect(onRename).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Scenario 1" }),
    ).toBeInTheDocument();
  });

  it("calls onDuplicate with the scenario id when the duplicate button is clicked", async () => {
    const scenarios = [scenario({ id: "s1", name: "Scenario 1" })];
    const { onDuplicate } = renderBar(scenarios, "s1");

    await userEvent.click(
      screen.getByRole("button", { name: "Duplicate Scenario 1" }),
    );

    expect(onDuplicate).toHaveBeenCalledWith("s1");
  });

  it("calls onDelete only after confirming in the portaled AlertDialog", async () => {
    const scenarios = [scenario({ id: "s1", name: "Scenario 1" })];
    const { onDelete } = renderBar(scenarios, "s1");

    await userEvent.click(
      screen.getByRole("button", { name: "Delete Scenario 1" }),
    );
    expect(screen.getByText('Delete "Scenario 1"?')).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(onDelete).toHaveBeenCalledWith("s1");
  });

  it("does not call onDelete when the AlertDialog is cancelled", async () => {
    const scenarios = [scenario({ id: "s1", name: "Scenario 1" })];
    const { onDelete } = renderBar(scenarios, "s1");

    await userEvent.click(
      screen.getByRole("button", { name: "Delete Scenario 1" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.queryByText('Delete "Scenario 1"?')).not.toBeInTheDocument();
  });

  it("calls onCreate when 'New scenario' is clicked", async () => {
    const scenarios = [scenario({ id: "s1", name: "Scenario 1" })];
    const { onCreate } = renderBar(scenarios, "s1");

    await userEvent.click(
      screen.getByRole("button", { name: /New scenario/i }),
    );

    expect(onCreate).toHaveBeenCalledTimes(1);
  });
});
