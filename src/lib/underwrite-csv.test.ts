import { describe, expect, it } from "vitest";
import { parseUnderwriteCsv } from "./underwrite-csv";

const csv = `Assumption,Value
Purchase Price,6000000
Target IRR,15.0%
LTV,70%
Interest Rate,6.75%
Amortization (years),30
Closing Costs,2.0%
Exit Cap Rate,6.25%
Underwritten Line,Annual ($)
Real Estate Taxes (reassessed),58500
Underwritten NOI,304260
DD Finding,Type,Amount ($)
Roof replacement,One-time,74000
Insurance & tax escalation,Annual,14500`;

describe("parseUnderwriteCsv", () => {
  const r = parseUnderwriteCsv(csv);
  it("reads price and percentages as fractions", () => {
    expect(r.assumptions.price).toBe(6000000);
    expect(r.assumptions.ltv).toBeCloseTo(0.7);
    expect(r.assumptions.rate).toBeCloseTo(0.0675);
    expect(r.assumptions.exitCap).toBeCloseTo(0.0625);
    expect(r.targetIrr).toBeCloseTo(0.15);
  });
  it("maps underwritten lines and ignores NOI", () => {
    expect(r.lines["taxes"]).toBe(58500);
    expect(r.skipped).not.toContain("Underwritten NOI");
  });
  it("findings section does not overwrite lines", () => {
    expect(r.findings).toHaveLength(2);
    expect(r.findings[1]).toMatchObject({ type: "annual", amount: 14500 });
    expect(r.lines["taxes"]).toBe(58500);
  });
});
