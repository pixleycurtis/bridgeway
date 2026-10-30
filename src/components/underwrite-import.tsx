import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import type { Deal } from "@/lib/deals-store";
import { usd } from "@/lib/finance";
import { readForAI } from "@/lib/files";
import { extractRows } from "@/lib/underwrite-csv";
import { applyMapped, catalogFor, matchLabel, normalize, type Confidence, type FieldDef, type Mapped } from "@/lib/model";
import { useWorkspace } from "@/lib/workspace";
import { useServerFn } from "@tanstack/react-start";
import { guessFieldMatches } from "@/lib/ai.functions";

const TONE: Record<Confidence, [string, string]> = {
  learned: ["Your firm's term", "bg-primary/10 text-foreground"], exact: ["Exact", "bg-primary/10 text-foreground"], synonym: ["Same meaning", "bg-primary/10 text-foreground"],
  close: ["Best guess — check", "bg-warning/20 text-warning"], computed: ["Calculated by Bridgeway", "bg-muted text-muted-foreground"], none: ["No match — choose", "bg-destructive/10 text-destructive"],
};
const RANK: Record<Confidence, number> = { none: 0, close: 1, learned: 3, exact: 4, synonym: 2, computed: 5 };

type Row = Mapped & { confidence: Confidence; auto: string; ai?: boolean };

/** Current value of a field on this deal, for side-by-side review. */
function currentValue(deal: Deal, f: FieldDef | undefined): string {
  if (!f) return "";
  const [ns, key] = [f.id.slice(0, f.id.indexOf(".")), f.id.slice(f.id.indexOf(".") + 1)];
  const m = deal.model;
  if (ns === "b") return m.building?.[key] ?? "";
  if (f.id === "targetIrr") return `${(deal.targetIrr * 100).toFixed(2)}%`;
  const fmt = (v: number | undefined) => (v == null ? "" : f.kind === "pct" ? `${(v * 100).toFixed(2)}%` : f.kind === "usd" ? usd(v) : String(v));
  if (ns === "a") return fmt((deal.assumptions as unknown as Record<string, number>)[key]);
  if (ns === "loan") return fmt(m.loan ? (m.loan as unknown as Record<string, number>)[key] : (deal.assumptions as unknown as Record<string, number>)[key]);
  if (ns === "line") return fmt(deal.lines.find((l) => l.key === key)?.underwrite);
  if (ns === "opexItem") return fmt(m.opex?.find((o) => o.id === key)?.amount);
  if (ns === "costItem") return fmt(m.closing?.find((o) => o.id === key)?.amount);
  if (ns === "custom") return fmt(m.custom?.find((o) => o.id === key)?.value);
  if (ns === "opex") { const hit = m.opex?.find((o) => normalize(o.label) === normalize(f.label)); return hit ? fmt(hit.amount) : fmt(deal.lines.find((l) => l.key === key)?.underwrite); }
  return "";
}

