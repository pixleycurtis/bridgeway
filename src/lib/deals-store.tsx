import type React from "react";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { Adjustment, Assumptions, LineItem } from "./finance";
import type { Model } from "./model/types";
import { useWorkspace } from "./workspace";
import { DEFAULT_STAGES, TERMINAL } from "./firm-settings";

export const STAGES = [...DEFAULT_STAGES, ...TERMINAL];
export type Stage = string;
export interface StageEvent { stage: string; at: string }

export interface Deal {
  id: string;
  firmId: string;
  name: string;
  address: string;
  market: string;
  stage: Stage;
  propertyType: string;
  stageHistory: StageEvent[];
  passReason: string | null;
  askingPrice: number | null;
  finalPrice: number | null;
  createdAt: string;
  assumptions: Assumptions;
  lines: LineItem[];
  adjustments: Adjustment[];
  /** Full underwriting model; empty until the deal is switched onto it. */
  model: Model;
  targetIrr: number;
  updatedAt: string;
  /** firm_members ids assigned to work this deal. */
  team: string[];
  /** true when the deal belongs to the viewer's firm; false for deals shared in (view-only). */
  canEdit: boolean;
}

const lines = (b: number[], t: number[], u: number[]): LineItem[] => {
  const defs: [string, string, "income" | "expense"][] = [
    ["gpr", "Gross potential rent", "income"],
    ["vacancy", "Vacancy & credit loss", "expense"],
    ["other", "Other income", "income"],
    ["taxes", "Real estate taxes", "expense"],
    ["insurance", "Insurance", "expense"],
    ["utilities", "Utilities", "expense"],
    ["repairs", "Repairs & maintenance", "expense"],
    ["mgmt", "Management", "expense"],
    ["payroll", "Payroll", "expense"],
    ["reserves", "Replacement reserves", "expense"],
  ];
  return defs.map(([key, label, kind], i) => ({ key, label, kind, broker: b[i] ?? 0, t12: t[i] ?? 0, underwrite: u[i] ?? 0 }));
};

const baseA = (price: number, units: number): Assumptions => ({
  price, units, closingPct: 0.02, capex: units * 6000, ltv: 0.7, rate: 0.0675, amortYears: 30,
  rentGrowth: 0.03, expenseGrowth: 0.03, exitCap: 0.065, holdYears: 5, sellPct: 0.02,
});

type Seed = Omit<Deal, "id" | "firmId" | "canEdit" | "updatedAt" | "stageHistory" | "passReason" | "askingPrice" | "finalPrice" | "createdAt" | "propertyType" | "model"> & { passReason?: string; finalPrice?: number };
const SEED: Seed[] = [
  {
    name: "Maple Court Apartments", address: "1420 Maple Ave", market: "Columbus, OH", stage: "Underwriting", targetIrr: 0.15,
    assumptions: baseA(4_250_000, 36),
    lines: lines(
      [540000, 16200, 28000, 42000, 18000, 21000, 19000, 21600, 24000, 9000],
      [522000, 36540, 21400, 58300, 26100, 31800, 27400, 24000, 38000, 0],
      [530000, 31800, 24000, 61000, 27000, 30000, 25000, 26000, 36000, 10800],
    ),
    adjustments: [
      { id: "a1", label: "Tax reassessment on sale", type: "annual", amount: 12400 },
      { id: "a2", label: "Roof replacement (bldg B)", type: "onetime", amount: 82000 },
    ],
  },
  {
    name: "Harbor Flats", address: "88 Harbor St", market: "Tampa, FL", stage: "LOI", targetIrr: 0.16,
    assumptions: baseA(6_900_000, 48),
    lines: lines(
      [835000, 25000, 40000, 71000, 38000, 26000, 28000, 33400, 42000, 12000],
      [812000, 48700, 36200, 74800, 61500, 29900, 33100, 32500, 45000, 0],
      [820000, 45000, 38000, 79000, 64000, 30000, 32000, 32800, 45000, 14400],
    ),
    adjustments: [{ id: "b1", label: "Insurance quote above T-12", type: "annual", amount: 9000 }],
  },
  {
    name: "Elm Row Townhomes", address: "210 Elm Row", market: "Indianapolis, IN", stage: "Closed", targetIrr: 0.15, finalPrice: 2_060_000,
    assumptions: baseA(2_150_000, 18),
    lines: lines(
      [276000, 8300, 9000, 24000, 9500, 6000, 11000, 11000, 0, 4500],
      [268000, 16000, 7800, 29800, 11200, 7400, 13600, 10700, 0, 0],
      [270000, 15000, 8500, 31000, 11500, 7000, 12500, 10800, 0, 5400],
    ),
    adjustments: [],
  },
  {
    name: "Cedar Point Commons", address: "5 Cedar Point Rd", market: "Charlotte, NC", stage: "Passed", targetIrr: 0.15, passReason: "Seller wouldn't retrade",
    assumptions: baseA(9_400_000, 64),
    lines: lines(
      [1105000, 33000, 52000, 88000, 44000, 38000, 36000, 44200, 60000, 16000],
      [1052000, 84100, 44300, 112600, 57800, 44100, 47200, 42100, 66000, 0],
      [1060000, 79500, 46000, 116000, 58000, 44000, 45000, 42400, 66000, 19200],
    ),
    adjustments: [],
  },
];

