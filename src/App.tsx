import { MortgageCalculator } from "@/components/MortgageCalculator";
import { ScenarioBar } from "@/components/ScenarioBar";
import { useScenarios } from "@/hooks/useScenarios";

function App() {
  const {
    scenarios,
    activeScenario,
    updateActiveInputs,
    createScenario,
    renameScenario,
    deleteScenario,
    selectScenario,
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
      />
      <MortgageCalculator
        inputs={activeScenario.inputs}
        onChange={updateActiveInputs}
      />
    </div>
  );
}

export default App;
