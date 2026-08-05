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
import { Stat } from "@/components/ui/stat";
import type { LoanInputs } from "@/lib/defaults";
import { usd0 } from "@/lib/mortgage";
import { maximizeEquityAtSale } from "@/lib/plan";

interface EquityMaximizerDialogProps {
  inputs: LoanInputs;
  onChange: (patch: Partial<LoanInputs>) => void;
}

export function EquityMaximizerDialog({
  inputs,
  onChange,
}: EquityMaximizerDialogProps) {
  const [budget, setBudget] = useState(inputs.customExtra || 500);
  const result = useMemo(
    () => maximizeEquityAtSale(inputs, budget),
    [inputs, budget],
  );

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" />}>
        Maximize my equity
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Maximize equity by your {inputs.holdYears}-year hold
          </DialogTitle>
        </DialogHeader>
        <div className="max-w-xs">
          <Field label="Max extra you could pay monthly">
            <NumberInput
              value={budget}
              onChange={setBudget}
              prefix="$"
              step={25}
            />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Stat
            label="Recommended extra"
            value={`${usd0(result.recommendedExtra)}/mo`}
          />
          <Stat label="Balance at sale" value={usd0(result.balanceAtSale)} />
          <Stat
            label="Equity at sale"
            tone="positive"
            value={usd0(result.equityAtSale)}
          />
        </div>
        {!result.fullyPaidOff && (
          <div className="text-xs text-slate-500">
            Even at this budget, the loan won't be fully paid off by year{" "}
            {inputs.holdYears} — this is the most extra pays down in that time.
          </div>
        )}
        <DialogFooter>
          <DialogClose>Cancel</DialogClose>
          <DialogClose
            variant="default"
            onClick={() =>
              onChange({
                extraMode: "custom",
                customExtra: result.recommendedExtra,
                refiExtraOverride: null,
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
