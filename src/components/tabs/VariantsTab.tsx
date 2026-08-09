import type { ReactNode } from "react";
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
import { SectionTitle } from "@/components/ui/section-title";
import { formatMonthYear } from "@/lib/dates";
import { TERM_COLORS, type LoanInputs } from "@/lib/defaults";
import { usd0 } from "@/lib/mortgage";
import {
  compareTimelines,
  type ServicingContext,
  type TimelineComparison,
} from "@/lib/servicing";

interface VariantsTabProps {
  inputs: LoanInputs;
  ctx: ServicingContext;
  currentMonth: number;
}

interface Row {
  payoffMonth: number;
  payoffDate: string;
  yearsRemaining: number;
  totalInterest: number;
  interestSaved: number;
  totalFees: number;
  netBenefit: number;
  balanceAt5: number;
  balanceAt10: number;
  balanceAt15: number;
  paymentToday: number;
  paymentAtYear10: number;
}

function rowFor(c: TimelineComparison, currentMonth: number): Row {
  const clampedToday = Math.min(
    Math.max(currentMonth, 1),
    Math.max(c.result.rows.length, 1),
  );
  const clamped10 = Math.min(120, Math.max(c.result.rows.length, 1));
  return {
    payoffMonth: c.result.payoffMonth,
    payoffDate: c.result.payoffDate,
    yearsRemaining: Math.max(c.result.payoffMonth - currentMonth, 0) / 12,
    totalInterest: c.result.totalInterest,
    interestSaved: -c.interestVsBaseline,
    totalFees: c.feesTotal,
    netBenefit: -c.interestVsBaseline - c.feesTotal,
    balanceAt5: c.result.balanceAt(60),
    balanceAt10: c.result.balanceAt(120),
    balanceAt15: c.result.balanceAt(180),
    paymentToday: c.result.rows[clampedToday - 1]?.scheduledPI ?? 0,
    paymentAtYear10: c.result.rows[clamped10 - 1]?.scheduledPI ?? 0,
  };
}

type CompareRow =
  | {
      label: string;
      render: (r: Row) => ReactNode;
      metric: (r: Row) => number;
      better: "min" | "max";
      divider?: undefined;
    }
  | { divider: string; label?: undefined };

const COMPARE_ROWS: CompareRow[] = [
  {
    label: "Payoff date",
    render: (r) => formatMonthYear(r.payoffDate),
    metric: (r) => r.payoffMonth,
    better: "min",
  },
  {
    label: "Years remaining from today",
    render: (r) => `${r.yearsRemaining.toFixed(1)}y`,
    metric: (r) => r.yearsRemaining,
    better: "min",
  },
  { divider: "Interest & cost" },
  {
    label: "Total interest",
    render: (r) => usd0(r.totalInterest),
    metric: (r) => r.totalInterest,
    better: "min",
  },
  {
    label: "Interest saved vs. do nothing",
    render: (r) => usd0(r.interestSaved),
    metric: (r) => r.interestSaved,
    better: "max",
  },
  {
    label: "Total refi/recast costs",
    render: (r) => usd0(r.totalFees),
    metric: (r) => r.totalFees,
    better: "min",
  },
  {
    label: "Net benefit (interest saved − costs)",
    render: (r) => <span className="font-semibold">{usd0(r.netBenefit)}</span>,
    metric: (r) => r.netBenefit,
    better: "max",
  },
  { divider: "Balance over time" },
  {
    label: "Balance at 5 years",
    render: (r) => usd0(r.balanceAt5),
    metric: (r) => r.balanceAt5,
    better: "min",
  },
  {
    label: "Balance at 10 years",
    render: (r) => usd0(r.balanceAt10),
    metric: (r) => r.balanceAt10,
    better: "min",
  },
  {
    label: "Balance at 15 years",
    render: (r) => usd0(r.balanceAt15),
    metric: (r) => r.balanceAt15,
    better: "min",
  },
  { divider: "Monthly payment" },
  {
    label: "Payment today",
    render: (r) => usd0(r.paymentToday),
    metric: (r) => r.paymentToday,
    better: "min",
  },
  {
    label: "Payment at year 10",
    render: (r) => usd0(r.paymentAtYear10),
    metric: (r) => r.paymentAtYear10,
    better: "min",
  },
];

