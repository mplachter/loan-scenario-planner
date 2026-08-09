import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { NumberInput } from "@/components/ui/number-input";
import { SectionTitle } from "@/components/ui/section-title";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { addMonthsISO, firstOfMonthISO, todayISO } from "@/lib/dates";
import { TERMS, type ExistingLoan, type LoanInputs } from "@/lib/defaults";
import { pmt, usd0 } from "@/lib/mortgage";

// Sane starting point for a loan someone's already a few years into — not
// meant to be realistic for any one person, just a reasonable place to start
// editing from (mirrors the spirit of `DEFAULT_INPUTS`). Exported so
// `SetupTab`'s ownership toggle can seed `inputs.existingLoan` with the same
// values the moment someone switches to "I already own a home".
export const STARTER_EXISTING_LOAN: ExistingLoan = {
  currentBalance: 420000,
  currentRate: 6.2,
  remainingTermYears: 26,
  originalPurchasePrice: 500000,
  originalTermYears: 30,
  purchaseDate: null,
};

interface ExistingLoanSectionProps {
  inputs: LoanInputs;
  onChange: (patch: Partial<LoanInputs>) => void;
}

// Rendered instead of the shopping-flow "Loan setup" card when
// `ownershipStatus === "existing"` — this loan was never shopped in this app,
// so there's no purchase price/rate/closing-cost history to ask about, only
// what the loan looks like today.
export function ExistingLoanSection({
  inputs,
  onChange,
}: ExistingLoanSectionProps) {
  const existingLoan = inputs.existingLoan ?? STARTER_EXISTING_LOAN;
  const {
    currentBalance,
    currentRate,
    remainingTermYears,
    originalPurchasePrice,
    originalTermYears,
    purchaseDate,
  } = existingLoan;

  function patch(fields: Partial<ExistingLoan>) {
    onChange({ existingLoan: { ...existingLoan, ...fields } });
  }

  const monthlyPI = pmt(currentBalance, currentRate, remainingTermYears);

  function startManaging() {
    onChange({
      mode: "owning",
      ownershipStatus: "existing",
      // `purchaseDate` is optional/informational for an existing loan — there
      // was no close-flow in this app to record a real close date from.
      closeDate: purchaseDate,
      firstPaymentDate: addMonthsISO(firstOfMonthISO(todayISO()), 1),
      servicedLoanAmount: currentBalance,
      servicedRate: currentRate,
      // Not a `LoanTerm` — an existing loan's remaining term is whatever it
      // is (often fractional). `servicingContextFromInputs` sources the
      // servicing engine's term from `existingLoan.remainingTermYears`
      // instead when `ownershipStatus === "existing"`.
      servicedTerm: null,
      // No prior extraMode/refiEnabled to carry over — this loan was never
      // shopped here, so there's nothing to seed the timeline from.
      events: [],
    });
  }

  return (
    <>
      <SectionTitle
        title="Your current loan"
        note="What you have today — no purchase price or closing-cost history needed, just the loan as it stands right now."
      />
      <Card className="mb-6">
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4 mb-5">
            <Field label="Current balance">
              <NumberInput
                value={currentBalance}
                onChange={(v) => patch({ currentBalance: v })}
                prefix="$"
                step={1000}
              />
            </Field>
            <Field label="Current rate">
              <NumberInput
                value={currentRate}
                onChange={(v) => patch({ currentRate: v })}
                suffix="%"
                step={0.05}
              />
            </Field>
            <Field
              label="Remaining term — years"
              hint="Check your most recent statement — most show months remaining; divide by 12."
            >
              <NumberInput
                value={remainingTermYears}
                onChange={(v) => patch({ remainingTermYears: v })}
                step={0.5}
              />
            </Field>
            <Field
              label="Original purchase price"
              hint="Used only for appreciation/equity display, not for the servicing math."
            >
              <NumberInput
                value={originalPurchasePrice}
                onChange={(v) => patch({ originalPurchasePrice: v })}
                prefix="$"
                step={1000}
              />
            </Field>
          </div>

          <div className="mb-2 text-xs font-medium text-slate-600">
            Original term
          </div>
          <ToggleGroup
            variant="outline"
            value={[String(originalTermYears)]}
            onValueChange={(vals) => {
              const next = vals[0];
              if (next) patch({ originalTermYears: Number(next) });
            }}
            className="mb-4 flex-wrap"
          >
            {TERMS.map((t) => (
              <ToggleGroupItem key={t} value={String(t)}>
                {t}-year
              </ToggleGroupItem>
            ))}
          </ToggleGroup>

          <Field label="Purchase date (optional)">
            <input
              type="date"
              value={purchaseDate ?? ""}
              onChange={(e) => patch({ purchaseDate: e.target.value || null })}
              className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
            />
          </Field>

          <div className="mt-4 text-sm text-slate-600">
            Owe {usd0(currentBalance)} at {currentRate}% · {remainingTermYears}{" "}
            years left · about {usd0(monthlyPI)}/mo P&amp;I
          </div>

          <div className="mt-4 flex justify-end">
            <Button variant="default" onClick={startManaging}>
              Start managing this loan
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
