import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_INPUTS } from "./defaults";
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
      ...legacyInputs
    } = DEFAULT_INPUTS;
    void continueExtraAfterRefi;
    void refiExtraOverride;
    void gasMonthly;

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
    expect(scenario.inputs.purchasePrice).toBe(850000);
  });
});
