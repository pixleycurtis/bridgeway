import { createContext, useContext, useMemo, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Deal } from "@/lib/deals-store";
import { pct, usd, type Assumptions } from "@/lib/finance";
import {
  ALL_TABS, MODEL_TYPES, TAB_LABELS, accountingCheck, applyTemplate, compStats, distribute, modelType, recommendType, runModel, templateConfig, uid, workingCapitalTrack,
  type Comp, type CostItem, type RowPref, type CustomField, type Loan, type LoanKind, type Model, type ModelTypeId, type OpexItem, type TabId, type Unit,
} from "@/lib/model";
import { useTemplates } from "@/lib/underwrite-templates";
import { recommendModel } from "@/lib/ai.functions";
import { UnderwriteImport } from "@/components/underwrite-import";
import { LenderQuotes } from "@/components/lender-quotes";

type SetDeal = (p: Partial<Deal>) => void;

/* ---------- small inputs ---------- */
const N = ({ value, onChange, className = "", step }: { value: number; onChange: (n: number) => void; className?: string; step?: number }) => (
  <input type="number" step={step ?? "any"} value={Number.isFinite(value) ? +value.toFixed(4) : 0} onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
    className={`num w-full rounded border border-transparent bg-transparent px-2 py-1 text-right hover:border-input focus:border-ring focus:bg-card focus:outline-none ${className}`} />
);
const P = ({ value, onChange }: { value: number; onChange: (n: number) => void }) => (
  <span className="flex items-center"><N value={+(value * 100).toFixed(4)} onChange={(v) => onChange(v / 100)} /><span className="text-muted-foreground">%</span></span>
);
const T = ({ value, onChange, placeholder }: { value: string; onChange: (s: string) => void; placeholder?: string }) => (
  <input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="w-full rounded border border-transparent bg-transparent px-2 py-1 hover:border-input focus:border-ring focus:bg-card focus:outline-none" />
);
const Sel = <V extends string>({ value, onChange, options }: { value: V; onChange: (v: V) => void; options: [V, string][] }) => (
  <select value={value} onChange={(e) => onChange(e.target.value as V)} className="rounded border bg-card px-2 py-1 text-sm">{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
);
/* Row preferences (rename, hide, note) and import sources, shared by every tab. */
const RowCtx = createContext<{ m: Model; editing: boolean; setPref: (id: string, p: RowPref) => void } | null>(null);
const SourceDot = ({ id }: { id: string }) => {
  const src = useContext(RowCtx)?.m.sources?.[id];
  return src ? <span title={`Filled from ${src}`} className="ml-1 cursor-help text-xs text-primary">●</span> : null;
};
const Row = ({ id, label, children, extra }: { id?: string; label: string; children: React.ReactNode; extra?: React.ReactNode }) => {
  const c = useContext(RowCtx);
  const key = id ?? `r.${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const pref = c?.m.layout?.[key];
  if (pref?.hidden && !c?.editing) return null;
  if (c?.editing) return (
    <div className={`flex items-center gap-2 px-4 py-1.5 text-sm ${pref?.hidden ? "opacity-50" : ""}`}>
      {extra}
      <input value={pref?.label ?? ""} placeholder={label} onChange={(e) => c.setPref(key, { label: e.target.value || undefined })} className="min-w-0 flex-1 rounded border bg-card px-2 py-1" aria-label={`Rename ${label}`} />
      <input value={pref?.note ?? ""} placeholder="Note" onChange={(e) => c.setPref(key, { note: e.target.value || undefined })} className="w-28 rounded border bg-card px-2 py-1 text-xs" />
      <label className="flex items-center gap-1 text-xs text-muted-foreground"><input type="checkbox" checked={!pref?.hidden} onChange={(e) => c.setPref(key, { hidden: !e.target.checked || undefined })} />Show</label>
      <span className="w-40 shrink-0">{children}</span>
    </div>
  );
  return (
    <label className="flex items-center justify-between gap-3 px-4 py-1.5 text-sm">
      <span>{pref?.label || label}<SourceDot id={key} />{pref?.note && <span className="block text-xs text-muted-foreground">{pref.note}</span>}</span>
      <span className="w-40 shrink-0">{children}</span>
    </label>
  );
};
const Move = ({ onUp, onDown }: { onUp: () => void; onDown: () => void }) => (
  <span className="flex flex-col leading-none text-muted-foreground"><button type="button" onClick={onUp} aria-label="Move up" className="hover:text-foreground">▲</button><button type="button" onClick={onDown} aria-label="Move down" className="hover:text-foreground">▼</button></span>
);
function moveIn<T>(xs: T[], i: number, d: number): T[] { const j = i + d; if (j < 0 || j >= xs.length) return xs; const c = [...xs]; [c[i], c[j]] = [c[j]!, c[i]!]; return c; }
const Card = ({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) => (
  <section className="space-y-2"><div className="flex items-center justify-between"><h3 className="text-[11px] uppercase tracking-widest text-muted-foreground">{title}</h3>{action}</div><div className="rounded-md border bg-card">{children}</div></section>
);
const Metrics = ({ items }: { items: [string, string, string?][] }) => (
  <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border bg-border md:grid-cols-4">
    {items.map(([k, v, tone]) => <div key={k} className="bg-card p-3"><div className="text-xs text-muted-foreground">{k}</div><div className={`num mt-1 text-lg ${tone ?? ""}`}>{v}</div></div>)}
  </div>
);
const Del = ({ onClick }: { onClick: () => void }) => <button type="button" onClick={onClick} className="px-2 text-muted-foreground hover:text-destructive" aria-label="Remove">×</button>;
const Th = ({ children, left }: { children?: React.ReactNode; left?: boolean }) => <th className={`px-2 py-2 font-medium ${left ? "text-left" : "text-right"}`}>{children}</th>;

/* ---------- workspace ---------- */
export function UnderwriteModel({ deal, set, onNext }: { deal: Deal; set: SetDeal; onNext: () => void }) {
  const m = deal.model;
  const a = deal.assumptions;
  const setM = (p: Partial<Model>) => set({ model: { ...m, ...p } });
  const setA = (p: Partial<Assumptions>) => set({ assumptions: { ...a, ...p } });
  const r = useMemo(() => runModel(deal.lines, a, m, deal.adjustments), [deal.lines, a, m, deal.adjustments]);
  const tabs = ALL_TABS.filter((t) => !(m.hiddenTabs ?? []).includes(t));
  const [tab, setTab] = useState<TabId>(tabs[0] ?? "summary");
  const current = tabs.includes(tab) ? tab : "summary";
  const [editing, setEditing] = useState(false);
  const setPref = (id: string, p: RowPref) => {
    const next = { ...(m.layout?.[id] ?? {}), ...p };
    (Object.keys(next) as (keyof RowPref)[]).forEach((k) => next[k] === undefined && delete next[k]);
    setM({ layout: { ...(m.layout ?? {}), [id]: next } });
  };

  return (
    <RowCtx.Provider value={{ m, editing, setPref }}>
    <div className="space-y-6">
      <ModelBar deal={deal} set={set} />
      <div className="grid gap-px overflow-hidden rounded-md border bg-border sm:grid-cols-3 lg:grid-cols-6">
        {[["Year-1 NOI", usd(r.noi)], ["Cap rate", pct(r.capRate, 2)], ["DSCR Y1", r.dscr.toFixed(2) + "x"], ["Equity", usd(r.equity, true)], ["Levered IRR", pct(r.irr)], ["Multiple", r.equityMultiple.toFixed(2) + "x"]].map(([k, v]) => (
          <div key={k} className="bg-card px-3 py-2"><div className="text-[11px] text-muted-foreground">{k}</div><div className="num">{v}</div></div>
        ))}
      </div>
      <nav className="flex flex-wrap gap-1 border-b">
        {tabs.map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className={`-mb-px border-b-2 px-3 py-2 text-sm ${current === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>{TAB_LABELS[t]}</button>
        ))}
        {deal.canEdit !== false && <button type="button" onClick={() => setEditing((e) => !e)} className={`ml-auto px-3 py-2 text-sm ${editing ? "font-medium text-primary" : "text-muted-foreground hover:text-foreground"}`}>{editing ? "Done customizing" : "Customize rows"}</button>}
      </nav>
      {editing && <p className="-mt-3 text-xs text-muted-foreground">Rename any row, add a note, hide rows you don't use, and reorder building rows and line items. Labels are display only — the math is unchanged. Saved with templates.</p>}
      {current === "building" && <BuildingTab deal={deal} setM={setM} setA={setA} set={set} />}
      {current === "rentroll" && <RentRollTab deal={deal} setM={setM} />}
      {current === "opex" && <OpexTab deal={deal} setM={setM} r={r} />}
      {current === "closing" && <ClosingTab deal={deal} setM={setM} r={r} />}
      {current === "financing" && <div className="space-y-8"><FinancingTab deal={deal} setM={setM} r={r} /><LenderQuotes deal={deal} /></div>}
      {current === "cashflow" && <CashFlowTab r={r} />}
      {current === "waterfall" && <WaterfallTab deal={deal} setM={setM} r={r} />}
      {current === "wc" && <WorkingCapitalTab deal={deal} setM={setM} r={r} />}
      {current === "comps" && <CompsTab deal={deal} setM={setM} r={r} />}
      {current === "accounting" && <AccountingTab deal={deal} setM={setM} />}
      {current === "custom" && <CustomTab deal={deal} setM={setM} />}
      {current === "summary" && <SummaryTab deal={deal} r={r} onNext={onNext} />}
    </div>
    </RowCtx.Provider>
  );
}

