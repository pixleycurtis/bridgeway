import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { usd, pct } from "@/lib/finance";
import { getRoom, getRoomFileUrl, startRoomUpload, finishRoomUpload, getRoomThread, postRoomComment } from "@/lib/room.functions";

export type RoomAccess = { token: string } | { partyId: string };
type Room = Extract<Awaited<ReturnType<typeof getRoom>>, { unavailable: null }>;
type ItemType = "request" | "title" | "task" | "deal";

const ROLE_LABEL: Record<string, string> = { seller: "Seller", title: "Title / escrow", lender: "Lender", counsel: "Counsel" };
const STATUS_LABEL: Record<string, string> = { open: "Open", objected: "Objected", cleared: "Cleared", accepted: "Accepted", "in-progress": "In progress", done: "Done", received: "Received — in review" };

function Thread({ access, itemType, itemId, firmName, onPosted }: { access: RoomAccess; itemType: ItemType; itemId: string; firmName: string; onPosted: () => void }) {
  const load = useServerFn(getRoomThread);
  const post = useServerFn(postRoomComment);
  const [rows, setRows] = useState<Awaited<ReturnType<typeof getRoomThread>>>([]);
  const [body, setBody] = useState("");
  const refresh = useCallback(async () => { try { setRows(await load({ data: { access, itemType, itemId } })); } catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't load messages"); } }, [load, access, itemType, itemId]);
  useEffect(() => { void refresh(); }, [refresh]);
  return (
    <div className="mt-2 space-y-2 rounded-md bg-muted/40 p-3">
      {rows.length === 0 && <p className="text-xs text-muted-foreground">No messages yet. Everything here is visible to {firmName || "the buyer"}.</p>}
      {rows.map((r) => (
        <div key={r.id} className="text-sm"><span className="text-xs font-medium">{r.fromYou ? "You" : r.author}</span> <span className="text-xs text-muted-foreground">{new Date(r.at).toLocaleString()}</span><p className="whitespace-pre-wrap">{r.body}</p></div>
      ))}
      <form className="flex gap-2" onSubmit={async (e) => { e.preventDefault(); if (!body.trim()) return; try { await post({ data: { access, itemType, itemId, body } }); setBody(""); await refresh(); onPosted(); } catch (err) { toast.error(err instanceof Error ? err.message : "Couldn't send"); } }}>
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write a message…" className="min-h-9 flex-1 bg-card text-sm" rows={1} />
        <Button type="submit" size="sm">Send</Button>
      </form>
    </div>
  );
}

export function RoomView({ access }: { access: RoomAccess }) {
  const load = useServerFn(getRoom);
  const fileUrl = useServerFn(getRoomFileUrl);
  const start = useServerFn(startRoomUpload);
  const finish = useServerFn(finishRoomUpload);
  const [room, setRoom] = useState<Room | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [openThread, setOpenThread] = useState<string | null>(null);
  const key = JSON.stringify(access);

  const refresh = useCallback(async () => {
    try { const r = await load({ data: { access: JSON.parse(key) as RoomAccess } }); if (r.unavailable) setError(r.unavailable); else { setRoom(r as Room); setError(null); } }
    catch (e) { setError(e instanceof Error ? e.message : "This link isn't working"); }
  }, [load, key]);
  useEffect(() => { void refresh(); }, [refresh]);

  const upload = async (itemType: "request" | "title", itemId: string, file?: File) => {
    if (!file) return;
    setBusy(itemId);
    try {
      const slot = await start({ data: { access, itemType, itemId, fileName: file.name } });
      const up = await supabase.storage.from("deal-files").uploadToSignedUrl(slot.path, slot.uploadToken, file);
      if (up.error) throw up.error;
      await finish({ data: { access, itemType, itemId, fileName: file.name, path: slot.path } });
      toast.success("Sent. The buyer will review it.");
      await refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Upload failed"); }
    setBusy(null);
  };

  const open = async (fileId: string) => {
    const tab = window.open("", "_blank");
    try { const { url } = await fileUrl({ data: { access, fileId } }); if (tab) tab.location.href = url; else window.location.assign(url); }
    catch (e) { tab?.close(); toast.error(e instanceof Error ? e.message : "Could not open file"); }
  };

  if (error) return <div className="mx-auto max-w-lg p-10"><h1 className="font-display text-3xl">Link unavailable</h1><p className="mt-3 text-sm text-muted-foreground">{error}</p></div>;
  if (!room) return <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">Opening the deal room…</div>;

  const today = new Date().toISOString().slice(0, 10);
  const UploadBtn = ({ type, id, has }: { type: "request" | "title"; id: string; has: boolean }) => (
    <label className={`cursor-pointer rounded border px-2.5 py-1 text-xs hover:border-primary ${busy === id ? "opacity-60" : ""}`}>
      {busy === id ? "Uploading…" : has ? "Replace file" : "Upload"}
      <input type="file" className="hidden" disabled={!!busy} onChange={(e) => { void upload(type, id, e.target.files?.[0]); e.target.value = ""; }} />
    </label>
  );
  const Talk = ({ type, id, count }: { type: ItemType; id: string; count: number }) => (
    <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setOpenThread(openThread === id ? null : id)}>
      {count ? `${count} message${count === 1 ? "" : "s"}` : "Message"}
    </button>
  );
  const threadFor = (type: ItemType, id: string) => openThread === id && <Thread access={access} itemType={type} itemId={id} firmName={room.firm.name} onPosted={() => void refresh()} />;
  const Mine = ({ on }: { on: boolean }) => on ? <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">Assigned to you</span> : null;
  const byMine = <T extends { mine: boolean }>(xs: T[]) => [...xs].sort((a, b) => Number(b.mine) - Number(a.mine));

  const fin = room.financing;
  const empty = !fin && !room.requests.length && !room.titleItems.length && !room.tasks.length && !room.files.length && !room.documents.length;
  return (
    <div className="min-h-screen" style={room.firm.brandColor ? ({ "--primary": room.firm.brandColor } as React.CSSProperties) : undefined}>
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            {room.firm.logoUrl && <img src={room.firm.logoUrl} alt={room.firm.name} className="h-8 w-auto" />}
            <span className="font-display text-xl">{room.firm.name}</span>
          </div>
          <span className="text-xs text-muted-foreground">{ROLE_LABEL[room.role]} · {room.email}</span>
        </div>
      </header>
      <main className="mx-auto max-w-4xl space-y-10 px-6 py-10">
        <div>
          {"partyId" in access && <Link to="/work" className="text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground">← My work</Link>}
          <h1 className="font-display text-4xl">{room.deal.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{room.deal.address}</p>
          <p className="mt-2 text-xs text-muted-foreground">Your access: {room.tier.toLowerCase()}.</p>
        </div>
        {fin && (
          <section>
            <h2 className="font-display text-2xl">Financing request</h2>
            <dl className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-md border bg-border text-sm sm:grid-cols-4">
              {([["Purchase price", usd(fin.price)], ["Loan requested", usd(fin.loan)], ["Loan-to-value", pct(fin.ltv)], ["Rate / amortization", `${pct(fin.rate, 2)} · ${fin.amortYears} yrs`],
                ["Underwritten NOI", usd(fin.noi)], ["Debt service", usd(fin.debtService)], ["DSCR", isFinite(fin.dscr) ? `${fin.dscr.toFixed(2)}x` : "—"], ["Cap rate", pct(fin.capRate, 2)]] as const).map(([k, v]) => (
                <div key={k} className="bg-card px-4 py-3"><dt className="text-[11px] uppercase tracking-widest text-muted-foreground">{k}</dt><dd className="num mt-1">{v}</dd></div>
              ))}
            </dl>
            <h3 className="mt-6 text-sm font-medium">Underwritten operating statement</h3>
            <table className="mt-2 w-full rounded-md border bg-card text-sm">
              <tbody className="divide-y">
                {fin.lines.map((l, i) => <tr key={i}><td className="px-4 py-2">{l.label}</td><td className="px-4 py-2 text-xs text-muted-foreground">{l.kind === "income" ? "Income" : "Expense"}</td><td className="num px-4 py-2 text-right">{usd(l.amount)}</td></tr>)}
                <tr className="font-medium"><td className="px-4 py-2">Net operating income</td><td /><td className="num px-4 py-2 text-right">{usd(fin.noi)}</td></tr>
              </tbody>
            </table>
          </section>
        )}
        {empty && <p className="rounded-md border bg-card p-6 text-sm text-muted-foreground">Nothing has been shared with you yet. You'll see requests here as soon as the buyer adds them.</p>}
        {room.tasks.length > 0 && (
          <section>
            <h2 className="font-display text-2xl">To do</h2>
            <ul className="mt-3 divide-y rounded-md border bg-card">
              {byMine(room.tasks).map((t) => (
                <li key={t.id} className="px-4 py-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div><span className={t.done ? "text-muted-foreground line-through" : ""}>{t.title}</span><Mine on={t.mine} /><div className={`text-xs ${!t.done && t.dueDate && t.dueDate < today ? "text-destructive" : "text-muted-foreground"}`}>{t.done ? "Done" : t.dueDate ? `Due ${t.dueDate}${t.dueDate < today ? " · overdue" : ""}` : "No date"}</div></div>
                    <Talk type="task" id={t.id} count={t.comments} />
                  </div>
                  {threadFor("task", t.id)}
                </li>
              ))}
            </ul>
          </section>
        )}
        {room.requests.length > 0 && (
          <section>
            <h2 className="font-display text-2xl">Requested documents</h2>
            <ul className="mt-3 divide-y rounded-md border bg-card">
              {byMine(room.requests).map((r) => (
                <li key={r.id} className="px-4 py-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div><span>{r.label}</span><Mine on={r.mine} /><div className="text-xs text-muted-foreground">{r.category} · {r.received ? "Received" : r.hasFile ? "Received — in review" : "Outstanding"}</div></div>
                    <div className="flex items-center gap-3"><Talk type="request" id={r.id} count={r.comments} />{!r.received && <UploadBtn type="request" id={r.id} has={r.hasFile} />}</div>
                  </div>
                  {threadFor("request", r.id)}
                </li>
              ))}
            </ul>
          </section>
        )}
        {room.titleItems.length > 0 && (
          <section>
            <h2 className="font-display text-2xl">Title & closing</h2>
            <ul className="mt-3 divide-y rounded-md border bg-card">
              {byMine(room.titleItems).map((t) => {
                const settled = ["cleared", "accepted", "done"].includes(t.status);
                return (
                  <li key={t.id} className="px-4 py-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div><span>{t.item}</span><Mine on={t.mine} /><div className={`text-xs ${!settled && t.dueDate && t.dueDate < today ? "text-destructive" : "text-muted-foreground"}`}>{t.section === "commitment" ? "Commitment" : "Closing"} · {STATUS_LABEL[t.status] ?? t.status}{t.dueDate ? ` · due ${t.dueDate}` : ""}</div></div>
                      <div className="flex items-center gap-3"><Talk type="title" id={t.id} count={t.comments} />{!settled && <UploadBtn type="title" id={t.id} has={t.hasFile} />}</div>
                    </div>
                    {threadFor("title", t.id)}
                  </li>
                );
              })}
            </ul>
          </section>
        )}
        {room.files.length > 0 && (
          <section>
            <h2 className="font-display text-2xl">Shared files</h2>
            <ul className="mt-3 divide-y rounded-md border bg-card">
              {room.files.map((f) => (
                <li key={f.id} className="flex items-center justify-between px-4 py-3 text-sm"><span>{f.name}</span><Button variant="link" size="sm" onClick={() => void open(f.id)}>Open</Button></li>
              ))}
            </ul>
          </section>
        )}
        {room.documents.map((d) => (
          <section key={d.id} className="rounded-md border bg-card p-6">
            <h2 className="font-display text-2xl">{d.title}</h2>
            {d.sections.map((s, i) => (
              <div key={i} className="mt-4"><h3 className="text-sm font-medium">{s.title}</h3><p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{s.body}</p></div>
            ))}
          </section>
        ))}
        <section>
          <h2 className="font-display text-2xl">Messages with {room.firm.name || "the buyer"}</h2>
          <p className="text-xs text-muted-foreground">For anything that isn't about one item.</p>
          <Thread access={access} itemType="deal" itemId={room.dealId} firmName={room.firm.name} onPosted={() => undefined} />
        </section>
        <p className="text-xs text-muted-foreground">
          {"token" in access
            ? <>Private link for {room.email}, valid until {new Date(room.expiresAt).toLocaleDateString()}. <Link to="/auth" search={{ magic: true }} className="underline">Get a sign-in link by email</Link> to see all your deals in one place — no password needed.</>
            : null}
          {room.firm.contactEmail ? ` Questions: ${room.firm.contactEmail}` : ""}
        </p>
      </main>
    </div>
  );
}
