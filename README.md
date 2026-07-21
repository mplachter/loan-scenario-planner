# Loan Scenario Planner

An interactive calculator for modeling home-purchase costs, mortgage terms, rate buydowns, extra payments, and refinancing scenarios.

**Live demo:** https://mplachter.github.io/loan-scenario-planner/

## Features

- Multi-scenario planning with browser-local persistence (save, switch, rename, and delete named scenarios)
- 2-1 rate buydown modeling
- Extra-payment strategies (match a shorter term, custom amount, or route buydown savings to principal)
- Refinance modeling with breakeven analysis
- Side-by-side comparison across 15/20/25/30-year terms
- Closing-costs and seller-concession breakdown

## Tech stack

React, TypeScript, Vite, Tailwind CSS v4, shadcn/ui + Radix UI, Recharts, Vitest

## Local development

```bash
npm install
npm run dev
```

## Scripts

| Script                 | Description                          |
| ---------------------- | ------------------------------------ |
| `npm run dev`          | Start the Vite dev server            |
| `npm run build`        | Type-check and build for production  |
| `npm run preview`      | Preview the production build locally |
| `npm run lint`         | Run ESLint                           |
| `npm run typecheck`    | Run `tsc --noEmit`                   |
| `npm run format`       | Format the codebase with Prettier    |
| `npm run format:check` | Check formatting without writing     |
| `npm run test`         | Run the Vitest test suite            |

## Disclaimer

Estimates only, not a loan offer. Verify rates, taxes, insurance, and closing costs with your lender, insurer, and the Broward County Property Appraiser before relying on these numbers.

## License

MIT
