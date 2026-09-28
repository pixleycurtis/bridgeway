import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Adjustment, Assumptions, LineItem } from "./finance";

export const STAGES = ["Screening", "Underwriting", "LOI", "Under contract", "Closed", "Passed"] as const;
export type Stage = (typeof STAGES)[number];

export interface Deal {
  id: string;
  name: string;
  address: string;
  market: string;
  stage: Stage;
  assumptions: Assumptions;
  lines: LineItem[];
  adjustments: Adjustment[];
  targetIrr: number;
  updatedAt: string;
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
  return defs.map(([key, label, kind], i) => ({ key, label, kind, broker: b[i], t12: t[i], underwrite: u[i] }));
};

const baseA = (price: number, units: number): Assumptions => ({
  price, units, closingPct: 0.02, capex: units * 6000, ltv: 0.7, rate: 0.0675, amortYears: 30,
  rentGrowth: 0.03, expenseGrowth: 0.03, exitCap: 0.065, holdYears: 5, sellPct: 0.02,
});

export const SEED: Deal[] = [
  {
    id: "maple-court", name: "Maple Court Apartments", address: "1420 Maple Ave", market: "Columbus, OH",
    stage: "Underwriting", targetIrr: 0.15, updatedAt: "2026-09-26",
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
    id: "harbor-flats", name: "Harbor Flats", address: "88 Harbor St", market: "Tampa, FL",
    stage: "LOI", targetIrr: 0.16, updatedAt: "2026-09-21",
    assumptions: baseA(6_900_000, 48),
    lines: lines(
      [835000, 25000, 40000, 71000, 38000, 26000, 28000, 33400, 42000, 12000],
      [812000, 48700, 36200, 74800, 61500, 29900, 33100, 32500, 45000, 0],
      [820000, 45000, 38000, 79000, 64000, 30000, 32000, 32800, 45000, 14400],
    ),
    adjustments: [{ id: "b1", label: "Insurance quote above T-12", type: "annual", amount: 9000 }],
  },
  {
    id: "elm-row", name: "Elm Row Townhomes", address: "210 Elm Row", market: "Indianapolis, IN",
    stage: "Closed", targetIrr: 0.15, updatedAt: "2026-07-10",
    assumptions: baseA(2_150_000, 18),
    lines: lines(
      [276000, 8300, 9000, 24000, 9500, 6000, 11000, 11000, 0, 4500],
      [268000, 16000, 7800, 29800, 11200, 7400, 13600, 10700, 0, 0],
      [270000, 15000, 8500, 31000, 11500, 7000, 12500, 10800, 0, 5400],
    ),
    adjustments: [],
  },
  {
    id: "cedar-point", name: "Cedar Point Commons", address: "5 Cedar Point Rd", market: "Charlotte, NC",
    stage: "Passed", targetIrr: 0.15, updatedAt: "2026-08-02",
    assumptions: baseA(9_400_000, 64),
    lines: lines(
      [1105000, 33000, 52000, 88000, 44000, 38000, 36000, 44200, 60000, 16000],
      [1052000, 84100, 44300, 112600, 57800, 44100, 47200, 42100, 66000, 0],
      [1060000, 79500, 46000, 116000, 58000, 44000, 45000, 42400, 66000, 19200],
    ),
    adjustments: [],
  },
];

interface Ctx {
  deals: Deal[];
  update: (id: string, patch: Partial<Deal>) => void;
  add: (d: Deal) => void;
}
const DealsCtx = createContext<Ctx | null>(null);
const KEY = "keystone.deals.v1";

export function DealsProvider({ children }: { children: ReactNode }) {
  const [deals, setDeals] = useState<Deal[]>(SEED);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setDeals(JSON.parse(raw));
    } catch { /* ignore */ }
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (loaded) localStorage.setItem(KEY, JSON.stringify(deals));
  }, [deals, loaded]);
  const update = (id: string, patch: Partial<Deal>) =>
    setDeals((ds) => ds.map((d) => (d.id === id ? { ...d, ...patch, updatedAt: new Date().toISOString().slice(0, 10) } : d)));
  const add = (d: Deal) => setDeals((ds) => [d, ...ds]);
  return <DealsCtx.Provider value={{ deals, update, add }}>{children}</DealsCtx.Provider>;
}

export function useDeals() {
  const c = useContext(DealsCtx);
  if (!c) throw new Error("useDeals outside provider");
  return c;
}

export function blankDeal(name: string, market: string): Deal {
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + Math.random().toString(36).slice(2, 6);
  return {
    id, name, address: "", market, stage: "Screening", targetIrr: 0.15,
    updatedAt: new Date().toISOString().slice(0, 10),
    assumptions: baseA(3_000_000, 24),
    lines: lines(Array(10).fill(0), Array(10).fill(0), Array(10).fill(0)),
    adjustments: [],
  };
}
