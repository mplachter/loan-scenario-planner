import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { BudgetTab } from "@/components/tabs/BudgetTab";
import {
  DEFAULT_INPUTS,
  type BudgetItem,
  type LoanInputs,
} from "@/lib/defaults";

function renderBudgetTab(
  overrides: Partial<LoanInputs> = {},
  housingPayment = 2000,
) {
  const inputs = { ...DEFAULT_INPUTS, ...overrides };
  const onChange = vi.fn();
  render(
    <BudgetTab
      inputs={inputs}
      onChange={onChange}
      housingPayment={housingPayment}
    />,
  );
  return { inputs, onChange };
}

function fieldInput(labelText: string) {
  return within(screen.getByText(labelText).parentElement!).getByRole(
    "spinbutton",
  );
}

describe("BudgetTab", () => {
  it("patches netPayPerPaycheck when the take-home-pay field is edited", async () => {
    const { onChange } = renderBudgetTab();
    const input = fieldInput("Take-home pay per paycheck");

    await userEvent.clear(input);
    await userEvent.type(input, "2500");

    expect(onChange).toHaveBeenLastCalledWith({ netPayPerPaycheck: 2500 });
  });

  it("patches payFrequency when a pay-frequency toggle item is clicked", async () => {
    const { onChange } = renderBudgetTab({ payFrequency: "biweekly" });

    await userEvent.click(screen.getByRole("button", { name: "Weekly" }));

    expect(onChange).toHaveBeenCalledWith({ payFrequency: "weekly" });
  });

  it("patches bonusMonth when the bonus-month select is changed", async () => {
    const { onChange } = renderBudgetTab({ bonusMonth: 3 });

    await userEvent.selectOptions(screen.getByRole("combobox"), "6");

    expect(onChange).toHaveBeenLastCalledWith({ bonusMonth: 6 });
  });

  it("cycles a budget item's category through the badge button, replacing the whole budgetItems array", async () => {
    const item: BudgetItem = {
      id: "item-1",
      label: "Rent",
      amount: 0,
      category: "needs",
      isCustom: false,
    };
    const { onChange } = renderBudgetTab({ budgetItems: [item] });

    await userEvent.click(screen.getByRole("button", { name: "needs" }));

    expect(onChange).toHaveBeenCalledWith({
      budgetItems: [{ ...item, category: "wants" }],
    });
  });

  it("deletes a custom row, replacing the whole budgetItems array", async () => {
    const item: BudgetItem = {
      id: "custom-1",
      label: "Gym",
      amount: 80,
      category: "wants",
      isCustom: true,
    };
    const { onChange } = renderBudgetTab({ budgetItems: [item] });

    const row = screen.getByDisplayValue("Gym").closest("div")!;
    await userEvent.click(within(row).getByRole("button", { name: "" }));

    expect(onChange).toHaveBeenCalledWith({ budgetItems: [] });
  });

  it("adds a new blank custom row when 'Add custom row' is clicked", async () => {
    const { onChange, inputs } = renderBudgetTab({ budgetItems: [] });

    await userEvent.click(
      screen.getByRole("button", { name: /Add custom row/ }),
    );

    expect(onChange).toHaveBeenCalledTimes(1);
    const patch = onChange.mock.calls[0]![0];
    expect(patch.budgetItems).toHaveLength(inputs.budgetItems.length + 1);
    expect(patch.budgetItems[0]).toMatchObject({
      label: "",
      amount: 0,
      category: "wants",
      isCustom: true,
    });
  });

  it("renders the leftover summary from income, budget total, and housing payment", () => {
    renderBudgetTab(
      {
        budgetItems: [],
        payFrequency: "monthly",
        netPayPerPaycheck: 5000,
        annualBonusNet: 0,
      },
      2000,
    );

    expect(screen.getAllByText("Leftover").length).toBeGreaterThan(0);
    expect(screen.getByText("$3,000")).toBeInTheDocument();
  });
});
