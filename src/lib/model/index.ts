import { analyze, type Adjustment, type Assumptions, type LineItem } from "../finance";
import { runModel, solveModelPrice } from "./engine";
import { defaultClosing, seedModel } from "./model-types";
import { solvePrice } from "../finance";
import type { Model, ModelTypeId, OpexItem } from "./types";

export * from "./types";
export * from "./engine";
export * from "./model-types";
export * from "./analytics";
export * from "./fields";
export * from "./match";
export * from "./import";

type DealLike = { lines: LineItem[]; assumptions: Assumptions; adjustments: Adjustment[]; model?: Model };

/** True once the deal has been switched onto the full model. */
export const hasModel = (d: DealLike) => !!d.model?.type;

/** Headline numbers for any deal: full model when set up, the simple engine otherwise. */
export function analyzeDeal(d: DealLike, adj: Adjustment[] = d.adjustments, price?: number) {
  return hasModel(d) ? runModel(d.lines, d.assumptions, d.model!, adj, price) : analyze(d.lines, d.assumptions, adj, price);
}
export function solveDealPrice(d: DealLike, target: number) {
  return hasModel(d) ? solveModelPrice(d.lines, d.assumptions, d.model!, d.adjustments, target) : solvePrice(d.lines, d.assumptions, d.adjustments, target);
}

/** Start an existing deal on the full model, carrying its underwritten expense lines across so NOI is unchanged. */
export function initModel(d: DealLike, type: ModelTypeId = "stabilized"): Model {
  const a = d.assumptions;
  const seed = seedModel(type, a.units, a);
  const opex: OpexItem[] = d.lines.filter((l) => l.kind === "expense" && l.key !== "vacancy")
    .map((l) => ({ id: crypto.randomUUID(), label: l.label, basis: "fixed", amount: l.underwrite, growth: a.expenseGrowth }));
  const closing = defaultClosing().map((c) => ({ ...c, amount: 0 }));
  closing[0] = { ...closing[0]!, label: "Closing costs (from assumption)", basis: "pctPrice", amount: a.closingPct };
  return { ...seed, opex, closing, vacancyPct: 0, turnover: { ...seed.turnover!, rate: 0 }, workingCapital: { start: 0, minBalance: 0, draws: [] },
    loan: { ...seed.loan!, points: 0, ...(type === "stabilized" ? { ioMonths: 0 } : {}) } };
}
