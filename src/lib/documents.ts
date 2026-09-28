import type { Deal } from "./deals-store";
import { analyze, pct, solvePrice, sumBy, usd } from "./finance";
import type { Firm } from "./workspace";

export type TableKey = "summary" | "income" | "returns" | "cashflow" | "sensitivity" | "debt" | "findings";
export interface Section { id: string; title: string; body: string; table?: TableKey | null }
export type DocKind = "memo" | "loi" | "lender" | "retrade" | "ddlist" | "ic";

export const DOC_KINDS: { kind: DocKind; title: string; audience: string; blurb: string }[] = [
  { kind: "memo", title: "Investment summary", audience: "Partners & investors", blurb: "The deal on a page: thesis, numbers, returns, risks." },
  { kind: "ic", title: "Committee memo", audience: "Investment committee", blurb: "One-page sign-off summary: returns, risks, diligence, and the ask." },
  { kind: "loi", title: "Letter of intent", audience: "Seller", blurb: "Price, deposit, diligence period, and closing terms." },
  { kind: "lender", title: "Lender package", audience: "Lender", blurb: "Loan request, operating history, debt coverage, cash flows." },
  { kind: "ddlist", title: "Due diligence request list", audience: "Seller", blurb: "Everything you need from the seller during diligence." },
  { kind: "retrade", title: "Retrade letter", audience: "Seller", blurb: "Findings from diligence and the price adjustment you're asking for." },
];

const sid = () => Math.random().toString(36).slice(2, 9);
const s = (title: string, body: string, table: TableKey | null = null): Section => ({ id: sid(), title, body, table });

export function dealFacts(d: Deal) {
  const r = analyze(d.lines, d.assumptions, d.adjustments);
  const b = sumBy(d.lines, "broker");
  const t = sumBy(d.lines, "t12");
  const a = d.assumptions;
  return [
    `Property: ${d.name}, ${[d.address, d.market].filter(Boolean).join(", ")}; ${a.units} units`,
    `Purchase price: ${usd(a.price)} (${usd(a.price / (a.units || 1))}/unit)`,
    `Broker pro forma NOI: ${usd(b.noi)}; T-12 NOI: ${usd(t.noi)}; our underwritten NOI (after diligence): ${usd(r.noi)}`,
    `Going-in cap rate: ${pct(r.capRate, 2)}; exit cap ${pct(a.exitCap, 2)}; hold ${a.holdYears} years`,
    `Loan: ${usd(r.loan)} at ${pct(a.rate, 2)}, ${a.amortYears}-yr amortization, ${pct(a.ltv, 0)} LTV; annual debt service ${usd(r.debtService)}; DSCR ${r.dscr.toFixed(2)}x`,
    `Equity required: ${usd(r.equity)}; capex budget ${usd(a.capex)}; Y1 cash-on-cash ${pct(r.cashOnCash)}; levered IRR ${pct(r.irr)}; equity multiple ${r.equityMultiple.toFixed(2)}x; target IRR ${pct(d.targetIrr)}`,
    `Diligence findings: ${d.adjustments.length ? d.adjustments.map((x) => `${x.label} ${usd(x.amount)}${x.type === "annual" ? "/yr" : " one-time"}`).join("; ") : "none logged"}`,
  ].join("\n");
}

