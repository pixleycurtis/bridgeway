import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDeals } from "@/lib/deals-store";
import { useDealRows, type TitleItem } from "@/lib/deal-tables";
import { useWorkspace } from "@/lib/workspace";

export const Route = createFileRoute("/_authenticated/deals_/$dealId/closing")({
  head: () => ({
    meta: [
      { title: "Closing checklist — Keystone" },
      { name: "description", content: "Track every closing task to the table and export the checklist as a PDF." },
      { property: "og:title", content: "Closing checklist — Keystone" },
      { property: "og:description", content: "Track every closing task to the table and export the checklist as a PDF." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ClosingChecklistPage,
});

const STANDARD = [
  "Escrow instructions executed",
  "ALTA settlement statement — draft review",
  "Tenant estoppels & SNDAs collected",
  "Lender's closing conditions cleared",
  "Wire instructions verified (call-back)",
  "Deed recorded & confirmation received",
  "Owner's & lender's title policies issued",
];

function ClosingChecklistPage() {
  const { dealId } = Route.useParams();
  const { deals, loading: dealsLoading } = useDeals();
  const { firm, logoUrl } = useWorkspace();
  const deal = deals.find((d) => d.id === dealId);
  const { rows, loading, add, update, remove } = useDealRows<TitleItem>("deal_title_items", dealId, "created_at");
  const [label, setLabel] = useState("");
  const [due, setDue] = useState("");
  if (!deal) return <div className="p-10 text-sm text-muted-foreground">{dealsLoading ? "Loading…" : <>Deal not found. <Link to="/" className="underline">Back to pipeline</Link></>}</div>;

  const items = rows.filter((r) => r.section === "closing");
  const done = items.filter((r) => r.status === "done").length;
  const canEdit = deal.canEdit;

  const exportPdf = () => {
    const prev = document.title;
    document.title = `${deal.name} — Closing checklist`;
    setTimeout(() => { window.print(); document.title = prev; }, 150);
  };

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="flex gap-4">
          <Link to="/deals/$dealId" params={{ dealId }} search={{ step: "closing" }} className="text-muted-foreground hover:text-foreground">← Title & closing</Link>
          <Link to="/deals/$dealId" params={{ dealId }} search={{ step: "schedule" }} className="text-muted-foreground hover:text-foreground">Schedule</Link>
        </div>
        <Button size="sm" onClick={exportPdf} disabled={!items.length}>Export PDF</Button>
      </div>

      {canEdit && (
        <form className="no-print mb-6 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); if (!label.trim()) return; void add({ section: "closing", item: label.trim(), status: "open", ...(due ? { due_date: due } : {}) }); setLabel(""); setDue(""); }}>
          <Input className="h-9 min-w-48 flex-1" placeholder="Add a closing task…" value={label} onChange={(e) => setLabel(e.target.value)} />
          <Input type="date" aria-label="Due date" className="h-9 w-36" value={due} onChange={(e) => setDue(e.target.value)} />
          <Button type="submit" variant="secondary" size="sm">Add</Button>
          <Button type="button" variant="outline" size="sm" onClick={() => { void (async () => { for (const t of STANDARD) if (!items.some((r) => r.item === t)) await add({ section: "closing", item: t, status: "open" }); })(); }}>Use the standard list</Button>
        </form>
      )}

      <article className="print-doc rounded-md border bg-card p-8">
        <header className="flex items-start justify-between gap-4 border-b pb-4">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground">{firm?.name ?? "Keystone"} · Closing checklist</div>
            <h1 className="mt-1 font-display text-3xl">{deal.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{done} of {items.length} complete · {new Date().toLocaleDateString()}</p>
          </div>
          {logoUrl && <img src={logoUrl} alt="" className="h-10 max-w-32 object-contain" />}
        </header>
        {loading ? <p className="mt-6 text-sm text-muted-foreground">Loading…</p> : items.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">No closing tasks yet{canEdit ? " — add one above or start from the standard list." : "."}</p>
        ) : (
          <ul className="mt-2 divide-y">
            {items.map((it) => {
              const isDone = it.status === "done";
              return (
                <li key={it.id} className="flex items-center gap-3 py-3 text-sm">
                  <input type="checkbox" checked={isDone} disabled={!canEdit} aria-label={`Mark ${it.item} done`}
                    onChange={() => void update(it.id, { status: isDone ? "open" : "done" })} className="h-4 w-4 accent-primary" />
                  <span className={`flex-1 ${isDone ? "text-muted-foreground line-through" : ""}`}>{it.item}</span>
                  {canEdit ? (
                    <input type="date" value={it.dueDate ?? ""} aria-label={`Due date for ${it.item}`} onChange={(e) => void update(it.id, { due_date: e.target.value || null })} className="rounded border bg-card px-1 py-0.5 text-xs" />
                  ) : null}
                  <span className="num w-24 text-right text-xs text-muted-foreground">{it.dueDate ? `Due ${it.dueDate}` : "—"}</span>
                  {canEdit && <button className="no-print text-xs text-muted-foreground hover:text-destructive" onClick={() => void remove(it.id)}>Remove</button>}
                </li>
              );
            })}
          </ul>
        )}
      </article>
    </div>
  );
}
