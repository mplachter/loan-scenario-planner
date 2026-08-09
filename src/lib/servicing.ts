import { dateToMonthISO, monthToDateISO } from "./dates";
import { isLoanClosed, type LoanInputs, type LoanTerm } from "./defaults";
import { pmt } from "./mortgage";
import { createRecurringExtraEvent, type MortgageEvent } from "./events";

export interface LedgerRow {
  month: number; // 1-indexed; month 1 = first payment
  date: string; // ISO, first of month
  startBalance: number;
  rate: number;
  scheduledPI: number;
  interest: number;
  principal: number; // scheduled principal only
  extra: number; // extras + lumps + recast lump sums this month
  fees: number; // refi/recast costs paid out of pocket
  cashOut: number;
  escrow: number; // tax + insurance + flood this month
  pmi: number;
  hoa: number;
  endBalance: number;
  totalOutflow: number; // scheduledPI + extra + escrow + pmi + hoa + fees
  eventIds: string[];
}

export interface RefinanceSummary {
  eventId: string;
  month: number;
  date: string;
  oldRate: number;
  newRate: number;
  oldPayment: number;
  newPayment: number;
  payoffBalance: number;
  costs: number;
  rolledIn: boolean;
  cashOut: number;
  newBalance: number;
  paymentDelta: number; // newPayment - oldPayment
  breakevenMonths: number | null; // null unless paymentDelta < 0
  termResetMonths: number; // new term - months that remained
}

export interface ServicingYearRow {
  year: number;
  date: string;
  balance: number;
  homeValue: number;
  equity: number;
  cumInterest: number;
  monthlyPayment: number;
  escrow: number;
}

export interface ServicingResult {
  rows: LedgerRow[];
  payoffMonth: number;
  payoffDate: string;
  totalInterest: number;
  totalFees: number; // all refi + recast costs, rolled-in and out-of-pocket
  totalCashOut: number;
  totalExtraPaid: number; // every extra dollar sent to principal across all events
  totalOutOfPocket: number;
  totalPMIPaid: number;
  refinances: RefinanceSummary[];
  // PMI can stop and restart (a cash-out refi can bring it back) — hence periods,
  // not a single termination month. See servicing.ts Composition rule 4.
  pmiPeriods: { startMonth: number; endMonth: number | null }[];
  pmiRequestMonth: number | null; // next: balance <= 80% of original price
  pmiAutoMonth: number | null; // next: balance <= 78% of original price
  pmiAppraisalMonth: number | null; // next: balance <= 80% of appreciated value, month >= 24
  balanceAt(month: number): number;
  yearly: ServicingYearRow[];
}

export interface ServicingContext {
  // termYears is a plain number, not LoanTerm — Phase 6's existing-mortgage entry
  // supplies an arbitrary remaining term (e.g. 23.4 years), which the 15/20/25/30
  // ToggleGroup union can't express. RefinanceEvent.termYears stays LoanTerm since a
  // refinance is a new standard product; recasts derive their divisor from
  // remainingMonths / 12, which is already a plain number for the same reason.
  loanAmount: number;
  rate: number;
  termYears: number;
  firstPaymentDate: string;
  today: string;
  purchasePrice: number;
  downPct: number;
  homeAppreciationPct: number;
  taxAnnual: number;
  insuranceAnnual: number;
  floodAnnual: number;
  includeFlood: boolean;
  hoaMonthly: number;
  pmiRatePct: number;
  escrowDriftEnabled: boolean;
  taxInflationPct: number;
  insuranceInflationPct: number;
}

// Safety bound against pathological inputs (e.g. a chain of refinances that never
// converges), not a real amortization limit — mirrors mortgage.ts's `amortize` cap.
const MAX_MONTHS = 40 * 12;

interface PmiPeriodInternal {
  startMonth: number;
  endMonth: number | null;
  basisLoan: number;
  basisValue: number;
}

