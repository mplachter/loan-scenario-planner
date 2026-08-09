import { DEFAULT_INPUTS, type LoanInputs } from "@/lib/defaults";
import { DEFAULT_HOUSEHOLD, type Household } from "@/lib/household";

export interface Scenario {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  inputs: LoanInputs;
}

export interface ScenarioStore {
  household: Household;
  scenarios: Scenario[];
  activeScenarioId: string;
}

const STORAGE_KEY = "loan-scenario-planner:v1";

// Legacy shape: before household data moved to a store-level field, these 5
// keys lived on each scenario's `inputs`. Old localStorage payloads may still
// carry them even though `LoanInputs` no longer declares them.
const LEGACY_HOUSEHOLD_KEYS = [
  "payFrequency",
  "netPayPerPaycheck",
  "annualBonusNet",
  "bonusMonth",
  "budgetItems",
] as const;

type LegacyScenario = Scenario & {
  inputs: LoanInputs & Partial<Household>;
};

type RawStore = {
  scenarios?: LegacyScenario[];
  activeScenarioId?: string;
  household?: Partial<Household>;
};

function stripLegacyHousehold(
  inputs: LoanInputs & Partial<Household>,
): LoanInputs {
  const clean = { ...inputs };
  for (const key of LEGACY_HOUSEHOLD_KEYS) delete clean[key];
  return clean;
}

function legacyHouseholdFromFirstScenario(
  scenarios: LegacyScenario[],
): Partial<Household> {
  const inputs = scenarios[0].inputs;
  const legacy: Partial<Household> = {};
  for (const key of LEGACY_HOUSEHOLD_KEYS) {
    if (inputs[key] !== undefined) {
      (legacy as Record<string, unknown>)[key] = inputs[key];
    }
  }
  return legacy;
}

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
  return {
    household: structuredClone(DEFAULT_HOUSEHOLD),
    scenarios: [scenario],
    activeScenarioId: scenario.id,
  };
}

export function loadStore(): ScenarioStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return freshStore();
    const parsed = JSON.parse(raw) as RawStore;
    if (!parsed.scenarios || parsed.scenarios.length === 0) return freshStore();

    const household: Household = {
      ...DEFAULT_HOUSEHOLD,
      ...(parsed.household ??
        legacyHouseholdFromFirstScenario(parsed.scenarios)),
    };

    return {
      household,
      activeScenarioId: parsed.activeScenarioId ?? parsed.scenarios[0].id,
      scenarios: parsed.scenarios.map((s) => ({
        ...s,
        inputs: stripLegacyHousehold({ ...DEFAULT_INPUTS, ...s.inputs }),
      })),
    };
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
