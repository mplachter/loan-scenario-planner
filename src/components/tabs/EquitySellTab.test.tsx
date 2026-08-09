import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { EquitySellTab } from "@/components/tabs/EquitySellTab";
import { closedInputs, TODAY } from "@/test/servicingFixtures";
import { dateToMonthISO } from "@/lib/dates";
import type { LoanInputs } from "@/lib/defaults";
import { servicingContextFromInputs, simulateServicing } from "@/lib/servicing";

const CURRENT_MONTH = dateToMonthISO(closedInputs().firstPaymentDate, TODAY);

function renderEquitySellTab(overrides: Partial<LoanInputs> = {}) {
  const inputs = closedInputs(overrides);
  const ctx = servicingContextFromInputs(inputs, TODAY);
  const result = simulateServicing(ctx, inputs.events);
  const onChange = vi.fn();
  render(
    <EquitySellTab
      inputs={inputs}
      onChange={onChange}
      ctx={ctx}
      result={result}
      currentMonth={CURRENT_MONTH}
    />,
  );
  return { inputs, ctx, result, onChange };
}

describe("EquitySellTab", () => {
  it("shows the break-even year once net proceeds catch up to cash in", () => {
    renderEquitySellTab();

    expect(screen.getByText(/is year \d+\./)).toBeInTheDocument();
  });

  it("shows the 40-year fallback copy when the home never breaks even", () => {
    renderEquitySellTab({ homeAppreciationPct: -8, sellingCostPct: 8 });

    expect(
      screen.getByText(/doesn't happen within 40 years/),
    ).toBeInTheDocument();
  });

  it("patches sellingCostPct when the selling-costs field is edited", async () => {
    const { onChange } = renderEquitySellTab();
    const input = screen.getByRole("spinbutton");

    await userEvent.clear(input);
    await userEvent.type(input, "6");

    expect(onChange).toHaveBeenLastCalledWith({ sellingCostPct: 6 });
  });

  it("moving the sale-year slider updates local state without calling the parent onChange", async () => {
    const { onChange } = renderEquitySellTab();
    const thumb = screen.getAllByRole("slider", { hidden: true })[0]!;

    thumb.focus();
    await userEvent.keyboard("{ArrowRight}");

    expect(onChange).not.toHaveBeenCalled();
  });
});
