# Loan Scenario Planner

A client-only React/TypeScript calculator for modeling home-purchase costs, mortgage terms, rate buydowns, extra-payment strategies, and refinancing. No backend — everything runs in the browser and persists to `localStorage`. Deployed as a static site to GitHub Pages.

Keep changes green against lint, typecheck, format:check, test, and build before considering a task done — CI has no separate "warnings only" tier.

## Architecture

Single-page app, one active "scenario" at a time:

- `App.tsx` — top-level layout; wires `useScenarios` to `ScenarioBar` and `MortgageCalculator`.
- `hooks/useScenarios.ts` — owns the `ScenarioStore` (list of named scenarios + active id), persisted via `lib/scenarios.ts` (`localStorage`, key `loan-scenario-planner:v1`). All scenario CRUD (create/rename/delete/select) and input patching flows through here. Save failures (e.g. quota) are swallowed by design — persistence is a non-critical enhancement, not a correctness requirement.
- `lib/defaults.ts` — the `LoanInputs` shape (every user-editable field) and `DEFAULT_INPUTS`. This is the single source of truth for what a scenario stores.
- `lib/plan.ts` — `computeMortgagePlan(inputs): MortgagePlan`, a pure function that derives _everything_ the UI displays (payments, amortization, closing costs, comparisons) from `LoanInputs`. See `src/lib/CLAUDE.md` for the domain logic in here.
- `lib/mortgage.ts` — low-level amortization math (`pmt`, `amortize`) that `plan.ts` builds on.
- `components/MortgageCalculator.tsx` — renders the summary stat cards + tab shell; calls `computeMortgagePlan` once per render and passes the resulting `plan` down.
- `components/tabs/*` — `SetupTab`, `StrategyTab`, `CompareTab`, `ClosingTab`. Each receives `{ inputs, onChange, plan }` and reads whichever slice of `plan`/`inputs` it needs — no tab-local derived state.
- `components/ui/*` — shadcn/ui primitives (button, card, input, tabs, slider, etc.). Generated/managed via `shadcn` CLI per `components.json`; treat as vendored — prefer composing them over hand-editing internals.

Data flow is one-directional and un-memoized beyond React's own re-render: `LoanInputs` (persisted) → `computeMortgagePlan` (recomputed every render) → props down to tabs. There is no client-side routing, no server, no auth.

## Conventions

- Import via the `@/*` path alias (`@/lib/...`, `@/components/...`, `@/hooks/...`), not relative paths across directories — configured in `tsconfig.json` and `vite.config.ts`.
- TypeScript `strict` mode with `noUnusedLocals`/`noUnusedParameters` — unused code is a build error, not a lint warning.
- Formatting is Prettier-owned (empty `.prettierrc.json` = all defaults); don't hand-format against it. ESLint (`eslint.config.js`) covers React hooks rules and TS; `eslint-config-prettier` disables stylistic overlap.
- Money values are plain `number`s (dollars, not cents); percentages are plain numbers like `6.6` meaning 6.6%, not `0.066`. Match this convention in any new fields — don't introduce a mixed units representation.
- Tests live next to source as `*.test.ts` (see `lib/mortgage.test.ts`, `lib/plan.test.ts`) and run under Vitest's `node` environment — no DOM/component tests currently exist in this repo.
