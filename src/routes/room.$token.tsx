import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { getRoom, getRoomFileUrl, startRoomUpload, finishRoomUpload } from "@/lib/room.functions";

export const Route = createFileRoute("/room/$token")({
  head: () => ({
    meta: [
      { title: "Deal room — Keystone" },
      { name: "description", content: "Your requests, title items and shared files for this transaction." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Deal room — Keystone" },
      { property: "og:description", content: "Your requests, title items and shared files for this transaction." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RoomPage,
});

type Room = Awaited<ReturnType<typeof getRoom>>;
const ROLE_LABEL: Record<string, string> = { seller: "Seller", title: "Title / escrow", lender: "Lender", counsel: "Counsel" };
const STATUS_LABEL: Record<string, string> = { open: "Open", objected: "Objected", cleared: "Cleared", accepted: "Accepted", "in-progress": "In progress", done: "Done", received: "Received — in review" };

function RoomPage() {
  const { token } = Route.useParams();
  const load = useServerFn(getRoom);
  const fileUrl = useServerFn(getRoomFileUrl);
  const start = useServerFn(startRoomUpload);
  const finish = useServerFn(finishRoomUpload);
  const [room, setRoom] = useState<Room | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try { setRoom(await load({ data: { token } })); setError(null); }
    catch (e) { setError(e instanceof Error ? e.message : "This link isn't working"); }
  }, [load, token]);
  useEffect(() => { void refresh(); }, [refresh]);

  const upload = async (itemType: "request" | "title", itemId: string, file?: File) => {
    if (!file) return;
    setBusy(itemId);
    try {
      const slot = await start({ data: { token, itemType, itemId, fileName: file.name } });
      const up = await supabase.storage.from("deal-files").uploadToSignedUrl(slot.path, slot.uploadToken, file);
      if (up.error) throw up.error;
      await finish({ data: { token, itemType, itemId, fileName: file.name, path: slot.path } });
      toast.success("Sent. The buyer will review it.");
      await refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Upload failed"); }
    setBusy(null);
  };

  const open = async (fileId: string) => {
    const tab = window.open("", "_blank");
    try { const { url } = await fileUrl({ data: { token, fileId } }); if (tab) tab.location.href = url; else window.location.assign(url); }
    catch (e) { tab?.close(); toast.error(e instanceof Error ? e.message : "Could not open file"); }
  };

  if (error) return <div className="mx-auto max-w-lg p-10"><h1 className="font-display text-3xl">Link unavailable</h1><p className="mt-3 text-sm text-muted-foreground">{error}</p></div>;
  if (!room) return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Opening the deal room…</div>;

  const UploadBtn = ({ type, id, has }: { type: "request" | "title"; id: string; has: boolean }) => (
    <label className={`cursor-pointer rounded border px-2.5 py-1 text-xs hover:border-primary ${busy === id ? "opacity-60" : ""}`}>
      {busy === id ? "Uploading…" : has ? "Replace file" : "Upload"}
      <input type="file" className="hidden" disabled={!!busy} onChange={(e) => { void upload(type, id, e.target.files?.[0]); e.target.value = ""; }} />
    </label>
  );

  const empty = !room.requests.length && !room.titleItems.length && !room.files.length && !room.documents.length;
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
          <h1 className="font-display text-4xl">{room.deal.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{room.deal.address}</p>
        </div>
        {empty && <p className="rounded-md border bg-card p-6 text-sm text-muted-foreground">Nothing has been shared with you yet. You'll see requests here as soon as the buyer adds them.</p>}
        {room.requests.length > 0 && (
          <section>
            <h2 className="font-display text-2xl">Requested from you</h2>
            <ul className="mt-3 divide-y rounded-md border bg-card">
              {room.requests.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div><div>{r.label}</div><div className="text-xs text-muted-foreground">{r.category} · {r.received ? "Received" : r.hasFile ? "Received — in review" : "Outstanding"}</div></div>
                  {!r.received && <UploadBtn type="request" id={r.id} has={r.hasFile} />}
                </li>
              ))}
            </ul>
          </section>
        )}
        {room.titleItems.length > 0 && (
          <section>
            <h2 className="font-display text-2xl">Title & closing</h2>
            <ul className="mt-3 divide-y rounded-md border bg-card">
              {room.titleItems.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div><div>{t.item}</div><div className="text-xs text-muted-foreground">{t.section === "commitment" ? "Commitment" : "Closing"} · {STATUS_LABEL[t.status] ?? t.status}{t.dueDate ? ` · due ${t.dueDate}` : ""}</div></div>
                  {!["cleared", "accepted", "done"].includes(t.status) && <UploadBtn type="title" id={t.id} has={t.hasFile} />}
                </li>
              ))}
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
        <p className="text-xs text-muted-foreground">Private link for {room.email}, valid until {new Date(room.expiresAt).toLocaleDateString()}. {room.firm.contactEmail ? `Questions: ${room.firm.contactEmail}` : ""}</p>
      </main>
    </div>
  );
}