export function simulateServicing(
  ctx: ServicingContext,
  events: MortgageEvent[],
): ServicingResult {
  const enabledEvents = events.filter((e) => e.enabled);

  let balance = ctx.loanAmount;
  let rate = ctx.rate;
  let remainingMonths = ctx.termYears * 12;
  let scheduledPI = pmt(ctx.loanAmount, ctx.rate, ctx.termYears);

  let runningTax = ctx.taxAnnual;
  let runningInsurance = ctx.insuranceAnnual;
  let runningFlood = ctx.floodAnnual;

  let pmiActive = ctx.downPct < 20;
  let pmiBasisLoan = ctx.loanAmount;
  let pmiBasisValue = ctx.purchasePrice;
  const pmiPeriods: PmiPeriodInternal[] = [];
  if (pmiActive) {
    pmiPeriods.push({
      startMonth: 1,
      endMonth: null,
      basisLoan: pmiBasisLoan,
      basisValue: pmiBasisValue,
    });
  }

  const rows: LedgerRow[] = [];
  const refinances: RefinanceSummary[] = [];

  let totalInterest = 0;
  let totalCostsAccum = 0; // all refi + recast costs, rolled-in and out-of-pocket
  let totalOutOfPocketAccum = 0;
  let totalCashOut = 0;
  let totalExtraPaid = 0;
  let totalPMIPaid = 0;

  let m = 0;
  while (balance > 1 && m < MAX_MONTHS) {
    m += 1;
    // Decremented up front so that within this month's processing,
    // `remainingMonths` already reads as "contractual months left after this
    // month's payment" — e.g. at month 60 of a fresh 30-year loan it reads 300
    // (25 years), which is what a same-month recast re-amortizes over.
    remainingMonths -= 1;
    const eventIds: string[] = [];

    // 1. Escrow anniversary drift.
    if (ctx.escrowDriftEnabled && (m - 1) % 12 === 0 && m > 1) {
      runningTax *= 1 + ctx.taxInflationPct / 100;
      runningInsurance *= 1 + ctx.insuranceInflationPct / 100;
      runningFlood *= 1 + ctx.insuranceInflationPct / 100;
    }

    // 2. Explicit escrow-change events override the drifted running values.
    for (const ev of enabledEvents) {
      if (ev.kind === "escrow" && ev.month === m) {
        if (ev.taxAnnual !== null) runningTax = ev.taxAnnual;
        if (ev.insuranceAnnual !== null) runningInsurance = ev.insuranceAnnual;
        eventIds.push(ev.id);
      }
    }

    // 3. Refinance events, before the payment. Two in the same month chain
    // sequentially, so the later one in array order determines the final state.
    let refinancedThisMonth = false;
    let lastRefiNewBalance = balance;
    let cashOutThisMonth = 0;
    let outOfPocketThisMonth = 0;
    for (const ev of enabledEvents) {
      if (ev.kind !== "refinance" || ev.month !== m) continue;
      const oldPayment = scheduledPI;
      const oldRate = rate;
      const remainingBeforeReset = remainingMonths;
      const payoffBalance = balance;
      const costs =
        (payoffBalance * ev.closingCostPct) / 100 + ev.closingCostFlat;
      const newBalance =
        payoffBalance + ev.cashOut + (ev.rollCostsIn ? costs : 0);

      totalCostsAccum += costs;
      if (!ev.rollCostsIn) {
        outOfPocketThisMonth += costs;
        totalOutOfPocketAccum += costs;
      }
      cashOutThisMonth += ev.cashOut;
      totalCashOut += ev.cashOut;

      rate = ev.rate;
      // This month's payment is already the first payment of the new loan
      // (refinance is applied before the payment step), so one payment of
      // the fresh term is already spoken for.
      remainingMonths = ev.termYears * 12 - 1;
      balance = newBalance;
      scheduledPI = pmt(newBalance, rate, ev.termYears);

      const newPayment = scheduledPI;
      const paymentDelta = newPayment - oldPayment;
      refinances.push({
        eventId: ev.id,
        month: m,
        date: monthToDateISO(ctx.firstPaymentDate, m),
        oldRate,
        newRate: rate,
        oldPayment,
        newPayment,
        payoffBalance,
        costs,
        rolledIn: ev.rollCostsIn,
        cashOut: ev.cashOut,
        newBalance,
        paymentDelta,
        breakevenMonths:
          paymentDelta < 0 ? Math.ceil(costs / Math.abs(paymentDelta)) : null,
        termResetMonths: ev.termYears * 12 - remainingBeforeReset,
      });

      refinancedThisMonth = true;
      lastRefiNewBalance = newBalance;
      eventIds.push(ev.id);
    }

    const startBalance = balance;

    // 4. Recast events, before the payment. Rate and remaining term are unchanged —
    // that is the whole point of a recast.
    let recastLumpApplied = 0;
    let recastFee = 0;
    for (const ev of enabledEvents) {
      if (ev.kind !== "recast" || ev.month !== m) continue;
      const applied = Math.min(ev.lumpSum, balance);
      balance -= applied;
      recastLumpApplied += applied;
      recastFee += ev.fee;
      scheduledPI = pmt(balance, rate, remainingMonths / 12);
      eventIds.push(ev.id);
    }
    if (recastFee > 0) {
      totalCostsAccum += recastFee;
      totalOutOfPocketAccum += recastFee;
      outOfPocketThisMonth += recastFee;
    }

    // 5. Interest accrues on the post-refi/post-recast balance.
    const interest = (balance * rate) / 100 / 12;
    totalInterest += interest;

    // 6. Scheduled principal.
    const schedPrincipal = Math.max(scheduledPI - interest, 0);

    // 7. Extras — sum every applicable event, never pick one.
    let extraFromEvents = 0;
    for (const ev of enabledEvents) {
      if (ev.kind === "extra") {
        const inWindow =
          m >= ev.month && (ev.endMonth === null || m <= ev.endMonth);
        if (!inWindow) continue;
        if (ev.cadence === "monthly") {
          extraFromEvents += ev.amount;
          eventIds.push(ev.id);
        } else if (ev.cadence === "annual" && (m - ev.month) % 12 === 0) {
          extraFromEvents += ev.amount;
          eventIds.push(ev.id);
        }
      } else if (ev.kind === "lump" && ev.month === m) {
        extraFromEvents += ev.amount;
        eventIds.push(ev.id);
      }
    }

    // 8. Clamp at payoff: principal first, then extras.
    const principalApplied = Math.min(schedPrincipal, balance);
    const extraApplied = Math.min(extraFromEvents, balance - principalApplied);
    const endBalance = balance - principalApplied - extraApplied;
    const rowExtra = recastLumpApplied + extraApplied;
    totalExtraPaid += rowExtra;

    // 9. PMI — conventional-loan rules specifically (80%-request / 78%-auto /
    // appraisal). Kept as one self-contained chunk so a future `loanProgram`
    // field has one obvious place to branch (FHA/VA follow different rules).
    if (refinancedThisMonth) {
      if (pmiActive) {
        pmiPeriods[pmiPeriods.length - 1].endMonth = m;
      }
      const appreciatedValue =
        ctx.purchasePrice *
        Math.pow(1 + ctx.homeAppreciationPct / 100, (m - 1) / 12);
      if (lastRefiNewBalance > 0.8 * appreciatedValue) {
        pmiActive = true;
        pmiBasisLoan = lastRefiNewBalance;
        pmiBasisValue = appreciatedValue;
        pmiPeriods.push({
          startMonth: m,
          endMonth: null,
          basisLoan: pmiBasisLoan,
          basisValue: pmiBasisValue,
        });
      } else {
        pmiActive = false;
      }
    }
    let pmiThisMonth = 0;
    if (pmiActive) {
      pmiThisMonth = (pmiBasisLoan * ctx.pmiRatePct) / 100 / 12;
      totalPMIPaid += pmiThisMonth;
      if (endBalance <= 0.78 * pmiBasisValue) {
        pmiPeriods[pmiPeriods.length - 1].endMonth = m;
        pmiActive = false;
      }
    }

    const escrow =
      runningTax / 12 +
      runningInsurance / 12 +
      (ctx.includeFlood ? runningFlood / 12 : 0);
    const fees = outOfPocketThisMonth;
    const hoa = ctx.hoaMonthly;

    rows.push({
      month: m,
      date: monthToDateISO(ctx.firstPaymentDate, m),
      startBalance,
      rate,
      scheduledPI,
      interest,
      principal: principalApplied,
      extra: rowExtra,
      fees,
      cashOut: cashOutThisMonth,
      escrow,
      pmi: pmiThisMonth,
      hoa,
      endBalance,
      totalOutflow: scheduledPI + rowExtra + escrow + pmiThisMonth + hoa + fees,
      eventIds,
    });

    balance = endBalance;
  }

  const payoffMonth = rows.length;
  const payoffDate =
    rows.length > 0
      ? rows[rows.length - 1].date
      : monthToDateISO(ctx.firstPaymentDate, 0);

  // Next-upcoming PMI milestones for the period active as of `today` (not
  // necessarily the last period in the timeline — PMI is usually long gone by
  // the end of a full 30-year simulation, but a caller wants milestones
  // relative to now).
  let pmiRequestMonth: number | null = null;
  let pmiAutoMonth: number | null = null;
  let pmiAppraisalMonth: number | null = null;
  const todayMonth = Math.max(
    1,
    dateToMonthISO(ctx.firstPaymentDate, ctx.today),
  );
  const activePeriod = pmiPeriods.find(
    (p) =>
      p.startMonth <= todayMonth &&
      (p.endMonth === null || p.endMonth >= todayMonth),
  );
  if (activePeriod) {
    const searchStart = Math.max(activePeriod.startMonth, todayMonth);
    for (const row of rows) {
      if (row.month < searchStart) continue;
      if (activePeriod.endMonth !== null && row.month > activePeriod.endMonth)
        break;
      if (
        pmiRequestMonth === null &&
        row.endBalance <= 0.8 * activePeriod.basisValue
      ) {
        pmiRequestMonth = row.month;
      }
      if (
        pmiAutoMonth === null &&
        row.endBalance <= 0.78 * activePeriod.basisValue
      ) {
        pmiAutoMonth = row.month;
      }
      if (pmiAppraisalMonth === null && row.month >= 24) {
        const appreciatedValue =
          ctx.purchasePrice *
          Math.pow(1 + ctx.homeAppreciationPct / 100, (row.month - 1) / 12);
        if (row.endBalance <= 0.8 * appreciatedValue) {
          pmiAppraisalMonth = row.month;
        }
      }
    }
  }

  const initialEscrow =
    ctx.taxAnnual / 12 +
    ctx.insuranceAnnual / 12 +
    (ctx.includeFlood ? ctx.floodAnnual / 12 : 0);
  const initialPI = pmt(ctx.loanAmount, ctx.rate, ctx.termYears);

  function balanceAt(month: number): number {
    if (month <= 0) return ctx.loanAmount;
    if (month > rows.length) return 0;
    return rows[month - 1].endBalance;
  }

  const yearly: ServicingYearRow[] = [];
  const maxYear = Math.ceil(payoffMonth / 12);
  let cumInterestRunning = 0;
  let rowCursor = 0;
  for (let y = 0; y <= maxYear; y++) {
    const month = y * 12;
    const homeValue =
      ctx.purchasePrice * Math.pow(1 + ctx.homeAppreciationPct / 100, y);
    if (month === 0) {
      yearly.push({
        year: y,
        date: monthToDateISO(ctx.firstPaymentDate, 0),
        balance: ctx.loanAmount,
        homeValue,
        equity: homeValue - ctx.loanAmount,
        cumInterest: 0,
        monthlyPayment: initialPI,
        escrow: initialEscrow,
      });
      continue;
    }
    while (rowCursor < rows.length && rows[rowCursor].month <= month) {
      cumInterestRunning += rows[rowCursor].interest;
      rowCursor += 1;
    }
    const balance = balanceAt(month);
    const row = month <= rows.length ? rows[month - 1] : rows[rows.length - 1];
    yearly.push({
      year: y,
      date: monthToDateISO(ctx.firstPaymentDate, month),
      balance,
      homeValue,
      equity: homeValue - balance,
      cumInterest: month <= rows.length ? cumInterestRunning : totalInterest,
      monthlyPayment: row ? row.scheduledPI : 0,
      escrow: row ? row.escrow : 0,
    });
  }

  return {
    rows,
    payoffMonth,
    payoffDate,
    totalInterest,
    totalFees: totalCostsAccum,
    totalCashOut,
    totalExtraPaid,
    totalOutOfPocket: totalOutOfPocketAccum,
    totalPMIPaid,
    refinances,
    pmiPeriods: pmiPeriods.map((p) => ({
      startMonth: p.startMonth,
      endMonth: p.endMonth,
    })),
    pmiRequestMonth,
    pmiAutoMonth,
    pmiAppraisalMonth,
    balanceAt,
    yearly,
  };
}

