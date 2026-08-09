import { describe, expect, it } from "vitest";
import {
  budgetByCategory,
  budgetTotal,
  monthlyBonusIfSpread,
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

  it("excludes an annual bonus entirely, whatever the household plans to do with it", () => {
    const base = {
      ...DEFAULT_HOUSEHOLD,
      payFrequency: "biweekly" as const,
      netPayPerPaycheck: 2000,
    };
    const noBonus = monthlyTakeHomeIncome({ ...base, annualBonusNet: 0 });
    // A once-a-year lump is never monthly income — not smoothed in, not
    // partially credited, regardless of `bonusUse`.
    for (const bonusUse of ["spread", "mortgage"] as const) {
      expect(
        monthlyTakeHomeIncome({ ...base, annualBonusNet: 12000, bonusUse }),
      ).toBeCloseTo(noBonus);
    }
  });
});

describe("monthlyBonusIfSpread", () => {
  it("divides the bonus across twelve months when it is spread", () => {
    expect(
      monthlyBonusIfSpread({
        ...DEFAULT_HOUSEHOLD,
        annualBonusNet: 12000,
        bonusUse: "spread",
      }),
    ).toBeCloseTo(1000);
  });

  it("is zero when the bonus is earmarked for the mortgage, so it can't be double-spent", () => {
    expect(
      monthlyBonusIfSpread({
        ...DEFAULT_HOUSEHOLD,
        annualBonusNet: 12000,
        bonusUse: "mortgage",
      }),
    ).toBe(0);
  });

  it("ignores the bonus month — spreading is a flat twelfth either way", () => {
    const march = monthlyBonusIfSpread({
      ...DEFAULT_HOUSEHOLD,
      annualBonusNet: 6000,
      bonusMonth: 3,
      bonusUse: "spread",
    });
    const december = monthlyBonusIfSpread({
      ...DEFAULT_HOUSEHOLD,
      annualBonusNet: 6000,
      bonusMonth: 12,
      bonusUse: "spread",
    });
    expect(march).toBeCloseTo(december);
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

  it("reports a spread bonus alongside leftover rather than inside it", () => {
    const household = {
      ...DEFAULT_HOUSEHOLD,
      payFrequency: "monthly" as const,
      netPayPerPaycheck: 6000,
      annualBonusNet: 12000,
      bonusUse: "spread" as const,
      budgetItems: [],
    };
    const breakdown = monthlyLeftover(household, 2500);
    expect(breakdown.income).toBeCloseTo(6000);
    expect(breakdown.leftover).toBeCloseTo(3500);
    expect(breakdown.bonusSpread).toBeCloseTo(1000);
    expect(breakdown.leftoverWithBonus).toBeCloseTo(4500);
  });

  it("leaves a mortgage-earmarked bonus out of both leftover figures", () => {
    const household = {
      ...DEFAULT_HOUSEHOLD,
      payFrequency: "monthly" as const,
      netPayPerPaycheck: 6000,
      annualBonusNet: 12000,
      bonusUse: "mortgage" as const,
      budgetItems: [],
    };
    const breakdown = monthlyLeftover(household, 2500);
    expect(breakdown.bonusSpread).toBe(0);
    expect(breakdown.leftoverWithBonus).toBeCloseTo(breakdown.leftover);
  });
});
