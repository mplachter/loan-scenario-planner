import { describe, expect, it } from "vitest";
import {
  budgetByCategory,
  budgetTotal,
  monthlyLeftover,
  monthlyTakeHomeIncome,
  PAY_PERIODS_PER_YEAR,
} from "./budget";
import {
  DEFAULT_HOUSEHOLD,
  type BudgetItem,
  type PayFrequency,
} from "./household";

describe("monthlyTakeHomeIncome", () => {
  const frequencies: PayFrequency[] = [
    "weekly",
    "biweekly",
    "semimonthly",
    "monthly",
  ];

  it.each(frequencies)(
    "converts a %s paycheck into a correct monthly average",
    (payFrequency) => {
      const household = {
        ...DEFAULT_HOUSEHOLD,
        payFrequency,
        netPayPerPaycheck: 2000,
        annualBonusNet: 0,
      };
      expect(monthlyTakeHomeIncome(household)).toBeCloseTo(
        (2000 * PAY_PERIODS_PER_YEAR[payFrequency]) / 12,
      );
    },
  );

  it("smooths an annual bonus evenly across all twelve months regardless of bonus month", () => {
    const withBonusInMarch = monthlyTakeHomeIncome({
      ...DEFAULT_HOUSEHOLD,
      payFrequency: "biweekly",
      netPayPerPaycheck: 2000,
      annualBonusNet: 12000,
      bonusMonth: 3,
    });
    const withBonusInDecember = monthlyTakeHomeIncome({
      ...DEFAULT_HOUSEHOLD,
      payFrequency: "biweekly",
      netPayPerPaycheck: 2000,
      annualBonusNet: 12000,
      bonusMonth: 12,
    });
    // The monthly average deliberately ignores which calendar month the
    // bonus lands in — that's only relevant once the bonus becomes a real
    // dated timeline event (Phase 8's "send to timeline").
    expect(withBonusInMarch).toBeCloseTo(withBonusInDecember);
    expect(withBonusInMarch).toBeGreaterThan(
      monthlyTakeHomeIncome({
        ...DEFAULT_HOUSEHOLD,
        payFrequency: "biweekly",
        netPayPerPaycheck: 2000,
        annualBonusNet: 0,
      }),
    );
  });
});

describe("budgetTotal and budgetByCategory", () => {
  const items: BudgetItem[] = [
    {
      id: "1",
      label: "Groceries",
      amount: 600,
      category: "needs",
      isCustom: false,
    },
    {
      id: "2",
      label: "Car payment",
      amount: 400,
      category: "needs",
      isCustom: false,
    },
    {
      id: "3",
      label: "Dining out",
      amount: 200,
      category: "wants",
      isCustom: true,
    },
    {
      id: "4",
      label: "Brokerage",
      amount: 300,
      category: "savings",
      isCustom: true,
    },
  ];

  it("sums a mix of starter and custom rows", () => {
    expect(budgetTotal(items)).toBe(1500);
  });

  it("buckets totals by category correctly", () => {
    expect(budgetByCategory(items)).toEqual({
      needs: 1000,
      wants: 200,
      savings: 300,
    });
  });

  it("returns zero totals for an empty budget", () => {
    expect(budgetTotal([])).toBe(0);
    expect(budgetByCategory([])).toEqual({ needs: 0, wants: 0, savings: 0 });
  });
});

describe("monthlyLeftover", () => {
  it("computes leftover as income minus budget minus housing", () => {
    const household = {
      ...DEFAULT_HOUSEHOLD,
      payFrequency: "monthly" as const,
      netPayPerPaycheck: 6000,
      annualBonusNet: 0,
      budgetItems: [
        {
          id: "1",
          label: "Groceries",
          amount: 600,
          category: "needs" as const,
          isCustom: false,
        },
      ],
    };
    const breakdown = monthlyLeftover(household, 2500);
    expect(breakdown.income).toBeCloseTo(6000);
    expect(breakdown.budgetTotal).toBe(600);
    expect(breakdown.housingPayment).toBe(2500);
    expect(breakdown.leftover).toBeCloseTo(2900);
  });

  it("goes negative without clamping when spending exceeds income, since that is a real and important signal", () => {
    const household = {
      ...DEFAULT_HOUSEHOLD,
      payFrequency: "monthly" as const,
      netPayPerPaycheck: 2000,
      annualBonusNet: 0,
      budgetItems: [
        {
          id: "1",
          label: "Everything",
          amount: 1000,
          category: "needs" as const,
          isCustom: false,
        },
      ],
    };
    const breakdown = monthlyLeftover(household, 3000);
    expect(breakdown.leftover).toBeLessThan(0);
    expect(breakdown.leftover).toBeCloseTo(2000 - 1000 - 3000);
  });
});
