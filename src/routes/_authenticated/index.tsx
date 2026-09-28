import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader, Stat, StageBadge } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { blankDeal, useDeals } from "@/lib/deals-store";
import { analyze, pct, sumBy, usd } from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Pipeline — Keystone" },
      { name: "description", content: "Every deal you're underwriting, with broker-vs-actual gaps and returns at a glance." },
      { property: "og:title", content: "Pipeline — Keystone" },
      { property: "og:description", content: "Every deal you're underwriting, with broker-vs-actual gaps and returns at a glance." },
    ],
  }),
  component: Pipeline,
});

function Pipeline() {
  const { deals } = useDeals();
  const active = deals.filter((d) => !["Closed", "Passed"].includes(d.stage));
  const volume = active.reduce((s, d) => s + d.assumptions.price, 0);
  return (
    <div>
      <PageHeader eyebrow="Pipeline" title="Your deals">
        <NewDeal />
      </PageHeader>
      <div className="flex flex-wrap gap-y-4 px-6 py-6 md:px-10">
        <Stat label="Active deals" value={String(active.length)} />
        <Stat label="Active volume" value={usd(volume, true)} />
        <Stat label="Closed" value={String(deals.filter((d) => d.stage === "Closed").length)} />
        <Stat label="Passed" value={String(deals.filter((d) => d.stage === "Passed").length)} />
      </div>

      <div className="px-6 pb-12 md:px-10">
        <div className="overflow-x-auto rounded-md border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-[11px] uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Deal</th>
                <th className="px-4 py-3 font-medium">Stage</th>
                <th className="px-4 py-3 text-right font-medium">Price</th>
                <th className="px-4 py-3 text-right font-medium">Broker cap</th>
                <th className="px-4 py-3 text-right font-medium">Your cap</th>
                <th className="px-4 py-3 text-right font-medium">NOI gap</th>
                <th className="px-4 py-3 text-right font-medium">IRR</th>
              </tr>
            </thead>
            <tbody>
              {deals.map((d) => {
                const b = sumBy(d.lines, "broker").noi;
                const r = analyze(d.lines, d.assumptions, d.adjustments);
                const gap = r.noi - b;
                return (
                  <tr key={d.id} className="border-b last:border-0 hover:bg-muted/60">
                    <td className="px-4 py-3">
                      <Link to="/deals/$dealId" params={{ dealId: d.id }} className="font-medium hover:underline">{d.name}</Link>
                      <div className="text-xs text-muted-foreground">{d.market} · {d.assumptions.units} units</div>
                    </td>
                    <td className="px-4 py-3"><StageBadge stage={d.stage} /></td>
                    <td className="num px-4 py-3 text-right">{usd(d.assumptions.price, true)}</td>
                    <td className="num px-4 py-3 text-right text-muted-foreground">{pct(b / d.assumptions.price, 2)}</td>
                    <td className="num px-4 py-3 text-right">{pct(r.capRate, 2)}</td>
                    <td className={`num px-4 py-3 text-right ${gap < 0 ? "text-destructive" : "text-positive"}`}>{usd(gap, true)}</td>
                    <td className={`num px-4 py-3 text-right ${r.irr < d.targetIrr ? "text-warning" : "text-positive"}`}>{pct(r.irr)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">NOI gap = your underwritten NOI minus the broker's pro forma NOI, after diligence adjustments.</p>
      </div>
    </div>
  );
}

function NewDeal() {
  const { create } = useDeals();
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [market, setMarket] = useState("");
  return (
    <Dialog>
      <DialogTrigger asChild><Button>New deal</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle className="font-display text-2xl font-normal">Start a deal</DialogTitle></DialogHeader>
        <form className="space-y-3" onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim()) return;
          const id = await create(name.trim(), market.trim());
          if (id) nav({ to: "/deals/$dealId", params: { dealId: id } });
        }}>
          <Input placeholder="Property name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="Market (e.g. Dayton, OH)" value={market} onChange={(e) => setMarket(e.target.value)} />
          <Button type="submit" className="w-full">Create and open</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
