import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDealRows, type Task, type TitleItem } from "@/lib/deal-tables";
import { useWorkspace } from "@/lib/workspace";
import { extractCommitment, type CommitmentExtract } from "@/lib/ai.functions";
import { getSharedFileUrl } from "@/lib/deal-files.functions";
import { SharedWith, ImpactInput, AssignRole, ItemThread } from "./deal-room";
import { readForAI } from "@/lib/files";
import { usd } from "@/lib/finance";
import { closingTemplate } from "@/lib/checklists";
import type { Deal } from "@/lib/deals-store";

const STATUS: Record<TitleItem["section"], { value: string; label: string }[]> = {
  commitment: [
    { value: "open", label: "Open" },
    { value: "objected", label: "Objected" },
    { value: "received", label: "Received — review" },
    { value: "cleared", label: "Cleared" },
    { value: "accepted", label: "Accepted" },
  ],
  closing: [
    { value: "open", label: "Open" },
    { value: "in-progress", label: "In progress" },
    { value: "received", label: "Received — review" },
    { value: "done", label: "Done" },
  ],
};
const SETTLED = ["cleared", "accepted", "done"];

const COMMITMENT_TEMPLATE = [
  "Payoff statement(s) for seller's existing mortgage(s)",
  "Entity & authority documents (LLC agreement, resolutions, good standing)",
  "Closing protection letter",
  "Release of existing deed of trust / mortgage",
  "Survey affidavit / existing survey acceptance",
];


