import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_INPUTS } from "./defaults";
import { DEFAULT_HOUSEHOLD } from "./household";
import { loadStore } from "./scenarios";

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

describe("loadStore", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createMemoryStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("merges stored scenario inputs missing newer fields with DEFAULT_INPUTS", () => {
    const {
      continueExtraAfterRefi,
      refiExtraOverride,
      gasMonthly,
      homeAppreciationPct,
      ...legacyInputs
    } = DEFAULT_INPUTS;
    void continueExtraAfterRefi;
    void refiExtraOverride;
    void gasMonthly;
    void homeAppreciationPct;

    const legacyStore = {
      scenarios: [
        {
          id: "abc",
          name: "Scenario 1",
          createdAt: "2024-01-01T00:00:00.000Z",
          updatedAt: "2024-01-01T00:00:00.000Z",
          inputs: { ...legacyInputs, purchasePrice: 850000 },
        },
      ],
      activeScenarioId: "abc",
    };
    localStorage.setItem(
      "loan-scenario-planner:v1",
      JSON.stringify(legacyStore),
    );

    const loaded = loadStore();
    const scenario = loaded.scenarios[0];

    expect(scenario.inputs.continueExtraAfterRefi).toBe(
      DEFAULT_INPUTS.continueExtraAfterRefi,
    );
    expect(scenario.inputs.gasMonthly).toBe(DEFAULT_INPUTS.gasMonthly);
    expect(scenario.inputs.refiExtraOverride).toBe(
      DEFAULT_INPUTS.refiExtraOverride,
    );
    expect(scenario.inputs.homeAppreciationPct).toBe(
      DEFAULT_INPUTS.homeAppreciationPct,
    );
    expect(scenario.inputs.purchasePrice).toBe(850000);
  });

  it("seeds household with DEFAULT_HOUSEHOLD for a fresh/empty store", () => {
    const loaded = loadStore();
    expect(loaded.household).toEqual(DEFAULT_HOUSEHOLD);
  });

  it("seeds household from scenarios[0].inputs when no top-level household exists", () => {
    const legacyStore = {
      scenarios: [
        {
          id: "abc",
          name: "Scenario 1",
          createdAt: "2024-01-01T00:00:00.000Z",
          updatedAt: "2024-01-01T00:00:00.000Z",
          inputs: {
            ...DEFAULT_INPUTS,
            payFrequency: "monthly",
            netPayPerPaycheck: 5000,
            annualBonusNet: 2000,
            bonusMonth: 12,
            budgetItems: [
              {
                id: "custom-1",
                label: "Rent elsewhere",
                amount: 100,
                category: "needs" as const,
                isCustom: true,
              },
            ],
          },
        },
        {
          id: "def",
          name: "Scenario 2",
          createdAt: "2024-01-01T00:00:00.000Z",
          updatedAt: "2024-01-01T00:00:00.000Z",
          inputs: { ...DEFAULT_INPUTS, purchasePrice: 999999 },
        },
      ],
      activeScenarioId: "def",
    };
    localStorage.setItem(
      "loan-scenario-planner:v1",
      JSON.stringify(legacyStore),
    );

    const loaded = loadStore();

    expect(loaded.household.payFrequency).toBe("monthly");
    expect(loaded.household.netPayPerPaycheck).toBe(5000);
    expect(loaded.household.annualBonusNet).toBe(2000);
    expect(loaded.household.bonusMonth).toBe(12);
    expect(loaded.household.budgetItems).toEqual([
      {
        id: "custom-1",
        label: "Rent elsewhere",
        amount: 100,
        category: "needs",
        isCustom: true,
      },
    ]);
  });

  it("preserves an existing top-level household and ignores stray per-scenario budget fields", () => {
    const storedHousehold = {
      payFrequency: "weekly" as const,
      netPayPerPaycheck: 1234,
      annualBonusNet: 0,
      bonusMonth: 6,
      budgetItems: [],
    };
    const store = {
      household: storedHousehold,
      scenarios: [
        {
          id: "abc",
          name: "Scenario 1",
          createdAt: "2024-01-01T00:00:00.000Z",
          updatedAt: "2024-01-01T00:00:00.000Z",
          inputs: {
            ...DEFAULT_INPUTS,
            payFrequency: "monthly",
            netPayPerPaycheck: 9999,
          },
        },
      ],
      activeScenarioId: "abc",
    };
    localStorage.setItem("loan-scenario-planner:v1", JSON.stringify(store));

    const loaded = loadStore();

    expect(loaded.household).toMatchObject(storedHousehold);
    // Fields added after a payload was written fall back to the default
    // rather than landing as `undefined`.
    expect(loaded.household.bonusUse).toBe(DEFAULT_HOUSEHOLD.bonusUse);
  });

  it("strips legacy household keys off a loaded scenario's inputs", () => {
    const legacyStore = {
      scenarios: [
        {
          id: "abc",
          name: "Scenario 1",
          createdAt: "2024-01-01T00:00:00.000Z",
          updatedAt: "2024-01-01T00:00:00.000Z",
          inputs: {
            ...DEFAULT_INPUTS,
            payFrequency: "monthly",
            netPayPerPaycheck: 5000,
            annualBonusNet: 2000,
            bonusMonth: 12,
            budgetItems: [],
          },
        },
      ],
      activeScenarioId: "abc",
    };
    localStorage.setItem(
      "loan-scenario-planner:v1",
      JSON.stringify(legacyStore),
    );

    const loaded = loadStore();
    const scenario = loaded.scenarios[0];

    expect(scenario.inputs).not.toHaveProperty("payFrequency");
    expect(scenario.inputs).not.toHaveProperty("netPayPerPaycheck");
    expect(scenario.inputs).not.toHaveProperty("annualBonusNet");
    expect(scenario.inputs).not.toHaveProperty("bonusMonth");
    expect(scenario.inputs).not.toHaveProperty("budgetItems");
  });
});
