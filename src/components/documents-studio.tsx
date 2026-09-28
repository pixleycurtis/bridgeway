import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Deal } from "@/lib/deals-store";
import { buildTable, dealFacts, defaultSections, DOC_FONTS, DOC_KINDS, type DocKind, type Section, type TableKey } from "@/lib/documents";
import { signedLogo, useWorkspace, type Firm } from "@/lib/workspace";
import { writeSection } from "@/lib/ai.functions";

export function DocumentsStudio({ deal }: { deal: Deal }) {
  const { firm: myFirm } = useWorkspace();
  const [firm, setFirm] = useState<Firm | null>(deal.canEdit ? myFirm : null);
  const [logo, setLogo] = useState<string | null>(null);
  const [kind, setKind] = useState<DocKind>("memo");
  const [saved, setSaved] = useState<Record<string, Section[]>>({});
  const [editing, setEditing] = useState(deal.canEdit);
  const saveT = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      const { data: f } = await supabase.from("firms").select("*").eq("id", deal.firmId).maybeSingle();
      if (f) { setFirm(f); setLogo(await signedLogo(f.logo_path)); }
      const { data } = await supabase.from("deal_documents").select("kind, sections").eq("deal_id", deal.id);
      setSaved(Object.fromEntries((data ?? []).map((d) => [d.kind, d.sections as unknown as Section[]])));
    })();
  }, [deal.id, deal.firmId]);

  const sections = saved[kind] ?? defaultSections(kind, deal, firm);
  const meta = DOC_KINDS.find((d) => d.kind === kind)!;

  const persist = (next: Section[]) => {
    setSaved((s) => ({ ...s, [kind]: next }));
    if (saveT.current) clearTimeout(saveT.current);
    const k = kind;
    saveT.current = setTimeout(async () => {
      const { error } = await supabase.from("deal_documents").upsert(
        { deal_id: deal.id, kind: k, title: meta.title, sections: next as never, updated_at: new Date().toISOString() },
        { onConflict: "deal_id,kind" });
      if (error) toast.error("Couldn't save document: " + error.message);
    }, 700);
  };
  const edit = (id: string, patch: Partial<Section>) => persist(sections.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const reset = async () => {
    await supabase.from("deal_documents").delete().eq("deal_id", deal.id).eq("kind", kind);
    setSaved((s) => { const n = { ...s }; delete n[kind]; return n; });
    toast.success("Rebuilt from the latest numbers");
  };

  const exportPdf = () => {
    const prev = document.title;
    document.title = `${deal.name} — ${meta.title}`;
    setEditing(false);
    setTimeout(() => { window.print(); document.title = prev; }, 200);
  };

  const font = DOC_FONTS[firm?.doc_font ?? "serif"]?.css ?? DOC_FONTS.serif!.css;
  const brand = firm?.brand_color ?? "#1f4d3a";

  return (
    <div className="grid gap-8 xl:grid-cols-[260px_1fr]">
      <div className="no-print space-y-1">
        <div className="mb-2 text-[11px] uppercase tracking-widest text-muted-foreground">Deliverables</div>
        {DOC_KINDS.map((d) => (
          <button key={d.kind} onClick={() => setKind(d.kind)}
            className={`w-full rounded-md border px-3 py-2.5 text-left transition-colors ${kind === d.kind ? "border-primary bg-card" : "border-transparent hover:bg-card"}`}>
            <div className="text-sm font-medium">{d.title}</div>
            <div className="text-xs text-muted-foreground">For {d.audience.toLowerCase()}{saved[d.kind] ? " · edited" : ""}</div>
          </button>
        ))}
      </div>
      <div>
        <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">{meta.blurb}</p>
          <div className="flex gap-2">
            {deal.canEdit && <Button variant="ghost" size="sm" onClick={() => setEditing(!editing)}>{editing ? "Preview" : "Edit"}</Button>}
            {deal.canEdit && <Button variant="ghost" size="sm" onClick={reset}>Rebuild from numbers</Button>}
            <Button size="sm" onClick={exportPdf}>Download PDF</Button>
          </div>
        </div>
        <article className="print-doc mx-auto max-w-[820px] bg-card px-12 py-12 shadow-sm ring-1 ring-border" style={{ fontFamily: font, color: "#1a1a1a", background: "#fff" }}>
          <header className="flex items-start justify-between gap-6 pb-5" style={{ borderBottom: `3px solid ${brand}` }}>
            <div className="flex items-center gap-3">
              {logo && <img src={logo} alt="" className="h-12 max-w-[140px] object-contain" />}
              <div>
                <div className="text-lg font-semibold" style={{ color: brand }}>{firm?.name}</div>
                {firm?.address && <div className="text-xs" style={{ color: "#666" }}>{firm.address}</div>}
              </div>
            </div>
            <div className="text-right text-xs uppercase tracking-widest" style={{ color: "#666" }}>{meta.title}</div>
          </header>
          <h1 className="mt-8 text-3xl" style={{ color: brand }}>{deal.name}</h1>
          <p className="text-sm" style={{ color: "#666" }}>{[deal.address, deal.market].filter(Boolean).join(" · ")}</p>
          <div className="mt-6 space-y-7">
            {sections.map((sec) => (
              <SectionBlock key={sec.id} sec={sec} deal={deal} brand={brand} editing={editing && deal.canEdit}
                docTitle={meta.title} onChange={(p) => edit(sec.id, p)} />
            ))}
          </div>
          <footer className="mt-12 flex justify-between pt-4 text-[11px]" style={{ borderTop: "1px solid #ddd", color: "#777" }}>
            <span>{[firm?.contact_name, firm?.contact_email, firm?.contact_phone].filter(Boolean).join(" · ")}</span>
            <span>Confidential</span>
          </footer>
        </article>
      </div>
    </div>
  );
}

