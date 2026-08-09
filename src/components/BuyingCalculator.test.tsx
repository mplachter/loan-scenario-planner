import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { BuyingCalculator } from "@/components/BuyingCalculator";
import { DEFAULT_INPUTS, type LoanInputs } from "@/lib/defaults";
import { DEFAULT_HOUSEHOLD, type Household } from "@/lib/household";
import { computeMortgagePlan } from "@/lib/plan";

function renderBuyingCalculator(
  overrides: Partial<LoanInputs> = {},
  householdOverrides: Partial<Household> = {},
) {
  const inputs: LoanInputs = { ...DEFAULT_INPUTS, ...overrides };
  const household: Household = { ...DEFAULT_HOUSEHOLD, ...householdOverrides };
  const onChange = vi.fn();
  const onHousingPaymentChange = vi.fn();
  const utils = render(
    <BuyingCalculator
      inputs={inputs}
      onChange={onChange}
      household={household}
      onHousingPaymentChange={onHousingPaymentChange}
    />,
  );
  return { inputs, onChange, household, onHousingPaymentChange, ...utils };
}

describe("BuyingCalculator", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders only the ownership form and skips the hero/tab shell when ownershipStatus is 'existing'", () => {
    renderBuyingCalculator({ ownershipStatus: "existing" });

    expect(screen.queryByText(/Your payment/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("tab", { name: "Strategy" }),
    ).not.toBeInTheDocument();
  });

  it("shows the amber read-only banner and marks the hero and each shopping tab's wrapper inert when mode is owning", async () => {
    const { container } = renderBuyingCalculator({ mode: "owning" });

    expect(screen.getByText(/You've closed on this loan/)).toBeInTheDocument();
    // hero/stat wrapper + the active (setup) tab's wrapper
    expect(container.querySelectorAll("[inert]")).toHaveLength(2);

    for (const tabName of ["Strategy", "Compare terms", "Closing"]) {
      await userEvent.click(screen.getByRole("tab", { name: tabName }));
      expect(container.querySelectorAll("[inert]")).toHaveLength(2);
    }
  });

  it("hides the banner and marks nothing inert when mode is buying", async () => {
    const { container } = renderBuyingCalculator({ mode: "buying" });

    expect(
      screen.queryByText(/You've closed on this loan/),
    ).not.toBeInTheDocument();
    expect(container.querySelectorAll("[inert]")).toHaveLength(0);

    for (const tabName of ["Strategy", "Compare terms", "Closing"]) {
      await userEvent.click(screen.getByRole("tab", { name: tabName }));
      expect(container.querySelectorAll("[inert]")).toHaveLength(0);
    }
  });

  it("reports the steady-state payment via onHousingPaymentChange", () => {
    const { onHousingPaymentChange, inputs } = renderBuyingCalculator();
    const expected = computeMortgagePlan(inputs).totalMonthlySteadyState;
    expect(onHousingPaymentChange).toHaveBeenCalledWith(expected);
  });

  it("hides the refi payment stat card when no refi is modeled", () => {
    renderBuyingCalculator({ refiEnabled: false });

    expect(screen.queryByText(/Refi payment/)).not.toBeInTheDocument();
  });

  it("shows the refi payment stat card when a refi is modeled", () => {
    renderBuyingCalculator({
      refiEnabled: true,
      refiYear: 3,
      refiRate: 5.0,
      refiTerm: 30,
      refiClosingCostPct: 2,
    });

    expect(screen.getByText("Refi payment (yr 3+)")).toBeInTheDocument();
  });
});
