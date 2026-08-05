import { Card, CardContent } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { InlineNumberInput } from "@/components/ui/inline-number-input";
import { NumberInput } from "@/components/ui/number-input";
import { SectionTitle } from "@/components/ui/section-title";
import type { LoanInputs } from "@/lib/defaults";
import { usd0 } from "@/lib/mortgage";
import type { MortgagePlan } from "@/lib/plan";

interface ClosingTabProps {
  inputs: LoanInputs;
  onChange: (patch: Partial<LoanInputs>) => void;
  plan: MortgagePlan;
}

export function ClosingTab({ inputs, onChange, plan }: ClosingTabProps) {
  const {
    downPct,
    buydown,
    buydownFundedBySeller,
    closingCostPct,
    escrowMonths,
    earnestDeposit,
    sellerCreditPct,
    reserves,
    maxConcessionPct,
  } = inputs;
  const {
    downPayment,
    closingCosts,
    prepaids,
    appliedToClosing,
    sellerCreditWasted,
    maxUsableSellerCredit,
    buydownSubsidy,
    buydownShortfall,
    buydownCostToBuyer,
    appliedToBuydown,
    cashToClose,
    remainingAfterClose,
    ltv,
    ltvBasedConcessionPct,
    maxConcessionAmount,
    totalSellerAsk,
    sellerCreditExceedsCap,
  } = plan;

  return (
    <>
      <SectionTitle
        title="Cash to close & negotiating room"
        note="What you'll actually wire at closing, and how much concession room the loan program allows."
      />
      <Card className="mb-6">
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <div className="text-sm font-medium text-slate-700 mb-3">
                Cash needed at closing
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Down payment</span>
                  <span>{usd0(downPayment)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 flex items-center gap-1">
                    Closing costs (
                    <InlineNumberInput
                      value={closingCostPct}
                      step={0.1}
                      onChange={(v) => onChange({ closingCostPct: v })}
                      className="w-12 border-b border-slate-300 text-center"
                    />
                    %)
                  </span>
                  <span>{usd0(closingCosts)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 flex items-center gap-1">
                    Escrow prepaids (
                    <InlineNumberInput
                      value={escrowMonths}
                      step={1}
                      onChange={(v) => onChange({ escrowMonths: v })}
                      className="w-10 border-b border-slate-300 text-center"
                    />
                    mo)
                  </span>
                  <span>{usd0(prepaids)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 flex items-center gap-1">
                    Less: earnest deposit paid ($
                    <InlineNumberInput
                      value={earnestDeposit}
                      step={500}
                      onChange={(v) => onChange({ earnestDeposit: v })}
                      className="w-16 border-b border-slate-300 text-center"
                    />
                    )
                  </span>
                  <span className="text-red-600">-{usd0(earnestDeposit)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 flex items-center gap-1">
                    Less: seller credit requested (
                    <InlineNumberInput
                      value={sellerCreditPct}
                      step={0.5}
                      onChange={(v) => onChange({ sellerCreditPct: v })}
                      className="w-12 border-b border-slate-300 text-center"
                    />
                    %)
                  </span>
                  <span className="text-teal-700">
                    -{usd0(appliedToClosing)}
                  </span>
                </div>
                {sellerCreditWasted > 0 && (
                  <div className="text-xs text-amber-700 -mt-1 pl-2">
                    ↳ {usd0(sellerCreditWasted)} of that can't be used — credits
                    only offset closing costs, prepaids
                    {buydown && buydownFundedBySeller
                      ? ", and your buydown subsidy"
                      : ""}{" "}
                    ({usd0(maxUsableSellerCredit)} combined), they don't reduce
                    your down payment or convert to cash back.
                  </div>
                )}
                {buydown && (
                  <div className="flex justify-between items-start">
                    <span className="text-slate-500">
                      2-1 buydown subsidy ({usd0(buydownSubsidy)})
                      <span className="flex gap-1 mt-1">
                        <button
                          type="button"
                          onClick={() =>
                            onChange({ buydownFundedBySeller: true })
                          }
                          className={`text-xs px-2 py-0.5 rounded border ${
                            buydownFundedBySeller
                              ? "bg-slate-900 text-white border-slate-900"
                              : "bg-white text-slate-500 border-slate-300 hover:border-slate-400"
                          }`}
                        >
                          Seller funds
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onChange({ buydownFundedBySeller: false })
                          }
                          className={`text-xs px-2 py-0.5 rounded border ${
                            !buydownFundedBySeller
                              ? "bg-slate-900 text-white border-slate-900"
                              : "bg-white text-slate-500 border-slate-300 hover:border-slate-400"
                          }`}
                        >
                          You fund
                        </button>
                      </span>
                    </span>
                    <span
                      className={
                        buydownFundedBySeller && buydownShortfall === 0
                          ? "text-teal-700"
                          : "text-red-600"
                      }
                    >
                      {buydownFundedBySeller
                        ? buydownShortfall > 0
                          ? `+${usd0(buydownShortfall)} short`
                          : "$0"
                        : `+${usd0(buydownCostToBuyer)}`}
                    </span>
                  </div>
                )}
                {buydown && buydownFundedBySeller && appliedToBuydown > 0 && (
                  <div className="text-xs text-teal-700 -mt-1 pl-2">
                    ↳ {usd0(appliedToBuydown)} of your seller credit ask goes
                    toward this once closing costs are covered.
                  </div>
                )}
                {buydown && buydownFundedBySeller && buydownShortfall > 0 && (
                  <div className="text-xs text-amber-700 -mt-1 pl-2">
                    ↳ Your credit ask only covers {usd0(appliedToBuydown)} of
                    the {usd0(buydownSubsidy)} needed — the remaining{" "}
                    {usd0(buydownShortfall)} falls to you unless you ask the
                    seller for more credit.
                  </div>
                )}
                <div className="border-t border-slate-200 pt-2 flex justify-between font-bold text-base">
                  <span>Total cash to close</span>
                  <span>{usd0(cashToClose)}</span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-200">
                <Field label="Liquid savings earmarked for this purchase (optional)">
                  <NumberInput
                    value={reserves}
                    onChange={(v) => onChange({ reserves: v })}
                    prefix="$"
                    step={1000}
                  />
                </Field>
                {reserves > 0 && (
                  <div
                    className={`text-sm mt-2 font-medium ${
                      remainingAfterClose >= 0
                        ? "text-teal-700"
                        : "text-red-600"
                    }`}
                  >
                    {remainingAfterClose >= 0
                      ? `${usd0(remainingAfterClose)} total money left after closing`
                      : `${usd0(Math.abs(remainingAfterClose))} short — you'd need to bring in more`}
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className="text-sm font-medium text-slate-700 mb-3">
                Seller concession ceiling
              </div>
              <div className="text-xs text-slate-500 mb-2">
                Conventional loans cap seller-paid credits by loan-to-value —
                plug in the exact number your lender quoted.
              </div>
              <div className="bg-slate-100 rounded-lg p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-500">
                    At {downPct}% down ({ltv}% LTV)
                  </span>
                  {maxConcessionPct !== ltvBasedConcessionPct && (
                    <button
                      type="button"
                      onClick={() =>
                        onChange({ maxConcessionPct: ltvBasedConcessionPct })
                      }
                      className="text-xs px-2 py-0.5 rounded border border-slate-300 hover:border-slate-400 text-slate-600 bg-white"
                    >
                      Est. from LTV ({ltvBasedConcessionPct}%)
                    </button>
                  )}
                </div>
                <div className="flex items-baseline gap-1">
                  <InlineNumberInput
                    value={maxConcessionPct}
                    step={0.5}
                    onChange={(v) => onChange({ maxConcessionPct: v })}
                    className="text-2xl font-bold w-14 bg-transparent border-b border-slate-400 focus:outline-none focus:border-teal-600 tabular-nums"
                  />
                  <span className="text-2xl font-bold">
                    % = {usd0(maxConcessionAmount)}
                  </span>
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Covers rate buydowns, closing-cost credits, and repair credits
                  combined. Defaults to 6% — update it if your lender quoted
                  something else.
                </div>
              </div>
              {totalSellerAsk > 0 && (
                <div
                  className={`mt-3 text-sm font-medium ${
                    sellerCreditExceedsCap ? "text-red-600" : "text-teal-700"
                  }`}
                >
                  {sellerCreditExceedsCap
                    ? `Your ${usd0(totalSellerAsk)} total ask${
                        appliedToBuydown > 0 ? " (credit + buydown)" : ""
                      } is ${usd0(
                        totalSellerAsk - maxConcessionAmount,
                      )} over the cap — a lender won't let the seller fund the excess.`
                    : `Your ${usd0(totalSellerAsk)} total ask${
                        appliedToBuydown > 0 ? " (credit + buydown)" : ""
                      } fits within the cap, with ${usd0(
                        maxConcessionAmount - totalSellerAsk,
                      )} of room to spare.`}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
