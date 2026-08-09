import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { CompareTab } from "@/components/tabs/CompareTab";
import { DEFAULT_INPUTS, type LoanInputs } from "@/lib/defaults";
import { computeMortgagePlan } from "@/lib/plan";

function renderCompareTab(overrides: Partial<LoanInputs> = {}) {
  const inputs = { ...DEFAULT_INPUTS, ...overrides };
  const plan = computeMortgagePlan(inputs);
  const onChange = vi.fn();
  render(<CompareTab inputs={inputs} onChange={onChange} plan={plan} />);
  return { inputs, plan, onChange };
}

function columnHeader(term: number) {
  return screen.getByText(`${term}-yr`).closest("th")!;
}

describe("CompareTab", () => {
  it("renders a column for all four loan terms", () => {
    renderCompareTab();

    expect(screen.getByText("15-yr")).toBeInTheDocument();
    expect(screen.getByText("20-yr")).toBeInTheDocument();
    expect(screen.getByText("25-yr")).toBeInTheDocument();
    expect(screen.getByText("30-yr")).toBeInTheDocument();
  });

  it("shows 'baseline' for the 30-yr column and a payment delta for the other three", () => {
    renderCompareTab();

    expect(screen.getByText("baseline")).toBeInTheDocument();

    const deltaRow = screen.getByText("vs 30-yr payment").closest("tr")!;
    expect(within(deltaRow).getAllByText(/\+\$[\d,]+\/mo/)).toHaveLength(3);
  });

  it("shows the savings sentence versus the 30-yr only when the cheapest-hold term isn't 30", () => {
    const { plan } = renderCompareTab();
    expect(plan.cheapestHold.term).not.toBe(30);

    expect(screen.getByText(/Versus the 30-yr, it saves/)).toBeInTheDocument();
  });

  it("hides the savings sentence when the cheapest-hold term is 30", () => {
    // Force cheapestHold to be the 30-yr by making every other term's rate
    // punitively high, so 30 has the least interest paid by the hold year.
    renderCompareTab({
      rates: { 15: 12, 20: 12, 25: 12, 30: 6.6 },
    });

    expect(
      screen.queryByText(/Versus the 30-yr, it saves/),
    ).not.toBeInTheDocument();
  });

  it("shows the selected-term sentence only when the selected term differs from the cheapest-hold term", () => {
    const { plan } = renderCompareTab({ term: 30 });
    expect(plan.cheapestHold.term).not.toBe(30);

    expect(screen.getByText(/Your selected 30-yr pays/)).toBeInTheDocument();
  });

  it("hides the selected-term sentence when the selected term matches the cheapest-hold term", () => {
    const { plan } = renderCompareTab({ term: 15 });
    expect(plan.cheapestHold.term).toBe(15);

    expect(screen.queryByText(/Your selected .*pays/)).not.toBeInTheDocument();
  });

  it("patches term when a column header is clicked", async () => {
    const { onChange } = renderCompareTab({ term: 30 });

    await userEvent.click(columnHeader(15));

    expect(onChange).toHaveBeenCalledWith({ term: 15 });
  });

  it("patches holdYears when the ownership-length slider is adjusted", async () => {
    const { onChange } = renderCompareTab({ holdYears: 5 });
    const thumb = screen.getAllByRole("slider", { hidden: true })[0];

    thumb.focus();
    await userEvent.keyboard("{ArrowRight}");

    expect(onChange).toHaveBeenCalledWith({ holdYears: 6 });
  });

  it("patches the whole rates object when a column's inline rate is edited", async () => {
    const { inputs, onChange } = renderCompareTab();
    const input = within(columnHeader(15)).getByRole("spinbutton");

    await userEvent.clear(input);
    await userEvent.type(input, "5");

    expect(onChange).toHaveBeenLastCalledWith({
      rates: { ...inputs.rates, 15: 5 },
    });
  });
});
