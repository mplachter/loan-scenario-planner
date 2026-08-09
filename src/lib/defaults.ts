import type { MortgageEvent, TimelineVariant } from "./events";

export type LoanTerm = 15 | 20 | 25 | 30;

export const TERMS: LoanTerm[] = [15, 20, 25, 30];

export const TERM_COLORS: Record<LoanTerm, string> = {
  15: "#0f766e",
  20: "#0891b2",
  25: "#7c3aed",
  30: "#64748b",
};

export type ExtraMode =
  "none" | "match15" | "match20" | "match25" | "custom" | "buydownToPrincipal";

export type AppMode = "buying" | "owning";

export interface LoanInputs {
  purchasePrice: number;
  downPct: number;
  term: LoanTerm;
  rates: Record<LoanTerm, number>;
  buydown: boolean;
  points: number;
  propertyTax: number;
  hoaMonthly: number;
  insuranceAnnual: number;
  floodAnnual: number;
  includeFlood: boolean;
  extraMode: ExtraMode;
  customExtra: number;
  closingCostPct: number;
  earnestDeposit: number;
  escrowMonths: number;
  reserves: number;
  sellerCreditPct: number;
  buydownFundedBySeller: boolean;
  maxConcessionPct: number;
  holdYears: number;
  homeAppreciationPct: number;
  refiEnabled: boolean;
  refiYear: number;
  refiTerm: LoanTerm;
  refiRate: number;
  refiClosingCostPct: number;
  continueExtraAfterRefi: boolean;
  refiExtraOverride: number | null;
  gasMonthly: number;
  waterMonthly: number;
  electricMonthly: number;
  internetMonthly: number;
  tvMonthly: number;

  // --- lifecycle ---
  mode: AppMode;
  rateLocked: boolean;
  rateLockDate: string | null;
  rateLockExpiryDate: string | null;
  closeDate: string | null;
  firstPaymentDate: string | null;
  // snapshot of actual funded terms, written at close; null until then
  servicedLoanAmount: number | null;
  servicedRate: number | null;
  servicedTerm: LoanTerm | null;

  // --- owning timeline (Phase 2/3/4 populate these) ---
  events: MortgageEvent[];
  variants: TimelineVariant[];

  // --- escrow drift (Phase 5) ---
  escrowDriftEnabled: boolean;
  taxInflationPct: number;
  insuranceInflationPct: number;

  // --- sell analysis (Phase 5) ---
  sellingCostPct: number;

  // --- prepay vs invest (Phase 5) ---
  investReturnPct: number;
  investTaxRatePct: number;

  // --- lifted magic constant ---
  pmiRatePct: number;

  // --- existing-owner entry path (Phase 6) ---
  ownershipStatus: OwnershipStatus;
  existingLoan: ExistingLoan | null;

  // --- income & budget (Phase 7) ---
  // These fields describe the PERSON, not the property — they live here today
  // only because this is a single-property app. Do not key them off a
  // property/scenario id, and do not have the leftover calculation write its
  // result back onto a per-property field. See the plan's "Architecture for
  // future domains" section: if multi-property support is ever built, these
  // are the fields that move up to a store-level Household object.
  payFrequency: PayFrequency;
  netPayPerPaycheck: number;
  annualBonusNet: number; // take-home estimate of any bonus, not gross
  bonusMonth: number; // 1-indexed calendar month
  budgetItems: BudgetItem[];
}

export type OwnershipStatus = "shopping" | "existing";

export interface ExistingLoan {
  currentBalance: number;
  currentRate: number;
  remainingTermYears: number; // fractional allowed, e.g. 23.4
  originalPurchasePrice: number;
  originalTermYears: number; // for context/equity math only
  purchaseDate: string | null; // ISO, optional — informational
}

export type PayFrequency = "weekly" | "biweekly" | "semimonthly" | "monthly";
export type BudgetCategory = "needs" | "wants" | "savings";

export interface BudgetItem {
  id: string;
  label: string;
  amount: number;
  category: BudgetCategory;
  isCustom: boolean;
}

