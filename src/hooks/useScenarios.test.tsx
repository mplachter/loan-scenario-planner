import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useScenarios } from "./useScenarios";

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

describe("useScenarios", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createMemoryStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts with one default scenario as the active scenario when localStorage is empty", () => {
    const { result } = renderHook(() => useScenarios());

    expect(result.current.scenarios).toHaveLength(1);
    expect(result.current.scenarios[0].name).toBe("Scenario 1");
    expect(result.current.activeScenario.id).toBe(
      result.current.scenarios[0].id,
    );
  });

  it("createScenario adds a new scenario named Scenario N and makes it active", () => {
    const { result } = renderHook(() => useScenarios());

    act(() => {
      result.current.createScenario();
    });

    expect(result.current.scenarios).toHaveLength(2);
    expect(result.current.scenarios[1].name).toBe("Scenario 2");
    expect(result.current.activeScenario.id).toBe(
      result.current.scenarios[1].id,
    );
  });

  it("renameScenario updates the target scenario's name without changing activeScenarioId", () => {
    const { result } = renderHook(() => useScenarios());
    const originalActiveId = result.current.activeScenario.id;
    const targetId = result.current.scenarios[0].id;

    act(() => {
      result.current.renameScenario(targetId, "My Dream House");
    });

    expect(result.current.scenarios[0].name).toBe("My Dream House");
    expect(result.current.activeScenario.id).toBe(originalActiveId);
  });

  it("updateActiveInputs shallow-merges into only the active scenario's inputs", () => {
    const { result } = renderHook(() => useScenarios());

    act(() => {
      result.current.createScenario();
    });
    const inactiveId = result.current.scenarios[0].id;
    const inactiveInputsBefore = result.current.scenarios[0].inputs;

    act(() => {
      result.current.updateActiveInputs({ purchasePrice: 999000 });
    });

    expect(result.current.activeScenario.inputs.purchasePrice).toBe(999000);
    const stillInactive = result.current.scenarios.find(
      (s) => s.id === inactiveId,
    )!;
    expect(stillInactive.inputs).toBe(inactiveInputsBefore);
  });

  it("duplicateScenario creates a deep-cloned copy named '<name> copy' and activates it", () => {
    const { result } = renderHook(() => useScenarios());
    const sourceId = result.current.scenarios[0].id;

    act(() => {
      result.current.duplicateScenario(sourceId);
    });

    expect(result.current.scenarios).toHaveLength(2);
    const copy = result.current.scenarios[1];
    expect(copy.name).toBe("Scenario 1 copy");
    expect(result.current.activeScenario.id).toBe(copy.id);

    act(() => {
      result.current.updateActiveInputs({ purchasePrice: 123456 });
    });

    const source = result.current.scenarios.find((s) => s.id === sourceId)!;
    expect(source.inputs.purchasePrice).not.toBe(123456);
  });

  it("deleteScenario on a non-last scenario removes it and re-points activeScenarioId if it was active", () => {
    const { result } = renderHook(() => useScenarios());
    const firstId = result.current.scenarios[0].id;

    act(() => {
      result.current.createScenario();
    });
    const secondId = result.current.scenarios[1].id;
    expect(result.current.activeScenario.id).toBe(secondId);

    act(() => {
      result.current.deleteScenario(secondId);
    });

    expect(result.current.scenarios).toHaveLength(1);
    expect(result.current.scenarios[0].id).toBe(firstId);
    expect(result.current.activeScenario.id).toBe(firstId);
  });

  it("deleteScenario on the last remaining scenario resets to a single fresh 'Scenario 1' instead of deleting", () => {
    const { result } = renderHook(() => useScenarios());
    const onlyId = result.current.scenarios[0].id;

    act(() => {
      result.current.updateActiveInputs({ purchasePrice: 777000 });
    });
    act(() => {
      result.current.deleteScenario(result.current.scenarios[0].id);
    });

    expect(result.current.scenarios).toHaveLength(1);
    expect(result.current.scenarios[0].name).toBe("Scenario 1");
    expect(result.current.scenarios[0].id).not.toBe(onlyId);
    expect(result.current.scenarios[0].inputs.purchasePrice).not.toBe(777000);
  });

  it("selectScenario changes the active scenario without mutating any scenario's data", () => {
    const { result } = renderHook(() => useScenarios());
    const firstId = result.current.scenarios[0].id;

    act(() => {
      result.current.createScenario();
    });
    const secondId = result.current.scenarios[1].id;
    const firstInputsBefore = result.current.scenarios[0].inputs;

    act(() => {
      result.current.selectScenario(firstId);
    });

    expect(result.current.activeScenario.id).toBe(firstId);
    expect(result.current.scenarios[0].inputs).toBe(firstInputsBefore);
    expect(result.current.scenarios[1].id).toBe(secondId);
  });

  it("persists changes across a hook remount via the same stubbed localStorage", () => {
    const first = renderHook(() => useScenarios());

    act(() => {
      first.result.current.updateActiveInputs({ purchasePrice: 654321 });
    });

    const second = renderHook(() => useScenarios());

    expect(second.result.current.activeScenario.inputs.purchasePrice).toBe(
      654321,
    );
  });

  it("updateHousehold shallow-merges into store.household", () => {
    const { result } = renderHook(() => useScenarios());

    act(() => {
      result.current.updateHousehold({ netPayPerPaycheck: 3000 });
    });

    expect(result.current.household.netPayPerPaycheck).toBe(3000);
    expect(result.current.household.payFrequency).toBe("biweekly");
  });

  it("createScenario and duplicateScenario leave household untouched", () => {
    const { result } = renderHook(() => useScenarios());
    const householdBefore = result.current.household;

    act(() => {
      result.current.createScenario();
    });
    expect(result.current.household).toBe(householdBefore);

    const sourceId = result.current.scenarios[0].id;
    act(() => {
      result.current.duplicateScenario(sourceId);
    });
    expect(result.current.household).toBe(householdBefore);
  });
});
