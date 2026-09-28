import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDealRows, type Actual } from "@/lib/deal-tables";
import type { Deal } from "@/lib/deals-store";
import { analyze, pct, usd } from "@/lib/finance";

/** Quarterly actual results for one closed deal, against the underwrite. */
export function ActualsEditor({ deal }: { deal: Deal }) {
  const { rows, remove, reload } = useDealRows<Actual>("deal_actuals", deal.id, "period");
  const [period, setPeriod] = useState(suggestPeriod());
  const [revenue, setRevenue] = useState("");
  const [otherIncome, setOtherIncome] = useState("");
  const [expenses, setExpenses] = useState("");

  const r = analyze(deal.lines, deal.assumptions, deal.adjustments);
  const totals = useMemo(() => {
    const rev = rows.reduce((s, a) => s + a.revenue, 0);
    const oth = rows.reduce((s, a) => s + a.otherIncome, 0);
    const exp = rows.reduce((s, a) => s + a.expenses, 0);
    return { rev, oth, exp, noi: rev + oth - exp };
  }, [rows]);
  const projected = rows.length ? (totals.noi / rows.length) * 4 : 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rev = parseFloat(revenue) || 0, exp = parseFloat(expenses) || 0;
    if (!period.trim()) { toast.error("Add a period, e.g. 2026-Q1"); return; }
    const { error } = await supabase.from("deal_actuals").upsert({
      deal_id: deal.id, firm_id: deal.firmId, period: period.trim(), revenue: rev, other_income: parseFloat(otherIncome) || 0, expenses: exp,
    }, { onConflict: "deal_id,period" });
    if (error) { toast.error(error.message); return; }
    setRevenue(""); setOtherIncome(""); setExpenses(""); setPeriod(suggestPeriod());
    await reload();
  };

  return (
    <div>
      <p className="text-sm text-muted-foreground">Log what the property actually does each quarter. Keystone compares it to what you underwrote.</p>
      {deal.canEdit && (
        <form onSubmit={submit} className="mt-4 flex flex-wrap items-end gap-2 rounded-md border bg-card p-4">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">Period
            <Input className="h-8 w-28" placeholder="2026-Q1" value={period} onChange={(e) => setPeriod(e.target.value)} /></label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">Rental revenue
            <Input className="num h-8 w-32 text-right" type="number" value={revenue} onChange={(e) => setRevenue(e.target.value)} /></label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">Other income
            <Input className="num h-8 w-28 text-right" type="number" value={otherIncome} onChange={(e) => setOtherIncome(e.target.value)} /></label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">Operating expenses
            <Input className="num h-8 w-32 text-right" type="number" value={expenses} onChange={(e) => setExpenses(e.target.value)} /></label>
          <Button type="submit" size="sm" variant="secondary">Save quarter</Button>
        </form>
      )}
      <div className="mt-4 overflow-x-auto rounded-md border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b text-left text-[11px] uppercase tracking-widest text-muted-foreground">
            <tr><th className="px-4 py-3 font-medium">Period</th><th className="px-4 py-3 text-right font-medium">Revenue</th><th className="px-4 py-3 text-right font-medium">Other income</th><th className="px-4 py-3 text-right font-medium">Expenses</th><th className="px-4 py-3 text-right font-medium">Actual NOI</th><th className="px-4 py-3 text-right font-medium">vs. quarter of underwrite</th><th /></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No actuals logged yet.</td></tr>}
            {rows.map((a) => {
              const qUnder = r.noi / 4;
              const delta = a.revenue + a.otherIncome - a.expenses - qUnder;
              return (
                <tr key={a.id} className="border-b last:border-0">
                  <td className="px-4 py-2.5 font-medium">{a.period}</td>
                  <td className="num px-4 py-2.5 text-right">{usd(a.revenue, true)}</td>
                  <td className="num px-4 py-2.5 text-right">{usd(a.otherIncome, true)}</td>
                  <td className="num px-4 py-2.5 text-right">{usd(a.expenses, true)}</td>
                  <td className="num px-4 py-2.5 text-right font-medium">{usd(a.revenue + a.otherIncome - a.expenses, true)}</td>
                  <td className={`num px-4 py-2.5 text-right ${delta < 0 ? "text-destructive" : "text-positive"}`}>{delta >= 0 ? "+" : ""}{usd(delta, true)}</td>
                  <td className="px-4 py-2.5 text-right">{deal.canEdit && <button className="text-xs text-muted-foreground hover:text-destructive" onClick={() => remove(a.id)}>Remove</button>}</td>
                </tr>
              );
            })}
            {rows.length > 0 && (
              <tr className="border-t-2 font-medium">
                <td className="px-4 py-3">Total · {rows.length} {rows.length === 1 ? "quarter" : "quarters"}</td>
                <td className="num px-4 py-3 text-right">{usd(totals.rev, true)}</td>
                <td className="num px-4 py-3 text-right">{usd(totals.oth, true)}</td>
                <td className="num px-4 py-3 text-right">{usd(totals.exp, true)}</td>
                <td className="num px-4 py-3 text-right">{usd(totals.noi, true)}</td>
                <td className="num px-4 py-3 text-right text-muted-foreground">{rows.length ? `Run-rate NOI ${usd(projected, true)}` : ""}</td>
                <td />
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {rows.length > 0 && (
        <p className={`num mt-2 text-sm ${projected >= r.noi ? "text-positive" : "text-destructive"}`}>
          Annualized run-rate {usd(projected, true)} vs. underwritten {usd(r.noi, true)} ({pct((projected - r.noi) / (r.noi || 1), 1)})
        </p>
      )}
    </div>
  );
}

function suggestPeriod() {
  const now = new Date();
  const q = Math.floor(now.getUTCMonth() / 3) + 1;
  return `${now.getUTCFullYear()}-Q${q}`;
}
