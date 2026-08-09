import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Explain, ExplainerNote } from "@/components/ui/explainer";
import { Field } from "@/components/ui/field";
import { InlineNumberInput } from "@/components/ui/inline-number-input";
import { NumberInput } from "@/components/ui/number-input";
import { SectionTitle } from "@/components/ui/section-title";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  budgetByCategory,
  budgetTotal,
  monthlyLeftover,
  monthlyTakeHomeIncome,
} from "@/lib/budget";
import type {
  BudgetCategory,
  BudgetItem,
  LoanInputs,
  PayFrequency,
} from "@/lib/defaults";
import { usd0 } from "@/lib/mortgage";

interface BudgetTabProps {
  inputs: LoanInputs;
  onChange: (patch: Partial<LoanInputs>) => void;
  housingPayment: number;
}

const PAY_FREQUENCY_LABELS: Record<PayFrequency, string> = {
  weekly: "Weekly",
  biweekly: "Biweekly",
  semimonthly: "Twice a month",
  monthly: "Monthly",
};

const CATEGORY_ORDER: BudgetCategory[] = ["needs", "wants", "savings"];

const CATEGORY_BADGE_STYLES: Record<BudgetCategory, string> = {
  needs: "bg-slate-100 text-slate-600 border-slate-300",
  wants: "bg-amber-50 text-amber-700 border-amber-200",
  savings: "bg-teal-50 text-teal-700 border-teal-200",
};

const CATEGORY_BAR_STYLES: Record<BudgetCategory, string> = {
  needs: "bg-slate-400",
  wants: "bg-amber-400",
  savings: "bg-teal-500",
};

