import { irr, type Adjustment, type Assumptions, type LineItem } from "../finance";
import { amortPayment, ioMonthsFor, lenderFees, maxLoanByDscr } from "./debt";
import { DEFAULT_LOAN } from "./model-types";
import type { Loan, Model } from "./types";

export interface MonthRow {
  m: number; gross: number; vacancy: number; other: number; egi: number; opex: number; noi: number;
  interest: number; principal: number; debtService: number; capex: number; cashFlow: number; balance: number; refi: number;
}
export interface YearRow extends Omit<MonthRow, "m" | "balance"> { y: number; dscr: number; balance: number }
export interface ModelResult {
  noi: number; income: number; expenses: number; capRate: number; loan: number; debtService: number; dscr: number;
  equity: number; cashOnCash: number; irr: number; unleveredIrr: number; equityMultiple: number; flows: number[];
  monthly: MonthRow[]; annual: YearRow[]; closingCosts: number; lenderFees: number; uses: { label: string; amount: number }[];
  sources: { label: string; amount: number }[]; minDscr: number; debtYield: number; maxLoanDscr: number; exitValue: number; saleProceeds: number;
}

const g = (rate: number, month: number) => Math.pow(1 + rate, (month - 1) / 12);
const lineAmt = (lines: LineItem[], key: string) => lines.find((l) => l.key === key)?.underwrite ?? 0;
const annualIrr = (monthly: number) => (isFinite(monthly) ? Math.pow(1 + monthly, 12) - 1 : NaN);

/** Total closing costs from itemized rows, or the flat % when no items are set. */
export function closingTotal(model: Model, price: number, loan: number, closingPct: number) {
  if (!model.closing) return price * closingPct;
  return model.closing.reduce((s, c) => s + (c.basis === "fixed" ? c.amount : c.basis === "pctPrice" ? c.amount * price : c.amount * loan), 0)
    + (model.custom ?? []).filter((f) => f.effect === "closingCost").reduce((s, f) => s + f.value, 0);
}

