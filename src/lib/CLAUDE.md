# src/lib — calculation engine

This directory is the financial domain logic for the whole app. Everything the UI shows is derived here, from `LoanInputs` (user input) through pure functions — no React, no side effects except `scenarios.ts`'s `localStorage` calls. Correctness matters more here than anywhere else in the repo: a bug is a wrong dollar figure shown to someone making a real home-buying decision.

## `mortgage.ts` — amortization primitives

- `pmt(principal, annualRatePct, years)` — standard fixed-payment formula. Returns `0` for non-positive principal; falls back to straight-line `principal / n` when `r <= 0` (avoids divide-by-zero at 0% rate).
- `amortize(principal, annualRatePct, years, extra)` — month-by-month simulation. `extra` is either a flat number or a `(month) => number` function, letting callers model time-varying extra payments (e.g. only in year 1–2, or only until a shorter term is matched).
  - Loop is capped at `years * 12 + 12` months (one extra year of slack) as a safety bound, not a real amortization limit — if a caller passes pathological inputs (e.g. negative extra payments that never let the balance shrink), the loop terminates instead of running forever. `amortize.test.ts`'s "ends at or near 0" test asserts against this cap, so don't tighten/remove it without checking that test.
  - `balances` and `cumInterest` are arrays indexed by month (index 0 = month 0, before any payment), used by chart code and by `plan.ts` for point-in-time lookups (e.g. "balance at year N" = `balances[N*12]`, clamped to array length).
- `usd0` — currency formatter, no cents. Used everywhere a dollar amount is displayed; use it for any new money-displaying UI rather than hand-rolling `toLocaleString`.

## `plan.ts` — `computeMortgagePlan`

One large pure function that fans out from `LoanInputs` into the `MortgagePlan` object consumed by every tab. It's intentionally not split into smaller composable functions — the pieces share a lot of intermediate state (rate, loanAmount, standardPI, baseMonthlyCosts) and splitting would mean threading a dozen values through several function signatures for little benefit. When adding a new derived field, add it inline near the related section rather than creating a new abstraction layer.

Key concepts, since the field names alone don't make these obvious:

- **Buydown (2-1)**: `y1Payment`/`y2Payment` are the payment at `rate - 2` and `rate - 1` (floored at 0.25%) respectively — the borrower pays less in years 1–2, subsidized by `buydownSubsidy` (typically seller- or lender-funded). Only meaningful when `inputs.buydown` is true.
- **Extra-payment modes** (`extraMode`): `matchN` (N = 15/20/25) computes the extra principal needed so a longer-term loan pays off on the same schedule as a direct N-year loan at N's rate — only offered when `term > N` (see `MortgageCalculator.tsx`'s effect that resets `extraMode` back to `"none"` if the term/buydown combo makes the mode invalid). `buydownToPrincipal` routes the buydown's year 1–2 payment savings into extra principal instead of letting the borrower pocket it — only valid when `buydown` is true.
- **`matchCompare`**: side-by-side of "pay extra on a 30yr to match a 15yr" vs. "just get a 15yr loan directly at the 15yr rate" — the whole point is that they're *not* equivalent (different rate), and `interestDelta`/`monthsDelta` quantify the difference.
- **`refiPlan`**: models refinancing the *accelerated* (post-extra-payment) balance at `refiYear`, folding refi closing costs into the new loan amount. `breakevenMonths` is only computed when the refi lowers the payment (`paymentDelta < 0`); it's `null` otherwise, meaning "no breakeven — refi never pays for itself on payment savings alone." Don't assume a non-null breakeven means the refi is worth it; check `netSavings` too.
- **Seller credit waterfall**: seller credit money is applied in strict order — first to `closingNeed` (closing costs + prepaids) via `appliedToClosing`, then any leftover (`poolAfterClosing`) to `buydownNeed` via `appliedToBuydown`, and whatever's still unspent becomes `sellerCreditWasted`. This ordering is deliberate (closing costs are a hard requirement; buydown funding is optional) — don't reorder without understanding real-world escrow rules only allow credits up to actual costs.
- **LTV-based concession cap**: `ltvBasedConcessionPct` is a step function of loan-to-value (`ltv <= 75` → 9%, `<= 90` → 6%, else 3%) approximating conventional-loan seller-concession limits. This is a simplification of real underwriting rules, not a precise lookup table — treat it as a rough guardrail (`sellerCreditExceedsCap`), not a source of truth for actual guidelines.
- **`termData`/`compareChartData`**: recomputes amortization for all four `TERMS` (15/20/25/30) at the *current* loan amount regardless of `inputs.term`, purely for the Compare tab. `holdMonths` (from `inputs.holdYears`) is the point at which "balance/interest/equity if you sold or refi'd at year N" is sampled — `cheapestHold` picks whichever term has the least interest paid by that point, not overall.

Numbers throughout are dollars (not cents) and percentages as `6.6` (not `0.066`) — matches the root `LoanInputs` convention; do not introduce cents or fractional-percent representations here.

## Testing

`mortgage.test.ts` and `plan.test.ts` cover the primitives and a few representative scenarios (PMI threshold, loan-amount arithmetic) — not exhaustive coverage of every derived field. When changing formulas here, prefer adding a targeted test over trusting manual inspection, since a wrong constant (e.g. the PMI rate `0.006`, the buydown floor `0.25`) is easy to typo and hard to eyeball-verify from the UI.
