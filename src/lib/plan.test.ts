import { describe, expect, it } from "vitest";
import { DEFAULT_INPUTS } from "./defaults";
import { computeMortgagePlan, maximizeEquityAtSale } from "./plan";

describe("computeMortgagePlan", () => {
  it("computes loan amount as purchase price minus down payment", () => {
    const plan = computeMortgagePlan(DEFAULT_INPUTS);
    const downPayment =
      (DEFAULT_INPUTS.purchasePrice * DEFAULT_INPUTS.downPct) / 100;
    expect(plan.loanAmount).toBe(DEFAULT_INPUTS.purchasePrice - downPayment);
  });

  it("charges PMI only when down payment is below 20%", () => {
    const withPmi = computeMortgagePlan({ ...DEFAULT_INPUTS, downPct: 10 });
    expect(withPmi.pmiAnnual).toBeGreaterThan(0);

    const withoutPmi = computeMortgagePlan({ ...DEFAULT_INPUTS, downPct: 20 });
    expect(withoutPmi.pmiAnnual).toBe(0);
  });

  it("continuing extra payments after refi shortens the refi and lowers its interest", () => {
    const base = {
      ...DEFAULT_INPUTS,
      extraMode: "custom" as const,
      customExtra: 300,
      refiEnabled: true,
      refiYear: 5,
    };
    const withContinued = computeMortgagePlan({
      ...base,
      continueExtraAfterRefi: true,
    });
    const withoutContinued = computeMortgagePlan({
      ...base,
      continueExtraAfterRefi: false,
    });
    expect(withContinued.refiPlan).not.toBeNull();
    expect(withoutContinued.refiPlan).not.toBeNull();
    expect(withContinued.refiPlan!.payoffMonths).toBeLessThan(
      withoutContinued.refiPlan!.payoffMonths,
    );
    expect(withContinued.refiPlan!.totalInterest).toBeLessThan(
      withoutContinued.refiPlan!.totalInterest,
    );
  });

  it("refiExtraOverride replaces extraSteady as the continued extra amount", () => {
    const base = {
      ...DEFAULT_INPUTS,
      extraMode: "custom" as const,
      customExtra: 200,
      refiEnabled: true,
      refiYear: 5,
      continueExtraAfterRefi: true,
    };
    const auto = computeMortgagePlan({ ...base, refiExtraOverride: null });
    const overridden = computeMortgagePlan({
      ...base,
      refiExtraOverride: 800,
    });
    expect(auto.refiPlan!.continuedExtra).toBe(auto.extraSteady);
    expect(overridden.refiPlan!.continuedExtra).toBe(800);
    expect(overridden.refiPlan!.payoffMonths).toBeLessThan(
      auto.refiPlan!.payoffMonths,
    );
  });

  it("refiExtraOverride is ignored when continueExtraAfterRefi is off", () => {
    const plan = computeMortgagePlan({
      ...DEFAULT_INPUTS,
      extraMode: "custom",
      customExtra: 200,
      refiEnabled: true,
      refiYear: 5,
      continueExtraAfterRefi: false,
      refiExtraOverride: 800,
    });
    expect(plan.refiPlan!.continuedExtra).toBe(0);
  });

  it("refiPlan.baseBalances tracks a P&I-only amortization, distinct from the continued-extra balances", () => {
    const plan = computeMortgagePlan({
      ...DEFAULT_INPUTS,
      extraMode: "custom",
      customExtra: 500,
      refiEnabled: true,
      refiYear: 5,
      continueExtraAfterRefi: true,
    });
    expect(plan.refiPlan).not.toBeNull();
    expect(plan.refiPlan!.basePayoffMonths).toBeGreaterThan(
      plan.refiPlan!.payoffMonths,
    );
    expect(plan.refiPlan!.baseTotalInterest).toBeGreaterThan(
      plan.refiPlan!.totalInterest,
    );
    expect(plan.refiPlan!.baseBalances[0]).toBe(plan.refiPlan!.balances[0]);
  });

  it("chartData exposes a refiBase series only when continued extra is active", () => {
    const withExtra = computeMortgagePlan({
      ...DEFAULT_INPUTS,
      extraMode: "custom",
      customExtra: 500,
      refiEnabled: true,
      refiYear: 5,
      continueExtraAfterRefi: true,
    });
    const rowWithExtra = withExtra.chartData.find((r) => r.year === 5);
    expect(rowWithExtra!.refiBase).toBe(withExtra.refiPlan!.baseBalances[0]);

    const laterRow = withExtra.chartData.find((r) => r.year === 8);
    expect(laterRow!.refiBase).toBeGreaterThan(laterRow!.refi!);

    const noExtra = computeMortgagePlan({
      ...DEFAULT_INPUTS,
      refiEnabled: true,
      refiYear: 5,
      continueExtraAfterRefi: false,
    });
    const rowNoExtra = noExtra.chartData.find((r) => r.year === 5);
    expect(rowNoExtra!.refiBase).toBeUndefined();
  });

  it("refiPlan.totalMonthly is payment + baseMonthlyCosts + continuedExtra", () => {
    const plan = computeMortgagePlan({
      ...DEFAULT_INPUTS,
      extraMode: "custom",
      customExtra: 300,
      refiEnabled: true,
      refiYear: 5,
      continueExtraAfterRefi: true,
    });
    expect(plan.refiPlan).not.toBeNull();
    expect(plan.refiPlan!.totalMonthly).toBeCloseTo(
      plan.refiPlan!.payment +
        plan.baseMonthlyCosts +
        plan.refiPlan!.continuedExtra,
    );
  });

  it("chart join-point switches to the refi balance exactly at refiYear", () => {
    const plan = computeMortgagePlan({
      ...DEFAULT_INPUTS,
      refiEnabled: true,
      refiYear: 5,
    });
    const row = plan.chartData.find((r) => r.year === DEFAULT_INPUTS.refiYear);
    expect(row).toBeDefined();
    expect(row!.refi).toBe(plan.refiPlan!.balances[0]);
  });

  it("effective combined-plan fields fall back to extra-only fields when there's no refi", () => {
    const plan = computeMortgagePlan({ ...DEFAULT_INPUTS, refiEnabled: false });
    expect(plan.effectiveTotalInterest).toBe(plan.accelerated.totalInterest);
    expect(plan.effectivePayoffMonths).toBe(plan.accelerated.months);
  });

  it("utilities fold into the monthly payment", () => {
    const withUtilities = computeMortgagePlan(DEFAULT_INPUTS);
    expect(withUtilities.monthlyUtilities).toBe(
      DEFAULT_INPUTS.gasMonthly +
        DEFAULT_INPUTS.waterMonthly +
        DEFAULT_INPUTS.electricMonthly +
        DEFAULT_INPUTS.internetMonthly +
        DEFAULT_INPUTS.tvMonthly,
    );

    const noUtilities = computeMortgagePlan({
      ...DEFAULT_INPUTS,
      gasMonthly: 0,
      waterMonthly: 0,
      electricMonthly: 0,
      internetMonthly: 0,
      tvMonthly: 0,
    });
    expect(withUtilities.totalMonthlySteadyState).toBeCloseTo(
      noUtilities.totalMonthlySteadyState + withUtilities.monthlyUtilities,
    );
  });

  it("appreciation compounds annually on homeValueAtSale", () => {
    const plan = computeMortgagePlan({
      ...DEFAULT_INPUTS,
      holdYears: 5,
      homeAppreciationPct: 4,
    });
    expect(plan.homeValueAtSale).toBeCloseTo(
      DEFAULT_INPUTS.purchasePrice * Math.pow(1.04, 5),
    );
  });

  it("equityAtSale respects extra payments", () => {
    const withExtra = computeMortgagePlan({
      ...DEFAULT_INPUTS,
      extraMode: "custom",
      customExtra: 500,
      holdYears: 5,
      homeAppreciationPct: 3.5,
    });
    const withoutExtra = computeMortgagePlan({
      ...DEFAULT_INPUTS,
      extraMode: "none",
      holdYears: 5,
      homeAppreciationPct: 3.5,
    });
    expect(withExtra.loanBalanceAtSale).toBeLessThan(
      withoutExtra.loanBalanceAtSale,
    );
    expect(withExtra.equityAtSale).toBeGreaterThan(withoutExtra.equityAtSale);
  });

  it("equityAtSale respects an active refi", () => {
    const plan = computeMortgagePlan({
      ...DEFAULT_INPUTS,
      refiEnabled: true,
      refiYear: 3,
      holdYears: 5,
    });
    expect(plan.refiPlan).not.toBeNull();
    const expected =
      plan.refiPlan!.balances[
        Math.min((5 - 3) * 12, plan.refiPlan!.balances.length - 1)
      ];
    expect(plan.loanBalanceAtSale).toBe(expected);
  });

  it("equityChartData year 0 equals the down payment", () => {
    const plan = computeMortgagePlan(DEFAULT_INPUTS);
    expect(plan.equityChartData[0].equity).toBeCloseTo(plan.downPayment);
  });

  it("equityChartData covers at least the hold period", () => {
    const plan = computeMortgagePlan({
      ...DEFAULT_INPUTS,
      term: 15,
      extraMode: "custom",
      customExtra: 2000,
      holdYears: 20,
    });
    const row = plan.equityChartData.find((r) => r.year === 20);
    expect(row).toBeDefined();
    expect(row!.balance).toBe(0);
    expect(row!.equity).toBeCloseTo(row!.homeValue);
  });
});

describe("maximizeEquityAtSale", () => {
  it("recommends less than the full budget when the budget is more than enough", () => {
    const result = maximizeEquityAtSale(
      { ...DEFAULT_INPUTS, term: 15, holdYears: 20 },
      2000,
    );
    expect(result.fullyPaidOff).toBe(true);
    expect(result.balanceAtSale).toBe(0);
    expect(result.recommendedExtra).toBeLessThan(2000);
  });

  it("recommends the full budget when it's not enough", () => {
    const result = maximizeEquityAtSale(
      { ...DEFAULT_INPUTS, holdYears: 5 },
      50,
    );
    expect(result.recommendedExtra).toBe(50);
    expect(result.fullyPaidOff).toBe(false);
    expect(result.balanceAtSale).toBeGreaterThan(0);
  });

  it("respects an already-enabled refi", () => {
    const result = maximizeEquityAtSale(
      {
        ...DEFAULT_INPUTS,
        refiEnabled: true,
        refiYear: 3,
        holdYears: 10,
      },
      10000,
    );
    expect(result.fullyPaidOff).toBe(true);
    expect(result.balanceAtSale).toBe(0);
  });
});
