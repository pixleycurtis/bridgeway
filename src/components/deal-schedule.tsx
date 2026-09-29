import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDealRows, isOverdue, type Task } from "@/lib/deal-tables";
import type { Deal } from "@/lib/deals-store";
import { useWorkspace, type Member } from "@/lib/workspace";

const KEY_DATES = [
  "Due diligence expiration",
  "Financing contingency",
  "Appraisal deadline",
  "Estoppels / SNDA deadline",
  "Rate lock expiration",
  "Closing",
];

export function DealSchedule({ deal }: { deal: Deal }) {
  const { rows, loading, error, reload, add, update, remove } = useDealRows<Task>("deal_tasks", deal.id, "due_date");
  const [members, setMembers] = useState<Member[]>([]);
  const [dateTitle, setDateTitle] = useState<string>("Due diligence expiration");
  const [dateVal, setDateVal] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDue, setTaskDue] = useState("");
  const [assignee, setAssignee] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("firm_members").select("*").order("created_at");
      setMembers(data ?? []);
    })();
  }, []);
  const nameOf = (id: string | null) => members.find((m) => m.id === id)?.full_name || members.find((m) => m.id === id)?.email || "Unassigned";

  const dates = rows.filter((r) => r.kind === "date");
  const tasks = rows.filter((r) => r.kind === "task");
  const open = tasks.filter((t) => !t.done);
  const overdue = tasks.filter(isOverdue);

  const addDate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dateVal) { toast.error("Pick a date"); return; }
    await add({ kind: "date", title: dateTitle, due_date: dateVal, done: false });
    setDateVal("");
  };
  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;
    await add({ kind: "task", title: taskTitle.trim(), due_date: taskDue || null, assignee: assignee || null, done: false });
    setTaskTitle(""); setTaskDue("");
  };

  return (
    <div className="grid gap-8 xl:grid-cols-2">
      <div>
        <div className="flex items-baseline justify-between gap-2"><h2 className="font-display text-2xl">Key dates</h2><Link to="/deals/$dealId/closing" params={{ dealId: deal.id }} className="text-sm text-primary hover:underline">Closing checklist →</Link></div>
        {deal.canEdit && (
          <form onSubmit={addDate} className="mt-4 flex flex-wrap gap-2">
            <select value={dateTitle} onChange={(e) => setDateTitle(e.target.value)} className="h-9 rounded-md border bg-card px-2 text-sm">
              {KEY_DATES.map((d) => <option key={d}>{d}</option>)}
              {!KEY_DATES.includes(dateTitle) && <option>{dateTitle}</option>}
            </select>
            <Input type="date" className="h-9 w-40" value={dateVal} onChange={(e) => setDateVal(e.target.value)} />
            <Button type="submit" variant="secondary" size="sm">Add date</Button>
          </form>
        )}
        <ul className="mt-4 divide-y rounded-md border bg-card">
          {loading && <li className="p-4 text-sm text-muted-foreground">Loading dates…</li>}
          {!loading && !error && dates.length === 0 && <li className="p-4 text-sm text-muted-foreground">{deal.canEdit ? "Set the next contract deadline above." : "No key dates scheduled."}</li>}
          {dates.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <div>
                {d.title}
                <div className={`num text-xs ${isOverdue(d) ? "text-destructive" : "text-muted-foreground"}`}>{d.dueDate}{isOverdue(d) ? " · past" : ""}</div>
              </div>
              {deal.canEdit ? (
                <div className="flex items-center gap-3">
                  <input type="date" value={d.dueDate ?? ""} onChange={(e) => update(d.id, { due_date: e.target.value })} className="rounded border bg-background px-1.5 py-1 text-xs" />
                  <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-destructive" onClick={() => remove(d.id)}>Remove</Button>
                </div>
              ) : <span className="text-xs text-muted-foreground">—</span>}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-2xl">Tasks</h2>
          <span className="text-xs text-muted-foreground">{open.length} open{overdue.length ? <span className="text-destructive"> · {overdue.length} overdue</span> : ""}</span>
        </div>
        {deal.canEdit && (
          <form onSubmit={addTask} className="mt-4 flex flex-wrap gap-2">
            <Input className="h-9 min-w-40 flex-1" placeholder="e.g. Order title commitment" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} />
            <Input type="date" className="h-9 w-36" value={taskDue} onChange={(e) => setTaskDue(e.target.value)} />
            <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className="h-9 rounded-md border bg-card px-2 text-sm">
              <option value="">Assign to…</option>
              {members.map((m) => <option key={m.id} value={m.id}>{m.full_name || m.email}</option>)}
            </select>
            <Button type="submit" variant="secondary" size="sm">Add task</Button>
          </form>
        )}
        <ul className="mt-4 divide-y rounded-md border bg-card">
          {loading && <li className="p-4 text-sm text-muted-foreground">Loading tasks…</li>}
          {!loading && !error && tasks.length === 0 && <li className="p-4 text-sm text-muted-foreground">{deal.canEdit ? "Assign the next piece of work above." : "No tasks assigned."}</li>}
          {tasks.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <label className="flex min-w-0 items-center gap-3">
                {deal.canEdit && <input type="checkbox" checked={t.done} onChange={(e) => update(t.id, { done: e.target.checked })} className="h-4 w-4" />}
                <span className={t.done ? "text-muted-foreground line-through" : ""}>
                  {t.title}
                  <span className="ml-2 text-xs text-muted-foreground">{nameOf(t.assignee)}</span>
                </span>
              </label>
              <div className="flex shrink-0 items-center gap-3">
                <span className={`num text-xs ${isOverdue(t) ? "text-destructive" : "text-muted-foreground"}`}>
                  {t.dueDate ? (t.done ? t.dueDate : `${isOverdue(t) ? "Overdue · " : "Due "}${t.dueDate}`) : "No due date"}
                </span>
                {deal.canEdit && <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-destructive" onClick={() => remove(t.id)}>Remove</Button>}
              </div>
            </li>
          ))}
        </ul>
        {error && <div role="alert" className="mt-3 text-sm text-destructive">Couldn't load schedule. <Button variant="link" size="sm" onClick={() => void reload()}>Retry</Button></div>}
      </div>
    </div>
  );
}
