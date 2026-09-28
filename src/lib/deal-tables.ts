import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/** A task or key date on a deal's schedule. */
export interface Task {
  id: string;
  dealId: string;
  kind: "task" | "date";
  title: string;
  dueDate: string | null;
  assignee: string | null;
  done: boolean;
}

/** An item on the diligence request checklist. */
export interface DdItem {
  id: string;
  dealId: string;
  label: string;
  category: string;
  received: boolean;
  filePath: string | null;
}

/** A lender quote / term sheet. */
export interface Quote {
  id: string;
  dealId: string;
  lender: string;
  program: string | null;
  loanAmount: number | null;
  rate: number | null;
  amortYears: number | null;
  ioYears: number | null;
  dscrTest: number | null;
  recourse: string | null;
  feeBps: number | null;
  status: string;
  notes: string | null;
}

/** One quarter (or any period) of post-close actuals. */
export interface Actual {
  id: string;
  dealId: string;
  period: string;
  revenue: number;
  otherIncome: number;
  expenses: number;
  notes: string | null;
}

/** Firm-wide default assumptions for a market + property type. */
export interface FirmDefault {
  id: string;
  market: string;
  propertyType: string;
  defaults: { ltv?: number; rate?: number; exitCap?: number; holdYears?: number };
}

export const isOverdue = (t: { done: boolean; dueDate: string | null }) =>
  !t.done && !!t.dueDate && t.dueDate < new Date().toISOString().slice(0, 10);

type RowShape = { [k: string]: unknown };

/** Small CRUD hook for per-deal tables. Never renders anything. */
export function useDealRows<T>(table: string, dealId: string | undefined, order = "created_at") {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    if (!dealId) return;
    const { data } = await supabase.from(table).select("*").eq("deal_id", dealId).order(order);
    setRows((data ?? []) as unknown as T[]);
    setLoading(false);
  }, [table, dealId, order]);
  useEffect(() => { void reload(); }, [reload]);

  const add = async (values: Partial<T> & RowShape) => {
    if (!dealId) return;
    const { data, error } = await supabase.from(table).insert({ ...values, deal_id: dealId } as never).select().single();
    if (error || !data) { toast.error(error?.message ?? "Couldn't save"); return; }
    setRows((rs) => [...rs, data as unknown as T]);
  };
  const update = async (id: string, values: RowShape) => {
    const { error } = await supabase.from(table).update(values as never).eq("id", id);
    if (error) { toast.error(error.message); return; }
    setRows((rs) => rs.map((r) => ({ ...(r as RowShape), ...values } as unknown as T)));
  };
  const remove = async (id: string) => {
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setRows((rs) => rs.filter((r) => (r as unknown as { id: string }).id !== id));
  };
  return { rows, loading, reload, add, update, remove };
}

/** Open/overdue task counts for a set of deals (used on the pipeline). */
export function useTaskStats(dealIds: string[]) {
  const [stats, setStats] = useState<Record<string, { open: number; overdue: number }>>({});
  const key = dealIds.join(",");
  useEffect(() => {
    const ids = key ? key.split(",") : [];
    if (!ids.length) { setStats({}); return; }
    (async () => {
      const { data } = await supabase.from("deal_tasks").select("deal_id, done, due_date").in("deal_id", ids);
      const next: Record<string, { open: number; overdue: number }> = {};
      const today = new Date().toISOString().slice(0, 10);
      for (const r of (data ?? []) as { deal_id: string; done: boolean; due_date: string | null }[]) {
        const s = (next[r.deal_id] ??= { open: 0, overdue: 0 });
        if (!r.done) {
          s.open++;
          if (r.due_date && r.due_date < today) s.overdue++;
        }
      }
      setStats(next);
    })();
  }, [key]);
  return stats;
}