function nextCategory(category: BudgetCategory): BudgetCategory {
  const i = CATEGORY_ORDER.indexOf(category);
  return CATEGORY_ORDER[(i + 1) % CATEGORY_ORDER.length];
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// This tab describes the person, not the property — Phase 3's read-only
// gating for closed Buying-mode tabs must never wrap this component, and it
// renders identically (and always editable) in both Buying and Owning mode.
export function BudgetTab({
  inputs,
  onChange,
  housingPayment,
}: BudgetTabProps) {
  const [justAddedId, setJustAddedId] = useState<string | null>(null);
  const {
    payFrequency,
    netPayPerPaycheck,
    annualBonusNet,
    bonusMonth,
    budgetItems,
  } = inputs;

  const income = monthlyTakeHomeIncome(inputs);
  const total = budgetTotal(budgetItems);
  const byCategory = budgetByCategory(budgetItems);
  const { leftover } = monthlyLeftover(inputs, housingPayment);

  const needsPct =
    income > 0 ? ((byCategory.needs + housingPayment) / income) * 100 : 0;
  const wantsPct = income > 0 ? (byCategory.wants / income) * 100 : 0;
  const savingsPct = income > 0 ? (byCategory.savings / income) * 100 : 0;
  const clampPct = (p: number) => Math.max(0, Math.min(100, p));

  function updateItem(id: string, patch: Partial<BudgetItem>) {
    onChange({
      budgetItems: budgetItems.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    });
  }

  function deleteItem(id: string) {
    onChange({ budgetItems: budgetItems.filter((item) => item.id !== id) });
  }

  function addCustomRow() {
    const item: BudgetItem = {
      id: crypto.randomUUID(),
      label: "",
      amount: 0,
      category: "wants",
      isCustom: true,
    };
    onChange({ budgetItems: [...budgetItems, item] });
    setJustAddedId(item.id);
  }

  return (
    <>
      <SectionTitle
        title="Income & monthly budget"
        note="What you actually take home and what you actually spend — this drives the leftover-cash number below."
      />

      <Card className="mb-6">
        <CardContent>
          <div className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-1">
            Take-home income <Explain k="takeHomeVsGross" />
          </div>
          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <Field label="Take-home pay per paycheck">
              <NumberInput
                value={netPayPerPaycheck}
                onChange={(v) => onChange({ netPayPerPaycheck: v })}
                prefix="$"
                step={50}
              />
            </Field>
            <Field label="Pay frequency">
              <ToggleGroup
                variant="outline"
                value={[payFrequency]}
                onValueChange={(vals) => {
                  const next = vals[0];
                  if (next) onChange({ payFrequency: next as PayFrequency });
                }}
                className="flex-wrap"
              >
                {(Object.keys(PAY_FREQUENCY_LABELS) as PayFrequency[]).map(
                  (f) => (
                    <ToggleGroupItem key={f} value={f}>
                      {PAY_FREQUENCY_LABELS[f]}
                    </ToggleGroupItem>
                  ),
                )}
              </ToggleGroup>
            </Field>
            <Field label="Annual bonus (take-home estimate, optional)">
              <NumberInput
                value={annualBonusNet}
                onChange={(v) => onChange({ annualBonusNet: v })}
                prefix="$"
                step={500}
              />
            </Field>
            <Field label="Bonus month">
              <select
                value={bonusMonth}
                onChange={(e) =>
                  onChange({ bonusMonth: Number(e.target.value) })
                }
                className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
              >
                {MONTH_NAMES.map((name, i) => (
                  <option key={name} value={i + 1}>
                    {name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="text-sm text-slate-600">
            ≈ {usd0(income)}/mo take-home
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardContent>
          <div className="text-sm font-medium text-slate-700 mb-3">
            Monthly budget
          </div>
          <div>
            {budgetItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-2 py-1.5 border-b border-slate-100 last:border-0"
              >
                {item.isCustom ? (
                  <input
                    autoFocus={item.id === justAddedId}
                    value={item.label}
                    placeholder="Label"
                    onChange={(e) =>
                      updateItem(item.id, { label: e.target.value })
                    }
                    className="flex-1 min-w-0 text-sm bg-transparent border-b border-transparent focus:border-slate-300 outline-none"
                  />
                ) : (
                  <span className="flex-1 min-w-0 text-sm text-slate-700 truncate">
                    {item.label}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() =>
                    updateItem(item.id, {
                      category: nextCategory(item.category),
                    })
                  }
                  className={`text-[10px] font-medium px-1.5 py-0.5 rounded border shrink-0 ${CATEGORY_BADGE_STYLES[item.category]}`}
                >
                  {item.category}
                </button>
                <div className="flex items-center gap-0.5 shrink-0">
                  <span className="text-slate-400 text-sm">$</span>
                  <InlineNumberInput
                    value={item.amount}
                    step={10}
                    onChange={(v) => updateItem(item.id, { amount: v })}
                    className="w-20 text-sm text-right border-b border-slate-300 focus:outline-none focus:border-teal-600"
                  />
                </div>
                {item.isCustom ? (
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => deleteItem(item.id)}
                  >
                    <Trash2 />
                  </Button>
                ) : (
                  <div className="size-6 shrink-0" />
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addCustomRow}
            className="mt-3 text-xs px-2 py-1 rounded border border-slate-300 hover:border-slate-400 text-slate-600 inline-flex items-center gap-1"
          >
            <Plus className="size-3" /> Add custom row
          </button>

          <div className="mt-5 pt-4 border-t border-slate-200">
            <div className="flex h-4 rounded-full overflow-hidden bg-slate-100">
              <div
                style={{ width: `${clampPct(needsPct)}%` }}
                className={CATEGORY_BAR_STYLES.needs}
              />
              <div
                style={{ width: `${clampPct(wantsPct)}%` }}
                className={CATEGORY_BAR_STYLES.wants}
              />
              <div
                style={{ width: `${clampPct(savingsPct)}%` }}
                className={CATEGORY_BAR_STYLES.savings}
              />
            </div>
            <div className="flex flex-wrap justify-between gap-2 text-xs text-slate-500 mt-1.5">
              <span>
                Needs {needsPct.toFixed(0)}%{" "}
                <span className="text-slate-400">(target 50%)</span>
              </span>
              <span>
                Wants {wantsPct.toFixed(0)}%{" "}
                <span className="text-slate-400">(target 30%)</span>
              </span>
              <span>
                Savings {savingsPct.toFixed(0)}%{" "}
                <span className="text-slate-400">(target 20%)</span>
              </span>
            </div>
            <div className="mt-3">
              <ExplainerNote k="fiftyThirtyTwenty" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardContent>
          <div className="text-sm font-medium text-slate-700 mb-3">
            Leftover
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Monthly take-home income</span>
              <span>{usd0(income)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Budget total</span>
              <span>-{usd0(total)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Housing payment</span>
              <span>-{usd0(housingPayment)}</span>
            </div>
            <div
              className={`border-t border-slate-200 pt-2 flex justify-between font-bold text-base ${
                leftover < 0 ? "text-red-600" : "text-teal-700"
              }`}
            >
              <span>Leftover</span>
              <span>{usd0(leftover)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
