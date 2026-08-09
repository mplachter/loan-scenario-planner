import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { EquityMaximizerDialog } from "@/components/tabs/EquityMaximizerDialog";
import { DEFAULT_INPUTS, type LoanInputs } from "@/lib/defaults";
import { usd0 } from "@/lib/mortgage";
import { maximizeEquityAtSale } from "@/lib/plan";

function renderDialog(overrides: Partial<LoanInputs> = {}) {
  const inputs = { ...DEFAULT_INPUTS, ...overrides };
  const onChange = vi.fn();
  render(<EquityMaximizerDialog inputs={inputs} onChange={onChange} />);
  return { inputs, onChange };
}

async function openDialog() {
  await userEvent.click(
    screen.getByRole("button", { name: "Maximize my equity" }),
  );
}

describe("EquityMaximizerDialog", () => {
  it("shows the recommended-extra stat computed from the real maximizeEquityAtSale result", async () => {
    const { inputs } = renderDialog();
    await openDialog();

    const budget = inputs.customExtra || 500;
    const result = maximizeEquityAtSale(inputs, budget);

    expect(
      screen.getByText(`${usd0(result.recommendedExtra)}/mo`),
    ).toBeInTheDocument();
    expect(screen.getByText(usd0(result.balanceAtSale))).toBeInTheDocument();
  });

  it("calls onChange with the recommended-extra patch shape when Apply is clicked", async () => {
    const { inputs, onChange } = renderDialog();
    await openDialog();

    const budget = inputs.customExtra || 500;
    const result = maximizeEquityAtSale(inputs, budget);

    await userEvent.click(screen.getByRole("button", { name: "Apply" }));

    expect(onChange).toHaveBeenCalledWith({
      extraMode: "custom",
      customExtra: result.recommendedExtra,
      refiExtraOverride: null,
    });
  });
});
