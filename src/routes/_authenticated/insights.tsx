import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { PageHeader, Stat } from "@/components/app-shell";
import { useDeals, type Deal } from "@/lib/deals-store";
import { analyze, pct, sumBy, usd } from "@/lib/finance";
import { useWorkspace } from "@/lib/workspace";
import { allStages, daysInStage, isOpen } from "@/lib/firm-settings";

export const Route = createFileRoute("/_authenticated/insights")({
  head: () => ({
    meta: [
      { title: "Insights — Keystone" },
      { name: "description", content: "Return, risk, management, tax and liquidity insights across your pipeline, filtered by property type and market." },
      { property: "og:title", content: "Insights — Keystone" },
      { property: "og:description", content: "Return, risk, management, tax and liquidity insights across your pipeline, filtered by property type and market." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Insights,
});

const avg = (xs: number[]) => { const v = xs.filter(Number.isFinite); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN; };
const line = (d: Deal, key: string) => d.lines.find((l) => l.key === key)?.underwrite ?? 0;

function enrich(d: Deal) {
  const r = analyze(d.lines, d.assumptions, d.adjustments);
  const a = d.assumptions;
  const gpr = line(d, "gpr");
  const egi = r.income - line(d, "vacancy");
  const opex = r.expenses - line(d, "vacancy");
  const commercial = !/multi|apartment|residential|town/i.test(d.propertyType);
  const rateUp = analyze(d.lines, { ...a, rate: a.rate + 0.01 }, d.adjustments);
  return {
    d, r,
    perUnit: a.price / (a.units || 1),
    expenseRatio: egi ? opex / egi : NaN,
    opexUnit: opex / (a.units || 1),
    mgmtPct: egi ? line(d, "mgmt") / egi : NaN,
    taxUnit: line(d, "taxes") / (a.units || 1),
    effTax: a.price ? line(d, "taxes") / a.price : NaN,
    depreciation: (a.price * 0.8) / (commercial ? 39 : 27.5),
    breakEven: gpr ? (opex + r.debtService) / gpr : NaN,
    debtYield: r.loan ? r.noi / r.loan : NaN,
    capSpread: a.exitCap - r.capRate,
    rateShock: rateUp.irr - r.irr,
    days: daysInStage(d.stageHistory, d.createdAt),
  };
}

function Insights() {
  const { deals } = useDeals();
  const { settings } = useWorkspace();
  const stages = allStages(settings);
  const types = [...new Set([...settings.propertyTypes, ...deals.map((d) => d.propertyType)])];
  const markets = [...new Set(deals.map((d) => d.market).filter(Boolean))].sort();
  const [selTypes, setSelTypes] = useState<string[]>([]);
  const [market, setMarket] = useState("");
  const [scope, setScope] = useState<"all" | "active" | "closed">("all");
  const [minUnits, setMinUnits] = useState(0);
  const [maxPrice, setMaxPrice] = useState(0);

  const set = deals.filter((d) =>
    (!selTypes.length || selTypes.includes(d.propertyType)) && (!market || d.market === market) &&
    (scope === "all" || (scope === "active" ? isOpen(d.stage) : d.stage === "Closed")) &&
    d.assumptions.units >= minUnits && (!maxPrice || d.assumptions.price <= maxPrice));
  const e = useMemo(() => set.map(enrich), [set]);

  const reached = (s: string) => set.filter((d) => d.stageHistory.some((h) => h.stage === s) || stages.indexOf(d.stage) >= stages.indexOf(s) && d.stage !== "Passed").length;
  const loi = reached("LOI");
  const closed = set.filter((d) => d.stage === "Closed");
  const passed = set.filter((d) => d.stage === "Passed");

  const keys = set[0]?.lines.map((l) => ({ key: l.key, label: l.label, kind: l.kind })) ?? [];
  const misses = keys.map((k) => {
    const pairs = set.map((d) => d.lines.find((l) => l.key === k.key)!).filter((l) => l && l.broker > 0);
    const gaps = pairs.map((l) => (l.t12 - l.broker) / l.broker);
    const worse = pairs.filter((l) => (k.kind === "expense" ? l.t12 > l.broker : l.t12 < l.broker)).length;
    return { ...k, avg: avg(gaps), worse, n: pairs.length };
  }).filter((r) => r.n > 0).sort((a, b) => Math.abs(b.avg) - Math.abs(a.avg));
  const maxMiss = Math.max(...misses.map((r) => Math.abs(r.avg)), 0.01);

  const byMarket = [...new Set(set.map((d) => d.market || "—"))].map((m) => {
    const g = e.filter((x) => (x.d.market || "—") === m);
    return { m, n: g.length, perUnit: avg(g.map((x) => x.perUnit)), cap: avg(g.map((x) => x.r.capRate)), opexUnit: avg(g.map((x) => x.opexUnit)), taxUnit: avg(g.map((x) => x.taxUnit)), irr: avg(g.map((x) => x.r.irr)) };
  }).sort((a, b) => b.n - a.n);

  const retrades = closed.map((d) => ({ d, ask: d.askingPrice ?? d.assumptions.price, fin: d.finalPrice ?? d.assumptions.price })).filter((x) => x.ask > 0);
  const discount = avg(retrades.map((x) => (x.ask - x.fin) / x.ask));
  const reasons = Object.entries(passed.reduce<Record<string, number>>((m, d) => { const k = d.passReason || "No reason logged"; m[k] = (m[k] ?? 0) + 1; return m; }, {})).sort((a, b) => b[1] - a[1]);

  const stageDays = settings.stages.map((s) => {
    const spans: number[] = [];
    set.forEach((d) => d.stageHistory.forEach((h, i) => {
      if (h.stage !== s) return;
      const end = d.stageHistory[i + 1]?.at ?? (d.stage === s ? new Date().toISOString() : null);
      if (end) spans.push((new Date(end).getTime() - new Date(h.at).getTime()) / 86_400_000);
    }));
    return { s, days: avg(spans), n: spans.length };
  });
  const stalled = e.filter((x) => isOpen(x.d.stage) && x.days >= settings.stallDays);
  const retradeLogged = set.reduce((s, d) => s + d.adjustments.reduce((x, a) => x + a.amount, 0), 0);

  return (
    <div>
      <PageHeader eyebrow="Insights" title="What your pipeline is teaching you" />

      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b bg-background/95 px-6 py-3 backdrop-blur md:px-10">
        <span className="mr-1 text-xs uppercase tracking-widest text-muted-foreground">Filter</span>
        {types.map((t) => {
          const on = selTypes.includes(t);
          return <button key={t} onClick={() => setSelTypes(on ? selTypes.filter((x) => x !== t) : [...selTypes, t])}
            className={`rounded-full border px-3 py-1 text-xs ${on ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"}`}>{t}</button>;
        })}
        <select value={market} onChange={(ev) => setMarket(ev.target.value)} className="h-8 rounded-md border bg-card px-2 text-xs">
          <option value="">All markets</option>{markets.map((m) => <option key={m}>{m}</option>)}
        </select>
        <select value={scope} onChange={(ev) => setScope(ev.target.value as never)} className="h-8 rounded-md border bg-card px-2 text-xs">
          <option value="all">All deals</option><option value="active">Active only</option><option value="closed">Closed only</option>
        </select>
        <label className="flex items-center gap-1 text-xs text-muted-foreground">Min units <input type="number" value={minUnits || ""} onChange={(ev) => setMinUnits(Number(ev.target.value) || 0)} className="num h-8 w-16 rounded-md border bg-card px-2" /></label>
        <label className="flex items-center gap-1 text-xs text-muted-foreground">Max price <input type="number" value={maxPrice || ""} placeholder="any" onChange={(ev) => setMaxPrice(Number(ev.target.value) || 0)} className="num h-8 w-28 rounded-md border bg-card px-2" /></label>
        <span className="ml-auto text-xs text-muted-foreground">{set.length} of {deals.length} deals</span>
      </div>

      {!set.length ? <p className="px-10 py-16 text-center text-sm text-muted-foreground">No deals match these filters.</p> : (
        <div className="space-y-10 px-6 py-8 md:px-10">
          <div className="flex flex-wrap gap-y-4">
            <Stat label="Deals" value={String(set.length)} />
            <Stat label="LOI → close" value={loi ? pct(closed.length / loi, 0) : "—"} />
            <Stat label="Avg levered IRR" value={pct(avg(e.map((x) => x.r.irr)))} />
            <Stat label="Avg price / unit" value={usd(avg(e.map((x) => x.perUnit)), true)} />
            <Stat label="DD findings logged" value={usd(retradeLogged, true)} />
          </div>

          <section>
            <h2 className="font-display text-2xl">The five factors</h2>
            <p className="mt-1 text-sm text-muted-foreground">Averages across the filtered deals, using your underwritten numbers.</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <Factor title="Return" rows={[["Levered IRR", pct(avg(e.map((x) => x.r.irr)))], ["Cash-on-cash Y1", pct(avg(e.map((x) => x.r.cashOnCash)))], ["Equity multiple", avg(e.map((x) => x.r.equityMultiple)).toFixed(2) + "x"], ["Going-in cap", pct(avg(e.map((x) => x.r.capRate)), 2)]]} />
              <Factor title="Risk" rows={[["DSCR", avg(e.map((x) => x.r.dscr)).toFixed(2) + "x"], ["Break-even occupancy", pct(avg(e.map((x) => x.breakEven)))], ["Debt yield", pct(avg(e.map((x) => x.debtYield)))], ["IRR if rate +1%", pct(avg(e.map((x) => x.rateShock)))]]}
                note={`${e.filter((x) => x.r.dscr < 1.25).length} deal(s) below 1.25x DSCR`} />
              <Factor title="Management" rows={[["Expense ratio", pct(avg(e.map((x) => x.expenseRatio)))], ["Opex / unit", usd(avg(e.map((x) => x.opexUnit)))], ["Mgmt fee % EGI", pct(avg(e.map((x) => x.mgmtPct)))]]} />
              <Factor title="Taxability" rows={[["Property tax / unit", usd(avg(e.map((x) => x.taxUnit)))], ["Effective tax rate", pct(avg(e.map((x) => x.effTax)), 2)], ["Est. yearly depreciation", usd(avg(e.map((x) => x.depreciation)), true)]]}
                note="Depreciation: 80% of price over 27.5 yrs (residential) or 39 yrs (commercial). Confirm with your CPA." />
              <Factor title="Liquidity" rows={[["Avg hold", avg(set.map((d) => d.assumptions.holdYears)).toFixed(1) + " yrs"], ["Exit vs. entry cap", (avg(e.map((x) => x.capSpread)) * 10000).toFixed(0) + " bps"], ["Stalled deals", String(stalled.length)]]}
                note="Positive exit spread = you assume cap rates widen (conservative)." />
            </div>
          </section>

          <section className="grid gap-8 xl:grid-cols-[1fr_340px]">
            <div>
              <h2 className="font-display text-2xl">Market comparison</h2>
              <div className="mt-4 overflow-x-auto rounded-md border bg-card">
                <table className="w-full text-sm">
                  <thead className="border-b text-left text-[11px] uppercase tracking-widest text-muted-foreground">
                    <tr>{["Market", "Deals", "Price / unit", "Cap rate", "Opex / unit", "Tax / unit", "IRR"].map((h, i) => <th key={h} className={`px-4 py-3 font-medium ${i ? "text-right" : ""}`}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {byMarket.map((m) => (
                      <tr key={m.m} className="border-b last:border-0">
                        <td className="px-4 py-2.5">{m.m}</td>
                        {[String(m.n), usd(m.perUnit, true), pct(m.cap, 2), usd(m.opexUnit), usd(m.taxUnit), pct(m.irr)].map((v, i) => <td key={i} className="num px-4 py-2.5 text-right">{v}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <Card title="Funnel">
              <ul className="space-y-2 text-sm">
                {stages.filter((s) => s !== "Passed").map((s) => <li key={s} className="flex justify-between"><span>{s}</span><span className="num">{reached(s)}</span></li>)}
                <li className="flex justify-between border-t pt-2 text-muted-foreground"><span>Passed</span><span className="num">{passed.length}</span></li>
              </ul>
            </Card>
          </section>

          <section className="grid gap-6 md:grid-cols-3">
            <Card title="Speed & stalls">
              <ul className="space-y-2 text-sm">
                {stageDays.map((s) => <li key={s.s} className="flex justify-between"><span>{s.s}</span><span className="num">{s.n ? `${s.days.toFixed(0)} days avg` : "—"}</span></li>)}
              </ul>
              {stalled.length > 0 && <p className="mt-3 border-t pt-3 text-xs text-warning">Stalled: {stalled.map((x) => x.d.name).join(", ")}</p>}
            </Card>
            <Card title="Retrade results">
              <div className="num text-3xl">{Number.isFinite(discount) ? pct(discount) : "—"}</div>
              <p className="text-xs text-muted-foreground">average discount off asking on closed deals</p>
              <ul className="mt-3 space-y-1 text-xs">
                {retrades.map((x) => <li key={x.d.id} className="flex justify-between"><span className="truncate">{x.d.name}</span><span className="num">{usd(x.ask, true)} → {usd(x.fin, true)}</span></li>)}
              </ul>
            </Card>
            <Card title="Why deals die">
              {reasons.length ? (
                <ul className="space-y-2 text-sm">{reasons.map(([r, n]) => <li key={r} className="flex justify-between"><span>{r}</span><span className="num">{n}</span></li>)}</ul>
              ) : <p className="text-sm text-muted-foreground">No passed deals in this view.</p>}
              {closed.length > 0 && passed.length > 0 && (
                <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">Closed deals averaged {pct(avg(closed.map((d) => enrich(d).r.irr)))} IRR vs. {pct(avg(passed.map((d) => enrich(d).r.irr)))} on passed deals.</p>
              )}
            </Card>
          </section>

          <section>
            <h2 className="font-display text-2xl">Where brokers miss</h2>
            <p className="mt-1 text-sm text-muted-foreground">Average gap between the OM and the trailing-12.</p>
            <div className="mt-4 divide-y rounded-md border bg-card">
              {misses.map((r) => {
                const bad = r.kind === "expense" ? r.avg > 0 : r.avg < 0;
                return (
                  <div key={r.key} className="grid grid-cols-[160px_1fr_70px_110px] items-center gap-4 px-4 py-3 text-sm">
                    <span>{r.label}</span>
                    <div className="h-2 rounded bg-muted"><div className={`h-2 rounded ${bad ? "bg-destructive" : "bg-positive"}`} style={{ width: `${(Math.abs(r.avg) / maxMiss) * 100}%` }} /></div>
                    <span className={`num text-right ${bad ? "text-destructive" : "text-positive"}`}>{r.avg > 0 ? "+" : ""}{pct(r.avg, 0)}</span>
                    <span className="text-right text-xs text-muted-foreground">worse in {r.worse}/{r.n}</span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function Factor({ title, rows, note }: { title: string; rows: [string, string][]; note?: string }) {
  return (
    <div className="rounded-md border bg-card p-4">
      <div className="text-[11px] uppercase tracking-widest text-muted-foreground">{title}</div>
      <dl className="mt-3 space-y-2 text-sm">
        {rows.map(([k, v]) => <div key={k} className="flex justify-between gap-2"><dt className="text-muted-foreground">{k}</dt><dd className="num">{v}</dd></div>)}
      </dl>
      {note && <p className="mt-3 border-t pt-2 text-[11px] text-muted-foreground">{note}</p>}
    </div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return <div className="rounded-md border bg-card p-5"><div className="mb-3 text-[11px] uppercase tracking-widest text-muted-foreground">{title}</div>{children}</div>;
}
