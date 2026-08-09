import { formatMonthYear } from "@/lib/dates";
import type { AppMode, ClosedLoanInputs } from "@/lib/defaults";

interface ModeSwitchProps {
  inputs: ClosedLoanInputs;
  view: AppMode;
  onViewChange: (view: AppMode) => void;
}

function owningLabel(inputs: ClosedLoanInputs): string {
  // An existing-owner scenario has no `closeDate` (the loan was never shopped
  // here); its optional `purchaseDate` is the closest equivalent, and may be
  // absent too.
  const since = inputs.closeDate ?? inputs.existingLoan?.purchaseDate ?? null;
  return since ? `🏠 Owning since ${formatMonthYear(since)}` : "🏠 Owning";
}

// Only rendered once the loan has closed *and* it was shopped in this app (see
// `ScenarioWorkspace`) — before then there is no Owning view to switch to, and
// for an existing owner there is no Buying plan to switch back to.
// `view` is which calculator is showing, independent of `inputs.mode` (the
// persisted lifecycle flag written at close): closing doesn't stop you
// switching back to peek at the read-only Buying tabs afterward.
export function ModeSwitch({ inputs, view, onViewChange }: ModeSwitchProps) {
  const options: { value: AppMode; label: string }[] = [
    { value: "buying", label: "Buying" },
    { value: "owning", label: owningLabel(inputs) },
  ];

  return (
    <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1 mb-4">
      {options.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          onClick={() => onViewChange(value)}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
            view === value
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
