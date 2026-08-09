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
- **Discount points** (`points`): `pointsCost` (1 point = 1% of loan amount) is a real out-of-pocket item — it's part of `closingNeed` and `cashToClose`, and seller credit can offset it. The rate side is still hypothetical: `pointsRate`/`pointsPayment`/`pointsBreakevenMonths` are a what-if comparison for the Strategy tab, and `rate`/`standardPI`/every amortization below still use the un-bought-down `rates[term]`. To model actually buying points, lower `rates[term]` yourself.
- **Extra-payment modes** (`extraMode`): `matchN` (N = 15/20/25) computes the extra principal needed so a longer-term loan pays off on the same schedule as a direct N-year loan at N's rate — only offered when `term > N` (see `MortgageCalculator.tsx`'s effect that resets `extraMode` back to `"none"` if the term/buydown combo makes the mode invalid). `buydownToPrincipal` routes the buydown's year 1–2 payment savings into extra principal instead of letting the borrower pocket it — only valid when `buydown` is true.
- **`matchCompare`**: side-by-side of "pay extra on a 30yr to match a 15yr" vs. "just get a 15yr loan directly at the 15yr rate" — the whole point is that they're _not_ equivalent (different rate), and `interestDelta`/`monthsDelta` quantify the difference.
- **`refiPlan`**: models refinancing the _accelerated_ (post-extra-payment) balance at `refiYear`, folding refi closing costs into the new loan amount. `breakevenMonths` is only computed when the refi lowers the payment (`paymentDelta < 0`); it's `null` otherwise, meaning "no breakeven — refi never pays for itself on payment savings alone." Don't assume a non-null breakeven means the refi is worth it; check `netSavings` too.
  - `continueExtraAfterRefi` (default `true`) carries the pre-refi extra-payment habit into the new loan; the actual dollar amount is `refiExtraOverride ?? extraSteady` — `refiExtraOverride` (`number | null`, default `null`) lets the UI let a user pay _more_ than their old extra amount post-refi without touching `extraSteady` itself, which stays tied to the pre-refi `extraMode`.
  - **Counterintuitive gotcha, confirmed by hand more than once**: refinancing into a _fresh_ term (e.g. resetting to a new 20 or 30-year amortization) can lower the new loan's required minimum P&I so much that even continuing the _same_ extra-payment dollar amount as before results in **less total monthly cash going to principal than pre-refi**, and therefore a _later_ full-payoff date than not refinancing at all — despite a lower rate and lower total interest. This isn't a bug; it's what happens when `refiTerm` resets the clock. `refiPlan.payment` (the new P&I alone) vs `standardPI` (old P&I) is the quick way to sanity-check whether a given refi scenario is actually accelerating or just relaxing.
  - `baseBalances`/`basePayoffMonths`/`baseTotalInterest` on `refiPlan` are a second amortization of the _same_ new loan with `extra = 0` — i.e. "what if you refinanced but let your payment drop back to the required minimum." `chartData`'s `refiBase` series (see below) uses this to plot it as a second line alongside the continued-extra one, but only when `refiPlan.continuedExtra > 0` (otherwise the two lines would be identical and it's suppressed).