export function servicingContextFromInputs(
  inputs: LoanInputs,
  today: string,
): ServicingContext {
  // Same predicate the UI gates Owning mode on, so the two can't drift apart.
  if (!isLoanClosed(inputs)) {
    throw new Error(
      "servicingContextFromInputs requires a closed loan (closeDate/firstPaymentDate/servicedLoanAmount/servicedRate/servicedTerm, or ownershipStatus 'existing' with existingLoan set)",
    );
  }

  // Existing-owner entry path: the loan was never shopped in this app, so
  // there's no `servicedTerm`/purchase-flow data to read — source the same
  // context shape from `existingLoan` instead. `remainingTermYears` is a
  // plain (possibly fractional) number, which is exactly what
  // `ServicingContext.termYears` is typed for.
  if (inputs.ownershipStatus === "existing" && inputs.existingLoan) {
    const existing = inputs.existingLoan;
    return {
      loanAmount: existing.currentBalance,
      rate: existing.currentRate,
      termYears: existing.remainingTermYears,
      firstPaymentDate: inputs.firstPaymentDate,
      today,
      purchasePrice: existing.originalPurchasePrice,
      downPct: inputs.downPct,
      homeAppreciationPct: inputs.homeAppreciationPct,
      taxAnnual: inputs.propertyTax,
      insuranceAnnual: inputs.insuranceAnnual,
      floodAnnual: inputs.floodAnnual,
      includeFlood: inputs.includeFlood,
      hoaMonthly: inputs.hoaMonthly,
      pmiRatePct: inputs.pmiRatePct,
      escrowDriftEnabled: inputs.escrowDriftEnabled,
      taxInflationPct: inputs.taxInflationPct,
      insuranceInflationPct: inputs.insuranceInflationPct,
    };
  }

  // Post-close (shopping) path: `isLoanClosed` already guaranteed
  // `servicedTerm` is non-null here, since `ownershipStatus !== "existing"`.
  return {
    loanAmount: inputs.servicedLoanAmount,
    rate: inputs.servicedRate,
    termYears: inputs.servicedTerm as LoanTerm,
    firstPaymentDate: inputs.firstPaymentDate,
    today,
    purchasePrice: inputs.purchasePrice,
    downPct: inputs.downPct,
    homeAppreciationPct: inputs.homeAppreciationPct,
    taxAnnual: inputs.propertyTax,
    insuranceAnnual: inputs.insuranceAnnual,
    floodAnnual: inputs.floodAnnual,
    includeFlood: inputs.includeFlood,
    hoaMonthly: inputs.hoaMonthly,
    pmiRatePct: inputs.pmiRatePct,
    escrowDriftEnabled: inputs.escrowDriftEnabled,
    taxInflationPct: inputs.taxInflationPct,
    insuranceInflationPct: inputs.insuranceInflationPct,
  };
}

