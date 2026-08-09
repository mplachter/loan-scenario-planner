import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ManageTab } from "@/components/tabs/ManageTab";
import { closedInputs, TODAY } from "@/test/servicingFixtures";
import { dateToMonthISO } from "@/lib/dates";
import { DEFAULT_INPUTS, type LoanInputs } from "@/lib/defaults";
import { servicingContextFromInputs, simulateServicing } from "@/lib/servicing";

const CURRENT_MONTH = dateToMonthISO(closedInputs().firstPaymentDate, TODAY);

function renderManageTab(overrides: Partial<LoanInputs> = {}) {
  const inputs = closedInputs(overrides);
  const ctx = servicingContextFromInputs(inputs, TODAY);
  const result = simulateServicing(ctx, inputs.events);
  const onChange = vi.fn();
  render(
    <ManageTab
      inputs={inputs}
      onChange={onChange}
      ctx={ctx}
      result={result}
      currentMonth={CURRENT_MONTH}
    />,
  );
  return { inputs, ctx, result, onChange };
}

function fieldInput(labelText: string) {
  return within(screen.getByText(labelText).parentElement!).getByRole(
    "spinbutton",
  );
}

describe("ManageTab", () => {
  it("renders the PMI card when downPct is below 20", () => {
    renderManageTab({ downPct: 10 });

    expect(screen.getByText("PMI removal")).toBeInTheDocument();
  });

  it("does not render the PMI card when downPct is 20 or more", () => {
    renderManageTab({ downPct: 20 });

    expect(screen.queryByText("PMI removal")).not.toBeInTheDocument();
  });

  it("shows the appraisal-earlier callout when the appraisal path beats the standard request path", () => {
    renderManageTab({
      downPct: 10,
      servicedLoanAmount: DEFAULT_INPUTS.purchasePrice * 0.9,
    });

    expect(screen.getByText(/you may qualify as early as/)).toBeInTheDocument();
  });

  it("always renders the payment-creep, windfall, and prepay-vs-invest cards regardless of down payment", () => {
    renderManageTab({ downPct: 20 });

    expect(screen.getByText("Payment creep")).toBeInTheDocument();
    expect(
      screen.getByText("Windfall: lump sum, recast, or refinance?"),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Prepay vs. invest").length).toBeGreaterThan(0);
  });

  it("does not call onChange while editing local windfall inputs, only calling it once 'Add to timeline' is clicked", async () => {
    const { onChange, inputs } = renderManageTab();
    const amountInput = fieldInput("Amount available");

    await userEvent.clear(amountInput);
    await userEvent.type(amountInput, "60000");
    expect(onChange).not.toHaveBeenCalled();

    await userEvent.click(
      screen.getAllByRole("button", { name: "Add to timeline" })[0]!,
    );

    expect(onChange).toHaveBeenCalledTimes(1);
    const patch = onChange.mock.calls[0]![0];
    expect(patch.events).toHaveLength(inputs.events.length + 1);
    const added = patch.events.at(-1);
    expect(added.kind).toBe("lump");
    expect(added.amount).toBe(60000);
  });

  it("adds a recast event when the 'Lump + recast' column's Add to timeline button is clicked", async () => {
    const { onChange, inputs } = renderManageTab();

    await userEvent.click(
      screen.getAllByRole("button", { name: "Add to timeline" })[1]!,
    );

    const patch = onChange.mock.calls[0]![0];
    expect(patch.events).toHaveLength(inputs.events.length + 1);
    expect(patch.events.at(-1).kind).toBe("recast");
  });

  it("patches taxInflationPct when the payment-creep field is edited", async () => {
    const { onChange } = renderManageTab();
    const input = fieldInput("Property tax inflation");

    await userEvent.clear(input);
    await userEvent.type(input, "4");

    expect(onChange).toHaveBeenLastCalledWith({ taxInflationPct: 4 });
  });

  it("patches investReturnPct when the prepay-vs-invest field is edited", async () => {
    const { onChange } = renderManageTab();
    const input = fieldInput("Expected investment return");

    await userEvent.clear(input);
    await userEvent.type(input, "8");

    expect(onChange).toHaveBeenLastCalledWith({ investReturnPct: 8 });
  });
});
