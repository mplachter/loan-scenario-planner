import { describe, expect, it } from "vitest";
import { DEFAULT_INPUTS, TERMS } from "./defaults";
import { amortize, pmt } from "./mortgage";
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

describe("match-N extra-payment modes and matchCompare", () => {
  it("match15 with term=30 computes extra needed to pay off like a direct 15yr loan", () => {
    const plan = computeMortgagePlan({
      ...DEFAULT_INPUTS,
      term: 30,
      extraMode: "match15",
    });
    expect(plan.matchCompare).not.toBeNull();
    expect(plan.matchCompare!.matchTerm).toBe(15);
    expect(plan.matchCompare!.directRate).toBe(DEFAULT_INPUTS.rates[15]);
    expect(plan.extraMonthly).toBeGreaterThan(0);
    expect(plan.accelerated.months).toBeLessThan(plan.baseline.months);
  });

  it("match20 and match25 populate matchCompare with the corresponding matchTerm", () => {
    const plan20 = computeMortgagePlan({
      ...DEFAULT_INPUTS,
      term: 30,
      extraMode: "match20",
    });
    expect(plan20.matchCompare!.matchTerm).toBe(20);
    const plan25 = computeMortgagePlan({
      ...DEFAULT_INPUTS,
      term: 30,
      extraMode: "match25",
    });
    expect(plan25.matchCompare!.matchTerm).toBe(25);
  });

  it("plan.ts does not gate matchCompare on term > N — extraMonthly stays 0 if the mode is set on an invalid (too-short) term", () => {
    const invalid = computeMortgagePlan({
      ...DEFAULT_INPUTS,
      term: 15,
      extraMode: "match15",
    });
    expect(invalid.matchCompare).not.toBeNull();
    expect(invalid.extraMonthly).toBe(0);
    expect(invalid.accelerated.months).toBe(invalid.baseline.months);
  });

  it("matchCompare's interestDelta is positive when the direct-term rate is cheaper than the current note rate", () => {
    // DEFAULT_INPUTS: 15yr rate (5.9%) < 30yr rate (6.6%), so paying like a 15yr
    // on the pricier 30yr note costs strictly more interest than a real 15yr loan.
    const plan = computeMortgagePlan({
      ...DEFAULT_INPUTS,
      term: 30,
      extraMode: "match15",
    });
    expect(plan.matchCompare!.interestDelta).toBeGreaterThan(0);
    expect(plan.matchCompare!.monthsDelta).toBe(0);
  });

  it("matchCompare is null for none/custom/buydownToPrincipal modes", () => {
    expect(
      computeMortgagePlan({ ...DEFAULT_INPUTS, extraMode: "none" })
        .matchCompare,
    ).toBeNull();
    expect(
      computeMortgagePlan({
        ...DEFAULT_INPUTS,
        extraMode: "custom",
        customExtra: 200,
      }).matchCompare,
    ).toBeNull();
  });
});

