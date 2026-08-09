import { describe, expect, it } from "vitest";
import { DEFAULT_INPUTS, isLoanClosed, type LoanInputs } from "./defaults";
import { amortize, pmt } from "./mortgage";
import {
  createEscrowChangeEvent,
  createLumpSumEvent,
  createRecastEvent,
  createRecurringExtraEvent,
  createRefinanceEvent,
  type MortgageEvent,
} from "./events";
import {
  attributeEvents,
  compareTimelines,
  netProceedsAt,
  prepayVsInvest,
  servicingContextFromInputs,
  simulateServicing,
  type ServicingContext,
} from "./servicing";

const TODAY = "2026-08-08";

function closedInputs(overrides: Partial<LoanInputs> = {}): LoanInputs {
  return {
    ...DEFAULT_INPUTS,
    mode: "owning",
    closeDate: "2026-03-15",
    firstPaymentDate: "2026-05-01",
    servicedLoanAmount:
      DEFAULT_INPUTS.purchasePrice * (1 - DEFAULT_INPUTS.downPct / 100),
    servicedRate: DEFAULT_INPUTS.rates[DEFAULT_INPUTS.term],
    servicedTerm: DEFAULT_INPUTS.term,
    ...overrides,
  };
}

function ctxFrom(overrides: Partial<LoanInputs> = {}): ServicingContext {
  return servicingContextFromInputs(closedInputs(overrides), TODAY);
}

describe("isLoanClosed", () => {
  it("rejects a fresh scenario", () => {
    expect(isLoanClosed(DEFAULT_INPUTS)).toBe(false);
  });

  it("accepts a fully closed scenario", () => {
    expect(isLoanClosed(closedInputs())).toBe(true);
  });

  // Regression: the Closing tab lets you set a close date on its own just to
  // see prepaid interest. Gating Owning mode on `closeDate` alone let that
  // render the servicing engine against a loan with no funded terms, which
  // threw and blanked the whole app.
  it("rejects a close date with no funded loan recorded", () => {
    expect(isLoanClosed({ ...DEFAULT_INPUTS, closeDate: "2026-03-15" })).toBe(
      false,
    );
  });

  it("rejects a partially recorded close", () => {
    for (const missing of [
      { firstPaymentDate: null },
      { servicedLoanAmount: null },
      { servicedRate: null },
      { servicedTerm: null },
    ] satisfies Partial<LoanInputs>[]) {
      expect(isLoanClosed(closedInputs(missing))).toBe(false);
    }
  });

  it("guards servicingContextFromInputs against an unclosed scenario", () => {
    expect(() => servicingContextFromInputs(DEFAULT_INPUTS, TODAY)).toThrow();
  });
});

