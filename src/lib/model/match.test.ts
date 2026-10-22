import { describe, expect, it } from "vitest";
import { catalogFor, matchLabel } from "./match";
import { applyMapped } from "./import";
import { runModel } from "./engine";
import { seedModel } from "./model-types";
import type { Assumptions, LineItem } from "../finance";

const fields = catalogFor({ type: "stabilized" }, true);
const to = (label: string) => matchLabel(label, fields).fieldId;

describe("terminology matching", () => {
  it("year built / date built", () => { expect(to("Year Built")).toBe("b.yearBuilt"); expect(to("Date Built")).toBe("b.yearBuilt"); });
  it("stories / floors", () => { expect(to("Stories")).toBe("b.stories"); expect(to("# of Floors")).toBe("b.stories"); });
  it("real estate taxes / property taxes", () => {
    for (const l of ["Real Estate Taxes", "Property Taxes", "RE Taxes", "Ad Valorem Tax", "Real Estate Taxes (reassessed)"]) expect(to(l)).toBe("opex.taxes");
  });
  it("R&M and management abbreviations", () => { expect(to("R&M")).toBe("opex.repairs"); expect(to("Mgmt Fee")).toBe("opex.mgmt"); });
  it("exit cap synonyms", () => { expect(to("Terminal Cap Rate")).toBe("a.exitCap"); expect(to("Reversion Cap")).toBe("a.exitCap"); });
  it("close spelling still matches", () => { const m = matchLabel("Insurence", fields); expect(m.fieldId).toBe("opex.insurance"); });
  it("computed totals are never filled", () => { expect(matchLabel("Underwritten NOI", fields).confidence).toBe("computed"); expect(to("Net Operating Income")).toBeNull(); });
  it("unknown stays unmatched", () => { expect(matchLabel("Quantum widget", fields).confidence).toBe("none"); });
  it("firm-learned mapping wins", () => { expect(matchLabel("Ad Val", fields, { "ad val": "opex.insurance" }).fieldId).toBe("opex.insurance"); });
  it("renamed row label matches uploads", () => {
    const f = catalogFor({ type: "stabilized", layout: { "b.parcel": { label: "Folio #" } } }, true);
    expect(matchLabel("Folio #", f).fieldId).toBe("b.parcel");
  });
});

const a: Assumptions = { price: 6e6, units: 32, closingPct: 0.02, capex: 0, ltv: 0.7, rate: 0.0675, amortYears: 30, rentGrowth: 0.03, expenseGrowth: 0.03, exitCap: 0.065, holdYears: 5, sellPct: 0.02 };
const lines: LineItem[] = [{ key: "gpr", label: "Gross potential rent", kind: "income", broker: 0, t12: 0, underwrite: 600000 }];

describe("applying mappings", () => {
  it("writes each value to the confirmed field", () => {
    const model = seedModel("stabilized", 32, a);
    const f = catalogFor(model, true);
    const { patch } = applyMapped({ lines, assumptions: a, model, targetIrr: 0.15, adjustments: [] }, [
      { label: "Date Built", raw: "1987", dest: "b.yearBuilt" },
      { label: "Ad Valorem", raw: "$48,200", dest: "opex.taxes" },
      { label: "Exit cap", raw: "6.25%", dest: "a.exitCap" },
      { label: "Pest", raw: "2400", dest: "new.opex" },
      { label: "Junk", raw: "9", dest: "skip" },
    ], f, "uw.csv");
    expect(patch.model.building?.["yearBuilt"]).toBe("1987");
    expect(patch.assumptions.exitCap).toBeCloseTo(0.0625);
    expect(patch.model.opex?.filter((o) => /tax/i.test(o.label)).map((o) => o.amount)).toContain(48200);
    expect(patch.model.opex?.some((o) => o.label === "Pest" && o.amount === 2400)).toBe(true);
  });
  it("renaming a row does not change the math", () => {
    const model = seedModel("stabilized", 32, a);
    const before = runModel(lines, a, model).irr;
    const after = runModel(lines, a, { ...model, layout: { "a.price": { label: "Contract price" }, "b.yearBuilt": { hidden: true } } }).irr;
    expect(after).toBe(before);
  });
});
