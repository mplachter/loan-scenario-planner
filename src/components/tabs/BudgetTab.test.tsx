import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { BudgetTab } from "@/components/tabs/BudgetTab";
import {
  DEFAULT_HOUSEHOLD,
  type BudgetItem,
  type Household,
} from "@/lib/household";

function renderBudgetTab(
  overrides: Partial<Household> = {},
  housingPayment = 2000,
) {
  const household = { ...DEFAULT_HOUSEHOLD, ...overrides };
  const onHouseholdChange = vi.fn();
  render(
    <BudgetTab
      household={household}
      onHouseholdChange={onHouseholdChange}
      housingPayment={housingPayment}
    />,
  );
  return { household, onHouseholdChange };
}

function fieldInput(labelText: string) {
  return within(screen.getByText(labelText).parentElement!).getByRole(
    "spinbutton",
  );
}

describe("BudgetTab", () => {
  it("patches netPayPerPaycheck when the take-home-pay field is edited", async () => {
    const { onHouseholdChange } = renderBudgetTab();
    const input = fieldInput("Take-home pay per paycheck");

    await userEvent.clear(input);
    await userEvent.type(input, "2500");

    expect(onHouseholdChange).toHaveBeenLastCalledWith({
      netPayPerPaycheck: 2500,
    });
  });

  it("patches payFrequency when a pay-frequency toggle item is clicked", async () => {
    const { onHouseholdChange } = renderBudgetTab({ payFrequency: "biweekly" });

    await userEvent.click(screen.getByRole("button", { name: "Weekly" }));

    expect(onHouseholdChange).toHaveBeenCalledWith({ payFrequency: "weekly" });
  });

  it("patches bonusMonth when the bonus-month select is changed", async () => {
    const { onHouseholdChange } = renderBudgetTab({ bonusMonth: 3 });

    await userEvent.selectOptions(screen.getByRole("combobox"), "6");

    expect(onHouseholdChange).toHaveBeenLastCalledWith({ bonusMonth: 6 });
  });

  it("cycles a budget item's category through the badge button, replacing the whole budgetItems array", async () => {
    const item: BudgetItem = {
      id: "item-1",
      label: "Rent",
      amount: 0,
      category: "needs",
      isCustom: false,
    };
    const { onHouseholdChange } = renderBudgetTab({ budgetItems: [item] });

    await userEvent.click(screen.getByRole("button", { name: "needs" }));

    expect(onHouseholdChange).toHaveBeenCalledWith({
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
    const { onHouseholdChange } = renderBudgetTab({ budgetItems: [item] });

    const row = screen.getByDisplayValue("Gym").closest("div")!;
    await userEvent.click(within(row).getByRole("button", { name: "" }));

    expect(onHouseholdChange).toHaveBeenCalledWith({ budgetItems: [] });
  });

  it("adds a new blank custom row when 'Add custom row' is clicked", async () => {
    const { onHouseholdChange, household } = renderBudgetTab({
      budgetItems: [],
    });

    await userEvent.click(
      screen.getByRole("button", { name: /Add custom row/ }),
    );

    expect(onHouseholdChange).toHaveBeenCalledTimes(1);
    const patch = onHouseholdChange.mock.calls[0]![0];
    expect(patch.budgetItems).toHaveLength(household.budgetItems.length + 1);
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

  it("patches bonusUse when a bonus-use toggle item is clicked", async () => {
    const { onHouseholdChange } = renderBudgetTab({ bonusUse: "mortgage" });

    await userEvent.click(
      screen.getByRole("button", { name: "Spread across the year" }),
    );

    expect(onHouseholdChange).toHaveBeenCalledWith({ bonusUse: "spread" });
  });

  it("keeps a bonus out of the leftover line and shows it as a separate spread row", () => {
    renderBudgetTab(
      {
        budgetItems: [],
        payFrequency: "monthly",
        netPayPerPaycheck: 5000,
        annualBonusNet: 12000,
        bonusUse: "spread",
      },
      2000,
    );

    // Leftover is still paycheck-only ($5,000 - $2,000); the bonus shows up
    // as its own +$1,000/mo row, not folded into income.
    expect(screen.getByText("$3,000")).toBeInTheDocument();
    expect(screen.getByText("Bonus spread monthly")).toBeInTheDocument();
    expect(screen.getByText("+$1,000")).toBeInTheDocument();
    expect(screen.getByText("$4,000")).toBeInTheDocument();
  });

  it("omits the spread row entirely when the bonus is earmarked for the loan", () => {
    renderBudgetTab(
      {
        budgetItems: [],
        payFrequency: "monthly",
        netPayPerPaycheck: 5000,
        annualBonusNet: 12000,
        bonusUse: "mortgage",
      },
      2000,
    );

    expect(screen.getByText("$3,000")).toBeInTheDocument();
    expect(screen.queryByText("Bonus spread monthly")).not.toBeInTheDocument();
  });
});