describe("2-1 buydown", () => {
  it("y1Payment/y2Payment are computed at rate-2/rate-1, cheaper than y2, cheaper than standardPI", () => {
    const plan = computeMortgagePlan({ ...DEFAULT_INPUTS, buydown: true });
    const rate = DEFAULT_INPUTS.rates[DEFAULT_INPUTS.term];
    expect(plan.y1Payment).toBeCloseTo(
      pmt(plan.loanAmount, rate - 2, DEFAULT_INPUTS.term),
    );
    expect(plan.y2Payment).toBeCloseTo(
      pmt(plan.loanAmount, rate - 1, DEFAULT_INPUTS.term),
    );
    expect(plan.y1Payment).toBeLessThan(plan.y2Payment);
    expect(plan.y2Payment).toBeLessThan(plan.standardPI);
  });

  it("floors the buydown rate at 0.25% instead of going to zero/negative", () => {
    const plan = computeMortgagePlan({
      ...DEFAULT_INPUTS,
      buydown: true,
      term: 30,
      rates: { ...DEFAULT_INPUTS.rates, 30: 1.5 }, // rate-2 would be -0.5%
    });
    expect(plan.y1Payment).toBeCloseTo(pmt(plan.loanAmount, 0.25, 30));
    expect(plan.y1Payment).not.toBeCloseTo(pmt(plan.loanAmount, -0.5, 30), 0);
  });

  it("buydownSubsidy is 0 when off, and 12*(standardPI-y1)+12*(standardPI-y2) when on", () => {
    expect(
      computeMortgagePlan({ ...DEFAULT_INPUTS, buydown: false }).buydownSubsidy,
    ).toBe(0);
    const on = computeMortgagePlan({ ...DEFAULT_INPUTS, buydown: true });
    expect(on.buydownSubsidy).toBeCloseTo(
      12 * (on.standardPI - on.y1Payment) + 12 * (on.standardPI - on.y2Payment),
    );
    expect(on.buydownSubsidy).toBeGreaterThan(0);
  });

  it("buydownToPrincipal routes yr1/yr2 payment savings into extra principal, then drops to 0 in yr3+", () => {
    const plan = computeMortgagePlan({
      ...DEFAULT_INPUTS,
      buydown: true,
      extraMode: "buydownToPrincipal",
    });
    expect(plan.extraY1).toBeCloseTo(plan.standardPI - plan.y1Payment);
    expect(plan.extraY2).toBeCloseTo(plan.standardPI - plan.y2Payment);
    expect(plan.extraSteady).toBe(0);
    expect(plan.accelerated.months).toBeLessThan(plan.baseline.months);
  });

  it("buydownToPrincipal is inert when buydown is off", () => {
    const plan = computeMortgagePlan({
      ...DEFAULT_INPUTS,
      buydown: false,
      extraMode: "buydownToPrincipal",
    });
    expect(plan.extraY1).toBe(0);
    expect(plan.accelerated.months).toBe(plan.baseline.months);
  });
});

describe("closing costs and seller-credit waterfall", () => {
  it("computes closingCosts, prepaids, and closingNeed from raw inputs", () => {
    const plan = computeMortgagePlan({
      ...DEFAULT_INPUTS,
      purchasePrice: 500000,
      closingCostPct: 3,
      escrowMonths: 2,
      propertyTax: 12000,
      insuranceAnnual: 6000,
      includeFlood: false,
    });
    expect(plan.closingCosts).toBe(15000);
    expect(plan.prepaids).toBeCloseTo(3000); // (1000+500)*2
    expect(plan.closingNeed).toBeCloseTo(18000);
  });

  it("applies seller credit to closing costs first, then buydown, then wastes the remainder (strict order)", () => {
    const plan = computeMortgagePlan({
      ...DEFAULT_INPUTS,
      purchasePrice: 500000,
      closingCostPct: 2,
      escrowMonths: 0,
      sellerCreditPct: 5,
      buydown: true,
      buydownFundedBySeller: true,
    });
    expect(plan.closingNeed).toBeCloseTo(10000);
    expect(plan.sellerCreditAmount).toBeCloseTo(25000);
    expect(plan.appliedToClosing).toBeCloseTo(10000);
    expect(plan.poolAfterClosing).toBeCloseTo(15000);
    expect(plan.buydownNeed).toBeCloseTo(plan.buydownSubsidy);
    expect(plan.appliedToBuydown).toBeCloseTo(
      Math.min(15000, plan.buydownSubsidy),
    );
    expect(plan.sellerCreditWasted).toBeCloseTo(
      Math.max(25000 - 10000 - plan.buydownSubsidy, 0),
    );
  });

  it("sellerCreditWasted is the full excess when there's no buydown to absorb it", () => {
    const plan = computeMortgagePlan({
      ...DEFAULT_INPUTS,
      purchasePrice: 500000,
      closingCostPct: 1,
      escrowMonths: 0,
      sellerCreditPct: 10,
      buydown: false,
    });
    expect(plan.appliedToClosing).toBeCloseTo(5000);
    expect(plan.buydownNeed).toBe(0);
    expect(plan.sellerCreditWasted).toBeCloseTo(45000);
    expect(plan.maxUsableSellerCredit).toBeCloseTo(5000);
  });

  it("buydownCostToBuyer is the full subsidy when the buyer funds it, or the shortfall when seller credit under-covers it", () => {
    const buyerFunded = computeMortgagePlan({
      ...DEFAULT_INPUTS,
      buydown: true,
      buydownFundedBySeller: false,
      sellerCreditPct: 0,
    });
    expect(buyerFunded.buydownCostToBuyer).toBeCloseTo(
      buyerFunded.buydownSubsidy,
    );
    expect(buyerFunded.buydownShortfall).toBe(0);

    const sellerShort = computeMortgagePlan({
      ...DEFAULT_INPUTS,
      purchasePrice: 500000,
      closingCostPct: 2,
      escrowMonths: 0,
      sellerCreditPct: 2.5, // pool after closing = 2500
      buydown: true,
      buydownFundedBySeller: true,
    });
    expect(sellerShort.appliedToBuydown).toBeCloseTo(
      Math.min(2500, sellerShort.buydownSubsidy),
    );
    expect(sellerShort.buydownShortfall).toBeCloseTo(
      Math.max(sellerShort.buydownSubsidy - sellerShort.appliedToBuydown, 0),
    );
    expect(sellerShort.buydownCostToBuyer).toBeCloseTo(
      sellerShort.buydownShortfall,
    );
  });

  it("cashToClose = downPayment + closingCosts + prepaids - earnestDeposit - appliedToClosing + buydownCostToBuyer", () => {
    const plan = computeMortgagePlan({
      ...DEFAULT_INPUTS,
      purchasePrice: 500000,
      downPct: 20,
      closingCostPct: 2,
      escrowMonths: 2,
      earnestDeposit: 3000,
      sellerCreditPct: 1,
    });
    expect(plan.cashToClose).toBeCloseTo(
      plan.downPayment +
        plan.closingCosts +
        plan.prepaids -
        3000 -
        plan.appliedToClosing +
        plan.buydownCostToBuyer,
    );
  });

  it("remainingAfterClose is reserves minus cashToClose and can go negative", () => {
    const plan = computeMortgagePlan({ ...DEFAULT_INPUTS, reserves: 1000 });
    expect(plan.remainingAfterClose).toBeCloseTo(1000 - plan.cashToClose);
    expect(plan.remainingAfterClose).toBeLessThan(0);
  });
});

