import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ROLE_LABELS, useWorkspace, type FirmRole, type Member } from "@/lib/workspace";
import { DOC_FONTS } from "@/lib/documents";
import { ACCEPT, readForAI } from "@/lib/files";
import { learnStyle } from "@/lib/ai.functions";
import { PipelineSettings } from "@/components/pipeline-settings";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Firm settings — Keystone" },
      { name: "description", content: "Brand your documents, manage your team, and teach Keystone your firm's writing style." },
      { property: "og:title", content: "Firm settings — Keystone" },
      { property: "og:description", content: "Brand your documents, manage your team, and teach Keystone your firm's writing style." },
    ],
  }),
  component: Settings,
});

function Settings() {
  return (
    <div>
      <PageHeader eyebrow="Firm" title="Settings" />
      <div className="grid gap-10 px-6 py-8 md:px-10 xl:grid-cols-2">
        <div className="space-y-10"><Branding /><PipelineSettings /></div>
        <div className="space-y-10"><Team /><WritingStyle /></div>
      </div>
    </div>
  );
}

function Branding() {
  const { firm, isAdmin, refreshFirm, logoUrl } = useWorkspace();
  const [f, setF] = useState(() => ({
    name: firm?.name ?? "", brand_color: firm?.brand_color ?? "#1f4d3a", doc_font: firm?.doc_font ?? "serif",
    contact_name: firm?.contact_name ?? "", contact_email: firm?.contact_email ?? "", contact_phone: firm?.contact_phone ?? "", address: firm?.address ?? "",
  }));
  if (!firm) return null;
  const save = async () => {
    const { error } = await supabase.from("firms").update(f).eq("id", firm.id);
    if (error) { toast.error(error.message); return; }
    await refreshFirm(); toast.success("Branding saved");
  };
  const uploadLogo = async (file?: File) => {
    if (!file) return;
    const path = `${firm.id}/logo-${Date.now()}.${file.name.split(".").pop()}`;
    const { error } = await supabase.storage.from("firm-assets").upload(path, file, { upsert: true });
    if (error) { toast.error(error.message); return; }
    await supabase.from("firms").update({ logo_path: path }).eq("id", firm.id);
    await refreshFirm(); toast.success("Logo updated");
  };
  const field = (k: keyof typeof f, label: string, ph = "") => (
    <label className="block text-sm"><span className="text-muted-foreground">{label}</span>
      <Input className="mt-1" value={f[k]} placeholder={ph} disabled={!isAdmin} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></label>
  );
  return (
    <section>
      <h2 className="font-display text-2xl">Branding</h2>
      <p className="mt-1 text-sm text-muted-foreground">Used on every document you export and to tint your team's workspace.{!isAdmin && " Only admins can change it."}</p>
      <div className="mt-5 space-y-4 rounded-md border bg-card p-5">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded border bg-background">
            {logoUrl ? <img src={logoUrl} alt="Firm logo" className="max-h-14 max-w-14 object-contain" /> : <span className="text-xs text-muted-foreground">Logo</span>}
          </div>
          {isAdmin && <label className="cursor-pointer text-sm underline">Upload logo<input type="file" accept="image/*" className="hidden" onChange={(e) => uploadLogo(e.target.files?.[0])} /></label>}
        </div>
        {field("name", "Firm name")}
        <div className="grid grid-cols-2 gap-4">
          <label className="block text-sm"><span className="text-muted-foreground">Brand color</span>
            <div className="mt-1 flex items-center gap-2">
              <input type="color" value={f.brand_color} disabled={!isAdmin} onChange={(e) => setF({ ...f, brand_color: e.target.value })} className="h-9 w-12 rounded border" />
              <Input value={f.brand_color} disabled={!isAdmin} onChange={(e) => setF({ ...f, brand_color: e.target.value })} />
            </div></label>
          <label className="block text-sm"><span className="text-muted-foreground">Document font</span>
            <select value={f.doc_font} disabled={!isAdmin} onChange={(e) => setF({ ...f, doc_font: e.target.value })} className="mt-1 h-9 w-full rounded-md border bg-card px-2">
              {Object.entries(DOC_FONTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select></label>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {field("contact_name", "Contact name")}
          {field("contact_email", "Contact email")}
          {field("contact_phone", "Phone")}
          {field("address", "Office address")}
        </div>
        {isAdmin && <div className="flex justify-end"><Button onClick={save}>Save branding</Button></div>}
      </div>
    </section>
  );
}

function Team() {
  const { firm, isAdmin, user } = useWorkspace();
  const [members, setMembers] = useState<Member[]>([]);
  const load = async () => {
    const { data } = await supabase.from("firm_members").select("*").order("created_at");
    setMembers(data ?? []);
  };
  useEffect(() => { load(); }, []);
  const setRole = async (id: string, role: FirmRole) => {
    const { error } = await supabase.from("firm_members").update({ role }).eq("id", id);
    if (error) toast.error(error.message); else load();
  };
  return (
    <section>
      <h2 className="font-display text-2xl">Team</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {firm?.domain
          ? <>Anyone who signs up with an <b>@{firm.domain}</b> email joins automatically and can edit every deal.</>
          : "This is a personal workspace. Sign up with a work email to share a workspace with colleagues."}
      </p>
      <ul className="mt-4 divide-y rounded-md border bg-card text-sm">
        {members.map((m) => (
          <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0"><div className="truncate">{m.full_name || m.email}</div><div className="truncate text-xs text-muted-foreground">{m.email}</div></div>
            <div className="flex items-center gap-3">
              {isAdmin && m.user_id !== user.id ? (
                <select value={m.role} onChange={(e) => setRole(m.id, e.target.value as FirmRole)} className="rounded border bg-card px-2 py-1 text-xs">
                  {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              ) : <span className="text-xs text-muted-foreground">{ROLE_LABELS[m.role]}</span>}
              {isAdmin && m.user_id !== user.id && (
                <button className="text-xs text-muted-foreground hover:text-destructive" onClick={async () => { await supabase.from("firm_members").delete().eq("id", m.id); load(); }}>Remove</button>
              )}
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">Lenders and sellers are invited per deal with the Share button, and can only view.</p>
    </section>
  );
}

function WritingStyle() {
  const { firm, refreshFirm } = useWorkspace();
  const learn = useServerFn(learnStyle);
  const [samples, setSamples] = useState<{ id: string; name: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const load = async () => {
    const { data } = await supabase.from("style_samples").select("id, name").order("created_at");
    setSamples(data ?? []);
  };
  useEffect(() => { load(); }, []);
  const onFile = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try { await learn({ data: await readForAI(file) }); await load(); await refreshFirm(); toast.success("Style learned"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't read that file"); }
    setBusy(false);
  };
  return (
    <section>
      <h2 className="font-display text-2xl">Writing style</h2>
      <p className="mt-1 text-sm text-muted-foreground">Upload past memos, LOIs, lender packages, or letters. Keystone learns your firm's voice and uses it whenever AI writes a section.</p>
      <label className={`mt-4 flex cursor-pointer items-center justify-between rounded-md border border-dashed bg-card px-4 py-3 text-sm hover:border-primary ${busy ? "opacity-60" : ""}`}>
        <span>{busy ? "Studying your document…" : "Upload a past deliverable"}</span>
        <span className="text-xs text-muted-foreground">PDF, CSV, TXT</span>
        <input type="file" accept={ACCEPT} className="hidden" disabled={busy} onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
      </label>
      {samples.length > 0 && <ul className="mt-3 space-y-1 text-sm">{samples.map((s) => <li key={s.id} className="text-muted-foreground">• {s.name}</li>)}</ul>}
      {firm?.style_profile && (
        <div className="mt-4 rounded-md border bg-card p-4">
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Your house style</div>
          <p className="mt-2 whitespace-pre-wrap text-sm">{firm.style_profile}</p>
        </div>
      )}
    </section>
  );
}
