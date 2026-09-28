import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Stat } from "@/components/app-shell";
import { STAGES, useDeals } from "@/lib/deals-store";
import { pct, sumBy, usd } from "@/lib/finance";

export const Route = createFileRoute("/insights")({
  head: () => ({
    meta: [
      { title: "Insights — Keystone" },
      { name: "description", content: "Learn from every deal: where brokers miss, how often, and your LOI-to-close rate." },
      { property: "og:title", content: "Insights — Keystone" },
      { property: "og:description", content: "Learn from every deal: where brokers miss, how often, and your LOI-to-close rate." },
    ],
  }),
  component: Insights,
});

function Insights() {
  const { deals } = useDeals();
  const reached = (s: string) => deals.filter((d) => STAGES.indexOf(d.stage) >= STAGES.indexOf(s as never) && d.stage !== "Passed").length;
  const loi = reached("LOI");
  const closed = deals.filter((d) => d.stage === "Closed").length;
  const keys = deals[0]?.lines.map((l) => ({ key: l.key, label: l.label, kind: l.kind })) ?? [];
  const rows = keys.map((k) => {
    const pairs = deals.map((d) => d.lines.find((l) => l.key === k.key)!).filter((l) => l && l.broker > 0);
    const gaps = pairs.map((l) => (l.t12 - l.broker) / l.broker);
    const avg = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0;
    const worse = pairs.filter((l) => (k.kind === "expense" ? l.t12 > l.broker : l.t12 < l.broker)).length;
    return { ...k, avg, worse, n: pairs.length };
  }).filter((r) => r.n > 0).sort((a, b) => Math.abs(b.avg) - Math.abs(a.avg));
  const noiMiss = deals.map((d) => { const b = sumBy(d.lines, "broker").noi; return b ? (sumBy(d.lines, "t12").noi - b) / b : 0; });
  const avgMiss = noiMiss.reduce((a, b) => a + b, 0) / (noiMiss.length || 1);
  const retrade = deals.reduce((s, d) => s + d.adjustments.reduce((x, a) => x + a.amount, 0), 0);
  const max = Math.max(...rows.map((r) => Math.abs(r.avg)), 0.01);

  return (
    <div>
      <PageHeader eyebrow="Insights" title="What your pipeline is teaching you" />
      <div className="flex flex-wrap gap-y-4 px-6 py-6 md:px-10">
        <Stat label="Deals underwritten" value={String(deals.length)} />
        <Stat label="LOI → close" value={loi ? pct(closed / loi, 0) : "—"} />
        <Stat label="Avg broker NOI overstatement" value={pct(-avgMiss)} tone="neg" />
        <Stat label="DD findings logged" value={usd(retrade, true)} />
      </div>
      <div className="grid gap-8 px-6 pb-12 md:px-10 xl:grid-cols-[1fr_320px]">
        <div>
          <h2 className="font-display text-2xl">Where brokers miss</h2>
          <p className="mt-1 text-sm text-muted-foreground">Average gap between the OM and the trailing-12, across every deal you've entered.</p>
          <div className="mt-4 divide-y rounded-md border bg-card">
            {rows.map((r) => {
              const bad = r.kind === "expense" ? r.avg > 0 : r.avg < 0;
              return (
                <div key={r.key} className="grid grid-cols-[180px_1fr_70px_110px] items-center gap-4 px-4 py-3 text-sm">
                  <span>{r.label}</span>
                  <div className="h-2 rounded bg-muted">
                    <div className={`h-2 rounded ${bad ? "bg-destructive" : "bg-positive"}`} style={{ width: `${(Math.abs(r.avg) / max) * 100}%` }} />
                  </div>
                  <span className={`num text-right ${bad ? "text-destructive" : "text-positive"}`}>{r.avg > 0 ? "+" : ""}{pct(r.avg, 0)}</span>
                  <span className="text-right text-xs text-muted-foreground">worse in {r.worse}/{r.n} deals</span>
                </div>
              );
            })}
          </div>
        </div>
        <aside className="space-y-6">
          <div className="rounded-md border bg-card p-5">
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Funnel</div>
            <ul className="mt-3 space-y-2 text-sm">
              {STAGES.filter((s) => s !== "Passed").map((s) => (
                <li key={s} className="flex justify-between"><span>{s}</span><span className="num">{reached(s)}</span></li>
              ))}
              <li className="flex justify-between border-t pt-2 text-muted-foreground"><span>Passed</span><span className="num">{deals.filter((d) => d.stage === "Passed").length}</span></li>
            </ul>
          </div>
          {rows[0] && (
            <div className="rounded-md border bg-warning-soft p-5 text-sm">
              <div className="font-medium">Rule of thumb from your data</div>
              <p className="mt-1 text-muted-foreground">When a broker shows {rows[0].label.toLowerCase()}, the books have run {pct(Math.abs(rows[0].avg), 0)} {rows[0].avg > 0 ? "higher" : "lower"} on average. Underwrite accordingly.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
