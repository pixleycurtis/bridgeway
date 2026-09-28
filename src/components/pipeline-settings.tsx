import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWorkspace } from "@/lib/workspace";
import { PIPELINE_COLUMNS, type FirmSettings } from "@/lib/firm-settings";

function ListEditor({ label, items, onChange, disabled }: { label: string; items: string[]; onChange: (v: string[]) => void; disabled: boolean }) {
  const [draft, setDraft] = useState("");
  const move = (i: number, d: number) => { const n = [...items]; const j = i + d; if (j < 0 || j >= n.length) return; [n[i], n[j]] = [n[j]!, n[i]!]; onChange(n); };
  return (
    <div>
      <div className="text-sm text-muted-foreground">{label}</div>
      <ul className="mt-2 space-y-1">
        {items.map((s, i) => (
          <li key={s + i} className="flex items-center gap-2 rounded border bg-background px-2 py-1 text-sm">
            <input value={s} disabled={disabled} onChange={(e) => onChange(items.map((x, k) => (k === i ? e.target.value : x)))} className="flex-1 bg-transparent outline-none" />
            {!disabled && <>
              <button onClick={() => move(i, -1)} className="text-muted-foreground" aria-label="Move up">↑</button>
              <button onClick={() => move(i, 1)} className="text-muted-foreground" aria-label="Move down">↓</button>
              <button onClick={() => onChange(items.filter((_, k) => k !== i))} className="text-destructive" aria-label="Remove">×</button>
            </>}
          </li>
        ))}
      </ul>
      {!disabled && (
        <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (draft.trim()) { onChange([...items, draft.trim()]); setDraft(""); } }}>
          <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add…" className="h-8" />
          <Button type="submit" size="sm" variant="outline">Add</Button>
        </form>
      )}
    </div>
  );
}

export function PipelineSettings() {
  const { firm, isAdmin, settings, refreshFirm } = useWorkspace();
  const [s, setS] = useState<FirmSettings>(settings);
  if (!firm) return null;
  const num = (label: string, value: number, onChange: (n: number) => void, suffix = "%", scale = 100) => (
    <label className="block text-sm"><span className="text-muted-foreground">{label}</span>
      <div className="mt-1 flex items-center gap-1">
        <Input type="number" step="0.25" disabled={!isAdmin} value={+(value * scale).toFixed(3)} onChange={(e) => onChange((parseFloat(e.target.value) || 0) / scale)} className="num" />
        <span className="text-xs text-muted-foreground">{suffix}</span>
      </div></label>
  );
  const save = async () => {
    const clean = { ...s, stages: s.stages.map((x) => x.trim()).filter(Boolean), propertyTypes: s.propertyTypes.map((x) => x.trim()).filter(Boolean) };
    const { error } = await supabase.from("firms").update({ settings: clean as never }).eq("id", firm.id);
    if (error) { toast.error(error.message); return; }
    await refreshFirm(); toast.success("Pipeline settings saved");
  };
  return (
    <section>
      <h2 className="font-display text-2xl">Pipeline & defaults</h2>
      <p className="mt-1 text-sm text-muted-foreground">Your stages, property types, and the starting numbers for new deals.{!isAdmin && " Only admins can change these."}</p>
      <div className="mt-5 space-y-6 rounded-md border bg-card p-5">
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <ListEditor label="Stages (in order)" items={s.stages} disabled={!isAdmin} onChange={(stages) => setS({ ...s, stages })} />
            <p className="mt-2 text-xs text-muted-foreground">"Closed" and "Passed" are always added at the end.</p>
          </div>
          <ListEditor label="Property types" items={s.propertyTypes} disabled={!isAdmin} onChange={(propertyTypes) => setS({ ...s, propertyTypes })} />
        </div>
        <div>
          <div className="text-sm text-muted-foreground">Default pipeline columns (each person can still change their own)</div>
          <div className="mt-2 flex flex-wrap gap-3 text-sm">
            {PIPELINE_COLUMNS.map((c) => (
              <label key={c.key} className="flex items-center gap-1.5">
                <input type="checkbox" disabled={!isAdmin} checked={s.columns.includes(c.key)} onChange={(e) => setS({ ...s, columns: e.target.checked ? [...s.columns, c.key] : s.columns.filter((k) => k !== c.key) })} />{c.label}
              </label>
            ))}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {num("Target IRR", s.targetIrr, (targetIrr) => setS({ ...s, targetIrr }))}
          {num("Flag OM vs. T-12 gaps over", s.flagThreshold, (flagThreshold) => setS({ ...s, flagThreshold }))}
          {num("Call a deal stalled after", s.stallDays, (stallDays) => setS({ ...s, stallDays: Math.round(stallDays) }), "days", 1)}
          {num("Default loan-to-value", s.defaults.ltv, (ltv) => setS({ ...s, defaults: { ...s.defaults, ltv } }))}
          {num("Default interest rate", s.defaults.rate, (rate) => setS({ ...s, defaults: { ...s.defaults, rate } }))}
          {num("Default exit cap", s.defaults.exitCap, (exitCap) => setS({ ...s, defaults: { ...s.defaults, exitCap } }))}
          {num("Default hold", s.defaults.holdYears, (holdYears) => setS({ ...s, defaults: { ...s.defaults, holdYears: Math.round(holdYears) } }), "years", 1)}
        </div>
        {isAdmin && <Button onClick={save}>Save pipeline settings</Button>}
      </div>
    </section>
  );
}
