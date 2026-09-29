import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { Deal } from "@/lib/deals-store";
import type { Impact } from "@/lib/deal-tables";
import { usd } from "@/lib/finance";
import { useWorkspace } from "@/lib/workspace";

export const PARTY_ROLES = [
  { value: "seller", label: "Seller", short: "S" },
  { value: "title", label: "Title / escrow", short: "T" },
  { value: "lender", label: "Lender", short: "L" },
  { value: "counsel", label: "Counsel", short: "C" },
] as const;
const roleLabel = (r: string) => PARTY_ROLES.find((p) => p.value === r)?.label ?? r;

/** Compact "Shared with" toggles. Empty = private to the firm. */
export function SharedWith({ value, onChange, disabled }: { value: string[]; onChange: (v: string[]) => void; disabled?: boolean }) {
  return (
    <span className="inline-flex items-center gap-0.5" title={value.length ? `Shared with ${value.map(roleLabel).join(", ")}` : "Private to your firm"}>
      {PARTY_ROLES.map((r) => {
        const on = value.includes(r.value);
        return (
          <button key={r.value} type="button" disabled={disabled} aria-pressed={on} aria-label={`Share with ${r.label}`}
            onClick={() => onChange(on ? value.filter((v) => v !== r.value) : [...value, r.value])}
            className={`h-5 w-5 rounded text-[10px] font-medium ${on ? "bg-primary text-primary-foreground" : "border text-muted-foreground hover:border-primary"}`}>
            {r.short}
          </button>
        );
      })}
    </span>
  );
}

const IMPACT_LABEL: Record<Impact["type"], string> = { annual: "/yr", onetime: " capex", credit: " credit" };

