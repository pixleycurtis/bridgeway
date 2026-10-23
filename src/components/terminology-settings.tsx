import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { BASE_FIELDS, normalize } from "@/lib/model";
import { useWorkspace } from "@/lib/workspace";

/** Firm-wide upload vocabulary: which file labels go to which underwriting field. */
export function TerminologySettings() {
  const { firm, settings, isAdmin, refreshFirm } = useWorkspace();
  const [label, setLabel] = useState("");
  const [dest, setDest] = useState(BASE_FIELDS[0]!.id);
  if (!firm) return null;
  const save = async (terms: Record<string, string>) => {
    const raw = (firm.settings && typeof firm.settings === "object" ? firm.settings : {}) as Record<string, unknown>;
    const { error } = await supabase.from("firms").update({ settings: { ...raw, terms } as never }).eq("id", firm.id);
    if (error) { toast.error(error.message); return; }
    await refreshFirm();
  };
  const entries = Object.entries(settings.terms);
  const name = (id: string) => (id === "skip" ? "Always skip" : BASE_FIELDS.find((f) => f.id === id)?.label ?? id);
  return (
    <section>
      <h2 className="font-display text-2xl">Underwriting terminology</h2>
      <p className="mt-1 text-sm text-muted-foreground">Keystone already knows common terms (year built = date built, real estate taxes = property taxes…). Add your firm's own wording here, or correct a match while uploading.</p>
      <div className="mt-5 space-y-4 rounded-md border bg-card p-5">
        {isAdmin && (
          <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); const k = normalize(label); if (!k) return; void save({ ...settings.terms, [k]: dest }); setLabel(""); }}>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Term in your files, e.g. Ad Val" className="w-64" />
            <span className="text-sm text-muted-foreground">means</span>
            <select value={dest} onChange={(e) => setDest(e.target.value)} className="rounded border bg-card px-2 py-1.5 text-sm">
              <option value="skip">Always skip</option>
              {BASE_FIELDS.map((f) => <option key={f.id} value={f.id}>{f.section} · {f.label}</option>)}
            </select>
            <Button type="submit" size="sm">Add term</Button>
          </form>
        )}
        {entries.length ? (
          <div className="divide-y text-sm">{entries.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between py-1.5">
              <span>"{k}" → {name(v)}</span>
              {isAdmin && <Button size="sm" variant="ghost" onClick={() => { const t = { ...settings.terms }; delete t[k]; void save(t); }}>Remove</Button>}
            </div>
          ))}</div>
        ) : <p className="text-sm text-muted-foreground">No firm terms yet.</p>}
      </div>
    </section>
  );
}
