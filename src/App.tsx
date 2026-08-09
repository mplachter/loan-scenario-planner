import { useState } from "react";
import { BuyingCalculator } from "@/components/BuyingCalculator";
import { OwningCalculator } from "@/components/OwningCalculator";
import { ModeSwitch } from "@/components/ModeSwitch";
import { ScenarioBar } from "@/components/ScenarioBar";
import { useScenarios } from "@/hooks/useScenarios";
import { isLoanClosed, type LoanInputs } from "@/lib/defaults";

function App() {
  const {
    scenarios,
    activeScenario,
    updateActiveInputs,
    createScenario,
    renameScenario,
    deleteScenario,
    selectScenario,
    duplicateScenario,
  } = useScenarios();

  return (
    <div
      className="max-w-4xl mx-auto p-4 md:p-6 bg-slate-50 text-slate-900"
      style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
    >
      <div className="mb-5">
        <h1 className="text-xl font-bold text-slate-900">
          Home cost & loan calculator
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Every number below is yours to set — defaults are just reasonable
          starting points.
        </p>
      </div>
      <ScenarioBar
        scenarios={scenarios}
        activeScenarioId={activeScenario.id}
        onSelect={selectScenario}
        onCreate={createScenario}
        onRename={renameScenario}
        onDelete={deleteScenario}
        onDuplicate={duplicateScenario}
      />
      {/* Keyed on the scenario id so switching scenarios remounts the
          workspace — per-scenario view state resets itself instead of being
          hand-synced back in an effect. */}
      <ScenarioWorkspace
        key={activeScenario.id}
        inputs={activeScenario.inputs}
        onChange={updateActiveInputs}
      />
    </div>
  );
}

interface ScenarioWorkspaceProps {
  inputs: LoanInputs;
  onChange: (patch: Partial<LoanInputs>) => void;
}

// The app follows the loan's lifecycle rather than offering two modes to pick
// between: while you're shopping there is only Buying, and no switch is
// rendered at all. Recording your closing makes Owning the home view the
// instant it happens — no effect has to chase the transition, because the view
// is derived from whether the loan is closed. `peekBuying` is the one piece of
// genuine UI state: a temporary detour back to the read-only plan you shopped
// with, which only exists once there's something to detour from.
//
// An existing-owner scenario (`ownershipStatus: "existing"`) skips the switch
// entirely — that loan was never shopped in this app, so there's no Buying
// plan worth peeking at, only Owning.
function ScenarioWorkspace({ inputs, onChange }: ScenarioWorkspaceProps) {
  const [peekBuying, setPeekBuying] = useState(false);
  const closedInputs = isLoanClosed(inputs) ? inputs : null;
  const cameFromBuying = inputs.ownershipStatus === "shopping";

  return (
    <>
      {closedInputs && cameFromBuying && (
        <ModeSwitch
          inputs={closedInputs}
          view={peekBuying ? "buying" : "owning"}
          onViewChange={(v) => setPeekBuying(v === "buying")}
        />
      )}
      {closedInputs && (!cameFromBuying || !peekBuying) ? (
        <OwningCalculator inputs={closedInputs} onChange={onChange} />
      ) : (
        <BuyingCalculator inputs={inputs} onChange={onChange} />
      )}
    </>
  );
}

export default App;