type Row = { team?: string[]; property_type: string; stage_history: Json; pass_reason: string | null; asking_price: number | null; final_price: number | null; created_at: string; id: string; firm_id: string; name: string; address: string; market: string; stage: string; assumptions: Json; lines: Json; adjustments: Json; model?: Json; target_irr: number; updated_at: string };
const fromRow = (r: Row, myFirm: string | undefined): Deal => ({
  id: r.id, firmId: r.firm_id, name: r.name, address: r.address, market: r.market, stage: r.stage as Stage,
  assumptions: r.assumptions as unknown as Assumptions, lines: r.lines as unknown as LineItem[],
  adjustments: r.adjustments as unknown as Adjustment[], model: (r.model as unknown as Model) ?? {}, targetIrr: Number(r.target_irr),
  propertyType: r.property_type, stageHistory: (r.stage_history as unknown as StageEvent[]) ?? [], passReason: r.pass_reason,
  askingPrice: r.asking_price == null ? null : Number(r.asking_price), finalPrice: r.final_price == null ? null : Number(r.final_price), createdAt: r.created_at,
  updatedAt: r.updated_at.slice(0, 10), canEdit: r.firm_id === myFirm, team: r.team ?? [],
});
const toRow = (d: Partial<Deal>) => {
  const o: { [k: string]: unknown } = {};
  if (d.name !== undefined) o["name"] = d.name;
  if (d.address !== undefined) o["address"] = d.address;
  if (d.market !== undefined) o["market"] = d.market;
  if (d.stage !== undefined) o["stage"] = d.stage;
  if (d.assumptions !== undefined) o["assumptions"] = d.assumptions;
  if (d.lines !== undefined) o["lines"] = d.lines;
  if (d.adjustments !== undefined) o["adjustments"] = d.adjustments;
  if (d.model !== undefined) o["model"] = d.model;
  if (d.targetIrr !== undefined) o["target_irr"] = d.targetIrr;
  if (d.propertyType !== undefined) o["property_type"] = d.propertyType;
  if (d.stageHistory !== undefined) o["stage_history"] = d.stageHistory;
  if (d.passReason !== undefined) o["pass_reason"] = d.passReason;
  if (d.askingPrice !== undefined) o["asking_price"] = d.askingPrice;
  if (d.finalPrice !== undefined) o["final_price"] = d.finalPrice;
  if (d.team !== undefined) o["team"] = d.team;
  return o;
};

interface Ctx {
  deals: Deal[];
  loading: boolean;
  update: (id: string, patch: Partial<Deal>) => void;
  create: (name: string, market: string, propertyType?: string, model?: Model, team?: string[]) => Promise<string | null>;
}
const g = globalThis as unknown as { __keystoneDealsCtx2?: React.Context<Ctx | null> };
const DealsCtx = (g.__keystoneDealsCtx2 ??= createContext<Ctx | null>(null));