/** Inline editor for a finding's dollar impact on the deal. */
export function ImpactInput({ value, onChange }: { value: Impact | null; onChange: (v: Impact | null) => void }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<Impact["type"]>(value?.type ?? "onetime");
  const [amount, setAmount] = useState(value ? String(value.amount) : "");
  if (!open) return (
    <button type="button" onClick={() => setOpen(true)} className={`text-xs ${value ? "num font-medium text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
      {value ? `${usd(value.amount)}${IMPACT_LABEL[value.type]}` : "$ impact"}
    </button>
  );
  return (
    <span className="inline-flex items-center gap-1">
      <select value={type} onChange={(e) => setType(e.target.value as Impact["type"])} className="rounded border bg-card px-1 py-0.5 text-xs" aria-label="Impact type">
        <option value="onetime">One-time cost</option><option value="annual">Yearly expense</option><option value="credit">Price credit</option>
      </select>
      <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="num w-20 rounded border bg-card px-1 py-0.5 text-xs" placeholder="$" aria-label="Impact amount" />
      <button type="button" className="text-xs text-primary" onClick={() => { const n = Number(amount); onChange(n > 0 ? { type, amount: n } : null); setOpen(false); }}>Save</button>
      <button type="button" className="text-xs text-muted-foreground" onClick={() => setOpen(false)}>×</button>
    </span>
  );
}

async function sha256(v: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
const newToken = () => Array.from(crypto.getRandomValues(new Uint8Array(24))).map((b) => b.toString(16).padStart(2, "0")).join("");

type Party = { id: string; email: string; role: string; expires_at: string; revoked_at: string | null; last_seen_at: string | null; token_hash: string | null };
type Event = { id: string; kind: string; detail: string | null; created_at: string; party_id: string | null };
type Preview = { requests: string[]; title: string[]; files: string[]; docs: string[] };

export function ShareDialog({ deal }: { deal: Deal }) {
  const { user } = useWorkspace();
  const [parties, setParties] = useState<Party[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("seller");
  const [links, setLinks] = useState<Record<string, string>>({});
  const [previewRole, setPreviewRole] = useState("seller");
  const [preview, setPreview] = useState<Preview | null>(null);

  const load = async () => {
    const [{ data: p }, { data: e }] = await Promise.all([
      supabase.from("deal_parties").select("id, email, role, expires_at, revoked_at, last_seen_at, token_hash").eq("deal_id", deal.id).order("created_at"),
      supabase.from("deal_party_events").select("id, kind, detail, created_at, party_id").eq("deal_id", deal.id).neq("kind", "view").order("created_at", { ascending: false }).limit(8),
    ]);
    setParties((p ?? []) as Party[]);
    setEvents((e ?? []) as Event[]);
  };
  const loadPreview = async (r: string) => {
    const [dd, ti, fi, dc] = await Promise.all([
      supabase.from("deal_dd_items").select("label").eq("deal_id", deal.id).contains("shared_with", [r]),
      supabase.from("deal_title_items").select("item").eq("deal_id", deal.id).contains("shared_with", [r]),
      supabase.from("deal_files").select("name").eq("deal_id", deal.id).contains("shared_with", [r]),
      supabase.from("deal_documents").select("title").eq("deal_id", deal.id).contains("shared_with", [r]),
    ]);
    setPreview({ requests: (dd.data ?? []).map((x) => x.label), title: (ti.data ?? []).map((x) => x.item), files: (fi.data ?? []).map((x) => x.name), docs: (dc.data ?? []).map((x) => x.title) });
  };
  useEffect(() => { void load(); }, [deal.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void loadPreview(previewRole); }, [previewRole, deal.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const issue = async (partyId: string) => {
    const token = newToken();
    const { error } = await supabase.from("deal_parties").update({ token_hash: await sha256(token), revoked_at: null, expires_at: new Date(Date.now() + 30 * 864e5).toISOString() }).eq("id", partyId);
    if (error) { toast.error(error.message); return; }
    setLinks((l) => ({ ...l, [partyId]: `${window.location.origin}/room/${token}` }));
    void load();
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(clean)) { toast.error("Enter a valid email"); return; }
    const token = newToken();
    const { data, error } = await supabase.from("deal_parties").insert({ deal_id: deal.id, email: clean, role, token_hash: await sha256(token), created_by: user.id }).select("id").single();
    if (error || !data) { toast.error(error?.message ?? "Couldn't invite"); return; }
    setLinks((l) => ({ ...l, [data.id]: `${window.location.origin}/room/${token}` }));
    setEmail(""); void load();
    toast.success("Link created — copy it into your email.");
  };

  const copy = async (url: string) => { await navigator.clipboard.writeText(url); toast.success("Link copied"); };
  const active = (p: Party) => !p.revoked_at && !!p.token_hash && new Date(p.expires_at) > new Date();
  const who = (id: string | null) => parties.find((p) => p.id === id)?.email ?? "Guest";

  return (
    <Dialog>
      <DialogTrigger asChild><Button variant="outline">Share</Button></DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle className="font-display text-2xl font-normal">Deal room</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Outside parties get a private link — no account needed. They only see items you mark as shared with their role. Underwriting, retrade and internal notes always stay private.</p>
        <form onSubmit={add} className="flex gap-2">
          <Input placeholder="name@titleco.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <select value={role} onChange={(e) => setRole(e.target.value)} className="rounded-md border bg-card px-2 text-sm" aria-label="Role">
            {PARTY_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          <Button type="submit">Create link</Button>
        </form>
        <ul className="divide-y rounded-md border text-sm">
          {parties.length === 0 && <li className="p-3 text-muted-foreground">No outside parties yet.</li>}
          {parties.map((p) => (
            <li key={p.id} className="space-y-2 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>{p.email} <span className="ml-1 text-xs text-muted-foreground">{roleLabel(p.role)} · {active(p) ? `link valid to ${new Date(p.expires_at).toLocaleDateString()}` : p.revoked_at ? "revoked" : "no active link"}{p.last_seen_at ? ` · last opened ${new Date(p.last_seen_at).toLocaleDateString()}` : ""}</span></span>
                <span className="flex gap-1">
                  <Button variant="ghost" size="sm" className="text-xs" onClick={() => void issue(p.id)}>{active(p) ? "New link" : "Create link"}</Button>
                  {active(p) && <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={async () => { await supabase.from("deal_parties").update({ revoked_at: new Date().toISOString() }).eq("id", p.id); void load(); }}>Revoke</Button>}
                  <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-destructive" onClick={async () => { await supabase.from("deal_parties").delete().eq("id", p.id); void load(); }}>Remove</Button>
                </span>
              </div>
              {links[p.id] && (
                <div className="flex gap-2">
                  <Input readOnly value={links[p.id]} className="h-8 text-xs" onFocus={(e) => e.target.select()} />
                  <Button size="sm" onClick={() => void copy(links[p.id] ?? "")}>Copy</Button>
                </div>
              )}
            </li>
          ))}
        </ul>
        {parties.some((p) => !active(p) && !p.revoked_at) && <p className="text-xs text-muted-foreground">Links are shown once. Use "Create link" to issue a fresh one — the old link stops working.</p>}

        <div className="rounded-md border p-3">
          <div className="flex items-center justify-between">
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground">What each party sees</div>
            <select value={previewRole} onChange={(e) => setPreviewRole(e.target.value)} className="rounded border bg-card px-1.5 py-0.5 text-xs" aria-label="Preview role">
              {PARTY_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          {preview && (
            <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
              {([["Requests", preview.requests], ["Title & closing", preview.title], ["Files", preview.files], ["Documents", preview.docs]] as const).map(([h, list]) => (
                <div key={h}><div className="text-xs font-medium">{h} <span className="text-muted-foreground">({list.length})</span></div>
                  <ul className="text-xs text-muted-foreground">{list.slice(0, 5).map((x, i) => <li key={i} className="truncate">{x}</li>)}{list.length > 5 && <li>+{list.length - 5} more</li>}</ul>
                </div>
              ))}
            </div>
          )}
          <p className="mt-2 text-xs text-muted-foreground">Mark items with the S / T / L / C toggles in Data room, Title & closing and Documents.</p>
        </div>

        {events.length > 0 && (
          <div>
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Recent activity</div>
            <ul className="mt-1 text-xs text-muted-foreground">
              {events.map((e) => <li key={e.id}>{new Date(e.created_at).toLocaleString()} — {who(e.party_id)} {e.kind === "upload" ? "uploaded" : "opened"} {e.detail}</li>)}
            </ul>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
