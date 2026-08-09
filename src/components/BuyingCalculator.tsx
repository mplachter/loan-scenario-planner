import { useEffect, useState } from "react";
import { Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Stat } from "@/components/ui/stat";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { computeMortgagePlan } from "@/lib/plan";
import { monthlyLeftover } from "@/lib/budget";
import { usd0 } from "@/lib/mortgage";
import type { LoanInputs } from "@/lib/defaults";
import type { Household } from "@/lib/household";
import { SetupTab } from "@/components/tabs/SetupTab";
import { StrategyTab } from "@/components/tabs/StrategyTab";
import { CompareTab } from "@/components/tabs/CompareTab";
import { ClosingTab } from "@/components/tabs/ClosingTab";

export type TabId = "setup" | "strategy" | "compare" | "closing";

const ACTIVE_TAB_STORAGE_KEY = "loan-scenario-planner:active-tab";

const TABS: { id: TabId; label: string }[] = [
  { id: "setup", label: "Setup" },
  { id: "strategy", label: "Strategy" },
  { id: "compare", label: "Compare terms" },
  { id: "closing", label: "Closing" },
];

interface BuyingCalculatorProps {
  inputs: LoanInputs;
  onChange: (patch: Partial<LoanInputs>) => void;
  household: Household;
  onHousingPaymentChange: (amount: number) => void;
}