export interface TimelineComparison {
  name: string;
  result: ServicingResult;
  interestVsBaseline: number;
  payoffMonthsVsBaseline: number;
  feesTotal: number;
}

export function compareTimelines(
  ctx: ServicingContext,
  timelines: { name: string; events: MortgageEvent[] }[],
): TimelineComparison[] {
  const baseline = simulateServicing(ctx, []);
  const named = [
    { name: "Do nothing", events: [] as MortgageEvent[] },
    ...timelines,
  ];
  return named.map((t) => {
    const result =
      t.events.length === 0 ? baseline : simulateServicing(ctx, t.events);
    return {
      name: t.name,
      result,
      interestVsBaseline: result.totalInterest - baseline.totalInterest,
      payoffMonthsVsBaseline: result.payoffMonth - baseline.payoffMonth,
      feesTotal: result.totalFees,
    };
  });
}

export interface EventAttribution {
  eventId: string;
  interestSaved: number;
  monthsSaved: number;
  principalContributed: number; // dollars this event sent to principal
  costIncurred: number; // refi/recast fees attributable to it
}

// Leave-one-out attribution: order-independent, honest about interaction — the
// parts need not sum to the whole. Cost is N+1 simulations for N events.
export function attributeEvents(
  ctx: ServicingContext,
  events: MortgageEvent[],
): EventAttribution[] {
  const enabledEvents = events.filter((e) => e.enabled);
  if (events.length > 25) return [];

  const full = simulateServicing(ctx, events);
  return enabledEvents.map((ev) => {
    const without = simulateServicing(
      ctx,
      events.filter((e) => e.id !== ev.id),
    );
    const interestSaved = without.totalInterest - full.totalInterest;
    const monthsSaved = without.payoffMonth - full.payoffMonth;

    let principalContributed = 0;
    let costIncurred = 0;
    if (ev.kind === "extra" || ev.kind === "lump") {
      principalContributed = full.totalExtraPaid - without.totalExtraPaid;
    } else if (ev.kind === "recast") {
      principalContributed = ev.lumpSum;
      costIncurred = ev.fee;
    } else if (ev.kind === "refinance") {
      const summary = full.refinances.find((r) => r.eventId === ev.id);
      costIncurred = summary?.costs ?? 0;
    }

    return {
      eventId: ev.id,
      interestSaved,
      monthsSaved,
      principalContributed,
      costIncurred,
    };
  });
}

