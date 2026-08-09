import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { NumberInput } from "@/components/ui/number-input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { firstPaymentDateFor, formatFullDate, todayISO } from "@/lib/dates";
import { TERMS, type LoanInputs, type LoanTerm } from "@/lib/defaults";
import {
  createRecurringExtraEvent,
  createRefinanceEvent,
  EVENT_LABELS,
  type MortgageEvent,
} from "@/lib/events";
import { usd0 } from "@/lib/mortgage";
import type { MortgagePlan } from "@/lib/plan";

interface CloseLoanDialogProps {
  inputs: LoanInputs;
  onChange: (patch: Partial<LoanInputs>) => void;
  plan: MortgagePlan;
}

function summarizeSeedEvent(ev: MortgageEvent): string {
  if (ev.kind === "extra") {
    return `${EVENT_LABELS.extra}: ${usd0(ev.amount)}/mo from month 1`;
  }
  if (ev.kind === "refinance") {
    return `${EVENT_LABELS.refinance}: ${ev.rate.toFixed(2)}% / ${ev.termYears}yr at month ${ev.month}`;
  }
  return EVENT_LABELS[ev.kind];
}

export function CloseLoanDialog({
  inputs,
  onChange,
  plan,
}: CloseLoanDialogProps) {
  const [closeDate, setCloseDate] = useState(() => todayISO());
  const [firstPaymentDate, setFirstPaymentDate] = useState(() =>
    firstPaymentDateFor(todayISO()),
  );
  const [servicedLoanAmount, setServicedLoanAmount] = useState(
    () => plan.loanAmount,
  );
  const [servicedRate, setServicedRate] = useState(() => plan.rate);
  const [servicedTerm, setServicedTerm] = useState<LoanTerm>(() => inputs.term);

  const seedEvents = useMemo<MortgageEvent[]>(() => {
    const events: MortgageEvent[] = [];
    if (inputs.extraMode !== "none" && plan.extraSteady > 0) {
      events.push(
        createRecurringExtraEvent(1, {
          cadence: "monthly",
          amount: plan.extraSteady,
          note: "carried over from your buying plan",
        }),
      );
    }
    if (inputs.refiEnabled) {
      events.push(
        createRefinanceEvent(inputs.refiYear * 12, {
          rate: inputs.refiRate,
          termYears: inputs.refiTerm,
          closingCostPct: inputs.refiClosingCostPct,
          rollCostsIn: true,
          cashOut: 0,
          note: "carried over from your buying plan",
        }),
      );
    }
    return events;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleCloseDateChange(v: string) {
    setCloseDate(v);
    setFirstPaymentDate(firstPaymentDateFor(v));
  }

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button
            variant="default"
            className="bg-white text-slate-900 hover:bg-slate-100"
          />
        }
      >
        I closed on this loan
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Close on this loan</DialogTitle>
        </DialogHeader>
        <div className="text-xs text-slate-500">
          Enter what actually happened at closing. This snapshots your funded
          terms and switches the app to Owning mode, where you can track your
          real balance and build out refinances, extra payments, and other
          events over time. Your Buying-mode inputs stay put, read-only, so you
          can always see what you shopped with.
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Close date">
            <input
              type="date"
              value={closeDate}
              onChange={(e) => handleCloseDateChange(e.target.value)}
              className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
            />
          </Field>
          <Field
            label="First payment date"
            hint={formatFullDate(firstPaymentDate)}
          >
            <input
              type="date"
              value={firstPaymentDate}
              onChange={(e) => setFirstPaymentDate(e.target.value)}
              className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Actual loan amount">
            <NumberInput
              value={servicedLoanAmount}
              onChange={setServicedLoanAmount}
              prefix="$"
              step={1000}
            />
          </Field>
          <Field label="Actual note rate">
            <NumberInput
              value={servicedRate}
              onChange={setServicedRate}
              suffix="%"
              step={0.05}
            />
          </Field>
        </div>
        <div>
          <div className="text-xs font-medium text-slate-600 mb-1">
            Actual term
          </div>
          <ToggleGroup
            variant="outline"
            value={[String(servicedTerm)]}
            onValueChange={(vals) => {
              const next = vals[0];
              if (next) setServicedTerm(Number(next) as LoanTerm);
            }}
            className="flex-wrap"
          >
            {TERMS.map((t) => (
              <ToggleGroupItem key={t} value={String(t)}>
                {t}-year
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        {seedEvents.length > 0 && (
          <div className="bg-slate-100 rounded-lg p-3 text-xs text-slate-700 space-y-1">
            <div className="font-semibold text-slate-800">
              Carried over from your buying plan
            </div>
            {seedEvents.map((ev) => (
              <div key={ev.id}>{summarizeSeedEvent(ev)}</div>
            ))}
            <div className="text-slate-500">
              You can edit or remove these on the Timeline tab after closing.
            </div>
          </div>
        )}
        <DialogFooter>
          <DialogClose>Cancel</DialogClose>
          <DialogClose
            variant="default"
            onClick={() =>
              onChange({
                mode: "owning",
                closeDate,
                firstPaymentDate,
                servicedLoanAmount,
                servicedRate,
                servicedTerm,
                events: seedEvents,
              })
            }
          >
            Apply
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
