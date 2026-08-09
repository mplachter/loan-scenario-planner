import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { CloseLoanDialog } from "@/components/CloseLoanDialog";
import { DEFAULT_INPUTS, type LoanInputs } from "@/lib/defaults";
import { computeMortgagePlan } from "@/lib/plan";

function renderDialog(overrides: Partial<LoanInputs> = {}) {
  const inputs = { ...DEFAULT_INPUTS, ...overrides };
  const plan = computeMortgagePlan(inputs);
  const onChange = vi.fn();
  render(<CloseLoanDialog inputs={inputs} onChange={onChange} plan={plan} />);
  return { inputs, plan, onChange };
}

async function openDialog() {
  await userEvent.click(
    screen.getByRole("button", { name: "I closed on this loan" }),
  );
}

describe("CloseLoanDialog", () => {
  it("shows the carried-over seed-event summary when extra payments and a refi are both modeled", async () => {
    renderDialog({ extraMode: "custom", customExtra: 500, refiEnabled: true });
    await openDialog();

    expect(
      screen.getByText("Carried over from your buying plan"),
    ).toBeInTheDocument();
  });

  it("hides the carried-over seed-event summary when nothing was modeled", async () => {
    renderDialog({ extraMode: "none", refiEnabled: false });
    await openDialog();

    expect(
      screen.queryByText("Carried over from your buying plan"),
    ).not.toBeInTheDocument();
  });

  it("re-derives the first payment date when the close date changes", async () => {
    renderDialog();
    await openDialog();

    const closeDateField = screen
      .getByText("Close date")
      .parentElement!.querySelector('input[type="date"]')!;
    fireEvent.change(closeDateField, { target: { value: "2026-01-15" } });

    const firstPaymentField = screen
      .getByText("First payment date")
      .parentElement!.querySelector('input[type="date"]')! as HTMLInputElement;
    expect(firstPaymentField.value).toBe("2026-03-01");
  });

  it("calls onChange exactly once with all seven snapshot keys when Apply is clicked", async () => {
    const { inputs, plan, onChange } = renderDialog();
    await openDialog();

    await userEvent.click(screen.getByRole("button", { name: "Apply" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "owning",
        servicedLoanAmount: plan.loanAmount,
        servicedRate: plan.rate,
        servicedTerm: inputs.term,
        events: [],
      }),
    );
    const patch = onChange.mock.calls[0][0];
    expect(Object.keys(patch).sort()).toEqual(
      [
        "closeDate",
        "events",
        "firstPaymentDate",
        "mode",
        "servicedLoanAmount",
        "servicedRate",
        "servicedTerm",
      ].sort(),
    );
  });
});
