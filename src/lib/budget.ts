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

export function monthlyTakeHomeIncome(household: Household): number {
  const { payFrequency, netPayPerPaycheck, annualBonusNet } = household;
  return (
    (netPayPerPaycheck * PAY_PERIODS_PER_YEAR[payFrequency] + annualBonusNet) /
    12
  );
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
  leftover: number;
}

export function monthlyLeftover(
  household: Household,
  housingPayment: number,
): LeftoverBreakdown {
  const income = monthlyTakeHomeIncome(household);
  const total = budgetTotal(household.budgetItems);
  return {
    income,
    budgetTotal: total,
    housingPayment,
    leftover: income - total - housingPayment,
  };
}
