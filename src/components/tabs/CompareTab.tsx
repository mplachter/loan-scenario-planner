import type { ReactNode } from "react";
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
import { InlineNumberInput } from "@/components/ui/inline-number-input";
import { SectionTitle } from "@/components/ui/section-title";
import { Slider } from "@/components/ui/slider";
import { TERM_COLORS, TERMS, type LoanInputs } from "@/lib/defaults";
import { usd0 } from "@/lib/mortgage";
import type { MortgagePlan, TermData } from "@/lib/plan";

interface CompareTabProps {
  inputs: LoanInputs;
  onChange: (patch: Partial<LoanInputs>) => void;
  plan: MortgagePlan;
}

type CompareRow =
  | { label: string; render: (d: TermData) => ReactNode; divider?: undefined }
  | { divider: string; label?: undefined; render?: undefined };

export function CompareTab({ inputs, onChange, plan }: CompareTabProps) {
  const { term, rates, holdYears } = inputs;
  const {
    termData,
    t30,
    cheapestHold,
    selectedData,
    compareChartData,
    holdMonths,
  } = plan;

  const compareRows: CompareRow[] = [
    {
      label: "P&I / month",
      render: (d) => <span className="font-semibold">{usd0(d.payment)}</span>,
    },
    {
      label: "Total monthly (PITI + HOA)",
      render: (d) => usd0(d.totalMonthly),
    },
    {
      label: "vs 30-yr payment",
      render: (d) =>
        d.term === 30 ? (
          <span className="text-slate-400">baseline</span>
        ) : (
          <span className="text-red-600">
            +{usd0(d.payment - t30.payment)}/mo
          </span>
        ),
    },
    { divider: `Over your ${holdYears}-year hold` },
    {
      label: "Interest paid (sunk cost)",
      render: (d) => (
        <span
          className={
            d.term === cheapestHold.term ? "text-teal-700 font-semibold" : ""
          }
        >
          {usd0(d.interestAtHold)}
        </span>
      ),
    },
    {
      label: "Principal paid down",
      render: (d) => usd0(d.principalAtHold),
    },
    {
      label: "Loan balance remaining",
      render: (d) => usd0(d.balanceAtHold),
    },
    {
      label: "Equity built (at purchase price)",
      render: (d) => (
        <span className="font-semibold">{usd0(d.equityAtHold)}</span>
      ),
    },
    { divider: "Full term (if you kept it)" },
    {
      label: "Total interest",
      render: (d) => usd0(d.totalInterest),
    },
    {
      label: "Total paid",
      render: (d) => usd0(d.totalPaid),
    },
  ];

  return (
    <>
      <SectionTitle
        title="Term comparison"
        note={`All four terms side by side on a ${usd0(
          plan.loanAmount,
        )} loan. Click a column to make it your active term everywhere else. Rates are editable per term.`}
      />

      <Card className="mb-4">
        <CardContent>
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium text-slate-700">
              Ownership length
            </div>
            <div className="text-sm font-bold text-teal-700">
              {holdYears} years
            </div>
          </div>
          <Slider
            value={holdYears}
            onValueChange={(v) => onChange({ holdYears: v as number })}
            min={1}
            max={30}
            step={1}
          />
          <div className="text-xs text-slate-500 mt-1">
            If you'll sell or refinance before the loan matures, the "over your
            hold" rows matter far more than full-term totals — interest paid
            during the hold is the real cost; principal comes back as equity
            when you sell.
          </div>
        </CardContent>
      </Card>

      <Card className="mb-4" style={{ overflowX: "auto" }}>
        <CardContent>
          <table className="w-full text-sm" style={{ minWidth: 560 }}>
            <thead>
              <tr>
                <th className="text-left py-2 pr-3 font-medium text-slate-500 align-bottom">
                  <span className="block text-xs font-normal text-slate-400 mb-1">
                    click to select →
                  </span>
                </th>
                {termData.map((d) => (
                  <th
                    key={d.term}
                    onClick={() => onChange({ term: d.term })}
                    className={`text-right py-2 px-3 cursor-pointer rounded-t-lg transition ${
                      d.term === term ? "bg-teal-50" : "hover:bg-slate-50"
                    }`}
                  >
                    <div
                      className="text-base font-bold"
                      style={{ color: TERM_COLORS[d.term] }}
                    >
                      {d.term}-yr
                    </div>
                    <div
                      className="mt-1 flex items-center justify-end gap-1 text-xs font-normal text-slate-500"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <InlineNumberInput
                        value={d.rate}
                        step={0.05}
                        onChange={(v) =>
                          onChange({ rates: { ...rates, [d.term]: v } })
                        }
                        className="w-14 border-b border-slate-300 text-right tabular-nums bg-transparent focus:outline-none focus:border-teal-600"
                      />
                      %
                    </div>
                    {d.term === term && (
                      <div className="text-[10px] uppercase tracking-wide text-teal-700 font-semibold mt-1">
                        selected
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {compareRows.map((row, i) =>
                row.divider !== undefined ? (
                  <tr key={i}>
                    <td
                      colSpan={5}
                      className="pt-4 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400"
                    >
                      {row.divider}
                    </td>
                  </tr>
                ) : (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="py-2 pr-3 text-slate-500">{row.label}</td>
                    {termData.map((d) => (
                      <td
                        key={d.term}
                        className={`py-2 px-3 text-right tabular-nums ${d.term === term ? "bg-teal-50" : ""}`}
                      >
                        {row.render(d)}
                      </td>
                    ))}
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card className="mb-4 bg-slate-900 !border-slate-900 text-white">
        <CardContent>
          <div className="text-xs uppercase tracking-wide text-teal-300 font-semibold mb-2">
            The trade, in plain terms
          </div>
          <div className="text-sm leading-relaxed">
            Over {holdYears} years, the {cheapestHold.term}-yr costs the least
            in interest ({usd0(cheapestHold.interestAtHold)}).{" "}
            {cheapestHold.term !== 30 && (
              <>
                Versus the 30-yr, it saves{" "}
                <span className="font-bold text-teal-300">
                  {usd0(t30.interestAtHold - cheapestHold.interestAtHold)}
                </span>{" "}
                in interest but requires{" "}
                <span className="font-bold text-red-300">
                  +{usd0(cheapestHold.payment - t30.payment)}/mo
                </span>{" "}
                ({usd0((cheapestHold.payment - t30.payment) * holdMonths)} more
                cash committed over the hold).{" "}
              </>
            )}
            {term !== cheapestHold.term && selectedData && (
              <>
                Your selected {term}-yr pays {usd0(selectedData.interestAtHold)}{" "}
                in interest over the same window.
              </>
            )}
          </div>
          <div className="text-xs text-slate-400 mt-2">
            A shorter term is effectively a forced savings plan at a slightly
            better rate. If income flexibility matters more than rate, the 30-yr
            plus voluntary extra payments (Strategy tab) gets you most of the
            interest savings while keeping the required payment low.
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardContent>
          <div className="text-sm font-medium text-slate-700 mb-3">
            Loan balance by year — all four terms
          </div>
          <div style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={compareChartData}
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
                {TERMS.map((t) => (
                  <Line
                    key={t}
                    type="monotone"
                    dataKey={`t${t}`}
                    name={`${t}-yr`}
                    stroke={TERM_COLORS[t]}
                    strokeWidth={t === term ? 3 : 1.5}
                    strokeOpacity={t === term ? 1 : 0.6}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="text-xs text-slate-500 mt-2">
            The gap between the lines at your sale year is exactly the extra
            equity a shorter term hands you at closing — the thick line is your
            selected term.
          </div>
        </CardContent>
      </Card>
    </>
  );
}
