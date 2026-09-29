import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { listMyDeals } from "@/lib/room.functions";

export const Route = createFileRoute("/_authenticated/work/")({
  head: () => ({ meta: [
    { title: "My work — Keystone" },
    { name: "description", content: "Everything buyers have asked of you, across all your deals, sorted by due date." },
    { property: "og:title", content: "My work — Keystone" },
    { property: "og:description", content: "Everything buyers have asked of you, across all your deals, sorted by due date." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: MyWork,
});

const ROLE_LABEL: Record<string, string> = { seller: "Seller", title: "Title / escrow", lender: "Lender", counsel: "Counsel" };

function MyWork() {
  const list = useServerFn(listMyDeals);
  const [data, setData] = useState<Awaited<ReturnType<typeof listMyDeals>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { list().then(setData).catch((e: unknown) => setError(e instanceof Error ? e.message : "Couldn't load your deals")); }, [list]);
  const today = new Date().toISOString().slice(0, 10);
  const signOut = async () => { await supabase.auth.signOut(); window.location.href = "/auth"; };

  return (
    <div className="min-h-screen">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <span className="font-display text-xl">Keystone</span>
          <span className="flex items-center gap-3 text-xs text-muted-foreground">{data?.email}<Button variant="ghost" size="sm" onClick={() => void signOut()}>Sign out</Button></span>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="font-display text-4xl">My work</h1>
        {error && <p role="alert" className="mt-6 text-sm text-destructive">{error}</p>}
        {!data && !error && <p className="mt-6 text-sm text-muted-foreground">Loading your deals…</p>}
        {data && data.deals.length === 0 && <p className="mt-6 rounded-md border bg-card p-6 text-sm text-muted-foreground">No deals are shared with {data.email} yet. When a buyer invites this email, the deal shows up here.</p>}
        <div className="mt-8 space-y-6">
          {data?.deals.map((d) => (
            <section key={d.partyId} className="rounded-md border bg-card">
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-5 py-4">
                <div><Link to="/work/$partyId" params={{ partyId: d.partyId }} className="font-display text-2xl hover:underline">{d.dealName}</Link>
                  <div className="text-xs text-muted-foreground">{d.address} · {d.buyer} · you're the {ROLE_LABEL[d.role]?.toLowerCase()}</div></div>
                <span className="text-xs">{d.overdue > 0 && <span className="mr-3 text-destructive">{d.overdue} overdue</span>}<span className="text-muted-foreground">{d.todo.length} waiting on you</span></span>
              </div>
              <ul className="divide-y text-sm">
                {d.todo.slice(0, 6).map((t) => (
                  <li key={t.id} className="flex justify-between gap-3 px-5 py-2.5"><span>{t.label}</span><span className={`num text-xs ${t.due && t.due < today ? "text-destructive" : "text-muted-foreground"}`}>{t.due ?? "No date"}</span></li>
                ))}
                {d.todo.length === 0 && <li className="px-5 py-3 text-muted-foreground">Nothing assigned to you right now.</li>}
              </ul>
              <div className="px-5 py-3"><Link to="/work/$partyId" params={{ partyId: d.partyId }} className="text-sm text-primary hover:underline">Open deal room →</Link></div>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