describe("LTV-based seller concession cap", () => {
  it("downPct=25 -> ltv=75 (boundary, inclusive) -> 9% tier", () => {
    const plan = computeMortgagePlan({ ...DEFAULT_INPUTS, downPct: 25 });
    expect(plan.ltv).toBe(75);
    expect(plan.ltvBasedConcessionPct).toBe(9);
  });

  it("downPct=10 -> ltv=90 (boundary, inclusive) -> 6% tier", () => {
    const plan = computeMortgagePlan({ ...DEFAULT_INPUTS, downPct: 10 });
    expect(plan.ltv).toBe(90);
    expect(plan.ltvBasedConcessionPct).toBe(6);
  });

  it("downPct=9.5 -> ltv=90.5 (just past the boundary) -> 3% tier", () => {
    const plan = computeMortgagePlan({ ...DEFAULT_INPUTS, downPct: 9.5 });
    expect(plan.ltv).toBeCloseTo(90.5);
    expect(plan.ltvBasedConcessionPct).toBe(3);
  });

  it("sellerCreditExceedsCap flags when appliedToClosing+appliedToBuydown exceeds maxConcessionAmount", () => {
    const overCap = computeMortgagePlan({
      ...DEFAULT_INPUTS,
      purchasePrice: 500000,
      closingCostPct: 2,
      escrowMonths: 0,
      sellerCreditPct: 6,
      maxConcessionPct: 1,
    });
    expect(overCap.sellerCreditExceedsCap).toBe(true);

    const underCap = computeMortgagePlan({
      ...DEFAULT_INPUTS,
      sellerCreditPct: 0,
      maxConcessionPct: 6,
    });
    expect(underCap.sellerCreditExceedsCap).toBe(false);
  });
});

