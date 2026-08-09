import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { LedgerTab } from "@/components/tabs/LedgerTab";
import { closedInputs, TODAY } from "@/test/servicingFixtures";
import { dateToMonthISO } from "@/lib/dates";
import { createLumpSumEvent } from "@/lib/events";
import { servicingContextFromInputs, simulateServicing } from "@/lib/servicing";

const CURRENT_MONTH = dateToMonthISO(closedInputs().firstPaymentDate, TODAY);

function renderLedgerTab() {
  const events = [createLumpSumEvent(3, { amount: 15000 })];
  const inputs = closedInputs({ events });
  const ctx = servicingContextFromInputs(inputs, TODAY);
  const result = simulateServicing(ctx, events);
  render(
    <LedgerTab result={result} events={events} currentMonth={CURRENT_MONTH} />,
  );
  return { result, events };
}

describe("LedgerTab", () => {
  it("renders a collapsed year-group row per year, with no month rows shown initially", () => {
    renderLedgerTab();

    expect(screen.getByText("Year 1")).toBeInTheDocument();
    expect(screen.queryByText("$15,000")).not.toBeInTheDocument();
  });

  it("expands a year group to reveal its monthly rows when clicked", async () => {
    renderLedgerTab();
    const rowsBefore = screen.getAllByRole("row").length;

    await userEvent.click(screen.getByText("Year 1"));

    const rowsAfter = screen.getAllByRole("row").length;
    expect(rowsAfter).toBeGreaterThan(rowsBefore);
  });

  it("renders an event-color dot on the month a lump-sum event landed in, once expanded", async () => {
    renderLedgerTab();

    await userEvent.click(screen.getByText("Year 1"));

    const dot = document.querySelector('[title="Lump sum"]');
    expect(dot).not.toBeNull();
  });
});
