import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { StrategyTab } from "@/components/tabs/StrategyTab";
import { DEFAULT_INPUTS, type LoanInputs, type LoanTerm } from "@/lib/defaults";
import { computeMortgagePlan } from "@/lib/plan";

function renderStrategyTab(overrides: Partial<LoanInputs> = {}) {
  const inputs = { ...DEFAULT_INPUTS, ...overrides };
  const plan = computeMortgagePlan(inputs);
  const onChange = vi.fn();
  render(<StrategyTab inputs={inputs} onChange={onChange} plan={plan} />);
  return { inputs, plan, onChange };
}

function switchNear(headingText: string) {
  const heading = screen.getByText(headingText);
  const container = heading.closest("div")!.parentElement!;
  return within(container).getByRole("switch");
}

// Refis in year 3 of a 10-year hold at a meaningfully lower rate, so it
// breaks even in 18 months — well inside the 84-month remaining hold.
const REFI_BREAKS_EVEN_BEFORE_SALE: Partial<LoanInputs> = {
  refiEnabled: true,
  refiYear: 3,
  refiRate: 5.0,
  refiTerm: 30 as LoanTerm,
  refiClosingCostPct: 2,
  holdYears: 10,
};

// Refis in year 3, but the hold ends at year 4 — breakeven (870mo) lands
// long after the 12-month remaining hold.
const REFI_BREAKS_EVEN_AFTER_SALE: Partial<LoanInputs> = {
  refiEnabled: true,
  refiYear: 3,
  refiRate: 6.5,
  refiTerm: 30 as LoanTerm,
  refiClosingCostPct: 4,
  holdYears: 4,
};

// Refis into a much shorter term at a higher rate, so the new payment is
// actually higher — paymentDelta >= 0, breakevenMonths is null.
const REFI_NO_PAYMENT_DROP: Partial<LoanInputs> = {
  refiEnabled: true,
  refiYear: 3,
  refiRate: 7.5,
  refiTerm: 15 as LoanTerm,
  refiClosingCostPct: 2,
  holdYears: 10,
};

describe("StrategyTab", () => {
  it("always renders both dialog trigger buttons", () => {
    renderStrategyTab();

    expect(
      screen.getByRole("button", { name: "Maximize my equity" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Check a refi's breakeven" }),
    ).toBeInTheDocument();
  });

  it("shows the no-refinance-modeled copy when refiEnabled is false", () => {
    renderStrategyTab({ refiEnabled: false });

    expect(screen.getByText(/No refinance is modeled yet/)).toBeInTheDocument();
  });

  it("shows the teal breaks-even-before-sale copy when breakevenMonths is within the remaining hold", () => {
    renderStrategyTab(REFI_BREAKS_EVEN_BEFORE_SALE);

    expect(
      screen.getByText(/breaks even in 18 months — before you sell/),
    ).toBeInTheDocument();
  });

  it("shows the red breaks-even-after-sale copy when breakevenMonths exceeds the remaining hold", () => {
    renderStrategyTab(REFI_BREAKS_EVEN_AFTER_SALE);

    expect(
      screen.getByText(/breaks even in 870 months — after you sell/),
    ).toBeInTheDocument();
  });

  it("shows the no-breakeven copy when the refi doesn't lower the payment", () => {
    renderStrategyTab(REFI_NO_PAYMENT_DROP);

    expect(
      screen.getByText(/doesn't drop the payment, so there's no breakeven/),
    ).toBeInTheDocument();
  });

  it("hides the refi stat block when refiEnabled is false", () => {
    renderStrategyTab({ refiEnabled: false });
    expect(screen.queryByText("Balance at refi")).not.toBeInTheDocument();
  });

  it("shows the refi stat block once refiEnabled and refiPlan are both present", () => {
    renderStrategyTab(REFI_BREAKS_EVEN_BEFORE_SALE);
    expect(screen.getByText("Balance at refi")).toBeInTheDocument();
  });

  it("shows the matchCompare card only when extraMode is a matchN mode", () => {
    renderStrategyTab({ extraMode: "none" });
    expect(
      screen.queryByText(/vs\. an actual 15-yr loan/),
    ).not.toBeInTheDocument();
  });

  it("shows the matchCompare card comparing the strategy against a real term loan", () => {
    renderStrategyTab({ extraMode: "match15", term: 30 });

    expect(
      screen.getByText(/"Pay like a 15-yr" vs\. an actual 15-yr loan/),
    ).toBeInTheDocument();
  });

  it("shows buydown year-by-year stats only when buydown is enabled", () => {
    renderStrategyTab({ buydown: false });
    expect(
      screen.queryByText(/Subsidy account needed/),
    ).not.toBeInTheDocument();
  });

  it("shows the buydown subsidy details when buydown is enabled", () => {
    renderStrategyTab({ buydown: true });
    expect(screen.getByText(/Subsidy account needed/)).toBeInTheDocument();
  });

  it("gates the matchN toggle items on term exceeding that N", () => {
    renderStrategyTab({ term: 15 });

    expect(
      screen.queryByRole("button", { name: "Pay like a 15-yr" }),
    ).not.toBeInTheDocument();
  });

  it("shows all matchN toggle items when the term exceeds all of them", () => {
    renderStrategyTab({ term: 30 });

    expect(
      screen.getByRole("button", { name: "Pay like a 15-yr" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Pay like a 20-yr" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Pay like a 25-yr" }),
    ).toBeInTheDocument();
  });

  it("patches buydown when its switch is toggled", async () => {
    const { onChange } = renderStrategyTab({ buydown: false });

    await userEvent.click(switchNear("Model a 2-1 buydown"));

    expect(onChange).toHaveBeenCalledWith({ buydown: true });
  });

  it("patches extraMode when a toggle item is clicked", async () => {
    const { onChange } = renderStrategyTab({ term: 30, extraMode: "none" });

    await userEvent.click(
      screen.getByRole("button", { name: "Pay like a 15-yr" }),
    );

    expect(onChange).toHaveBeenCalledWith({ extraMode: "match15" });
  });

  it("patches refiTerm when the new-loan-term toggle is clicked", async () => {
    const { onChange } = renderStrategyTab(REFI_BREAKS_EVEN_BEFORE_SALE);

    await userEvent.click(screen.getByRole("button", { name: "20-year" }));

    expect(onChange).toHaveBeenCalledWith({ refiTerm: 20 });
  });

  it("resets refiExtraOverride to null via the 'Match my extra payment' button", async () => {
    const { onChange } = renderStrategyTab({
      ...REFI_BREAKS_EVEN_BEFORE_SALE,
      extraMode: "custom",
      refiExtraOverride: 700,
    });

    await userEvent.click(
      screen.getByRole("button", { name: /Match my extra payment/ }),
    );

    expect(onChange).toHaveBeenCalledWith({ refiExtraOverride: null });
  });
});
