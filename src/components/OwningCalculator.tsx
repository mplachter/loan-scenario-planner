import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Stat } from "@/components/ui/stat";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { TimelineTab } from "@/components/tabs/TimelineTab";
import { LedgerTab } from "@/components/tabs/LedgerTab";
import { ManageTab } from "@/components/tabs/ManageTab";
import { EquitySellTab } from "@/components/tabs/EquitySellTab";
import { VariantsTab } from "@/components/tabs/VariantsTab";
import { dateToMonthISO, formatMonthYear, todayISO } from "@/lib/dates";
import type { ClosedLoanInputs, LoanInputs } from "@/lib/defaults";
import type { Household } from "@/lib/household";
import { monthlyLeftover } from "@/lib/budget";
import { usd0 } from "@/lib/mortgage";
import { servicingContextFromInputs, simulateServicing } from "@/lib/servicing";

export type OwningTabId =
  "timeline" | "variants" | "manage" | "sell" | "ledger";

const ACTIVE_TAB_STORAGE_KEY = "loan-scenario-planner:active-tab-owning";

const TABS: { id: OwningTabId; label: string }[] = [
  { id: "timeline", label: "Timeline" },
  { id: "variants", label: "Variants" },
  { id: "manage", label: "Manage" },
  { id: "sell", label: "Equity & sell" },
  { id: "ledger", label: "Ledger" },
];

// `ClosedLoanInputs` (not `LoanInputs`) so the type system enforces what the
// servicing engine requires — this component cannot be rendered for a scenario
// that hasn't closed.
interface OwningCalculatorProps {
  inputs: ClosedLoanInputs;
  onChange: (patch: Partial<LoanInputs>) => void;
  household: Household;
  onHousingPaymentChange: (amount: number) => void;
}

