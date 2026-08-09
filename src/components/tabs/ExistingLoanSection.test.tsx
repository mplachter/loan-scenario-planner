import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  ExistingLoanSection,
  STARTER_EXISTING_LOAN,
} from "@/components/tabs/ExistingLoanSection";
import { addMonthsISO, firstOfMonthISO, todayISO } from "@/lib/dates";
import { DEFAULT_INPUTS, type ExistingLoan } from "@/lib/defaults";

function renderSection(existingLoan: ExistingLoan | null = null) {
  const inputs = { ...DEFAULT_INPUTS, existingLoan };
  const onChange = vi.fn();
  render(<ExistingLoanSection inputs={inputs} onChange={onChange} />);
  return { onChange };
}

function fieldSpinbutton(labelText: string | RegExp) {
  const label = screen.getByText(labelText);
  return within(label.parentElement!).getByRole("spinbutton");
}

describe("ExistingLoanSection", () => {
  it("falls back to STARTER_EXISTING_LOAN's values when inputs.existingLoan is null", () => {
    renderSection(null);

    expect(fieldSpinbutton("Current balance")).toHaveValue(
      STARTER_EXISTING_LOAN.currentBalance,
    );
  });

  it("nests every field edit inside a whole existingLoan patch, not a flat top-level key", async () => {
    const { onChange } = renderSection();
    const input = fieldSpinbutton("Current balance");

    await userEvent.clear(input);
    await userEvent.type(input, "450000");

    expect(onChange).toHaveBeenLastCalledWith({
      existingLoan: { ...STARTER_EXISTING_LOAN, currentBalance: 450000 },
    });
  });

  it("nests the original-term ToggleGroup edit inside existingLoan too", async () => {
    const { onChange } = renderSection();

    await userEvent.click(screen.getByRole("button", { name: "15-year" }));

    expect(onChange).toHaveBeenCalledWith({
      existingLoan: { ...STARTER_EXISTING_LOAN, originalTermYears: 15 },
    });
  });

  it("patches mode/ownershipStatus/servicing fields in one call when 'Start managing this loan' is clicked", async () => {
    const existingLoan: ExistingLoan = {
      ...STARTER_EXISTING_LOAN,
      currentBalance: 380000,
      currentRate: 5.75,
      purchaseDate: "2022-06-01",
    };
    const { onChange } = renderSection(existingLoan);

    await userEvent.click(
      screen.getByRole("button", { name: "Start managing this loan" }),
    );

    expect(onChange).toHaveBeenCalledWith({
      mode: "owning",
      ownershipStatus: "existing",
      closeDate: "2022-06-01",
      firstPaymentDate: addMonthsISO(firstOfMonthISO(todayISO()), 1),
      servicedLoanAmount: 380000,
      servicedRate: 5.75,
      servicedTerm: null,
      events: [],
    });
  });

  it("carries a null purchaseDate straight through to closeDate when starting to manage", async () => {
    const { onChange } = renderSection();

    await userEvent.click(
      screen.getByRole("button", { name: "Start managing this loan" }),
    );

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ closeDate: null }),
    );
  });
});