function SectionBlock({ sec, deal, brand, editing, docTitle, onChange }: {
  sec: Section; deal: Deal; brand: string; editing: boolean; docTitle: string; onChange: (p: Partial<Section>) => void;
}) {
  const write = useServerFn(writeSection);
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState("");
  const ai = async () => {
    setBusy(true);
    try {
      const { text } = await write({ data: { docTitle, sectionTitle: sec.title, facts: dealFacts(deal), current: sec.body, instructions: ask } });
      onChange({ body: text });
      setAsk("");
    } catch (e) { toast.error(e instanceof Error ? e.message : "AI failed"); }
    setBusy(false);
  };
  return (
    <section className="break-inside-avoid">
      {editing
        ? <input value={sec.title} onChange={(e) => onChange({ title: e.target.value })} className="w-full bg-transparent text-xs font-semibold uppercase tracking-widest outline-none" style={{ color: brand }} />
        : <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: brand }}>{sec.title}</h2>}
      {editing ? (
        <>
          <Textarea value={sec.body} onChange={(e) => onChange({ body: e.target.value })} className="mt-2 min-h-[110px] border-dashed bg-transparent text-[15px] leading-relaxed" style={{ fontFamily: "inherit" }} />
          <div className="no-print mt-2 flex gap-2">
            <Input value={ask} onChange={(e) => setAsk(e.target.value)} placeholder="Optional: tell AI what to change (e.g. more concise, stress the tax risk)" className="h-8 text-xs" style={{ fontFamily: "var(--font-sans)" }} />
            <Button size="sm" variant="secondary" onClick={ai} disabled={busy}>{busy ? "Writing…" : "Rewrite with AI"}</Button>
          </div>
        </>
      ) : (
        <div className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed">{sec.body}</div>
      )}
      {sec.table && <DocTable k={sec.table} deal={deal} brand={brand} />}
    </section>
  );
}

function DocTable({ k, deal, brand }: { k: TableKey; deal: Deal; brand: string }) {
  const t = buildTable(k, deal);
  const hasHead = t.head.some(Boolean);
  return (
    <table className="mt-3 w-full text-[13px]" style={{ fontFamily: "var(--font-sans)" }}>
      {hasHead && <thead><tr>{t.head.map((h, i) => <th key={i} className={`py-1.5 font-medium ${i ? "text-right" : "text-left"}`} style={{ borderBottom: `1.5px solid ${brand}` }}>{h}</th>)}</tr></thead>}
      <tbody>
        {t.rows.map((row, i) => (
          <tr key={i} style={{ borderBottom: "1px solid #eee" }}>
            {row.map((c, j) => <td key={j} className={`py-1.5 ${j ? "text-right tabular-nums" : ""}`}>{c}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
