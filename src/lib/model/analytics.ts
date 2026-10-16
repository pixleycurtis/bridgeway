import type { LineItem } from "../finance";
import type { AccountingRow, Comp, Model, Waterfall, WorkingCapital } from "./types";
import type { MonthRow } from "./engine";
import { irr } from "../finance";

/** LP/GP split: capital back + pref pro-rata, then the remainder split with the GP promote. */
export function distribute(equity: number, annualDistributions: number[], w: Waterfall) {
  const lpCap = equity * w.lpShare, gpCap = equity - lpCap;
  let owedLp = lpCap, owedGp = gpCap;
  const lp: number[] = [-lpCap], gp: number[] = [-gpCap];
  for (const d of annualDistributions) {
    owedLp *= 1 + w.pref; owedGp *= 1 + w.pref;
    let left = Math.max(0, d), lpGet = 0, gpGet = 0;
    const owed = owedLp + owedGp;
    const t1 = Math.min(left, owed);
    if (owed > 0) { lpGet += t1 * (owedLp / owed); gpGet += t1 * (owedGp / owed); owedLp -= t1 * (owedLp / owed); owedGp -= t1 * (owedGp / owed); }
    left -= t1;
    lpGet += left * (1 - w.promote) * w.lpShare / (w.lpShare + (1 - w.lpShare));
    gpGet += left - left * (1 - w.promote) * w.lpShare;
    lp.push(lpGet); gp.push(gpGet);
  }
  const sum = (xs: number[]) => xs.slice(1).reduce((s, x) => s + x, 0);
  return { lp, gp, lpTotal: sum(lp), gpTotal: sum(gp), lpIrr: irr(lp), gpIrr: irr(gp), lpMultiple: lpCap ? sum(lp) / lpCap : NaN, gpMultiple: gpCap ? sum(gp) / gpCap : NaN };
}

/** Reserve balance month by month; operating shortfalls and scheduled draws come out of it. */
export function workingCapitalTrack(wc: WorkingCapital, months: MonthRow[]) {
  let bal = wc.start;
  return months.map((m) => {
    const draws = wc.draws.filter((d) => d.month === m.m).reduce((s, d) => s + d.amount, 0);
    const shortfall = Math.max(0, -(m.noi - m.debtService));
    bal = bal - draws - shortfall;
    return { m: m.m, draws, shortfall, balance: bal, low: bal < wc.minBalance };
  });
}

export function compStats(comps: Comp[], units: number) {
  const sales = comps.filter((c) => c.kind === "sale" && c.price > 0);
  const rents = comps.filter((c) => c.kind === "rent" && c.rent > 0);
  const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : NaN);
  const perUnit = avg(sales.filter((c) => c.units).map((c) => c.price / c.units));
  return { perUnit, cap: avg(sales.filter((c) => c.cap).map((c) => c.cap)), rent: avg(rents.map((c) => c.rent)), rentPsf: avg(rents.filter((c) => c.sf).map((c) => c.rent / c.sf)), impliedValue: perUnit * units, count: sales.length + rents.length };
}

/** Actual accounting figures summed by mapped underwrite line, with variance flags at the threshold. */
export function accountingCheck(rows: AccountingRow[], lines: LineItem[], threshold = 0.1) {
  return lines.map((l) => {
    const mapped = rows.filter((r) => r.mapsTo === l.key);
    const actual = mapped.reduce((s, r) => s + r.actual, 0);
    const variance = l.underwrite ? (actual - l.underwrite) / l.underwrite : NaN;
    return { key: l.key, label: l.label, kind: l.kind, underwrite: l.underwrite, actual, count: mapped.length, variance, flag: mapped.length > 0 && Math.abs(variance) >= threshold };
  });
}

/** What a template carries from a deal's model: structure, not property-specific numbers. */
export function templateConfig(m: Model): Model {
  return { opex: m.opex?.map((o) => ({ ...o, amount: o.basis === "fixed" ? 0 : o.amount })), closing: m.closing, loan: m.loan, turnover: m.turnover, vacancyPct: m.vacancyPct,
    waterfall: m.waterfall, custom: m.custom?.map((c) => ({ ...c })), hiddenTabs: m.hiddenTabs, workingCapital: m.workingCapital ? { ...m.workingCapital, draws: [] } : undefined };
}
/** Apply a template on top of a deal's model, keeping the property's own data (units, building, comps, accounting). */
export function applyTemplate(m: Model, cfg: Model, type: string): Model {
  const keep = { building: m.building, units: m.units, comps: m.comps, accounting: m.accounting, budget: m.budget };
  const fixed = new Map((m.opex ?? []).map((o) => [o.label.toLowerCase(), o.amount]));
  return { ...m, ...cfg, ...keep, type: type as Model["type"], opex: cfg.opex?.map((o) => ({ ...o, id: crypto.randomUUID(), amount: o.basis === "fixed" && fixed.has(o.label.toLowerCase()) ? fixed.get(o.label.toLowerCase())! : o.amount })) };
}
