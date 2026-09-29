import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDealRows, type DdItem } from "@/lib/deal-tables";
import type { Deal } from "@/lib/deals-store";
import { useServerFn } from "@tanstack/react-start";
import { getSharedFileUrl } from "@/lib/deal-files.functions";
import { SharedWith, ImpactInput } from "./deal-room";

const CATEGORIES = ["Financial", "Physical", "Legal & other", "Title"];
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
  { label: "Pending or threatened litigation", category: "Legal & other" },
  { label: "Title commitment (Schedule B-II review)", category: "Title" },
  { label: "ALTA/NSPS survey", category: "Title" },
  { label: "UCC / lien search", category: "Title" },
  { label: "Closing protection letter", category: "Title" },
  { label: "Payoff letters for existing loans", category: "Title" },
  { label: "Tenant estoppels & SNDAs", category: "Title" },
];

type FileRow = { id: string; kind: string; name: string; path: string; created_at: string; shared_with: string[] };

export function DealVault({ deal }: { deal: Deal }) {
  const { rows, loading, error, reload, add, update, remove } = useDealRows<DdItem>("deal_dd_items", deal.id, "created_at");
  const getFileUrl = useServerFn(getSharedFileUrl);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [filesLoading, setFilesLoading] = useState(true);
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState<string>(CATEGORIES[0] ?? "Financial");
  const [linkingItem, setLinkingItem] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState("");

  useEffect(() => {
    (async () => {
      setFilesLoading(true);
      const { data, error: readError } = await supabase.from("deal_files").select("id, kind, name, path, created_at, shared_with").eq("deal_id", deal.id).order("created_at", { ascending: false });
      if (readError) setFileError(readError.message);
      else { setFiles((data ?? []) as FileRow[]); setFileError(null); }
      setFilesLoading(false);
    })();
  }, [deal.id]);

  const openFile = async (path: string) => {
    // Reserve a tab synchronously so browsers do not block it after the signing request.
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

  const onFile = async (item: DdItem, file?: File) => {
    if (!file) return;
    const path = `${deal.firmId}/${deal.id}/${Date.now()}-${file.name.replace(/[^\w.-]+/g, "_")}`;
    const up = await supabase.storage.from("deal-files").upload(path, file);
    if (up.error) { toast.error(up.error.message); return; }
    const { error: metadataError } = await supabase.from("deal_files").insert({ deal_id: deal.id, kind: "dd", name: file.name, path });
    if (metadataError) { await supabase.storage.from("deal-files").remove([path]); toast.error(metadataError.message); return; }
    await update(item.id, { received: true, file_path: path });
    setFiles((fs) => [{ id: crypto.randomUUID(), kind: "dd", name: file.name, path, created_at: new Date().toISOString(), shared_with: [] }, ...fs]);
    toast.success("Filed");
  };

  const attachExisting = async (item: DdItem) => {
    if (!selectedFile) return;
    await update(item.id, { received: true, file_path: selectedFile });
    setLinkingItem(null);
    setSelectedFile("");
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
                        {deal.canEdit && <ImpactInput value={it.impact} onChange={(v) => update(it.id, { impact: v })} />}
                        {deal.canEdit && <SharedWith value={it.sharedWith ?? []} onChange={(v) => update(it.id, { shared_with: v })} />}
                        {it.filePath && <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => void openFile(it.filePath ?? "")}>Open file</Button>}
                        {deal.canEdit && !it.filePath && files.length > 0 && (
                          linkingItem === it.id ? <span className="flex items-center gap-1">
                            <select aria-label={`File for ${it.label}`} value={selectedFile} onChange={(e) => setSelectedFile(e.target.value)} className="max-w-36 rounded border bg-card px-1 py-1 text-xs">
                              <option value="">Choose file…</option>
                              {files.map((f) => <option key={f.id} value={f.path}>{f.name}</option>)}
                            </select>
                            <Button variant="ghost" size="sm" disabled={!selectedFile} onClick={() => void attachExisting(it)}>Link</Button>
                            <Button variant="ghost" size="sm" onClick={() => { setLinkingItem(null); setSelectedFile(""); }}>Cancel</Button>
                          </span> : <Button variant="link" size="sm" className="h-auto p-0 text-xs text-muted-foreground" onClick={() => { setLinkingItem(it.id); setSelectedFile(""); }}>Link a file</Button>
                        )}
                        {deal.canEdit && (
                          <label className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                            Upload<input type="file" className="hidden" onChange={(e) => { onFile(it, e.target.files?.[0]); e.target.value = ""; }} />
                          </label>
                        )}
                        {deal.canEdit && <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-destructive" onClick={() => remove(it.id)}>Remove</Button>}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
          {loading && <p className="border-t py-6 text-sm text-muted-foreground">Loading requests…</p>}
          {!loading && !error && rows.length === 0 && <p className="border-t py-6 text-sm text-muted-foreground">{deal.canEdit ? "Start with the standard request list above." : "No requests on this deal."}</p>}
          {error && <div role="alert" className="text-sm text-destructive">Couldn't load requests. <Button variant="link" size="sm" onClick={() => void reload()}>Retry</Button></div>}
        </div>
      </div>
      <aside>
        <h3 className="font-display text-xl">Files</h3>
        <ul className="mt-4 divide-y rounded-md border bg-card text-sm">
          {filesLoading && <li className="p-4 text-muted-foreground">Loading files…</li>}
          {fileError && <li role="alert" className="p-4 text-destructive">Couldn't load files. Reopen this deal to retry.</li>}
          {!filesLoading && !fileError && files.length === 0 && <li className="p-4 text-muted-foreground">{deal.canEdit ? "Upload a requested document to add it here." : "No files shared on this deal yet."}</li>}
          {files.map((f) => (
            <li key={f.id} className="px-4 py-2.5">
              <Button variant="link" size="sm" className="h-auto max-w-full truncate p-0 text-left" onClick={() => void openFile(f.path)}>{f.name}</Button>
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground"><span>{f.kind === "om" ? "Broker OM" : f.kind === "t12" ? "T-12" : f.kind === "guest" ? "From outside party" : "Document"} · {f.created_at.slice(0, 10)}</span>
                {deal.canEdit && <SharedWith value={f.shared_with ?? []} onChange={async (v) => { const { error } = await supabase.from("deal_files").update({ shared_with: v }).eq("id", f.id); if (error) { toast.error(error.message); return; } setFiles((fs) => fs.map((x) => x.id === f.id ? { ...x, shared_with: v } : x)); }} />}</div>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
