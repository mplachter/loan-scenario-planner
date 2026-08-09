import { useEffect, useMemo, useState } from "react";
import type { LoanInputs } from "@/lib/defaults";
import type { Household } from "@/lib/household";
import {
  createScenario,
  loadStore,
  saveStore,
  type Scenario,
  type ScenarioStore,
} from "@/lib/scenarios";

export function useScenarios() {
  const [store, setStore] = useState<ScenarioStore>(loadStore);

  useEffect(() => {
    saveStore(store);
  }, [store]);

  const activeScenario = useMemo(
    () =>
      store.scenarios.find((s) => s.id === store.activeScenarioId) ??
      store.scenarios[0],
    [store],
  );

  function updateActiveInputs(patch: Partial<LoanInputs>) {
    setStore((prev) => ({
      ...prev,
      scenarios: prev.scenarios.map((s) =>
        s.id === prev.activeScenarioId
          ? {
              ...s,
              inputs: { ...s.inputs, ...patch },
              updatedAt: new Date().toISOString(),
            }
          : s,
      ),
    }));
  }

  function updateHousehold(patch: Partial<Household>) {
    setStore((prev) => ({
      ...prev,
      household: { ...prev.household, ...patch },
    }));
  }

  function createScenarioAndActivate() {
    setStore((prev) => {
      const scenario = createScenario(`Scenario ${prev.scenarios.length + 1}`);
      return {
        ...prev,
        scenarios: [...prev.scenarios, scenario],
        activeScenarioId: scenario.id,
      };
    });
  }

  function renameScenario(id: string, name: string) {
    setStore((prev) => ({
      ...prev,
      scenarios: prev.scenarios.map((s) =>
        s.id === id ? { ...s, name, updatedAt: new Date().toISOString() } : s,
      ),
    }));
  }

  function deleteScenario(id: string) {
    setStore((prev) => {
      if (prev.scenarios.length === 1) {
        const scenario = createScenario("Scenario 1");
        return {
          ...prev,
          scenarios: [scenario],
          activeScenarioId: scenario.id,
        };
      }
      const scenarios = prev.scenarios.filter((s) => s.id !== id);
      const activeScenarioId =
        prev.activeScenarioId === id ? scenarios[0].id : prev.activeScenarioId;
      return { ...prev, scenarios, activeScenarioId };
    });
  }

  function selectScenario(id: string) {
    setStore((prev) => ({ ...prev, activeScenarioId: id }));
  }

  function duplicateScenario(id: string) {
    setStore((prev) => {
      const source = prev.scenarios.find((s) => s.id === id);
      if (!source) return prev;
      const now = new Date().toISOString();
      const copy: Scenario = {
        id: crypto.randomUUID(),
        name: `${source.name} copy`,
        createdAt: now,
        updatedAt: now,
        inputs: structuredClone(source.inputs),
      };
      return {
        ...prev,
        scenarios: [...prev.scenarios, copy],
        activeScenarioId: copy.id,
      };
    });
  }

  return {
    scenarios: store.scenarios,
    activeScenario: activeScenario as Scenario,
    household: store.household,
    updateHousehold,
    updateActiveInputs,
    createScenario: createScenarioAndActivate,
    renameScenario,
    deleteScenario,
    selectScenario,
    duplicateScenario,
  };
}
