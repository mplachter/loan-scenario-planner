import { useState } from "react";
import { MortgageCalculator } from "@/components/MortgageCalculator";
import { DEFAULT_INPUTS, type LoanInputs } from "@/lib/defaults";

function App() {
  const [inputs, setInputs] = useState<LoanInputs>(DEFAULT_INPUTS);

  const handleChange = (patch: Partial<LoanInputs>) => {
    setInputs((prev) => ({ ...prev, ...patch }));
  };

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
      <MortgageCalculator inputs={inputs} onChange={handleChange} />
    </div>
  );
}

export default App;
