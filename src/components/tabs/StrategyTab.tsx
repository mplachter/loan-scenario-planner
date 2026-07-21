import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { NumberInput } from "@/components/ui/number-input";
import { SectionTitle } from "@/components/ui/section-title";
import { Stat } from "@/components/ui/stat";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  TERMS,
  type ExtraMode,
  type LoanInputs,
  type LoanTerm,
} from "@/lib/defaults";
import { usd0 } from "@/lib/mortgage";
import type { MortgagePlan } from "@/lib/plan";

interface StrategyTabProps {
  inputs: LoanInputs;
  onChange: (patch: Partial<LoanInputs>) => void;
  plan: MortgagePlan;
}

export function StrategyTab({ inputs, onChange, plan }: StrategyTabProps) {
  const {
    term,
    buydown,
    extraMode,
    customExtra,
    refiEnabled,
    refiYear,
    refiTerm,
    refiRate,
    refiClosingCostPct,
    continueExtraAfterRefi,
    refiExtraOverride,
  } = inputs;
  const {
    rate,
    standardPI,
    y1Payment,
    y2Payment,
    buydownSubsidy,
    extraY1,
    extraY2,
    extraMonthly,
    extraSteady,
    accelerated,
    monthsSaved,
    yearsSavedWhole,
    monthsSavedRem,
    interestSaved,
    matchCompare,
    refiPlan,
    chartData,
  } = plan;

  return (
    <>
      <SectionTitle
        title="2-1 rate buydown"
        note="Temporarily lowers your out-of-pocket payment in years 1-2 by 2% and 1%. The loan still amortizes at the full note rate — a subsidy account (funded by you or the seller) makes up the difference."
      />
      <Card className="mb-6">
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-medium text-slate-700">
              Model a 2-1 buydown
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <Switch
                checked={buydown}
                onCheckedChange={(checked) => onChange({ buydown: checked })}
              />
              <span className="text-sm text-slate-600">
                {buydown ? "On" : "Off"}
              </span>
            </label>
          </div>
          {buydown && (
            <>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <Stat
                  label={`Year 1 — ${(rate - 2).toFixed(2)}%`}
                  value={`${usd0(y1Payment)}/mo`}
                />
                <Stat
                  label={`Year 2 — ${(rate - 1).toFixed(2)}%`}
                  value={`${usd0(y2Payment)}/mo`}
                />
                <Stat
                  label={`Year 3+ — ${rate.toFixed(2)}%`}
                  value={`${usd0(standardPI)}/mo`}
                />
              </div>
              <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
                <div className="text-sm text-teal-900">
                  Subsidy account needed:{" "}
                  <span className="font-bold">{usd0(buydownSubsidy)}</span>
                </div>
                <div className="text-xs text-teal-700 mt-1">
                  That's real negotiating leverage — asking the seller to fund
                  this costs them roughly the same as a price credit, but it
                  front-loads relief into the two years you're most exposed to
                  income disruption.
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <SectionTitle
        title="Extra principal payments"
        note="Keep the low required payment of a longer term, but voluntarily pay more toward principal. You can always drop back to the minimum if cash flow gets tight — unlike a fixed 15-year commitment."
      />
      <Card className="mb-6">
        <CardContent>
          <ToggleGroup
            variant="outline"
            value={[extraMode]}
            onValueChange={(vals) => {
              const next = vals[0] as ExtraMode | undefined;
              if (next) onChange({ extraMode: next });
            }}
            className="mb-4 flex-wrap"
          >
            <ToggleGroupItem value="none">No extra</ToggleGroupItem>
            {term > 15 && (
              <ToggleGroupItem value="match15">
                Pay like a 15-yr
              </ToggleGroupItem>
            )}
            {term > 20 && (
              <ToggleGroupItem value="match20">
                Pay like a 20-yr
              </ToggleGroupItem>
            )}
            {term > 25 && (
              <ToggleGroupItem value="match25">
                Pay like a 25-yr
              </ToggleGroupItem>
            )}
            <ToggleGroupItem value="custom">Custom $</ToggleGroupItem>
            {buydown && (
              <ToggleGroupItem value="buydownToPrincipal">
                2-1 buydown savings → principal
              </ToggleGroupItem>
            )}
          </ToggleGroup>

          {extraMode === "custom" && (
            <div className="mb-4 max-w-xs">
              <Field label="Extra principal per month">
                <NumberInput
                  value={customExtra}
                  onChange={(v) => onChange({ customExtra: v })}
                  prefix="$"
                  step={25}
                />
              </Field>
            </div>
          )}

          {extraMode === "buydownToPrincipal" && (
            <div className="mb-4 bg-teal-50 border border-teal-200 rounded-lg p-3 text-xs text-teal-800">
              Instead of pocketing the buydown's cash-flow relief, this keeps
              your out-of-pocket payment at the full {usd0(standardPI)}/mo
              standard rate in years 1-2 and routes the {usd0(extraY1)}
              /mo (year 1) and {usd0(extraY2)}/mo (year 2) gap straight into
              extra principal — {usd0(extraY1 * 12 + extraY2 * 12)} total, the
              same size as the subsidy account above. It drops to $0 extra from
              year 3 on.
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
            {extraMode === "buydownToPrincipal" ? (
              <>
                <Stat label="Extra — year 1" value={`${usd0(extraY1)}/mo`} />
                <Stat label="Extra — year 2" value={`${usd0(extraY2)}/mo`} />
              </>
            ) : (
              <Stat label="Extra per month" value={usd0(extraMonthly)} />
            )}
            <Stat
              label="Payoff time"
              value={`${Math.floor(accelerated.months / 12)}y ${accelerated.months % 12}m`}
            />
            <Stat
              label="Time saved"
              tone="positive"
              value={
                monthsSaved > 0 ? `${yearsSavedWhole}y ${monthsSavedRem}m` : "—"
              }
            />
            <Stat
              label="Interest saved"
              tone="positive"
              value={interestSaved > 0 ? usd0(interestSaved) : "—"}
            />
          </div>

          <div style={{ height: 260 }}>
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
                  tickFormatter={(v) => `$${Math.round(v / 1000)}k`}
                  tick={{ fontSize: 12 }}
                  width={55}
                />
                <Tooltip
                  formatter={(v: number) => usd0(v)}
                  labelFormatter={(l) => `Year ${l}`}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line
                  type="monotone"
                  dataKey="baseline"
                  name={`${term}-yr standard`}
                  stroke="#94a3b8"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="accelerated"
                  name="With extra payments"
                  stroke="#0f766e"
                  strokeWidth={2}
                  dot={false}
                />
                {refiPlan && (
                  <Line
                    type="monotone"
                    dataKey="refi"
                    name={
                      refiPlan.continuedExtra > 0
                        ? `Refi in yr ${refiYear} + extra`
                        : `Refi in yr ${refiYear}`
                    }
                    stroke="#c026d3"
                    strokeWidth={2}
                    strokeDasharray="5 3"
                    dot={false}
                  />
                )}
                {refiPlan && refiPlan.continuedExtra > 0 && (
                  <Line
                    type="monotone"
                    dataKey="refiBase"
                    name={`Refi in yr ${refiYear}, P&I only`}
                    stroke="#e9a5f1"
                    strokeWidth={2}
                    strokeDasharray="2 2"
                    dot={false}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {matchCompare && (
        <Card className="mb-6">
          <CardContent>
            <div className="text-sm font-medium text-slate-700 mb-1">
              "Pay like a {matchCompare.matchTerm}-yr" vs. an actual{" "}
              {matchCompare.matchTerm}-yr loan
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Same monthly discipline, different rate. Your {term}-yr note is
              priced at {rate.toFixed(2)}% no matter how fast you pay it off — a
              real {matchCompare.matchTerm}-yr loan gets today's{" "}
              {matchCompare.matchTerm}-yr rate of{" "}
              {matchCompare.directRate.toFixed(2)}% instead.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border border-slate-200 p-3">
                <div className="text-xs font-semibold text-slate-500 mb-2">
                  {term}-yr loan, paying like a {matchCompare.matchTerm}-yr
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Rate</span>
                    <span>{rate.toFixed(2)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Monthly payment</span>
                    <span className="font-semibold">
                      {usd0(matchCompare.stratPayment)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Payoff</span>
                    <span>
                      {Math.floor(matchCompare.stratMonths / 12)}y{" "}
                      {matchCompare.stratMonths % 12}m
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Total interest</span>
                    <span>{usd0(matchCompare.stratInterest)}</span>
                  </div>
                </div>
                <div className="text-xs text-teal-700 mt-2">
                  ✓ Can drop to {usd0(standardPI)}/mo minimum anytime
                </div>
              </div>
              <div className="rounded-lg border border-teal-200 bg-teal-50 p-3">
                <div className="text-xs font-semibold text-slate-500 mb-2">
                  Actual {matchCompare.matchTerm}-yr loan
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Rate</span>
                    <span>{matchCompare.directRate.toFixed(2)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Monthly payment</span>
                    <span className="font-semibold">
                      {usd0(matchCompare.directPayment)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Payoff</span>
                    <span>{matchCompare.matchTerm}y 0m</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Total interest</span>
                    <span>{usd0(matchCompare.directInterest)}</span>
                  </div>
                </div>
                <div className="text-xs text-red-600 mt-2">
                  ✗ Locked into {usd0(matchCompare.directPayment)}/mo, no
                  opt-out
                </div>
              </div>
            </div>
            <div className="mt-4 bg-slate-100 rounded-lg p-3 text-sm text-slate-700">
              The delta: paying like a {matchCompare.matchTerm}-yr on your{" "}
              {term}-yr note costs{" "}
              <span
                className={
                  matchCompare.interestDelta > 0
                    ? "text-red-600 font-semibold"
                    : "text-teal-700 font-semibold"
                }
              >
                {usd0(Math.abs(matchCompare.interestDelta))}{" "}
                {matchCompare.interestDelta > 0 ? "more" : "less"}
              </span>{" "}
              in interest and pays off{" "}
              {matchCompare.monthsDelta === 0
                ? "at the same time"
                : `${Math.abs(matchCompare.monthsDelta)} month${
                    Math.abs(matchCompare.monthsDelta) === 1 ? "" : "s"
                  } ${matchCompare.monthsDelta > 0 ? "later" : "earlier"}`}{" "}
              than the real {matchCompare.matchTerm}-yr loan. That gap is the
              price of keeping the option to fall back to the lower required
              payment whenever you need to.
            </div>
          </CardContent>
        </Card>
      )}

      <SectionTitle
        title="Refinance later"
        note="Model swapping your loan for a new one partway through — a common move if rates drop or your income situation changes."
      />
      <Card className="mb-6">
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-medium text-slate-700">
              Model a future refinance
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <Switch
                checked={refiEnabled}
                onCheckedChange={(checked) =>
                  onChange({ refiEnabled: checked })
                }
              />
              <span className="text-sm text-slate-600">
                {refiEnabled ? "On" : "Off"}
              </span>
            </label>
          </div>

          {refiEnabled && refiPlan && (
            <>
              {extraMode !== "none" && (
                <div className="mb-4 bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-slate-700">
                        Continue extra payments after refinancing
                      </div>
                      <div className="text-xs text-slate-500">
                        Keep paying extra toward the new loan's principal
                        instead of dropping back to the standard payment.
                      </div>
                    </div>
                    <Switch
                      checked={continueExtraAfterRefi}
                      onCheckedChange={(checked) =>
                        onChange({ continueExtraAfterRefi: checked })
                      }
                    />
                  </div>
                  {continueExtraAfterRefi && (
                    <div className="mt-3 max-w-xs">
                      <Field
                        label="Continued extra payment (monthly)"
                        hint="Defaults to matching your current extra payment. Refinancing into a fresh term lowers the required minimum payment, so raise this if you want the new loan to pay off just as fast."
                      >
                        <NumberInput
                          value={refiExtraOverride ?? extraSteady}
                          onChange={(v) => onChange({ refiExtraOverride: v })}
                          prefix="$"
                          step={25}
                        />
                      </Field>
                      {refiExtraOverride !== null && (
                        <button
                          type="button"
                          onClick={() => onChange({ refiExtraOverride: null })}
                          className="text-xs px-2 py-1 mt-2 rounded border border-slate-300 hover:border-slate-400 text-slate-600"
                        >
                          Match my extra payment ({usd0(extraSteady)}/mo)
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
              <div className="grid md:grid-cols-2 gap-4 mb-4">
                <Field
                  label={`Refinance in year ${refiYear}`}
                  hint="Based on your current plan's balance at that point (including any extra payments)."
                >
                  <input
                    type="range"
                    min="1"
                    max={Math.max(Math.ceil(accelerated.months / 12) - 1, 1)}
                    step="1"
                    value={refiYear}
                    onChange={(e) =>
                      onChange({ refiYear: parseInt(e.target.value, 10) })
                    }
                    className="w-full"
                  />
                </Field>
                <Field
                  label="New rate"
                  hint="Whatever you'd expect to get at refi time — this is a guess."
                >
                  <NumberInput
                    value={refiRate}
                    onChange={(v) => onChange({ refiRate: v })}
                    suffix="%"
                    step={0.05}
                  />
                </Field>
              </div>

              <div className="mb-2 text-xs font-medium text-slate-600">
                New loan term
              </div>
              <ToggleGroup
                variant="outline"
                value={[String(refiTerm)]}
                onValueChange={(vals) => {
                  const next = vals[0];
                  if (next) onChange({ refiTerm: Number(next) as LoanTerm });
                }}
                className="mb-4 flex-wrap"
              >
                {TERMS.map((t) => (
                  <ToggleGroupItem key={t} value={String(t)}>
                    {t}-year
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>

              <div className="max-w-sm mb-2">
                <Field
                  label="Refi closing costs"
                  hint="Rolled into the new loan balance."
                >
                  <NumberInput
                    value={refiClosingCostPct}
                    onChange={(v) => onChange({ refiClosingCostPct: v })}
                    suffix="%"
                    step={0.25}
                  />
                </Field>
                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => onChange({ refiClosingCostPct: 1 })}
                    className="text-xs px-2 py-1 rounded border border-slate-300 hover:border-slate-400 text-slate-600"
                  >
                    Low (1%)
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange({ refiClosingCostPct: 2 })}
                    className="text-xs px-2 py-1 rounded border border-slate-300 hover:border-slate-400 text-slate-600"
                  >
                    Typical (2%)
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange({ refiClosingCostPct: 4 })}
                    className="text-xs px-2 py-1 rounded border border-slate-300 hover:border-slate-400 text-slate-600"
                  >
                    Complex (4%)
                  </button>
                </div>
              </div>

              <div className="mb-5 bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600">
                <span className="font-medium text-slate-700">
                  What's actually in that number:{" "}
                </span>
                lender's title insurance/settlement (usually the largest piece —
                refis skip owner's title, so this runs cheaper than your
                original purchase), appraisal (~$500–$700, sometimes waived),
                origination/underwriting fee (0–1% of loan), credit report,
                recording fees, and a flood/tax service fee. Third-party data
                (ClosingCorp/Freddie Mac) puts the actual non-tax average closer
                to $2,500–$5,000 on a typical loan — lender marketing pages
                often quote a wider 2–6% range. Ask your lender for a Loan
                Estimate to see the real number, and shop at least 3 lenders —
                data suggests that alone saves people real money.
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                <Stat
                  label="Balance at refi"
                  value={usd0(refiPlan.balanceAtRefi)}
                />
                <Stat
                  label="Est. refi fees"
                  value={usd0(refiPlan.refiClosingCosts)}
                />
                <Stat
                  label="New loan amount"
                  value={usd0(refiPlan.newLoanAmount)}
                />
                <Stat
                  label="New payment"
                  value={`${usd0(refiPlan.payment)}/mo`}
                />
                <Stat
                  label="Payment change"
                  tone={refiPlan.paymentDelta <= 0 ? "positive" : "negative"}
                  value={`${refiPlan.paymentDelta >= 0 ? "+" : "-"}${usd0(Math.abs(refiPlan.paymentDelta))}/mo`}
                  sub={`vs ${usd0(standardPI)}/mo now`}
                />
              </div>

              <div className="bg-slate-100 rounded-lg p-4 text-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="text-slate-600">
                    Remaining interest if you never refi:{" "}
                    <span className="font-semibold">
                      {usd0(refiPlan.remainingInterestIfNoRefi)}
                    </span>
                  </span>
                  <span className="text-slate-600">
                    Remaining interest with this refi:{" "}
                    <span className="font-semibold">
                      {usd0(refiPlan.totalInterest)}
                    </span>
                  </span>
                </div>
                <div
                  className={`mt-2 font-semibold ${refiPlan.netSavings > 0 ? "text-teal-700" : "text-red-600"}`}
                >
                  {refiPlan.netSavings > 0
                    ? `${usd0(refiPlan.netSavings)} net savings after closing costs`
                    : `${usd0(Math.abs(refiPlan.netSavings))} net cost after closing costs`}
                </div>
                {refiPlan.breakevenMonths ? (
                  <div className="text-xs text-slate-500 mt-1">
                    Lower payment breaks even on closing costs in{" "}
                    {refiPlan.breakevenMonths} months (
                    {(refiPlan.breakevenMonths / 12).toFixed(1)} years) — refi
                    is worth it if you'll keep the home longer than that.
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 mt-1">
                    Your payment doesn't drop with this refi, so there's no
                    payment breakeven — any case for it rests on the total
                    interest comparison above.
                  </div>
                )}
                <div className="text-xs text-slate-500 mt-1">
                  Debt-free in year {Math.round(refiPlan.newPayoffYear)} with
                  this refi vs. year {Math.round(refiPlan.originalPayoffYear)}{" "}
                  on your current plan.
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}
