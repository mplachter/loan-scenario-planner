import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Explain, ExplainerNote } from "@/components/ui/explainer";
import { Field } from "@/components/ui/field";
import { NumberInput } from "@/components/ui/number-input";
import { SectionTitle } from "@/components/ui/section-title";
import { Stat } from "@/components/ui/stat";
import { Switch } from "@/components/ui/switch";
import { dateToMonthISO, formatMonthYear, monthToDateISO } from "@/lib/dates";
import type { ClosedLoanInputs, LoanInputs } from "@/lib/defaults";
import {
  createLumpSumEvent,
  createRecastEvent,
  createRefinanceEvent,
} from "@/lib/events";
import { usd0 } from "@/lib/mortgage";
import {
  compareTimelines,
  prepayVsInvest,
  type ServicingContext,
  type ServicingResult,
} from "@/lib/servicing";

interface ManageTabProps {
  inputs: ClosedLoanInputs;
  onChange: (patch: Partial<LoanInputs>) => void;
  ctx: ServicingContext;
  result: ServicingResult;
  currentMonth: number;
}

export function ManageTab({
  inputs,
  onChange,
  ctx,
  result,
  currentMonth,
}: ManageTabProps) {
  return (
    <>
      {inputs.downPct < 20 && (
        <PmiCard ctx={ctx} result={result} currentMonth={currentMonth} />
      )}
      <PaymentCreepCard inputs={inputs} onChange={onChange} result={result} />
      <WindfallCard
        inputs={inputs}
        onChange={onChange}
        ctx={ctx}
        currentMonth={currentMonth}
        currentScheduledPI={
          result.rows[Math.max(currentMonth, 1) - 1]?.scheduledPI ?? 0
        }
      />
      <PrepayVsInvestCard
        inputs={inputs}
        onChange={onChange}
        ctx={ctx}
        liveResult={result}
      />
    </>
  );
}

function PmiCard({
  ctx,
  result,
  currentMonth,
}: {
  ctx: ServicingContext;
  result: ServicingResult;
  currentMonth: number;
}) {
  const currentBalance = result.balanceAt(currentMonth);
  const appreciatedValueToday =
    ctx.purchasePrice *
    Math.pow(1 + ctx.homeAppreciationPct / 100, currentMonth / 12);
  const ltvOriginal = (currentBalance / ctx.purchasePrice) * 100;
  const ltvAppreciated = (currentBalance / appreciatedValueToday) * 100;

  const pmiPaidToDate = result.rows
    .slice(0, Math.max(currentMonth, 0))
    .reduce((sum, r) => sum + r.pmi, 0);

  const requestRow =
    result.pmiRequestMonth !== null
      ? result.rows[result.pmiRequestMonth - 1]
      : null;
  const monthlyPmiEstimate = requestRow?.pmi ?? 0;

  const showAppraisalCallout =
    result.pmiAppraisalMonth !== null &&
    result.pmiRequestMonth !== null &&
    result.pmiAppraisalMonth < result.pmiRequestMonth;
  const monthsEarlier =
    showAppraisalCallout && result.pmiRequestMonth !== null
      ? result.pmiRequestMonth - result.pmiAppraisalMonth!
      : 0;
  const dollarsSaved = monthsEarlier * monthlyPmiEstimate;

  return (
    <>
      <SectionTitle
        title={
          <>
            PMI removal <Explain k="pmiRemoval" />
          </>
        }
        note="Three paths off PMI, and which one gets you there fastest."
      />
      <Card className="mb-6">
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <Stat
              label="LTV (original price)"
              value={`${ltvOriginal.toFixed(1)}%`}
            />
            <Stat
              label="LTV (appreciated value)"
              value={`${ltvAppreciated.toFixed(1)}%`}
            />
            <Stat label="PMI paid to date" value={usd0(pmiPaidToDate)} />
            <Stat
              label="PMI paid, projected total"
              value={usd0(result.totalPMIPaid)}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4 text-sm">
            <div className="rounded-lg border border-slate-200 p-3">
              <div className="text-xs font-semibold text-slate-500 mb-1">
                Request removal (80% original)
              </div>
              <div className="font-medium">
                {result.pmiRequestMonth !== null
                  ? formatMonthYear(
                      monthToDateISO(
                        ctx.firstPaymentDate,
                        result.pmiRequestMonth,
                      ),
                    )
                  : "Already gone / not applicable"}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <div className="text-xs font-semibold text-slate-500 mb-1">
                Automatic termination (78%)
              </div>
              <div className="font-medium">
                {result.pmiAutoMonth !== null
                  ? formatMonthYear(
                      monthToDateISO(ctx.firstPaymentDate, result.pmiAutoMonth),
                    )
                  : "Already gone / not applicable"}
              </div>
            </div>
            <div className="rounded-lg border border-teal-200 bg-teal-50 p-3">
              <div className="text-xs font-semibold text-teal-700 mb-1">
                New appraisal (80% appreciated, 2yr min)
              </div>
              <div className="font-medium">
                {result.pmiAppraisalMonth !== null
                  ? formatMonthYear(
                      monthToDateISO(
                        ctx.firstPaymentDate,
                        result.pmiAppraisalMonth,
                      ),
                    )
                  : "Not yet eligible / not applicable"}
              </div>
            </div>
          </div>
          {result.pmiRequestMonth !== null && (
            <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 text-sm text-teal-900 mb-3">
              You can request removal in{" "}
              <strong>
                {formatMonthYear(
                  monthToDateISO(ctx.firstPaymentDate, result.pmiRequestMonth),
                )}
              </strong>
              .{" "}
              {showAppraisalCallout && result.pmiAppraisalMonth !== null && (
                <>
                  With a new appraisal you may qualify as early as{" "}
                  <strong>
                    {formatMonthYear(
                      monthToDateISO(
                        ctx.firstPaymentDate,
                        result.pmiAppraisalMonth,
                      ),
                    )}
                  </strong>{" "}
                  — that's {monthsEarlier} month{monthsEarlier === 1 ? "" : "s"}{" "}
                  and roughly {usd0(dollarsSaved)} of PMI.
                </>
              )}
            </div>
          )}
          <div className="text-xs text-slate-500 mb-3">
            Paying extra toward principal pulls all three dates earlier — add a
            monthly extra on the Timeline tab and check back here.
          </div>
          <ExplainerNote k="pmiRemoval" />
        </CardContent>
      </Card>
    </>
  );
}