type R = ReturnType<typeof runModel>;
type TabProps = { deal: Deal; setM: (p: Partial<Model>) => void };

/* ---------- model type, templates, recommendation ---------- */
function ModelBar({ deal, set }: { deal: Deal; set: SetDeal }) {
  const m = deal.model;
  const { templates, save, remove } = useTemplates();
  const ask = useServerFn(recommendModel);
  const [rec, setRec] = useState<{ id: ModelTypeId; reason: string; ai?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [showTabs, setShowTabs] = useState(false);
  const switchType = (id: ModelTypeId) => {
    const t = modelType(id);
    set({ model: { ...m, type: id, hiddenTabs: t.hiddenTabs, loan: { ...m.loan!, ...t.loan } }, ...(t.holdYears ? { assumptions: { ...deal.assumptions, holdYears: t.holdYears } } : {}) });
    toast.success(`Switched to ${t.label}`);
  };
  const recommend = async () => {
    const units = m.units ?? [];
    const occ = units.length ? units.filter((u) => u.status === "occupied").length / units.length : null;
    const inPlace = units.reduce((s, u) => s + u.rent, 0), mkt = units.reduce((s, u) => s + (u.market || u.rent), 0);
    const cs = compStats(m.comps ?? [], deal.assumptions.units);
    const base = recommendType({ propertyType: deal.propertyType, units: units.length || deal.assumptions.units, occupancy: occ, rentGap: mkt ? 1 - inPlace / mkt : 0, renoBudget: (m.budget ?? []).reduce((s, b) => s + b.budget, 0), holdYears: deal.assumptions.holdYears });
    setRec(base);
    setBusy(true);
    try {
      const facts = [`Property type: ${deal.propertyType}`, `Market: ${deal.market}`, `Price: ${usd(deal.assumptions.price)}`, `Units: ${units.length || deal.assumptions.units}`,
        occ != null ? `Occupancy: ${pct(occ)}` : "", mkt ? `In-place vs market rent: ${usd(inPlace)} vs ${usd(mkt)} per month` : "",
        ...Object.entries(m.building ?? {}).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`),
        cs.count ? `Comps: avg ${usd(cs.perUnit)}/unit, avg cap ${pct(cs.cap, 2)}, avg rent ${usd(cs.rent)}` : "",
        `Hold: ${deal.assumptions.holdYears} yrs`, `Target IRR: ${pct(deal.targetIrr)}`].filter(Boolean).join("\n");
      const { text } = await ask({ data: { facts, options: MODEL_TYPES.map((t) => `${t.label} — ${t.blurb}`).join("\n"), ruleBased: `${modelType(base.id).label}: ${base.reason}` } });
      const hit = MODEL_TYPES.find((t) => text.split("\n")[0]?.includes(t.label));
      setRec({ id: hit?.id ?? base.id, reason: base.reason, ai: text });
    } catch { toast.error("Couldn't reach the AI — showing the rule-based pick"); }
    finally { setBusy(false); }
  };
  return (
    <div className="space-y-3 rounded-md border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Model</span>
        <Sel value={m.type ?? "stabilized"} onChange={switchType} options={MODEL_TYPES.map((t) => [t.id, t.label])} />
        <Button size="sm" variant="outline" onClick={() => void recommend()} disabled={busy}>{busy ? "Thinking…" : "Recommend a model"}</Button>
        <span className="mx-2 h-5 w-px bg-border" />
        <span className="text-muted-foreground">Template</span>
        <select value="" onChange={(e) => { const t = templates.find((x) => x.id === e.target.value); if (t) { set({ model: { ...applyTemplate(m, t.config, t.modelType), templateId: t.id } }); toast.success(`Applied "${t.name}"`); } }} className="rounded border bg-card px-2 py-1 text-sm">
          <option value="">{templates.find((t) => t.id === m.templateId)?.name ?? (templates.length ? "Apply a template…" : "No templates yet")}</option>
          {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <Button size="sm" variant="outline" onClick={() => { const n = window.prompt("Template name", `${modelType(m.type).label} — ${deal.market || "firm standard"}`); if (n?.trim()) void save(n.trim(), m.type ?? "stabilized", templateConfig(m)); }}>Save as template</Button>
        {m.templateId && templates.some((t) => t.id === m.templateId) && <Button size="sm" variant="ghost" onClick={() => { if (window.confirm("Delete this template for the whole firm?")) { void remove(m.templateId!); set({ model: { ...m, templateId: null } }); } }}>Delete template</Button>}
        <Button size="sm" variant="ghost" onClick={() => setShowTabs((s) => !s)}>Sections</Button>
        <div className="ml-auto w-64"><UnderwriteImport deal={deal} set={set} /></div>
      </div>
      {showTabs && (
        <div className="flex flex-wrap gap-3 border-t pt-3 text-xs">
          {ALL_TABS.filter((t) => t !== "summary").map((t) => (
            <label key={t} className="flex items-center gap-1"><input type="checkbox" checked={!(m.hiddenTabs ?? []).includes(t)}
              onChange={(e) => set({ model: { ...m, hiddenTabs: e.target.checked ? (m.hiddenTabs ?? []).filter((x) => x !== t) : [...(m.hiddenTabs ?? []), t] } })} />{TAB_LABELS[t]}</label>
          ))}
          <span className="text-muted-foreground">Saved with templates.</span>
        </div>
      )}
      {rec && (
        <div className="space-y-2 border-t pt-3 text-sm">
          <div><span className="font-medium">Recommended: {modelType(rec.id).label}.</span> <span className="text-muted-foreground">{rec.reason}</span></div>
          {rec.ai && <p className="whitespace-pre-wrap text-muted-foreground">{rec.ai}</p>}
          <div className="flex gap-2">{rec.id !== m.type && <Button size="sm" onClick={() => { switchType(rec.id); setRec(null); }}>Use {modelType(rec.id).label}</Button>}<Button size="sm" variant="ghost" onClick={() => setRec(null)}>Dismiss</Button></div>
        </div>
      )}
    </div>
  );
}

/* ---------- building ---------- */
const BUILDING: [string, string][] = [["yearBuilt", "Year built"], ["renovated", "Last renovated"], ["buildingSf", "Building SF"], ["lotAcres", "Lot (acres)"], ["stories", "Stories / buildings"],
  ["construction", "Construction"], ["roof", "Roof type & age"], ["hvac", "HVAC type & age"], ["plumbing", "Plumbing / electrical"], ["parking", "Parking spaces"],
  ["zoning", "Zoning"], ["parcel", "Tax parcel"], ["assessed", "Assessed value"], ["millage", "Tax rate (%)"], ["unitMix", "Unit mix"], ["amenities", "Amenities"], ["utilities", "Utility billing (RUBS, sub-metered…)"], ["flood", "Flood zone"]];
function BuildingTab({ deal, setM, setA, set }: TabProps & { setA: (p: Partial<Assumptions>) => void; set: SetDeal }) {
  const b = deal.model.building ?? {};
  const a = deal.assumptions;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card title="Building info">
        <div className="divide-y">{BUILDING.map(([k, l]) => <Row key={k} label={l}><T value={b[k] ?? ""} onChange={(v) => setM({ building: { ...b, [k]: v } })} /></Row>)}</div>
      </Card>
      <div className="space-y-6">
        <Card title="Deal terms"><div className="divide-y">
          <Row id="a.price" label="Purchase price"><N value={a.price} onChange={(v) => setA({ price: v })} /></Row>
          <Row id="a.units" label="Units / keys"><N value={a.units} onChange={(v) => setA({ units: v })} /></Row>
          <Row id="a.capex" label="Upfront capex"><N value={a.capex} onChange={(v) => setA({ capex: v })} /></Row>
          <Row id="targetIrr" label="Target IRR"><P value={deal.targetIrr} onChange={(v) => set({ targetIrr: v })} /></Row>
        </div></Card>
        <Card title="Growth, hold & exit"><div className="divide-y">
          <Row id="a.rentGrowth" label="Rent growth / yr"><P value={a.rentGrowth} onChange={(v) => setA({ rentGrowth: v })} /></Row>
          <Row id="a.expenseGrowth" label="Expense growth / yr (default)"><P value={a.expenseGrowth} onChange={(v) => setA({ expenseGrowth: v })} /></Row>
          <Row id="a.holdYears" label="Hold (years)"><N value={a.holdYears} step={0.5} onChange={(v) => setA({ holdYears: Math.max(0.5, v) })} /></Row>
          <Row id="a.exitCap" label="Exit cap rate"><P value={a.exitCap} onChange={(v) => setA({ exitCap: v })} /></Row>
          <Row id="a.sellPct" label="Selling costs"><P value={a.sellPct} onChange={(v) => setA({ sellPct: v })} /></Row>
        </div></Card>
        {a.units > 0 && <p className="text-xs text-muted-foreground">Price per unit {usd(a.price / a.units)}{b["buildingSf"] ? ` · ${usd(a.price / (parseFloat(b["buildingSf"].replace(/,/g, "")) || 1))}/SF` : ""}</p>}
      </div>
    </div>
  );
}

/* ---------- rent roll ---------- */
function RentRollTab({ deal, setM }: TabProps) {
  const m = deal.model;
  const units = m.units ?? [];
  const t = m.turnover ?? { rate: 0.4, downMonths: 1, makeReady: 1500, premium: 0 };
  const [paste, setPaste] = useState("");
  const setU = (id: string, p: Partial<Unit>) => setM({ units: units.map((u) => (u.id === id ? { ...u, ...p } : u)) });
  const blank = (i: number): Unit => ({ id: uid(), label: String(101 + i), type: "1BR", sf: 0, rent: 0, market: 0, leaseEnd: "", status: "occupied" });
  const inPlace = units.reduce((s, u) => s + (u.status === "occupied" ? u.rent : 0), 0), market = units.reduce((s, u) => s + (u.market || u.rent), 0);
  const importPaste = () => {
    const rows = paste.split(/\r?\n/).map((l) => l.split(/,|\t/).map((c) => c.trim())).filter((c) => c[0] && !/unit/i.test(c[0]!));
    const n = (s?: string) => parseFloat((s ?? "").replace(/[$,]/g, "")) || 0;
    setM({ units: [...units, ...rows.map((c) => ({ id: uid(), label: c[0]!, type: c[1] ?? "", sf: n(c[2]), rent: n(c[3]), market: n(c[4]) || n(c[3]), leaseEnd: c[5] ?? "", status: (n(c[3]) ? "occupied" : "vacant") as Unit["status"] }))] });
    setPaste(""); toast.success(`Added ${rows.length} units`);
  };
  return (
    <div className="space-y-6">
      <Metrics items={[["Units", String(units.length)], ["Occupied", units.length ? pct(units.filter((u) => u.status === "occupied").length / units.length) : "—"],
        ["In-place rent / mo", usd(inPlace)], ["Loss to lease", market ? pct(1 - inPlace / market) : "—"]]} />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card title="Unit-by-unit" action={<div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setM({ units: [...units, blank(units.length)] })}>Add unit</Button>
          {!units.length && deal.assumptions.units > 0 && <Button size="sm" variant="outline" onClick={() => setM({ units: Array.from({ length: deal.assumptions.units }, (_, i) => blank(i)) })}>Create {deal.assumptions.units} units</Button>}
        </div>}>
          <div className="max-h-[520px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 border-b bg-card text-xs text-muted-foreground"><tr><Th left>Unit</Th><Th left>Type</Th><Th>SF</Th><Th>Rent / mo</Th><Th>Market / mo</Th><Th left>Lease end</Th><Th left>Status</Th><Th /></tr></thead>
              <tbody>{units.map((u) => (
                <tr key={u.id} className="border-b last:border-0">
                  <td className="w-20"><T value={u.label} onChange={(v) => setU(u.id, { label: v })} /></td>
                  <td className="w-24"><T value={u.type} onChange={(v) => setU(u.id, { type: v })} /></td>
                  <td className="w-20"><N value={u.sf} onChange={(v) => setU(u.id, { sf: v })} /></td>
                  <td className="w-28"><N value={u.rent} onChange={(v) => setU(u.id, { rent: v })} /></td>
                  <td className="w-28"><N value={u.market} onChange={(v) => setU(u.id, { market: v })} /></td>
                  <td className="w-32"><input type="date" value={u.leaseEnd} onChange={(e) => setU(u.id, { leaseEnd: e.target.value })} className="bg-transparent px-2 text-sm" /></td>
                  <td><Sel value={u.status} onChange={(v) => setU(u.id, { status: v })} options={[["occupied", "Occupied"], ["vacant", "Vacant"], ["down", "Down"]]} /></td>
                  <td><Del onClick={() => setM({ units: units.filter((x) => x.id !== u.id) })} /></td>
                </tr>
              ))}</tbody>
            </table>
            {!units.length && <p className="p-4 text-sm text-muted-foreground">No units yet. Without a rent roll, revenue comes from the underwritten rent line.</p>}
          </div>
        </Card>
        <div className="space-y-6">
          <Card title="Turnover & vacancy"><div className="divide-y">
            <Row label="Annual turnover"><P value={t.rate} onChange={(v) => setM({ turnover: { ...t, rate: v } })} /></Row>
            <Row label="Months vacant per turn"><N value={t.downMonths} onChange={(v) => setM({ turnover: { ...t, downMonths: v } })} /></Row>
            <Row label="Make-ready per turn"><N value={t.makeReady} onChange={(v) => setM({ turnover: { ...t, makeReady: v } })} /></Row>
            <Row label="Renovation premium / mo"><N value={t.premium} onChange={(v) => setM({ turnover: { ...t, premium: v } })} /></Row>
            <Row label="General vacancy & credit loss"><P value={m.vacancyPct ?? 0} onChange={(v) => setM({ vacancyPct: v })} /></Row>
          </div></Card>
          <p className="text-xs text-muted-foreground">Each month, rents move toward market (plus premium) at the turnover pace, and turned units lose rent for their downtime. Market rents grow at the rent-growth rate.</p>
          <Card title="Paste a rent roll">
            <div className="space-y-2 p-3">
              <Textarea rows={4} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="Unit, Type, SF, Rent, Market, Lease end" className="text-xs" />
              <Button size="sm" variant="outline" disabled={!paste.trim()} onClick={importPaste}>Add rows</Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ---------- operating expenses ---------- */
function OpexTab({ deal, setM, r }: TabProps & { r: R }) {
  const items = deal.model.opex ?? [];
  const units = deal.model.units?.length || deal.assumptions.units;
  const egi = r.annual[0]?.egi ?? 0;
  const setO = (id: string, p: Partial<OpexItem>) => setM({ opex: items.map((o) => (o.id === id ? { ...o, ...p } : o)) });
  const yr1 = (o: OpexItem) => (o.basis === "pctRevenue" ? o.amount * egi : o.basis === "perUnit" ? o.amount * units : o.amount);
  const b = deal.model.building ?? {};
  const [mill, setMill] = useState(b["millage"] ?? "1.2");
  const total = items.reduce((s, o) => s + yr1(o), 0);
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <Card title="Operating expenses" action={<Button size="sm" variant="outline" onClick={() => setM({ opex: [...items, { id: uid(), label: "New expense", basis: "fixed", amount: 0, growth: deal.assumptions.expenseGrowth }] })}>Add line</Button>}>
        <table className="w-full text-sm">
          <thead className="border-b text-xs text-muted-foreground"><tr><Th left>Expense</Th><Th left>Basis</Th><Th>Amount</Th><Th>Growth</Th><Th>Year 1</Th><Th>Monthly</Th><Th>Per unit</Th><Th /></tr></thead>
          <tbody>{items.map((o) => (
            <tr key={o.id} className="border-b">
              <td><T value={o.label} onChange={(v) => setO(o.id, { label: v })} /></td>
              <td><Sel value={o.basis} onChange={(v) => setO(o.id, { basis: v })} options={[["fixed", "$ / year"], ["perUnit", "$ / unit / yr"], ["pctRevenue", "% of revenue"]]} /></td>
              <td className="w-28">{o.basis === "pctRevenue" ? <P value={o.amount} onChange={(v) => setO(o.id, { amount: v })} /> : <N value={o.amount} onChange={(v) => setO(o.id, { amount: v })} />}</td>
              <td className="w-24"><P value={o.growth} onChange={(v) => setO(o.id, { growth: v })} /></td>
              <td className="num px-2 text-right">{usd(yr1(o))}</td>
              <td className="num px-2 text-right text-muted-foreground">{usd(yr1(o) / 12)}</td>
              <td className="num px-2 text-right text-muted-foreground">{units ? usd(yr1(o) / units) : "—"}</td>
              <td><Del onClick={() => setM({ opex: items.filter((x) => x.id !== o.id) })} /></td>
            </tr>
          ))}</tbody>
          <tfoot><tr className="font-medium"><td className="px-2 py-2" colSpan={4}>Total (excl. turnover costs)</td><td className="num px-2 text-right">{usd(total)}</td><td className="num px-2 text-right">{usd(total / 12)}</td><td className="num px-2 text-right">{units ? usd(total / units) : "—"}</td><td /></tr></tfoot>
        </table>
        <p className="px-3 pb-3 text-xs text-muted-foreground">Expense ratio {egi ? pct(total / egi) : "—"} of effective gross income.</p>
      </Card>
      <Card title="Tax reassessment">
        <div className="space-y-2 p-3 text-sm">
          <p className="text-muted-foreground">Many counties reassess at sale. Taxes = purchase price × tax rate.</p>
          <label className="flex items-center justify-between">Tax rate (%)<input value={mill} onChange={(e) => setMill(e.target.value)} className="num w-20 rounded border bg-card px-2 py-1 text-right" /></label>
          <div className="num">{usd(deal.assumptions.price * (parseFloat(mill) || 0) / 100)} / yr</div>
          <Button size="sm" variant="outline" onClick={() => {
            const amt = Math.round(deal.assumptions.price * (parseFloat(mill) || 0) / 100);
            const hit = items.find((o) => /tax/i.test(o.label));
            setM({ building: { ...b, millage: mill }, opex: hit ? items.map((o) => (o === hit ? { ...o, basis: "fixed", amount: amt } : o)) : [...items, { id: uid(), label: "Real estate taxes", basis: "fixed", amount: amt, growth: 0.02 }] });
          }}>Use for taxes</Button>
        </div>
      </Card>
      <div className="lg:col-span-2"><OpexMonthly items={items} units={units} r={r} /></div>
    </div>
  );
}

function OpexMonthly({ items, units, r }: { items: OpexItem[]; units: number; r: R }) {
  const [view, setView] = useState<"monthly" | "annual">("monthly");
  const months = r.monthly;
  const amt = (o: OpexItem, m: (typeof months)[number]) =>
    o.basis === "pctRevenue" ? o.amount * m.egi : ((o.basis === "perUnit" ? o.amount * units : o.amount) / 12) * Math.pow(1 + o.growth, (m.m - 1) / 12);
  const cols = view === "monthly"
    ? months.map((m) => ({ label: `M${m.m}`, ms: [m] }))
    : Array.from({ length: Math.ceil(months.length / 12) }, (_, y) => ({ label: `Yr ${y + 1}`, ms: months.slice(y * 12, y * 12 + 12) }));
  const val = (o: OpexItem, ms: typeof months) => ms.reduce((s, m) => s + amt(o, m), 0);
  return (
    <Card title="Operating expenses by month" action={<Sel value={view} onChange={setView} options={[["monthly", "Monthly"], ["annual", "Annual"]]} />}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b text-xs text-muted-foreground"><tr><Th left>Expense</Th>{cols.map((c) => <Th key={c.label}>{c.label}</Th>)}</tr></thead>
          <tbody>
            {items.map((o) => (
              <tr key={o.id} className="border-b">
                <td className="sticky left-0 whitespace-nowrap bg-card px-2 py-1">{o.label}</td>
                {cols.map((c) => <td key={c.label} className="num whitespace-nowrap px-2 text-right">{usd(val(o, c.ms), view === "annual")}</td>)}
              </tr>
            ))}
            <tr className="border-b text-muted-foreground">
              <td className="sticky left-0 whitespace-nowrap bg-card px-2 py-1">Turnover, custom & findings</td>
              {cols.map((c) => <td key={c.label} className="num whitespace-nowrap px-2 text-right">{usd(c.ms.reduce((s, m) => s + m.opex, 0) - items.reduce((s, o) => s + val(o, c.ms), 0), view === "annual")}</td>)}
            </tr>
            <tr className="font-medium">
              <td className="sticky left-0 whitespace-nowrap bg-card px-2 py-1">Total operating expenses</td>
              {cols.map((c) => <td key={c.label} className="num whitespace-nowrap px-2 text-right">{usd(c.ms.reduce((s, m) => s + m.opex, 0), view === "annual")}</td>)}
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ---------- closing costs ---------- */
function ClosingTab({ deal, setM, r }: TabProps & { r: R }) {
  const items = deal.model.closing ?? [];
  const price = deal.assumptions.price, loan = r.loan;
  const setC = (id: string, p: Partial<CostItem>) => setM({ closing: items.map((c) => (c.id === id ? { ...c, ...p } : c)) });
  const amt = (c: CostItem) => (c.basis === "fixed" ? c.amount : c.basis === "pctPrice" ? c.amount * price : c.amount * loan);
  return (
    <div className="space-y-6">
      <Metrics items={[["Closing costs", usd(r.closingCosts)], ["% of price", pct(r.closingCosts / price, 2)], ["Lender points & fees", usd(r.lenderFees)], ["Total equity required", usd(r.equity)]]} />
      <Card title="Closing cost items" action={<Button size="sm" variant="outline" onClick={() => setM({ closing: [...items, { id: uid(), label: "New cost", basis: "fixed", amount: 0 }] })}>Add item</Button>}>
        <table className="w-full text-sm">
          <thead className="border-b text-xs text-muted-foreground"><tr><Th left>Item</Th><Th left>Basis</Th><Th>Amount</Th><Th>Total</Th><Th /></tr></thead>
          <tbody>{items.map((c) => (
            <tr key={c.id} className="border-b">
              <td><T value={c.label} onChange={(v) => setC(c.id, { label: v })} /></td>
              <td><Sel value={c.basis} onChange={(v) => setC(c.id, { basis: v })} options={[["fixed", "Fixed $"], ["pctPrice", "% of price"], ["pctLoan", "% of loan"]]} /></td>
              <td className="w-32">{c.basis === "fixed" ? <N value={c.amount} onChange={(v) => setC(c.id, { amount: v })} /> : <P value={c.amount} onChange={(v) => setC(c.id, { amount: v })} />}</td>
              <td className="num px-2 text-right">{usd(amt(c))}</td>
              <td><Del onClick={() => setM({ closing: items.filter((x) => x.id !== c.id) })} /></td>
            </tr>
          ))}</tbody>
        </table>
        <p className="px-3 pb-3 pt-2 text-xs text-muted-foreground">Lender points and extension fees are set on the Financing tab and added on top.</p>
      </Card>
    </div>
  );
}

/* ---------- financing ---------- */
const KINDS: [LoanKind, string][] = [["amortizing", "Amortizing (with optional IO period)"], ["io", "Full interest-only"], ["bridge", "Bridge loan"], ["hardmoney", "Hard money"]];
function FinancingTab({ deal, setM, r }: TabProps & { r: R }) {
  const l = deal.model.loan!;
  const setL = (p: Partial<Loan>) => setM({ loan: { ...l, ...p } });
  const refi = l.refi;
  const [view, setView] = useState<"annual" | "monthly">("annual");
  return (
    <div className="space-y-6">
      <Metrics items={[["Loan", usd(r.loan)], ["Debt service / yr", usd(r.debtService)], ["Debt service / mo", usd(r.debtService / 12)], ["DSCR Y1", r.dscr.toFixed(2) + "x", r.dscr < l.dscrTarget ? "text-destructive" : ""],
        ["Lowest DSCR", r.minDscr.toFixed(2) + "x", r.minDscr < l.dscrTarget ? "text-destructive" : ""], ["Debt yield", pct(r.debtYield)], [`Max loan at ${l.dscrTarget}x`, usd(r.maxLoanDscr)], ["Lender fees", usd(r.lenderFees)]]} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Loan structure"><div className="divide-y">
          <Row id="loan.kind" label="Structure"><Sel value={l.kind} onChange={(v) => setL({ kind: v })} options={KINDS} /></Row>
          <Row id="loan.ltv" label="LTV"><P value={l.ltv} onChange={(v) => setL({ ltv: v })} /></Row>
          <Row id="loan.rate" label="Interest rate"><P value={l.rate} onChange={(v) => setL({ rate: v })} /></Row>
          {(l.kind === "amortizing") && <Row id="loan.ioMonths" label="Interest-only months"><N value={l.ioMonths} onChange={(v) => setL({ ioMonths: v })} /></Row>}
          {(l.kind === "amortizing" || l.kind === "io") && <Row id="loan.amortYears" label="Amortization (yrs)"><N value={l.amortYears} onChange={(v) => setL({ amortYears: v })} /></Row>}
          <Row id="loan.termMonths" label="Term (months)"><N value={l.termMonths} onChange={(v) => setL({ termMonths: v })} /></Row>
          <Row id="loan.points" label="Origination points"><P value={l.points} onChange={(v) => setL({ points: v })} /></Row>
          {(l.kind === "bridge" || l.kind === "hardmoney") && <Row id="loan.futureFunding" label="Future funding (capex)"><N value={l.futureFunding} onChange={(v) => setL({ futureFunding: v })} /></Row>}
          {(l.kind === "bridge" || l.kind === "hardmoney") && <Row id="loan.extensionFee" label="Extension fee"><P value={l.extensionFee} onChange={(v) => setL({ extensionFee: v })} /></Row>}
          <Row id="loan.dscrTarget" label="DSCR requirement"><N value={l.dscrTarget} onChange={(v) => setL({ dscrTarget: v })} /></Row>
        </div>
          {l.termMonths < deal.assumptions.holdYears * 12 && !refi && <p className="px-4 pb-3 text-xs text-warning">Loan term ({l.termMonths} mo) ends before your hold — add a refinance or shorten the hold.</p>}
        </Card>
        <Card title="Refinance" action={<label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={!!refi} onChange={(e) => setL({ refi: e.target.checked ? { month: Math.min(36, deal.assumptions.holdYears * 12 - 1), ltv: 0.7, rate: 0.065, amortYears: 30, valueCap: deal.assumptions.exitCap } : null })} />Refinance during hold</label>}>
          {refi ? <div className="divide-y">
            <Row id="refi.month" label="Refinance in month"><N value={refi.month} onChange={(v) => setL({ refi: { ...refi, month: v } })} /></Row>
            <Row id="refi.valueCap" label="Valuation cap rate"><P value={refi.valueCap} onChange={(v) => setL({ refi: { ...refi, valueCap: v } })} /></Row>
            <Row id="refi.ltv" label="New LTV"><P value={refi.ltv} onChange={(v) => setL({ refi: { ...refi, ltv: v } })} /></Row>
            <Row id="refi.rate" label="New rate"><P value={refi.rate} onChange={(v) => setL({ refi: { ...refi, rate: v } })} /></Row>
            <Row id="refi.amortYears" label="New amortization (yrs)"><N value={refi.amortYears} onChange={(v) => setL({ refi: { ...refi, amortYears: v } })} /></Row>
            <div className="px-4 py-2 text-sm">Cash out at refinance: <span className="num font-medium">{usd(r.monthly.reduce((s, x) => s + x.refi, 0))}</span></div>
          </div> : <p className="p-4 text-sm text-muted-foreground">Turn on to model a bridge-to-perm or cash-out refinance. The new loan is sized off trailing 12-month NOI at the valuation cap rate.</p>}
        </Card>
      </div>
      <Card title="Debt service schedule" action={<Sel value={view} onChange={setView} options={[["annual", "Annual"], ["monthly", "Monthly"]]} />}>
        <div className="max-h-[420px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 border-b bg-card text-xs text-muted-foreground"><tr><Th left>{view === "annual" ? "Year" : "Month"}</Th><Th>NOI</Th><Th>Interest</Th><Th>Principal</Th><Th>Debt service</Th><Th>DSCR</Th><Th>Balance</Th></tr></thead>
            <tbody>{(view === "annual" ? r.annual.map((y) => ({ k: y.y, ...y })) : r.monthly.map((x) => ({ k: x.m, ...x, dscr: x.debtService ? x.noi / x.debtService : Infinity }))).map((x) => (
              <tr key={x.k} className="border-b last:border-0">
                <td className="num px-2 py-1">{x.k}</td><td className="num px-2 text-right">{usd(x.noi)}</td><td className="num px-2 text-right">{usd(x.interest)}</td><td className="num px-2 text-right">{usd(x.principal)}</td>
                <td className="num px-2 text-right">{usd(x.debtService)}</td><td className={`num px-2 text-right ${x.dscr < l.dscrTarget ? "text-destructive" : ""}`}>{isFinite(x.dscr) ? x.dscr.toFixed(2) + "x" : "—"}</td><td className="num px-2 text-right">{usd(x.balance)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ---------- cash flow ---------- */
function CashFlowTab({ r }: { r: R }) {
  const [view, setView] = useState<"annual" | "monthly">("annual");
  const rows: [string, keyof R["annual"][number]][] = [["Gross rent", "gross"], ["Vacancy & turnover loss", "vacancy"], ["Other income", "other"], ["Effective gross income", "egi"], ["Operating expenses", "opex"], ["NOI", "noi"], ["Debt service", "debtService"], ["Reserve draws", "capex"], ["Refinance proceeds", "refi"], ["Cash flow", "cashFlow"]];
  const cols = view === "annual" ? r.annual.map((y) => ({ label: `Yr ${y.y}`, ...y })) : r.monthly.map((x) => ({ label: `M${x.m}`, ...x }));
  return (
    <Card title="Projected cash flow" action={<Sel value={view} onChange={setView} options={[["annual", "Annual"], ["monthly", "Monthly"]]} />}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b text-xs text-muted-foreground"><tr><Th left>{" "}</Th>{cols.map((c) => <Th key={c.label}>{c.label}</Th>)}</tr></thead>
          <tbody>{rows.map(([label, k]) => (
            <tr key={k} className={`border-b last:border-0 ${k === "noi" || k === "cashFlow" ? "font-medium" : ""}`}>
              <td className="sticky left-0 whitespace-nowrap bg-card px-2 py-1">{label}</td>
              {cols.map((c) => { const v = Number((c as unknown as Record<string, number>)[k]) * (k === "vacancy" || k === "opex" || k === "debtService" || k === "capex" ? -1 : 1); return <td key={c.label} className={`num whitespace-nowrap px-2 text-right ${v < 0 ? "text-destructive" : ""}`}>{usd(v, view === "annual")}</td>; })}
            </tr>
          ))}</tbody>
        </table>
      </div>
      <p className="px-3 py-2 text-xs text-muted-foreground">Sale proceeds at exit: {usd(r.saleProceeds)} (value {usd(r.exitValue)} on forward NOI).</p>
    </Card>
  );
}

/* ---------- waterfall ---------- */
function WaterfallTab({ deal, setM, r }: TabProps & { r: R }) {
  const m = deal.model;
  const w = m.waterfall ?? { lpShare: 0.9, pref: 0.08, promote: 0.3 };
  const budget = m.budget ?? [];
  const setB = (id: string, p: Partial<(typeof budget)[number]>) => setM({ budget: budget.map((b) => (b.id === id ? { ...b, ...p } : b)) });
  const dist = distribute(r.equity, r.flows.slice(1), w);
  const totB = budget.reduce((s, b) => s + b.budget, 0), totS = budget.reduce((s, b) => s + b.spent, 0);
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Sources & uses"><table className="w-full text-sm"><tbody>
          {r.uses.map((u) => <tr key={u.label} className="border-b"><td className="px-4 py-1.5">{u.label}</td><td className="num px-4 text-right">{usd(u.amount)}</td></tr>)}
          <tr className="border-b font-medium"><td className="px-4 py-1.5">Total uses</td><td className="num px-4 text-right">{usd(r.uses.reduce((s, u) => s + u.amount, 0))}</td></tr>
          {r.sources.map((u) => <tr key={u.label} className="border-b last:border-0"><td className="px-4 py-1.5 text-muted-foreground">{u.label}</td><td className="num px-4 text-right">{usd(u.amount)}</td></tr>)}
        </tbody></table></Card>
        <Card title="Distribution waterfall"><div className="divide-y">
          <Row label="LP share of equity"><P value={w.lpShare} onChange={(v) => setM({ waterfall: { ...w, lpShare: v } })} /></Row>
          <Row label="Preferred return"><P value={w.pref} onChange={(v) => setM({ waterfall: { ...w, pref: v } })} /></Row>
          <Row label="GP promote above pref"><P value={w.promote} onChange={(v) => setM({ waterfall: { ...w, promote: v } })} /></Row>
          <div className="grid grid-cols-2 gap-px bg-border text-sm">
            {[["LP distributions", usd(dist.lpTotal)], ["GP distributions", usd(dist.gpTotal)], ["LP IRR / multiple", `${pct(dist.lpIrr)} · ${dist.lpMultiple.toFixed(2)}x`], ["GP IRR / multiple", `${pct(dist.gpIrr)} · ${isFinite(dist.gpMultiple) ? dist.gpMultiple.toFixed(2) + "x" : "—"}`]].map(([k, v]) => (
              <div key={k} className="bg-card px-4 py-2"><div className="text-xs text-muted-foreground">{k}</div><div className="num">{v}</div></div>
            ))}
          </div>
        </div></Card>
      </div>
      <Card title="Cost tracker — budget vs spent" action={<Button size="sm" variant="outline" onClick={() => setM({ budget: [...budget, { id: uid(), label: "New cost", budget: 0, spent: 0 }] })}>Add cost</Button>}>
        <table className="w-full text-sm">
          <thead className="border-b text-xs text-muted-foreground"><tr><Th left>Cost</Th><Th>Budget</Th><Th>Spent</Th><Th>Remaining</Th><Th>% used</Th><Th /></tr></thead>
          <tbody>{budget.map((b) => (
            <tr key={b.id} className="border-b">
              <td><T value={b.label} onChange={(v) => setB(b.id, { label: v })} /></td>
              <td className="w-32"><N value={b.budget} onChange={(v) => setB(b.id, { budget: v })} /></td>
              <td className="w-32"><N value={b.spent} onChange={(v) => setB(b.id, { spent: v })} /></td>
              <td className={`num px-2 text-right ${b.budget - b.spent < 0 ? "text-destructive" : ""}`}>{usd(b.budget - b.spent)}</td>
              <td className="num px-2 text-right">{b.budget ? pct(b.spent / b.budget, 0) : "—"}</td>
              <td><Del onClick={() => setM({ budget: budget.filter((x) => x.id !== b.id) })} /></td>
            </tr>
          ))}</tbody>
          <tfoot><tr className="font-medium"><td className="px-2 py-2">Total</td><td className="num px-2 text-right">{usd(totB)}</td><td className="num px-2 text-right">{usd(totS)}</td><td className="num px-2 text-right">{usd(totB - totS)}</td><td className="num px-2 text-right">{totB ? pct(totS / totB, 0) : "—"}</td><td /></tr></tfoot>
        </table>
        <p className="px-3 pb-3 text-xs text-muted-foreground">Budgeted costs are funded at close and included in equity required.</p>
      </Card>
    </div>
  );
}

/* ---------- working capital ---------- */
function WorkingCapitalTab({ deal, setM, r }: TabProps & { r: R }) {
  const wc = deal.model.workingCapital ?? { start: 0, minBalance: 0, draws: [] };
  const track = workingCapitalTrack(wc, r.monthly);
  const low = track.find((t) => t.low);
  const minBal = Math.min(...track.map((t) => t.balance), wc.start);
  const setD = (id: string, p: Partial<(typeof wc.draws)[number]>) => setM({ workingCapital: { ...wc, draws: wc.draws.map((d) => (d.id === id ? { ...d, ...p } : d)) } });
  return (
    <div className="space-y-6">
      <Metrics items={[["Starting reserve", usd(wc.start)], ["Lowest balance", usd(minBal), minBal < wc.minBalance ? "text-destructive" : ""], ["Ending balance", usd(track[track.length - 1]?.balance ?? wc.start)], ["First month below minimum", low ? `Month ${low.m}` : "None", low ? "text-destructive" : ""]]} />
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-6">
          <Card title="Reserve"><div className="divide-y">
            <Row label="Funded at close"><N value={wc.start} onChange={(v) => setM({ workingCapital: { ...wc, start: v } })} /></Row>
            <Row label="Minimum balance"><N value={wc.minBalance} onChange={(v) => setM({ workingCapital: { ...wc, minBalance: v } })} /></Row>
          </div></Card>
          <Card title="Planned draws" action={<Button size="sm" variant="outline" onClick={() => setM({ workingCapital: { ...wc, draws: [...wc.draws, { id: uid(), month: 1, label: "Draw", amount: 0 }] } })}>Add</Button>}>
            <table className="w-full text-sm"><tbody>{wc.draws.map((d) => (
              <tr key={d.id} className="border-b"><td className="w-16"><N value={d.month} onChange={(v) => setD(d.id, { month: v })} /></td><td><T value={d.label} onChange={(v) => setD(d.id, { label: v })} /></td><td className="w-28"><N value={d.amount} onChange={(v) => setD(d.id, { amount: v })} /></td><td><Del onClick={() => setM({ workingCapital: { ...wc, draws: wc.draws.filter((x) => x.id !== d.id) } })} /></td></tr>
            ))}</tbody></table>
            {!wc.draws.length && <p className="p-3 text-xs text-muted-foreground">Month, label, amount. Draws reduce cash flow in that month.</p>}
          </Card>
        </div>
        <Card title="Monthly balance">
          <div className="max-h-[460px] overflow-auto"><table className="w-full text-sm">
            <thead className="sticky top-0 border-b bg-card text-xs text-muted-foreground"><tr><Th left>Month</Th><Th>Draws</Th><Th>Operating shortfall</Th><Th>Balance</Th></tr></thead>
            <tbody>{track.map((t) => (
              <tr key={t.m} className={`border-b last:border-0 ${t.low ? "text-destructive" : ""}`}><td className="num px-2 py-1">{t.m}</td><td className="num px-2 text-right">{t.draws ? usd(t.draws) : ""}</td><td className="num px-2 text-right">{t.shortfall ? usd(t.shortfall) : ""}</td><td className="num px-2 text-right">{usd(t.balance)}</td></tr>
            ))}</tbody>
          </table></div>
        </Card>
      </div>
    </div>
  );
}

/* ---------- comps ---------- */
function CompsTab({ deal, setM, r }: TabProps & { r: R }) {
  const comps = deal.model.comps ?? [];
  const s = compStats(comps, deal.assumptions.units);
  const setC = (id: string, p: Partial<Comp>) => setM({ comps: comps.map((c) => (c.id === id ? { ...c, ...p } : c)) });
  const units = deal.model.units ?? [];
  const myRent = units.length ? units.reduce((a, u) => a + (u.rent || 0), 0) / units.length : NaN;
  const add = (kind: Comp["kind"]) => setM({ comps: [...comps, { id: uid(), kind, address: "", date: "", price: 0, units: 0, cap: 0, rent: 0, sf: 0 }] });
  const table = (kind: Comp["kind"]) => (
    <table className="w-full text-sm">
      <thead className="border-b text-xs text-muted-foreground"><tr><Th left>Address</Th><Th left>Date</Th>{kind === "sale" ? <><Th>Price</Th><Th>Units</Th><Th>$/unit</Th><Th>Cap</Th></> : <><Th>Rent / mo</Th><Th>SF</Th><Th>$/SF</Th></>}<Th /></tr></thead>
      <tbody>{comps.filter((c) => c.kind === kind).map((c) => (
        <tr key={c.id} className="border-b">
          <td><T value={c.address} onChange={(v) => setC(c.id, { address: v })} placeholder="Address" /></td>
          <td className="w-32"><input type="date" value={c.date} onChange={(e) => setC(c.id, { date: e.target.value })} className="bg-transparent px-2 text-sm" /></td>
          {kind === "sale" ? <>
            <td className="w-32"><N value={c.price} onChange={(v) => setC(c.id, { price: v })} /></td><td className="w-20"><N value={c.units} onChange={(v) => setC(c.id, { units: v })} /></td>
            <td className="num px-2 text-right">{c.units ? usd(c.price / c.units) : "—"}</td><td className="w-24"><P value={c.cap} onChange={(v) => setC(c.id, { cap: v })} /></td>
          </> : <>
            <td className="w-28"><N value={c.rent} onChange={(v) => setC(c.id, { rent: v })} /></td><td className="w-20"><N value={c.sf} onChange={(v) => setC(c.id, { sf: v })} /></td>
            <td className="num px-2 text-right">{c.sf ? (c.rent / c.sf).toFixed(2) : "—"}</td>
          </>}
          <td><Del onClick={() => setM({ comps: comps.filter((x) => x.id !== c.id) })} /></td>
        </tr>
      ))}</tbody>
    </table>
  );
  const myPer = deal.assumptions.units ? deal.assumptions.price / deal.assumptions.units : NaN;
  return (
    <div className="space-y-6">
      <Metrics items={[["Comp avg $/unit", usd(s.perUnit), ""], ["This deal $/unit", usd(myPer), isFinite(s.perUnit) && myPer > s.perUnit ? "text-warning" : ""], ["Comp avg cap", pct(s.cap, 2)], ["This deal cap", pct(r.capRate, 2)],
        ["Value at comp $/unit", usd(s.impliedValue)], ["Value at comp cap", isFinite(s.cap) && s.cap ? usd(r.noi / s.cap) : "—"], ["Comp avg rent", usd(s.rent)], ["Your avg rent", usd(myRent)]]} />
      <Card title="Sale comps" action={<Button size="sm" variant="outline" onClick={() => add("sale")}>Add sale comp</Button>}>{table("sale")}</Card>
      <Card title="Rent comps" action={<Button size="sm" variant="outline" onClick={() => add("rent")}>Add rent comp</Button>}>{table("rent")}</Card>
    </div>
  );
}

/* ---------- accounting check ---------- */
function AccountingTab({ deal, setM }: TabProps) {
  const rows = deal.model.accounting ?? [];
  const [paste, setPaste] = useState("");
  const check = accountingCheck(rows, deal.lines);
  const guess = (cat: string) => {
    const k = cat.toLowerCase();
    const rules: [RegExp, string][] = [[/rent|lease/, "gpr"], [/vacan|concession|bad debt/, "vacancy"], [/other|fee|laundry|parking/, "other"], [/tax/, "taxes"], [/insur/, "insurance"], [/water|sewer|electric|gas|utilit|trash/, "utilities"], [/repair|maint|turn|clean/, "repairs"], [/manage/, "mgmt"], [/payroll|salar|wage/, "payroll"], [/reserve/, "reserves"]];
    return rules.find(([re]) => re.test(k))?.[1] ?? "";
  };
  const importPaste = () => {
    const parsed = paste.split(/\r?\n/).map((l) => l.split(/,|\t/)).filter((c) => c[0]?.trim() && c[1]).map((c) => ({ id: uid(), category: c[0]!.trim(), actual: Math.abs(parseFloat(c[c.length - 1]!.replace(/[$,()\s]/g, "")) || 0), mapsTo: guess(c[0]!) })).filter((r) => r.actual);
    setM({ accounting: [...rows, ...parsed] }); setPaste(""); toast.success(`Imported ${parsed.length} accounts`);
  };
  const setR = (id: string, p: Partial<(typeof rows)[number]>) => setM({ accounting: rows.map((r) => (r.id === id ? { ...r, ...p } : r)) });
  return (
    <div className="space-y-6">
      <Card title="Underwrite vs accounting actuals">
        <table className="w-full text-sm">
          <thead className="border-b text-xs text-muted-foreground"><tr><Th left>Line</Th><Th>Underwrite</Th><Th>Actual (books)</Th><Th>Variance</Th><Th>Accounts</Th></tr></thead>
          <tbody>{check.map((c) => (
            <tr key={c.key} className={`border-b last:border-0 ${c.flag ? "bg-destructive/5" : ""}`}>
              <td className="px-2 py-1.5">{c.label}</td><td className="num px-2 text-right">{usd(c.underwrite)}</td><td className="num px-2 text-right">{c.count ? usd(c.actual) : "—"}</td>
              <td className={`num px-2 text-right ${c.flag ? "font-medium text-destructive" : ""}`}>{c.count && isFinite(c.variance) ? pct(c.variance) : "—"}</td><td className="num px-2 text-right text-muted-foreground">{c.count || ""}</td>
            </tr>
          ))}</tbody>
        </table>
        <p className="px-3 py-2 text-xs text-muted-foreground">Flagged when the books differ from your underwrite by 10% or more.</p>
      </Card>
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card title="General ledger accounts">
          <table className="w-full text-sm"><thead className="border-b text-xs text-muted-foreground"><tr><Th left>Account</Th><Th>Annual actual</Th><Th left>Maps to</Th><Th /></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.id} className="border-b"><td><T value={r.category} onChange={(v) => setR(r.id, { category: v })} /></td><td className="w-32"><N value={r.actual} onChange={(v) => setR(r.id, { actual: v })} /></td>
                <td><Sel value={r.mapsTo} onChange={(v) => setR(r.id, { mapsTo: v })} options={[["", "Not mapped"], ...deal.lines.map((l) => [l.key, l.label] as [string, string])]} /></td><td><Del onClick={() => setM({ accounting: rows.filter((x) => x.id !== r.id) })} /></td></tr>
            ))}</tbody></table>
          {!rows.length && <p className="p-3 text-sm text-muted-foreground">Paste the seller's P&L or general ledger to compare.</p>}
        </Card>
        <Card title="Paste P&L / GL"><div className="space-y-2 p-3">
          <Textarea rows={6} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={"Account, Annual amount\nRental income, 412000\nProperty tax, 41800"} className="text-xs" />
          <Button size="sm" variant="outline" disabled={!paste.trim()} onClick={importPaste}>Import and auto-map</Button>
        </div></Card>
      </div>
    </div>
  );
}

/* ---------- custom fields ---------- */
function CustomTab({ deal, setM }: TabProps) {
  const fields = deal.model.custom ?? [];
  const setF = (id: string, p: Partial<CustomField>) => setM({ custom: fields.map((f) => (f.id === id ? { ...f, ...p } : f)) });
  return (
    <Card title="Custom inputs & lines" action={<Button size="sm" variant="outline" onClick={() => setM({ custom: [...fields, { id: uid(), label: "New field", kind: "usd", value: 0, effect: "none" }] })}>Add field</Button>}>
      <table className="w-full text-sm">
        <thead className="border-b text-xs text-muted-foreground"><tr><Th left>Label</Th><Th left>Type</Th><Th>Value</Th><Th left>Feeds into</Th><Th /></tr></thead>
        <tbody>{fields.map((f) => (
          <tr key={f.id} className="border-b">
            <td><T value={f.label} onChange={(v) => setF(f.id, { label: v })} /></td>
            <td><Sel value={f.kind} onChange={(v) => setF(f.id, { kind: v, ...(v !== "usd" ? { effect: "none" } : {}) })} options={[["usd", "Dollars"], ["pct", "Percent"], ["n", "Number"]]} /></td>
            <td className="w-36">{f.kind === "pct" ? <P value={f.value} onChange={(v) => setF(f.id, { value: v })} /> : <N value={f.value} onChange={(v) => setF(f.id, { value: v })} />}</td>
            <td><Sel value={f.effect} onChange={(v) => setF(f.id, { effect: v })} options={f.kind === "usd" ? [["none", "Note only"], ["annualIncome", "Annual income"], ["annualExpense", "Annual expense"], ["closingCost", "Closing cost"]] : [["none", "Note only"]]} /></td>
            <td><Del onClick={() => setM({ custom: fields.filter((x) => x.id !== f.id) })} /></td>
          </tr>
        ))}</tbody>
      </table>
      <p className="px-3 py-2 text-xs text-muted-foreground">Add any input your model needs. Dollar fields can flow into income, expenses or closing costs. Custom fields are saved with templates.</p>
    </Card>
  );
}

/* ---------- summary ---------- */
function SummaryTab({ deal, r, onNext }: { deal: Deal; r: R; onNext: () => void }) {
  const a = deal.assumptions;
  const caps = [-0.005, 0, 0.005], prices = [0.95, 1, 1.05];
  return (
    <div className="space-y-6">
      <Metrics items={[["Equity required", usd(r.equity)], ["Loan", usd(r.loan)], ["Cash-on-cash Y1", pct(r.cashOnCash)], ["Equity multiple", r.equityMultiple.toFixed(2) + "x"],
        ["Levered IRR", pct(r.irr), r.irr < deal.targetIrr ? "text-warning" : "text-positive"], ["Unlevered IRR", pct(r.unleveredIrr)], ["Lowest DSCR", r.minDscr.toFixed(2) + "x"], ["Target IRR", pct(deal.targetIrr)]]} />
      <Card title="IRR sensitivity — price vs exit cap">
        <table className="w-full text-sm">
          <thead className="border-b text-xs text-muted-foreground"><tr><Th left>Price \ Exit cap</Th>{caps.map((c) => <Th key={c}>{pct(a.exitCap + c, 2)}</Th>)}</tr></thead>
          <tbody>{prices.map((p) => (
            <tr key={p} className="border-b last:border-0"><td className="num px-2 py-1.5">{usd(a.price * p, true)}</td>
              {caps.map((c) => { const v = runModel(deal.lines, { ...a, exitCap: a.exitCap + c }, deal.model, deal.adjustments, a.price * p).irr; return <td key={c} className={`num px-2 text-right ${p === 1 && c === 0 ? "font-semibold" : ""} ${v < deal.targetIrr ? "text-warning" : "text-positive"}`}>{pct(v)}</td>; })}
            </tr>
          ))}</tbody>
        </table>
      </Card>
      <p className="text-xs text-muted-foreground">These numbers drive the deal header, retrade, Ask AI and lender view.</p>
      <div className="flex justify-end"><Button onClick={onNext}>Continue to diligence →</Button></div>
    </div>
  );
}

/** Shown on deals still on the quick model: pick a model type to switch. */
export function ModelChooser({ onPick }: { onPick: (id: ModelTypeId) => void }) {
  return (
    <div className="rounded-md border bg-card p-4">
      <div className="text-sm font-medium">Switch to the full underwriting model</div>
      <p className="mt-1 text-xs text-muted-foreground">Rent roll, itemized expenses and closing costs, IO / bridge / hard money, monthly cash flow, waterfall, comps and templates. Your current numbers carry over.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {MODEL_TYPES.map((t) => (
          <button key={t.id} type="button" onClick={() => onPick(t.id)} className="rounded border px-3 py-2 text-left text-sm hover:border-primary">
            <div className="font-medium">{t.label}</div><div className="text-xs text-muted-foreground">{t.blurb}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