describe("Compare-tab data model (termData)", () => {
  it("termData re-amortizes the same loanAmount at all 4 TERMS with extra=0, ignoring the active extraMode", () => {
    const plan = computeMortgagePlan({
      ...DEFAULT_INPUTS,
      term: 30,
      extraMode: "custom",
      customExtra: 500,
    });
    expect(plan.termData).toHaveLength(4);
    plan.termData.forEach((d) => {
      const direct = amortize(plan.loanAmount, d.rate, d.term, 0);
      expect(d.totalInterest).toBeCloseTo(direct.totalInterest);
      expect(d.payment).toBeCloseTo(direct.payment);
    });
    const t30Row = plan.termData.find((d) => d.term === 30)!;
    expect(t30Row.totalInterest).toBeGreaterThan(
      plan.accelerated.totalInterest,
    );
  });

  it("t30 is always the 30-year row regardless of the selected term", () => {
    expect(computeMortgagePlan(DEFAULT_INPUTS).t30.term).toBe(30);
  });

  it("cheapestHold picks the term with the least interest paid by holdMonths, not overall", () => {
    const plan = computeMortgagePlan({ ...DEFAULT_INPUTS, holdYears: 3 });
    const manualCheapest = plan.termData.reduce((a, b) =>
      a.interestAtHold <= b.interestAtHold ? a : b,
    );
    expect(plan.cheapestHold.term).toBe(manualCheapest.term);
  });

  it("selectedData matches the currently selected inputs.term", () => {
    expect(
      computeMortgagePlan({ ...DEFAULT_INPUTS, term: 20 }).selectedData?.term,
    ).toBe(20);
  });

  it("equityAtHold (Compare tab) excludes home appreciation, unlike equityAtSale (Strategy tab)", () => {
    const plan = computeMortgagePlan({
      ...DEFAULT_INPUTS,
      homeAppreciationPct: 10,
      holdYears: 5,
      extraMode: "none",
    });
    const row = plan.selectedData!; // term 30, same schedule as `accelerated` since there's no extra
    expect(row.equityAtHold).toBeCloseTo(
      plan.downPayment + row.principalAtHold,
    );
    expect(plan.loanBalanceAtSale).toBeCloseTo(row.balanceAtHold);
    expect(plan.equityAtSale).toBeGreaterThan(row.equityAtHold);
  });

  it("compareChartData has one row per year 0-30 with a balance for every term", () => {
    const plan = computeMortgagePlan(DEFAULT_INPUTS);
    expect(plan.compareChartData).toHaveLength(31);
    TERMS.forEach((t) => {
      expect(plan.compareChartData[0][`t${t}`]).toBeCloseTo(plan.loanAmount);
    });
  });
});

describe("refiPlan.breakevenMonths / netSavings at the value level", () => {
  it("breakevenMonths = ceil(refiClosingCosts / |paymentDelta|) when the refi lowers the payment", () => {
    const plan = computeMortgagePlan({
      ...DEFAULT_INPUTS,
      refiEnabled: true,
      refiYear: 5,
      refiRate: 4,
    });
    const { refiPlan } = plan;
    expect(refiPlan!.paymentDelta).toBeLessThan(0);
    expect(refiPlan!.breakevenMonths).toBe(
      Math.ceil(refiPlan!.refiClosingCosts / Math.abs(refiPlan!.paymentDelta)),
    );
  });

  it("breakevenMonths is null when the refi doesn't lower the payment", () => {
    const plan = computeMortgagePlan({
      ...DEFAULT_INPUTS,
      refiEnabled: true,
      refiYear: 5,
      refiRate: 9,
      refiTerm: 15,
    });
    expect(plan.refiPlan!.paymentDelta).toBeGreaterThan(0);
    expect(plan.refiPlan!.breakevenMonths).toBeNull();
  });

  it("netSavings = interestSaved - refiClosingCosts, and can be negative", () => {
    const plan = computeMortgagePlan({
      ...DEFAULT_INPUTS,
      refiEnabled: true,
      refiYear: 5,
      refiRate: 9,
      refiClosingCostPct: 5,
    });
    const { refiPlan } = plan;
    expect(refiPlan!.netSavings).toBeCloseTo(
      refiPlan!.interestSaved - refiPlan!.refiClosingCosts,
    );
    expect(refiPlan!.netSavings).toBeLessThan(0);
  });

  it("refi gotcha: continuing the same extra $ into a fresh, longer term can send less total monthly cash to the loan than before the refi (refiPlan.payment vs standardPI sanity check)", () => {
    const plan = computeMortgagePlan({
      ...DEFAULT_INPUTS,
      extraMode: "custom",
      customExtra: 1000,
      refiEnabled: true,
      refiYear: 10,
      refiTerm: 30,
      refiRate: 5,
      continueExtraAfterRefi: true,
    });
    const { refiPlan, standardPI, extraSteady } = plan;
    const preRefiMonthlyToLoan = standardPI + extraSteady;
    const postRefiMonthlyToLoan = refiPlan!.payment + refiPlan!.continuedExtra;
    expect(refiPlan!.payment).toBeLessThan(standardPI);
    expect(postRefiMonthlyToLoan).toBeLessThan(preRefiMonthlyToLoan);
  });
});

