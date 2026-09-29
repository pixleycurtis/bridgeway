import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Deal } from "@/lib/deals-store";
import type { Impact } from "@/lib/deal-tables";
import { findingAdjustment, underwritingGaps, usd, type Adjustment } from "@/lib/finance";

type Linked = { source: string; label: string; from: string; impact: Impact };

/** Findings priced in the Data room, Title step or Reconcile gaps, ready to flow into the retrade. */
export function LinkedFindings({ deal, set }: { deal: Deal; set: (p: Partial<Deal>) => void }) {
  const [linked, setLinked] = useState<Linked[]>([]);
  useEffect(() => {
    (async () => {
      const [dd, ti] = await Promise.all([
        supabase.from("deal_dd_items").select("id, label, impact").eq("deal_id", deal.id).not("impact", "is", null),
        supabase.from("deal_title_items").select("id, item, impact").eq("deal_id", deal.id).not("impact", "is", null),
      ]);
      setLinked([
        ...(dd.data ?? []).map((r) => ({ source: r.id, label: r.label, from: "Data room", impact: r.impact as unknown as Impact })),
        ...(ti.data ?? []).map((r) => ({ source: r.id, label: r.item, from: "Title", impact: r.impact as unknown as Impact })),
      ]);
    })();
  }, [deal.id]);

  const gaps: Linked[] = underwritingGaps(deal.lines).map((g) => ({ source: `recon:${g.key}`, label: g.label, from: "Reconcile", impact: { type: "annual", amount: g.amount } }));
  const all = [...linked, ...gaps];
  if (!all.length) return null;

  const bySource = new Map(deal.adjustments.filter((a) => a.source).map((a) => [a.source, a]));
  const include = (l: Linked) => {
    const adj: Adjustment = findingAdjustment(l.source, l.label, l.impact);
    const rest = deal.adjustments.filter((a) => a.source !== l.source);
    set({ adjustments: [...rest, adj] });
  };

  return (
    <div className="mt-4 rounded-md border border-dashed p-4">
      <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Priced elsewhere in this deal</div>
      <ul className="mt-2 divide-y text-sm">
        {all.map((l) => {
          const cur = bySource.get(l.source);
          const next = findingAdjustment(l.source, l.label, l.impact);
          const stale = cur && (cur.amount !== next.amount || cur.type !== next.type);
          return (
            <li key={l.source} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0"><div className="truncate">{l.label}</div><div className="text-xs text-muted-foreground">{l.from} · {l.impact.type === "annual" ? (l.from === "Reconcile" ? "underwriting is 10%+ above the T-12" : "per year") : l.impact.type === "credit" ? "price credit" : "one-time"}</div></div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="num">{usd(l.impact.amount)}</span>
                {!cur ? <button className="text-xs text-primary" onClick={() => include(l)}>Include</button>
                  : stale ? <button className="text-xs text-primary" onClick={() => include(l)}>Update</button>
                  : <span className="text-xs text-muted-foreground">Included</span>}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
