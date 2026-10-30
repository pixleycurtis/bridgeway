import { createFileRoute, Link } from "@tanstack/react-router";
import { analyzeDeal } from "@/lib/model";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Stat } from "@/components/app-shell";
import { ActualsEditor } from "@/components/portfolio-actuals";
import { StageBadge } from "@/components/app-shell";
import { useDeals, type Deal } from "@/lib/deals-store";
import { analyze, pct, usd } from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/portfolio")({
  head: () => ({
    meta: [
      { title: "Portfolio — Bridgeway" },
      { name: "description", content: "Closed deals with quarterly actuals measured against your underwrite." },
      { property: "og:title", content: "Portfolio — Bridgeway" },
      { property: "og:description", content: "Closed deals with quarterly actuals measured against your underwrite." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Portfolio,
});

function Portfolio() {
  const { deals, loading } = useDeals();
  const closed = deals.filter((d) => d.stage === "Closed");
  const [openId, setOpenId] = useState<string | null>(null);
  const [variance, setVariance] = useState<Record<string, number>>({});

  useEffect(() => {
    (async () => {
      const ids = closed.map((d) => d.id);
      if (!ids.length) return;
      const { data } = await supabase.from("deal_actuals").select("deal_id, revenue, other_income, expenses").in("deal_id", ids);
      const next: Record<string, number> = {};
      for (const r of (data ?? []) as { deal_id: string; revenue: string | number; other_income: string | number; expenses: string | number }[]) {
        next[r.deal_id] = (next[r.deal_id] ?? 0) + Number(r.revenue) + Number(r.other_income) - Number(r.expenses);
      }
      setVariance(next);
    })();
  }, [closed.map((d) => d.id).join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalBasis = closed.reduce((s, d) => s + (d.finalPrice ?? d.assumptions.price), 0);

  return (
    <div>
      <PageHeader eyebrow="Portfolio" title="Closed & owned" />
      <div className="flex flex-wrap gap-y-4 px-6 py-6 md:px-10">
        <Stat label="Closed deals" value={String(closed.length)} />
        <Stat label="Total basis" value={usd(totalBasis, true)} />
        <Stat label="Units" value={String(closed.reduce((s, d) => s + d.assumptions.units, 0))} />
      </div>
      <div className="px-6 pb-12 md:px-10">
        {loading ? (
          <p className="rounded-md border bg-card p-8 text-center text-sm text-muted-foreground">Loading…</p>
        ) : closed.length === 0 ? (
          <p className="rounded-md border bg-card p-8 text-center text-sm text-muted-foreground">
            No closed deals yet. Move a deal to <b>Closed</b> on the pipeline and it shows up here.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto rounded-md border bg-card">
              <table className="w-full text-sm">
                <thead className="border-b text-left text-[11px] uppercase tracking-widest text-muted-foreground">
                  <tr><th className="px-4 py-3 font-medium">Deal</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 text-right font-medium">Basis</th><th className="px-4 py-3 text-right font-medium">Underwritten NOI</th><th className="px-4 py-3 text-right font-medium">Actuals to date</th><th /></tr>
                </thead>
                <tbody>
                  {closed.map((d) => <ClosedRow key={d.id} d={d} noiToDate={variance[d.id] ?? null} open={openId === d.id} onToggle={() => setOpenId(openId === d.id ? null : d.id)} />)}
                </tbody>
              </table>
            </div>
            {openId && (() => {
              const d = closed.find((x) => x.id === openId);
              return d ? (
                <div className="rounded-md border bg-card p-6">
                  <h2 className="font-display text-2xl">{d.name} — actuals</h2>
                  <div className="mt-4"><ActualsEditor deal={d} /></div>
                </div>
              ) : null;
            })()}
          </div>
        )}
      </div>
    </div>
  );
}

function ClosedRow({ d, noiToDate, open, onToggle }: { d: Deal; noiToDate: number | null; open: boolean; onToggle: () => void }) {
  const r = analyzeDeal(d);
  const hasActuals = noiToDate != null;
  return (
    <tr className={`border-b last:border-0 hover:bg-muted/60 ${open ? "bg-muted/40" : ""}`}>
      <td className="px-4 py-3">
        <Link to="/deals/$dealId" params={{ dealId: d.id }} className="font-medium hover:underline">{d.name}</Link>
        <div className="text-xs text-muted-foreground">{d.market} · {d.assumptions.units} units</div>
      </td>
      <td className="px-4 py-3"><StageBadge stage={d.stage} /></td>
      <td className="num px-4 py-3 text-right">{usd(d.finalPrice ?? d.assumptions.price, true)}</td>
      <td className="num px-4 py-3 text-right">{usd(r.noi, true)} <span className="text-xs text-muted-foreground">({pct(r.capRate, 2)} cap)</span></td>
      <td className={`num px-4 py-3 text-right ${!hasActuals ? "text-muted-foreground" : ""}`}>
        {hasActuals ? usd(noiToDate!, true) : <span className="text-xs">Log actuals →</span>}
      </td>
      <td className="px-4 py-3 text-right">
        <button className="rounded border px-3 py-1 text-xs hover:bg-accent" onClick={onToggle}>{open ? "Hide" : "Actuals"}</button>
      </td>
    </tr>
  );
}
