import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { MODEL_TYPES, applyTemplate, seedModel, type ModelTypeId } from "@/lib/model";
import { useTemplates } from "@/lib/underwrite-templates";
import { analyzeDeal } from "@/lib/model";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { PageHeader, Stat, StageBadge } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useDeals, type Deal } from "@/lib/deals-store";
import { analyze, pct, sumBy, usd } from "@/lib/finance";
import { useTaskStats } from "@/lib/deal-tables";
import { nextDealAction, useDealActions, type ActionTask, type ActionRequest } from "@/lib/deal-actions";
import { useWorkspace } from "@/lib/workspace";
import { PIPELINE_COLUMNS, allStages, daysInStage, isOpen, type ColumnKey } from "@/lib/firm-settings";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { extractFinancials } from "@/lib/ai.functions";
import { ACCEPT, readForAI } from "@/lib/files";
import { extractRows } from "@/lib/underwrite-csv";
import { applyMapped, catalogFor, matchLabel } from "@/lib/model";
import type { DealParts } from "@/lib/deals-store";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Pipeline — Bridgeway" },
      { name: "description", content: "See every deal by stage, filter by property type and market, and spot stalled deals." },
      { property: "og:title", content: "Pipeline — Bridgeway" },
      { property: "og:description", content: "See every deal by stage, filter by property type and market, and spot stalled deals." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Pipeline,
});

function usePref<T>(key: string, init: T) {
  const [v, setV] = useState<T>(init);
  useEffect(() => { const s = localStorage.getItem(key); if (s) try { setV(JSON.parse(s)); } catch { /* ignore */ } }, [key]);
  return [v, (n: T) => { setV(n); localStorage.setItem(key, JSON.stringify(n)); }] as const;
}