// Starter rows a new scenario ships with — editable and deletable like any
// custom row, except these are `isCustom: false` so they can be zeroed out
// but not removed (keeps the category populated with a sensible default).
// No default `savings`-category row: savings flows through the Phase 8
// waterfall, not a flat budget line, so a default row here would double-count.
export const STARTER_BUDGET_ITEMS: BudgetItem[] = [
  {
    id: "starter-groceries",
    label: "Groceries",
    amount: 600,
    category: "needs",
    isCustom: false,
  },
  {
    id: "starter-transportation",
    label: "Transportation / gas",
    amount: 200,
    category: "needs",
    isCustom: false,
  },
  {
    id: "starter-car-insurance",
    label: "Car insurance",
    amount: 150,
    category: "needs",
    isCustom: false,
  },
  {
    id: "starter-car-payment",
    label: "Car payment",
    amount: 0,
    category: "needs",
    isCustom: false,
  },
  {
    id: "starter-health",
    label: "Health / medical out-of-pocket",
    amount: 100,
    category: "needs",
    isCustom: false,
  },
  {
    id: "starter-subscriptions",
    label: "Subscriptions",
    amount: 50,
    category: "wants",
    isCustom: false,
  },
  {
    id: "starter-dining",
    label: "Dining out",
    amount: 200,
    category: "wants",
    isCustom: false,
  },
  {
    id: "starter-hobbies",
    label: "Hobbies & personal",
    amount: 150,
    category: "wants",
    isCustom: false,
  },
];

// A scenario is "closed" only when every field the Owning-mode engine needs is
// present. `closeDate` alone is not enough — the Closing tab lets you set a
// close date on its own just to see prepaid interest, long before you've
// actually closed. Anything that renders Owning mode must gate on this, not on
// `mode` or `closeDate`; `servicingContextFromInputs` throws otherwise.
//
// Two paths satisfy this: the normal Buying -> close flow (`closeDate` +
// `servicedTerm` set by `CloseLoanDialog`), and the existing-owner entry path
// (`ownershipStatus: "existing"` + `existingLoan`, set by
// `ExistingLoanSection` — `closeDate`/`servicedTerm` are not required there,
// since an existing loan was never shopped in this app and its remaining term
// may be fractional). `firstPaymentDate`/`servicedLoanAmount`/`servicedRate`
// are common to both paths.
export type ClosedLoanInputs = LoanInputs & {
  firstPaymentDate: string;
  servicedLoanAmount: number;
  servicedRate: number;
};

export function isLoanClosed(inputs: LoanInputs): inputs is ClosedLoanInputs {
  if (
    inputs.firstPaymentDate === null ||
    inputs.servicedLoanAmount === null ||
    inputs.servicedRate === null
  ) {
    return false;
  }
  if (inputs.ownershipStatus === "existing") {
    return inputs.existingLoan !== null;
  }
  return inputs.closeDate !== null && inputs.servicedTerm !== null;
}

export const DEFAULT_INPUTS: LoanInputs = {
  purchasePrice: 700000,
  downPct: 20,
  term: 30,
  rates: { 15: 5.9, 20: 6.3, 25: 6.4, 30: 6.6 },
  buydown: false,
  points: 0,
  propertyTax: 13300,
  hoaMonthly: 0,
  insuranceAnnual: 6000,
  floodAnnual: 1800,
  includeFlood: false,
  extraMode: "none",
  customExtra: 500,
  closingCostPct: 2.5,
  earnestDeposit: 0,
  escrowMonths: 3,
  reserves: 0,
  sellerCreditPct: 0,
  buydownFundedBySeller: true,
  maxConcessionPct: 6,
  holdYears: 5,
  homeAppreciationPct: 3.5,
  refiEnabled: false,
  refiYear: 5,
  refiTerm: 30,
  refiRate: 5.9,
  refiClosingCostPct: 2,
  continueExtraAfterRefi: true,
  refiExtraOverride: null,
  gasMonthly: 50,
  waterMonthly: 60,
  electricMonthly: 150,
  internetMonthly: 70,
  tvMonthly: 20,

  mode: "buying",
  rateLocked: false,
  rateLockDate: null,
  rateLockExpiryDate: null,
  closeDate: null,
  firstPaymentDate: null,
  servicedLoanAmount: null,
  servicedRate: null,
  servicedTerm: null,

  events: [],
  variants: [],

  escrowDriftEnabled: true,
  taxInflationPct: 3,
  insuranceInflationPct: 6,

  sellingCostPct: 7,

  investReturnPct: 7,
  investTaxRatePct: 15,

  pmiRatePct: 0.6,

  ownershipStatus: "shopping",
  existingLoan: null,

  payFrequency: "biweekly",
  netPayPerPaycheck: 0,
  annualBonusNet: 0,
  bonusMonth: 3,
  budgetItems: STARTER_BUDGET_ITEMS,
};