function PaymentCreepCard({
  inputs,
  onChange,
  result,
}: {
  inputs: ClosedLoanInputs;
  onChange: (patch: Partial<LoanInputs>) => void;
  result: ServicingResult;
}) {
  const chartData = result.yearly.map((y) => ({
    year: y.year,
    pi: y.monthlyPayment,
    escrow: y.escrow,
    total: y.monthlyPayment + y.escrow,
  }));

  const paymentToday = chartData[0]?.total ?? 0;
  const payment5 = chartData[Math.min(5, chartData.length - 1)]?.total ?? 0;
  const payment10 = chartData[Math.min(10, chartData.length - 1)]?.total ?? 0;
  const escrowInflation =
    (chartData[chartData.length - 1]?.escrow ?? 0) * 12 -
    (chartData[0]?.escrow ?? 0) * 12;

  return (
    <>
      <SectionTitle
        title={
          <>
            Payment creep <Explain k="paymentCreep" />
          </>
        }
        note="Your P&I is fixed. Taxes and insurance aren't — this is what your total payment actually does over time."
      />
      <Card className="mb-6">
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <Stat label="Payment today" value={`${usd0(paymentToday)}/mo`} />
            <Stat label="Payment in 5 years" value={`${usd0(payment5)}/mo`} />
            <Stat label="Payment in 10 years" value={`${usd0(payment10)}/mo`} />
            <Stat
              label="Escrow inflation over the loan"
              tone={escrowInflation > 0 ? "negative" : "default"}
              value={`+${usd0(escrowInflation)}/yr`}
            />
          </div>
          <div style={{ height: 260 }} className="mb-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 10, right: 20, left: 10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="year"
                  tick={{ fontSize: 12 }}
                  label={{
                    value: "Year",
                    position: "insideBottom",
                    offset: -2,
                    fontSize: 12,
                  }}
                />
                <YAxis
                  tickFormatter={(v) => `$${Math.round(v)}`}
                  tick={{ fontSize: 12 }}
                  width={55}
                />
                <RechartsTooltip
                  formatter={(v: number) => `${usd0(v)}/mo`}
                  labelFormatter={(l) => `Year ${l}`}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line
                  type="monotone"
                  dataKey="pi"
                  name="Principal & interest"
                  stroke="#94a3b8"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="escrow"
                  name="Escrow"
                  stroke="#c026d3"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="total"
                  name="Total payment"
                  stroke="#0f766e"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="grid md:grid-cols-3 gap-4 mb-3">
            <Field label="Property tax inflation">
              <NumberInput
                value={inputs.taxInflationPct}
                onChange={(v) => onChange({ taxInflationPct: v })}
                suffix="%/yr"
                step={0.25}
              />
            </Field>
            <Field
              label="Insurance inflation"
              hint="Defaults to 6%/yr — this app's default insurance figures reference Florida homeowner's rates, which have been climbing faster than the national average."
            >
              <NumberInput
                value={inputs.insuranceInflationPct}
                onChange={(v) => onChange({ insuranceInflationPct: v })}
                suffix="%/yr"
                step={0.25}
              />
            </Field>
            <div className="flex items-center gap-2 pt-5">
              <Switch
                checked={inputs.escrowDriftEnabled}
                onCheckedChange={(checked) =>
                  onChange({ escrowDriftEnabled: checked })
                }
              />
              <span className="text-sm text-slate-600">Model escrow drift</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function WindfallCard({
  inputs,
  onChange,
  ctx,
  currentMonth,
  currentScheduledPI,
}: {
  inputs: ClosedLoanInputs;
  onChange: (patch: Partial<LoanInputs>) => void;
  ctx: ServicingContext;
  currentMonth: number;
  currentScheduledPI: number;
}) {
  const [amount, setAmount] = useState(40000);
  const [dateISO, setDateISO] = useState(
    monthToDateISO(ctx.firstPaymentDate, Math.max(currentMonth, 1)),
  );
  const [recastFee, setRecastFee] = useState(300);
  const [refiRate, setRefiRate] = useState(
    Math.max((inputs.servicedRate ?? 6) - 1, 0.25),
  );

  const windfallMonth = Math.max(
    dateToMonthISO(ctx.firstPaymentDate, dateISO),
    1,
  );

  const comparisons = useMemo(() => {
    const lumpEvent = createLumpSumEvent(windfallMonth, { amount });
    const recastEvent = createRecastEvent(windfallMonth, {
      lumpSum: amount,
      fee: recastFee,
    });
    const refiEvent = createRefinanceEvent(windfallMonth, {
      rate: refiRate,
      termYears: inputs.servicedTerm ?? 30,
      closingCostPct: 2,
      rollCostsIn: true,
    });
    return compareTimelines(ctx, [
      { name: "Do nothing extra", events: inputs.events },
      { name: "Lump sum", events: [...inputs.events, lumpEvent] },
      { name: "Lump + recast", events: [...inputs.events, recastEvent] },
      { name: "Refinance", events: [...inputs.events, refiEvent] },
    ]).filter((c) => c.name !== "Do nothing");
  }, [
    ctx,
    inputs.events,
    inputs.servicedTerm,
    windfallMonth,
    amount,
    recastFee,
    refiRate,
  ]);

  const doNothingExtra = comparisons.find(
    (c) => c.name === "Do nothing extra",
  )!;
  const candidates = comparisons.filter((c) => c.name !== "Do nothing extra");
  const ranked = candidates
    .map((c) => {
      const interestVsCurrent =
        doNothingExtra.result.totalInterest - c.result.totalInterest;
      const feesVsCurrent =
        c.result.totalFees - doNothingExtra.result.totalFees;
      return { ...c, netBenefit: interestVsCurrent - feesVsCurrent };
    })
    .sort((a, b) => b.netBenefit - a.netBenefit);
  const best = ranked[0];

  // Regenerated on click (fresh id) rather than reusing the trial events built
  // for `comparisons` above — this becomes a real, permanent timeline entry,
  // not the throwaway what-if used for the comparison table.
  function addToTimeline(name: (typeof candidates)[number]["name"]) {
    if (name === "Lump sum") {
      onChange({
        events: [
          ...inputs.events,
          createLumpSumEvent(windfallMonth, { amount }),
        ],
      });
    } else if (name === "Lump + recast") {
      onChange({
        events: [
          ...inputs.events,
          createRecastEvent(windfallMonth, { lumpSum: amount, fee: recastFee }),
        ],
      });
    } else if (name === "Refinance") {
      onChange({
        events: [
          ...inputs.events,
          createRefinanceEvent(windfallMonth, {
            rate: refiRate,
            termYears: inputs.servicedTerm ?? 30,
            closingCostPct: 2,
            rollCostsIn: true,
          }),
        ],
      });
    }
  }

  return (
    <>
      <SectionTitle
        title="Windfall: lump sum, recast, or refinance?"
        note="Every option here stacks on top of your live timeline — never a bare loan."
      />
      <Card className="mb-6">
        <CardContent>
          <div className="grid md:grid-cols-3 gap-3 mb-4">
            <Field label="Amount available">
              <NumberInput
                value={amount}
                onChange={setAmount}
                prefix="$"
                step={1000}
              />
            </Field>
            <Field label="Date">
              <input
                type="date"
                value={dateISO}
                onChange={(e) => setDateISO(e.target.value)}
                className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
              />
            </Field>
            <Field label="Recast fee">
              <NumberInput
                value={recastFee}
                onChange={setRecastFee}
                prefix="$"
                step={25}
              />
            </Field>
            <Field label="Refinance rate">
              <NumberInput
                value={refiRate}
                onChange={setRefiRate}
                suffix="%"
                step={0.05}
              />
            </Field>
            <div className="flex items-center gap-1 md:col-span-2 text-xs text-slate-400 self-end pb-2">
              <Explain k="recast" />
              <span>Recast is the one most people have never heard of.</span>
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table className="w-full text-sm" style={{ minWidth: 520 }}>
              <thead>
                <tr>
                  <th className="text-left py-2 pr-3 font-medium text-slate-500" />
                  {candidates.map((c) => (
                    <th
                      key={c.name}
                      className={`text-right py-2 px-3 ${c.name === best?.name ? "bg-teal-50 rounded-t-lg" : ""}`}
                    >
                      {c.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-100">
                  <td className="py-2 pr-3 text-slate-500">Payoff date</td>
                  {candidates.map((c) => (
                    <td
                      key={c.name}
                      className={`py-2 px-3 text-right tabular-nums ${c.name === best?.name ? "bg-teal-50" : ""}`}
                    >
                      {formatMonthYear(c.result.payoffDate)}
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="py-2 pr-3 text-slate-500">
                    Required payment after
                  </td>
                  {candidates.map((c) => (
                    <td
                      key={c.name}
                      className={`py-2 px-3 text-right tabular-nums ${c.name === best?.name ? "bg-teal-50" : ""}`}
                    >
                      {usd0(
                        c.result.rows[windfallMonth - 1]?.scheduledPI ??
                          currentScheduledPI,
                      )}
                      /mo
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="py-2 pr-3 text-slate-500">Total interest</td>
                  {candidates.map((c) => (
                    <td
                      key={c.name}
                      className={`py-2 px-3 text-right tabular-nums ${c.name === best?.name ? "bg-teal-50" : ""}`}
                    >
                      {usd0(c.result.totalInterest)}
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="py-2 pr-3 text-slate-500">Cost to execute</td>
                  {candidates.map((c) => (
                    <td
                      key={c.name}
                      className={`py-2 px-3 text-right tabular-nums ${c.name === best?.name ? "bg-teal-50" : ""}`}
                    >
                      {usd0(
                        c.result.totalFees - doNothingExtra.result.totalFees,
                      )}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2 pr-3" />
                  {candidates.map((c) => (
                    <td
                      key={c.name}
                      className={`py-2 px-3 text-right ${c.name === best?.name ? "bg-teal-50 rounded-b-lg" : ""}`}
                    >
                      <button
                        type="button"
                        onClick={() => addToTimeline(c.name)}
                        className="text-xs px-2 py-1 rounded border border-slate-300 hover:border-slate-400 text-slate-600"
                      >
                        Add to timeline
                      </button>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {best && (
            <div className="mt-4 bg-slate-100 rounded-lg p-3 text-sm text-slate-700">
              <span className="font-medium text-slate-800">{best.name}</span>{" "}
              looks best here — {usd0(Math.abs(best.netBenefit))}{" "}
              {best.netBenefit >= 0 ? "net better" : "net worse"} than doing
              nothing extra with this money, after fees.
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function PrepayVsInvestCard({
  inputs,
  onChange,
  ctx,
  liveResult,
}: {
  inputs: ClosedLoanInputs;
  onChange: (patch: Partial<LoanInputs>) => void;
  ctx: ServicingContext;
  liveResult: ServicingResult;
}) {
  const [extraMonthly, setExtraMonthly] = useState(200);
  const [horizonYears, setHorizonYears] = useState(() =>
    Math.max(Math.round(liveResult.payoffMonth / 12), 1),
  );

  const horizonMonths = horizonYears * 12;

  const trial = useMemo(
    () =>
      prepayVsInvest(
        ctx,
        inputs.events,
        extraMonthly,
        inputs.investReturnPct,
        inputs.investTaxRatePct,
        horizonMonths,
      ),
    [
      ctx,
      inputs.events,
      inputs.investReturnPct,
      inputs.investTaxRatePct,
      extraMonthly,
      horizonMonths,
    ],
  );

  return (
    <>
      <SectionTitle
        title={
          <>
            Prepay vs. invest <Explain k="prepayVsInvest" />
          </>
        }
        note="Whichever wins depends on your invest return assumption — evaluated on top of your live timeline, not a bare loan."
      />
      <Card className="mb-6">
        <CardContent>
          <div className="grid md:grid-cols-4 gap-3 mb-4">
            <Field label="Additional extra per month">
              <NumberInput
                value={extraMonthly}
                onChange={setExtraMonthly}
                prefix="$"
                step={25}
              />
            </Field>
            <Field label="Expected investment return">
              <NumberInput
                value={inputs.investReturnPct}
                onChange={(v) => onChange({ investReturnPct: v })}
                suffix="%"
                step={0.25}
              />
            </Field>
            <Field label="Tax rate on investment gains">
              <NumberInput
                value={inputs.investTaxRatePct}
                onChange={(v) => onChange({ investTaxRatePct: v })}
                suffix="%"
                step={1}
              />
            </Field>
            <Field label="Horizon (years from now)">
              <NumberInput
                value={horizonYears}
                onChange={setHorizonYears}
                suffix="yr"
                step={1}
                min={1}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="rounded-lg border border-slate-200 p-3">
              <div className="text-xs font-semibold text-slate-500 mb-2">
                Prepay the mortgage
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Contributions</span>
                  <span>{usd0(trial.contributions)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Interest saved</span>
                  <span>{usd0(trial.interestSaved)}</span>
                </div>
                <div className="flex justify-between font-semibold border-t border-slate-100 pt-1">
                  <span>Value at horizon</span>
                  <span>{usd0(trial.prepayValue)}</span>
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <div className="text-xs font-semibold text-slate-500 mb-2">
                Invest it instead
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Contributions</span>
                  <span>{usd0(trial.contributions)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Gains (pre-tax)</span>
                  <span>{usd0(trial.investGains)}</span>
                </div>
                <div className="flex justify-between font-semibold border-t border-slate-100 pt-1">
                  <span>Value at horizon (after tax)</span>
                  <span>{usd0(trial.investValueAfterTax)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-100 rounded-lg p-3 text-sm text-slate-700 mb-3">
            <span className="font-medium text-slate-800">
              {trial.winner === "prepay" ? "Prepaying" : "Investing"}
            </span>{" "}
            wins at your assumed {inputs.investReturnPct}% return, by{" "}
            {usd0(Math.abs(trial.prepayValue - trial.investValueAfterTax))}. The
            two tie at a{" "}
            <span className="font-medium text-slate-800">
              {trial.crossoverReturnPct.toFixed(2)}%
            </span>{" "}
            return rate — below that, prepaying wins; above it, investing does.
          </div>
          <ExplainerNote k="prepayVsInvest" />
        </CardContent>
      </Card>
    </>
  );
}