export function DealClosing({ deal }: { deal: Deal }) {
  const { rows, loading, error, reload, add, update, remove } = useDealRows<TitleItem>("deal_title_items", deal.id, "created_at");
  const tasks = useDealRows<Task>("deal_tasks", deal.id, "due_date");
  const [section, setSection] = useState<TitleItem["section"]>("commitment");
  const [label, setLabel] = useState("");
  const [due, setDue] = useState("");
  const [busy, setBusy] = useState(false);
  const [thread, setThread] = useState<string | null>(null);
  const [found, setFound] = useState<CommitmentExtract | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const readCommitment = useServerFn(extractCommitment);
  const getFileUrl = useServerFn(getSharedFileUrl);

  const items = rows.filter((r) => r.section === section);
  const template = section === "commitment" ? COMMITMENT_TEMPLATE : closingTemplate(deal.propertyType);
  const dateRows = tasks.rows.filter((t) => t.kind === "date");
  const suggestedDates = ["Title objection deadline", "Closing date"].filter((t) => !tasks.rows.some((x) => x.title === t));

  const addItem = async () => {
    if (!label.trim()) return;
    await add({ section, item: label.trim(), status: "open", ...(due ? { due_date: due } : {}) });
    setLabel(""); setDue("");
  };

  const addStandard = async () => {
    for (const t of template) if (!items.some((r) => r.item === t)) await add({ section, item: t, status: "open" });
    toast.success("Standard list added");
  };

  const openFile = async (path: string) => {
    const tab = window.open("", "_blank");
    try {
      const { url } = await getFileUrl({ data: { dealId: deal.id, path } });
      if (tab) tab.location.href = url;
      else window.location.assign(url);
    } catch (e) {
      tab?.close();
      toast.error(e instanceof Error ? e.message : "Could not open the file");
    }
  };

  const onFile = async (item: TitleItem, file?: File) => {
    if (!file) return;
    const path = `${deal.firmId}/${deal.id}/${Date.now()}-${file.name.replace(/[^\w.-]+/g, "_")}`;
    const up = await supabase.storage.from("deal-files").upload(path, file);
    if (up.error) { toast.error(up.error.message); return; }
    const { error: mdErr } = await supabase.from("deal_files").insert({ deal_id: deal.id, kind: "title", name: file.name, path });
    if (mdErr) { await supabase.storage.from("deal-files").remove([path]); toast.error(mdErr.message); return; }
    await update(item.id, { file_path: path });
    toast.success("Filed");
  };

  const onCommitment = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      const out = await readCommitment({ data: await readForAI(file) });
      const reqs = out.requirements ?? [];
      const exs = out.exceptions ?? [];
      const dts = (out.dates ?? []).filter((d) => d.title);
      if (!reqs.length && !exs.length && !dts.length) toast.error("Couldn't find schedules in that file — add items manually or try another PDF.");
      setFound(out);
      setPicked(new Set([...reqs.map((_, i) => `r:${i}`), ...exs.map((_, i) => `e:${i}`), ...dts.map((_, i) => `d:${i}`)]));
      setSection("commitment");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't read that file");
    }
    setBusy(false);
  };

  const toggle = (k: string) => setPicked((p) => { const n = new Set(p); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  const applyFound = async () => {
    if (!found) return;
    const reqs = found.requirements ?? [];
    const exs = found.exceptions ?? [];
    const dts = (found.dates ?? []).filter((d) => d.title);
    for (const [i, r] of reqs.entries()) if (picked.has(`r:${i}`) && r.item) await add({ section: "commitment", item: r.item, status: "open" });
    for (const [i, e] of exs.entries()) if (picked.has(`e:${i}`) && e.item) await add({ section: "commitment", item: e.item, status: "open" });
    for (const [i, d] of dts.entries()) if (picked.has(`d:${i}`)) await tasks.add({ kind: "date", title: d.title, due_date: d.date || null, done: false });
    setFound(null);
    toast.success("Added to the tracker");
  };

  const tab = (sec: TitleItem["section"], text: string) => (
    <button key={sec} onClick={() => setSection(sec)}
      className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${section === sec ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
      {text}
    </button>
  );

  return (
    <div className="grid gap-8 xl:grid-cols-[1fr_340px]">
      <div className="min-w-0">
        <div className="flex flex-wrap gap-1 border-b">
          {tab("commitment", "Title commitment")}
          {tab("closing", "Closing checklist")}
          <Link to="/deals/$dealId/closing" params={{ dealId: deal.id }} className="ml-auto self-center px-2 text-sm text-primary hover:underline">Open checklist page →</Link>
        </div>
        {error && <p className="mt-4 text-sm text-destructive">{error} <Button variant="link" size="sm" onClick={() => void reload()}>Retry</Button></p>}
        {deal.canEdit && (
          <form className="mt-4 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); void addItem(); }}>
            <Input className="h-9 min-w-48 flex-1" placeholder={section === "commitment" ? "Add a Schedule B-I requirement or B-II exception…" : "Add a closing task…"} value={label} onChange={(e) => setLabel(e.target.value)} />
            <Input type="date" aria-label="Due date" className="h-9 w-36" value={due} onChange={(e) => setDue(e.target.value)} />
            <Button type="submit" variant="secondary" size="sm">Add</Button>
            <Button type="button" variant="outline" size="sm" onClick={() => void addStandard()}>Use the standard list</Button>
          </form>
        )}
        {loading ? (
          <div className="mt-6 text-sm text-muted-foreground">Loading…</div>
        ) : items.length === 0 ? (
          <div className="mt-6 rounded-md border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
            {section === "commitment"
              ? "Nothing tracked yet. Upload the title commitment and Keystone will pull the requirements and exceptions in, or start from the standard list."
              : "No closing tasks yet. Start from the standard list."}
          </div>
        ) : (
          <ul className="mt-4 divide-y rounded-md border bg-card">
            {items.map((it) => (
              <li key={it.id} className="px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className={SETTLED.includes(it.status) ? "text-muted-foreground line-through" : ""}>{it.item}</span>
                  {deal.canEdit ? (
                    <select value={it.status} onChange={(e) => update(it.id, { status: e.target.value })} aria-label={`Status for ${it.item}`} className="rounded border bg-card px-1.5 py-0.5 text-xs">
                      {STATUS[section].map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  ) : <span className="text-xs capitalize text-muted-foreground">{it.status.replace("-", " ")}</span>}
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  {deal.canEdit ? (
                    <label className="flex items-center gap-1">Due
                      <input type="date" value={it.dueDate ?? ""} onChange={(e) => update(it.id, { due_date: e.target.value || null })} aria-label={`Due date for ${it.item}`} className="rounded border bg-card px-1 py-0.5" />
                    </label>
                  ) : it.dueDate ? <span>Due {it.dueDate}</span> : null}
                  {it.filePath && <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => void openFile(it.filePath ?? "")}>Open file</Button>}
                  {deal.canEdit && !it.filePath && (
                    <label className="cursor-pointer hover:text-foreground">Attach file
                      <input type="file" className="hidden" onChange={(e) => { void onFile(it, e.target.files?.[0]); e.target.value = ""; }} />
                    </label>
                  )}
                  {deal.canEdit && section === "commitment" && <ImpactInput value={it.impact} onChange={(v) => update(it.id, { impact: v })} />}
                  {deal.canEdit && <AssignRole value={it.assignedRole} shared={it.sharedWith ?? []} onChange={(p) => update(it.id, p)} />}
                  {deal.canEdit && <SharedWith value={it.sharedWith ?? []} onChange={(v) => update(it.id, { shared_with: v })} />}
                  <button type="button" className="hover:text-foreground" onClick={() => setThread(thread === it.id ? null : it.id)}>Discuss</button>
                  {deal.canEdit && <button className="hover:text-destructive" onClick={() => void remove(it.id)}>Remove</button>}
                </div>
                {thread === it.id && <ItemThread dealId={deal.id} itemType="title" itemId={it.id} roles={it.sharedWith ?? []} />}
              </li>
            ))}
          </ul>
        )}
      </div>
      <aside className="space-y-6">
        {deal.canEdit && (
          <div className="rounded-md border bg-card p-5">
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Read the commitment</div>
            <label className={`mt-3 flex cursor-pointer items-center justify-between rounded-md border border-dashed px-3 py-2.5 text-sm hover:border-primary ${busy ? "opacity-60" : ""}`}>
              <span>{busy ? "Reading the commitment…" : "Upload the commitment (PDF)"}</span>
              <input type="file" accept=".pdf,application/pdf" className="hidden" disabled={busy} onChange={(e) => { void onCommitment(e.target.files?.[0]); e.target.value = ""; }} />
            </label>
            {found && (() => {
              const reqs = found.requirements ?? [];
              const exs = found.exceptions ?? [];
              const dts = (found.dates ?? []).filter((d) => d.title);
              return (
                <div className="mt-4 border-t pt-4">
                  <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Review before applying</div>
                  {found.proposedInsured && <p className="mt-2 text-sm">Proposed insured: {found.proposedInsured}{found.policyAmount ? ` · policy ${usd(found.policyAmount)}` : ""}</p>}
                  {([["r", "Schedule B-I requirements", reqs], ["e", "Schedule B-II exceptions", exs]] as const).map(([key, title, list]) => list.length > 0 && (
                    <div key={key} className="mt-3">
                      <div className="text-xs font-medium">{title}</div>
                      <ul className="mt-1 space-y-1 text-sm">
                        {list.map((x, i) => (
                          <li key={i}>
                            <label className="flex items-start gap-2">
                              <input type="checkbox" checked={picked.has(`${key}:${i}`)} onChange={() => toggle(`${key}:${i}`)} className="mt-1 h-3.5 w-3.5" />
                              <span>{x.item}</span>
                            </label>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                  {dts.length > 0 && (
                    <div className="mt-3">
                      <div className="text-xs font-medium">Dates</div>
                      <ul className="mt-1 space-y-1 text-sm">
                        {dts.map((d, i) => (
                          <li key={i}>
                            <label className="flex items-center gap-2">
                              <input type="checkbox" checked={picked.has(`d:${i}`)} onChange={() => toggle(`d:${i}`)} className="h-3.5 w-3.5" />
                              <span>{d.title}{d.date ? ` · ${d.date}` : ""}</span>
                            </label>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {found.notes && <p className="mt-3 text-xs text-muted-foreground">{found.notes}</p>}
                  <div className="mt-4 flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setFound(null)}>Discard</Button>
                    <Button size="sm" onClick={() => void applyFound()}>Add to tracker</Button>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
        <div className="rounded-md border bg-card p-5">
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Key dates</div>
          <ul className="mt-3 space-y-2 text-sm">
            {dateRows.length === 0 && <li className="text-muted-foreground">No closing dates yet.</li>}
            {dateRows.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2">
                <span className={t.done ? "text-muted-foreground line-through" : ""}>{t.title}</span>
                {deal.canEdit ? (
                  <input type="date" value={t.dueDate ?? ""} onChange={(e) => tasks.update(t.id, { due_date: e.target.value || null })} aria-label={`Date for ${t.title}`} className="rounded border bg-card px-1 py-0.5 text-xs" />
                ) : <span className="num text-xs">{t.dueDate ?? "—"}</span>}
              </li>
            ))}
          </ul>
          {deal.canEdit && suggestedDates.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {suggestedDates.map((t) => (
                <Button key={t} variant="outline" size="sm" onClick={() => void tasks.add({ kind: "date", title: t, due_date: null, done: false })}>+ {t}</Button>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-md border bg-card p-5">
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Where things stand</div>
          <div className="num mt-1 text-3xl">{rows.filter((r) => r.status === "open").length}</div>
          <p className="text-xs text-muted-foreground">open items across the commitment and closing</p>
          <div className="mt-3 space-y-1 text-xs text-muted-foreground">
            <div>{rows.filter((r) => r.status === "objected").length} objected to the title company</div>
            <div>{rows.filter((r) => SETTLED.includes(r.status)).length} resolved</div>
          </div>
        </div>
      </aside>
    </div>
  );
}
