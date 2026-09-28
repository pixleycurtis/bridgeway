import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWorkspace } from "@/lib/workspace";
import type { FirmDefault } from "@/lib/deal-tables";

/** Firm-wide default underwriting assumptions per market + property type. */
export function AssumptionsLibrary() {
  const { firm, isAdmin, settings } = useWorkspace();
  const [rows, setRows] = useState<FirmDefault[]>([]);
  const [f, setF] = useState({ market: "", propertyType: settings.propertyTypes[0] ?? "", ltv: "70", rate: "6.75", exitCap: "6.5", holdYears: "5" });

  const load = async () => {
    const { data } = await supabase.from("firm_defaults").select("*").order("market");
    setRows((data ?? []).map((r) => ({ id: r.id, market: r.market, propertyType: r.property_type, defaults: (r.defaults ?? {}) as FirmDefault["defaults"] })));
  };
  useEffect(() => { void load(); }, []);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firm) return;
    const key = { market: f.market.trim(), property_type: f.propertyType };
    const { error } = await supabase.from("firm_defaults").upsert({
      firm_id: firm.id, ...key,
      defaults: { ltv: (parseFloat(f.ltv) || 0) / 100, rate: (parseFloat(f.rate) || 0) / 100, exitCap: (parseFloat(f.exitCap) || 0) / 100, holdYears: parseFloat(f.holdYears) || 5 },
    }, { onConflict: "firm_id,market,property_type" });
    if (error) { toast.error(error.message); return; }
    toast.success("Defaults saved");
    await load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("firm_defaults").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    await load();
  };

  return (
    <section>
      <h2 className="font-display text-2xl">Assumptions library</h2>
      {!isAdmin && <p className="mt-1 text-sm text-muted-foreground">Only admins can change these.</p>}
      <ul className="mt-4 divide-y rounded-md border bg-card text-sm">
        {rows.length === 0 && <li className="p-4 text-muted-foreground">No saved defaults yet — new deals use the firm settings.</li>}
        {rows.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div>
              <span className="font-medium">{r.market || "All markets"}</span> <span className="text-muted-foreground">· {r.propertyType}</span>
              <div className="num text-xs text-muted-foreground">
                LTV {Math.round((r.defaults.ltv ?? 0.7) * 100)}% · Rate {((r.defaults.rate ?? 0.0675) * 100).toFixed(2)}% · Exit cap {((r.defaults.exitCap ?? 0.065) * 100).toFixed(2)}% · Hold {r.defaults.holdYears ?? 5} yrs
              </div>
            </div>
            {isAdmin && <button className="text-xs text-muted-foreground hover:text-destructive" onClick={() => remove(r.id)}>Remove</button>}
          </li>
        ))}
      </ul>
      {isAdmin && (
        <form onSubmit={add} className="mt-4 flex flex-wrap items-end gap-2 rounded-md border bg-card p-4">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">Market
            <Input className="h-8 w-36" placeholder="Empty = all" value={f.market} onChange={(e) => setF({ ...f, market: e.target.value })} /></label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">Property type
            <select value={f.propertyType} onChange={(e) => setF({ ...f, propertyType: e.target.value })} className="h-8 rounded-md border bg-card px-2 text-sm">
              {settings.propertyTypes.map((t) => <option key={t}>{t}</option>)}
            </select></label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">LTV %
            <Input className="num h-8 w-20 text-right" type="number" value={f.ltv} onChange={(e) => setF({ ...f, ltv: e.target.value })} /></label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">Rate %
            <Input className="num h-8 w-20 text-right" type="number" step="0.01" value={f.rate} onChange={(e) => setF({ ...f, rate: e.target.value })} /></label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">Exit cap %
            <Input className="num h-8 w-20 text-right" type="number" step="0.01" value={f.exitCap} onChange={(e) => setF({ ...f, exitCap: e.target.value })} /></label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">Hold yrs
            <Input className="num h-8 w-16 text-right" type="number" value={f.holdYears} onChange={(e) => setF({ ...f, holdYears: e.target.value })} /></label>
          <Button type="submit" size="sm" variant="secondary">Save defaults</Button>
        </form>
      )}
    </section>
  );
}
