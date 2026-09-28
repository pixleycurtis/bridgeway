import { useEffect, useState } from "react";
import { toast } from "sonner";
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
  const { firm } = useWorkspace();
  const { rows, add, update, remove } = useDealRows<Task>("deal_tasks", deal.id, "due_date");
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
        <h2 className="font-display text-2xl">Key dates</h2>
        <p className="mt-1 text-sm text-muted-foreground">The hard dates in escrow. Miss one and the seller keeps your deposit.</p>
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
          {dates.length === 0 && <li className="p-4 text-sm text-muted-foreground">No key dates yet.</li>}
          {dates.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <div>
                {d.title}
                <div className={`num text-xs ${isOverdue(d) ? "text-destructive" : "text-muted-foreground"}`}>{d.dueDate}{isOverdue(d) ? " · past" : ""}</div>
              </div>
              {deal.canEdit ? (
                <div className="flex items-center gap-3">
                  <input type="date" value={d.dueDate ?? ""} onChange={(e) => update(d.id, { due_date: e.target.value })} className="rounded border bg-background px-1.5 py-1 text-xs" />
                  <button className="text-xs text-muted-foreground hover:text-destructive" onClick={() => remove(d.id)}>Remove</button>
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
        <p className="mt-1 text-sm text-muted-foreground">Assign work to your team. Overdue items show up on the pipeline.</p>
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
          {tasks.length === 0 && <li className="p-4 text-sm text-muted-foreground">No tasks yet.</li>}
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
                {deal.canEdit && <button className="text-xs text-muted-foreground hover:text-destructive" onClick={() => remove(t.id)}>Remove</button>}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
