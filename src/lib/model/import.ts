import type { Adjustment, Assumptions, LineItem } from "../finance";
import { BASE_FIELDS, type FieldDef } from "./fields";
import { matchLabel, normalize } from "./match";
import type { Loan, Model } from "./types";

/** Where one file row should go: a field id, a new row in a section, or nowhere. */
export type Dest = string; // field id | "new.opex" | "new.closing" | "new.custom" | "new.building" | "skip"
export interface Mapped { label: string; raw: string; dest: Dest }

interface DealParts { lines: LineItem[]; assumptions: Assumptions; model: Model; targetIrr: number; adjustments: Adjustment[] }

/** "$1,200" → 1200, "15%" → 0.15 for percent fields, "6.75" → 0.0675 for percent fields. */
export function toNumber(raw: string, kind: FieldDef["kind"]): number | null {
  const s = raw.replace(/[$,\s]/g, "");
  if (!s) return null;
  const neg = /^\(.*\)$/.test(s);
  const isPct = s.endsWith("%");
  const n = Number(s.replace(/[()%x]/gi, ""));
  if (!isFinite(n)) return null;
  const v = neg ? -n : n;
  if (kind === "pct") return isPct || Math.abs(v) <= 1 ? (isPct ? v / 100 : v) : v / 100;
  return isPct ? v / 100 : v;
}

const LOAN_TO_ASSUMPTION: Partial<Record<keyof Loan, keyof Assumptions>> = { ltv: "ltv", rate: "rate", amortYears: "amortYears" };
const OPEX_TO_LINE: Record<string, string> = { taxes: "taxes", insurance: "insurance", utilities: "utilities", repairs: "repairs", mgmt: "mgmt", payroll: "payroll", reserves: "reserves" };

/** Write confirmed mappings into the deal. Returns the patch plus the ids that were filled. */
export function applyMapped(d: DealParts, rows: Mapped[], fields: FieldDef[], fileName: string) {
  const full = !!d.model.type;
  const a = { ...d.assumptions };
  let lines = d.lines.map((l) => ({ ...l }));
  const m: Model = { ...d.model, building: { ...(d.model.building ?? {}) }, opex: [...(d.model.opex ?? [])], closing: [...(d.model.closing ?? [])], custom: [...(d.model.custom ?? [])],
    customRows: { ...(d.model.customRows ?? {}) }, sources: { ...(d.model.sources ?? {}) } };
  if (m.loan) m.loan = { ...m.loan };
  let targetIrr = d.targetIrr;
  const filled: string[] = [];
  const src = (id: string, label: string) => { m.sources![id] = `${fileName} · "${label}"`; filled.push(id); };
  const opexFor = (fieldId: string) => {
    const f = fields.find((x) => x.id === fieldId) ?? BASE_FIELDS.find((x) => x.id === fieldId);
    return m.opex!.find((o) => normalize(o.label) === normalize(f?.label ?? "") || matchLabel(o.label, BASE_FIELDS).fieldId === fieldId);
  };

  for (const r of rows) {
    if (r.dest === "skip") continue;
    if (r.dest.startsWith("new.")) {
      const id = crypto.randomUUID();
      if (r.dest === "new.building") { m.customRows!.building = [...(m.customRows!.building ?? []), { id, label: r.label }]; m.building![id] = r.raw; src(`b.${id}`, r.label); continue; }
      const v = toNumber(r.raw, "usd");
      if (v == null) continue;
      if (r.dest === "new.opex") { m.opex!.push({ id, label: r.label, basis: "fixed", amount: Math.abs(v), growth: a.expenseGrowth }); src(`opex:${id}`, r.label); }
      if (r.dest === "new.closing") { m.closing!.push({ id, label: r.label, basis: "fixed", amount: Math.abs(v) }); src(`cost:${id}`, r.label); }
      if (r.dest === "new.custom") { m.custom!.push({ id, label: r.label, kind: "usd", value: v, effect: "none" }); src(`custom.${id}`, r.label); }
      continue;
    }
    const f = fields.find((x) => x.id === r.dest);
    if (!f) continue;
    const [ns, key] = [r.dest.slice(0, r.dest.indexOf(".")), r.dest.slice(r.dest.indexOf(".") + 1)];
    if (f.kind === "text") { m.building![key] = r.raw; src(r.dest, r.label); continue; }
    const v = toNumber(r.raw, f.kind);
    if (v == null) continue;
    if (r.dest === "targetIrr") { targetIrr = v; src(r.dest, r.label); continue; }
    if (ns === "a") { (a as unknown as Record<string, number>)[key] = v; src(r.dest, r.label); continue; }
    if (ns === "loan") {
      const ak = LOAN_TO_ASSUMPTION[key as keyof Loan];
      if (ak) (a as unknown as Record<string, number>)[ak] = v;
      if (m.loan) (m.loan as unknown as Record<string, number>)[key] = v;
      src(r.dest, r.label); continue;
    }
    if (ns === "line") { lines = lines.map((l) => (l.key === key ? { ...l, underwrite: Math.round(Math.abs(v)) } : l)); src(r.dest, r.label); continue; }
    if (ns === "custom") { m.custom = m.custom!.map((c) => (c.id === key ? { ...c, value: v } : c)); src(r.dest, r.label); continue; }
    if (ns === "opexItem") { m.opex = m.opex!.map((o) => (o.id === key ? { ...o, basis: "fixed", amount: Math.abs(v) } : o)); src(`opex:${key}`, r.label); continue; }
    if (ns === "costItem") { m.closing = m.closing!.map((c) => (c.id === key ? { ...c, basis: "fixed", amount: Math.abs(v) } : c)); src(`cost:${key}`, r.label); continue; }
    if (ns === "opex") {
      const lk = OPEX_TO_LINE[key];
      if (lk) lines = lines.map((l) => (l.key === lk ? { ...l, underwrite: Math.round(Math.abs(v)) } : l));
      if (full) {
        const hit = opexFor(r.dest);
        if (hit) { m.opex = m.opex!.map((o) => (o.id === hit.id ? { ...o, basis: "fixed", amount: Math.abs(v) } : o)); src(`opex:${hit.id}`, r.label); }
        else { const id = crypto.randomUUID(); m.opex!.push({ id, label: f.label, basis: "fixed", amount: Math.abs(v), growth: a.expenseGrowth }); src(`opex:${id}`, r.label); }
      } else src(r.dest, r.label);
      continue;
    }
    if (ns === "cost") {
      const hit = m.closing!.find((c) => normalize(c.label) === normalize(f.label) || matchLabel(c.label, BASE_FIELDS).fieldId === r.dest);
      if (hit) { m.closing = m.closing!.map((c) => (c.id === hit.id ? { ...c, basis: "fixed", amount: Math.abs(v) } : c)); src(`cost:${hit.id}`, r.label); }
      else { const id = crypto.randomUUID(); m.closing!.push({ id, label: f.label, basis: "fixed", amount: Math.abs(v) }); src(`cost:${id}`, r.label); }
    }
  }
  return { patch: { assumptions: a, lines, model: m, targetIrr }, filled };
}