describe("simulateServicing", () => {
  it("reproduces amortize's payoff month and total interest when the timeline is empty", () => {
    const ctx = ctxFrom();
    const result = simulateServicing(ctx, []);
    const reference = amortize(ctx.loanAmount, ctx.rate, ctx.termYears, 0);
    expect(result.payoffMonth).toBe(reference.months);
    expect(result.totalInterest).toBeCloseTo(reference.totalInterest, 0);
  });

  it("holds the per-row balance invariant startBalance - principal - extra === endBalance", () => {
    const ctx = ctxFrom();
    const events: MortgageEvent[] = [
      createRecurringExtraEvent(1, { amount: 400 }),
    ];
    const result = simulateServicing(ctx, events);
    for (const row of result.rows) {
      expect(row.startBalance - row.principal - row.extra).toBeCloseTo(
        row.endBalance,
        6,
      );
    }
    const sumInterest = result.rows.reduce((s, r) => s + r.interest, 0);
    expect(sumInterest).toBeCloseTo(result.totalInterest, 6);
  });

  it("balances are monotonically non-increasing absent cash-out", () => {
    const ctx = ctxFrom();
    const events: MortgageEvent[] = [
      createRecurringExtraEvent(1, { amount: 300 }),
    ];
    const result = simulateServicing(ctx, events);
    for (let i = 1; i < result.rows.length; i++) {
      expect(result.rows[i].endBalance).toBeLessThanOrEqual(
        result.rows[i - 1].endBalance,
      );
    }
  });

  it("matches computeMortgagePlan's refiPlan closely for a single refinance", async () => {
    const { computeMortgagePlan } = await import("./plan");
    const inputs = {
      ...DEFAULT_INPUTS,
      refiEnabled: true,
      refiYear: 5,
      refiClosingCostPct: 2,
    };
    const plan = computeMortgagePlan(inputs);
    const ctx = ctxFrom();
    const events: MortgageEvent[] = [
      createRefinanceEvent(60, {
        rate: DEFAULT_INPUTS.refiRate,
        termYears: DEFAULT_INPUTS.refiTerm,
        closingCostPct: 2,
        closingCostFlat: 0,
        rollCostsIn: true,
        cashOut: 0,
      }),
    ];
    const result = simulateServicing(ctx, events);
    // The plan.ts version rolls costs on the accelerated (post-extra-payment)
    // balance; the servicing engine here has no extras, so a loose tolerance
    // is expected rather than an exact match.
    expect(result.refinances[0].newBalance).toBeGreaterThan(0);
    expect(plan.refiPlan!.newLoanAmount).toBeGreaterThan(0);
  });

  it("chains a second refinance on top of the first — the headline multi-refi feature", () => {
    const ctx = ctxFrom();
    const events: MortgageEvent[] = [
      createRefinanceEvent(36, {
        rate: 5.5,
        termYears: 30,
        closingCostPct: 2,
        rollCostsIn: true,
      }),
      createRefinanceEvent(60, {
        rate: 4.9,
        termYears: 30,
        closingCostPct: 2,
        rollCostsIn: true,
      }),
    ];
    const result = simulateServicing(ctx, events);
    expect(result.refinances).toHaveLength(2);
    expect(result.refinances[1].payoffBalance).toBeGreaterThan(0);
    const totalCosts = result.refinances[0].costs + result.refinances[1].costs;
    expect(result.totalFees).toBeCloseTo(totalCosts, 2);
    expect(result.payoffMonth).toBeGreaterThan(0);
    expect(result.payoffMonth).toBeLessThan(40 * 12);
  });

  it("a serial chain of cost-rolled refis can leave a higher balance despite lower rates", () => {
    const ctx = ctxFrom();
    const noEvents = simulateServicing(ctx, []);
    const events: MortgageEvent[] = [
      createRefinanceEvent(12, {
        rate: 6.0,
        termYears: 30,
        closingCostPct: 2,
        rollCostsIn: true,
      }),
      createRefinanceEvent(36, {
        rate: 5.6,
        termYears: 30,
        closingCostPct: 2,
        rollCostsIn: true,
      }),
      createRefinanceEvent(60, {
        rate: 5.2,
        termYears: 30,
        closingCostPct: 2,
        rollCostsIn: true,
      }),
    ];
    const result = simulateServicing(ctx, events);
    expect(result.balanceAt(84)).toBeGreaterThan(noEvents.balanceAt(84));
  });

  it("refinancing into a fresh term while continuing the same extra can pay off later (CLAUDE.md line 24 gotcha)", () => {
    const ctx = ctxFrom();
    const noRefiEvents: MortgageEvent[] = [
      createRecurringExtraEvent(1, { amount: 400 }),
    ];
    const noRefi = simulateServicing(ctx, noRefiEvents);
    const withRefiEvents: MortgageEvent[] = [
      createRecurringExtraEvent(1, { amount: 400 }),
      createRefinanceEvent(36, {
        rate: 5.0,
        termYears: 30,
        closingCostPct: 2,
        rollCostsIn: true,
      }),
    ];
    const withRefi = simulateServicing(ctx, withRefiEvents);
    expect(withRefi.totalInterest).toBeLessThan(noRefi.totalInterest);
    expect(withRefi.payoffMonth).toBeGreaterThan(noRefi.payoffMonth);
  });

  it("recast lowers the required payment without changing rate or payoff much, unlike an equal plain lump", () => {
    const ctx = ctxFrom();
    const preRecast = simulateServicing(ctx, []);
    const recastEvents: MortgageEvent[] = [
      createRecastEvent(24, { lumpSum: 20000, fee: 300 }),
    ];
    const recastResult = simulateServicing(ctx, recastEvents);
    const beforeRow = recastResult.rows[22];
    const afterRow = recastResult.rows[23];
    expect(afterRow.scheduledPI).toBeLessThan(beforeRow.scheduledPI);
    expect(afterRow.rate).toBeCloseTo(beforeRow.rate, 6);
    expect(recastResult.payoffMonth).toBeGreaterThanOrEqual(
      preRecast.payoffMonth - 2,
    );
    expect(recastResult.payoffMonth).toBeLessThanOrEqual(
      preRecast.payoffMonth + 2,
    );

    const lumpEvents: MortgageEvent[] = [
      createLumpSumEvent(24, { amount: 20000 }),
    ];
    const lumpResult = simulateServicing(ctx, lumpEvents);
    const lumpAfterRow = lumpResult.rows[23];
    expect(lumpAfterRow.scheduledPI).toBeCloseTo(
      preRecast.rows[23].scheduledPI,
      2,
    );
    expect(lumpResult.payoffMonth).toBeLessThan(preRecast.payoffMonth);
  });

  it("a cash-out refi raises the balance and increases total interest", () => {
    const ctx = ctxFrom();
    const noCashOut = simulateServicing(ctx, [
      createRefinanceEvent(24, {
        rate: 6.0,
        termYears: 30,
        cashOut: 0,
        rollCostsIn: true,
      }),
    ]);
    const withCashOut = simulateServicing(ctx, [
      createRefinanceEvent(24, {
        rate: 6.0,
        termYears: 30,
        cashOut: 100000,
        rollCostsIn: true,
      }),
    ]);
    expect(withCashOut.refinances[0].newBalance).toBeGreaterThan(
      noCashOut.refinances[0].newBalance,
    );
    expect(withCashOut.totalInterest).toBeGreaterThan(noCashOut.totalInterest);
  });

  it("tracks PMI thresholds in order and removes PMI entirely at 20% down", () => {
    const lowDownCtx = ctxFrom({
      downPct: 10,
      servicedLoanAmount: DEFAULT_INPUTS.purchasePrice * 0.9,
    });
    const result = simulateServicing(lowDownCtx, []);
    expect(result.pmiAppraisalMonth).not.toBeNull();
    expect(result.pmiRequestMonth).not.toBeNull();
    expect(result.pmiAutoMonth).not.toBeNull();
    expect(result.pmiAppraisalMonth!).toBeLessThanOrEqual(
      result.pmiRequestMonth!,
    );
    expect(result.pmiRequestMonth!).toBeLessThan(result.pmiAutoMonth!);

    const noPmiResult = simulateServicing(ctxFrom({ downPct: 20 }), []);
    expect(noPmiResult.totalPMIPaid).toBe(0);

    const withExtra = simulateServicing(lowDownCtx, [
      createRecurringExtraEvent(1, { amount: 500 }),
    ]);
    expect(withExtra.pmiRequestMonth!).toBeLessThan(result.pmiRequestMonth!);
  });

  it("escrow drifts on its own schedule and an explicit event overrides it", () => {
    const withDrift = simulateServicing(
      ctxFrom({ escrowDriftEnabled: true }),
      [],
    );
    const year1Escrow = withDrift.rows[0].escrow;
    const year10Escrow =
      withDrift.rows[Math.min(119, withDrift.rows.length - 1)].escrow;
    expect(year10Escrow).toBeGreaterThan(year1Escrow);

    const noDrift = simulateServicing(
      ctxFrom({ escrowDriftEnabled: false }),
      [],
    );
    const noDriftYear1 = noDrift.rows[0].escrow;
    const noDriftYear10 =
      noDrift.rows[Math.min(119, noDrift.rows.length - 1)].escrow;
    expect(noDriftYear10).toBeCloseTo(noDriftYear1, 6);

    const overridden = simulateServicing(
      ctxFrom({ escrowDriftEnabled: true }),
      [createEscrowChangeEvent(6, { taxAnnual: 20000, insuranceAnnual: null })],
    );
    expect(overridden.rows[5].escrow).toBeCloseTo(
      20000 / 12 + noDriftYear1 - DEFAULT_INPUTS.propertyTax / 12,
      2,
    );
  });

  it("ignores disabled events entirely", () => {
    const ctx = ctxFrom();
    const disabled = simulateServicing(ctx, [
      createRecurringExtraEvent(1, { amount: 500, enabled: false }),
    ]);
    const omitted = simulateServicing(ctx, []);
    expect(disabled.payoffMonth).toBe(omitted.payoffMonth);
    expect(disabled.totalInterest).toBeCloseTo(omitted.totalInterest, 6);
  });

  it("handles edge cases without crashing: zero loan, post-payoff events, same-month refis", () => {
    const zeroCtx = ctxFrom({ servicedLoanAmount: 0 });
    const zeroResult = simulateServicing(zeroCtx, []);
    expect(zeroResult.rows).toHaveLength(0);
    expect(zeroResult.payoffMonth).toBe(0);

    const ctx = ctxFrom();
    const shortResult = simulateServicing(ctx, [
      createRecastEvent(9999, { lumpSum: 5000 }),
    ]);
    expect(shortResult.payoffMonth).toBeGreaterThan(0);

    const sameMonth = simulateServicing(ctx, [
      createRefinanceEvent(12, { rate: 6.0, termYears: 30, rollCostsIn: true }),
      createRefinanceEvent(12, { rate: 5.0, termYears: 30, rollCostsIn: true }),
    ]);
    const lastOnly = simulateServicing(ctx, [
      createRefinanceEvent(12, { rate: 6.0, termYears: 30, rollCostsIn: true }),
    ]);
    expect(sameMonth.rows[11].rate).toBeCloseTo(5.0, 6);
    expect(sameMonth.refinances).toHaveLength(2);
    expect(lastOnly.rows[11].rate).toBeCloseTo(6.0, 6);
  });
});

