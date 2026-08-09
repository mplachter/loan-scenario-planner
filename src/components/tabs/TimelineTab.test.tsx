import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { TimelineTab } from "@/components/tabs/TimelineTab";
import { closedInputs, TODAY } from "@/test/servicingFixtures";
import { dateToMonthISO } from "@/lib/dates";
import {
  createLumpSumEvent,
  createRefinanceEvent,
  type MortgageEvent,
} from "@/lib/events";
import type { LoanInputs } from "@/lib/defaults";
import { servicingContextFromInputs, simulateServicing } from "@/lib/servicing";

const CURRENT_MONTH = dateToMonthISO(closedInputs().firstPaymentDate, TODAY);

function renderTimelineTab(
  events: MortgageEvent[] = [],
  overrides: Partial<LoanInputs> = {},
) {
  const inputs = closedInputs({ events, ...overrides });
  const ctx = servicingContextFromInputs(inputs, TODAY);
  const result = simulateServicing(ctx, inputs.events);
  const baseline = simulateServicing(ctx, []);
  const onChange = vi.fn();
  render(
    <TimelineTab
      inputs={inputs}
      onChange={onChange}
      ctx={ctx}
      result={result}
      baseline={baseline}
      currentMonth={CURRENT_MONTH}
    />,
  );
  return { inputs, ctx, result, baseline, onChange };
}

describe("TimelineTab", () => {
  it("shows the empty-state message when there are no events", () => {
    renderTimelineTab([]);
    expect(
      screen.getByText(/No events yet — add a refinance/),
    ).toBeInTheDocument();
  });

  it("adds a new event with a whole-array-replace onChange patch", async () => {
    const { onChange, inputs } = renderTimelineTab([]);

    await userEvent.click(screen.getByRole("button", { name: "+ Lump sum" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const patch = onChange.mock.calls[0]![0];
    expect(patch.events).toHaveLength(inputs.events.length + 1);
    expect(patch.events.at(-1).kind).toBe("lump");
  });

  it("toggles an event's enabled flag via the row switch, replacing the whole events array", async () => {
    const ev = createLumpSumEvent(CURRENT_MONTH + 1, { amount: 5000 });
    const { onChange } = renderTimelineTab([ev]);

    await userEvent.click(screen.getByRole("switch"));

    expect(onChange).toHaveBeenCalledWith({
      events: [{ ...ev, enabled: false }],
    });
  });

  it("deletes an event after confirming the alert dialog, replacing the whole events array", async () => {
    const ev = createLumpSumEvent(CURRENT_MONTH + 1, { amount: 5000 });
    const { onChange } = renderTimelineTab([ev]);

    const row = screen
      .getAllByText(/Lump sum \$5,000/)[0]!
      .closest<HTMLElement>(".rounded-lg")!;
    const trashButton = within(row).getAllByRole("button")[1]!;
    await userEvent.click(trashButton);
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(onChange).toHaveBeenCalledWith({ events: [] });
  });

  it("does not call onChange when the delete confirmation is cancelled", async () => {
    const ev = createLumpSumEvent(CURRENT_MONTH + 1, { amount: 5000 });
    const { onChange } = renderTimelineTab([ev]);

    const row = screen
      .getAllByText(/Lump sum \$5,000/)[0]!
      .closest<HTMLElement>(".rounded-lg")!;
    const trashButton = within(row).getAllByRole("button")[1]!;
    await userEvent.click(trashButton);
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onChange).not.toHaveBeenCalled();
  });

  it("shows the serial-refi-trap warning once two cash-out refinances push the balance above the do-nothing baseline", () => {
    renderTimelineTab([
      createRefinanceEvent(CURRENT_MONTH + 1, {
        cashOut: 50000,
        rollCostsIn: true,
        closingCostPct: 0,
        closingCostFlat: 0,
      }),
      createRefinanceEvent(CURRENT_MONTH + 3, {
        cashOut: 50000,
        rollCostsIn: true,
        closingCostPct: 0,
        closingCostFlat: 0,
      }),
    ]);

    expect(screen.getByText("The serial-refi trap")).toBeInTheDocument();
  });

  it("hides the serial-refi-trap warning with fewer than two refinances", () => {
    renderTimelineTab([createRefinanceEvent(CURRENT_MONTH + 1)]);

    expect(screen.queryByText("The serial-refi trap")).not.toBeInTheDocument();
  });

  it("shows a clock-reset warning for a refinance that lengthens the payoff clock", () => {
    renderTimelineTab([
      createRefinanceEvent(CURRENT_MONTH + 12, { termYears: 30, rate: 6.6 }),
    ]);

    expect(
      screen.getByText(/adds \d+ years? to the clock/),
    ).toBeInTheDocument();
  });

  it("renders the per-event attribution list once an event exists", () => {
    renderTimelineTab([
      createLumpSumEvent(CURRENT_MONTH + 1, { amount: 20000 }),
    ]);

    expect(screen.getByText("What each lever is doing")).toBeInTheDocument();
  });
});