export function defaultSections(kind: DocKind, d: Deal, firm: Firm | null): Section[] {
  const r = analyze(d.lines, d.assumptions, d.adjustments);
  const a = d.assumptions;
  const t = sumBy(d.lines, "t12");
  const b = sumBy(d.lines, "broker");
  const buyer = firm?.name ?? "Buyer";
  const where = [d.address, d.market].filter(Boolean).join(", ");
  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const oneTime = d.adjustments.filter((x) => x.type === "onetime").reduce((s2, x) => s2 + x.amount, 0);
  const annual = d.adjustments.filter((x) => x.type === "annual").reduce((s2, x) => s2 + x.amount, 0);
  const hold = solvePrice(d.lines, a, d.adjustments, d.targetIrr);
  const cut = Math.max(0, a.price - hold);
  const k = (n: number) => usd(Math.round(n / 1000) * 1000);

  switch (kind) {
    case "memo":
      return [
        s("Overview", `${buyer} proposes to acquire ${d.name}, a ${a.units}-unit multifamily property at ${where}, for ${usd(a.price)} (${usd(a.price / (a.units || 1))} per unit). The price represents a ${pct(r.capRate, 2)} going-in cap rate on our underwritten NOI of ${usd(r.noi)}.`, "summary"),
        s("Investment thesis", `• Basis: acquiring below replacement cost at ${usd(a.price / (a.units || 1))} per unit.\n• Operations: the trailing-12 shows ${usd(t.noi)} of NOI; our plan targets expense discipline and a ${usd(a.capex)} capital program.\n• Market: ${d.market || "the submarket"} fundamentals support ${pct(a.rentGrowth, 1)} annual rent growth.`),
        s("Operating statement", `The broker's pro forma projects ${usd(b.noi)} of NOI. The trailing-12 actuals show ${usd(t.noi)}. Our underwrite uses ${usd(r.noi)}, after reflecting diligence findings.`, "income"),
        s("Financing & returns", `We assume a ${pct(a.ltv, 0)} LTV loan of ${usd(r.loan)} at ${pct(a.rate, 2)}. Over a ${a.holdYears}-year hold with a ${pct(a.exitCap, 2)} exit cap, the deal produces a ${pct(r.irr)} levered IRR and ${r.equityMultiple.toFixed(2)}x equity multiple on ${usd(r.equity)} of equity.`, "returns"),
        s("Sensitivity", `Levered IRR across purchase price and exit cap rate.`, "sensitivity"),
        s("Key risks", `• Expense growth above plan, particularly taxes and insurance.\n• Exit cap expansion beyond ${pct(a.exitCap, 2)}.\n• Capital program timing and cost overruns.`),
      ];
    case "loi":
      return [
        s("Letter", `${today}\n\nRe: Letter of Intent — ${d.name}${where ? `, ${where}` : ""}\n\n${buyer} ("Buyer") is pleased to submit this non-binding letter of intent to acquire the above property on the following terms.`),
        s("Terms", `• Purchase price: ${usd(a.price)}\n• Earnest money: ${k(a.price * 0.01)} deposited within three business days of a signed purchase agreement, becoming non-refundable at the end of the due diligence period\n• Due diligence period: 30 days from receipt of all seller deliverables\n• Financing: ${usd(r.loan)} new first mortgage; 45-day financing contingency\n• Closing: 30 days after the end of due diligence\n• Closing costs: split per local custom`),
        s("Closing", `This letter is non-binding except for confidentiality and exclusivity provisions, and is subject to a mutually acceptable purchase and sale agreement. We look forward to working with you.\n\nSincerely,\n${firm?.contact_name ?? ""}\n${buyer}`),
      ];
    case "lender":
      return [
        s("Loan request", `${buyer} requests a first mortgage loan of ${usd(r.loan)} (${pct(a.ltv, 0)} LTV) to finance the acquisition of ${d.name}, a ${a.units}-unit property at ${where}, for ${usd(a.price)}. We are seeking a ${a.amortYears}-year amortization at approximately ${pct(a.rate, 2)}.`, "debt"),
        s("Property & sponsor", `${d.name} comprises ${a.units} units. ${buyer} will contribute ${usd(r.equity)} of equity, including a ${usd(a.capex)} capital improvement budget.`),
        s("Operating history & underwriting", `The trailing-12 operating statement shows ${usd(t.noi)} of NOI. Our underwritten Year-1 NOI is ${usd(r.noi)}, producing a ${r.dscr.toFixed(2)}x debt service coverage ratio on ${usd(r.debtService)} of annual debt service.`, "income"),
        s("Projected cash flow", `Annual levered cash flow over the ${a.holdYears}-year business plan.`, "cashflow"),
      ];
    case "ddlist":
      return [
        s("Request", `${today}\n\nRe: ${d.name} — Due diligence requests\n\nPlease provide the following items at your earliest convenience so we can complete our review within the diligence period.`),
        s("Financial", `• Trailing-12 and trailing-3 operating statements, month by month\n• Current certified rent roll with lease start/end dates and deposits\n• Two prior years of annual operating statements\n• General ledger for the trailing 12 months\n• Utility bills for the trailing 12 months\n• Real estate tax bills and any pending appeals`),
        s("Physical", `• Capital expenditure history for the past three years\n• Any property condition, environmental, or engineering reports\n• Roof, HVAC, and major system warranties\n• Open work orders and unit turn schedule`),
        s("Legal & other", `• Service, vendor, and management contracts\n• Insurance loss runs for the past five years\n• Certificate of occupancy and any open code violations\n• Pending or threatened litigation\n• Title policy and survey`),
      ];
    case "ic":
      return [
        s("Recommendation", `${buyer} seeks investment committee approval to acquire ${d.name}, a ${a.units}-unit property at ${where}, for ${usd(a.price)} at a ${pct(r.capRate, 2)} going-in cap rate. Our underwritten Year-1 NOI is ${usd(r.noi)}.`, "summary"),
        s("Returns", `Assuming ${pct(a.ltv, 0)} LTV financing at ${pct(a.rate, 2)} over ${a.amortYears} years, the deal produces ${pct(r.cashOnCash)} Year-1 cash-on-cash, a ${r.dscr.toFixed(2)}x DSCR and a ${pct(r.irr)} levered IRR (${r.equityMultiple.toFixed(2)}x equity multiple) against our ${pct(d.targetIrr)} target over a ${a.holdYears}-year hold.`, "returns"),
        s("Diligence & risk", `${d.adjustments.length ? `${d.adjustments.length} diligence finding${d.adjustments.length > 1 ? "s" : ""} valued at ${usd(oneTime + Math.round(annual / (r.capRate || 1)))} in total` : "No diligence findings to date"}. Key risks: expense growth above plan, exit cap expansion beyond ${pct(a.exitCap, 2)}, and capital program overruns on the ${usd(a.capex)} budget.`),
        s("Financing status", `Loan request sized at ${usd(r.loan)} (${pct(a.ltv, 0)} LTV); term sheets are being compared against our underwrite before we go hard.`),
      ];
    case "retrade":
      return [
        s("Letter", `${today}\n\nRe: ${d.name}${where ? `, ${where}` : ""}\n\nThank you for your cooperation through the due diligence period. Our review has identified the following items that were not reflected in the offering materials.`, "findings"),
        s("Impact", `The recurring items reduce NOI by ${usd(annual)} annually, which at a ${pct(r.capRate, 2)} cap rate represents ${usd(annual / (r.capRate || 1))} of value. Combined with ${usd(oneTime)} of immediate capital needs, we are requesting a purchase price adjustment of ${k(cut)}, to a revised price of ${k(hold)}.`),
        s("Alternative", `Alternatively, we would accept a closing credit of ${usd(oneTime)} for the capital items together with a price adjustment of ${k(Math.max(0, cut - oneTime))}.\n\nWe remain committed to closing on the current timeline and look forward to your response.\n\nSincerely,\n${firm?.contact_name ?? ""}\n${buyer}`),
      ];
  }
}

