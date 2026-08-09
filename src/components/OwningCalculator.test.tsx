import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { OwningCalculator } from "@/components/OwningCalculator";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { closedInputs } from "@/test/servicingFixtures";
import { DEFAULT_HOUSEHOLD } from "@/lib/household";

const TAB_NAMES = ["Timeline", "Variants", "Manage", "Equity & sell", "Ledger"];

describe("OwningCalculator", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders a trigger for every owning-mode tab and switches content without crashing when each is clicked", async () => {
    const inputs = closedInputs();
    render(
      <OwningCalculator
        inputs={inputs}
        onChange={vi.fn()}
        household={DEFAULT_HOUSEHOLD}
        onHousingPaymentChange={vi.fn()}
      />,
    );

    for (const name of TAB_NAMES) {
      expect(screen.getByRole("tab", { name })).toBeInTheDocument();
    }

    for (const name of TAB_NAMES) {
      await userEvent.click(screen.getByRole("tab", { name }));
      expect(
        screen.getByRole("tab", { name, selected: true }),
      ).toBeInTheDocument();
    }
  });

  it("is caught by an ErrorBoundary instead of crashing the app when the fixture isn't actually closed", () => {
    // servicingContextFromInputs throws for a loan that fails isLoanClosed,
    // even though this satisfies the ClosedLoanInputs type at compile time.
    const invalidInputs = closedInputs({ closeDate: null, servicedTerm: null });

    render(
      <ErrorBoundary>
        <OwningCalculator
          inputs={invalidInputs}
          onChange={vi.fn()}
          household={DEFAULT_HOUSEHOLD}
          onHousingPaymentChange={vi.fn()}
        />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("reports the current housing payment via onHousingPaymentChange", () => {
    const inputs = closedInputs();
    const onHousingPaymentChange = vi.fn();
    render(
      <OwningCalculator
        inputs={inputs}
        onChange={vi.fn()}
        household={DEFAULT_HOUSEHOLD}
        onHousingPaymentChange={onHousingPaymentChange}
      />,
    );

    expect(onHousingPaymentChange).toHaveBeenCalled();
    const reported = onHousingPaymentChange.mock.calls.at(-1)?.[0];
    expect(typeof reported).toBe("number");
    expect(reported).toBeGreaterThan(0);
  });
});
