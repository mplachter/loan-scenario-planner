import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { EVENT_COLORS, EVENT_LABELS, type MortgageEvent } from "@/lib/events";
import { formatFullDate, formatMonthYear } from "@/lib/dates";
import { usd0 } from "@/lib/mortgage";
import type { LedgerRow, ServicingResult } from "@/lib/servicing";

interface LedgerTabProps {
  result: ServicingResult;
  events: MortgageEvent[];
  currentMonth: number;
}

interface YearGroup {
  year: number;
  rows: LedgerRow[];
  interest: number;
  principal: number;
  payments: number;
  endBalance: number;
}

export function LedgerTab({ result, events, currentMonth }: LedgerTabProps) {
  const eventsById = useMemo(
    () => new Map(events.map((e) => [e.id, e])),
    [events],
  );
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const yearGroups = useMemo<YearGroup[]>(() => {
    const groups = new Map<number, LedgerRow[]>();
    for (const row of result.rows) {
      const year = Math.ceil(row.month / 12);
      const existing = groups.get(year) ?? [];
      existing.push(row);
      groups.set(year, existing);
    }
    return [...groups.entries()]
      .sort(([a], [b]) => a - b)
      .map(([year, rows]) => ({
        year,
        rows,
        interest: rows.reduce((s, r) => s + r.interest, 0),
        principal: rows.reduce((s, r) => s + r.principal + r.extra, 0),
        payments: rows.length,
        endBalance: rows[rows.length - 1].endBalance,
      }));
  }, [result.rows]);

  function toggleYear(year: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(year)) next.delete(year);
      else next.add(year);
      return next;
    });
  }

  const currentYear = Math.max(Math.ceil(currentMonth / 12), 1);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
            <th className="py-2 pr-3 font-medium"></th>
            <th className="py-2 pr-3 font-medium">Year</th>
            <th className="py-2 pr-3 font-medium">Date range</th>
            <th className="py-2 pr-3 font-medium text-right">Payments</th>
            <th className="py-2 pr-3 font-medium text-right">Interest</th>
            <th className="py-2 pr-3 font-medium text-right">Principal</th>
            <th className="py-2 pr-3 font-medium text-right">Ending balance</th>
          </tr>
        </thead>
        <tbody>
          {yearGroups.map((group) => {
            const isExpanded = expanded.has(group.year);
            const isCurrentYearGroup = group.year === currentYear;
            return (
              <Fragment key={group.year}>
                <tr
                  onClick={() => toggleYear(group.year)}
                  className={`cursor-pointer border-b border-slate-100 hover:bg-slate-50 ${
                    isCurrentYearGroup ? "bg-teal-50" : ""
                  }`}
                >
                  <td className="py-2 pr-1 text-slate-400">
                    {isExpanded ? (
                      <ChevronDown className="size-3.5" />
                    ) : (
                      <ChevronRight className="size-3.5" />
                    )}
                  </td>
                  <td className="py-2 pr-3 font-medium">Year {group.year}</td>
                  <td className="py-2 pr-3 text-slate-500">
                    {formatMonthYear(group.rows[0].date)} –{" "}
                    {formatMonthYear(group.rows[group.rows.length - 1].date)}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {group.payments}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {usd0(group.interest)}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {usd0(group.principal)}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums font-semibold">
                    {usd0(group.endBalance)}
                  </td>
                </tr>
                {isExpanded &&
                  group.rows.map((row) => (
                    <tr
                      key={`month-${row.month}`}
                      className={`border-b border-slate-50 text-xs ${
                        row.month === currentMonth
                          ? "bg-teal-50"
                          : "bg-slate-50/50"
                      }`}
                    >
                      <td></td>
                      <td className="py-1.5 pr-3 text-slate-500" colSpan={2}>
                        {formatFullDate(row.date)}
                        {row.eventIds.length > 0 && (
                          <span className="ml-2 inline-flex gap-1">
                            {[...new Set(row.eventIds)].map((id) => {
                              const ev = eventsById.get(id);
                              if (!ev) return null;
                              return (
                                <span
                                  key={id}
                                  className="inline-block size-1.5 rounded-full"
                                  style={{
                                    backgroundColor: EVENT_COLORS[ev.kind],
                                  }}
                                  title={EVENT_LABELS[ev.kind]}
                                />
                              );
                            })}
                          </span>
                        )}
                      </td>
                      <td className="py-1.5 pr-3 text-right tabular-nums text-slate-400">
                        {row.month}
                      </td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">
                        {usd0(row.interest)}
                      </td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">
                        {usd0(row.principal + row.extra)}
                      </td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">
                        {usd0(row.endBalance)}
                      </td>
                    </tr>
                  ))}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