export function buildTable(key: TableKey, d: Deal): { head: string[]; rows: string[][] } {
  const a = d.assumptions;
  const r = analyze(d.lines, a, d.adjustments);
  switch (key) {
    case "summary":
      return { head: ["", ""], rows: [["Purchase price", usd(a.price)], ["Units", String(a.units)], ["Price / unit", usd(a.price / (a.units || 1))], ["Underwritten NOI", usd(r.noi)], ["Going-in cap rate", pct(r.capRate, 2)], ["Levered IRR", pct(r.irr)]] };
    case "income": {
      const rows = d.lines.map((l) => [l.label, usd(l.broker), usd(l.t12), usd(l.underwrite)]);
      const tb = sumBy(d.lines, "broker"), tt = sumBy(d.lines, "t12"), tu = sumBy(d.lines, "underwrite");
      rows.push(["Net operating income", usd(tb.noi), usd(tt.noi), usd(tu.noi)]);
      return { head: ["", "Broker pro forma", "T-12", "Underwrite"], rows };
    }
    case "returns":
      return { head: ["", ""], rows: [["Equity required", usd(r.equity)], ["Loan", usd(r.loan)], ["Y1 cash-on-cash", pct(r.cashOnCash)], ["DSCR", r.dscr.toFixed(2) + "x"], ["Levered IRR", pct(r.irr)], ["Equity multiple", r.equityMultiple.toFixed(2) + "x"]] };
    case "debt":
      return { head: ["", ""], rows: [["Loan amount", usd(r.loan)], ["Loan-to-value", pct(a.ltv, 0)], ["Rate", pct(a.rate, 2)], ["Amortization", `${a.amortYears} years`], ["Annual debt service", usd(r.debtService)], ["DSCR (Year 1)", r.dscr.toFixed(2) + "x"], ["Debt yield", pct(r.noi / (r.loan || 1), 1)]] };
    case "cashflow":
      return { head: r.flows.map((_, i) => (i === 0 ? "Close" : `Year ${i}`)), rows: [r.flows.map((f) => usd(f, true))] };
    case "sensitivity": {
      const caps = [-0.005, 0, 0.005];
      return {
        head: ["Price \\ Exit cap", ...caps.map((c) => pct(a.exitCap + c, 2))],
        rows: [0.95, 1, 1.05].map((p) => [usd(a.price * p, true), ...caps.map((c) => pct(analyze(d.lines, { ...a, exitCap: a.exitCap + c }, d.adjustments, a.price * p).irr))]),
      };
    }
    case "findings":
      return { head: ["Finding", "Type", "Amount"], rows: d.adjustments.length ? d.adjustments.map((x) => [x.label, x.type === "annual" ? "Per year" : "One-time", usd(x.amount)]) : [["No findings logged", "", ""]] };
  }
}

export const DOC_FONTS: Record<string, { label: string; css: string }> = {
  serif: { label: "Editorial serif", css: '"Newsreader", Georgia, serif' },
  sans: { label: "Modern sans", css: '"IBM Plex Sans", system-ui, sans-serif' },
  classic: { label: "Classic (Georgia)", css: 'Georgia, "Times New Roman", serif' },
};
