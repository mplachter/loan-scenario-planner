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

  it("clamps principalPaid to zero and never lets balance grow when a large negative extra would otherwise cause negative amortization", () => {
    const result = amortize(loan, rate, term, -1000);
    expect(result.months).toBe(term * 12 + 12);
    expect(result.balances.every((b) => b === loan)).toBe(true);
    expect(result.totalInterest).toBeGreaterThan(0);
  });

  it("accepts extra as a function of month, applying it only for the months the function returns nonzero", () => {
    const flatExtra = amortize(loan, rate, term, 200);
    const steppedExtra = amortize(loan, rate, term, (m) => (m <= 12 ? 200 : 0));
    for (let i = 0; i <= 12; i += 1) {
      expect(steppedExtra.balances[i]).toBeCloseTo(flatExtra.balances[i]);
    }
    const noExtra = amortize(loan, rate, term, 0);
    expect(steppedExtra.months).toBeGreaterThan(flatExtra.months);
    expect(steppedExtra.months).toBeLessThan(noExtra.months);
  });

  it("amortizes at a 0% rate using straight-line principal-only payments", () => {
    const result = amortize(120000, 0, 10, 0);
    expect(result.totalInterest).toBe(0);
    expect(result.payment).toBeCloseTo(120000 / 120);
    expect(result.months).toBe(120);
    expect(result.balances[result.balances.length - 1]).toBeLessThanOrEqual(1);
  });

  it("returns an empty schedule (zero months) when principal is zero or negative", () => {
    const zero = amortize(0, 6, 30, 100);
    expect(zero.months).toBe(0);
    expect(zero.payment).toBe(0);
    expect(zero.balances).toEqual([0]);
    expect(zero.cumInterest).toEqual([0]);
    expect(zero.totalInterest).toBe(0);

    const negative = amortize(-5000, 6, 30, 0);
    expect(negative.months).toBe(0);
    expect(negative.balances).toEqual([-5000]);
  });
});
