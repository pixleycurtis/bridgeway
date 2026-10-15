/** Full underwriting model stored on deals.model. Every field is optional so old deals still open. */
export type ModelTypeId = "stabilized" | "valueadd" | "bridge" | "hardmoney" | "residential" | "hospitality" | "industrial";

export interface Unit { id: string; label: string; type: string; sf: number; rent: number; market: number; leaseEnd: string; status: "occupied" | "vacant" | "down" }
export interface Turnover { rate: number; downMonths: number; makeReady: number; premium: number }
export interface OpexItem { id: string; label: string; basis: "fixed" | "perUnit" | "pctRevenue"; amount: number; growth: number }
export interface CostItem { id: string; label: string; basis: "fixed" | "pctPrice" | "pctLoan"; amount: number }
export type LoanKind = "amortizing" | "io" | "bridge" | "hardmoney";
export interface Loan {
  kind: LoanKind; ltv: number; rate: number; amortYears: number; ioMonths: number; termMonths: number;
  points: number; futureFunding: number; extensionFee: number; dscrTarget: number;
  refi?: { month: number; ltv: number; rate: number; amortYears: number; valueCap: number } | null;
}
export interface BudgetItem { id: string; label: string; budget: number; spent: number }
export interface Waterfall { lpShare: number; pref: number; promote: number }
export interface WorkingCapital { start: number; minBalance: number; draws: { id: string; month: number; label: string; amount: number }[] }
export interface Comp { id: string; kind: "sale" | "rent"; address: string; date: string; price: number; units: number; cap: number; rent: number; sf: number }
export interface AccountingRow { id: string; category: string; actual: number; mapsTo: string }
export interface CustomField { id: string; label: string; kind: "usd" | "pct" | "n"; value: number; effect: "none" | "annualExpense" | "annualIncome" | "closingCost" }

export interface Model {
  type?: ModelTypeId;
  building?: Record<string, string>;
  units?: Unit[];
  vacancyPct?: number;
  turnover?: Turnover;
  opex?: OpexItem[];
  closing?: CostItem[];
  loan?: Loan;
  budget?: BudgetItem[];
  waterfall?: Waterfall;
  workingCapital?: WorkingCapital;
  comps?: Comp[];
  accounting?: AccountingRow[];
  custom?: CustomField[];
  hiddenTabs?: string[];
  templateId?: string | null;
}

export const uid = () => crypto.randomUUID();
