import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { VariantsTab } from "@/components/tabs/VariantsTab";
import { closedInputs, TODAY } from "@/test/servicingFixtures";
import { dateToMonthISO } from "@/lib/dates";
import { createLumpSumEvent } from "@/lib/events";
import type { TimelineVariant } from "@/lib/events";
import { servicingContextFromInputs } from "@/lib/servicing";

const CURRENT_MONTH = dateToMonthISO(closedInputs().firstPaymentDate, TODAY);

function variant(name: string, amount: number): TimelineVariant {
  return {
    id: crypto.randomUUID(),
    name,
    events: [createLumpSumEvent(CURRENT_MONTH + 6, { amount })],
  };
}

function renderVariantsTab(variants: TimelineVariant[] = []) {
  const inputs = closedInputs({ variants });
  const ctx = servicingContextFromInputs(inputs, TODAY);
  render(
    <VariantsTab inputs={inputs} ctx={ctx} currentMonth={CURRENT_MONTH} />,
  );
  return { inputs, ctx };
}

describe("VariantsTab", () => {
  it("shows the empty-state message when there are no saved variants", () => {
    renderVariantsTab([]);

    expect(screen.getByText(/No saved variants yet/)).toBeInTheDocument();
  });

  it("renders a comparison column for each saved variant plus the current/do-nothing baselines", () => {
    renderVariantsTab([variant("Refi @5", 20000), variant("Lump only", 10000)]);

    expect(
      screen.getByRole("columnheader", { name: "Refi @5" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Lump only" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Do nothing" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Current (unsaved)" }),
    ).toBeInTheDocument();
  });

  it("shows the best-variant summary card once at least one variant is saved", () => {
    renderVariantsTab([variant("Refi @5", 20000)]);

    expect(screen.getByText("The trade, in plain terms")).toBeInTheDocument();
  });

  it("shows a note that only the first four variants are charted when more than four are saved", () => {
    renderVariantsTab([
      variant("A", 5000),
      variant("B", 6000),
      variant("C", 7000),
      variant("D", 8000),
      variant("E", 9000),
    ]);

    expect(
      screen.getByText(/Only the first four variants/),
    ).toBeInTheDocument();
  });

  it("does not show the four-variant notice with four or fewer variants", () => {
    renderVariantsTab([variant("A", 5000), variant("B", 6000)]);

    expect(
      screen.queryByText(/Only the first four variants/),
    ).not.toBeInTheDocument();
  });
});