describe("edge and zero inputs", () => {
  it("loanAmount clamps to 0 when downPct is 100% (down payment equals purchase price)", () => {
    const plan = computeMortgagePlan({ ...DEFAULT_INPUTS, downPct: 100 });
    expect(plan.loanAmount).toBe(0);
    expect(plan.standardPI).toBe(0);
    expect(plan.accelerated.months).toBe(0);
  });

  it("downPct of 0 finances the full purchase price and still charges PMI", () => {
    const plan = computeMortgagePlan({ ...DEFAULT_INPUTS, downPct: 0 });
    expect(plan.downPayment).toBe(0);
    expect(plan.loanAmount).toBe(DEFAULT_INPUTS.purchasePrice);
    expect(plan.pmiAnnual).toBeCloseTo(plan.loanAmount * 0.006);
  });

  it("a negative customExtra never accelerates payoff relative to baseline", () => {
    const plan = computeMortgagePlan({
      ...DEFAULT_INPUTS,
      extraMode: "custom",
      customExtra: -500,
    });
    expect(plan.accelerated.months).toBeGreaterThanOrEqual(
      plan.baseline.months,
    );
    expect(plan.accelerated.totalInterest).toBeGreaterThanOrEqual(
      plan.baseline.totalInterest,
    );
  });

  it("holdYears of 0 evaluates equity at the moment of purchase", () => {
    const plan = computeMortgagePlan({ ...DEFAULT_INPUTS, holdYears: 0 });
    expect(plan.homeValueAtSale).toBeCloseTo(DEFAULT_INPUTS.purchasePrice);
    expect(plan.loanBalanceAtSale).toBeCloseTo(plan.loanAmount);
    expect(plan.equityAtSale).toBeCloseTo(plan.downPayment);
    expect(plan.holdMonths).toBe(0);
  });

  it("refiYear beyond the loan's payoff clamps to the final (~0) balance instead of indexing out of bounds", () => {
    const plan = computeMortgagePlan({
      ...DEFAULT_INPUTS,
      term: 15,
      refiEnabled: true,
      refiYear: 20,
    });
    expect(plan.refiPlan).not.toBeNull();
    expect(plan.refiPlan!.balanceAtRefi).toBeCloseTo(0);
    expect(plan.refiPlan!.newLoanAmount).toBeCloseTo(0);
  });
});

describe("maximizeEquityAtSale boundary behavior", () => {
  it("rounds the recommended extra up to the nearest $25 above the true minimum", () => {
    const result = maximizeEquityAtSale(
      { ...DEFAULT_INPUTS, holdYears: 15 },
      5000,
    );
    expect(result.fullyPaidOff).toBe(true);
    expect(result.balanceAtSale).toBe(0);
    expect(result.recommendedExtra).toBe(1350);
    expect(result.recommendedExtra % 25).toBe(0);
  });

  it("caps the recommended extra at the budget even when that's not a $25 multiple", () => {
    const result = maximizeEquityAtSale(
      { ...DEFAULT_INPUTS, holdYears: 15 },
      1340,
    );
    expect(result.recommendedExtra).toBe(1340);
    expect(result.fullyPaidOff).toBe(true);
    expect(result.balanceAtSale).toBe(0);
  });
});

