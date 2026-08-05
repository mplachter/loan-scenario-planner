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
import type { LoanInputs } from "@/lib/defaults";
import { computeMortgagePlan } from "@/lib/plan";

interface RefiBreakevenDialogProps {
  inputs: LoanInputs;
  onChange: (patch: Partial<LoanInputs>) => void;
}

export function RefiBreakevenDialog({
  inputs,
  onChange,
}: RefiBreakevenDialogProps) {
  const [trialYear, setTrialYear] = useState(inputs.refiYear);
  const [trialRate, setTrialRate] = useState(inputs.refiRate);
  const [trialClosingCostPct, setTrialClosingCostPct] = useState(
    inputs.refiClosingCostPct,
  );

  const trialPlan = useMemo(
    () =>
      computeMortgagePlan({
        ...inputs,
        refiEnabled: true,
        refiYear: trialYear,
        refiRate: trialRate,
        refiClosingCostPct: trialClosingCostPct,
      }),
    [inputs, trialYear, trialRate, trialClosingCostPct],
  );

  const remainingMonths = Math.max((inputs.holdYears - trialYear) * 12, 0);
  const { breakevenMonths } = trialPlan.refiPlan!;

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" />}>
        Check a refi's breakeven
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Does a refi break even before you sell in year {inputs.holdYears}?
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 max-w-sm">
          <Field label="Refinance in year">
            <NumberInput
              value={trialYear}
              onChange={setTrialYear}
              step={1}
              min={1}
              max={inputs.term - 1}
            />
          </Field>
          <Field label="New rate">
            <NumberInput
              value={trialRate}
              onChange={setTrialRate}
              suffix="%"
              step={0.05}
            />
          </Field>
          <Field label="Refi closing costs">
            <NumberInput
              value={trialClosingCostPct}
              onChange={setTrialClosingCostPct}
              suffix="%"
              step={0.25}
            />
          </Field>
        </div>
        {breakevenMonths === null ? (
          <div className="text-sm text-slate-500">
            Your payment doesn't drop with this refi, so there's no payment
            breakeven to compare — any case for it rests on the total interest
            comparison.
          </div>
        ) : breakevenMonths <= remainingMonths ? (
          <div className="text-sm text-teal-700 font-medium">
            Breaks even in {breakevenMonths} months — before you sell in year{" "}
            {inputs.holdYears}.
          </div>
        ) : (
          <div className="text-sm text-red-600 font-medium">
            Breaks even in {breakevenMonths} months — after you sell in year{" "}
            {inputs.holdYears}.
          </div>
        )}
        <DialogFooter>
          <DialogClose>Cancel</DialogClose>
          <DialogClose
            variant="default"
            onClick={() =>
              onChange({
                refiEnabled: true,
                refiYear: trialYear,
                refiRate: trialRate,
                refiClosingCostPct: trialClosingCostPct,
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
