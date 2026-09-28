import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDealRows, type Quote } from "@/lib/deal-tables";
import type { Deal } from "@/lib/deals-store";
import { pct, usd } from "@/lib/finance";

const STATUSES = ["quoting", "term sheet", "best execution", "signed", "dropped"];

export function LenderQuotes({ deal }: { deal: Deal }) {
  const { rows, add, update, remove } = useDealRows<Quote>("deal_lender_quotes", deal.lenderQuotesHint ?? deal.id);
  const [f, setF] = useState({ lender: "", program: "", loanAmount: "", rate: "", amortYears: "", ioYears: "", dscrTest: "", feeBps: "", recourse: "Non-recourse" });
  const [status, setStatus] = useState(STATUSES[0]);
  const live = rows.filter((q) => q.status !== "dropped" && q.status !== "signed");
  const best = useMemo(() => {
    const withRate = live.filter((q) => q.rate != null);
    if (!withRate.length) return null;
    return withRate.reduce((a, b) => ((a.rate ?? 99) <= (b.rate ?? 99) ? a : b));
  }, [live]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.lender.trim()) return;
    const n = (s: string) => (s === "" ? null : Number(s));
    await add({
      lender: f.lender.trim(), program: f.program || null, loan_amount: n(f.loanAmount), rate: f.rate === "" ? null : Number(f.rate) / 100,
      amort_years: n(f.amortYears), io_years: n(f.ioYears), dscr_test: f.dscrTest === "" ? null : Number(f.dscrTest),
      fee_bps: n(f.feeBps), recourse: f.recourse, status, notes: null,
    });
    setF({ ...f, lender: "", program: "" });
  };

  const setQ = (id: string, patch: Partial<Quote>) => update(id, patch as Record<string, unknown>);

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-display text-2xl">Quotes</h2>
        <span className="text-xs text-muted-foreground">
          {best ? <>Best rate so far: <b className="num text-foreground">{pct(best.rate ?? 0, 2)}</b> from {best.lender}</> : "Add term sheets to compare"}
        </span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Your underwrite assumes {pct(deal.assumptions.rate, 2)} with {deal.assumptions.amortYears}-year amortization — every quote is measured against that.
      </p>

      {deal.canEdit && (
        <form onSubmit={submit} className="mt-4 flex flex-wrap items-end gap-2 rounded-md border bg-card p-4">
          <Field label="Lender"><Input className="h-8 w-40" value={f.lender} onChange={(e) => setF({ ...f, lender: e.target.value })} /></Field>
          <Field label="Program"><Input className="h-8 w-36" placeholder="5-yr fixed" value={f.program} onChange={(e) => setF({ ...f, program: e.target.value })} /></Field>
          <Field label="Loan"><Input className="num h-8 w-28 text-right" type="number" value={f.loanAmount} onChange={(e) => setF({ ...f, loanAmount: e.target.value })} /></Field>
          <Field label="Rate %"><Input className="num h-8 w-20 text-right" type="number" step="0.01" value={f.rate} onChange={(e) => setF({ ...f, rate: e.target.value })} /></Field>
          <Field label="Amort"><Input className="num h-8 w-16 text-right" type="number" value={f.amortYears} onChange={(e) => setF({ ...f, amortYears: e.target.value })} /></Field>
          <Field label="IO yrs"><Input className="num h-8 w-16 text-right" type="number" value={f.ioYears} onChange={(e) => setF({ ...f, ioYears: e.target.value })} /></Field>
          <Field label="Min DSCR"><Input className="num h-8 w-20 text-right" type="number" step="0.01" value={f.dscrTest} onChange={(e) => setF({ ...f, dscrTest: e.target.value })} /></Field>
          <Field label="Fee (bps)"><Input className="num h-8 w-20 text-right" type="number" value={f.feeBps} onChange={(e) => setF({ ...f, feeBps: e.target.value })} /></Field>
          <Field label="Recourse">
            <select value={f.recourse} onChange={(e) => setF({ ...f, recourse: e.target.value })} className="h-8 rounded-md border bg-card px-2 text-sm">
              <option>Non-recourse</option><option>Partial recourse</option><option>Full recourse</option>
            </select>
          </Field>
          <Field label="Status">
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-8 rounded-md border bg-card px-2 text-sm">
              {STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Button type="submit" size="sm">Add quote</Button>
        </form>
      )}

      <div className="mt-4 overflow-x-auto rounded-md border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b text-left text-[11px] uppercase tracking-widest text-muted-foreground">
            <tr><th className="px-4 py-3 font-medium">Lender</th><th className="px-4 py-3 font-medium">Program</th><th className="px-4 py-3 text-right font-medium">Loan</th><th className="px-4 py-3 text-right font-medium">Rate</th><th className="px-4 py-3 text-right font-medium">Amort</th><th className="px-4 py-3 text-right font-medium">IO</th><th className="px-4 py-3 text-right font-medium">Min DSCR</th><th className="px-4 py-3 text-right font-medium">Fee</th><th className="px-4 py-3 font-medium">Recourse</th><th className="px-4 py-3 font-medium">Status</th><th /></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={11} className="px-4 py-8 text-center text-muted-foreground">No quotes yet.</td></tr>}
            {rows.map((q) => (
              <tr key={q.id} className="border-b last:border-0">
                <td className="px-4 py-2.5 font-medium">{q.lender}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{q.program ?? "—"}</td>
                <td className="num px-4 py-2.5 text-right">{q.loanAmount ? usd(q.loanAmount, true) : "—"}</td>
                <td className={`num px-4 py-2.5 text-right ${q.id === best?.id ? "font-semibold text-positive" : ""}`}>{q.rate != null ? pct(q.rate, 2) : "—"}</td>
                <td className="num px-4 py-2.5 text-right">{q.amortYears ?? "—"}</td>
                <td className="num px-4 py-2.5 text-right">{q.ioYears ?? "—"}</td>
                <td className="num px-4 py-2.5 text-right">{q.dscrTest != null ? `${q.dscrTest.toFixed(2)}x` : "—"}</td>
                <td className="num px-4 py-2.5 text-right">{q.feeBps != null ? `${q.feeBps}` : "—"}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{q.recourse ?? "—"}</td>
                <td className="px-4 py-2.5">
                  {deal.canEdit ? (
                    <select value={q.status} onChange={(e) => setQ(q.id, { status: e.target.value })} className="rounded border bg-card px-1.5 py-1 text-xs capitalize">
                      {STATUSES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  ) : <span className="capitalize">{q.status}</span>}
                </td>
                <td className="px-4 py-2.5 text-right">
                  {deal.canEdit && <button className="text-xs text-muted-foreground hover:text-destructive" onClick={() => remove(q.id)}>Remove</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length > 0 && (
        <div className="mt-4 grid gap-px overflow-hidden rounded-md border bg-border sm:grid-cols-3">
          {[
            ["Quotes in play", String(live.length)],
            ["Rate spread", (() => {
              const rs = live.map((q) => q.rate).filter((r): r is number => r != null);
              return rs.length > 1 ? `${Math.round((Math.max(...rs) - Math.min(...rs)) * 10000)} bps` : "—";
            })()],
            ["DSCR your deal underwrites", `${deal.dscrHint?.toFixed(2) ?? ""}`.replace("NaN", "—") || "—"],
          ].map(([k, v]) => (
            <div key={k} className="bg-card p-4"><div className="text-xs text-muted-foreground">{k}</div><div className="num mt-1 text-lg">{v}</div></div>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="flex flex-col gap-1 text-xs text-muted-foreground">{label}{children}</label>;
}
