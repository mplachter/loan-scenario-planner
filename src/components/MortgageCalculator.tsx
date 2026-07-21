import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Stat } from "@/components/ui/stat";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { computeMortgagePlan } from "@/lib/plan";
import { usd0 } from "@/lib/mortgage";
import type { LoanInputs } from "@/lib/defaults";
import { SetupTab } from "@/components/tabs/SetupTab";
import { StrategyTab } from "@/components/tabs/StrategyTab";
import { CompareTab } from "@/components/tabs/CompareTab";
import { ClosingTab } from "@/components/tabs/ClosingTab";

export type TabId = "setup" | "strategy" | "compare" | "closing";

const TABS: { id: TabId; label: string }[] = [
  { id: "setup", label: "Setup" },
  { id: "strategy", label: "Strategy" },
  { id: "compare", label: "Compare terms" },
  { id: "closing", label: "Closing" },
];

const GRID_COLS_MD: Record<number, string> = {
  4: "md:grid-cols-4",
  5: "md:grid-cols-5",
  6: "md:grid-cols-6",
  7: "md:grid-cols-7",
};

interface MortgageCalculatorProps {
  inputs: LoanInputs;
  onChange: (patch: Partial<LoanInputs>) => void;
}

export function MortgageCalculator({
  inputs,
  onChange,
}: MortgageCalculatorProps) {
  const [activeTab, setActiveTab] = useState<TabId>("setup");

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

  return (
    <>
      <div
        className={`grid grid-cols-2 ${GRID_COLS_MD[plan.summaryCardCount] ?? "md:grid-cols-4"} gap-3 mb-5`}
      >
        {buydown ? (
          <>
            <Card>
              <CardContent className="p-4">
                <Stat label="Payment — year 1" value={usd0(totalMonthlyY1)} />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <Stat label="Payment — year 2" value={usd0(totalMonthlyY2)} />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <Stat
                  label="Payment — year 3+"
                  value={usd0(totalMonthlySteadyState)}
                />
              </CardContent>
            </Card>
          </>
        ) : (
          <>
            <Card>
              <CardContent className="p-4">
                <Stat label="Monthly payment" value={usd0(totalMonthlyY1)} />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <Stat label="P&I only" value={usd0(standardPI)} />
              </CardContent>
            </Card>
          </>
        )}
        {refiPlan && (
          <Card>
            <CardContent className="p-4">
              <Stat
                label={`Refi payment (yr ${refiYear}+)`}
                value={`${usd0(refiPlan.payment)}/mo`}
                sub={`${refiTerm}yr @ ${refiRate.toFixed(2)}%`}
                tone={refiPlan.paymentDelta <= 0 ? "positive" : "negative"}
              />
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
            <Stat
              label="Total interest (standard)"
              value={usd0(plan.baseline.totalInterest)}
              sub={
                plan.interestSaved > 0
                  ? `${usd0(plan.interestSaved)} less with extra payments`
                  : null
              }
            />
          </CardContent>
        </Card>
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
          <SetupTab inputs={inputs} onChange={onChange} plan={plan} />
        </TabsContent>
        <TabsContent value="strategy">
          <StrategyTab inputs={inputs} onChange={onChange} plan={plan} />
        </TabsContent>
        <TabsContent value="compare">
          <CompareTab inputs={inputs} onChange={onChange} plan={plan} />
        </TabsContent>
        <TabsContent value="closing">
          <ClosingTab inputs={inputs} onChange={onChange} plan={plan} />
        </TabsContent>
      </Tabs>

      <p className="text-xs text-slate-400 text-center mt-2 mb-2">
        Estimates only, not a loan offer. Verify rates, taxes, insurance, and
        closing costs with your lender, insurer, and the Broward County Property
        Appraiser before relying on these numbers.
      </p>
    </>
  );
}