- **Seller credit waterfall**: seller credit money is applied in strict order — first to `closingNeed` (closing costs + discount-point cost + prepaids) via `appliedToClosing`, then any leftover (`poolAfterClosing`) to `buydownNeed` via `appliedToBuydown`, and whatever's still unspent becomes `sellerCreditWasted`. This ordering is deliberate (closing costs are a hard requirement; buydown funding is optional) — don't reorder without understanding real-world escrow rules only allow credits up to actual costs.
- **LTV-based concession cap**: `ltvBasedConcessionPct` is a step function of loan-to-value (`ltv <= 75` → 9%, `<= 90` → 6%, else 3%) approximating conventional-loan seller-concession limits. This is a simplification of real underwriting rules, not a precise lookup table — treat it as a rough guardrail (`sellerCreditExceedsCap`), not a source of truth for actual guidelines.
- **`effectiveTotalInterest`/`effectivePayoffMonths`/`effectiveMonthsSaved`/`effectiveYearsSavedWhole`/`effectiveMonthsSavedRem`/`effectiveInterestSaved`**: the "full combined plan" — extra payments, then refi if enabled — compared against the standard `baseline` (no extra, no refi), as opposed to `monthsSaved`/`interestSaved` which compare `accelerated` (extra payments only) against `baseline` and ignore any refi. When `refiPlan` is null these fall back to the `accelerated`-vs-`baseline` numbers. **They can legitimately go negative** (e.g. a refi that resets to a long fresh term, per the `refiPlan` gotcha above, can make `effectivePayoffMonths` exceed even the no-extra `baseline.months`) — don't clamp them; UI consumers gate display on `> 0` the same way the older `monthsSaved`/`interestSaved` fields already do.
- **`termData`/`compareChartData`**: recomputes amortization for all four `TERMS` (15/20/25/30) at the _current_ loan amount regardless of `inputs.term`, purely for the Compare tab. `holdMonths` (from `inputs.holdYears`) is the point at which "balance/interest/equity if you sold or refi'd at year N" is sampled — `cheapestHold` picks whichever term has the least interest paid by that point, not overall.

Numbers throughout are dollars (not cents) and percentages as `6.6` (not `0.066`) — matches the root `LoanInputs` convention; do not introduce cents or fractional-percent representations here.

## `servicing.ts` — `simulateServicing` (Owning-mode engine)

`plan.ts`/`computeMortgagePlan` is the **Buying-mode** engine: one loan, one optional refi, answered from `LoanInputs` directly. `servicing.ts`/`simulateServicing` is the **Owning-mode** engine: an arbitrary timeline of `MortgageEvent`s (`events.ts`) applied to a loan, simulated month by month into a `LedgerRow[]`. They are deliberately not merged — Buying mode keeps calling `computeMortgagePlan` unchanged; Owning mode calls `simulateServicing`. `mortgage.ts`'s `amortize` isn't reused here (no per-month row object, and the ledger needs one) — `simulateServicing` writes its own loop but still calls `pmt`.

### The event model

Five kinds (`MortgageEventKind`): `refinance`, `extra` (recurring, monthly or annual, optional `endMonth`), `lump` (one-time), `recast`, `escrow` (override). Any number of events, of any kind, may coexist on one timeline, including several in the same month.

### Composition rules (the non-obvious part — this is why the tests look the way they do)

