import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { RefiBreakevenDialog } from "@/components/tabs/RefiBreakevenDialog";
import { DEFAULT_INPUTS, type LoanInputs, type LoanTerm } from "@/lib/defaults";

function renderDialog(overrides: Partial<LoanInputs> = {}) {
  const inputs = { ...DEFAULT_INPUTS, ...overrides };
  const onChange = vi.fn();
  render(<RefiBreakevenDialog inputs={inputs} onChange={onChange} />);
  return { inputs, onChange };
}

async function openDialog() {
  await userEvent.click(
    screen.getByRole("button", { name: "Check a refi's breakeven" }),
  );
}

// Refis in year 3 of a 10-year hold at a meaningfully lower rate, so it
// breaks even in 18 months — well inside the 84-month remaining hold.
const BREAKS_EVEN_BEFORE_SALE: Partial<LoanInputs> = {
  refiYear: 3,
  refiRate: 5.0,
  refiTerm: 30 as LoanTerm,
  refiClosingCostPct: 2,
  holdYears: 10,
};

// Refis in year 3, but the hold ends at year 4 — breakeven lands long after
// the 12-month remaining hold.
const BREAKS_EVEN_AFTER_SALE: Partial<LoanInputs> = {
  refiYear: 3,
  refiRate: 6.5,
  refiTerm: 30 as LoanTerm,
  refiClosingCostPct: 4,
  holdYears: 4,
};

// Refis into a much shorter term at a higher rate, so the new payment is
// actually higher — no payment breakeven to compare.
const NO_PAYMENT_DROP: Partial<LoanInputs> = {
  refiYear: 3,
  refiRate: 7.5,
  refiTerm: 15 as LoanTerm,
  refiClosingCostPct: 2,
  holdYears: 10,
};

describe("RefiBreakevenDialog", () => {
  it("shows the teal breaks-even-before-sale copy when trial breakeven is within the remaining hold", async () => {
    renderDialog(BREAKS_EVEN_BEFORE_SALE);
    await openDialog();

    expect(
      screen.getByText(/Breaks even in \d+ months — before you sell/),
    ).toBeInTheDocument();
  });

  it("shows the red breaks-even-after-sale copy when trial breakeven exceeds the remaining hold", async () => {
    renderDialog(BREAKS_EVEN_AFTER_SALE);
    await openDialog();

    expect(
      screen.getByText(/Breaks even in \d+ months — after you sell/),
    ).toBeInTheDocument();
  });

  it("shows the no-payment-breakeven copy when the trial refi doesn't drop the payment", async () => {
    renderDialog(NO_PAYMENT_DROP);
    await openDialog();

    expect(screen.getByText(/doesn't drop with this refi/)).toBeInTheDocument();
  });

  it("calls onChange with the trial values when Apply is clicked", async () => {
    const { onChange } = renderDialog(BREAKS_EVEN_BEFORE_SALE);
    await openDialog();

    await userEvent.click(screen.getByRole("button", { name: "Apply" }));

    expect(onChange).toHaveBeenCalledWith({
      refiEnabled: true,
      refiYear: BREAKS_EVEN_BEFORE_SALE.refiYear,
      refiRate: BREAKS_EVEN_BEFORE_SALE.refiRate,
      refiClosingCostPct: BREAKS_EVEN_BEFORE_SALE.refiClosingCostPct,
    });
  });
});
