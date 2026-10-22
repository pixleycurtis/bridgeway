import { BASE_FIELDS, COMPUTED_TERMS, type FieldDef } from "./fields";
import type { Model } from "./types";

export type Confidence = "learned" | "exact" | "synonym" | "close" | "computed" | "none";
export interface Match { fieldId: string | null; confidence: Confidence; score: number }

const ABBR: Record<string, string> = {
  re: "real estate", mgmt: "management", mgt: "management", pm: "property management", sqft: "square feet", sf: "square feet", ft: "feet",
  yoc: "year of construction", ins: "insurance", util: "utilities", utils: "utilities", amort: "amortization", int: "interest", bldg: "building",
  bldgs: "buildings", apt: "apartment", apts: "apartments", maint: "maintenance", admin: "administrative", yr: "year", yrs: "years",
  mo: "months", mos: "months", no: "number", num: "number", qty: "number", pct: "percent", exp: "expense", exps: "expenses", inc: "income",
  misc: "miscellaneous", r: "r", fl: "floor", flrs: "floors", tx: "tax", prop: "property", acq: "acquisition", dev: "development",
};
const STOP = new Set(["the", "of", "a", "an", "total", "annual", "annually", "underwritten", "est", "estimated", "projected", "proforma", "pro", "forma", "per", "year1", "y1", "usd", "amount", "current", "in", "place", "inplace", "for", "to", "on"]);

function stem(w: string) {
  if (w.length <= 3) return w;
  if (w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (/(x|ss|ch|sh)es$/.test(w)) return w.slice(0, -2);
  if (w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

/** Lowercase, expand abbreviations, drop filler words and plurals: "RE Taxes ($/yr)" → "real estate tax". */
export function normalize(s: string): string {
  const words = s.toLowerCase().replace(/&/g, " and ").replace(/#/g, " number ").replace(/\([^)]*\)/g, (m) => (/[a-z]{3,}/.test(m) ? m : " "))
    .replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(Boolean)
    .flatMap((w) => (ABBR[w] ?? w).split(" ")).filter((w) => !STOP.has(w)).map(stem);
  return words.join(" ").replace(/\br and m\b/, "repair and maintenance").replace(/\bg and a\b/, "general administrative");
}

function lev(a: string, b: string) {
  const d = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0]!; d[0] = i;
    for (let j = 1; j <= b.length; j++) { const t = d[j]!; d[j] = Math.min(d[j]! + 1, d[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = t; }
  }
  return d[b.length]!;
}

/** Fields an upload can fill for this deal: the base catalog plus renamed labels and the deal's own rows. */
export function catalogFor(model: Model | undefined, full: boolean): FieldDef[] {
  const layout = model?.layout ?? {};
  const base = BASE_FIELDS.filter((x) => full || !(x.id.startsWith("cost.") || x.id.startsWith("b."))).map((x) => {
    const lbl = layout[x.id]?.label;
    return lbl ? { ...x, label: lbl, syn: [...x.syn, x.label] } : x;
  });
  if (!full) return base;
  const extra: FieldDef[] = [
    ...(model?.customRows?.building ?? []).map((r) => ({ id: `b.${r.id}`, label: r.label, section: "Building" as const, kind: "text" as const, syn: [] })),
    ...(model?.custom ?? []).map((c) => ({ id: `custom.${c.id}`, label: c.label, section: "Custom" as const, kind: c.kind, syn: [] })),
  ];
  const known = new Set(base.flatMap((x) => [x.label, ...x.syn].map(normalize)));
  for (const o of model?.opex ?? []) if (!known.has(normalize(o.label))) extra.push({ id: `opexItem.${o.id}`, label: o.label, section: "Operating expenses", kind: "usd", syn: [] });
  for (const c of model?.closing ?? []) if (!known.has(normalize(c.label))) extra.push({ id: `costItem.${c.id}`, label: c.label, section: "Closing costs", kind: "usd", syn: [] });
  return [...base, ...extra];
}

/** Best field for one file label. `learned` maps normalized labels the firm has confirmed before. */
export function matchLabel(label: string, fields: FieldDef[], learned: Record<string, string> = {}): Match {
  const n = normalize(label);
  if (!n) return { fieldId: null, confidence: "none", score: 0 };
  const l = learned[n];
  if (l && fields.some((x) => x.id === l)) return { fieldId: l, confidence: "learned", score: 1 };
  if (l === "skip") return { fieldId: null, confidence: "learned", score: 1 };
  for (const x of fields) if (normalize(x.label) === n) return { fieldId: x.id, confidence: "exact", score: 1 };
  for (const x of fields) if (x.syn.some((s) => normalize(s) === n)) return { fieldId: x.id, confidence: "synonym", score: 0.95 };
  if (COMPUTED_TERMS.some((t) => normalize(t) === n)) return { fieldId: null, confidence: "computed", score: 1 };
  const words = n.split(" ");
  let best: Match = { fieldId: null, confidence: "none", score: 0 };
  for (const x of fields) {
    for (const term of [x.label, ...x.syn]) {
      const t = normalize(term);
      if (!t) continue;
      const tw = t.split(" ");
      let score = 0;
      if (tw.every((w) => words.includes(w))) score = 0.6 + 0.3 * (tw.length / words.length);
      else {
        const dist = lev(n, t);
        const ratio = 1 - dist / Math.max(n.length, t.length);
        if (ratio >= 0.8) score = ratio * 0.85;
      }
      if (score > best.score) best = { fieldId: x.id, confidence: score >= 0.8 ? "synonym" : "close", score };
    }
  }
  if (best.score < 0.6) {
    if (COMPUTED_TERMS.some((t) => { const tw = normalize(t).split(" "); return tw.every((w) => words.includes(w)); })) return { fieldId: null, confidence: "computed", score: 0.8 };
    return { fieldId: null, confidence: "none", score: best.score };
  }
  return best;
}
