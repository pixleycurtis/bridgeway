import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { signalActionsChanged } from "./deal-actions";
import { useWorkspace } from "./workspace";

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

/** A title commitment item or closing checklist row. */
export interface TitleItem {
  id: string;
  section: "commitment" | "closing";
  item: string;
  status: string;
  dueDate: string | null;
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
/** DB rows come back snake_case; the app reads camelCase. */
const camelize = (r: RowShape): RowShape =>
  Object.fromEntries(Object.entries(r).map(([k, v]) => [k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()), v]));

/** Small CRUD hook for per-deal tables. Never renders anything. */
export function useDealRows<T>(table: string, dealId: string | undefined, order = "created_at") {
  const { firm } = useWorkspace();
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    if (!dealId) return;
    setLoading(true);
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const fromAny = (supabase.from as any)(table) as any;
    const { data, error: readError } = await fromAny.select("*").eq("deal_id", dealId).order(order);
    /* eslint-enable @typescript-eslint/no-explicit-any */
    if (readError) { setError(readError.message); toast.error(readError.message); }
    else { setRows(((data ?? []) as RowShape[]).map(camelize) as unknown as T[]); setError(null); }
    setLoading(false);
  }, [table, dealId, order]);
  useEffect(() => { void reload(); }, [reload]);

  const add = async (values: Partial<T> & RowShape) => {
    if (!dealId) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fromAny = (supabase.from as any)(table);
    const { data, error } = await fromAny.insert({ ...values, deal_id: dealId, ...(["deal_tasks", "deal_dd_items", "deal_lender_quotes", "deal_actuals", "deal_title_items"].includes(table) ? { firm_id: firm?.id } : {}) }).select().single();
    if (error || !data) { toast.error(error?.message ?? "Couldn't save"); return; }
    setRows((rs) => [...rs, camelize(data as RowShape) as unknown as T]);
    if (table === "deal_tasks" || table === "deal_dd_items") signalActionsChanged();
  };
  const update = async (id: string, values: RowShape) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from as any)(table).update(values).eq("id", id);
    if (error) { toast.error(error.message); return; }
    setRows((rs) => rs.map((r) => ({ ...(r as RowShape), ...camelize(values) } as unknown as T)));
    if (table === "deal_tasks" || table === "deal_dd_items") signalActionsChanged();
  };
  const remove = async (id: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from as any)(table).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setRows((rs) => rs.filter((r) => (r as unknown as { id: string }).id !== id));
    if (table === "deal_tasks" || table === "deal_dd_items") signalActionsChanged();
  };
  return { rows, loading, error, reload, add, update, remove };
}

/** Open/overdue task counts for a set of deals (used on the pipeline). */
export function useTaskStats(dealIds: string[]) {
  const [stats, setStats] = useState<Record<string, { open: number; overdue: number }>>({});
  const key = dealIds.join(",");
  useEffect(() => {
    const ids = key ? key.split(",") : [];
    if (!ids.length) { setStats({}); return; }
    const refresh = () => { void (async () => {
      const { data } = await supabase.from("deal_tasks").select("deal_id, kind, done, due_date").in("deal_id", ids);
      const next: Record<string, { open: number; overdue: number }> = {};
      const today = new Date().toLocaleDateString("en-CA");
      for (const r of data ?? []) {
        if (r.kind !== "task" || r.done) continue;
        const s = (next[r.deal_id] ??= { open: 0, overdue: 0 });
        s.open++;
        if (r.due_date && r.due_date < today) s.overdue++;
      }
      setStats(next);
    })(); };
    refresh();
    window.addEventListener("keystone:actions-changed", refresh);
    return () => window.removeEventListener("keystone:actions-changed", refresh);
  }, [key]);
  return stats;
}
