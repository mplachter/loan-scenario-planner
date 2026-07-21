import { describe, expect, it } from "vitest";
import { DEFAULT_INPUTS } from "./defaults";
import { computeMortgagePlan } from "./plan";

describe("computeMortgagePlan", () => {
  it("computes loan amount as purchase price minus down payment", () => {
    const plan = computeMortgagePlan(DEFAULT_INPUTS);
    const downPayment =
      (DEFAULT_INPUTS.purchasePrice * DEFAULT_INPUTS.downPct) / 100;
    expect(plan.loanAmount).toBe(DEFAULT_INPUTS.purchasePrice - downPayment);
  });

  it("charges PMI only when down payment is below 20%", () => {
    const withPmi = computeMortgagePlan({ ...DEFAULT_INPUTS, downPct: 10 });
    expect(withPmi.pmiAnnual).toBeGreaterThan(0);

    const withoutPmi = computeMortgagePlan({ ...DEFAULT_INPUTS, downPct: 20 });
    expect(withoutPmi.pmiAnnual).toBe(0);
  });
});
