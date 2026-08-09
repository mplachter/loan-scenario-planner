import type {
  BudgetCategory,
  BudgetItem,
  Household,
  PayFrequency,
} from "./household";

export const PAY_PERIODS_PER_YEAR: Record<PayFrequency, number> = {
  weekly: 52,
  biweekly: 26,
  semimonthly: 24,
  monthly: 12,
};

// Paychecks only. An annual bonus is deliberately NOT folded in here: it lands
// once a year, and averaging it into every month overstates the cash actually
// available in the other eleven. Bonus money is surfaced separately via
// `monthlyBonusIfSpread` (discretionary) or sent to the loan as a dated
// timeline event (`bonusUse: "mortgage"`).
export function monthlyTakeHomeIncome(household: Household): number {
  const { payFrequency, netPayPerPaycheck } = household;
  return (netPayPerPaycheck * PAY_PERIODS_PER_YEAR[payFrequency]) / 12;
}

// The per-month value of a bonus the household plans to spread across the year.
// Zero when the bonus is earmarked for the mortgage — that money is a lump on
// the loan, not spendable monthly cash, and counting it both ways double-spends
// it.
export function monthlyBonusIfSpread(household: Household): number {
  return household.bonusUse === "spread" ? household.annualBonusNet / 12 : 0;
}

export function budgetTotal(items: BudgetItem[]): number {
  return items.reduce((sum, item) => sum + item.amount, 0);
}

export function budgetByCategory(
  items: BudgetItem[],
): Record<BudgetCategory, number> {
  const totals: Record<BudgetCategory, number> = {
    needs: 0,
    wants: 0,
    savings: 0,
  };
  for (const item of items) {
    totals[item.category] += item.amount;
  }
  return totals;
}

export interface LeftoverBreakdown {
  income: number;
  budgetTotal: number;
  housingPayment: number;
  // Leftover from paycheck income alone — the headline number, and the one
  // that has to clear zero every month.
  leftover: number;
  // `monthlyBonusIfSpread`, restated here so consumers don't have to reach for
  // the household again; 0 unless `bonusUse === "spread"`.
  bonusSpread: number;
  leftoverWithBonus: number;
}

export function monthlyLeftover(
  household: Household,
  housingPayment: number,
): LeftoverBreakdown {
  const income = monthlyTakeHomeIncome(household);
  const total = budgetTotal(household.budgetItems);
  const leftover = income - total - housingPayment;
  const bonusSpread = monthlyBonusIfSpread(household);
  return {
    income,
    budgetTotal: total,
    housingPayment,
    leftover,
    bonusSpread,
    leftoverWithBonus: leftover + bonusSpread,
  };
}
