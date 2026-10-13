import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Deal } from "@/lib/deals-store";
import { pct, usd } from "@/lib/finance";
import { parseUnderwriteCsv, type UnderwriteImport } from "@/lib/underwrite-csv";

const LABELS: Record<string, [string, "usd" | "pct" | "n"]> = {
  price: ["Purchase price", "usd"], units: ["Units", "n"], closingPct: ["Closing costs", "pct"], capex: ["Upfront capex", "usd"],
  ltv: ["LTV", "pct"], rate: ["Interest rate", "pct"], amortYears: ["Amortization (yrs)", "n"], rentGrowth: ["Rent growth", "pct"],
  expenseGrowth: ["Expense growth", "pct"], exitCap: ["Exit cap", "pct"], holdYears: ["Hold (yrs)", "n"], sellPct: ["Selling costs", "pct"],
};
const fmt = (v: number, t: "usd" | "pct" | "n") => (t === "usd" ? usd(v) : t === "pct" ? pct(v, 2) : String(v));

/** Upload an underwriting CSV, preview what was found, then apply. Fields stay editable afterwards. */
export function UnderwriteImport({ deal, set }: { deal: Deal; set: (p: Partial<Deal>) => void }) {
  const [res, setRes] = useState<{ name: string; data: UnderwriteImport } | null>(null);
  const [withFindings, setWithFindings] = useState(true);

  const onFile = async (file?: File) => {
    if (!file) return;
    const data = parseUnderwriteCsv(await file.text());
    const found = Object.keys(data.assumptions).length + Object.keys(data.lines).length + data.findings.length + (data.targetIrr != null ? 1 : 0);
    if (!found) { toast.error("Couldn't find any underwriting numbers in that file"); return; }
    setRes({ name: file.name, data });
  };

  const apply = () => {
    if (!res) return;
    const d = res.data;
    set({
      assumptions: { ...deal.assumptions, ...d.assumptions },
      lines: deal.lines.map((l) => (d.lines[l.key] != null ? { ...l, underwrite: d.lines[l.key]! } : l)),
      ...(d.targetIrr != null ? { targetIrr: d.targetIrr } : {}),
      ...(withFindings && d.findings.length ? { adjustments: [...deal.adjustments, ...d.findings] } : {}),
    });
    toast.success("Underwriting filled — every number is still editable");
    setRes(null);
  };

  const d = res?.data;
  return (
    <div>
      <label className="flex cursor-pointer items-center justify-between rounded border border-dashed bg-card px-4 py-2.5 text-sm hover:border-primary">
        <span>Upload underwriting CSV</span>
        <span className="text-xs text-muted-foreground">Choose file</span>
        <input type="file" accept=".csv,.txt" className="hidden" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ""; }} />
      </label>
      <Dialog open={!!res} onOpenChange={(o) => !o && setRes(null)}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader><DialogTitle className="font-display text-2xl font-normal">What we found in {res?.name}</DialogTitle></DialogHeader>
          {d && (
            <div className="space-y-4 text-sm">
              <table className="w-full">
                <thead className="text-xs text-muted-foreground"><tr><th className="py-1 text-left font-medium">Field</th><th className="text-right font-medium">Now</th><th className="pl-4 text-right font-medium">From file</th></tr></thead>
                <tbody>
                  {d.targetIrr != null && <tr className="border-b"><td className="py-1.5">Target IRR</td><td className="num text-right text-muted-foreground">{pct(deal.targetIrr)}</td><td className="num pl-4 text-right font-medium">{pct(d.targetIrr)}</td></tr>}
                  {Object.entries(d.assumptions).map(([k, v]) => { const [label, t] = LABELS[k] ?? [k, "n"]; return (
                    <tr key={k} className="border-b"><td className="py-1.5">{label}</td><td className="num text-right text-muted-foreground">{fmt(deal.assumptions[k as keyof typeof deal.assumptions] ?? 0, t)}</td><td className="num pl-4 text-right font-medium">{fmt(v ?? 0, t)}</td></tr>
                  ); })}
                  {deal.lines.filter((l) => d.lines[l.key] != null).map((l) => (
                    <tr key={l.key} className="border-b"><td className="py-1.5">{l.label}</td><td className="num text-right text-muted-foreground">{usd(l.underwrite)}</td><td className="num pl-4 text-right font-medium">{usd(d.lines[l.key]!)}</td></tr>
                  ))}
                </tbody>
              </table>
              {d.findings.length > 0 && (
                <label className="flex items-start gap-2">
                  <input type="checkbox" className="mt-1" checked={withFindings} onChange={(e) => setWithFindings(e.target.checked)} />
                  <span>Also add {d.findings.length} diligence finding{d.findings.length > 1 ? "s" : ""} to the retrade: {d.findings.map((f) => `${f.label} (${usd(f.amount)}${f.type === "annual" ? "/yr" : ""})`).join(", ")}</span>
                </label>
              )}
              {d.skipped.length > 0 && <div className="text-xs text-muted-foreground">Not recognized: {d.skipped.join(", ")}</div>}
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setRes(null)}>Discard</Button>
                <Button onClick={apply}>Fill underwriting</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
