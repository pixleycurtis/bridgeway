import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Deal } from "./deals-store";

export type ActionTask = { id: string; deal_id: string; kind: "task" | "date"; title: string; due_date: string | null; assignee: string | null; done: boolean };
export type ActionRequest = { id: string; deal_id: string; label: string; category: string; received: boolean };
export type ActionMember = { id: string; user_id: string; full_name: string | null; email: string };

export function signalActionsChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("keystone:actions-changed"));
}

export function useDealActions(deals: Deal[]) {
  const [tasks, setTasks] = useState<ActionTask[]>([]);
  const [requests, setRequests] = useState<ActionRequest[]>([]);
  const [members, setMembers] = useState<ActionMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const ids = deals.map((d) => d.id).sort().join(",");

  const reload = useCallback(async () => {
    if (!ids) { setTasks([]); setRequests([]); setMembers([]); setError(null); setLoading(false); return; }
    setLoading(true);
    const dealIds = ids.split(",");
    const [taskResult, requestResult, memberResult] = await Promise.all([
      supabase.from("deal_tasks").select("id, deal_id, kind, title, due_date, assignee, done").in("deal_id", dealIds),
      supabase.from("deal_dd_items").select("id, deal_id, label, category, received").in("deal_id", dealIds),
      supabase.from("firm_members").select("id, user_id, full_name, email"),
    ]);
    const failure = taskResult.error || requestResult.error || memberResult.error;
    if (failure) setError(failure.message);
    else {
      setTasks((taskResult.data ?? []) as ActionTask[]);
      setRequests((requestResult.data ?? []) as ActionRequest[]);
      setMembers((memberResult.data ?? []) as ActionMember[]);
      setError(null);
    }
    setLoading(false);
  }, [ids]);

  useEffect(() => {
    void reload();
    window.addEventListener("keystone:actions-changed", reload);
    return () => window.removeEventListener("keystone:actions-changed", reload);
  }, [reload]);

  const completeTask = async (task: ActionTask) => {
    const deal = deals.find((d) => d.id === task.deal_id);
    if (!deal?.canEdit || task.kind !== "task") return false;
    const { error: saveError } = await supabase.from("deal_tasks").update({ done: true }).eq("id", task.id).eq("deal_id", deal.id);
    if (saveError) { setError(saveError.message); return false; }
    setTasks((current) => current.map((row) => row.id === task.id ? { ...row, done: true } : row));
    signalActionsChanged();
    return true;
  };

  return { tasks, requests, members, loading, error, reload, completeTask };
}

export function actionPriority(task: ActionTask, today = new Date().toLocaleDateString("en-CA")) {
  if (!task.due_date) return 3;
  if (task.due_date < today) return 0;
  if (task.due_date === today) return 1;
  const upcoming = new Date(`${today}T12:00:00`);
  upcoming.setDate(upcoming.getDate() + 7);
  return task.due_date <= upcoming.toLocaleDateString("en-CA") ? 2 : 3;
}

export function nextDealAction(dealId: string, tasks: ActionTask[], requests: ActionRequest[]) {
  const open = tasks.filter((t) => t.deal_id === dealId && !t.done);
  const earliest = open.filter((t) => t.due_date).sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""))[0];
  const missing = requests.find((r) => r.deal_id === dealId && !r.received);
  return { earliest, missing, openTasks: open.filter((t) => t.kind === "task").length };
}