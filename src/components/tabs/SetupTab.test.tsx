import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { SetupTab } from "@/components/tabs/SetupTab";
import { STARTER_EXISTING_LOAN } from "@/components/tabs/ExistingLoanSection";
import { DEFAULT_INPUTS, type LoanInputs } from "@/lib/defaults";
import { computeMortgagePlan } from "@/lib/plan";

function renderSetupTab(overrides: Partial<LoanInputs> = {}) {
  const inputs = { ...DEFAULT_INPUTS, ...overrides };
  const plan = computeMortgagePlan(inputs);
  const onChange = vi.fn();
  render(<SetupTab inputs={inputs} onChange={onChange} plan={plan} />);
  return { inputs, plan, onChange };
}

function fieldSpinbutton(labelText: string | RegExp) {
  const label = screen.getByText(labelText);
  return within(label.parentElement!).getByRole("spinbutton");
}

function fieldSlider(labelText: string | RegExp) {
  const label = screen.getByText(labelText);
  return within(label.parentElement!).getAllByRole("slider", {
    hidden: true,
  })[0];
}

describe("SetupTab", () => {
  it("renders the full shopping-flow card set when ownershipStatus is shopping", () => {
    renderSetupTab({ ownershipStatus: "shopping" });

    expect(screen.getByText("Loan setup")).toBeInTheDocument();
    expect(screen.getByText("Purchase price")).toBeInTheDocument();
  });

  it("renders only the ownership toggle and ExistingLoanSection when ownershipStatus is existing, skipping the shopping cards", () => {
    renderSetupTab({ ownershipStatus: "existing" });

    expect(screen.getByText("Your current loan")).toBeInTheDocument();
    expect(screen.queryByText("Loan setup")).not.toBeInTheDocument();
    expect(screen.queryByText("Purchase price")).not.toBeInTheDocument();
  });

  it("shows the PMI warning box, including the cancellable-PMI copy branch, when downPct is below 20", () => {
    renderSetupTab({ downPct: 10 });

    expect(screen.getByText(/Estimated PMI/)).toBeInTheDocument();
    expect(
      screen.getByText(/should be cancellable around year/),
    ).toBeInTheDocument();
  });

  it("hides the PMI warning box at 20% or more down", () => {
    renderSetupTab({ downPct: 20 });

    expect(screen.queryByText(/Estimated PMI/)).not.toBeInTheDocument();
  });

  it("switches the down-payment hint text based on the 20% PMI threshold", () => {
    const inputs10 = { ...DEFAULT_INPUTS, downPct: 10 };
    const { rerender } = render(
      <SetupTab
        inputs={inputs10}
        onChange={vi.fn()}
        plan={computeMortgagePlan(inputs10)}
      />,
    );
    expect(
      screen.getByText("Below 20% triggers estimated PMI below."),
    ).toBeInTheDocument();

    const inputs25 = { ...DEFAULT_INPUTS, downPct: 25 };
    rerender(
      <SetupTab
        inputs={inputs25}
        onChange={vi.fn()}
        plan={computeMortgagePlan(inputs25)}
      />,
    );
    expect(
      screen.getByText("20%+ avoids PMI on a conventional loan."),
    ).toBeInTheDocument();
  });

  it("patches purchasePrice when the purchase price field changes", async () => {
    const { onChange } = renderSetupTab();
    const input = fieldSpinbutton("Purchase price");

    await userEvent.clear(input);
    await userEvent.type(input, "750000");

    expect(onChange).toHaveBeenLastCalledWith({ purchasePrice: 750000 });
  });

  it("patches downPct when the down-payment slider is adjusted", async () => {
    const { onChange } = renderSetupTab();
    const thumb = fieldSlider(/Down payment —/);

    thumb.focus();
    await userEvent.keyboard("{ArrowRight}");

    expect(onChange).toHaveBeenCalledWith({ downPct: 21 });
  });

  it("patches the whole rates object, not just the active term, when the interest rate field changes", async () => {
    const { inputs, onChange } = renderSetupTab();
    const input = fieldSpinbutton("Interest rate — 30-year fixed");

    await userEvent.clear(input);
    await userEvent.type(input, "7");

    expect(onChange).toHaveBeenLastCalledWith({
      rates: { ...inputs.rates, 30: 7 },
    });
  });

  it("patches includeFlood when the flood-insurance switch is toggled", async () => {
    const { onChange } = renderSetupTab({ includeFlood: false });
    const toggle = screen.getByRole("switch");

    await userEvent.click(toggle);

    expect(onChange).toHaveBeenCalledWith({ includeFlood: true });
  });

  it("patches ownershipStatus and seeds existingLoan when switching to 'I already own a home'", async () => {
    const { onChange } = renderSetupTab({ existingLoan: null });

    await userEvent.click(
      screen.getByRole("button", { name: "I already own a home" }),
    );

    expect(onChange).toHaveBeenCalledWith({
      ownershipStatus: "existing",
      existingLoan: STARTER_EXISTING_LOAN,
    });
  });

  it("reuses the existing existingLoan value instead of resetting it when re-switching to existing", async () => {
    const existingLoan = { ...STARTER_EXISTING_LOAN, currentBalance: 999000 };
    const { onChange } = renderSetupTab({ existingLoan });

    await userEvent.click(
      screen.getByRole("button", { name: "I already own a home" }),
    );

    expect(onChange).toHaveBeenCalledWith({
      ownershipStatus: "existing",
      existingLoan,
    });
  });
});