export function VariantsTab({ inputs, ctx, currentMonth }: VariantsTabProps) {
  const comparisons = compareTimelines(ctx, [
    ...inputs.variants.map((v) => ({ name: v.name, events: v.events })),
    { name: "Current (unsaved)", events: inputs.events },
  ]);
  const rows = comparisons.map((c) => rowFor(c, currentMonth));
  const activeVariantName =
    inputs.variants.find((v) => v.id === inputs.activeVariantId)?.name ?? null;

  const chartedComparisons = comparisons.slice(0, 5);
  const otherColors = Object.values(TERM_COLORS);
  const maxYear =
    Math.max(...comparisons.map((c) => c.result.yearly.length)) - 1;
  const chartData = Array.from({ length: Math.max(maxYear + 1, 1) }, (_, y) => {
    const point: Record<string, number> = { year: y };
    chartedComparisons.forEach((c, i) => {
      point[`s${i}`] = c.result.yearly[y]?.balance ?? 0;
    });
    return point;
  });
  const currentYear = Math.round(currentMonth / 12);

  const doNothingPayoffMonth = comparisons.find((c) => c.name === "Do nothing")!
    .result.payoffMonth;
  const candidateIndices = comparisons
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => c.name !== "Do nothing");
  const best = candidateIndices.reduce<{
    comparison: TimelineComparison;
    row: Row;
  } | null>((acc, { c, i }) => {
    const row = rows[i]!;
    if (!acc || row.netBenefit > acc.row.netBenefit) {
      return { comparison: c, row };
    }
    return acc;
  }, null);

  return (
    <>
      <SectionTitle
        title="Saved variants"
        note='Save named timelines (e.g. "Refi @3", "Refi @3+5", "Do nothing") from the Timeline tab, then compare them here side by side.'
      />

      {inputs.variants.length === 0 ? (
        <Card className="mb-4">
          <CardContent>
            <div className="text-sm text-slate-500">
              No saved variants yet. Build a timeline on the Timeline tab and
              click "Save as variant…" to add one here. Your current (unsaved)
              timeline and the "Do nothing" baseline are always shown.
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card className="mb-4" style={{ overflowX: "auto" }}>
        <CardContent>
          <table className="w-full text-sm" style={{ minWidth: 480 }}>
            <thead>
              <tr>
                <th className="text-left py-2 pr-3 font-medium text-slate-500 align-bottom" />
                {comparisons.map((c) => (
                  <th
                    key={c.name}
                    className="text-right py-2 px-3 align-bottom"
                  >
                    <div className="text-sm font-bold text-slate-800">
                      {c.name}
                    </div>
                    {c.name === activeVariantName && (
                      <div className="text-[11px] font-medium text-teal-700">
                        loaded
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARE_ROWS.map((row, i) =>
                row.divider !== undefined ? (
                  <tr key={i}>
                    <td
                      colSpan={comparisons.length + 1}
                      className="pt-4 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400"
                    >
                      {row.divider}
                    </td>
                  </tr>
                ) : (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="py-2 pr-3 text-slate-500">{row.label}</td>
                    {rows.map((r, ci) => {
                      const values = rows.map((rr) => row.metric(rr));
                      const bestValue =
                        row.better === "min"
                          ? Math.min(...values)
                          : Math.max(...values);
                      const isBest = row.metric(r) === bestValue;
                      return (
                        <td
                          key={comparisons[ci]!.name}
                          className={`py-2 px-3 text-right tabular-nums ${
                            isBest ? "bg-teal-50 text-teal-700" : ""
                          }`}
                        >
                          {row.render(r)}
                        </td>
                      );
                    })}
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {inputs.variants.length > 4 && (
        <div className="text-xs text-slate-400 mb-2">
          Only the first four variants plus your current timeline are charted
          below.
        </div>
      )}

      <Card className="mb-4">
        <CardContent>
          <div className="text-sm font-medium text-slate-700 mb-3">
            Balance over time — all variants
          </div>
          <div style={{ height: 280 }}>
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
                {chartedComparisons.map((c, i) => (
                  <Line
                    key={c.name}
                    type="monotone"
                    dataKey={`s${i}`}
                    name={c.name}
                    stroke={
                      c.name === "Do nothing"
                        ? "#94a3b8"
                        : otherColors[i % otherColors.length]
                    }
                    strokeWidth={c.name === "Current (unsaved)" ? 3 : 2}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {best && (
        <Card className="mb-6 bg-slate-900 !border-slate-900 text-white">
          <CardContent>
            <div className="text-xs uppercase tracking-wide text-teal-300 font-semibold mb-2">
              The trade, in plain terms
            </div>
            <div className="text-sm leading-relaxed">
              <span className="font-bold">{best.comparison.name}</span> has the
              best net benefit:{" "}
              <span className="font-bold text-teal-300">
                {usd0(best.row.interestSaved)}
              </span>{" "}
              saved in interest
              {best.row.totalFees > 0 && (
                <>
                  {" "}
                  at a cost of{" "}
                  <span className="font-bold text-red-300">
                    {usd0(best.row.totalFees)}
                  </span>
                </>
              )}
              , netting{" "}
              <span className="font-bold text-teal-300">
                {usd0(best.row.netBenefit)}
              </span>{" "}
              better than doing nothing
              {best.row.payoffMonth < doNothingPayoffMonth && (
                <>
                  {" "}
                  and paid off {doNothingPayoffMonth -
                    best.row.payoffMonth}{" "}
                  months sooner
                </>
              )}
              .
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
