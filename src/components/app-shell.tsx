import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useDeals } from "@/lib/deals-store";

export function AppShell({ children }: { children: ReactNode }) {
  const { deals } = useDeals();
  const active = deals.filter((d) => !["Closed", "Passed"].includes(d.stage));
  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
        <div className="px-5 pb-6 pt-6">
          <Link to="/" className="font-display text-2xl tracking-tight text-sidebar-accent-foreground">Keystone</Link>
          <p className="mt-1 text-xs text-sidebar-foreground/60">Buy-side underwriting</p>
        </div>
        <nav className="flex flex-col gap-0.5 px-3 text-sm">
          <NavItem to="/">Pipeline</NavItem>
          <NavItem to="/insights">Insights</NavItem>
        </nav>
        <div className="mt-8 px-5 text-[11px] uppercase tracking-widest text-sidebar-foreground/50">Active deals</div>
        <nav className="mt-2 flex flex-col gap-0.5 overflow-y-auto px-3 text-sm">
          {active.map((d) => (
            <Link key={d.id} to="/deals/$dealId" params={{ dealId: d.id }}
              className="truncate rounded px-2 py-1.5 text-sidebar-foreground/80 hover:bg-sidebar-accent"
              activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground" }}>
              {d.name}
            </Link>
          ))}
        </nav>
        <div className="mt-auto border-t border-sidebar-border px-5 py-4 text-xs text-sidebar-foreground/50">Data saved on this device</div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-4 border-b px-4 py-3 md:hidden">
          <Link to="/" className="font-display text-xl">Keystone</Link>
          <Link to="/" className="text-sm text-muted-foreground">Pipeline</Link>
          <Link to="/insights" className="text-sm text-muted-foreground">Insights</Link>
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}

function NavItem({ to, children }: { to: "/" | "/insights"; children: ReactNode }) {
  return (
    <Link to={to} activeOptions={{ exact: true }}
      className="rounded px-2 py-1.5 text-sidebar-foreground/80 hover:bg-sidebar-accent"
      activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground" }}>
      {children}
    </Link>
  );
}

export function PageHeader({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-b px-6 pb-5 pt-8 md:px-10">
      <div>
        {eyebrow && <div className="text-xs uppercase tracking-widest text-muted-foreground">{eyebrow}</div>}
        <h1 className="mt-1 font-display text-4xl tracking-tight">{title}</h1>
      </div>
      {children}
    </div>
  );
}

export function Stat({ label, value, tone }: { label: string; value: string; tone?: "pos" | "neg" | "warn" | undefined }) {
  const c = tone === "pos" ? "text-positive" : tone === "neg" ? "text-destructive" : tone === "warn" ? "text-warning" : "";
  return (
    <div className="border-l px-4 py-1 first:border-l-0 first:pl-0">
      <div className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`num mt-1 text-xl ${c}`}>{value}</div>
    </div>
  );
}

export function StageBadge({ stage }: { stage: string }) {
  const tone = stage === "Closed" ? "bg-accent text-accent-foreground" : stage === "Passed" ? "bg-muted text-muted-foreground" : stage === "LOI" || stage === "Under contract" ? "bg-warning-soft text-foreground" : "bg-secondary text-secondary-foreground";
  return <span className={`inline-block rounded px-2 py-0.5 text-xs ${tone}`}>{stage}</span>;
}

