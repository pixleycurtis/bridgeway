export type LineKind = "income" | "expense";
export interface LineItem {
  key: string;
  label: string;
  kind: LineKind;
  broker: number;
  t12: number;
  underwrite: number;
}
export interface Assumptions {
  price: number;
  units: number;
  closingPct: number;
  capex: number;
  ltv: number;
  rate: number;
  amortYears: number;
  rentGrowth: number;
  expenseGrowth: number;
  exitCap: number;
  holdYears: number;
  sellPct: number;
  /** Hospitality only. */
  rooms?: number;
  occupancy?: number;
  adr?: number;
}
export interface Adjustment {
  id: string;
  label: string;
  type: "annual" | "onetime";
  amount: number;
  /** Id of the data room / title item or reconcile line this finding came from. */
  source?: string;
}

/** Turn a priced finding into a retrade adjustment. A price credit costs the buyer like one-time capital. */
export function findingAdjustment(source: string, label: string, impact: { type: "annual" | "onetime" | "credit"; amount: number }): Adjustment {
  return { id: `f-${source}`, source, label: impact.type === "credit" ? `${label} (credit)` : label, type: impact.type === "annual" ? "annual" : "onetime", amount: impact.amount };
}

/** Lines where underwriting is at least 10% more optimistic than the T-12, with the yearly NOI at stake. */
export function underwritingGaps(items: LineItem[]) {
  return items.flatMap((l) => {
    if (!l.t12) return [];
    const gap = l.kind === "income" ? l.underwrite - l.t12 : l.t12 - l.underwrite;
    return gap / l.t12 >= 0.1 ? [{ key: l.key, label: `${l.label}: underwriting vs T-12`, amount: Math.round(gap) }] : [];
  });
}

export const sumBy = (items: LineItem[], col: "broker" | "t12" | "underwrite") => {
  const inc = items.filter((i) => i.kind === "income").reduce((a, i) => a + i[col], 0);
  const exp = items.filter((i) => i.kind === "expense").reduce((a, i) => a + i[col], 0);
  return { income: inc, expenses: exp, noi: inc - exp };
};

export function annualDebtService(loan: number, rate: number, years: number) {
  const r = rate / 12;
  const n = years * 12;
  if (r === 0) return loan / years;
  return ((loan * r) / (1 - Math.pow(1 + r, -n))) * 12;
}
function balance(loan: number, rate: number, years: number, paidYears: number) {
  const r = rate / 12;
  const n = years * 12;
  const k = paidYears * 12;
  const pmt = (loan * r) / (1 - Math.pow(1 + r, -n));
  return loan * Math.pow(1 + r, k) - pmt * ((Math.pow(1 + r, k) - 1) / r);
}

export function irr(flows: number[]) {
  const npv = (r: number) => flows.reduce((a, f, t) => a + f / Math.pow(1 + r, t), 0);
  let lo = -0.99, hi = 1.5;
  if (npv(lo) * npv(hi) > 0) return NaN;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (npv(lo) * npv(mid) <= 0) hi = mid; else lo = mid;
  }
  return (lo + hi) / 2;
}

export interface Analysis {
  noi: number; income: number; expenses: number;
  capRate: number; loan: number; debtService: number; dscr: number;
  equity: number; cashOnCash: number; irr: number; equityMultiple: number;
  flows: number[];
}

export function analyze(items: LineItem[], a: Assumptions, adj: Adjustment[] = [], priceOverride?: number): Analysis {
  const price = priceOverride ?? a.price;
  const base = sumBy(items, "underwrite");
  const annualAdj = adj.filter((x) => x.type === "annual").reduce((s, x) => s + x.amount, 0);
  const oneTime = adj.filter((x) => x.type === "onetime").reduce((s, x) => s + x.amount, 0);
  const income = base.income;
  const expenses = base.expenses + annualAdj;
  const noi = income - expenses;
  const loan = price * a.ltv;
  const ds = annualDebtService(loan, a.rate, a.amortYears);
  const equity = price - loan + price * a.closingPct + a.capex + oneTime;
  const flows = [-equity];
  let inc = income, exp = expenses;
  for (let y = 1; y <= a.holdYears; y++) {
    let cf = inc - exp - ds;
    if (y === a.holdYears) {
      const fwd = inc * (1 + a.rentGrowth) - exp * (1 + a.expenseGrowth);
      cf += (fwd / a.exitCap) * (1 - a.sellPct) - balance(loan, a.rate, a.amortYears, a.holdYears);
    }
    flows.push(cf);
    inc *= 1 + a.rentGrowth;
    exp *= 1 + a.expenseGrowth;
  }
  const total = flows.slice(1).reduce((s, f) => s + f, 0);
  return {
    noi, income, expenses, capRate: noi / price, loan, debtService: ds,
    dscr: noi / ds, equity, cashOnCash: (noi - ds) / equity,
    irr: irr(flows), equityMultiple: total / equity, flows,
  };
}

/** Price that holds target IRR after adjustments. */
export function solvePrice(items: LineItem[], a: Assumptions, adj: Adjustment[], target: number) {
  let lo = a.price * 0.3, hi = a.price * 1.5;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    const r = analyze(items, a, adj, mid).irr;
    if (isNaN(r) || r < target) hi = mid; else lo = mid;
  }
  return (lo + hi) / 2;
}

/** Hotel operating metrics: RevPAR, rooms revenue, and price per key. */
export function hotelMetrics(rooms: number, occupancy: number, adr: number, price: number) {
  const revpar = occupancy * adr;
  return { revpar, roomsRevenue: revpar * rooms * 365, pricePerKey: rooms ? price / rooms : NaN, roomNightsSold: rooms * 365 * occupancy };
}

export const usd = (n: number, compact = false) =>
  isFinite(n)
    ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0, notation: compact ? "compact" : "standard" }).format(n)
    : "—";
export const pct = (n: number, d = 1) => (isFinite(n) ? `${(n * 100).toFixed(d)}%` : "—");