describe("PMI auto-cancellation", () => {
  it("pmiCancelMonth is null and totalPMICost is 0 when down payment is already 20%+", () => {
    const plan = computeMortgagePlan({ ...DEFAULT_INPUTS, downPct: 20 });
    expect(plan.pmiAnnual).toBe(0);
    expect(plan.pmiCancelMonth).toBeNull();
    expect(plan.totalPMICost).toBe(0);
  });

  it("computes pmiCancelMonth as the first month accelerated balance / purchasePrice drops to <= 0.8", () => {
    const plan = computeMortgagePlan({ ...DEFAULT_INPUTS, downPct: 10 });
    expect(plan.pmiAnnual).toBeGreaterThan(0);
    expect(plan.pmiCancelMonth).not.toBeNull();
    const idx = plan.pmiCancelMonth!;
    expect(
      plan.accelerated.balances[idx] / DEFAULT_INPUTS.purchasePrice,
    ).toBeLessThanOrEqual(0.8);
    expect(
      plan.accelerated.balances[idx - 1] / DEFAULT_INPUTS.purchasePrice,
    ).toBeGreaterThan(0.8);
  });

  it("totalPMICost equals monthlyPMI times the number of months PMI was active before cancellation", () => {
    const plan = computeMortgagePlan({ ...DEFAULT_INPUTS, downPct: 10 });
    expect(plan.totalPMICost).toBeCloseTo(
      plan.monthlyPMI * plan.pmiCancelMonth!,
    );
  });

  it("extra payments accelerate PMI cancellation versus no extra", () => {
    const noExtra = computeMortgagePlan({
      ...DEFAULT_INPUTS,
      downPct: 10,
      extraMode: "none",
    });
    const withExtra = computeMortgagePlan({
      ...DEFAULT_INPUTS,
      downPct: 10,
      extraMode: "custom",
      customExtra: 1000,
    });
    expect(withExtra.pmiCancelMonth!).toBeLessThan(noExtra.pmiCancelMonth!);
    expect(withExtra.totalPMICost).toBeLessThan(noExtra.totalPMICost);
  });

  it("pmiCancelMonth stays null when a pathological negative extra prevents the balance from ever reaching 80% LTV", () => {
    const plan = computeMortgagePlan({
      ...DEFAULT_INPUTS,
      downPct: 10,
      extraMode: "custom",
      customExtra: -100000,
    });
    expect(plan.pmiAnnual).toBeGreaterThan(0);
    expect(plan.pmiCancelMonth).toBeNull();
    expect(plan.totalPMICost).toBeCloseTo(
      plan.monthlyPMI * plan.accelerated.months,
    );
  });
});

describe("discount points", () => {
  it("points=0 is inert: rate/payment/cost all match the no-points baseline", () => {
    const plan = computeMortgagePlan({ ...DEFAULT_INPUTS, points: 0 });
    expect(plan.pointsCost).toBe(0);
    expect(plan.pointsRate).toBe(plan.rate);
    expect(plan.pointsPayment).toBeCloseTo(plan.standardPI);
    expect(plan.pointsMonthlySavings).toBeCloseTo(0);
    expect(plan.pointsBreakevenMonths).toBeNull();
  });

  it("each point costs 1% of the loan amount and reduces the rate by 0.25%", () => {
    const plan = computeMortgagePlan({ ...DEFAULT_INPUTS, points: 2 });
    expect(plan.pointsCost).toBeCloseTo(plan.loanAmount * 0.02);
    expect(plan.pointsRate).toBeCloseTo(plan.rate - 0.5);
    expect(plan.pointsPayment).toBeCloseTo(
      pmt(plan.loanAmount, plan.rate - 0.5, DEFAULT_INPUTS.term),
    );
  });

  it("floors the points-adjusted rate at 0.25% instead of going negative", () => {
    const plan = computeMortgagePlan({ ...DEFAULT_INPUTS, points: 30 });
    expect(plan.pointsRate).toBe(0.25);
  });

  it("pointsMonthlySavings is the P&I drop from buying points, and pointsBreakevenMonths recoups pointsCost via that savings", () => {
    const plan = computeMortgagePlan({ ...DEFAULT_INPUTS, points: 1 });
    expect(plan.pointsMonthlySavings).toBeCloseTo(
      plan.standardPI - plan.pointsPayment,
    );
    expect(plan.pointsMonthlySavings).toBeGreaterThan(0);
    expect(plan.pointsBreakevenMonths).toBe(
      Math.ceil(plan.pointsCost / plan.pointsMonthlySavings),
    );
  });

  it("pointsLifetimeInterestSaved compares the points-adjusted rate against the standard baseline over the full term with no extra payments", () => {
    const plan = computeMortgagePlan({ ...DEFAULT_INPUTS, points: 1 });
    expect(plan.pointsLifetimeInterestSaved).toBeGreaterThan(0);
    expect(plan.pointsLifetimeInterestSaved).toBeCloseTo(
      plan.baseline.totalInterest - plan.pointsTotalInterest,
    );
  });

  it("points math is independent of the active extraMode/accelerated schedule", () => {
    const withExtra = computeMortgagePlan({
      ...DEFAULT_INPUTS,
      points: 1,
      extraMode: "custom",
      customExtra: 500,
    });
    const withoutExtra = computeMortgagePlan({
      ...DEFAULT_INPUTS,
      points: 1,
      extraMode: "none",
    });
    expect(withExtra.pointsCost).toBe(withoutExtra.pointsCost);
    expect(withExtra.pointsRate).toBe(withoutExtra.pointsRate);
    expect(withExtra.pointsPayment).toBeCloseTo(withoutExtra.pointsPayment);
  });
});