export interface NetProceedsResult {
  year: number;
  homeValue: number;
  sellingCosts: number;
  loanBalance: number;
  netProceeds: number;
}

// Home value at `year` (0 = today, i.e. month 0 of the timeline) minus selling
// costs minus the loan balance at that point. Shares the appreciation formula
// with `yearly`'s `homeValue` field — kept as a standalone function (rather
// than reading it off `ServicingResult.yearly`) so a caller can ask about any
// year, including ones past the sampled `yearly` array or past payoff.
export function netProceedsAt(
  ctx: ServicingContext,
  result: ServicingResult,
  year: number,
  sellingCostPct: number,
): NetProceedsResult {
  const homeValue =
    ctx.purchasePrice * Math.pow(1 + ctx.homeAppreciationPct / 100, year);
  const sellingCosts = (homeValue * sellingCostPct) / 100;
  const loanBalance = result.balanceAt(year * 12);
  return {
    year,
    homeValue,
    sellingCosts,
    loanBalance,
    netProceeds: homeValue - sellingCosts - loanBalance,
  };
}

export interface PrepayVsInvestResult {
  startMonth: number;
  horizonMonths: number;
  contributions: number; // total dollars sent to principal by the trial extra
  interestSaved: number; // vs. the live timeline, through the horizon
  balanceReduction: number; // vs. the live timeline, at the horizon
  prepayValue: number; // contributions + interestSaved — the guaranteed side
  investFutureValue: number; // pre-tax future value of investing the same dollars
  investGains: number;
  investValueAfterTax: number;
  winner: "prepay" | "invest";
  crossoverReturnPct: number; // the return rate at which investValueAfterTax === prepayValue
}

