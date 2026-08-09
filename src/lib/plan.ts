import { daysInMonthUTC, parseISO } from "./dates";
import { amortize, pmt } from "./mortgage";
import {
  TERMS,
  type ExtraMode,
  type LoanInputs,
  type LoanTerm,
} from "./defaults";

export interface MatchCompare {
  matchTerm: LoanTerm;
  directRate: number;
  directPayment: number;
  directInterest: number;
  directMonths: number;
  stratPayment: number;
  stratInterest: number;
  stratMonths: number;
  interestDelta: number;
  monthsDelta: number;
}

export interface RefiPlan {
  refiMonth: number;
  balanceAtRefi: number;
  remainingInterestIfNoRefi: number;
  refiClosingCosts: number;
  newLoanAmount: number;
  payment: number;
  totalMonthly: number;
  continuedExtra: number;
  payoffMonths: number;
  totalInterest: number;
  balances: number[];
  baseBalances: number[];
  basePayoffMonths: number;
  baseTotalInterest: number;
  paymentDelta: number;
  interestSaved: number;
  netSavings: number;
  breakevenMonths: number | null;
  newPayoffYear: number;
  originalPayoffYear: number;
}

export interface TermData {
  term: LoanTerm;
  rate: number;
  payment: number;
  totalMonthly: number;
  totalInterest: number;
  totalPaid: number;
  balanceAtHold: number;
  interestAtHold: number;
  principalAtHold: number;
  equityAtHold: number;
  balances: number[];
}

export interface ChartRow {
  year: number;
  baseline: number;
  accelerated: number;
  refi?: number;
  refiBase?: number;
}

export type CompareChartRow = { year: number } & Record<string, number>;

export interface EquityChartRow {
  year: number;
  homeValue: number;
  balance: number;
  equity: number;
}

export interface MortgagePlan {
  rate: number;
  downPayment: number;
  loanAmount: number;
  standardPI: number;
  y1Payment: number;
  y2Payment: number;
  buydownSubsidy: number;
  pointsCost: number;
  pointsRate: number;
  pointsPayment: number;
  pointsMonthlySavings: number;
  pointsBreakevenMonths: number | null;
  pointsTotalInterest: number;
  pointsLifetimeInterestSaved: number;
  extraY1: number;
  extraY2: number;
  extraSteady: number;
  extraMonthly: number;
  baseline: ReturnType<typeof amortize>;
  accelerated: ReturnType<typeof amortize>;
  monthsSaved: number;
  yearsSavedWhole: number;
  monthsSavedRem: number;
  interestSaved: number;
  matchCompare: MatchCompare | null;
  refiPlan: RefiPlan | null;
  pmiAnnual: number;
  monthlyTax: number;
  monthlyInsurance: number;
  monthlyFlood: number;
  monthlyPMI: number;
  pmiCancelMonth: number | null;
  totalPMICost: number;
  monthlyUtilities: number;
  baseMonthlyCosts: number;
  basePaymentNoExtra: number;
  effectiveTotalInterest: number;
  effectivePayoffMonths: number;
  effectiveMonthsSaved: number;
  effectiveYearsSavedWhole: number;
  effectiveMonthsSavedRem: number;
  effectiveInterestSaved: number;
  totalMonthlyY1: number;
  totalMonthlyY2: number;
  totalMonthlySteadyState: number;
  closingCosts: number;
  prepaids: number;
  prepaidInterestDays: number;
  prepaidInterest: number;
  sellerCreditAmount: number;
  closingNeed: number;
  buydownNeed: number;
  appliedToClosing: number;
  poolAfterClosing: number;
  appliedToBuydown: number;
  sellerCreditWasted: number;
  maxUsableSellerCredit: number;
  buydownShortfall: number;
  buydownCostToBuyer: number;
  cashToClose: number;
  remainingAfterClose: number;
  ltv: number;
  ltvBasedConcessionPct: number;
  maxConcessionAmount: number;
  totalSellerAsk: number;
  sellerCreditExceedsCap: boolean;
  cashToCloseSub: string | null;
  holdMonths: number;
  termData: TermData[];
  t30: TermData;
  cheapestHold: TermData;
  selectedData: TermData | undefined;
  compareChartData: CompareChartRow[];
  maxYears: number;
  chartData: ChartRow[];
  equityMaxYears: number;
  equityChartData: EquityChartRow[];
  homeValueAtSale: number;
  loanBalanceAtSale: number;
  equityAtSale: number;
}

