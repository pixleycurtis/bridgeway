import type { Adjustment, Assumptions } from "./finance";

/** Result of reading an underwriting CSV: only the fields that were found. */
export interface UnderwriteImport {
  assumptions: Partial<Assumptions>;
  targetIrr: number | null;
  lines: Record<string, number>;
  findings: Adjustment[];
  skipped: string[];
}

const PCT_FIELDS = new Set<keyof Assumptions>(["closingPct", "ltv", "rate", "rentGrowth", "expenseGrowth", "exitCap", "sellPct"]);

const ASSUMPTION_RULES: [RegExp, keyof Assumptions | "targetIrr"][] = [
  [/target\s*irr/, "targetIrr"],
  [/exit\s*cap/, "exitCap"],
  [/rent\s*growth/, "rentGrowth"],
  [/expense\s*growth/, "expenseGrowth"],
  [/sell|sale|disposition/, "sellPct"],
  [/closing/, "closingPct"],
  [/ltv|loan[\s-]*to[\s-]*value/, "ltv"],
  [/interest|^rate/, "rate"],
  [/amort/, "amortYears"],
  [/capex|capital/, "capex"],
  [/hold/, "holdYears"],
  [/purchase\s*price|^price|asking/, "price"],
  [/^units|unit count/, "units"],
];

const LINE_RULES: [RegExp, string][] = [
  [/gross\s*potential|^gpr|^rent/, "gpr"],
  [/vacancy|credit\s*loss/, "vacancy"],
  [/other\s*income/, "other"],
  [/tax/, "taxes"],
  [/insurance/, "insurance"],
  [/utilit/, "utilities"],
  [/repair|maintenance/, "repairs"],
  [/management|mgmt/, "mgmt"],
  [/payroll/, "payroll"],
  [/reserve/, "reserves"],
];

/** Split one CSV line, honouring quoted cells. */
function cells(line: string): string[] {
  const out: string[] = [];
  let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true;
    else if (c === ",") { out.push(cur.trim()); cur = ""; }
    else cur += c;
  }
  out.push(cur.trim());
  return out;
}

/** Parse "$1,200", "15%", "(500)" into a number; percent strings become fractions. */
function num(raw: string): { value: number; isPct: boolean } | null {
  const s = raw.replace(/[$,\s]/g, "");
  if (!s) return null;
  const neg = /^\(.*\)$/.test(s);
  const isPct = s.endsWith("%");
  const n = Number(s.replace(/[()%]/g, ""));
  if (!isFinite(n)) return null;
  const v = neg ? -n : n;
  return { value: isPct ? v / 100 : v, isPct };
}

const asPct = (v: { value: number; isPct: boolean }) => (v.isPct || v.value <= 1 ? v.value : v.value / 100);

/** Read an underwriting CSV: assumption rows, underwritten line rows, and an optional findings section. */
export function parseUnderwriteCsv(text: string): UnderwriteImport {
  const out: UnderwriteImport = { assumptions: {}, targetIrr: null, lines: {}, findings: [], skipped: [] };
  let inFindings = false;
  for (const rawLine of text.split(/\r?\n/)) {
    const row = cells(rawLine);
    const label = row[0] ?? "";
    const key = label.toLowerCase();
    if (!label) continue;
    if (/finding/.test(key) && row.slice(1).some((c) => /type|amount/i.test(c))) { inFindings = true; continue; }
    if (/^(assumption|underwritten line|line item)/.test(key)) continue;
    if (inFindings) {
      const type = (row[1] ?? "").toLowerCase();
      const amt = num(row[2] ?? "");
      if (!amt) { out.skipped.push(label); continue; }
      out.findings.push({ id: crypto.randomUUID(), label, type: /annual|year/.test(type) ? "annual" : "onetime", amount: Math.round(Math.abs(amt.value)) });
      continue;
    }
    if (/noi|net operating/.test(key)) continue;
    const v = num(row[1] ?? "");
    if (!v) { out.skipped.push(label); continue; }
    const a = ASSUMPTION_RULES.find(([re]) => re.test(key));
    if (a) {
      const k = a[1];
      if (k === "targetIrr") out.targetIrr = asPct(v);
      else out.assumptions[k] = PCT_FIELDS.has(k) ? asPct(v) : v.value;
      continue;
    }
    const l = LINE_RULES.find(([re]) => re.test(key));
    if (l) { out.lines[l[1]] = Math.round(Math.abs(v.value)); continue; }
    out.skipped.push(label);
  }
  return out;
}

/** Every labelled value in a CSV (first non-empty cell after the label), plus an optional findings section. */
export function extractRows(text: string): { rows: { label: string; raw: string }[]; findings: Adjustment[] } {
  const rows: { label: string; raw: string }[] = [];
  const findings: Adjustment[] = [];
  let inFindings = false;
  for (const rawLine of text.split(/\r?\n/)) {
    const row = cells(rawLine);
    const label = (row[0] ?? "").trim();
    if (!label) continue;
    const key = label.toLowerCase();
    if (/finding/.test(key) && row.slice(1).some((c) => /type|amount/i.test(c))) { inFindings = true; continue; }
    if (inFindings) {
      const amt = num(row[2] ?? "");
      if (amt) findings.push({ id: crypto.randomUUID(), label, type: /annual|year/i.test(row[1] ?? "") ? "annual" : "onetime", amount: Math.round(Math.abs(amt.value)) });
      continue;
    }
    const raw = row.slice(1).find((c) => c.trim() !== "") ?? "";
    if (!raw || /^(value|amount|annual|notes?|\$|\(\$\)|annual \(\$\))$/i.test(raw)) continue;
    rows.push({ label, raw });
  }
  return { rows, findings };
}