export function OwningCalculator({
  inputs,
  onChange,
  household,
  onHousingPaymentChange,
}: OwningCalculatorProps) {
  const [activeTab, setActiveTab] = useState<OwningTabId>(() => {
    try {
      const stored = localStorage.getItem(ACTIVE_TAB_STORAGE_KEY);
      if (TABS.some((t) => t.id === stored)) return stored as OwningTabId;
    } catch {
      // non-critical enhancement; ignore quota/availability errors
    }
    return "timeline";
  });

  useEffect(() => {
    try {
      localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, activeTab);
    } catch {
      // non-critical enhancement; ignore quota/availability errors
    }
  }, [activeTab]);

  const today = todayISO();
  const ctx = useMemo(
    () => servicingContextFromInputs(inputs, today),
    [inputs, today],
  );
  const result = useMemo(
    () => simulateServicing(ctx, inputs.events),
    [ctx, inputs.events],
  );
  const baseline = useMemo(() => simulateServicing(ctx, []), [ctx]);
  const currentMonth = dateToMonthISO(inputs.firstPaymentDate, today);
  const clampedMonth = Math.min(
    Math.max(currentMonth, 1),
    Math.max(result.rows.length, 1),
  );
  const currentRow = result.rows[clampedMonth - 1] ?? null;
  const currentBalance = result.balanceAt(currentMonth);
  const paidOff = currentMonth >= result.payoffMonth;

  const interestPaidThroughToday = result.rows
    .slice(0, clampedMonth)
    .reduce((sum, r) => sum + r.interest, 0);
  const interestRemaining = Math.max(
    result.totalInterest - interestPaidThroughToday,
    0,
  );
  const interestSaved = baseline.totalInterest - result.totalInterest;
  const housingPayment = currentRow?.totalOutflow ?? 0;
  const leftoverBreakdown = monthlyLeftover(household, housingPayment);

  useEffect(() => {
    onHousingPaymentChange(housingPayment);
  }, [housingPayment, onHousingPaymentChange]);
  const appreciatedValueToday =
    ctx.purchasePrice *
    Math.pow(1 + ctx.homeAppreciationPct / 100, currentMonth / 12);
  const equityToday = appreciatedValueToday - currentBalance;
  const yearsRemaining = Math.max(result.payoffMonth - currentMonth, 0) / 12;

  return (
    <>
      <div className="mb-5">
        <Card className="mb-3">
          <CardContent className="p-4">
            <Tooltip>
              <TooltipTrigger className="w-full text-left cursor-help">
                <div className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                  Current balance
                </div>
                <div className="text-2xl md:text-3xl font-bold tabular-nums text-slate-900">
                  {usd0(currentBalance)}
                </div>
                <div className="text-sm text-slate-600 mt-1">
                  {paidOff
                    ? "Paid off"
                    : `Month ${Math.max(currentMonth, 1)} of ${Math.round(ctx.termYears * 12)} · next payment ${formatMonthYear(
                        result.rows[clampedMonth]?.date ??
                          result.rows[clampedMonth - 1]?.date ??
                          today,
                      )}`}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                {currentRow ? (
                  <div className="space-y-1">
                    <div className="flex justify-between gap-4">
                      <span>Principal &amp; interest</span>
                      <span>{usd0(currentRow.scheduledPI)}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span>Escrow (taxes/insurance)</span>
                      <span>{usd0(currentRow.escrow)}</span>
                    </div>
                    {currentRow.pmi > 0 && (
                      <div className="flex justify-between gap-4">
                        <span>PMI</span>
                        <span>{usd0(currentRow.pmi)}</span>
                      </div>
                    )}
                    {currentRow.hoa > 0 && (
                      <div className="flex justify-between gap-4">
                        <span>HOA</span>
                        <span>{usd0(currentRow.hoa)}</span>
                      </div>
                    )}
                    {currentRow.extra > 0 && (
                      <div className="flex justify-between gap-4">
                        <span>Extra principal</span>
                        <span>{usd0(currentRow.extra)}</span>
                      </div>
                    )}
                    <div className="flex justify-between gap-4 border-t border-slate-700 pt-1 font-semibold">
                      <span>Total outflow</span>
                      <span>{usd0(currentRow.totalOutflow)}</span>
                    </div>
                  </div>
                ) : (
                  "No payment data yet."
                )}
              </TooltipContent>
            </Tooltip>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <Card>
            <CardContent className="p-4">
              <Tooltip>
                <TooltipTrigger className="w-full text-left cursor-help">
                  <Stat
                    label="Payoff date"
                    value={formatMonthYear(result.payoffDate)}
                    sub={`${yearsRemaining.toFixed(1)}y remaining`}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  Based on your current timeline of events, projected forward
                  from today.
                </TooltipContent>
              </Tooltip>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <Tooltip>
                <TooltipTrigger className="w-full text-left cursor-help">
                  <Stat
                    label="Interest remaining"
                    value={usd0(interestRemaining)}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  Total interest left to pay from today through payoff, under
                  your current timeline.
                </TooltipContent>
              </Tooltip>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <Tooltip>
                <TooltipTrigger className="w-full text-left cursor-help">
                  <Stat
                    label="Interest saved"
                    tone={interestSaved >= 0 ? "positive" : "negative"}
                    value={usd0(Math.abs(interestSaved))}
                    sub={
                      interestSaved >= 0
                        ? "vs. doing nothing"
                        : "more than doing nothing"
                    }
                  />
                </TooltipTrigger>
                <TooltipContent>
                  Your total interest ({usd0(result.totalInterest)}) vs. the "do
                  nothing" baseline ({usd0(baseline.totalInterest)}) — every
                  event on your timeline combined.
                </TooltipContent>
              </Tooltip>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <Tooltip>
                <TooltipTrigger className="w-full text-left cursor-help">
                  <Stat
                    label="Equity today"
                    tone="positive"
                    value={usd0(equityToday)}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  Estimated home value ({usd0(appreciatedValueToday)}) minus
                  your current balance ({usd0(currentBalance)}).
                </TooltipContent>
              </Tooltip>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <Tooltip>
                <TooltipTrigger className="w-full text-left cursor-help">
                  <Stat
                    label="Refi/recast costs"
                    tone={result.totalFees > 0 ? "negative" : "default"}
                    value={usd0(result.totalFees)}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  Every dollar spent on refinance and recast fees across your
                  whole timeline, rolled-in or out of pocket.
                </TooltipContent>
              </Tooltip>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <Tooltip>
                <TooltipTrigger className="w-full text-left cursor-help">
                  <Stat
                    label="Monthly leftover"
                    tone={
                      leftoverBreakdown.leftover >= 0 ? "positive" : "negative"
                    }
                    value={usd0(leftoverBreakdown.leftover)}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  <div className="space-y-1">
                    <div className="flex justify-between gap-4">
                      <span>Take-home income</span>
                      <span>{usd0(leftoverBreakdown.income)}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span>Budget</span>
                      <span>-{usd0(leftoverBreakdown.budgetTotal)}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span>Housing payment</span>
                      <span>-{usd0(leftoverBreakdown.housingPayment)}</span>
                    </div>
                    <div className="flex justify-between gap-4 border-t border-slate-700 pt-1 font-semibold">
                      <span>Leftover</span>
                      <span>{usd0(leftoverBreakdown.leftover)}</span>
                    </div>
                    {leftoverBreakdown.bonusSpread > 0 && (
                      <div className="flex justify-between gap-4">
                        <span>Bonus spread monthly</span>
                        <span>+{usd0(leftoverBreakdown.bonusSpread)}</span>
                      </div>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            </CardContent>
          </Card>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as OwningTabId)}
        className="mb-6"
      >
        <TabsList className="w-full">
          {TABS.map((t) => (
            <TabsTrigger key={t.id} value={t.id} className="flex-1">
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="timeline">
          <TimelineTab
            inputs={inputs}
            onChange={onChange}
            ctx={ctx}
            result={result}
            baseline={baseline}
            currentMonth={currentMonth}
            household={household}
          />
        </TabsContent>
        <TabsContent value="variants">
          <VariantsTab inputs={inputs} ctx={ctx} currentMonth={currentMonth} />
        </TabsContent>
        <TabsContent value="manage">
          <ManageTab
            inputs={inputs}
            onChange={onChange}
            ctx={ctx}
            result={result}
            currentMonth={currentMonth}
          />
        </TabsContent>
        <TabsContent value="sell">
          <EquitySellTab
            inputs={inputs}
            onChange={onChange}
            ctx={ctx}
            result={result}
            currentMonth={currentMonth}
          />
        </TabsContent>
        <TabsContent value="ledger">
          <LedgerTab
            result={result}
            events={inputs.events}
            currentMonth={currentMonth}
          />
        </TabsContent>
      </Tabs>

      <p className="text-xs text-slate-400 text-center mt-2 mb-2">
        Estimates only, not a loan offer. Verify rates, taxes, insurance, and
        closing costs with your lender, insurer, and your county property
        appraiser before relying on these numbers.
      </p>
    </>
  );
}
