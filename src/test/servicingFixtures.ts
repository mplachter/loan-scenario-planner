import {
  DEFAULT_INPUTS,
  type ClosedLoanInputs,
  type LoanInputs,
} from "@/lib/defaults";
import {
  servicingContextFromInputs,
  type ServicingContext,
} from "@/lib/servicing";

export const TODAY = "2026-08-08";

export function closedInputs(
  overrides: Partial<LoanInputs> = {},
): ClosedLoanInputs {
  return {
    ...DEFAULT_INPUTS,
    mode: "owning",
    closeDate: "2026-03-15",
    firstPaymentDate: "2026-05-01",
    servicedLoanAmount:
      DEFAULT_INPUTS.purchasePrice * (1 - DEFAULT_INPUTS.downPct / 100),
    servicedRate: DEFAULT_INPUTS.rates[DEFAULT_INPUTS.term],
    servicedTerm: DEFAULT_INPUTS.term,
    ...overrides,
  } as ClosedLoanInputs;
}

export function ctxFrom(overrides: Partial<LoanInputs> = {}): ServicingContext {
  return servicingContextFromInputs(closedInputs(overrides), TODAY);
}