function Pipeline() {
  const { deals, update } = useDeals();
  const { settings, user } = useWorkspace();
  const stages = allStages(settings);
  const [tab, setTab] = useState<string>("Active");
  const [view, setView] = usePref<"table" | "board">(`ks:view:${user.id}`, "table");
  const [cols, setCols] = usePref<ColumnKey[]>(`ks:cols:${user.id}`, settings.columns);
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [market, setMarket] = useState("");

  const markets = useMemo(() => [...new Set(deals.map((d) => d.market).filter(Boolean))].sort(), [deals]);
  const types = useMemo(() => [...new Set([...settings.propertyTypes, ...deals.map((d) => d.propertyType)])], [deals, settings.propertyTypes]);
  const filtered = deals.filter((d) =>
    (!q || `${d.name} ${d.address} ${d.market}`.toLowerCase().includes(q.toLowerCase())) &&
    (!type || d.propertyType === type) && (!market || d.market === market));
  const inTab = filtered.filter((d) => tab === "All" ? true : tab === "Active" ? isOpen(d.stage) : d.stage === tab);
  const active = filtered.filter((d) => isOpen(d.stage));
  const stalled = active.filter((d) => daysInStage(d.stageHistory, d.createdAt) >= settings.stallDays);
  const taskStats = useTaskStats(deals.map((d) => d.id));
  const { tasks, requests, error: actionsError } = useDealActions(deals.filter((d) => isOpen(d.stage)));
  const overdueTotal = Object.values(taskStats).reduce((s, x) => s + x.overdue, 0);
  const count = (s: string) => filtered.filter((d) => (s === "All" ? true : s === "Active" ? isOpen(d.stage) : d.stage === s)).length;

  return (
    <div>
      <PageHeader eyebrow="Pipeline" title="Your deals"><NewDeal /></PageHeader>
      <div className="flex flex-wrap gap-y-4 px-6 py-6 md:px-10">
        <Stat label="Active deals" value={String(active.length)} />
        <Stat label="Active volume" value={usd(active.reduce((s, d) => s + d.assumptions.price, 0), true)} />
        <Stat label={`Stalled ${settings.stallDays}+ days`} value={String(stalled.length)} tone={stalled.length ? "warn" : undefined} />
        <Stat label="Overdue tasks" value={String(overdueTotal)} tone={overdueTotal ? "neg" : undefined} />
        <Stat label="Closed" value={String(count("Closed"))} />
        <Stat label="Passed" value={String(count("Passed"))} />
      </div>

      <div className="px-6 md:px-10">
        <div className="flex flex-wrap items-center gap-2">
          <Input placeholder="Search deals" value={q} onChange={(e) => setQ(e.target.value)} className="h-9 w-56" />
          <Sel value={type} onChange={setType} all="All property types" options={types} />
          <Sel value={market} onChange={setMarket} all="All markets" options={markets} />
          <div className="ml-auto flex items-center gap-2">
            {view === "table" && (
              <Popover>
                <PopoverTrigger asChild><Button variant="outline" size="sm">Columns</Button></PopoverTrigger>
                <PopoverContent className="w-56 space-y-1.5 text-sm">
                  {PIPELINE_COLUMNS.map((c) => (
                    <label key={c.key} className="flex items-center gap-2">
                      <input type="checkbox" checked={cols.includes(c.key)} onChange={(e) => setCols(e.target.checked ? PIPELINE_COLUMNS.map((x) => x.key).filter((k) => k === c.key || cols.includes(k)) : cols.filter((k) => k !== c.key))} />
                      {c.label}
                    </label>
                  ))}
                </PopoverContent>
              </Popover>
            )}
            <div className="flex rounded-md border p-0.5 text-sm">
              {(["table", "board"] as const).map((v) => (
                <button key={v} onClick={() => setView(v)} className={`rounded px-3 py-1 capitalize ${view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{v}</button>
              ))}
            </div>
          </div>
        </div>

        {view === "table" && (
          <nav className="mt-5 flex gap-1 overflow-x-auto border-b" role="tablist">
            {["Active", ...stages, "All"].map((s) => (
              <button key={s} role="tab" aria-selected={tab === s} onClick={() => setTab(s)}
                className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm ${tab === s ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                {s} <span className="num ml-1 rounded bg-muted px-1.5 text-xs">{count(s)}</span>
              </button>
            ))}
          </nav>
        )}
      </div>

      <div className="px-6 pb-12 pt-4 md:px-10">
        {actionsError && <p role="alert" className="pb-3 text-xs text-destructive">Deal priorities couldn't be loaded.</p>}
        {view === "table" ? <DealTable deals={inTab} cols={cols} stall={settings.stallDays} taskStats={taskStats} tasks={tasks} requests={requests} /> : <Board deals={filtered} stages={stages} stall={settings.stallDays} taskStats={taskStats} tasks={tasks} requests={requests} onMove={(id, stage) => update(id, { stage })} />}
      </div>
    </div>
  );
}

function Sel({ value, onChange, all, options }: { value: string; onChange: (v: string) => void; all: string; options: string[] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="h-9 rounded-md border bg-card px-2 text-sm">
      <option value="">{all}</option>
      {options.map((o) => <option key={o}>{o}</option>)}
    </select>
  );
}

function metrics(d: Deal) {
  const b = sumBy(d.lines, "broker").noi;
  const r = analyzeDeal(d);
  return { b, r, gap: r.noi - b, days: daysInStage(d.stageHistory, d.createdAt) };
}

function DealTable({ deals, cols, stall, taskStats, tasks, requests }: { deals: Deal[]; cols: ColumnKey[]; stall: number; taskStats: Record<string, { open: number; overdue: number }>; tasks: ActionTask[]; requests: ActionRequest[] }) {
  const shown = PIPELINE_COLUMNS.filter((c) => cols.includes(c.key));
  if (!deals.length) return <p className="border-t py-8 text-center text-sm text-muted-foreground">No deals in this view. Try another stage or start a new deal.</p>;
  return (
    <div className="overflow-x-auto rounded-md border bg-card">
      <table className="w-full text-sm">
        <thead className="border-b text-left text-[11px] uppercase tracking-widest text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Deal</th>
            {shown.map((c) => <th key={c.key} className={`px-4 py-3 font-medium ${["type", "stage"].includes(c.key) ? "" : "text-right"}`}>{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {deals.map((d) => {
            const { b, r, gap, days } = metrics(d);
            const { earliest, missing } = nextDealAction(d.id, tasks, requests);
            const cell: Record<ColumnKey, ReactNode> = {
              type: d.propertyType,
              stage: <StageBadge stage={d.stage} />,
              days: <span className={isOpen(d.stage) && days >= stall ? "text-warning" : ""}>{isOpen(d.stage) ? `${days}d` : "—"}</span>,
              price: usd(d.assumptions.price, true),
              perUnit: usd(d.assumptions.price / (d.assumptions.units || 1), true),
              brokerCap: <span className="text-muted-foreground">{pct(b / d.assumptions.price, 2)}</span>,
              cap: pct(r.capRate, 2),
              gap: <span className={gap < 0 ? "text-destructive" : "text-positive"}>{usd(gap, true)}</span>,
              dscr: <span className={r.dscr < 1.25 ? "text-destructive" : ""}>{r.dscr.toFixed(2)}x</span>,
              irr: <span className={r.irr < d.targetIrr ? "text-warning" : "text-positive"}>{pct(r.irr)}</span>,
              tasks: (() => {
                const s = taskStats[d.id];
                if (!s || !s.open) return <span className="text-muted-foreground">—</span>;
                return s.overdue
                  ? <span className="text-destructive">{s.open} open · {s.overdue} overdue</span>
                  : <span>{s.open} open</span>;
              })(),
              updated: <span className="text-muted-foreground">{d.updatedAt}</span>,
            };
            return (
              <tr key={d.id} className="border-b last:border-0 hover:bg-muted/60">
                <td className="px-4 py-3">
                  <Link to="/deals/$dealId" params={{ dealId: d.id }} className="font-medium hover:underline">{d.name}</Link>
                  <div className="text-xs text-muted-foreground">{d.market} · {d.assumptions.units} units{!d.canEdit && " · shared with you"}</div>
                  {isOpen(d.stage) && (earliest || missing) && <div className="mt-1 text-xs">
                    {earliest && <Link to="/deals/$dealId" params={{ dealId: d.id }} search={{ step: "schedule" }} className={`${earliest.due_date && earliest.due_date < new Date().toLocaleDateString("en-CA") ? "text-destructive" : "text-muted-foreground"} hover:underline`}>{earliest.title} · {earliest.due_date}</Link>}
                    {missing && <Link to="/deals/$dealId" params={{ dealId: d.id }} search={{ step: "vault" }} className="ml-2 text-muted-foreground hover:underline">Awaiting: {missing.label}</Link>}
                  </div>}
                </td>
                {shown.map((c) => <td key={c.key} className={`px-4 py-3 ${["type", "stage"].includes(c.key) ? "" : "num text-right"}`}>{cell[c.key]}</td>)}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Board({ deals, stages, stall, taskStats, tasks, requests, onMove }: { deals: Deal[]; stages: string[]; stall: number; taskStats: Record<string, { open: number; overdue: number }>; tasks: ActionTask[]; requests: ActionRequest[]; onMove: (id: string, stage: string) => void }) {
  const [over, setOver] = useState<string | null>(null);
  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {stages.map((s) => {
        const list = deals.filter((d) => d.stage === s);
        return (
          <div key={s} onDragOver={(e) => { e.preventDefault(); setOver(s); }} onDragLeave={() => setOver(null)}
            onDrop={(e) => { e.preventDefault(); setOver(null); const id = e.dataTransfer.getData("text/plain"); if (id) onMove(id, s); }}
            className={`flex w-64 shrink-0 flex-col rounded-md border p-2 ${over === s ? "bg-accent/40" : "bg-muted/40"}`}>
            <div className="flex items-center justify-between px-1 pb-2 text-xs uppercase tracking-widest text-muted-foreground">
              <span>{s}</span><span className="num">{list.length} · {usd(list.reduce((a, d) => a + d.assumptions.price, 0), true)}</span>
            </div>
            <div className="flex min-h-24 flex-col gap-2">
              {list.map((d) => {
                const { r, days } = metrics(d);
                const { earliest, missing } = nextDealAction(d.id, tasks, requests);
                return (
                  <div key={d.id} draggable={d.canEdit} onDragStart={(e) => e.dataTransfer.setData("text/plain", d.id)}
                    className="cursor-grab rounded border bg-card p-3 text-sm shadow-sm active:cursor-grabbing">
                    <Link to="/deals/$dealId" params={{ dealId: d.id }} className="font-medium hover:underline">{d.name}</Link>
                    <div className="text-xs text-muted-foreground">{d.propertyType} · {d.market}</div>
                    <div className="num mt-2 flex justify-between text-xs">
                      <span>{usd(d.assumptions.price, true)}</span>
                      <span className={r.irr < d.targetIrr ? "text-warning" : "text-positive"}>{pct(r.irr)} IRR</span>
                    </div>
                    {isOpen(s) && <div className={`mt-1 text-xs ${days >= stall ? "text-warning" : "text-muted-foreground"}`}>{days} days in stage{days >= stall ? " · stalled" : ""}</div>}
                    {(() => { const od = taskStats[d.id]?.overdue ?? 0; return od ? <div className="mt-0.5 text-xs text-destructive">{od} overdue task{od > 1 ? "s" : ""}</div> : null; })()}
                    {isOpen(s) && earliest && <Link to="/deals/$dealId" params={{ dealId: d.id }} search={{ step: "schedule" }} className="mt-1 block truncate text-xs text-muted-foreground hover:underline">Next: {earliest.title} · {earliest.due_date}</Link>}
                    {isOpen(s) && missing && <Link to="/deals/$dealId" params={{ dealId: d.id }} search={{ step: "vault" }} className="block truncate text-xs text-muted-foreground hover:underline">Awaiting: {missing.label}</Link>}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function NewDeal() {
  const { create } = useDeals();
  const { settings, firm } = useWorkspace();
  const { templates } = useTemplates();
  const extract = useServerFn(extractFinancials);
  const [files, setFiles] = useState<{ om?: File; t12?: File; uw?: File }>({});
  const [busy, setBusy] = useState("");
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [market, setMarket] = useState("");
  const [type, setType] = useState(settings.propertyTypes[0] ?? "Multifamily");
  const [mode, setMode] = useState<"manual" | "upload">("manual");
  const [modelId, setModelId] = useState<ModelTypeId>("stabilized");
  const [templateId, setTemplateId] = useState("");
  const [members, setMembers] = useState<{ id: string; full_name: string | null; email: string }[]>([]);
  const [team, setTeam] = useState<string[]>([]);
  useEffect(() => {
    void supabase.from("firm_members").select("id, full_name, email").order("created_at").then(({ data }) => setMembers(data ?? []));
  }, []);
  return (
    <Dialog>
      <DialogTrigger asChild><Button>New deal</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle className="font-display text-2xl font-normal">Start a deal</DialogTitle></DialogHeader>
        <form className="space-y-3" onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim()) return;
          const d = settings.defaults;
          const tpl = templates.find((t) => t.id === templateId);
          const seed = seedModel(tpl ? (tpl.modelType as ModelTypeId) : modelId, 24, { ltv: d.ltv, rate: d.rate, amortYears: 30 });
          const model = tpl ? { ...applyTemplate(seed, tpl.config, tpl.modelType), templateId: tpl.id } : seed;
          let prepare: ((p: DealParts) => DealParts) | undefined;
          let skipped = 0;
          if (mode === "upload" && (files.om || files.t12 || files.uw)) {
            try {
              const got: { om?: Awaited<ReturnType<typeof extract>>; t12?: Awaited<ReturnType<typeof extract>> } = {};
              for (const k of ["om", "t12"] as const) {
                const f = files[k];
                if (f) { setBusy(`Reading ${k === "om" ? "broker OM" : "T-12"}…`); got[k] = await extract({ data: { ...(await readForAI(f)), kind: k } }); }
              }
              let uwText = "";
              if (files.uw) { setBusy("Reading underwriting file…"); uwText = /\.(xlsx|xls)$/i.test(files.uw.name) ? (await readForAI(files.uw)).text ?? "" : await files.uw.text(); }
              const uwName = files.uw?.name ?? "";
              prepare = (p) => {
                let lines = p.lines.map((l) => ({ ...l }));
                const a = { ...p.assumptions };
                if (got.om) { lines = lines.map((l) => ({ ...l, broker: got.om!.values[l.key] ?? l.broker })); if (got.om.price) a.price = got.om.price; if (got.om.units) a.units = got.om.units; }
                if (got.t12) { lines = lines.map((l) => ({ ...l, t12: got.t12!.values[l.key] ?? l.t12, underwrite: l.underwrite || (got.t12!.values[l.key] ?? 0) })); if (got.t12.units) a.units = got.t12.units; }
                let out: DealParts = { ...p, lines, assumptions: a };
                if (uwText) {
                  const fields = catalogFor(out.model, !!out.model.type);
                  const { rows, findings } = extractRows(uwText);
                  const mapped = rows.map((r) => { const m = matchLabel(r.label, fields, settings.terms); const sure = m.fieldId && m.confidence !== "close" && m.confidence !== "none"; if (!sure) skipped++; return { ...r, dest: sure ? m.fieldId! : "skip" }; });
                  const { patch } = applyMapped(out, mapped, fields, uwName);
                  out = { ...out, ...patch, adjustments: [...out.adjustments, ...findings] };
                }
                return out;
              };
            } catch (err) { toast.error(err instanceof Error ? err.message : "Couldn't read a file"); setBusy(""); return; }
          }
          setBusy("Creating deal…");
          const id = await create(name.trim(), market.trim(), type, model, team, prepare);
          if (id && firm) {
            for (const [k, f] of Object.entries(files) as ["om" | "t12" | "uw", File | undefined][]) {
              if (!f || mode !== "upload") continue;
              const path = `${firm.id}/${id}/${Date.now()}-${f.name.replace(/[^\w.-]+/g, "_")}`;
              const up = await supabase.storage.from("deal-files").upload(path, f);
              if (!up.error) await supabase.from("deal_files").insert({ deal_id: id, kind: k === "uw" ? "underwriting" : k, name: f.name, path });
            }
            if (skipped) toast.message(`${skipped} underwriting row${skipped === 1 ? "" : "s"} weren't a sure match — upload the file again on the Underwrite step to place them`);
          }
          setBusy("");
          if (id) nav({ to: "/deals/$dealId", params: { dealId: id }, search: { step: mode === "upload" ? "reconcile" : "underwrite" } });
        }}>
          <div className="grid grid-cols-2 gap-2">
            {([["manual", "Enter my own data", "Pick a model and fill it in by hand."], ["upload", "Upload data", "Start from the broker OM, T-12 or an underwriting CSV."]] as const).map(([k, t, b]) => (
              <button key={k} type="button" onClick={() => setMode(k)} aria-pressed={mode === k} className={`rounded border px-3 py-2 text-left text-sm ${mode === k ? "border-primary bg-accent/40" : "hover:border-primary"}`}>
                <div className="font-medium">{t}</div><div className="text-xs text-muted-foreground">{b}</div>
              </button>
            ))}
          </div>
          <Input placeholder="Property name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="Market (e.g. Dayton, OH)" value={market} onChange={(e) => setMarket(e.target.value)} />
          <select value={type} onChange={(e) => setType(e.target.value)} className="h-10 w-full rounded-md border bg-card px-3 text-sm" aria-label="Property type">
            {settings.propertyTypes.map((t) => <option key={t}>{t}</option>)}
          </select>
          <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className="h-10 w-full rounded-md border bg-card px-3 text-sm" aria-label="Template">
            <option value="">No template — choose a model</option>
            {templates.map((t) => <option key={t.id} value={t.id}>Template: {t.name}</option>)}
          </select>
          {!templateId && <select value={modelId} onChange={(e) => setModelId(e.target.value as ModelTypeId)} className="h-10 w-full rounded-md border bg-card px-3 text-sm" aria-label="Underwriting model">
            {MODEL_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>}
          {mode === "upload" && (
            <div className="grid gap-2">
              {([["om", "Broker OM", ACCEPT], ["t12", "T-12", ACCEPT], ["uw", "Underwriting file", ".csv,.txt,.xlsx,.xls"]] as const).map(([k, label, acc]) => (
                <label key={k} className="flex cursor-pointer items-center justify-between gap-2 rounded border border-dashed px-3 py-2 text-sm hover:border-primary">
                  <span>{label}</span>
                  <span className="truncate text-xs text-muted-foreground">{files[k]?.name ?? "Choose file"}</span>
                  <input type="file" accept={acc} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; setFiles((s) => ({ ...s, [k]: f })); e.target.value = ""; }} />
                </label>
              ))}
            </div>
          )}
          {members.length > 0 && (
            <fieldset>
              <legend className="mb-1 text-xs text-muted-foreground">Team on this deal</legend>
              <div className="flex flex-wrap gap-1.5">
                {members.map((m) => {
                  const on = team.includes(m.id);
                  return (
                    <button key={m.id} type="button" aria-pressed={on} onClick={() => setTeam((t) => (on ? t.filter((x) => x !== m.id) : [...t, m.id]))}
                      className={`rounded-full border px-2.5 py-1 text-xs ${on ? "border-primary bg-accent/50" : "text-muted-foreground hover:border-primary"}`}>
                      {m.full_name || m.email}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}
          <Button type="submit" className="w-full" disabled={!!busy}>{busy || (mode === "upload" ? (files.om || files.t12 || files.uw ? "Create and fill from files" : "Create and upload files") : "Create and start underwriting")}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