/** Monthly projection of the full model, rolled up by year. Annual figures are sums of the months. */
export function runModel(lines: LineItem[], a: Assumptions, model: Model, adj: Adjustment[] = [], priceOverride?: number): ModelResult {
  const price = priceOverride ?? a.price;
  const H = Math.max(1, Math.round(a.holdYears * 12));
  const loanDef: Loan = model.loan ?? { ...DEFAULT_LOAN, ltv: a.ltv, rate: a.rate, amortYears: a.amortYears, points: 0 };
  const loan0 = price * loanDef.ltv + loanDef.futureFunding;
  const fees = model.loan ? lenderFees(loanDef, price * loanDef.ltv) : 0;
  const closing = closingTotal(model, price, loan0, a.closingPct);
  const budget = (model.budget ?? []).reduce((s, b) => s + b.budget, 0);
  const oneTime = adj.filter((x) => x.type === "onetime").reduce((s, x) => s + x.amount, 0);
  const annualAdj = adj.filter((x) => x.type === "annual").reduce((s, x) => s + x.amount, 0);
  const wcStart = model.workingCapital?.start ?? 0;
  const equity = price + closing + fees + a.capex + budget + oneTime + wcStart - loan0;
  const customInc = (model.custom ?? []).filter((f) => f.effect === "annualIncome").reduce((s, f) => s + f.value, 0);
  const customExp = (model.custom ?? []).filter((f) => f.effect === "annualExpense").reduce((s, f) => s + f.value, 0);

  const units = model.units ?? [];
  const t = model.turnover ?? { rate: 0, downMonths: 0, makeReady: 0, premium: 0 };
  const unitCount = units.length || a.units;
  let rents = units.map((u) => (u.status === "occupied" ? u.rent : 0));

  const monthly: MonthRow[] = [];
  let bal = loan0, rate = loanDef.rate, amort = loanDef.amortYears, io = ioMonthsFor(loanDef, H), ioUntil = io, pmtStart = 1;
  let pmt = amortPayment(bal, rate, amort);
  for (let m = 1; m <= H; m++) {
    const gr = g(a.rentGrowth, m);
    let gross: number, vacancy: number, turnCost = 0;
    if (units.length) {
      rents = units.map((u, i) => {
        const target = (u.market || u.rent) * gr + t.premium;
        const cur = rents[i]!;
        if (cur === 0) return m > (u.status === "occupied" ? 0 : t.downMonths) ? target : 0; // vacant units lease up after downtime
        return cur + (target - cur) * (t.rate / 12);
      });
      gross = rents.reduce((s, r) => s + r, 0);
      vacancy = gross * (model.vacancyPct ?? 0) + gross * (t.rate * t.downMonths) / 12;
      turnCost = (units.length * t.rate * t.makeReady) / 12;
    } else {
      gross = (lineAmt(lines, "gpr") / 12) * gr;
      vacancy = (lineAmt(lines, "vacancy") / 12) * gr;
    }
    const other = ((lineAmt(lines, "other") + customInc) / 12) * gr;
    const egi = gross - vacancy + other;
    let opex: number;
    if (model.opex) {
      opex = model.opex.reduce((s, o) => s + (o.basis === "pctRevenue" ? o.amount * egi : ((o.basis === "perUnit" ? o.amount * unitCount : o.amount) / 12) * g(o.growth, m)), 0);
    } else {
      opex = (lines.filter((l) => l.kind === "expense" && l.key !== "vacancy").reduce((s, l) => s + l.underwrite, 0) / 12) * g(a.expenseGrowth, m);
    }
    opex += ((customExp + annualAdj) / 12) * g(a.expenseGrowth, m) + turnCost;
    const noi = egi - opex;

    // Refinance replaces the loan at the start of the refi month.
    let refi = 0;
    const r = loanDef.refi;
    if (r && m === r.month && m < H) {
      const trailing = monthly.slice(-11).reduce((s, x) => s + x.noi, noi);
      const newLoan = (trailing / r.valueCap) * r.ltv;
      refi = newLoan - bal;
      bal = newLoan; rate = r.rate; amort = r.amortYears; ioUntil = 0; pmtStart = m;
      pmt = amortPayment(bal, rate, amort);
    }
    void pmtStart;
    const interest = bal * (rate / 12);
    const payment = m <= ioUntil ? interest : pmt;
    const principal = Math.min(bal, payment - interest);
    bal -= principal;
    const draw = (model.workingCapital?.draws ?? []).filter((d) => d.month === m).reduce((s, d) => s + d.amount, 0);
    const capex = turnCost ? 0 : 0;
    monthly.push({ m, gross, vacancy, other, egi, opex, noi, interest, principal, debtService: payment, capex: capex + draw, cashFlow: noi - payment - draw + refi, balance: bal, refi });
  }

  const last12 = monthly.slice(-12).reduce((s, x) => s + x.noi, 0) * (12 / Math.min(12, monthly.length));
  const fwd = last12 * (1 + a.rentGrowth);
  const exitValue = fwd / a.exitCap;
  const saleProceeds = exitValue * (1 - a.sellPct) - bal + wcStart;
  const flows = [-equity, ...monthly.map((x, i) => x.cashFlow + (i === H - 1 ? saleProceeds : 0))];
  const unlevBasis = price + closing + a.capex + budget + oneTime;
  const unlev = [-unlevBasis, ...monthly.map((x, i) => x.noi - x.capex + (i === H - 1 ? exitValue * (1 - a.sellPct) : 0))];

  const annual: YearRow[] = [];
  for (let y = 0; y < Math.ceil(H / 12); y++) {
    const ms = monthly.slice(y * 12, y * 12 + 12);
    const sum = (k: keyof MonthRow) => ms.reduce((s, x) => s + x[k], 0);
    const ds = sum("debtService");
    annual.push({ y: y + 1, gross: sum("gross"), vacancy: sum("vacancy"), other: sum("other"), egi: sum("egi"), opex: sum("opex"), noi: sum("noi"),
      interest: sum("interest"), principal: sum("principal"), debtService: ds, capex: sum("capex"), cashFlow: sum("cashFlow"), refi: sum("refi"),
      balance: ms[ms.length - 1]!.balance, dscr: ds ? sum("noi") / ds : Infinity });
  }
  const y1 = annual[0]!;
  const annualFlows = [-equity, ...annual.map((y, i) => y.cashFlow + (i === annual.length - 1 ? saleProceeds : 0))];
  const total = annualFlows.slice(1).reduce((s, f) => s + f, 0);
  const y1noi = y1.noi * (12 / Math.min(12, H));
  const y1ds = y1.debtService * (12 / Math.min(12, H));
  return {
    noi: y1noi, income: y1.egi, expenses: y1.opex, capRate: y1noi / price, loan: loan0, debtService: y1ds, dscr: y1noi / y1ds,
    equity, cashOnCash: (y1noi - y1ds) / equity, irr: annualIrr(irr(flows)), unleveredIrr: annualIrr(irr(unlev)), equityMultiple: total / equity,
    flows: annualFlows, monthly, annual, closingCosts: closing, lenderFees: fees,
    uses: [{ label: "Purchase price", amount: price }, { label: "Closing costs", amount: closing }, { label: "Lender fees", amount: fees }, { label: "Upfront capex", amount: a.capex },
      { label: "Renovation budget", amount: budget }, { label: "Diligence findings", amount: oneTime }, { label: "Working capital reserve", amount: wcStart }].filter((u) => u.amount),
    sources: [{ label: "Loan", amount: loan0 }, { label: "Equity", amount: equity }],
    minDscr: Math.min(...annual.map((y) => y.dscr)), debtYield: y1noi / loan0,
    maxLoanDscr: maxLoanByDscr(y1noi, loanDef.rate, loanDef.amortYears, loanDef.dscrTarget, ioMonthsFor(loanDef, H) >= 12),
    exitValue, saleProceeds,
  };
}

/** Price that holds target IRR under the full model. */
export function solveModelPrice(lines: LineItem[], a: Assumptions, model: Model, adj: Adjustment[], target: number) {
  let lo = a.price * 0.3, hi = a.price * 1.5;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const r = runModel(lines, a, model, adj, mid).irr;
    if (isNaN(r) || r < target) hi = mid; else lo = mid;
  }
  return (lo + hi) / 2;
}
