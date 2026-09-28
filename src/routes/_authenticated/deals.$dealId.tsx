import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Stat } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { STAGES, useDeals, type Deal, type Stage } from "@/lib/deals-store";
import { analyze, pct, solvePrice, sumBy, usd, type Assumptions, type LineItem } from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/deals/$dealId")({
  head: () => ({
    meta: [
      { title: "Deal workspace — Keystone" },
      { name: "description", content: "Reconcile the broker OM, underwrite, and build a retrade from diligence findings." },
      { property: "og:title", content: "Deal workspace — Keystone" },
      { property: "og:description", content: "Reconcile the broker OM, underwrite, and build a retrade from diligence findings." },
    ],
  }),
  component: DealPage,
});

const STEPS = [
  { id: "reconcile", n: "01", label: "Reconcile", hint: "Broker OM vs. T-12" },
  { id: "underwrite", n: "02", label: "Underwrite", hint: "Assumptions & returns" },
  { id: "retrade", n: "03", label: "Diligence & retrade", hint: "Findings to price" },
] as const;
type StepId = (typeof STEPS)[number]["id"];

function DealPage() {
  const { dealId } = Route.useParams();
  const { deals, update } = useDeals();
  const deal = deals.find((d) => d.id === dealId);
  const [step, setStep] = useState<StepId>("reconcile");
  if (!deal) return <div className="p-10">Deal not found. <Link to="/" className="underline">Back to pipeline</Link></div>;
  const r = analyze(deal.lines, deal.assumptions, deal.adjustments);
  const set = (p: Partial<Deal>) => update(deal.id, p);

  return (
    <div>
      <div className="border-b px-6 pt-8 md:px-10">
        <Link to="/" className="text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground">← Pipeline</Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl tracking-tight">{deal.name}</h1>
            <p className="text-sm text-muted-foreground">{[deal.address, deal.market].filter(Boolean).join(" · ")} · {deal.assumptions.units} units</p>
          </div>
          <select value={deal.stage} onChange={(e) => set({ stage: e.target.value as Stage })}
            className="rounded-md border bg-card px-3 py-2 text-sm">
            {STAGES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div className="mt-6 flex flex-wrap gap-y-3">
          <Stat label="Price" value={usd(deal.assumptions.price, true)} />
          <Stat label="Year-1 NOI" value={usd(r.noi, true)} />
          <Stat label="Cap rate" value={pct(r.capRate, 2)} />
          <Stat label="DSCR" value={r.dscr.toFixed(2) + "x"} tone={r.dscr < 1.25 ? "neg" : undefined} />
          <Stat label="Levered IRR" value={pct(r.irr)} tone={r.irr < deal.targetIrr ? "warn" : "pos"} />
        </div>
        <nav className="mt-6 flex gap-1 overflow-x-auto">
          {STEPS.map((s) => (
            <button key={s.id} onClick={() => setStep(s.id)}
              className={`-mb-px border-b-2 px-4 py-3 text-left transition-colors ${step === s.id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              <span className="num mr-2 text-xs">{s.n}</span>
              <span className="text-sm font-medium">{s.label}</span>
              <span className="ml-2 hidden text-xs text-muted-foreground lg:inline">{s.hint}</span>
            </button>
          ))}
        </nav>
      </div>
      <div className="px-6 py-8 md:px-10">
        {step === "reconcile" && <Reconcile deal={deal} set={set} onNext={() => setStep("underwrite")} />}
        {step === "underwrite" && <Underwrite deal={deal} set={set} onNext={() => setStep("retrade")} />}
        {step === "retrade" && <Retrade deal={deal} set={set} />}
      </div>
    </div>
  );
}

const Num = ({ value, onChange, className = "" }: { value: number; onChange: (n: number) => void; className?: string }) => (
  <input type="number" value={Number.isFinite(value) ? value : 0} onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
    className={`num w-full rounded border border-transparent bg-transparent px-2 py-1 text-right hover:border-input focus:border-ring focus:bg-card focus:outline-none ${className}`} />
);

function Reconcile({ deal, set, onNext }: { deal: Deal; set: (p: Partial<Deal>) => void; onNext: () => void }) {
  const edit = (key: string, col: keyof LineItem, v: number) =>
    set({ lines: deal.lines.map((l) => (l.key === key ? { ...l, [col]: v } : l)) });
  const tot = { b: sumBy(deal.lines, "broker"), t: sumBy(deal.lines, "t12"), u: sumBy(deal.lines, "underwrite") };
  const flags = deal.lines
    .map((l) => ({ l, d: l.t12 - l.broker, p: l.broker ? (l.t12 - l.broker) / l.broker : l.t12 ? 1 : 0 }))
    .filter((x) => Math.abs(x.p) >= 0.1 && Math.abs(x.d) >= 1000)
    .sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
  return (
    <div className="grid gap-8 xl:grid-cols-[1fr_320px]">
      <div>
        <h2 className="font-display text-2xl">Broker said vs. the books</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Enter the OM pro forma and trailing-12 side by side. Anything off by 10%+ gets flagged, and your underwrite column is what drives returns.</p>
        <div className="mt-5 overflow-x-auto rounded-md border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b text-[11px] uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Line item</th>
                <th className="w-36 px-2 py-3 text-right font-medium">Broker OM</th>
                <th className="w-36 px-2 py-3 text-right font-medium">T-12</th>
                <th className="w-24 px-2 py-3 text-right font-medium">Gap</th>
                <th className="w-36 bg-accent/50 px-2 py-3 text-right font-medium text-accent-foreground">Your underwrite</th>
              </tr>
            </thead>
            <tbody>
              {deal.lines.map((l) => {
                const g = l.broker ? (l.t12 - l.broker) / l.broker : 0;
                const bad = l.kind === "expense" ? g > 0.1 : g < -0.1;
                const warn = Math.abs(g) >= 0.1;
                return (
                  <tr key={l.key} className="border-b last:border-0">
                    <td className="px-4 py-1.5">{l.label}<span className="ml-2 text-xs text-muted-foreground">{l.kind === "income" ? "income" : ""}</span></td>
                    <td className="px-2"><Num value={l.broker} onChange={(v) => edit(l.key, "broker", v)} /></td>
                    <td className="px-2"><Num value={l.t12} onChange={(v) => edit(l.key, "t12", v)} /></td>
                    <td className={`num px-2 text-right text-xs ${bad ? "text-destructive" : warn ? "text-warning" : "text-muted-foreground"}`}>{l.broker ? pct(g, 0) : "—"}</td>
                    <td className="bg-accent/30 px-2"><Num value={l.underwrite} onChange={(v) => edit(l.key, "underwrite", v)} className="font-medium" /></td>
                  </tr>
                );
              })}
              <tr className="border-t-2 font-medium">
                <td className="px-4 py-3">Net operating income</td>
                <td className="num px-4 text-right">{usd(tot.b.noi)}</td>
                <td className="num px-4 text-right">{usd(tot.t.noi)}</td>
                <td className="num px-2 text-right text-xs text-destructive">{tot.b.noi ? pct((tot.t.noi - tot.b.noi) / tot.b.noi, 0) : "—"}</td>
                <td className="num bg-accent/50 px-4 text-right">{usd(tot.u.noi)}</td>
              </tr>
              <tr className="text-muted-foreground">
                <td className="px-4 pb-3">Implied cap rate</td>
                <td className="num px-4 pb-3 text-right">{pct(tot.b.noi / deal.assumptions.price, 2)}</td>
                <td className="num px-4 pb-3 text-right">{pct(tot.t.noi / deal.assumptions.price, 2)}</td>
                <td />
                <td className="num bg-accent/30 px-4 pb-3 text-right">{pct(tot.u.noi / deal.assumptions.price, 2)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex justify-end"><Button onClick={onNext}>Continue to underwriting →</Button></div>
      </div>
      <aside>
        <div className="rounded-md border bg-card p-5">
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Flagged discrepancies</div>
          <div className="num mt-1 text-3xl">{flags.length}</div>
          <ul className="mt-4 space-y-3 text-sm">
            {flags.length === 0 && <li className="text-muted-foreground">Nothing off by more than 10%.</li>}
            {flags.map(({ l, d, p }) => (
              <li key={l.key} className="border-t pt-3">
                <div className="flex justify-between"><span>{l.label}</span><span className="num text-destructive">{d > 0 ? "+" : ""}{usd(d, true)}</span></div>
                <div className="text-xs text-muted-foreground">T-12 is {pct(Math.abs(p), 0)} {d > 0 ? "above" : "below"} the OM{l.key === "reserves" && l.t12 === 0 ? " — no reserves in actuals" : ""}</div>
              </li>
            ))}
          </ul>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Coming next: drop in the OM and T-12 PDFs and these columns fill themselves.</p>
      </aside>
    </div>
  );
}

const FIELDS: { k: keyof Assumptions; label: string; pct?: boolean; group: string }[] = [
  { k: "price", label: "Purchase price", group: "Acquisition" },
  { k: "units", label: "Units", group: "Acquisition" },
  { k: "closingPct", label: "Closing costs", pct: true, group: "Acquisition" },
  { k: "capex", label: "Capex budget", group: "Acquisition" },
  { k: "ltv", label: "Loan-to-value", pct: true, group: "Financing" },
  { k: "rate", label: "Interest rate", pct: true, group: "Financing" },
  { k: "amortYears", label: "Amortization (yrs)", group: "Financing" },
  { k: "rentGrowth", label: "Rent growth", pct: true, group: "Hold & exit" },
  { k: "expenseGrowth", label: "Expense growth", pct: true, group: "Hold & exit" },
  { k: "holdYears", label: "Hold (yrs)", group: "Hold & exit" },
  { k: "exitCap", label: "Exit cap rate", pct: true, group: "Hold & exit" },
  { k: "sellPct", label: "Selling costs", pct: true, group: "Hold & exit" },
];

function Underwrite({ deal, set, onNext }: { deal: Deal; set: (p: Partial<Deal>) => void; onNext: () => void }) {
  const a = deal.assumptions;
  const r = analyze(deal.lines, a, deal.adjustments);
  const groups = [...new Set(FIELDS.map((f) => f.group))];
  const setA = (k: keyof Assumptions, v: number) => set({ assumptions: { ...a, [k]: v } });
  const caps = [-0.005, 0, 0.005];
  const prices = [0.95, 1, 1.05];
  return (
    <div className="grid gap-8 xl:grid-cols-[360px_1fr]">
      <div className="space-y-6">
        {groups.map((g) => (
          <div key={g}>
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground">{g}</div>
            <div className="mt-2 divide-y rounded-md border bg-card">
              {FIELDS.filter((f) => f.group === g).map((f) => (
                <label key={f.k} className="flex items-center justify-between gap-3 px-4 py-1.5 text-sm">
                  <span>{f.label}</span>
                  <span className="flex w-36 items-center">
                    <Num value={f.pct ? +(a[f.k] * 100).toFixed(3) : a[f.k]} onChange={(v) => setA(f.k, f.pct ? v / 100 : v)} />
                    {f.pct && <span className="text-muted-foreground">%</span>}
                  </span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="space-y-8">
        <div>
          <h2 className="font-display text-2xl">Returns</h2>
          <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-md border bg-border md:grid-cols-4">
            {[["Equity required", usd(r.equity)], ["Loan", usd(r.loan)], ["Cash-on-cash Y1", pct(r.cashOnCash)], ["Equity multiple", r.equityMultiple.toFixed(2) + "x"],
              ["Debt service", usd(r.debtService)], ["DSCR", r.dscr.toFixed(2) + "x"], ["Levered IRR", pct(r.irr)], ["Target IRR", pct(deal.targetIrr)]].map(([k, v]) => (
              <div key={k} className="bg-card p-4"><div className="text-xs text-muted-foreground">{k}</div><div className="num mt-1 text-lg">{v}</div></div>
            ))}
          </div>
        </div>
        <div>
          <h3 className="text-sm font-medium">Cash flow by year</h3>
          <div className="mt-3 overflow-x-auto rounded-md border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b text-xs text-muted-foreground"><tr>{r.flows.map((_, i) => <th key={i} className="px-3 py-2 text-right font-medium">{i === 0 ? "Close" : `Yr ${i}`}</th>)}</tr></thead>
              <tbody><tr>{r.flows.map((f, i) => <td key={i} className={`num px-3 py-2 text-right ${f < 0 ? "text-destructive" : ""}`}>{usd(f, true)}</td>)}</tr></tbody>
            </table>
          </div>
        </div>
        <div>
          <h3 className="text-sm font-medium">IRR sensitivity — price vs. exit cap</h3>
          <div className="mt-3 overflow-x-auto rounded-md border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b text-xs text-muted-foreground"><tr><th className="px-3 py-2 text-left font-medium">Price \ Exit cap</th>{caps.map((c) => <th key={c} className="num px-3 py-2 text-right font-medium">{pct(a.exitCap + c, 2)}</th>)}</tr></thead>
              <tbody>
                {prices.map((p) => (
                  <tr key={p} className="border-b last:border-0">
                    <td className="num px-3 py-2">{usd(a.price * p, true)}</td>
                    {caps.map((c) => {
                      const v = analyze(deal.lines, { ...a, exitCap: a.exitCap + c }, deal.adjustments, a.price * p).irr;
                      return <td key={c} className={`num px-3 py-2 text-right ${p === 1 && c === 0 ? "font-semibold" : ""} ${v < deal.targetIrr ? "text-warning" : "text-positive"}`}>{pct(v)}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="flex justify-end"><Button onClick={onNext}>Continue to diligence →</Button></div>
      </div>
    </div>
  );
}

function Retrade({ deal, set }: { deal: Deal; set: (p: Partial<Deal>) => void }) {
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<"annual" | "onetime">("onetime");
  const base = analyze(deal.lines, deal.assumptions, []);
  const after = analyze(deal.lines, deal.assumptions, deal.adjustments);
  const target = deal.targetIrr;
  const holdPrice = useMemo(() => solvePrice(deal.lines, deal.assumptions, deal.adjustments, target), [deal, target]);
  const reduction = Math.max(0, deal.assumptions.price - holdPrice);
  const oneTime = deal.adjustments.filter((a) => a.type === "onetime").reduce((s, a) => s + a.amount, 0);
  const annual = deal.adjustments.filter((a) => a.type === "annual").reduce((s, a) => s + a.amount, 0);

  const letter = `Re: ${deal.name}${deal.address ? `, ${deal.address}` : ""}

Thank you for your cooperation through the due diligence period. Our review has identified the following items that were not reflected in the offering materials:

${deal.adjustments.map((a) => `• ${a.label}: ${usd(a.amount)}${a.type === "annual" ? " per year" : " (one-time)"}`).join("\n")}

The recurring items reduce stabilized NOI by ${usd(annual)} annually, which at a ${pct(after.capRate, 2)} cap rate represents ${usd(annual / (after.capRate || 1))} of value. Combined with ${usd(oneTime)} of immediate capital needs, we are requesting a purchase price adjustment of ${usd(Math.round(reduction / 1000) * 1000)}, to a revised price of ${usd(Math.round(holdPrice / 1000) * 1000)}.

Alternatively, we would accept a closing credit of ${usd(oneTime)} for the capital items together with a price adjustment of ${usd(Math.round((reduction - oneTime) / 1000) * 1000)}.

We remain committed to closing on the current timeline and look forward to your response.`;

  return (
    <div className="grid gap-8 xl:grid-cols-[1fr_1fr]">
      <div>
        <h2 className="font-display text-2xl">Diligence findings</h2>
        <p className="mt-1 text-sm text-muted-foreground">Log what diligence turned up. Recurring items hit NOI every year; one-time items add to your equity at close.</p>
        <form className="mt-4 flex flex-wrap gap-2" onSubmit={(e) => {
          e.preventDefault();
          const n = parseFloat(amount);
          if (!label.trim() || !n) return;
          set({ adjustments: [...deal.adjustments, { id: crypto.randomUUID(), label: label.trim(), type, amount: n }] });
          setLabel(""); setAmount("");
        }}>
          <Input className="min-w-48 flex-1" placeholder="e.g. HVAC replacement, 6 units" value={label} onChange={(e) => setLabel(e.target.value)} />
          <Input className="w-32" type="number" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <select value={type} onChange={(e) => setType(e.target.value as "annual" | "onetime")} className="rounded-md border bg-card px-2 text-sm">
            <option value="onetime">One-time</option>
            <option value="annual">Per year</option>
          </select>
          <Button type="submit" variant="secondary">Add</Button>
        </form>
        <ul className="mt-4 divide-y rounded-md border bg-card">
          {deal.adjustments.length === 0 && <li className="p-4 text-sm text-muted-foreground">No findings yet.</li>}
          {deal.adjustments.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <div>{a.label}<div className="text-xs text-muted-foreground">{a.type === "annual" ? "Recurring · per year" : "One-time at close"}</div></div>
              <div className="flex items-center gap-3">
                <span className="num">{usd(a.amount)}</span>
                <button className="text-xs text-muted-foreground hover:text-destructive" onClick={() => set({ adjustments: deal.adjustments.filter((x) => x.id !== a.id) })}>Remove</button>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-8 rounded-md border bg-card p-5">
          <div className="flex items-center justify-between">
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Price that holds your target</div>
            <label className="flex items-center gap-1 text-xs text-muted-foreground">Target IRR
              <input type="number" step="0.5" value={+(target * 100).toFixed(2)} onChange={(e) => set({ targetIrr: (parseFloat(e.target.value) || 0) / 100 })} className="num w-16 rounded border bg-background px-1 text-right" />%
            </label>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-4">
            <div><div className="text-xs text-muted-foreground">IRR before DD</div><div className="num text-lg">{pct(base.irr)}</div></div>
            <div><div className="text-xs text-muted-foreground">IRR after DD</div><div className={`num text-lg ${after.irr < target ? "text-destructive" : "text-positive"}`}>{pct(after.irr)}</div></div>
            <div><div className="text-xs text-muted-foreground">Revised price</div><div className="num text-lg">{usd(holdPrice, true)}</div></div>
          </div>
          <div className="mt-5 border-t pt-4">
            <div className="text-xs text-muted-foreground">Ask the seller for</div>
            <div className="num font-display text-4xl text-primary">{usd(reduction)}</div>
            <div className="text-xs text-muted-foreground">{pct(reduction / deal.assumptions.price)} off the contract price</div>
          </div>
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl">Retrade letter</h2>
          <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(letter); toast.success("Letter copied"); }}>Copy</Button>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">Drafted from your findings. Edit before sending.</p>
        <Textarea key={letter} defaultValue={letter} className="mt-4 min-h-[480px] bg-card font-display text-base leading-relaxed" />
      </div>
    </div>
  );
}
