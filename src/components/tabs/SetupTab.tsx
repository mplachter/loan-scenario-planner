import { Card, CardContent } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { NumberInput } from "@/components/ui/number-input";
import { SectionTitle } from "@/components/ui/section-title";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { TERMS, type LoanInputs, type LoanTerm } from "@/lib/defaults";
import { usd0 } from "@/lib/mortgage";
import type { MortgagePlan } from "@/lib/plan";

interface SetupTabProps {
  inputs: LoanInputs;
  onChange: (patch: Partial<LoanInputs>) => void;
  plan: MortgagePlan;
}

export function SetupTab({ inputs, onChange, plan }: SetupTabProps) {
  const {
    purchasePrice,
    downPct,
    term,
    rates,
    includeFlood,
    propertyTax,
    hoaMonthly,
    insuranceAnnual,
    floodAnnual,
    sellerCreditPct,
    gasMonthly,
    waterMonthly,
    electricMonthly,
    internetMonthly,
    tvMonthly,
  } = inputs;
  const {
    loanAmount,
    monthlyPMI,
    pmiAnnual,
    sellerCreditAmount,
    monthlyUtilities,
  } = plan;

  return (
    <>
      <SectionTitle
        title="Loan setup"
        note="Adjust price, down payment, term, and rate. Rates prefill with mid-July 2026 market averages — swap in whatever your lender actually quotes."
      />
      <Card className="mb-6">
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4 mb-5">
            <Field label="Purchase price">
              <NumberInput
                value={purchasePrice}
                onChange={(v) => onChange({ purchasePrice: v })}
                prefix="$"
                step={1000}
              />
            </Field>
            <Field
              label={`Down payment — ${downPct}% (${usd0(plan.downPayment)})`}
              hint={
                downPct < 20
                  ? "Below 20% triggers estimated PMI below."
                  : "20%+ avoids PMI on a conventional loan."
              }
            >
              <Slider
                value={downPct}
                onValueChange={(v) => onChange({ downPct: v as number })}
                min={5}
                max={50}
                step={1}
              />
            </Field>
          </div>

          <div className="mb-2 text-xs font-medium text-slate-600">
            Loan term
          </div>
          <ToggleGroup
            variant="outline"
            value={[String(term)]}
            onValueChange={(vals) => {
              const next = vals[0];
              if (next) onChange({ term: Number(next) as LoanTerm });
            }}
            className="mb-4 flex-wrap"
          >
            {TERMS.map((t) => (
              <ToggleGroupItem key={t} value={String(t)}>
                {t}-year
              </ToggleGroupItem>
            ))}
          </ToggleGroup>

          <div className="grid md:grid-cols-2 gap-4">
            <Field
              label={`Interest rate — ${term}-year fixed`}
              hint="Editable — plug in your actual quote."
            >
              <NumberInput
                value={rates[term]}
                onChange={(v) => onChange({ rates: { ...rates, [term]: v } })}
                step={0.05}
              />
            </Field>
            <Field
              label="Loan amount"
              hint="Purchase price minus down payment."
            >
              <div className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm tabular-nums bg-slate-100 text-slate-700">
                {usd0(loanAmount)}
              </div>
            </Field>
          </div>

          {pmiAnnual > 0 && (
            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              Estimated PMI: {usd0(monthlyPMI)}/mo (rough 0.6% annual estimate
              on the loan balance — actual PMI depends on credit score and LTV,
              and drops off entirely at 20% or more down).
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-slate-200">
            <div className="max-w-xs">
              <Field
                label={`Seller credit you're asking for — ${sellerCreditPct}% (${usd0(sellerCreditAmount)})`}
                hint="Can only offset closing costs & prepaids, not your down payment — full breakdown on the Closing tab."
              >
                <NumberInput
                  value={sellerCreditPct}
                  onChange={(v) => onChange({ sellerCreditPct: v })}
                  suffix="%"
                  step={0.5}
                />
              </Field>
            </div>
          </div>
        </CardContent>
      </Card>

      <SectionTitle
        title="Taxes, insurance & HOA"
        note="These ride on top of principal and interest every month."
      />
      <Card className="mb-6">
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <div className="text-xs font-medium text-slate-600 mb-1">
                Annual property tax
              </div>
              <div className="flex gap-2 mb-2">
                <button
                  type="button"
                  onClick={() =>
                    onChange({ propertyTax: Math.round(purchasePrice * 0.019) })
                  }
                  className="text-xs px-2 py-1 rounded border border-slate-300 hover:border-slate-400 text-slate-600"
                >
                  Est. from price (~1.9%)
                </button>
              </div>
              <NumberInput
                value={propertyTax}
                onChange={(v) => onChange({ propertyTax: v })}
                prefix="$"
                step={50}
              />
              <div className="text-xs text-amber-700 mt-1">
                Florida resets assessed value near the sale price the year after
                closing — if you're comparing to a current owner's bill, expect
                yours to run higher once it's reassessed.
              </div>
            </div>

            <Field label="Homeowners insurance (annual)">
              <NumberInput
                value={insuranceAnnual}
                onChange={(v) => onChange({ insuranceAnnual: v })}
                prefix="$"
                step={100}
              />
            </Field>

            <Field label="HOA (monthly)">
              <NumberInput
                value={hoaMonthly}
                onChange={(v) => onChange({ hoaMonthly: v })}
                prefix="$"
                step={5}
              />
            </Field>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-slate-600">
                  Flood insurance (annual)
                </span>
                <label className="flex items-center gap-1 text-xs text-slate-500 cursor-pointer">
                  <Switch
                    checked={includeFlood}
                    onCheckedChange={(checked) =>
                      onChange({ includeFlood: checked })
                    }
                  />
                  include
                </label>
              </div>
              <NumberInput
                value={floodAnnual}
                onChange={(v) => onChange({ floodAnnual: v })}
                prefix="$"
                step={50}
                disabled={!includeFlood}
              />
              <div className="text-xs text-amber-700 mt-1">
                If the property sits in a FEMA-designated flood zone, a
                federally backed lender will require this — confirm the zone
                before excluding it.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <SectionTitle
        title="Estimated utilities"
        note="Not part of your mortgage payment, but folded into the payment figures at the top of the page so you can see your full monthly housing cost."
      />
      <Card className="mb-6">
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            <Field label="Gas (monthly)">
              <NumberInput
                value={gasMonthly}
                onChange={(v) => onChange({ gasMonthly: v })}
                prefix="$"
                step={5}
              />
            </Field>
            <Field label="Water (monthly)">
              <NumberInput
                value={waterMonthly}
                onChange={(v) => onChange({ waterMonthly: v })}
                prefix="$"
                step={5}
              />
            </Field>
            <Field label="Electric (monthly)">
              <NumberInput
                value={electricMonthly}
                onChange={(v) => onChange({ electricMonthly: v })}
                prefix="$"
                step={5}
              />
            </Field>
            <Field label="Internet (monthly)">
              <NumberInput
                value={internetMonthly}
                onChange={(v) => onChange({ internetMonthly: v })}
                prefix="$"
                step={5}
              />
            </Field>
            <Field label="TV / streaming (monthly)">
              <NumberInput
                value={tvMonthly}
                onChange={(v) => onChange({ tvMonthly: v })}
                prefix="$"
                step={5}
              />
            </Field>
          </div>
          <div className="mt-4 text-sm text-slate-600">
            Utilities subtotal:{" "}
            <span className="font-semibold">{usd0(monthlyUtilities)}/mo</span>
            {hoaMonthly > 0 && (
              <> · plus {usd0(hoaMonthly)}/mo HOA (set above)</>
            )}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
