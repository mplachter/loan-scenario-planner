import { describe, expect, it } from "vitest";
import { amortize, pmt } from "./mortgage";

describe("pmt", () => {
  it("returns 0 when principal is non-positive", () => {
    expect(pmt(0, 6, 30)).toBe(0);
  });

  it("divides evenly when the rate is 0", () => {
    expect(pmt(300000, 0, 30)).toBe(300000 / 360);
  });

  it("returns a positive payment for normal inputs, consistent with amortize", () => {
    const loan = 560000;
    const rate = 6.6;
    const term = 30;
    const payment = pmt(loan, rate, term);
    expect(payment).toBeGreaterThan(0);
    const result = amortize(loan, rate, term, 0);
    expect(result.payment).toBeCloseTo(payment);
  });
});

describe("amortize", () => {
  const loan = 560000;
  const rate = 6.6;
  const term = 30;

  it("pays off no later, with no more interest, when extra principal is applied", () => {
    const baseline = amortize(loan, rate, term, 0);
    const accelerated = amortize(loan, rate, term, 200);
    expect(accelerated.months).toBeLessThanOrEqual(baseline.months);
    expect(accelerated.totalInterest).toBeLessThanOrEqual(
      baseline.totalInterest,
    );
  });

  it("produces a non-increasing balances array that ends at or near 0", () => {
    const result = amortize(loan, rate, term, 0);
    for (let i = 1; i < result.balances.length; i += 1) {
      expect(result.balances[i]).toBeLessThanOrEqual(result.balances[i - 1]);
    }
    const last = result.balances[result.balances.length - 1];
    const cap = term * 12 + 12;
    expect(last <= 1 || result.months === cap).toBe(true);
  });
});
