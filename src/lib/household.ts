export type PayFrequency = "weekly" | "biweekly" | "semimonthly" | "monthly";
export type BudgetCategory = "needs" | "wants" | "savings";

export interface BudgetItem {
  id: string;
  label: string;
  amount: number;
  category: BudgetCategory;
  isCustom: boolean;
}

// Starter rows a new scenario ships with — editable and deletable like any
// custom row, except these are `isCustom: false` so they can be zeroed out
// but not removed (keeps the category populated with a sensible default).
// No default `savings`-category row: savings flows through the Phase 8
// waterfall, not a flat budget line, so a default row here would double-count.
export const STARTER_BUDGET_ITEMS: BudgetItem[] = [
  {
    id: "starter-groceries",
    label: "Groceries",
    amount: 600,
    category: "needs",
    isCustom: false,
  },
  {
    id: "starter-transportation",
    label: "Transportation / gas",
    amount: 200,
    category: "needs",
    isCustom: false,
  },
  {
    id: "starter-car-insurance",
    label: "Car insurance",
    amount: 150,
    category: "needs",
    isCustom: false,
  },
  {
    id: "starter-car-payment",
    label: "Car payment",
    amount: 0,
    category: "needs",
    isCustom: false,
  },
  {
    id: "starter-health",
    label: "Health / medical out-of-pocket",
    amount: 100,
    category: "needs",
    isCustom: false,
  },
  {
    id: "starter-subscriptions",
    label: "Subscriptions",
    amount: 50,
    category: "wants",
    isCustom: false,
  },
  {
    id: "starter-dining",
    label: "Dining out",
    amount: 200,
    category: "wants",
    isCustom: false,
  },
  {
    id: "starter-hobbies",
    label: "Hobbies & personal",
    amount: 150,
    category: "wants",
    isCustom: false,
  },
];

export interface Household {
  payFrequency: PayFrequency;
  netPayPerPaycheck: number;
  annualBonusNet: number; // take-home estimate of any bonus, not gross
  bonusMonth: number; // 1-indexed calendar month
  budgetItems: BudgetItem[];
}

export const DEFAULT_HOUSEHOLD: Household = {
  payFrequency: "biweekly",
  netPayPerPaycheck: 0,
  annualBonusNet: 0,
  bonusMonth: 3,
  budgetItems: STARTER_BUDGET_ITEMS,
};
