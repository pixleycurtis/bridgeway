import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MODEL_TYPES, modelType, seedModel, templateConfig, TAB_LABELS, type ModelTypeId } from "@/lib/model";
import { useTemplates } from "@/lib/underwrite-templates";

/** Firm underwriting templates: start from a model type, or save one from any deal's Underwrite tab. */
export function TemplatesLibrary() {
  const { templates, save, remove } = useTemplates();
  const [name, setName] = useState("");
  const [type, setType] = useState<ModelTypeId>("stabilized");
  return (
    <section>
      <h2 className="font-display text-2xl">Underwriting templates</h2>
      <p className="mt-1 text-sm text-muted-foreground">Templates carry the model type, sections shown, expense and closing cost lines, financing structure, turnover, waterfall and custom fields. Save one from any deal's Underwrite tab.</p>
      <div className="mt-4 divide-y rounded-md border bg-card">
        {templates.map((t) => (
          <div key={t.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
            <div>
              <div className="font-medium">{t.name}</div>
              <div className="text-xs text-muted-foreground">{modelType(t.modelType).label} · {t.config.opex?.length ?? 0} expense lines · {t.config.closing?.length ?? 0} closing items · {t.config.custom?.length ?? 0} custom fields
                {t.config.hiddenTabs?.length ? ` · hides ${t.config.hiddenTabs.map((h) => TAB_LABELS[h as keyof typeof TAB_LABELS] ?? h).join(", ")}` : ""}</div>
            </div>
            <Button size="sm" variant="ghost" onClick={() => { if (window.confirm(`Delete "${t.name}"?`)) void remove(t.id); }}>Delete</Button>
          </div>
        ))}
        {!templates.length && <div className="px-4 py-3 text-sm text-muted-foreground">No templates yet.</div>}
      </div>
      <form className="mt-3 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); if (!name.trim()) return; void save(name.trim(), type, templateConfig(seedModel(type, 24, { ltv: 0.7, rate: 0.0675, amortYears: 30 }))); setName(""); }}>
        <Input className="w-64" placeholder="New template name" value={name} onChange={(e) => setName(e.target.value)} />
        <select value={type} onChange={(e) => setType(e.target.value as ModelTypeId)} className="h-10 rounded-md border bg-card px-3 text-sm">{MODEL_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select>
        <Button type="submit" variant="outline">Create from model type</Button>
      </form>
    </section>
  );
}
