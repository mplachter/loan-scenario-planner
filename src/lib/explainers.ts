export interface Explainer {
  term: string; // "Recast"
  what: string; // one or two plain sentences
  why: string; // when and why you'd want it
  watchOut?: string; // the trap
}

export type ExplainerKey =
  | "refinance"
  | "cashOutRefi"
  | "recast"
  | "lumpSum"
  | "recurringExtra"
  | "biweekly"
  | "pmi"
  | "pmiRemoval"
  | "escrow"
  | "escrowShortage"
  | "paymentCreep"
  | "breakeven"
  | "clockReset"
  | "serialRefiTrap"
  | "netProceeds"
  | "prepayVsInvest"
  | "points"
  | "buydown"
  | "sellerCredit"
  | "rateLock"
  | "prepaidInterest"
  | "ltv"
  | "existingLoanEntry"
  | "takeHomeVsGross"
  | "fiftyThirtyTwenty";

export const EXPLAINERS: Record<ExplainerKey, Explainer> = {
  refinance: {
    term: "Refinance",
    what: "You pay off your current loan with a brand-new one — new rate, new term, new closing costs — usually to get a lower rate or change how long you have left to pay.",
    why: "Worth considering when rates have dropped enough that the payment savings outweigh the closing costs, or when you need to change loan terms (e.g. drop PMI, pull cash out, switch from a 30 to a 15).",
    watchOut:
      "Every refinance rolls new closing costs in. Refinance into a fresh term and you can end up paying interest for longer overall, even at a lower rate — see the clock-reset explainer.",
  },
  cashOutRefi: {
    term: "Cash-out refinance",
    what: "A refinance where the new loan is bigger than your payoff balance — the difference is handed to you in cash at closing.",
    why: "A way to tap home equity without a separate HELOC or second mortgage, often used for renovations or debt consolidation.",
    watchOut:
      "It raises your balance and can push your loan-to-value back above 80%, bringing PMI back even if you'd already gotten rid of it.",
  },
  recast: {
    term: "Recast",
    what: "You send the lender a lump sum, they re-amortize your loan over the remaining term at your existing rate, and your required monthly payment drops. Your rate and payoff date stay the same.",
    why: "It's the cheap alternative to refinancing — typically a $150–$500 fee instead of thousands, no credit check, no appraisal, and you keep your rate. It's the right move when you have cash and want a lower required payment but your current rate is already good.",
    watchOut:
      "Not all loans allow it (most conventional do; FHA/VA generally don't), and lowering your payment means paying more total interest than if you'd kept paying the old, higher amount after applying the lump sum.",
  },
  lumpSum: {
    term: "Lump sum",
    what: "A one-time extra payment applied directly to principal, with no change to your required monthly payment or your loan's amortization schedule.",
    why: "The straightforward way to use a bonus, inheritance, or windfall to shrink your balance and pay less interest, without paying a recast fee.",
    watchOut:
      "Unlike a recast, your required payment doesn't change — you still owe the same monthly amount, you just reach $0 sooner.",
  },
  recurringExtra: {
    term: "Recurring extra payment",
    what: "An ongoing amount added to principal every month (or on some other cadence), on top of your required payment.",
    why: "The most reliable way to cut years and interest off a loan without refinancing — you can start, stop, or change it anytime since it's not a contractual obligation.",
  },
  biweekly: {
    term: "Biweekly payments",
    what: "Paying half your monthly payment every two weeks instead of the full amount once a month. Because a year has 52 weeks, this works out to 26 half-payments — 13 full monthly payments a year instead of 12.",
    why: "It's a disciplined way to make one extra payment a year without noticing it, since it's spread across paychecks.",
    watchOut:
      "Servicer-run biweekly programs often charge a setup or per-transaction fee for something you can replicate yourself for free — just set a recurring extra of 1/12 of your payment and get the same result.",
  },
  pmi: {
    term: "Private mortgage insurance (PMI)",
    what: "An added monthly premium lenders charge on conventional loans with less than 20% down, protecting the lender (not you) if you default.",
    why: "It's the price of buying with less money down — it lets you buy sooner instead of saving for years to hit 20%, but it adds to your payment until it's removed.",
    watchOut:
      "This explainer describes conventional-loan PMI specifically. FHA and VA loans follow different mortgage-insurance rules — FHA's MIP often never cancels, and VA loans have no monthly premium at all.",
  },
  pmiRemoval: {
    term: "Getting rid of PMI",
    what: "Three separate paths on a conventional loan: (1) request removal once you hit 80% loan-to-value of the original purchase price, (2) automatic termination at 78%, or (3) a new appraisal after about two years if the home has appreciated.",
    why: "The appraisal path is often years earlier than the other two and the one most people never ask about — if your area has appreciated, it can be the fastest way off PMI.",
    watchOut:
      "This is conventional-loan specific. FHA MIP with under 10% down never cancels for the life of the loan.",
  },
  escrow: {
    term: "Escrow",
    what: "An account your lender holds to collect and pay your property taxes and insurance for you, funded through a slice of your monthly payment.",
    why: "It spreads two large annual bills into predictable monthly amounts and guarantees they get paid on time.",
  },
  escrowShortage: {
    term: "Escrow shortage",
    what: "When your escrow account collected less than it actually needed to pay taxes and insurance for the year — usually because a bill went up — the lender covers the gap and then raises your payment to recoup it.",
    why: "Understanding this explains payment jumps that have nothing to do with your principal and interest.",
  },
  paymentCreep: {
    term: "Payment creep",
    what: "Your principal & interest is fixed for the life of the loan; your escrow is not. Property taxes get reassessed and insurance premiums rise, so the actual total payment climbs over time.",
    why: "Budgeting off your year-one payment alone understates what you'll actually owe by year ten.",
  },
  breakeven: {
    term: "Break-even",
    what: "The number of months of payment savings it takes to recover a refinance's closing costs.",
    why: "It's the simplest gut-check for whether a refi is worth it: compare the break-even against how much longer you actually plan to keep the loan.",
    watchOut:
      "A break-even you'll never reach because you're selling first means the refi loses money regardless of how good the rate looks.",
  },
  clockReset: {
    term: "The clock-reset trap",
    what: "Refinancing a 30-year loan you're 5 years into back to a fresh 30-year term means paying interest across 35 years total, not 30.",
    why: "A lower rate on a longer clock can still cost more in total interest than staying on your original schedule.",
    watchOut:
      "Refinancing into a shorter term, or continuing to pay your old payment amount on the new (lower-rate) loan, avoids this trap.",
  },
  serialRefiTrap: {
    term: "The serial-refi trap",
    what: "Each refinance rolls its own closing costs into the new balance.",
    why: "Refinance three times chasing rate drops and you can owe more than you did two years ago, despite never taking cash out and despite every individual rate being lower.",
    watchOut:
      "Watch the total refi costs across the whole chain, not each refinance in isolation.",
  },
  netProceeds: {
    term: "Net sale proceeds",
    what: "What you actually walk away with after selling: home value, minus your loan payoff balance, minus selling costs (agent commissions, closing costs, transfer taxes).",
    why: "Equity on paper and cash in hand aren't the same number — selling costs typically run 6-8% of the sale price.",
  },
  prepayVsInvest: {
    term: "Prepay vs. invest",
    what: "The choice between sending extra cash to your mortgage principal or investing it instead.",
    why: "Paying down a 6.6% mortgage is a guaranteed, risk-free 6.6% return. Investing might beat it, but isn't guaranteed, and the gains are typically taxed.",
    watchOut:
      "The comparison is guaranteed-and-tax-free against expected-and-taxed — a higher expected return doesn't automatically make investing the right call for every risk tolerance.",
  },
  points: {
    term: "Discount points",
    what: "An upfront fee paid at closing to buy down your note rate for the life of the loan — typically 1% of the loan amount per point.",
    why: "Worth it if you'll keep the loan long enough for the monthly savings to recover the upfront cost — check the break-even against how long you actually expect to hold the loan.",
  },
  buydown: {
    term: "2-1 rate buydown",
    what: "A temporary subsidy that lowers your out-of-pocket payment by 2% in year 1 and 1% in year 2, then settles at the full note rate from year 3 on. The loan itself amortizes at the full rate the entire time — a subsidy account, funded by you or the seller, covers the difference.",
    why: "Useful as negotiating leverage with a seller, or to ease into a payment while income ramps up — it doesn't change your actual interest rate.",
  },
  sellerCredit: {
    term: "Seller credit",
    what: "Money the seller contributes at closing, which can offset your closing costs and prepaids (and a buydown subsidy, if funded that way) — but not your down payment.",
    why: "It's a way to get help with cash needed at closing without changing the purchase price, subject to a loan-program cap based on loan-to-value.",
  },
  rateLock: {
    term: "Rate lock",
    what: "An agreement with your lender that freezes your interest rate for a set window while your loan is processed, protecting you from rate movements before closing.",
    why: "Without a lock, the rate you were quoted can drift before you actually close — a lock guarantees the number you planned around.",
  },
  prepaidInterest: {
    term: "Prepaid (per-diem) interest",
    what: "Interest that accrues from your close date through the end of that calendar month, collected upfront at closing since your first regular payment doesn't happen until the following month.",
    why: "It's a real closing-cost line — closing later in the month means less prepaid interest; closing right after the 1st means close to a full month's worth.",
  },
  ltv: {
    term: "Loan-to-value (LTV)",
    what: "Your loan amount as a percentage of the home's value — a $560,000 loan on a $700,000 home is 80% LTV.",
    why: "LTV drives PMI requirements, seller-concession caps, and refinance eligibility — most conventional-loan thresholds are stated as LTV percentages.",
  },
  existingLoanEntry: {
    term: "Already own a home?",
    what: "Skip the shopping questions — purchase price, points, closing costs — and enter your loan as it stands today: balance, rate, and time left.",
    why: "It drops you straight into Owning mode with a working timeline, so you can model refinances, extra payments, and payoff the same way as someone who bought through this app.",
  },
  takeHomeVsGross: {
    term: "Why net pay, not gross",
    what: "This app asks for your take-home pay per paycheck — what actually hits your bank account after taxes, insurance, and 401(k) — not your gross salary.",
    why: "Getting this right from gross income means modeling federal tax brackets, FICA, and whichever of the 50 states' rules applies, all of which change every year. Your pay stub already has the correct after-tax number for your exact situation, so asking for it sidesteps that entirely.",
    watchOut:
      "This app doesn't do any tax-bracket math anywhere — if your pay changes (a raise, a new 401(k) contribution rate), update this number by hand.",
  },
  fiftyThirtyTwenty: {
    term: "The 50/30/20 rule",
    what: "A rough budgeting split: 50% of take-home pay to needs (housing, groceries, utilities, minimum debt payments), 30% to wants (dining out, hobbies, subscriptions), and 20% to savings (retirement, emergency fund, extra debt paydown).",
    why: "It's a quick reference point for whether your spending is balanced, not a rule you have to hit exactly — everyone's real numbers differ, especially with a large mortgage payment.",
  },
};
