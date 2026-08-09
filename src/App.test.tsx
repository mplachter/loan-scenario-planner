import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import App from "@/App";
import { DEFAULT_INPUTS, type LoanInputs } from "@/lib/defaults";
import { DEFAULT_HOUSEHOLD } from "@/lib/household";
import type { ScenarioStore } from "@/lib/scenarios";
import { closedInputs } from "@/test/servicingFixtures";

const STORAGE_KEY = "loan-scenario-planner:v1";

function createMemoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
}

function seedStore(inputs: LoanInputs, name = "My Home") {
  const store: ScenarioStore = {
    household: DEFAULT_HOUSEHOLD,
    scenarios: [
      {
        id: "scenario-1",
        name,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        inputs,
      },
    ],
    activeScenarioId: "scenario-1",
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

describe("App", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createMemoryStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows BuyingCalculator with no ModeSwitch for a fresh, unclosed scenario", () => {
    render(<App />);

    expect(screen.getByText(/Your payment/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Buying" }),
    ).not.toBeInTheDocument();
  });

  it("shows the ModeSwitch and defaults to OwningCalculator for a shopped-then-closed scenario, without unmounting the ScenarioBar", async () => {
    seedStore(closedInputs({ ownershipStatus: "shopping" }), "My Home");
    render(<App />);

    expect(screen.getByRole("button", { name: "My Home" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Buying" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Timeline" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Buying" }));

    expect(screen.getByText(/Your payment/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "My Home" })).toBeInTheDocument();
  });

  it("shows OwningCalculator with no ModeSwitch for an existing-owner closed scenario", () => {
    const existingInputs: LoanInputs = {
      ...DEFAULT_INPUTS,
      ownershipStatus: "existing",
      firstPaymentDate: "2020-05-01",
      servicedLoanAmount: 300000,
      servicedRate: 4.5,
      existingLoan: {
        currentBalance: 300000,
        currentRate: 4.5,
        remainingTermYears: 20,
        originalPurchasePrice: 400000,
        originalTermYears: 30,
        purchaseDate: "2018-05-01",
      },
    };
    seedStore(existingInputs, "Existing Home");
    render(<App />);

    expect(
      screen.queryByRole("button", { name: "Buying" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Timeline" })).toBeInTheDocument();
  });

  it("shows a persistent Budget entry point that swaps in the household Budget view without unmounting ScenarioBar", async () => {
    render(<App />);

    expect(
      screen.queryByRole("heading", { name: "Household budget" }),
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Budget" }));

    expect(
      screen.getByRole("heading", { name: "Household budget" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "New scenario" }),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "Back to scenario" }),
    );

    expect(
      screen.queryByRole("heading", { name: "Household budget" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/Your payment/)).toBeInTheDocument();
  });
});