// Compares sending `extraMonthly` to principal against investing the same
// dollars, through `horizonMonths`. Both paths are evaluated **on top of**
// `liveEvents` — the marginal dollar is worth less once the loan is already
// being prepaid, so this never compares against a bare/empty loan. Mirrors
// `maximizeEquityAtSale`'s 40-iteration bisection (plan.ts) for the
// crossover-rate search.
export function prepayVsInvest(
  ctx: ServicingContext,
  liveEvents: MortgageEvent[],
  extraMonthly: number,
  investReturnPct: number,
  investTaxRatePct: number,
  horizonMonths: number,
): PrepayVsInvestResult {
  const startMonth = Math.max(
    1,
    dateToMonthISO(ctx.firstPaymentDate, ctx.today),
  );
  const liveResult = simulateServicing(ctx, liveEvents);
  const trialEvent = createRecurringExtraEvent(startMonth, {
    amount: extraMonthly,
    cadence: "monthly",
    endMonth: null,
    note: "prepay-vs-invest trial",
  });
  const withExtra = simulateServicing(ctx, [...liveEvents, trialEvent]);

  const cumInterestThrough = (result: ServicingResult, month: number) =>
    result.rows
      .filter((r) => r.month <= month)
      .reduce((sum, r) => sum + r.interest, 0);

  const interestSaved =
    cumInterestThrough(liveResult, horizonMonths) -
    cumInterestThrough(withExtra, horizonMonths);
  const balanceReduction =
    liveResult.balanceAt(horizonMonths) - withExtra.balanceAt(horizonMonths);

  const monthsContributing = Math.max(horizonMonths - startMonth + 1, 0);
  const contributions = extraMonthly * monthsContributing;
  const prepayValue = contributions + interestSaved;

  function investFutureValue(returnPct: number): number {
    if (monthsContributing <= 0) return 0;
    const monthlyRate = returnPct / 100 / 12;
    if (monthlyRate === 0) return extraMonthly * monthsContributing;
    return (
      extraMonthly *
      ((Math.pow(1 + monthlyRate, monthsContributing) - 1) / monthlyRate)
    );
  }
  function investAfterTax(returnPct: number): number {
    const fv = investFutureValue(returnPct);
    const gains = Math.max(fv - contributions, 0);
    return fv - (gains * investTaxRatePct) / 100;
  }

  const investFutureValueAtRate = investFutureValue(investReturnPct);
  const investGains = Math.max(investFutureValueAtRate - contributions, 0);
  const investValueAfterTax = investAfterTax(investReturnPct);

  // Bisection on the return rate for the value at which investing after tax
  // ties the guaranteed prepay value — same shape as maximizeEquityAtSale's
  // search in plan.ts.
  let lo = 0;
  let hi = 30;
  for (let i = 0; i < 40; i += 1) {
    const mid = (lo + hi) / 2;
    if (investAfterTax(mid) < prepayValue) lo = mid;
    else hi = mid;
  }
  const crossoverReturnPct = (lo + hi) / 2;

  return {
    startMonth,
    horizonMonths,
    contributions,
    interestSaved,
    balanceReduction,
    prepayValue,
    investFutureValue: investFutureValueAtRate,
    investGains,
    investValueAfterTax,
    winner: investValueAfterTax > prepayValue ? "invest" : "prepay",
    crossoverReturnPct,
  };
}