export function computeMortgagePlan(inputs: LoanInputs): MortgagePlan {
  const {
    purchasePrice,
    downPct,
    term,
    rates,
    buydown,
    points,
    propertyTax,
    hoaMonthly,
    insuranceAnnual,
    floodAnnual,
    includeFlood,
    extraMode,
    customExtra,
    closingCostPct,
    earnestDeposit,
    escrowMonths,
    sellerCreditPct,
    buydownFundedBySeller,
    maxConcessionPct,
    holdYears,
    homeAppreciationPct,
    refiEnabled,
    refiYear,
    refiTerm,
    refiRate,
    refiClosingCostPct,
    continueExtraAfterRefi,
    refiExtraOverride,
    gasMonthly,
    waterMonthly,
    electricMonthly,
    internetMonthly,
    tvMonthly,
    closeDate,
    pmiRatePct,
  } = inputs;

  const rate = rates[term];
  const downPayment = (purchasePrice * downPct) / 100;
  const loanAmount = Math.max(purchasePrice - downPayment, 0);

  const standardPI = pmt(loanAmount, rate, term);
  const y1Payment = pmt(loanAmount, Math.max(rate - 2, 0.25), term);
  const y2Payment = pmt(loanAmount, Math.max(rate - 1, 0.25), term);
  const buydownSubsidy = buydown
    ? 12 * (standardPI - y1Payment) + 12 * (standardPI - y2Payment)
    : 0;

  let extraFn: (month: number) => number = () => 0;
  if (extraMode === "custom") {
    extraFn = () => customExtra;
  } else if (extraMode === "match15" && term > 15) {
    const v = Math.max(pmt(loanAmount, rate, 15) - standardPI, 0);
    extraFn = () => v;
  } else if (extraMode === "match20" && term > 20) {
    const v = Math.max(pmt(loanAmount, rate, 20) - standardPI, 0);
    extraFn = () => v;
  } else if (extraMode === "match25" && term > 25) {
    const v = Math.max(pmt(loanAmount, rate, 25) - standardPI, 0);
    extraFn = () => v;
  } else if (extraMode === "buydownToPrincipal" && buydown) {
    extraFn = (m: number) => {
      if (m <= 12) return Math.max(standardPI - y1Payment, 0);
      if (m <= 24) return Math.max(standardPI - y2Payment, 0);
      return 0;
    };
  }

  const extraY1 = extraFn(1);
  const extraY2 = extraFn(13);
  const extraSteady = extraFn(30);
  const extraMonthly = extraY1;

  const baseline = amortize(loanAmount, rate, term, 0);
  const accelerated = amortize(loanAmount, rate, term, extraFn);

  // Discount points: fixed assumption of 1 point = 1% of loan amount upfront,
  // buying a 0.25%-point rate reduction, floored at 0.25% (mirrors the
  // buydown's fixed -2/-1 structure). Computed independently of extraMode.
  const POINTS_RATE_REDUCTION_PER_POINT = 0.25;
  const pointsCost = (loanAmount * points) / 100;
  const pointsRate = Math.max(
    rate - points * POINTS_RATE_REDUCTION_PER_POINT,
    0.25,
  );
  const pointsAm = amortize(loanAmount, pointsRate, term, 0);
  const pointsPayment = pointsAm.payment;
  const pointsMonthlySavings = standardPI - pointsPayment;
  const pointsBreakevenMonths =
    pointsMonthlySavings > 0
      ? Math.ceil(pointsCost / pointsMonthlySavings)
      : null;
  const pointsTotalInterest = pointsAm.totalInterest;
  const pointsLifetimeInterestSaved =
    baseline.totalInterest - pointsTotalInterest;

  const monthsSaved = baseline.months - accelerated.months;
  const yearsSavedWhole = Math.floor(monthsSaved / 12);
  const monthsSavedRem = monthsSaved % 12;
  const interestSaved = baseline.totalInterest - accelerated.totalInterest;

  const matchTermMap: Partial<Record<ExtraMode, LoanTerm>> = {
    match15: 15,
    match20: 20,
    match25: 25,
  };
  const matchTerm = matchTermMap[extraMode];
  let matchCompare: MatchCompare | null = null;
  if (matchTerm) {
    const directRate = rates[matchTerm];
    const directAm = amortize(loanAmount, directRate, matchTerm, 0);
    const stratPayment = standardPI + extraMonthly;
    const interestDelta = accelerated.totalInterest - directAm.totalInterest;
    const monthsDelta = accelerated.months - directAm.months;
    matchCompare = {
      matchTerm,
      directRate,
      directPayment: directAm.payment,
      directInterest: directAm.totalInterest,
      directMonths: directAm.months,
      stratPayment,
      stratInterest: accelerated.totalInterest,
      stratMonths: accelerated.months,
      interestDelta,
      monthsDelta,
    };
  }

  const pmiAnnual = downPct < 20 ? (loanAmount * pmiRatePct) / 100 : 0;

  const monthlyTax = propertyTax / 12;
  const monthlyInsurance = insuranceAnnual / 12;
  const monthlyFlood = includeFlood ? floodAnnual / 12 : 0;
  const monthlyPMI = pmiAnnual / 12;
  const monthlyUtilities =
    gasMonthly + waterMonthly + electricMonthly + internetMonthly + tvMonthly;
  const baseMonthlyCosts =
    monthlyTax +
    monthlyInsurance +
    monthlyFlood +
    hoaMonthly +
    monthlyPMI +
    monthlyUtilities;
  const basePaymentNoExtra = standardPI + baseMonthlyCosts;

  let pmiCancelMonth: number | null = null;
  if (pmiAnnual > 0) {
    const cancelIdx = accelerated.balances.findIndex(
      (b) => b / purchasePrice <= 0.8,
    );
    pmiCancelMonth = cancelIdx === -1 ? null : cancelIdx;
  }
  const totalPMICost = monthlyPMI * (pmiCancelMonth ?? accelerated.months);

  let refiPlan: RefiPlan | null = null;
  if (refiEnabled) {
    const refiMonth = Math.min(refiYear * 12, accelerated.balances.length - 1);
    const balanceAtRefi = accelerated.balances[refiMonth] ?? 0;
    const interestPaidBeforeRefi = accelerated.cumInterest[refiMonth] ?? 0;
    const remainingInterestIfNoRefi =
      accelerated.totalInterest - interestPaidBeforeRefi;

    const refiClosingCosts = (balanceAtRefi * refiClosingCostPct) / 100;
    const newLoanAmount = balanceAtRefi + refiClosingCosts;
    const continuedExtra = continueExtraAfterRefi
      ? (refiExtraOverride ?? extraSteady)
      : 0;
    const refiAm = amortize(newLoanAmount, refiRate, refiTerm, continuedExtra);
    const refiAmBase = amortize(newLoanAmount, refiRate, refiTerm, 0);

    const paymentDelta = refiAm.payment - standardPI;
    const refiInterestSaved = remainingInterestIfNoRefi - refiAm.totalInterest;
    const netSavings = refiInterestSaved - refiClosingCosts;
    const breakevenMonths =
      paymentDelta < 0
        ? Math.ceil(refiClosingCosts / Math.abs(paymentDelta))
        : null;
    const newPayoffYear = refiYear + refiAm.months / 12;
    const originalPayoffYear = accelerated.months / 12;

    refiPlan = {
      refiMonth,
      balanceAtRefi,
      remainingInterestIfNoRefi,
      refiClosingCosts,
      newLoanAmount,
      payment: refiAm.payment,
      totalMonthly: refiAm.payment + baseMonthlyCosts + continuedExtra,
      continuedExtra,
      payoffMonths: refiAm.months,
      totalInterest: refiAm.totalInterest,
      balances: refiAm.balances,
      baseBalances: refiAmBase.balances,
      basePayoffMonths: refiAmBase.months,
      baseTotalInterest: refiAmBase.totalInterest,
      paymentDelta,
      interestSaved: refiInterestSaved,
      netSavings,
      breakevenMonths,
      newPayoffYear,
      originalPayoffYear,
    };
  }

  const effectiveTotalInterest = refiPlan
    ? accelerated.totalInterest -
      refiPlan.remainingInterestIfNoRefi +
      refiPlan.totalInterest
    : accelerated.totalInterest;
  const effectivePayoffMonths = refiPlan
    ? refiPlan.refiMonth + refiPlan.payoffMonths
    : accelerated.months;
  const effectiveMonthsSaved = baseline.months - effectivePayoffMonths;
  const effectiveYearsSavedWhole = Math.floor(effectiveMonthsSaved / 12);
  const effectiveMonthsSavedRem = effectiveMonthsSaved % 12;
  const effectiveInterestSaved =
    baseline.totalInterest - effectiveTotalInterest;

  const totalMonthlyY1 =
    (buydown ? y1Payment : standardPI) + baseMonthlyCosts + extraY1;
  const totalMonthlyY2 =
    (buydown ? y2Payment : standardPI) + baseMonthlyCosts + extraY2;
  const totalMonthlySteadyState = standardPI + baseMonthlyCosts + extraSteady;

  const closingCosts = (purchasePrice * closingCostPct) / 100;
  const prepaids =
    (monthlyTax + monthlyInsurance + monthlyFlood) * escrowMonths;

  // Per-diem interest from close date through the end of that month.
  // Zero until the user sets a close date, so existing scenarios are unaffected.
  const prepaidInterestDays = closeDate
    ? daysInMonthUTC(parseISO(closeDate).y, parseISO(closeDate).m) -
      parseISO(closeDate).d +
      1
    : 0;
  const prepaidInterest =
    ((loanAmount * rate) / 100 / 365) * prepaidInterestDays;

  const sellerCreditAmount = (purchasePrice * sellerCreditPct) / 100;
  // Discount points are paid at the closing table, so they sit inside
  // `closingNeed` alongside closing costs and prepaids — seller credit offsets
  // them under the same waterfall (points are an allowed concession use).
  const closingNeed = closingCosts + pointsCost + prepaids;
  const buydownNeed = buydown && buydownFundedBySeller ? buydownSubsidy : 0;

  const appliedToClosing = Math.min(sellerCreditAmount, closingNeed);
  const poolAfterClosing = Math.max(sellerCreditAmount - closingNeed, 0);
  const appliedToBuydown = Math.min(poolAfterClosing, buydownNeed);
  const sellerCreditWasted = Math.max(
    sellerCreditAmount - closingNeed - buydownNeed,
    0,
  );
  const maxUsableSellerCredit = closingNeed + buydownNeed;

  const buydownShortfall = Math.max(buydownNeed - appliedToBuydown, 0);
  const buydownCostToBuyer =
    buydown && !buydownFundedBySeller ? buydownSubsidy : buydownShortfall;

  const cashToClose =
    downPayment +
    closingCosts +
    pointsCost +
    prepaids +
    prepaidInterest -
    earnestDeposit -
    appliedToClosing +
    buydownCostToBuyer;
  const remainingAfterClose = inputs.reserves - cashToClose;

  const ltv = 100 - downPct;
  let ltvBasedConcessionPct = 3;
  if (ltv <= 75) ltvBasedConcessionPct = 9;
  else if (ltv <= 90) ltvBasedConcessionPct = 6;
  const maxConcessionAmount = (purchasePrice * maxConcessionPct) / 100;
  const totalSellerAsk = appliedToClosing + appliedToBuydown;
  const sellerCreditExceedsCap = totalSellerAsk > maxConcessionAmount;

  const cashToCloseNotes: string[] = [];
  if (pointsCost > 0) cashToCloseNotes.push(`${points} pts included`);
  if (appliedToClosing > 0)
    cashToCloseNotes.push(`${sellerCreditPct}% seller credit`);
  if (buydownCostToBuyer > 0)
    cashToCloseNotes.push("buydown shortfall included");
  const cashToCloseSub = cashToCloseNotes.length
    ? cashToCloseNotes.join(" · ")
    : null;

  const holdMonths = holdYears * 12;
  const termData: TermData[] = TERMS.map((t) => {
    const r = rates[t];
    const am = amortize(loanAmount, r, t, 0);
    const idx = Math.min(holdMonths, am.balances.length - 1);
    const balanceAtHold = am.balances[idx];
    const interestAtHold = am.cumInterest[idx];
    const principalAtHold = loanAmount - balanceAtHold;
    return {
      term: t,
      rate: r,
      payment: am.payment,
      totalMonthly: am.payment + baseMonthlyCosts,
      totalInterest: am.totalInterest,
      totalPaid: am.payment * am.months,
      balanceAtHold,
      interestAtHold,
      principalAtHold,
      equityAtHold: downPayment + principalAtHold,
      balances: am.balances,
    };
  });

  const t30 = termData.find((d) => d.term === 30)!;
  const cheapestHold = termData.reduce((a, b) =>
    a.interestAtHold <= b.interestAtHold ? a : b,
  );
  const selectedData = termData.find((d) => d.term === term);

  const compareChartData: CompareChartRow[] = [];
  const compareMaxYears = 30;
  for (let y = 0; y <= compareMaxYears; y += 1) {
    const m = y * 12;
    const row: CompareChartRow = { year: y };
    termData.forEach((d) => {
      row[`t${d.term}`] = d.balances[Math.min(m, d.balances.length - 1)] ?? 0;
    });
    compareChartData.push(row);
  }

  const maxYears = Math.max(
    Math.ceil(baseline.months / 12),
    Math.ceil(accelerated.months / 12),
    refiPlan ? refiPlan.newPayoffYear : 0,
    refiPlan ? refiYear + refiPlan.basePayoffMonths / 12 : 0,
  );
  const showRefiBaseLine = !!refiPlan && refiPlan.continuedExtra > 0;
  const chartData: ChartRow[] = [];
  for (let y = 0; y <= maxYears; y += 1) {
    const m = y * 12;
    const row: ChartRow = {
      year: y,
      baseline:
        baseline.balances[Math.min(m, baseline.balances.length - 1)] ?? 0,
      accelerated:
        accelerated.balances[Math.min(m, accelerated.balances.length - 1)] ?? 0,
    };
    if (refiPlan) {
      row.refi =
        y < refiYear
          ? (accelerated.balances[
              Math.min(m, accelerated.balances.length - 1)
            ] ?? 0)
          : (refiPlan.balances[
              Math.min((y - refiYear) * 12, refiPlan.balances.length - 1)
            ] ?? 0);
      if (showRefiBaseLine) {
        row.refiBase =
          y < refiYear
            ? (accelerated.balances[
                Math.min(m, accelerated.balances.length - 1)
              ] ?? 0)
            : (refiPlan.baseBalances[
                Math.min((y - refiYear) * 12, refiPlan.baseBalances.length - 1)
              ] ?? 0);
      }
    }
    chartData.push(row);
  }

  const equityMaxYears = Math.max(maxYears, holdYears);
  const effectiveBalanceAtYear = (y: number): number => {
    if (refiPlan && y >= refiYear) {
      return (
        refiPlan.balances[
          Math.min((y - refiYear) * 12, refiPlan.balances.length - 1)
        ] ?? 0
      );
    }
    const m = y * 12;
    return (
      accelerated.balances[Math.min(m, accelerated.balances.length - 1)] ?? 0
    );
  };
  const equityChartData: EquityChartRow[] = [];
  for (let y = 0; y <= equityMaxYears; y += 1) {
    const homeValue =
      purchasePrice * Math.pow(1 + homeAppreciationPct / 100, y);
    const balance = effectiveBalanceAtYear(y);
    equityChartData.push({
      year: y,
      homeValue,
      balance,
      equity: homeValue - balance,
    });
  }
  const homeValueAtSale =
    purchasePrice * Math.pow(1 + homeAppreciationPct / 100, holdYears);
  const loanBalanceAtSale = effectiveBalanceAtYear(holdYears);
  const equityAtSale = homeValueAtSale - loanBalanceAtSale;

  return {
    rate,
    downPayment,
    loanAmount,
    standardPI,
    y1Payment,
    y2Payment,
    buydownSubsidy,
    pointsCost,
    pointsRate,
    pointsPayment,
    pointsMonthlySavings,
    pointsBreakevenMonths,
    pointsTotalInterest,
    pointsLifetimeInterestSaved,
    extraY1,
    extraY2,
    extraSteady,
    extraMonthly,
    baseline,
    accelerated,
    monthsSaved,
    yearsSavedWhole,
    monthsSavedRem,
    interestSaved,
    matchCompare,
    refiPlan,
    pmiAnnual,
    monthlyTax,
    monthlyInsurance,
    monthlyFlood,
    monthlyPMI,
    pmiCancelMonth,
    totalPMICost,
    monthlyUtilities,
    baseMonthlyCosts,
    basePaymentNoExtra,
    effectiveTotalInterest,
    effectivePayoffMonths,
    effectiveMonthsSaved,
    effectiveYearsSavedWhole,
    effectiveMonthsSavedRem,
    effectiveInterestSaved,
    totalMonthlyY1,
    totalMonthlyY2,
    totalMonthlySteadyState,
    closingCosts,
    prepaids,
    prepaidInterestDays,
    prepaidInterest,
    sellerCreditAmount,
    closingNeed,
    buydownNeed,
    appliedToClosing,
    poolAfterClosing,
    appliedToBuydown,
    sellerCreditWasted,
    maxUsableSellerCredit,
    buydownShortfall,
    buydownCostToBuyer,
    cashToClose,
    remainingAfterClose,
    ltv,
    ltvBasedConcessionPct,
    maxConcessionAmount,
    totalSellerAsk,
    sellerCreditExceedsCap,
    cashToCloseSub,
    holdMonths,
    termData,
    t30,
    cheapestHold,
    selectedData,
    compareChartData,
    maxYears,
    chartData,
    equityMaxYears,
    equityChartData,
    homeValueAtSale,
    loanBalanceAtSale,
    equityAtSale,
  };
}

