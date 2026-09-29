import type { Deal } from "@/lib/deals-store";
import { hotelMetrics, pct, sumBy, usd } from "@/lib/finance";

/** Hospitality check: does the T-12 rooms income match occupancy x ADR? */
export function HotelPanel({ deal, set }: { deal: Deal; set: (p: Partial<Deal>) => void }) {
  const a = deal.assumptions;
  const rooms = a.rooms ?? a.units, occ = a.occupancy ?? 0.7, adr = a.adr ?? 150;
  const m = hotelMetrics(rooms, occ, adr, a.price);
  const t12Income = sumBy(deal.lines, "t12").income;
  const field = (label: string, value: number, key: "rooms" | "occupancy" | "adr", step: number, scale = 1) => (
    <label className="flex items-center justify-between gap-2 text-sm"><span className="text-muted-foreground">{label}</span>
      <input type="number" step={step} value={+(value * scale).toFixed(2)} disabled={!deal.canEdit}
        onChange={(e) => set({ assumptions: { ...a, [key]: (parseFloat(e.target.value) || 0) / scale } })}
        className="num w-24 rounded border bg-background px-1.5 py-0.5 text-right" /></label>
  );
  return (
    <div className="rounded-md border bg-card p-5">
      <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Hotel operations</div>
      <div className="mt-3 space-y-2">
        {field("Keys", rooms, "rooms", 1)}
        {field("Occupancy %", occ, "occupancy", 0.5, 100)}
        {field("ADR", adr, "adr", 1)}
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 border-t pt-3 text-sm">
        <div><dt className="text-xs text-muted-foreground">RevPAR</dt><dd className="num">{usd(m.revpar)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Price / key</dt><dd className="num">{usd(m.pricePerKey, true)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Rooms revenue</dt><dd className="num">{usd(m.roomsRevenue, true)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Share of T-12 income</dt><dd className="num">{t12Income ? pct(m.roomsRevenue / t12Income) : "—"}</dd></div>
      </dl>
      {t12Income > 0 && m.roomsRevenue > t12Income && <p className="mt-3 text-xs text-destructive">Occupancy × ADR implies more rooms revenue than the T-12's total income. Check the STR report.</p>}
    </div>
  );
}
