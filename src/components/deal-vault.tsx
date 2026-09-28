import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDealRows, type DdItem } from "@/lib/deal-tables";
import type { Deal } from "@/lib/deals-store";
import { useWorkspace } from "@/lib/workspace";

const CATEGORIES = ["Financial", "Physical", "Legal & other"];
const TEMPLATE: { label: string; category: string }[] = [
  { label: "Trailing-12 operating statement, month by month", category: "Financial" },
  { label: "Current certified rent roll", category: "Financial" },
  { label: "Two prior years of annual operating statements", category: "Financial" },
  { label: "General ledger, trailing 12 months", category: "Financial" },
  { label: "Real estate tax bills and pending appeals", category: "Financial" },
  { label: "Capital expenditure history (3 years)", category: "Physical" },
  { label: "Property condition & environmental reports", category: "Physical" },
  { label: "Roof, HVAC and system warranties", category: "Physical" },
  { label: "Open work orders and unit turn schedule", category: "Physical" },
  { label: "Service, vendor and management contracts", category: "Legal & other" },
  { label: "Insurance loss runs (5 years)", category: "Legal & other" },
  { label: "Title policy and survey", category: "Legal & other" },
  { label: "Pending or threatened litigation", category: "Legal & other" },
];

type FileRow = { id: string; kind: string; name: string; path: string; created_at: string };

export function DealVault({ deal }: { deal: Deal }) {
  const { firm } = useWorkspace();
  const { rows, add, update, remove } = useDealRows<DdItem>("deal_dd_items", deal.id, "created_at");
  const [files, setFiles] = useState<FileRow[]>([]);
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState<string>(CATEGORIES[0] ?? "Financial");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("deal_files").select("id, kind, name, path, created_at").eq("deal_id", deal.id).order("created_at", { ascending: false });
      setFiles((data ?? []) as FileRow[]);
    })();
  }, [deal.id]);

  const openFile = async (path: string) => {
    const { data } = await supabase.storage.from("deal-files").createSignedUrl(path, 60 * 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const onFile = async (item: DdItem, file?: File) => {
    if (!file) return;
    const path = `${deal.firmId}/${deal.id}/${Date.now()}-${file.name.replace(/[^\w.-]+/g, "_")}`;
    const up = await supabase.storage.from("deal-files").upload(path, file);
    if (up.error) { toast.error(up.error.message); return; }
    await update(item.id, { received: true, file_path: path });
    setFiles((fs) => [{ id: crypto.randomUUID(), kind: "dd", name: file.name, path, created_at: new Date().toISOString() }, ...fs]);
    toast.success("Filed");
  };

  const attachExisting = async (item: DdItem) => {
    const match = files.find((f) => !f.kind || f.kind !== "dd");
    if (!match) { toast.error("Upload a file to this item first"); return; }
    await update(item.id, { received: true, file_path: match.path });
  };

  const addStandard = async () => {
    for (const t of TEMPLATE) {
      if (rows.some((r) => r.label === t.label)) continue;
      await add({ label: t.label, category: t.category, received: false });
    }
    toast.success("Standard requests added");
  };

  const receivedCount = rows.filter((r) => r.received).length;
  const pctDone = rows.length ? Math.round((receivedCount / rows.length) * 100) : 0;

  return (
    <div className="grid gap-8 xl:grid-cols-[1fr_320px]">
      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-display text-2xl">Diligence tracker</h2>
          <span className="num text-sm text-muted-foreground">{receivedCount} of {rows.length} received{rows.length ? ` · ${pctDone}%` : ""}</span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">The seller's homework list. Check items off as the documents land; everything you upload is stored here for the whole team.</p>
        {deal.canEdit && (
          <div className="mt-4 flex flex-wrap gap-2">
            <form className="flex flex-1 flex-wrap gap-2" onSubmit={async (e) => { e.preventDefault(); if (!label.trim()) return; await add({ label: label.trim(), category, received: false }); setLabel(""); }}>
              <Input className="h-9 min-w-48 flex-1" placeholder="Add a request…" value={label} onChange={(e) => setLabel(e.target.value)} />
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="h-9 rounded-md border bg-card px-2 text-sm">
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
              <Button type="submit" variant="secondary" size="sm">Add</Button>
            </form>
            {rows.length === 0 && <Button variant="outline" size="sm" onClick={addStandard}>Use the standard request list</Button>}
          </div>
        )}
        <div className="mt-4 space-y-6">
          {CATEGORIES.map((c) => {
            const items = rows.filter((r) => r.category === c);
            if (!items.length) return null;
            return (
              <div key={c}>
                <div className="text-[11px] uppercase tracking-widest text-muted-foreground">{c}</div>
                <ul className="mt-2 divide-y rounded-md border bg-card">
                  {items.map((it) => (
                    <li key={it.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                      <label className="flex min-w-0 items-center gap-3">
                        {deal.canEdit && <input type="checkbox" checked={it.received} onChange={(e) => update(it.id, { received: e.target.checked, ...(e.target.checked ? {} : { file_path: null }) })} className="h-4 w-4" />}
                        <span className={it.received ? "text-muted-foreground line-through" : ""}>{it.label}</span>
                      </label>
                      <div className="flex shrink-0 items-center gap-2">
                        {it.filePath && <button className="text-xs underline hover:text-foreground" onClick={() => openFile(it.filePath!)}>Open file</button>}
                        {deal.canEdit && !it.filePath && files.length > 0 && (
                          <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => attachExisting(it)}>Link a file</button>
                        )}
                        {deal.canEdit && (
                          <label className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                            Upload<input type="file" className="hidden" onChange={(e) => { onFile(it, e.target.files?.[0]); e.target.value = ""; }} />
                          </label>
                        )}
                        {deal.canEdit && <button className="text-xs text-muted-foreground hover:text-destructive" onClick={() => remove(it.id)}>Remove</button>}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
          {rows.length === 0 && <p className="rounded-md border bg-card p-6 text-center text-sm text-muted-foreground">Nothing on the list yet — start with the standard request list above.</p>}
        </div>
      </div>
      <aside>
        <h3 className="font-display text-xl">Files</h3>
        <p className="mt-1 text-xs text-muted-foreground">Every document on this deal, including the OM and T-12 you uploaded on step 01.</p>
        <ul className="mt-4 divide-y rounded-md border bg-card text-sm">
          {files.length === 0 && <li className="p-4 text-muted-foreground">No files yet.</li>}
          {files.map((f) => (
            <li key={f.id} className="px-4 py-2.5">
              <button className="truncate text-left hover:underline" onClick={() => openFile(f.path)}>{f.name}</button>
              <div className="text-xs capitalize text-muted-foreground">{f.kind === "om" ? "Broker OM" : f.kind === "t12" ? "T-12" : "Document"} · {f.created_at.slice(0, 10)}</div>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
