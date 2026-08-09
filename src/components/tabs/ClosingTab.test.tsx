import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ClosingTab } from "@/components/tabs/ClosingTab";
import { DEFAULT_INPUTS, type LoanInputs } from "@/lib/defaults";
import { usd0 } from "@/lib/mortgage";
import { computeMortgagePlan } from "@/lib/plan";

function renderClosingTab(overrides: Partial<LoanInputs> = {}) {
  const inputs = { ...DEFAULT_INPUTS, ...overrides };
  const plan = computeMortgagePlan(inputs);
  const onChange = vi.fn();
  render(<ClosingTab inputs={inputs} onChange={onChange} plan={plan} />);
  return { inputs, plan, onChange };
}

describe("ClosingTab", () => {
  it("shows the 'I closed on this loan' CTA only in buying mode", () => {
    renderClosingTab({ mode: "buying" });
    expect(
      screen.getByRole("button", { name: "I closed on this loan" }),
    ).toBeInTheDocument();
  });

  it("hides the 'I closed on this loan' CTA in owning mode", () => {
    renderClosingTab({ mode: "owning" });
    expect(
      screen.queryByRole("button", { name: "I closed on this loan" }),
    ).not.toBeInTheDocument();
  });

  it("hides the prepaid-interest row when no close date is set", () => {
    renderClosingTab({ closeDate: null });
    expect(screen.queryByText("Prepaid interest")).not.toBeInTheDocument();
  });

  it("shows the prepaid-interest row once a close date is set", () => {
    renderClosingTab({ closeDate: "2026-03-15" });
    expect(screen.getByText("Prepaid interest")).toBeInTheDocument();
  });

  it("shows the seller-credit-wasted callout when the ask exceeds what closing/prepaids/buydown can absorb", () => {
    renderClosingTab({
      sellerCreditPct: 6,
      closingCostPct: 1,
      escrowMonths: 1,
    });
    expect(screen.getByText(/can't be used/)).toBeInTheDocument();
  });

  it("hides the seller-credit-wasted callout when nothing is wasted", () => {
    renderClosingTab({ sellerCreditPct: 0 });
    expect(screen.queryByText(/can't be used/)).not.toBeInTheDocument();
  });

  it("shows a shortfall when the seller-funded buydown subsidy isn't fully covered by the credit", () => {
    renderClosingTab({
      buydown: true,
      buydownFundedBySeller: true,
      sellerCreditPct: 0,
    });
    expect(screen.getByText(/short/)).toBeInTheDocument();
  });

  it("shows $0 owed when the seller-funded buydown subsidy is fully covered", () => {
    renderClosingTab({
      buydown: true,
      buydownFundedBySeller: true,
      sellerCreditPct: 6,
      closingCostPct: 0.1,
      escrowMonths: 0,
    });
    const buydownLine = screen.getByText(/2-1 buydown subsidy/).closest("div")!;
    expect(within(buydownLine).getByText("$0")).toBeInTheDocument();
    expect(screen.queryByText(/short/)).not.toBeInTheDocument();
  });

  it("shows the buyer-funded buydown cost when not seller-funded", () => {
    const { plan } = renderClosingTab({
      buydown: true,
      buydownFundedBySeller: false,
    });
    expect(
      screen.getByText(`+${usd0(plan.buydownCostToBuyer)}`),
    ).toBeInTheDocument();
  });

  it("shows the 'Est. from LTV' button only when maxConcessionPct differs from the LTV-derived default", () => {
    renderClosingTab({ downPct: 5 });
    expect(
      screen.getByRole("button", { name: /Est\. from LTV/ }),
    ).toBeInTheDocument();
  });

  it("hides the 'Est. from LTV' button once maxConcessionPct already matches", () => {
    renderClosingTab({ downPct: 20, maxConcessionPct: 6 });
    expect(
      screen.queryByRole("button", { name: /Est\. from LTV/ }),
    ).not.toBeInTheDocument();
  });

  it("shows the short-on-reserves copy when remainingAfterClose is negative", () => {
    renderClosingTab({ reserves: 1000 });
    expect(
      screen.getByText(/short — you'd need to bring in more/),
    ).toBeInTheDocument();
  });

  it("shows the money-left copy when remainingAfterClose is positive", () => {
    renderClosingTab({ reserves: 250000 });
    expect(
      screen.getByText(/total money left after closing/),
    ).toBeInTheDocument();
  });

  it("shows the over-the-cap warning when the total seller ask exceeds the concession cap", () => {
    renderClosingTab({ sellerCreditPct: 6, maxConcessionPct: 1 });
    expect(screen.getByText(/is .* over the cap/)).toBeInTheDocument();
  });

  it("shows the within-the-cap copy when the total seller ask fits", () => {
    renderClosingTab({ sellerCreditPct: 0.1, maxConcessionPct: 30 });
    expect(screen.getByText(/fits within the cap/)).toBeInTheDocument();
  });

  it("patches closeDate from the native date input", () => {
    const { onChange } = renderClosingTab({ closeDate: null });
    const label = screen.getByText("Close date (optional)");
    const input = within(label.parentElement!).getByDisplayValue("");

    fireEvent.change(input, { target: { value: "2026-06-15" } });

    expect(onChange).toHaveBeenLastCalledWith({ closeDate: "2026-06-15" });
  });

  it("patches buydownFundedBySeller via the funding toggle buttons", async () => {
    const { onChange } = renderClosingTab({
      buydown: true,
      buydownFundedBySeller: true,
    });

    await userEvent.click(screen.getByRole("button", { name: "You fund" }));
    expect(onChange).toHaveBeenCalledWith({ buydownFundedBySeller: false });

    await userEvent.click(screen.getByRole("button", { name: "Seller funds" }));
    expect(onChange).toHaveBeenCalledWith({ buydownFundedBySeller: true });
  });

  it("shows the discount-points cost as a closing-cost line item", () => {
    const { plan } = renderClosingTab({ points: 2 });
    const pointsLine = screen.getByText(/Discount points/).closest("div")!;
    expect(
      within(pointsLine).getByText(usd0(plan.pointsCost)),
    ).toBeInTheDocument();
  });

  it("patches points from the closing-costs line item", () => {
    const { onChange } = renderClosingTab({ points: 1 });
    const pointsLine = screen.getByText(/Discount points/).closest("div")!;

    fireEvent.change(within(pointsLine).getByDisplayValue("1"), {
      target: { value: "2" },
    });

    expect(onChange).toHaveBeenLastCalledWith({ points: 2 });
  });

  it("patches maxConcessionPct to the LTV-derived value via 'Est. from LTV'", async () => {
    const { plan, onChange } = renderClosingTab({ downPct: 5 });

    await userEvent.click(
      screen.getByRole("button", { name: /Est\. from LTV/ }),
    );

    expect(onChange).toHaveBeenCalledWith({
      maxConcessionPct: plan.ltvBasedConcessionPct,
    });
  });
});