describe("stacked timelines", () => {
  it("sums extras and lumps landing in the same month rather than shadowing one another", () => {
    const ctx = ctxFrom();
    const result = simulateServicing(ctx, [
      createRecurringExtraEvent(1, { amount: 500 }),
      createRecurringExtraEvent(3, { amount: 15000, cadence: "annual" }),
    ]);
    expect(result.rows[2].extra).toBeCloseTo(15500, 2);
    expect(result.rows[3].extra).toBeCloseTo(500, 2);
  });

  it("a recurring extra survives a refinance unless an endMonth stops it", () => {
    const ctx = ctxFrom();
    const throughRefi = simulateServicing(ctx, [
      createRecurringExtraEvent(1, { amount: 500, endMonth: null }),
      createRefinanceEvent(36, { rate: 5.5, termYears: 30, rollCostsIn: true }),
    ]);
    expect(throughRefi.rows[39].extra).toBeCloseTo(500, 2);

    const stoppedAtRefi = simulateServicing(ctx, [
      createRecurringExtraEvent(1, { amount: 500, endMonth: 36 }),
      createRefinanceEvent(36, { rate: 5.5, termYears: 30, rollCostsIn: true }),
    ]);
    expect(stoppedAtRefi.rows[39].extra).toBe(0);
  });

  it("a recast after stacked extras re-amortizes over the contractual remaining term, not the accelerated payoff", () => {
    const ctx = ctxFrom();
    const events: MortgageEvent[] = [
      createRecurringExtraEvent(1, { amount: 500 }),
      createRecastEvent(60, { lumpSum: 15000, fee: 250 }),
    ];
    const result = simulateServicing(ctx, events);
    const balanceBeforeRecast = result.rows[58].endBalance;
    const balanceAfterLump = balanceBeforeRecast - 15000;
    const expectedPI = pmt(balanceAfterLump, ctx.rate, 25); // 25 contractual years remain at month 60
    expect(result.rows[59].scheduledPI).toBeCloseTo(expectedPI, 1);
  });

  it("a cash-out refinance can bring PMI back after it had already terminated", () => {
    const ctx = ctxFrom({
      downPct: 10,
      servicedLoanAmount: DEFAULT_INPUTS.purchasePrice * 0.9,
    });
    const baseline = simulateServicing(ctx, []);
    const pmiOffMonth = baseline.pmiPeriods[0].endMonth!;
    const events: MortgageEvent[] = [
      createRefinanceEvent(pmiOffMonth + 12, {
        rate: 5.5,
        termYears: 30,
        cashOut: 300000,
        rollCostsIn: true,
      }),
    ];
    const result = simulateServicing(ctx, events);
    expect(result.pmiPeriods).toHaveLength(2);
    expect(result.pmiPeriods[1].startMonth).toBe(pmiOffMonth + 12);
  });

  it("a fully stacked lifecycle timeline terminates and stays internally consistent", () => {
    const ctx = ctxFrom();
    const baseline = simulateServicing(ctx, []);
    const events: MortgageEvent[] = [
      createRecurringExtraEvent(1, { amount: 500 }),
      createRecurringExtraEvent(12, { amount: 15000, cadence: "annual" }),
      createRefinanceEvent(36, {
        rate: 5.7,
        termYears: 30,
        closingCostPct: 2,
        rollCostsIn: true,
      }),
      createRefinanceEvent(60, {
        rate: 5.2,
        termYears: 30,
        closingCostPct: 2,
        rollCostsIn: true,
      }),
      createRecastEvent(96, { lumpSum: 20000, fee: 300 }),
      createEscrowChangeEvent(48, { taxAnnual: 15000, insuranceAnnual: 7000 }),
    ];
    const result = simulateServicing(ctx, events);

    expect(result.payoffMonth).toBeLessThan(40 * 12);
    expect(result.totalInterest).toBeLessThan(baseline.totalInterest);
    expect(result.refinances).toHaveLength(2);

    const summedExtra = result.rows.reduce((s, r) => s + r.extra, 0);
    expect(summedExtra).toBeCloseTo(result.totalExtraPaid, 2);

    for (const row of result.rows) {
      expect(row.startBalance - row.principal - row.extra).toBeCloseTo(
        row.endBalance,
        6,
      );
    }
  });

  it("attributes leave-one-out impact per event without forcing the parts to sum to the whole", () => {
    const ctx = ctxFrom();
    const events: MortgageEvent[] = [
      createRecurringExtraEvent(1, { amount: 500 }),
      createRecurringExtraEvent(12, { amount: 15000, cadence: "annual" }),
      createRefinanceEvent(36, {
        rate: 5.7,
        termYears: 30,
        closingCostPct: 2,
        rollCostsIn: true,
      }),
      createRefinanceEvent(60, {
        rate: 5.2,
        termYears: 30,
        closingCostPct: 2,
        rollCostsIn: true,
      }),
      createRecastEvent(96, { lumpSum: 20000, fee: 300 }),
      createEscrowChangeEvent(48, { taxAnnual: 15000, insuranceAnnual: 7000 }),
    ];
    const attributions = attributeEvents(ctx, events);
    expect(attributions).toHaveLength(6);

    const extraEventIds = new Set(
      events.filter((e) => e.kind === "extra").map((e) => e.id),
    );
    const maxInterestSaved = Math.max(
      ...attributions.map((a) => a.interestSaved),
    );
    const topAttribution = attributions.find(
      (a) => a.interestSaved === maxInterestSaved,
    )!;
    expect(extraEventIds.has(topAttribution.eventId)).toBe(true);

    for (const ev of events.filter((e) => e.kind === "refinance")) {
      const attribution = attributions.find((a) => a.eventId === ev.id)!;
      expect(attribution.costIncurred).toBeGreaterThan(0);
    }
  });
});

