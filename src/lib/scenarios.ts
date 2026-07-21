import { DEFAULT_INPUTS, type LoanInputs } from "@/lib/defaults";

export interface Scenario {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  inputs: LoanInputs;
}

export interface ScenarioStore {
  scenarios: Scenario[];
  activeScenarioId: string;
}

const STORAGE_KEY = "loan-scenario-planner:v1";

export function createScenario(name: string): Scenario {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name,
    createdAt: now,
    updatedAt: now,
    inputs: structuredClone(DEFAULT_INPUTS),
  };
}

function freshStore(): ScenarioStore {
  const scenario = createScenario("Scenario 1");
  return { scenarios: [scenario], activeScenarioId: scenario.id };
}

export function loadStore(): ScenarioStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return freshStore();
    const parsed = JSON.parse(raw) as ScenarioStore;
    if (!parsed.scenarios || parsed.scenarios.length === 0) return freshStore();
    return parsed;
  } catch {
    return freshStore();
  }
}

export function saveStore(store: ScenarioStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // non-critical enhancement; ignore quota/availability errors
  }
}
