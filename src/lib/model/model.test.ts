import { describe, expect, it } from "vitest";
import { analyze, type Assumptions, type LineItem } from "../finance";
import { amortPayment, schedule, lenderFees, maxLoanByDscr } from "./debt";
import { runModel, closingTotal } from "./engine";
import { distribute, accountingCheck, applyTemplate, templateConfig } from "./analytics";
import { initModel, DEFAULT_LOAN, recommendType } from "./index";

const a: Assumptions = { price: 1_000_000, units: 10, closingPct: 0.02, capex: 0, ltv: 0.7, rate: 0.06, amortYears: 30, rentGrowth: 0, expenseGrowth: 0, exitCap: 0.06, holdYears: 5, sellPct: 0.02 };
const L = (key: string, kind: "income" | "expense", u: number): LineItem => ({ key, label: key, kind, broker: 0, t12: 0, underwrite: u });
const lines = [L("gpr", "income", 120_000), L("vacancy", "expense", 6_000), L("other", "income", 0), L("taxes", "expense", 24_000)];

describe("debt", () => {
  it("interest-only months pay interest only, then amortize", () => {
    const s = schedule(700_000, 0.06, 30, 12, 13);
    expect(s[0]!.payment).toBeCloseTo(3500, 2);
    expect(s[0]!.balance).toBe(700_000);
    expect(s[12]!.payment).toBeCloseTo(amortPayment(700_000, 0.06, 30), 2);
  });
  it("lender fees = (points + extension) × commitment", () => {
    expect(lenderFees({ ...DEFAULT_LOAN, points: 0.02, extensionFee: 0.005, futureFunding: 100_000 }, 700_000)).toBeCloseTo(20_000);
  });
  it("max loan by DSCR on an IO loan = NOI / DSCR / rate", () => {
    expect(maxLoanByDscr(90_000, 0.06, 30, 1.25, true)).toBeCloseTo(1_200_000);
  });
});

describe("engine", () => {
  it("matches the simple engine NOI when started from an existing deal", () => {
    const m = initModel({ lines, assumptions: a, adjustments: [] });
    expect(runModel(lines, a, m).noi).toBeCloseTo(analyze(lines, a).noi, 0);
  });
  it("annual figures are the sum of the months", () => {
    const r = runModel(lines, a, initModel({ lines, assumptions: a, adjustments: [] }));
    expect(r.annual[0]!.noi).toBeCloseTo(r.monthly.slice(0, 12).reduce((s, x) => s + x.noi, 0));
  });
  it("itemized closing costs feed equity", () => {
    const m = { ...initModel({ lines, assumptions: a, adjustments: [] }), closing: [{ id: "1", label: "Legal", basis: "fixed" as const, amount: 15_000 }, { id: "2", label: "Title", basis: "pctPrice" as const, amount: 0.005 }] };
    expect(closingTotal(m, 1_000_000, 700_000, 0.02)).toBe(20_000);
    expect(runModel(lines, a, m).equity).toBeCloseTo(300_000 + 20_000);
  });
  it("full interest-only loan gives year-1 debt service = loan × rate", () => {
    const m = { ...initModel({ lines, assumptions: a, adjustments: [] }), loan: { ...DEFAULT_LOAN, kind: "io" as const, points: 0 } };
    expect(runModel(lines, a, m).debtService).toBeCloseTo(700_000 * 0.06, 0);
  });
  it("turnover costs lost rent: 50% turnover, 1 month down = ~4.2% of gross", () => {
    const units = Array.from({ length: 10 }, (_, i) => ({ id: String(i), label: String(i), type: "1BR", sf: 700, rent: 1000, market: 1000, leaseEnd: "", status: "occupied" as const }));
    const m = { ...initModel({ lines, assumptions: a, adjustments: [] }), units, turnover: { rate: 0.5, downMonths: 1, makeReady: 0, premium: 0 } };
    const y = runModel(lines, a, m).annual[0]!;
    expect(y.vacancy / y.gross).toBeCloseTo(0.5 / 12, 4);
  });
});

describe("waterfall", () => {
  it("returns capital + 8% pref pro-rata before the 30% promote", () => {
    const w = distribute(100, [0, 200], { lpShare: 0.9, pref: 0.08, promote: 0.3 });
    const owed = 100 * 1.08 * 1.08;
    const extra = 200 - owed;
    expect(w.lpTotal).toBeCloseTo(owed * 0.9 + extra * 0.7 * 0.9);
    expect(w.lpTotal + w.gpTotal).toBeCloseTo(200);
  });
});

describe("templates & accounting", () => {
  it("applying a template keeps the property's own units and fixed expense amounts", () => {
    const base = initModel({ lines, assumptions: a, adjustments: [] });
    const cfg = templateConfig({ ...base, vacancyPct: 0.07 });
    const deal = { ...base, units: [{ id: "u", label: "1", type: "1BR", sf: 1, rent: 1, market: 1, leaseEnd: "", status: "occupied" as const }] };
    const out = applyTemplate(deal, cfg, "valueadd");
    expect(out.units).toHaveLength(1);
    expect(out.vacancyPct).toBe(0.07);
    expect(out.opex!.find((o) => o.label === "taxes")!.amount).toBe(24_000);
  });
  it("flags actuals 10%+ off the underwrite", () => {
    const r = accountingCheck([{ id: "1", category: "Property tax", actual: 27_000, mapsTo: "taxes" }], lines);
    expect(r.find((x) => x.key === "taxes")!.flag).toBe(true);
  });
  it("recommends bridge when occupancy is under 85%", () => {
    expect(recommendType({ propertyType: "Multifamily", units: 20, occupancy: 0.7, rentGap: 0, renoBudget: 0, holdYears: 5 }).id).toBe("bridge");
  });
});