/** Upload an underwriting file, confirm where every row goes, then fill. Fields stay editable afterwards. */
export function UnderwriteImport({ deal, set }: { deal: Deal; set: (p: Partial<Deal>) => void }) {
  const { settings, firm, refreshFirm } = useWorkspace();
  const full = !!deal.model.type;
  const fields = useMemo(() => catalogFor(deal.model, full), [deal.model, full]);
  const [file, setFile] = useState<{ name: string; rows: Row[]; findings: Deal["adjustments"] } | null>(null);
  const [withFindings, setWithFindings] = useState(true);
  const [remember, setRemember] = useState(true);
  const guess = useServerFn(guessFieldMatches);
  const [guessing, setGuessing] = useState(false);
  const askAI = async () => {
    if (!file) return;
    const labels = file.rows.filter((r) => r.confidence === "none" && r.dest === "skip").map((r) => r.label);
    setGuessing(true);
    try {
      const { matches } = await guess({ data: { labels, fields: fields.map((f) => ({ id: f.id, label: f.label, section: f.section })) } });
      const n = Object.keys(matches).length;
      setFile((s) => s && { ...s, rows: s.rows.map((r) => (r.confidence === "none" && r.dest === "skip" && matches[r.label] ? { ...r, dest: matches[r.label]!, auto: matches[r.label]!, ai: true } : r)) });
      toast.success(n ? `AI suggested ${n} match${n === 1 ? "" : "es"} — please check them` : "AI couldn't place any of those rows");
    } catch (e) { toast.error(e instanceof Error ? e.message : "AI guess failed"); } finally { setGuessing(false); }
  };

  const onFile = async (f?: File) => {
    if (!f) return;
    try {
      const text = /\.(xlsx|xls)$/i.test(f.name) ? (await readForAI(f)).text ?? "" : await f.text();
      const { rows, findings } = extractRows(text);
      if (!rows.length && !findings.length) { toast.error("Couldn't find any labelled numbers in that file"); return; }
      const mapped: Row[] = rows.map((r) => { const m = matchLabel(r.label, fields, settings.terms); const dest = m.fieldId ?? "skip"; return { ...r, dest, auto: dest, confidence: m.confidence }; })
        .sort((x, y) => RANK[x.confidence] - RANK[y.confidence]);
      setFile({ name: f.name, rows: mapped, findings });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't read that file"); }
  };

  const setDest = (i: number, dest: string) => setFile((s) => s && { ...s, rows: s.rows.map((r, j) => (j === i ? { ...r, dest } : r)) });

  const apply = async () => {
    if (!file) return;
    const before = { assumptions: deal.assumptions, lines: deal.lines, model: deal.model, targetIrr: deal.targetIrr, adjustments: deal.adjustments };
    const { patch, filled } = applyMapped(deal, file.rows, fields, file.name);
    set({ ...patch, ...(withFindings && file.findings.length ? { adjustments: [...deal.adjustments, ...file.findings] } : {}) });
    toast.success(`Filled ${filled.length} field${filled.length === 1 ? "" : "s"} from ${file.name}`, { action: { label: "Undo", onClick: () => set(before) }, duration: 10000 });
    const corrections = file.rows.filter((r) => r.dest !== r.auto && !r.dest.startsWith("new."));
    if (remember && corrections.length && firm) {
      const terms = { ...settings.terms };
      for (const r of corrections) terms[normalize(r.label)] = r.dest;
      const raw = (firm.settings && typeof firm.settings === "object" ? firm.settings : {}) as Record<string, unknown>;
      const { error } = await supabase.from("firms").update({ settings: { ...raw, terms } as never }).eq("id", firm.id);
      if (error) toast.error("Couldn't save your terms for next time (only admins can)"); else { await refreshFirm(); toast.success(`Bridgeway will remember ${corrections.length} term${corrections.length === 1 ? "" : "s"}`); }
    }
    setFile(null);
  };

  const sections = useMemo(() => {
    const g = new Map<string, FieldDef[]>();
    for (const f of fields) g.set(f.section, [...(g.get(f.section) ?? []), f]);
    return [...g.entries()];
  }, [fields]);
  const rows = file?.rows ?? [];
  const toFill = rows.filter((r) => r.dest !== "skip" && !r.dest.startsWith("new.")).length;
  const toNew = rows.filter((r) => r.dest.startsWith("new.")).length;
  const corrections = rows.filter((r) => r.dest !== r.auto && !r.dest.startsWith("new.")).length;
  const unmatched = rows.filter((r) => r.confidence === "none" && r.dest === "skip").length;

  return (
    <div>
      <label className="flex cursor-pointer items-center justify-between rounded border border-dashed bg-card px-4 py-2.5 text-sm hover:border-primary">
        <span>Upload underwriting file</span>
        <span className="text-xs text-muted-foreground">CSV or Excel</span>
        <input type="file" accept=".csv,.txt,.xlsx,.xls" className="hidden" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ""; }} />
      </label>
      <Dialog open={!!file} onOpenChange={(o) => !o && setFile(null)}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
          <DialogHeader><DialogTitle className="font-display text-2xl font-normal">Confirm where {file?.name} goes</DialogTitle></DialogHeader>
          {file && (
            <div className="space-y-4 text-sm">
              <div className="flex items-center justify-between gap-3"><p className="text-muted-foreground">Rows Bridgeway wasn't sure about are at the top. Change any destination; nothing is filled until you confirm.</p>
                {unmatched > 0 && <Button size="sm" variant="outline" disabled={guessing} onClick={() => void askAI()}>{guessing ? "Asking AI…" : `Ask AI to guess ${unmatched} unmatched`}</Button>}</div>
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full">
                  <thead className="border-b bg-muted/40 text-xs text-muted-foreground"><tr>
                    <th className="px-3 py-2 text-left font-medium">In your file</th><th className="px-3 text-right font-medium">Value</th>
                    <th className="px-3 text-left font-medium">Goes to</th><th className="px-3 text-right font-medium">Now in Bridgeway</th><th className="px-3 text-left font-medium">Match</th>
                  </tr></thead>
                  <tbody>{rows.map((r, i) => {
                    const f = fields.find((x) => x.id === r.dest);
                    const [lbl, tone] = r.dest !== r.auto ? ["Changed by you", "bg-primary/10 text-primary"] : r.ai ? ["AI guess — check", "bg-warning/20 text-warning"] : TONE[r.confidence];
                    return (
                      <tr key={i} className={`border-b last:border-0 ${r.dest === "skip" ? "text-muted-foreground" : ""}`}>
                        <td className="px-3 py-1.5">{r.label}</td>
                        <td className="num px-3 text-right">{r.raw}</td>
                        <td className="px-3">
                          <select value={r.dest} onChange={(e) => setDest(i, e.target.value)} className="w-64 rounded border bg-card px-2 py-1 text-sm">
                            <option value="skip">Skip this row</option>
                            {full && <optgroup label="Add as a new row"><option value="new.opex">+ New operating expense</option><option value="new.closing">+ New closing cost</option><option value="new.custom">+ New custom input</option><option value="new.building">+ New building info row</option></optgroup>}
                            {sections.map(([s, fs]) => <optgroup key={s} label={s}>{fs.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</optgroup>)}
                          </select>
                        </td>
                        <td className="num px-3 text-right text-muted-foreground">{currentValue(deal, f) || "—"}</td>
                        <td className="px-3"><span className={`whitespace-nowrap rounded px-1.5 py-0.5 text-xs ${tone}`}>{lbl}</span></td>
                      </tr>
                    );
                  })}</tbody>
                </table>
              </div>
              {file.findings.length > 0 && (
                <label className="flex items-start gap-2">
                  <input type="checkbox" className="mt-1" checked={withFindings} onChange={(e) => setWithFindings(e.target.checked)} />
                  <span>Also add {file.findings.length} diligence finding{file.findings.length > 1 ? "s" : ""} to the retrade: {file.findings.map((f) => `${f.label} (${usd(f.amount)}${f.type === "annual" ? "/yr" : ""})`).join(", ")}</span>
                </label>
              )}
              {corrections > 0 && (
                <label className="flex items-center gap-2"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />Remember my {corrections} change{corrections > 1 ? "s" : ""} for future uploads (whole firm)</label>
              )}
              {!full && <p className="text-xs text-muted-foreground">This deal is on the quick model — switch to a full model to also fill building info, closing cost items and new rows.</p>}
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">{toFill} to fill · {toNew} new row{toNew === 1 ? "" : "s"} · {rows.length - toFill - toNew} skipped</span>
                <div className="flex gap-2"><Button variant="ghost" onClick={() => setFile(null)}>Discard</Button><Button onClick={() => void apply()}>Fill underwriting</Button></div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