export function DealsProvider({ children }: { children: ReactNode }) {
  const { firm, user, justCreated, settings } = useWorkspace();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const pending = useRef<Record<string, { patch: Record<string, unknown>; t: ReturnType<typeof setTimeout> }>>({});

  useEffect(() => {
    if (!firm) return;
    (async () => {
      let { data } = await supabase.from("deals").select("*").order("updated_at", { ascending: false });
      const own = (data ?? []).filter((r) => r.firm_id === firm.id);
      if (justCreated && own.length === 0) {
        await supabase.from("deals").insert(SEED.map((s) => ({ ...toRow(s), asking_price: s.assumptions.price, stage_history: [{ stage: s.stage, at: new Date(Date.now() - 20 * 86400000).toISOString() }], firm_id: firm.id, created_by: user.id } as never)));
        ({ data } = await supabase.from("deals").select("*").order("updated_at", { ascending: false }));
      }
      setDeals((data ?? []).map((r) => fromRow(r as Row, firm.id)));
      setLoading(false);
    })();
  }, [firm?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = (id: string, input: Partial<Deal>) => {
    let patch = input;
    const cur = deals.find((d) => d.id === id);
    if (cur && input.stage && input.stage !== cur.stage) {
      patch = { ...input, stageHistory: [...cur.stageHistory, { stage: input.stage, at: new Date().toISOString() }] };
    }
    setDeals((ds) => ds.map((d) => (d.id === id ? { ...d, ...patch, updatedAt: new Date().toISOString().slice(0, 10) } : d)));
    const p = pending.current[id];
    if (p) clearTimeout(p.t);
    const merged = { ...(p?.patch ?? {}), ...toRow(patch), updated_at: new Date().toISOString() };
    pending.current[id] = {
      patch: merged,
      t: setTimeout(async () => {
        delete pending.current[id];
        const { error } = await supabase.from("deals").update(merged as never).eq("id", id);
        if (error) toast.error("Couldn't save: " + error.message);
      }, 600),
    };
  };

  const create = async (name: string, market: string, propertyType?: string, model?: Model, team?: string[]) => {
    if (!firm) return null;
    const first = settings.stages[0] ?? "Screening";
    const d = settings.defaults;
    const type = propertyType || settings.propertyTypes[0] || "Multifamily";
    // Prefill from the assumptions library: exact market+type match, then type-only row.
    const { data: prefRows } = await supabase
      .from("firm_defaults")
      .select("market, defaults")
      .eq("property_type", type)
      .eq("firm_id", firm.id);
    const pref = ((prefRows ?? []) as { market: string; defaults: Partial<Assumptions> }[]).find((r) => r.market === market) ?? ((prefRows ?? []) as { market: string; defaults: Partial<Assumptions> }[]).find((r) => !r.market);
    const row = {
      firm_id: firm.id, created_by: user.id, name, market, stage: first, target_irr: settings.targetIrr,
      property_type: type, asking_price: 3_000_000,
      stage_history: [{ stage: first, at: new Date().toISOString() }],
      assumptions: {
        ...baseA(3_000_000, 24),
        ltv: pref?.defaults?.ltv ?? d.ltv,
        rate: pref?.defaults?.rate ?? d.rate,
        exitCap: pref?.defaults?.exitCap ?? d.exitCap,
        holdYears: pref?.defaults?.holdYears ?? d.holdYears,
      },
      lines: lines(Array(10).fill(0), Array(10).fill(0), Array(10).fill(0)), adjustments: [],
      model: model ?? {}, team: team ?? [],
    };
    const { data, error } = await supabase.from("deals").insert(row as never).select().single();
    if (error || !data) { toast.error(error?.message ?? "Couldn't create deal"); return null; }
    setDeals((ds) => [fromRow(data as Row, firm.id), ...ds]);
    return data.id;
  };

  return <DealsCtx.Provider value={{ deals, loading, update, create }}>{children}</DealsCtx.Provider>;
}

export function useDeals() {
  const c = useContext(DealsCtx);
  if (!c) throw new Error("useDeals outside provider");
  return c;
}
