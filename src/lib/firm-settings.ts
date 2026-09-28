import type { Json } from "@/integrations/supabase/types";

export const TERMINAL = ["Closed", "Passed"] as const;
export const DEFAULT_STAGES = ["Screening", "Underwriting", "LOI", "Under contract"];
export const DEFAULT_TYPES = ["Multifamily", "Retail", "Office", "Industrial", "Mixed-use", "Self-storage"];
export const PASS_REASONS = ["Price too high", "Seller wouldn't retrade", "Failed diligence", "Financing", "Lost to another buyer", "Market / location", "Returns below target", "Other"];

export const PIPELINE_COLUMNS = [
  { key: "type", label: "Type" },
  { key: "stage", label: "Stage" },
  { key: "days", label: "Days in stage" },
  { key: "price", label: "Price" },
  { key: "perUnit", label: "Price / unit" },
  { key: "brokerCap", label: "Broker cap" },
  { key: "cap", label: "Your cap" },
  { key: "gap", label: "NOI gap" },
  { key: "dscr", label: "DSCR" },
  { key: "irr", label: "IRR" },
  { key: "updated", label: "Updated" },
] as const;
export type ColumnKey = (typeof PIPELINE_COLUMNS)[number]["key"];

export interface FirmSettings {
  stages: string[];
  propertyTypes: string[];
  columns: ColumnKey[];
  targetIrr: number;
  flagThreshold: number;
  stallDays: number;
  defaults: { ltv: number; rate: number; exitCap: number; holdYears: number };
}

export const DEFAULT_SETTINGS: FirmSettings = {
  stages: DEFAULT_STAGES,
  propertyTypes: DEFAULT_TYPES,
  columns: ["type", "stage", "days", "price", "brokerCap", "cap", "gap", "irr"],
  targetIrr: 0.15,
  flagThreshold: 0.1,
  stallDays: 30,
  defaults: { ltv: 0.7, rate: 0.0675, exitCap: 0.065, holdYears: 5 },
};

export function readSettings(raw: Json | null | undefined): FirmSettings {
  const s = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as Partial<FirmSettings>;
  return {
    ...DEFAULT_SETTINGS,
    ...s,
    stages: s.stages?.length ? s.stages.filter((x) => !TERMINAL.includes(x as never)) : DEFAULT_STAGES,
    propertyTypes: s.propertyTypes?.length ? s.propertyTypes : DEFAULT_TYPES,
    columns: s.columns?.length ? s.columns : DEFAULT_SETTINGS.columns,
    defaults: { ...DEFAULT_SETTINGS.defaults, ...(s.defaults ?? {}) },
  };
}

export const allStages = (s: FirmSettings) => [...s.stages, ...TERMINAL];
export const isOpen = (stage: string) => !TERMINAL.includes(stage as never);

export function daysInStage(history: { stage: string; at: string }[], fallback: string) {
  const last = history[history.length - 1];
  const t = new Date(last?.at ?? fallback).getTime();
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000));
}
