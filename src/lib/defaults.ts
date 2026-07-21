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

export interface LoanInputs {
  purchasePrice: number;
  downPct: number;
  term: LoanTerm;
  rates: Record<LoanTerm, number>;
  buydown: boolean;
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
}

export const DEFAULT_INPUTS: LoanInputs = {
  purchasePrice: 700000,
  downPct: 20,
  term: 30,
  rates: { 15: 5.9, 20: 6.3, 25: 6.4, 30: 6.6 },
  buydown: false,
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
};