export interface EquityMaximizerResult {
  recommendedExtra: number;
  balanceAtSale: number;
  equityAtSale: number;
  fullyPaidOff: boolean;
}

export function maximizeEquityAtSale(
  inputs: LoanInputs,
  maxExtraBudget: number,
): EquityMaximizerResult {
  const trial = (extra: number) =>
    computeMortgagePlan({
      ...inputs,
      extraMode: "custom",
      customExtra: extra,
      refiExtraOverride: null,
    });

  const atBudget = trial(maxExtraBudget);
  if (atBudget.loanBalanceAtSale > 0) {
    return {
      recommendedExtra: maxExtraBudget,
      balanceAtSale: atBudget.loanBalanceAtSale,
      equityAtSale: atBudget.equityAtSale,
      fullyPaidOff: false,
    };
  }

  let lo = 0;
  let hi = maxExtraBudget;
  for (let i = 0; i < 40; i += 1) {
    const mid = (lo + hi) / 2;
    if (trial(mid).loanBalanceAtSale <= 0) hi = mid;
    else lo = mid;
  }

  const rounded = Math.min(Math.ceil(hi / 25) * 25, maxExtraBudget);
  const finalPlan = trial(rounded);
  return {
    recommendedExtra: rounded,
    balanceAtSale: finalPlan.loanBalanceAtSale,
    equityAtSale: finalPlan.equityAtSale,
    fullyPaidOff: true,
  };
}
