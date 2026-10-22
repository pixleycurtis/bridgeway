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
  type?: ModelTypeId | undefined;
  building?: Record<string, string> | undefined;
  units?: Unit[] | undefined;
  vacancyPct?: number | undefined;
  turnover?: Turnover | undefined;
  opex?: OpexItem[] | undefined;
  closing?: CostItem[] | undefined;
  loan?: Loan | undefined;
  budget?: BudgetItem[] | undefined;
  waterfall?: Waterfall | undefined;
  workingCapital?: WorkingCapital | undefined;
  comps?: Comp[] | undefined;
  accounting?: AccountingRow[] | undefined;
  custom?: CustomField[] | undefined;
  hiddenTabs?: string[] | undefined;
  templateId?: string | null | undefined;
  /** Analyst row preferences keyed by row id (e.g. "b.yearBuilt", "a.price"): renamed label, hidden, note. Display only. */
  layout?: Record<string, RowPref> | undefined;
  /** Row order per section (row ids). */
  order?: Record<string, string[]> | undefined;
  /** Analyst-added text rows per section. */
  customRows?: Record<string, { id: string; label: string }[]> | undefined;
  /** Where an imported value came from, keyed by row id. */
  sources?: Record<string, string> | undefined;
}
export interface RowPref { label?: string | undefined; hidden?: boolean | undefined; note?: string | undefined }

export const uid = () => crypto.randomUUID();