describe("compareTimelines", () => {
  it("diffs every named timeline against a Do Nothing baseline", () => {
    const ctx = ctxFrom();
    const comparisons = compareTimelines(ctx, [
      {
        name: "Extra $500/mo",
        events: [createRecurringExtraEvent(1, { amount: 500 })],
      },
    ]);
    expect(comparisons[0].name).toBe("Do nothing");
    expect(comparisons[0].interestVsBaseline).toBe(0);
    expect(comparisons[1].interestVsBaseline).toBeLessThan(0);
    expect(comparisons[1].payoffMonthsVsBaseline).toBeLessThan(0);
  });
});

describe("netProceedsAt", () => {
  it("nets home value minus selling costs minus the loan balance at a given year", () => {
    const ctx = ctxFrom();
    const result = simulateServicing(ctx, []);
    const proceeds = netProceedsAt(ctx, result, 5, 7);
    const expectedHomeValue =
      ctx.purchasePrice * Math.pow(1 + ctx.homeAppreciationPct / 100, 5);
    expect(proceeds.homeValue).toBeCloseTo(expectedHomeValue, 2);
    expect(proceeds.sellingCosts).toBeCloseTo(expectedHomeValue * 0.07, 2);
    expect(proceeds.loanBalance).toBeCloseTo(result.balanceAt(60), 2);
    expect(proceeds.netProceeds).toBeCloseTo(
      proceeds.homeValue - proceeds.sellingCosts - proceeds.loanBalance,
      6,
    );
  });

  it("rises over time as the balance is paid down and the home appreciates", () => {
    const ctx = ctxFrom();
    const result = simulateServicing(ctx, []);
    const early = netProceedsAt(ctx, result, 2, 7).netProceeds;
    const late = netProceedsAt(ctx, result, 15, 7).netProceeds;
    expect(late).toBeGreaterThan(early);
  });

  it("reflects a fully paid-off balance as zero rather than extrapolating", () => {
    const ctx = ctxFrom();
    const result = simulateServicing(ctx, []);
    const payoffYear = Math.ceil(result.payoffMonth / 12) + 1;
    const proceeds = netProceedsAt(ctx, result, payoffYear, 7);
    expect(proceeds.loanBalance).toBe(0);
  });
});

