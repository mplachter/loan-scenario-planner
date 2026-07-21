export interface AmortizeResult {
  months: number;
  totalInterest: number;
  payment: number;
  balances: number[];
  cumInterest: number[];
}

export function pmt(
  principal: number,
  annualRatePct: number,
  years: number,
): number {
  const r = annualRatePct / 100 / 12;
  const n = years * 12;
  if (principal <= 0) return 0;
  if (r <= 0) return principal / n;
  return (principal * r) / (1 - Math.pow(1 + r, -n));
}

export function amortize(
  principal: number,
  annualRatePct: number,
  years: number,
  extra: number | ((month: number) => number),
): AmortizeResult {
  const r = annualRatePct / 100 / 12;
  const basePayment = pmt(principal, annualRatePct, years);
  let balance = principal;
  let totalInterest = 0;
  let months = 0;
  const balances = [principal];
  const cumInterest = [0];
  const cap = years * 12 + 12;
  while (balance > 1 && months < cap) {
    months += 1;
    const interest = balance * r;
    const extraThisMonth =
      typeof extra === "function" ? extra(months) : extra || 0;
    let principalPaid = basePayment - interest + extraThisMonth;
    if (principalPaid > balance) principalPaid = balance;
    if (principalPaid < 0) principalPaid = 0;
    balance -= principalPaid;
    totalInterest += interest;
    balances.push(Math.max(balance, 0));
    cumInterest.push(totalInterest);
  }
  return { months, totalInterest, payment: basePayment, balances, cumInterest };
}

export const usd0 = (n: number) =>
  (n || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
