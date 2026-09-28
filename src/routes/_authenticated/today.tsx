import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { useDealActions, actionPriority, type ActionTask } from "@/lib/deal-actions";
import { useDeals } from "@/lib/deals-store";
import { useWorkspace } from "@/lib/workspace";
import { isOpen } from "@/lib/firm-settings";

export const Route = createFileRoute("/_authenticated/today")({
  head: () => ({ meta: [
    { title: "Today — Keystone" },
    { name: "description", content: "Your firm's live deal priorities, deadlines, owners, and missing diligence." },
    { property: "og:title", content: "Today — Keystone" },
    { property: "og:description", content: "Your firm's live deal priorities, deadlines, owners, and missing diligence." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: Today,
});

type Scope = "mine" | "team" | "unassigned";

function Today() {
  const { deals, loading: dealsLoading } = useDeals();
  const { user, me } = useWorkspace();
  const active = deals.filter((d) => isOpen(d.stage));
  const { tasks, requests, members, loading, error, reload, completeTask } = useDealActions(active);
  const [scope, setScope] = useState<Scope>("mine");
  const today = new Date().toLocaleDateString("en-CA");
  const dealById = new Map(active.map((d) => [d.id, d]));
  const visible = tasks.filter((t) => !t.done && (scope === "team" || (scope === "unassigned" ? !t.assignee : t.assignee === me?.id)));
  const sorted = [...visible].sort((a, b) => actionPriority(a, today) - actionPriority(b, today) || (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));
  const groups = [
    { title: "Overdue", rows: sorted.filter((t) => actionPriority(t, today) === 0) },
    { title: "Due today", rows: sorted.filter((t) => actionPriority(t, today) === 1) },
    { title: "Next 7 days", rows: sorted.filter((t) => actionPriority(t, today) === 2) },
    { title: "Later & unscheduled", rows: sorted.filter((t) => actionPriority(t, today) === 3) },
  ];
  const outstanding = requests.filter((r) => !r.received);
  const owner = (task: ActionTask) => members.find((m) => m.id === task.assignee)?.full_name || members.find((m) => m.id === task.assignee)?.email || "Unassigned";

  return <div>
    <PageHeader eyebrow="Workspace" title="Today" />
    <div className="px-6 py-8 md:px-10">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-5">
        <div className="flex flex-wrap gap-6 text-sm">
          <span><strong className="num text-xl text-destructive">{tasks.filter((t) => !t.done && actionPriority(t, today) === 0).length}</strong> <span className="text-muted-foreground">overdue</span></span>
          <span><strong className="num text-xl">{tasks.filter((t) => !t.done && actionPriority(t, today) === 1).length}</strong> <span className="text-muted-foreground">due today</span></span>
          <span><strong className="num text-xl">{outstanding.length}</strong> <span className="text-muted-foreground">documents outstanding</span></span>
        </div>
        <div role="group" aria-label="Task ownership" className="inline-flex gap-1 rounded-md border p-1">
          {(["mine", "team", "unassigned"] as const).map((option) => <Button key={option} size="sm" variant={scope === option ? "secondary" : "ghost"} aria-pressed={scope === option} onClick={() => setScope(option)} className="capitalize">{option === "mine" ? "Mine" : option === "team" ? "Team" : "Unassigned"}</Button>)}
        </div>
      </div>
      {error && <div role="alert" className="mt-6 flex items-center gap-3 border-l-2 border-destructive bg-destructive-soft px-4 py-3 text-sm">Couldn't load priorities. <Button variant="outline" size="sm" onClick={() => void reload()}>Retry</Button></div>}
      {(loading || dealsLoading) && <p className="py-10 text-sm text-muted-foreground">Loading priorities…</p>}
      {!loading && !dealsLoading && !error && <div className="grid gap-10 py-8 xl:grid-cols-[minmax(0,1.6fr)_minmax(280px,1fr)]">
        <div className="space-y-8">
          {groups.filter((g) => g.rows.length).map((group) => <section key={group.title}>
            <div className="flex items-baseline justify-between border-b pb-2"><h2 className="font-display text-2xl">{group.title}</h2><span className="num text-xs text-muted-foreground">{group.rows.length}</span></div>
            <ul className="divide-y">
              {group.rows.map((task) => { const deal = dealById.get(task.deal_id); if (!deal) return null; return <li key={task.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                {task.kind === "task" && deal.canEdit ? <input aria-label={`Complete ${task.title}`} type="checkbox" className="h-4 w-4 accent-primary" onChange={() => void completeTask(task)} /> : <span className="w-4 text-center text-muted-foreground" aria-label="Key date">{task.kind === "date" ? "◷" : "•"}</span>}
                <div className="min-w-0 flex-1"><div className="font-medium">{task.title}</div><div className="text-xs text-muted-foreground"><Link to="/deals/$dealId" params={{ dealId: deal.id }} search={{ step: "schedule" }} className="hover:underline">{deal.name}</Link> · {task.kind === "date" ? "Key date" : owner(task)}</div></div>
                <span className={`num text-xs ${task.due_date && task.due_date < today ? "text-destructive" : "text-muted-foreground"}`}>{task.due_date ?? "No date"}</span>
              </li>; })}
            </ul>
          </section>)}
          {!sorted.length && <div className="border-t py-10 text-sm text-muted-foreground">{scope === "mine" ? "Nothing assigned to you. Check Team or add tasks to an active deal." : scope === "unassigned" ? "No unassigned tasks or key dates." : "No open tasks or key dates. Add them to an active deal."}</div>}
        </div>
        <aside>
          <div className="flex items-baseline justify-between border-b pb-2"><h2 className="font-display text-2xl">Awaiting documents</h2><span className="num text-xs text-muted-foreground">{outstanding.length}</span></div>
          <ul className="divide-y text-sm">
            {outstanding.slice(0, 20).map((item) => { const deal = dealById.get(item.deal_id); return deal && <li key={item.id} className="py-3"><div>{item.label}</div><Link to="/deals/$dealId" params={{ dealId: deal.id }} search={{ step: "vault" }} className="text-xs text-muted-foreground hover:underline">{deal.name} · {item.category} →</Link></li>; })}
          </ul>
          {!outstanding.length && <div className="py-6 text-sm text-muted-foreground">No documents outstanding. Open a deal's Data room to track requests.</div>}
          {outstanding.length > 20 && <div className="py-3 text-xs text-muted-foreground">Showing the first 20 of {outstanding.length} requests.</div>}
        </aside>
      </div>}
      <span className="sr-only">Signed in as {user.email}</span>
    </div>
  </div>;
}