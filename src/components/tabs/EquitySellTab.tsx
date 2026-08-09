import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Explain } from "@/components/ui/explainer";
import { Field } from "@/components/ui/field";
import { NumberInput } from "@/components/ui/number-input";
import { SectionTitle } from "@/components/ui/section-title";
import { Slider } from "@/components/ui/slider";
import { Stat } from "@/components/ui/stat";
import type { ClosedLoanInputs, LoanInputs } from "@/lib/defaults";
import { usd0 } from "@/lib/mortgage";
import { computeMortgagePlan } from "@/lib/plan";
import {
  netProceedsAt,
  type ServicingContext,
  type ServicingResult,
} from "@/lib/servicing";

interface EquitySellTabProps {
  inputs: ClosedLoanInputs;
  onChange: (patch: Partial<LoanInputs>) => void;
  ctx: ServicingContext;
  result: ServicingResult;
  currentMonth: number;
}

export function EquitySellTab({
  inputs,
  onChange,
  ctx,
  result,
  currentMonth,
}: EquitySellTabProps) {
  // computeMortgagePlan is the Buying-mode engine, but downPayment and
  // cashToClose describe money already spent at closing — a fact that doesn't
  // change once you're in Owning mode, so it's still the source of truth for
  // "cash in" rather than duplicating that math here.
  const plan = useMemo(() => computeMortgagePlan(inputs), [inputs]);

  const currentYear = Math.max(Math.round(currentMonth / 12), 0);
  const maxYear = Math.max(result.yearly.length - 1, 1);
  const [saleYear, setSaleYear] = useState(() =>
    Math.min(currentYear + 5, maxYear),
  );

  const proceeds = netProceedsAt(ctx, result, saleYear, inputs.sellingCostPct);

  const outOfPocketToSale = useMemo(
    () =>
      result.rows
        .filter((r) => r.month <= saleYear * 12)
        .reduce((sum, r) => sum + r.fees, 0),
    [result.rows, saleYear],
  );
  // plan.cashToClose already folds in the down payment (see plan.ts) — don't
  // add it again here.
  const cashIn = plan.cashToClose + outOfPocketToSale;
  const netGain = proceeds.netProceeds - cashIn;

  const breakEvenYear = useMemo(() => {
    for (let y = 0; y <= 40; y++) {
      const outOfPocketAtY = result.rows
        .filter((r) => r.month <= y * 12)
        .reduce((sum, r) => sum + r.fees, 0);
      const cashInAtY = plan.cashToClose + outOfPocketAtY;
      if (
        netProceedsAt(ctx, result, y, inputs.sellingCostPct).netProceeds >=
        cashInAtY
      ) {
        return y;
      }
    }
    return null;
  }, [ctx, result, plan.cashToClose, inputs.sellingCostPct]);

  const chartData = result.yearly.map((y) => ({
    year: y.year,
    homeValue: y.homeValue,
    balance: y.balance,
    equity: y.equity,
  }));

  return (
    <>
      <SectionTitle
        title={
          <>
            Net proceeds if you sell <Explain k="netProceeds" />
          </>
        }
        note="What you'd actually walk away with, and when selling stops being a loss."
      />
      <Card className="mb-6">
        <CardContent>
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium text-slate-700">Sale year</div>
            <div className="text-sm font-bold text-teal-700">
              {saleYear === 0 ? "Today" : `Year ${saleYear} of ownership`}
            </div>
          </div>
          <Slider
            value={saleYear}
            onValueChange={(v) => setSaleYear(v as number)}
            min={0}
            max={maxYear}
            step={1}
          />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 my-5">
            <Stat label="Home value at sale" value={usd0(proceeds.homeValue)} />
            <Stat
              label={`Selling costs (${inputs.sellingCostPct}%)`}
              tone="negative"
              value={usd0(proceeds.sellingCosts)}
            />
            <Stat
              label="Loan balance"
              tone="negative"
              value={usd0(proceeds.loanBalance)}
            />
            <Stat
              label="Net proceeds"
              tone="positive"
              value={usd0(proceeds.netProceeds)}
            />
          </div>

          <div className="max-w-xs mb-4">
            <Field
              label="Selling costs"
              hint="Agent commissions, closing costs, transfer taxes — typically 6-8% of sale price."
            >
              <NumberInput
                value={inputs.sellingCostPct}
                onChange={(v) => onChange({ sellingCostPct: v })}
                suffix="%"
                step={0.5}
              />
            </Field>
          </div>

          <div className="bg-slate-100 rounded-lg p-4 text-sm">
            <div className="flex flex-wrap justify-between gap-2">
              <span className="text-slate-600">
                Cash in (down payment + closing costs + fees paid since):{" "}
                <span className="font-semibold">{usd0(cashIn)}</span>
              </span>
              <span className="text-slate-600">
                Net proceeds:{" "}
                <span className="font-semibold">
                  {usd0(proceeds.netProceeds)}
                </span>
              </span>
            </div>
            <div
              className={`mt-2 font-semibold ${netGain >= 0 ? "text-teal-700" : "text-red-600"}`}
            >
              {netGain >= 0
                ? `${usd0(netGain)} ahead of what you put in`
                : `${usd0(Math.abs(netGain))} behind what you put in`}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Break-even year — the first year net proceeds meet or exceed cash
              in —{" "}
              {breakEvenYear !== null
                ? `is year ${breakEvenYear}.`
                : "doesn't happen within 40 years at these assumptions."}
            </div>
            <div className="text-xs text-slate-400 mt-2">
              This ignores rent-vs-own opportunity cost — it's what you'd net
              from this specific sale, not a full buy-vs-rent analysis.
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardContent>
          <div className="text-sm font-medium text-slate-700 mb-3">
            Home value, balance, and equity over time
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
                <RechartsTooltip
                  formatter={(v: number) => usd0(v)}
                  labelFormatter={(l) => `Year ${l}`}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <ReferenceLine
                  x={currentYear}
                  stroke="#0f766e"
                  strokeDasharray="3 3"
                  label={{
                    value: "Today",
                    position: "top",
                    fontSize: 12,
                    fill: "#0f766e",
                  }}
                />
                <ReferenceLine
                  x={saleYear}
                  stroke="#c026d3"
                  strokeDasharray="3 3"
                  label={{
                    value: "Sale",
                    position: "top",
                    fontSize: 12,
                    fill: "#c026d3",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="homeValue"
                  name="Home value"
                  stroke="#64748b"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="balance"
                  name="Loan balance"
                  stroke="#94a3b8"
                  strokeWidth={2}
                  strokeDasharray="4 3"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="equity"
                  name="Equity"
                  stroke="#0f766e"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-slate-400 mt-3">
            Equity = projected home value minus your loan balance under your
            current timeline. Appreciation is a guess — actual home values can
            also decline.
          </p>
        </CardContent>
      </Card>
    </>
  );
}
