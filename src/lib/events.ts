import type { LoanTerm } from "./defaults";

// Kept as a plain string union, not a class hierarchy, per plan.ts's "no abstraction
// layers" convention. It is meant to grow — a future "rateAdjustment" kind for ARM
// resets would slot in here and into the "apply refinance-like events" simulation
// step with no restructuring. See the plan's "Architecture for future domains"
// section for why.
export type MortgageEventKind =
  "refinance" | "extra" | "lump" | "recast" | "escrow";

interface BaseEvent {
  id: string;
  kind: MortgageEventKind;
  month: number;
  enabled: boolean;
  note?: string;
}

export interface RefinanceEvent extends BaseEvent {
  kind: "refinance";
  rate: number;
  termYears: LoanTerm;
  closingCostPct: number; // of payoff balance
  closingCostFlat: number; // $
  rollCostsIn: boolean; // true = added to new balance, false = out of pocket
  cashOut: number; // $ added to new balance
}

export interface RecurringExtraEvent extends BaseEvent {
  kind: "extra";
  amount: number;
  cadence: "monthly" | "annual";
  endMonth: number | null;
}

export interface LumpSumEvent extends BaseEvent {
  kind: "lump";
  amount: number;
}

export interface RecastEvent extends BaseEvent {
  kind: "recast";
  lumpSum: number;
  fee: number;
}

export interface EscrowChangeEvent extends BaseEvent {
  kind: "escrow";
  taxAnnual: number | null;
  insuranceAnnual: number | null;
}

export type MortgageEvent =
  | RefinanceEvent
  | RecurringExtraEvent
  | LumpSumEvent
  | RecastEvent
  | EscrowChangeEvent;

export interface TimelineVariant {
  id: string;
  name: string;
  events: MortgageEvent[];
}

// Order-independent identity for a timeline: event array order and key insertion
// order both drift as the UI patches events (`{ ...e, ...patch }`), so both are
// normalized away before comparing. Used to tell whether the current timeline
// still matches the saved variant it was loaded from.
function timelineKey(events: MortgageEvent[]): string {
  return JSON.stringify(
    [...events]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((e) =>
        Object.fromEntries(
          Object.entries(e).sort(([a], [b]) => a.localeCompare(b)),
        ),
      ),
  );
}

export function eventsEqual(a: MortgageEvent[], b: MortgageEvent[]): boolean {
  return a.length === b.length && timelineKey(a) === timelineKey(b);
}

export const EVENT_LABELS: Record<MortgageEventKind, string> = {
  refinance: "Refinance",
  extra: "Recurring extra",
  lump: "Lump sum",
  recast: "Recast",
  escrow: "Escrow change",
};

export const EVENT_COLORS: Record<MortgageEventKind, string> = {
  refinance: "#c026d3",
  extra: "#0f766e",
  lump: "#0891b2",
  recast: "#7c3aed",
  escrow: "#64748b",
};

function newId(): string {
  return crypto.randomUUID();
}

export function createRefinanceEvent(
  month: number,
  partial?: Partial<RefinanceEvent>,
): RefinanceEvent {
  return {
    id: newId(),
    kind: "refinance",
    month,
    enabled: true,
    rate: 5.9,
    termYears: 30,
    closingCostPct: 2,
    closingCostFlat: 0,
    rollCostsIn: true,
    cashOut: 0,
    ...partial,
  };
}

export function createRecurringExtraEvent(
  month: number,
  partial?: Partial<RecurringExtraEvent>,
): RecurringExtraEvent {
  return {
    id: newId(),
    kind: "extra",
    month,
    enabled: true,
    amount: 500,
    cadence: "monthly",
    endMonth: null,
    ...partial,
  };
}

export function createLumpSumEvent(
  month: number,
  partial?: Partial<LumpSumEvent>,
): LumpSumEvent {
  return {
    id: newId(),
    kind: "lump",
    month,
    enabled: true,
    amount: 10000,
    ...partial,
  };
}

export function createRecastEvent(
  month: number,
  partial?: Partial<RecastEvent>,
): RecastEvent {
  return {
    id: newId(),
    kind: "recast",
    month,
    enabled: true,
    lumpSum: 10000,
    fee: 250,
    ...partial,
  };
}

export function createEscrowChangeEvent(
  month: number,
  partial?: Partial<EscrowChangeEvent>,
): EscrowChangeEvent {
  return {
    id: newId(),
    kind: "escrow",
    month,
    enabled: true,
    taxAnnual: null,
    insuranceAnnual: null,
    ...partial,
  };
}