export function BuyingCalculator({
  inputs,
  onChange,
  household,
  onHousingPaymentChange,
}: BuyingCalculatorProps) {
  const readOnly = inputs.mode === "owning";
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    try {
      const stored = localStorage.getItem(ACTIVE_TAB_STORAGE_KEY);
      if (TABS.some((t) => t.id === stored)) return stored as TabId;
    } catch {
      // non-critical enhancement; ignore quota/availability errors
    }
    return "setup";
  });

  useEffect(() => {
    try {
      localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, activeTab);
    } catch {
      // non-critical enhancement; ignore quota/availability errors
    }
  }, [activeTab]);

  useEffect(() => {
    if (inputs.extraMode === "match15" && inputs.term <= 15)
      onChange({ extraMode: "none" });
    if (inputs.extraMode === "match20" && inputs.term <= 20)
      onChange({ extraMode: "none" });
    if (inputs.extraMode === "match25" && inputs.term <= 25)
      onChange({ extraMode: "none" });
    if (inputs.extraMode === "buydownToPrincipal" && !inputs.buydown)
      onChange({ extraMode: "none" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputs.term, inputs.extraMode, inputs.buydown]);

  const plan = computeMortgagePlan(inputs);
  const { buydown, refiYear, refiTerm, refiRate } = inputs;
  const {
    refiPlan,
    totalMonthlyY1,
    totalMonthlyY2,
    totalMonthlySteadyState,
    standardPI,
  } = plan;
  const leftoverBreakdown = monthlyLeftover(household, totalMonthlySteadyState);

  useEffect(() => {
    onHousingPaymentChange(totalMonthlySteadyState);
  }, [totalMonthlySteadyState, onHousingPaymentChange]);

  if (inputs.ownershipStatus === "existing") {
    // There's no shopping plan to summarize for a loan that already existed
    // before this app — skip the hero payment card, stat grid, and the rest
    // of the Buying tab shell entirely rather than showing zeroed-out or
    // misleading buying-mode numbers. `SetupTab` renders the ownership
    // toggle plus the existing-loan entry form for this case.
    return (
      <div className="mb-5">
        <SetupTab inputs={inputs} onChange={onChange} plan={plan} />
      </div>
    );
  }

  return (
    <>
      {readOnly && (
        <div className="mb-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-3 text-sm">
          You've closed on this loan — these are the numbers you shopped with.
          Switch to Owning to manage it.
        </div>
      )}
      {/* `inert` disables interaction/focus for the whole read-only subtree
          without threading a `disabled` prop through every input. Scoped to
          the hero/stat area and the shopping-specific tabs only — the Budget
          tab (Phase 7) describes the person, not the property, and stays
          editable regardless of mode. */}
      <div
        inert={readOnly}
        className={readOnly ? "opacity-70 select-none" : undefined}
      >
        <div className="mb-5">
          <Card className="mb-3">
            <CardContent className="p-4">
              <Tooltip>
                <TooltipTrigger className="w-full text-left cursor-help">
                  <div className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                    Your payment <Info className="size-3" />
                  </div>
                  <div className="text-2xl md:text-3xl font-bold tabular-nums text-slate-900">
                    {usd0(totalMonthlySteadyState)}
                    <span className="text-base font-normal text-slate-500">
                      /mo
                    </span>
                  </div>
                  {plan.extraSteady > 0 && (
                    <div className="text-sm text-slate-600 mt-1">
                      Base, no extra: {usd0(plan.basePaymentNoExtra)}/mo
                    </div>
                  )}
                  {buydown && (
                    <div className="text-xs text-slate-500 mt-1">
                      Y1 {usd0(totalMonthlyY1)} → Y2 {usd0(totalMonthlyY2)} →
                      Y3+ {usd0(totalMonthlySteadyState)}
                    </div>
                  )}
                  {plan.extraSteady > 0 && (
                    <div className="text-xs text-teal-700 mt-1">
                      includes {usd0(plan.extraSteady)}/mo extra toward
                      principal
                    </div>
                  )}
                </TooltipTrigger>
                <TooltipContent>
                  <div className="space-y-1">
                    <div className="flex justify-between gap-4">
                      <span>Principal &amp; interest</span>
                      <span>{usd0(standardPI)}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span>Property tax</span>
                      <span>{usd0(plan.monthlyTax)}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span>Insurance</span>
                      <span>{usd0(plan.monthlyInsurance)}</span>
                    </div>
                    {inputs.includeFlood && (
                      <div className="flex justify-between gap-4">
                        <span>Flood insurance</span>
                        <span>{usd0(plan.monthlyFlood)}</span>
                      </div>
                    )}
                    {plan.monthlyPMI > 0 && (
                      <div className="flex justify-between gap-4">
                        <span>PMI</span>
                        <span>{usd0(plan.monthlyPMI)}</span>
                      </div>
                    )}
                    {inputs.hoaMonthly > 0 && (
                      <div className="flex justify-between gap-4">
                        <span>HOA</span>
                        <span>{usd0(inputs.hoaMonthly)}</span>
                      </div>
                    )}
                    {plan.monthlyUtilities > 0 && (
                      <div className="flex justify-between gap-4">
                        <span>Utilities</span>
                        <span>{usd0(plan.monthlyUtilities)}</span>
                      </div>
                    )}
                    {plan.extraSteady > 0 && (
                      <div className="flex justify-between gap-4">
                        <span>Extra principal</span>
                        <span>{usd0(plan.extraSteady)}</span>
                      </div>
                    )}
                    <div className="flex justify-between gap-4 border-t border-slate-700 pt-1 font-semibold">
                      <span>Total</span>
                      <span>{usd0(totalMonthlySteadyState)}</span>
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </CardContent>
          </Card>

          <div
            className={`grid grid-cols-2 ${refiPlan ? "md:grid-cols-6" : "md:grid-cols-5"} gap-3`}
          >
            <Card>
              <CardContent className="p-4">
                <Tooltip>
                  <TooltipTrigger className="w-full text-left cursor-help">
                    <Stat
                      label="Years saved"
                      tone="positive"
                      value={
                        plan.effectiveMonthsSaved > 0
                          ? `${plan.effectiveYearsSavedWhole}y ${plan.effectiveMonthsSavedRem}m`
                          : "—"
                      }
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    Payoff in {Math.floor(plan.effectivePayoffMonths / 12)}y{" "}
                    {plan.effectivePayoffMonths % 12}m with your plan vs.{" "}
                    {Math.floor(plan.baseline.months / 12)}y{" "}
                    {plan.baseline.months % 12}m on the standard schedule
                    {refiPlan ? " (including the modeled refinance)" : ""}.
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
                      tone="positive"
                      value={
                        plan.effectiveInterestSaved > 0
                          ? usd0(plan.effectiveInterestSaved)
                          : "—"
                      }
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    Total interest paid: {usd0(plan.effectiveTotalInterest)}{" "}
                    with your plan vs. {usd0(plan.baseline.totalInterest)} on
                    the standard schedule
                    {refiPlan ? " (including the modeled refinance)" : ""}.
                  </TooltipContent>
                </Tooltip>
              </CardContent>
            </Card>

            {refiPlan && (
              <Card>
                <CardContent className="p-4">
                  <Tooltip>
                    <TooltipTrigger className="w-full text-left cursor-help">
                      <Stat
                        label={`Refi payment (yr ${refiYear}+)`}
                        value={`${usd0(refiPlan.totalMonthly)}/mo`}
                        sub={`${refiTerm}yr @ ${refiRate.toFixed(2)}%`}
                        tone={
                          refiPlan.paymentDelta <= 0 ? "positive" : "negative"
                        }
                      />
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="space-y-1">
                        <div className="flex justify-between gap-4">
                          <span>New P&amp;I</span>
                          <span>{usd0(refiPlan.payment)}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span>Taxes/insurance/HOA/PMI/utilities</span>
                          <span>{usd0(plan.baseMonthlyCosts)}</span>
                        </div>
                        {refiPlan.continuedExtra > 0 && (
                          <div className="flex justify-between gap-4">
                            <span>Continued extra</span>
                            <span>{usd0(refiPlan.continuedExtra)}</span>
                          </div>
                        )}
                        <div className="flex justify-between gap-4 border-t border-slate-700 pt-1 font-semibold">
                          <span>Total</span>
                          <span>{usd0(refiPlan.totalMonthly)}</span>
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardContent className="p-4">
                <Stat
                  label="Cash to close"
                  value={usd0(plan.cashToClose)}
                  sub={plan.cashToCloseSub}
                />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <Tooltip>
                  <TooltipTrigger className="w-full text-left cursor-help">
                    <Stat
                      label="Total interest (standard)"
                      value={usd0(plan.baseline.totalInterest)}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    Interest paid over the full term if you only ever make the
                    standard required payment — no extra principal, no
                    refinance.
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
                        leftoverBreakdown.leftover >= 0
                          ? "positive"
                          : "negative"
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
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as TabId)}
        className="mb-6"
      >
        <TabsList className="w-full">
          {TABS.map((t) => (
            <TabsTrigger key={t.id} value={t.id} className="flex-1">
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="setup">
          <div
            inert={readOnly}
            className={readOnly ? "opacity-70 select-none" : undefined}
          >
            <SetupTab inputs={inputs} onChange={onChange} plan={plan} />
          </div>
        </TabsContent>
        <TabsContent value="strategy">
          <div
            inert={readOnly}
            className={readOnly ? "opacity-70 select-none" : undefined}
          >
            <StrategyTab inputs={inputs} onChange={onChange} plan={plan} />
          </div>
        </TabsContent>
        <TabsContent value="compare">
          <div
            inert={readOnly}
            className={readOnly ? "opacity-70 select-none" : undefined}
          >
            <CompareTab inputs={inputs} onChange={onChange} plan={plan} />
          </div>
        </TabsContent>
        <TabsContent value="closing">
          <div
            inert={readOnly}
            className={readOnly ? "opacity-70 select-none" : undefined}
          >
            <ClosingTab inputs={inputs} onChange={onChange} plan={plan} />
          </div>
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