1. **Extras survive refinances.** A recurring `extra` event runs from its `month` until its `endMonth` (or payoff) straight through any refinance in between — nothing in the extras step (step 7 below) consults refinance state. Stopping early is expressed by setting `endMonth`, not by a separate flag.
2. **Extras of different cadences sum.** A monthly extra and an annual bonus landing in the same month both contribute — never let one shadow the other.
3. **Recast re-amortizes over the _contractual_ remaining term, not the projected payoff.** `remainingMonths` is a counter decremented once per month (at the top of the month's processing, before any event is applied — so mid-month it already reads "months left after this month's payment," e.g. 300 at month 60 of a fresh 30-year loan) and reset to `ev.termYears * 12 - 1` on refinance (one payment of the fresh term is already spoken for, since refinance is applied before the payment step). It is **never** derived from the balance. This matters when extras are stacked: someone paying extra every month is projected to pay off years early but still has the full contractual term left, and a recast uses the contractual figure.
4. **PMI re-evaluates after every refinance.** A cash-out refi that pushes the new balance above 80% of the current appreciated home value brings PMI back, restarting the 78%-termination clock against the new balance/value. PMI is tracked as **periods** (`{ startMonth, endMonth }[]`), not a one-way switch, precisely because of this.
5. **Escrow drift compounds independently of everything else.** Taxes and insurance climb on their own anniversary schedule (`escrowDriftEnabled`/`taxInflationPct`/`insuranceInflationPct`) regardless of refinances, recasts, or payoff acceleration — they follow the house, not the loan. An explicit `escrow` event overrides the drifted running value for that field only (`null` leaves the other field alone).
6. **Same-month ordering is fixed**: escrow changes → refinance → recast → payment (interest, scheduled principal, then extras/lumps, clamped at payoff). Two refinances in the same month chain sequentially (each operates on the balance the previous one left), so the later one in array order determines the final rate/term/balance ("last wins").

### Within-month order of operations

1. Escrow anniversary drift (once every 12 months, skipped on month 1).
2. Explicit `escrow` events override the drifted values.
3. `refinance` events: `payoffBalance` → `costs` → `newBalance` (cash-out and/or rolled-in costs) → new `rate`/`scheduledPI`/`remainingMonths`; records a `RefinanceSummary` (old vs. new payment, `breakevenMonths` — `null` unless the new payment is lower, mirroring `plan.ts`'s `refiPlan` convention — and `termResetMonths`).
4. `recast` events: lump sum reduces balance directly (not through the normal principal/extra clamp), `scheduledPI` is recomputed at the **unchanged** rate over `remainingMonths`, fee is out-of-pocket.
5. Interest accrues on the post-refi/post-recast balance.
6. Scheduled principal = `scheduledPI - interest` (floored at 0).
7. Extras: sum every applicable `extra`/`lump` event, never pick one (rules 1–2).
8. Clamp at payoff: scheduled principal first, then extras, capped at the remaining balance — this is what keeps `startBalance - principal - extra === endBalance` exact on every row (`startBalance` is captured after refinance but before recast, so a recast's lump sum is folded into `extra`, not double-counted).
9. PMI: a self-contained block (conventional-loan rules specifically — 80%-request / 78%-auto / 2-year appraisal path) so a future `loanProgram` field has one obvious place to branch; FHA/VA follow entirely different mortgage-insurance rules and must not leak in here.
10. Push the `LedgerRow`.

Loop guard: `while (balance > 1 && m < MAX_MONTHS)` with `MAX_MONTHS = 40 * 12` — a safety bound against pathological event chains, not a real amortization limit, mirroring `amortize`'s cap.

`ServicingResult.pmiRequestMonth`/`pmiAutoMonth`/`pmiAppraisalMonth` report the next-upcoming milestones for whichever PMI period is active **as of `ctx.today`** (not whichever period happens to be open at the very end of a full 30-year simulation — PMI is usually long gone by then). This is why `ServicingContext` carries `today` alongside `firstPaymentDate`.

### Leave-one-out attribution

`attributeEvents` re-simulates the timeline once per enabled event with that event removed and diffs against the full run (`N + 1` simulations for `N` events; returns `[]` above 25 events). It's order-independent and honest about interaction — the parts are **not** made to sum to the whole; UI copy should say "approximate" rather than trying to reconcile them.

### Testing

`servicing.test.ts` follows `plan.test.ts`'s conventions (`toBeCloseTo` for money, relational assertions over hardcoded magic numbers). The anchor test is the empty-timeline case matching `amortize`'s payoff month/total interest — every other test builds on that baseline being trustworthy.

## Testing

`mortgage.test.ts` and `plan.test.ts` cover the primitives and a few representative scenarios (PMI threshold, loan-amount arithmetic) — not exhaustive coverage of every derived field. When changing formulas here, prefer adding a targeted test over trusting manual inspection, since a wrong constant (e.g. the PMI rate `0.006`, the buydown floor `0.25`) is easy to typo and hard to eyeball-verify from the UI.

Component tests now exist alongside this pure engine layer. `vite.config.ts`'s `environmentMatchGlobs` routes `src/**/*.test.tsx` to `jsdom` (everything else, including this directory's `*.test.ts` files, stays on `environment: "node"`), rendered with `@testing-library/react`, `@testing-library/user-event`, and `@testing-library/jest-dom`. Convention: a `.test.tsx` file next to the component it covers, using `render`/`screen`/`userEvent` — no custom provider wrapper is needed since `Tooltip` (and Base UI's `Dialog`/`AlertDialog` roots) wrap themselves. These tests exercise wiring (props in → DOM out, DOM interaction → `onChange` patch shape), never the math in this directory, which stays covered by its own `*.test.ts` files.
