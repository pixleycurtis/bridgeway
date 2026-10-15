import type { Loan, Model, ModelTypeId, OpexItem, CostItem } from "./types";
import { uid } from "./types";

export const ALL_TABS = ["building", "rentroll", "opex", "closing", "financing", "cashflow", "waterfall", "wc", "comps", "accounting", "custom", "summary"] as const;
export type TabId = (typeof ALL_TABS)[number];
export const TAB_LABELS: Record<TabId, string> = {
  building: "Building", rentroll: "Rent roll", opex: "Operating expenses", closing: "Closing costs", financing: "Financing",
  cashflow: "Cash flow", waterfall: "Waterfall", wc: "Working capital", comps: "Comps", accounting: "Accounting check", custom: "Custom fields", summary: "Summary",
};

export interface ModelTypeDef { id: ModelTypeId; label: string; blurb: string; loan: Partial<Loan>; hiddenTabs: TabId[]; holdYears?: number }

export const MODEL_TYPES: ModelTypeDef[] = [
  { id: "stabilized", label: "Stabilized multifamily", blurb: "Leased-up asset, long-term agency or bank debt.", loan: { kind: "amortizing", ioMonths: 0 }, hiddenTabs: [] },
  { id: "valueadd", label: "Value-add / renovation", blurb: "Unit turns to market rent with a renovation budget.", loan: { kind: "amortizing", ioMonths: 24 }, hiddenTabs: [] },
  { id: "bridge", label: "Bridge-to-perm", blurb: "Interest-only bridge during lease-up, then refinance.", loan: { kind: "bridge", rate: 0.085, points: 0.01, termMonths: 36, refi: { month: 30, ltv: 0.7, rate: 0.065, amortYears: 30, valueCap: 0.0625 } }, hiddenTabs: [] },
  { id: "hardmoney", label: "Hard money / fix-and-flip", blurb: "Short hold, high rate and points, exit on sale.", loan: { kind: "hardmoney", ltv: 0.75, rate: 0.115, points: 0.025, termMonths: 12 }, hiddenTabs: ["waterfall"], holdYears: 1 },
  { id: "residential", label: "Small residential (1–4)", blurb: "Duplex to fourplex, conventional 30-year loan.", loan: { kind: "amortizing", ltv: 0.75, ioMonths: 0 }, hiddenTabs: ["waterfall", "accounting"] },
  { id: "hospitality", label: "Hospitality", blurb: "RevPAR-driven revenue, higher operating costs.", loan: { kind: "amortizing", ltv: 0.6, rate: 0.075, amortYears: 25 }, hiddenTabs: ["rentroll"] },
  { id: "industrial", label: "Industrial / NNN", blurb: "Lease-by-lease income, tenants reimburse expenses.", loan: { kind: "amortizing", ltv: 0.65, amortYears: 25 }, hiddenTabs: [] },
];
export const modelType = (id?: string) => MODEL_TYPES.find((t) => t.id === id) ?? MODEL_TYPES[0]!;

export const DEFAULT_LOAN: Loan = { kind: "amortizing", ltv: 0.7, rate: 0.0675, amortYears: 30, ioMonths: 0, termMonths: 120, points: 0.01, futureFunding: 0, extensionFee: 0, dscrTarget: 1.25, refi: null };

export function defaultOpex(units: number): OpexItem[] {
  const row = (label: string, basis: OpexItem["basis"], amount: number): OpexItem => ({ id: uid(), label, basis, amount, growth: 0.03 });
  return [row("Real estate taxes", "fixed", 0), row("Insurance", "perUnit", 650), row("Utilities", "perUnit", 900), row("Repairs & maintenance", "perUnit", 700),
    row("Management", "pctRevenue", 0.06), row("Payroll", "perUnit", units > 30 ? 900 : 0), row("Replacement reserves", "perUnit", 300)];
}
export function defaultClosing(): CostItem[] {
  const row = (label: string, basis: CostItem["basis"], amount: number): CostItem => ({ id: uid(), label, basis, amount });
  return [row("Title insurance", "pctPrice", 0.004), row("Escrow & settlement", "fixed", 3500), row("Legal", "fixed", 15000), row("Third-party reports", "fixed", 9000),
    row("Lender legal & fees", "fixed", 7500), row("Transfer tax", "pctPrice", 0.002), row("Tax & insurance escrows", "fixed", 0)];
}

/** Starting model for a type. Keeps the deal's own leverage unless the type demands a different structure. */
export function seedModel(type: ModelTypeId, units: number, base: { ltv: number; rate: number; amortYears: number }): Model {
  const t = modelType(type);
  return {
    type, building: {}, units: [], vacancyPct: 0.05, turnover: { rate: 0.4, downMonths: 1, makeReady: 1500, premium: type === "valueadd" ? 150 : 0 },
    opex: defaultOpex(units), closing: defaultClosing(),
    loan: { ...DEFAULT_LOAN, ltv: base.ltv, rate: base.rate, amortYears: base.amortYears, ...t.loan },
    budget: [], waterfall: { lpShare: 0.9, pref: 0.08, promote: 0.3 }, workingCapital: { start: units * 500, minBalance: units * 250, draws: [] },
    comps: [], accounting: [], custom: [], hiddenTabs: t.hiddenTabs,
  };
}

/** Rule-based pick of a model type from what the deal tells us. */
export function recommendType(input: { propertyType: string; units: number; occupancy: number | null; rentGap: number; renoBudget: number; holdYears: number }): { id: ModelTypeId; reason: string } {
  const p = input.propertyType.toLowerCase();
  if (/hotel|hospital/.test(p)) return { id: "hospitality", reason: "Hotel revenue is driven by occupancy and ADR, not leases." };
  if (/industrial|retail|office|nnn/.test(p)) return { id: "industrial", reason: "Commercial leases with expense reimbursements." };
  if (input.holdYears <= 1) return { id: "hardmoney", reason: "Hold of a year or less points to short-term hard money and an exit on sale." };
  if (input.units > 0 && input.units <= 4) return { id: "residential", reason: "1–4 units qualifies for residential financing." };
  if (input.occupancy != null && input.occupancy < 0.85) return { id: "bridge", reason: `Occupancy is ${Math.round(input.occupancy * 100)}%, below what permanent lenders want — bridge until stabilized, then refinance.` };
  if (input.rentGap >= 0.1 || input.renoBudget > 0) return { id: "valueadd", reason: `In-place rents are ${Math.round(input.rentGap * 100)}% below market${input.renoBudget ? " and there is a renovation budget" : ""}.` };
  return { id: "stabilized", reason: "Leased-up with rents near market — standard long-term debt fits." };
}
