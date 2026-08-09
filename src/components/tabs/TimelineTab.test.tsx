import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { TimelineTab } from "@/components/tabs/TimelineTab";
import { closedInputs, TODAY } from "@/test/servicingFixtures";
import { dateToMonthISO, monthToDateISO, parseISO } from "@/lib/dates";
import {
  createEscrowChangeEvent,
  createLumpSumEvent,
  createRecastEvent,
  createRecurringExtraEvent,
  createRefinanceEvent,
  type MortgageEvent,
  type TimelineVariant,
} from "@/lib/events";
import type { LoanInputs } from "@/lib/defaults";
import { DEFAULT_HOUSEHOLD, type Household } from "@/lib/household";
import { servicingContextFromInputs, simulateServicing } from "@/lib/servicing";

const CURRENT_MONTH = dateToMonthISO(closedInputs().firstPaymentDate, TODAY);

function renderTimelineTab(
  events: MortgageEvent[] = [],
  overrides: Partial<LoanInputs> = {},
  householdOverrides: Partial<Household> = {},
) {
  const inputs = closedInputs({ events, ...overrides });
  const household = { ...DEFAULT_HOUSEHOLD, ...householdOverrides };
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
      household={household}
    />,
  );
  return { inputs, ctx, result, baseline, onChange, household };
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

  it("seeds '+ Annual bonus' from the household bonus amount and calendar month", async () => {
    const { onChange, inputs } = renderTimelineTab(
      [],
      {},
      { annualBonusNet: 7500, bonusMonth: 11 },
    );

    await userEvent.click(
      screen.getByRole("button", { name: "+ Annual bonus" }),
    );

    const ev = onChange.mock.calls[0]![0].events.at(-1);
    expect(ev).toMatchObject({
      kind: "extra",
      cadence: "annual",
      amount: 7500,
    });
    // Lands on the next November after today, not a bare "a year from now".
    expect(ev.month).toBeGreaterThan(CURRENT_MONTH);
    expect(parseISO(monthToDateISO(inputs.firstPaymentDate, ev.month)).m).toBe(
      11,
    );
  });

  it("falls back to a placeholder bonus amount when the household has none", async () => {
    const { onChange } = renderTimelineTab([], {}, { annualBonusNet: 0 });

    await userEvent.click(
      screen.getByRole("button", { name: "+ Annual bonus" }),
    );

    expect(onChange.mock.calls[0]![0].events.at(-1).amount).toBe(10000);
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

  it("clamps a date picked before the first payment date to month 1", async () => {
    const ev = createLumpSumEvent(CURRENT_MONTH + 1, { amount: 5000 });
    const { onChange } = renderTimelineTab([ev]);

    const row = screen
      .getAllByText(/Lump sum \$5,000/)[0]!
      .closest<HTMLElement>(".rounded-lg")!;
    const editButton = within(row).getAllByRole("button")[0]!;
    await userEvent.click(editButton);

    const dateInput = screen
      .getByText("Date")
      .parentElement!.querySelector('input[type="date"]')! as HTMLInputElement;
    expect(dateInput.min).toBe("2026-05-01");

    fireEvent.change(dateInput, { target: { value: "2020-01-01" } });

    expect(onChange).toHaveBeenCalledWith({
      events: [{ ...ev, month: 1 }],
    });
  });

  it("shows a before/after payment line for a refinance event", () => {
    renderTimelineTab([
      createRefinanceEvent(CURRENT_MONTH + 1, { rate: 4.5, termYears: 15 }),
    ]);

    expect(screen.getByText(/Payment: /)).toBeInTheDocument();
  });

  it("shows a before/after payment line for a recast event", () => {
    renderTimelineTab([
      createRecastEvent(CURRENT_MONTH + 1, { lumpSum: 50000 }),
    ]);

    expect(screen.getByText(/Payment: /)).toBeInTheDocument();
  });

  it("shows a before/after escrow line for an escrow-change event", () => {
    renderTimelineTab([
      createEscrowChangeEvent(CURRENT_MONTH + 1, {
        taxAnnual: 9000,
        insuranceAnnual: 3000,
      }),
    ]);

    expect(screen.getByText(/Escrow: /)).toBeInTheDocument();
  });

  it("shows a before/after total-outflow line for a recurring extra-payment event", () => {
    renderTimelineTab([
      createRecurringExtraEvent(CURRENT_MONTH + 1, {
        cadence: "monthly",
        amount: 500,
      }),
    ]);

    expect(screen.getByText(/Total monthly outflow: /)).toBeInTheDocument();
  });

  it("closes the Load confirmation dialog and loads the variant's events", async () => {
    const variant: TimelineVariant = {
      id: "v1",
      name: "Refi @3+5",
      events: [createLumpSumEvent(CURRENT_MONTH + 1, { amount: 1000 })],
    };
    const currentEvent = createLumpSumEvent(CURRENT_MONTH + 2, {
      amount: 2000,
    });
    const { onChange } = renderTimelineTab([currentEvent], {
      variants: [variant],
    });

    expect(screen.getByText("Refi @3+5")).toBeInTheDocument();
    expect(screen.getByText(/1 event/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Load" }));
    const dialog = screen.getByRole("alertdialog");
    expect(
      within(dialog).getByText(/Replace your current timeline/),
    ).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole("button", { name: "Load" }));

    expect(onChange).toHaveBeenCalledWith({ events: variant.events });
    expect(
      screen.queryByText(/Replace your current timeline/),
    ).not.toBeInTheDocument();
  });
});
