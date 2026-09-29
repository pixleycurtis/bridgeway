import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { Deal } from "@/lib/deals-store";
import { usd } from "@/lib/finance";
import { ACCEPT, readForAI } from "@/lib/files";
import { extractFinancials } from "@/lib/ai.functions";
import { useWorkspace } from "@/lib/workspace";

type Extract = Awaited<ReturnType<typeof extractFinancials>>;

export function UploadPanel({ deal, set }: { deal: Deal; set: (p: Partial<Deal>) => void }) {
  const extract = useServerFn(extractFinancials);
  const { user } = useWorkspace();
  const [busy, setBusy] = useState<"om" | "t12" | null>(null);
  const [result, setResult] = useState<{ kind: "om" | "t12"; name: string; data: Extract } | null>(null);

  const onFile = async (kind: "om" | "t12", file: File | undefined) => {
    if (!file) return;
    setBusy(kind);
    try {
      const path = `${deal.firmId}/${deal.id}/${Date.now()}-${file.name.replace(/[^\w.-]+/g, "_")}`;
      const up = await supabase.storage.from("deal-files").upload(path, file);
      if (up.error) throw up.error;
      const { error: metadataError } = await supabase.from("deal_files").insert({ deal_id: deal.id, kind, name: file.name, path });
      if (metadataError) { await supabase.storage.from("deal-files").remove([path]); throw metadataError; }
      const data = await extract({ data: { ...(await readForAI(file)), kind } });
      setResult({ kind, name: file.name, data });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't read that file");
    }
    setBusy(null);
    void user;
  };

  const apply = () => {
    if (!result) return;
    const col = result.kind === "om" ? "broker" : "t12";
    const lines = deal.lines.map((l) => ({ ...l, [col]: result.data.values[l.key] ?? l[col], ...(result.kind === "t12" && !l.underwrite ? { underwrite: result.data.values[l.key] ?? 0 } : {}) }));
    const a = { ...deal.assumptions };
    if (result.data.units) a.units = result.data.units;
    if (result.data.price && result.kind === "om") a.price = result.data.price;
    set({ lines, assumptions: a });
    toast.success(`${result.kind === "om" ? "Broker OM" : "T-12"} column filled`);
    setResult(null);
  };

  return (
    <div className="rounded-md border bg-card p-5">
      <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Fill from documents</div>
      <div className="mt-3 grid gap-2">
        {(["om", "t12"] as const).map((k) => (
          <label key={k} className={`flex cursor-pointer items-center justify-between rounded border border-dashed px-3 py-2.5 text-sm hover:border-primary ${busy === k ? "opacity-60" : ""}`}>
            <span>{busy === k ? "Reading…" : k === "om" ? "Upload broker OM" : "Upload T-12"}</span>
            <span className="text-xs text-muted-foreground">Choose file</span>
            <input type="file" accept={ACCEPT} className="hidden" disabled={!!busy} onChange={(e) => { onFile(k, e.target.files?.[0]); e.target.value = ""; }} />
          </label>
        ))}
      </div>
      <Dialog open={!!result} onOpenChange={(o) => !o && setResult(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="font-display text-2xl font-normal">What we found in {result?.name}</DialogTitle></DialogHeader>
          {result && (
            <div className="text-sm">
              <table className="w-full">
                <tbody>
                  {deal.lines.map((l) => (
                    <tr key={l.key} className="border-b last:border-0">
                      <td className="py-1.5">{l.label}</td>
                      <td className="num py-1.5 text-right text-muted-foreground">{usd(result.kind === "om" ? l.broker : l.t12)}</td>
                      <td className="num py-1.5 pl-4 text-right font-medium">{usd(result.data.values[l.key] ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-3 text-xs text-muted-foreground">
                {result.data.units ? `Units: ${result.data.units}. ` : ""}{result.data.price ? `Price: ${usd(result.data.price)}. ` : ""}{result.data.notes}
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setResult(null)}>Discard</Button>
                <Button onClick={apply}>Fill the {result.kind === "om" ? "Broker OM" : "T-12"} column</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

type Share = { id: string; email: string; party: string };

export function ShareDialog({ deal }: { deal: Deal }) {
  const { user } = useWorkspace();
  const [shares, setShares] = useState<Share[]>([]);
  const [email, setEmail] = useState("");
  const [party, setParty] = useState("lender");
  const load = async () => {
    const { data } = await supabase.from("deal_shares").select("id, email, party").eq("deal_id", deal.id);
    setShares(data ?? []);
  };
  useEffect(() => { load(); }, [deal.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(clean)) { toast.error("Enter a valid email"); return; }
    const { error } = await supabase.from("deal_shares").insert({ deal_id: deal.id, email: clean, party, created_by: user.id });
    if (error) { toast.error(error.message); return; }
    setEmail(""); load();
    toast.success(`Shared with ${clean}. They'll see it after signing in with that email.`);
  };
  return (
    <Dialog>
      <DialogTrigger asChild><Button variant="outline">Share</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle className="font-display text-2xl font-normal">Share with outside parties</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Lenders, sellers, and title or escrow officers get view-only access to this deal and its documents. Everyone at your firm can already see and edit it.</p>
        <form onSubmit={add} className="flex gap-2">
          <Input placeholder="name@lender.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <select value={party} onChange={(e) => setParty(e.target.value)} className="rounded-md border bg-card px-2 text-sm">
            <option value="lender">Lender</option><option value="seller">Seller</option><option value="title">Title / escrow officer</option><option value="other">Other</option>
          </select>
          <Button type="submit">Invite</Button>
        </form>
        <ul className="divide-y rounded-md border text-sm">
          {shares.length === 0 && <li className="p-3 text-muted-foreground">Not shared with anyone outside your firm.</li>}
          {shares.map((s) => (
            <li key={s.id} className="flex items-center justify-between p-3">
              <span>{s.email} <span className="ml-1 text-xs capitalize text-muted-foreground">{s.party} · view only</span></span>
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-destructive" onClick={async () => { await supabase.from("deal_shares").delete().eq("id", s.id); load(); }}>Remove</Button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