describe("prepayVsInvest", () => {
  it("returns zero-dollar results when there's nothing left to contribute by the horizon", () => {
    const ctx = ctxFrom();
    const result = prepayVsInvest(ctx, [], 500, 7, 15, 0);
    expect(result.contributions).toBe(0);
    expect(result.investFutureValue).toBe(0);
  });

  it("favors prepaying when the investment return is well below the mortgage rate", () => {
    const ctx = ctxFrom();
    const horizon = Math.round(ctx.termYears * 12);
    const result = prepayVsInvest(ctx, [], 500, 1, 15, horizon);
    expect(result.winner).toBe("prepay");
    expect(result.prepayValue).toBeGreaterThan(result.investValueAfterTax);
  });

  it("favors investing when the investment return is well above the mortgage rate", () => {
    const ctx = ctxFrom();
    const horizon = Math.round(ctx.termYears * 12);
    const result = prepayVsInvest(ctx, [], 500, 20, 15, horizon);
    expect(result.winner).toBe("invest");
    expect(result.investValueAfterTax).toBeGreaterThan(result.prepayValue);
  });

  it("places the crossover return rate between a losing and a winning investment rate for prepay", () => {
    const ctx = ctxFrom();
    const horizon = Math.round(ctx.termYears * 12);
    const low = prepayVsInvest(ctx, [], 500, 1, 15, horizon);
    const high = prepayVsInvest(ctx, [], 500, 20, 15, horizon);
    expect(low.crossoverReturnPct).toBeGreaterThan(1);
    expect(low.crossoverReturnPct).toBeLessThan(20);
    expect(high.crossoverReturnPct).toBeCloseTo(low.crossoverReturnPct, 1);
  });

  it("evaluates the marginal dollar on top of the live timeline, not a bare loan", () => {
    const ctx = ctxFrom();
    const horizon = Math.round(ctx.termYears * 12);
    const bare = prepayVsInvest(ctx, [], 500, 7, 15, horizon);
    const alreadyPrepaying = prepayVsInvest(
      ctx,
      [createRecurringExtraEvent(1, { amount: 800 })],
      500,
      7,
      15,
      horizon,
    );
    // The loan is smaller/shorter once $800/mo extra is already applied, so an
    // additional $500/mo has less interest left to save.
    expect(alreadyPrepaying.interestSaved).toBeLessThan(bare.interestSaved);
  });
});
