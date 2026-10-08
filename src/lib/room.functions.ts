import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { tierFor, type Tier } from "./party-tiers";
import { analyze, type Assumptions, type LineItem } from "./finance";

// Outside-party endpoints. A caller proves access with EITHER a guest-link token
// OR a signed-in account whose verified email matches the party invite. Both paths
// resolve to one party + one deal, and every read is filtered to rows shared with that role.

const accessSchema = z.union([
  z.object({ token: z.string().min(20).max(200) }),
  z.object({ partyId: z.string().uuid() }),
]);
type Access = z.infer<typeof accessSchema>;

async function sha256(value: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Row filter for one tier: shared with the role, and (for strict tiers) assigned to it.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function scope<Q extends { contains: any; eq: any }>(q: Q, role: string, tier: Tier): Q {
  const shared = q.contains("shared_with", [role]) as Q;
  return tier.assignedOnly ? (shared.eq("assigned_role", role) as Q) : shared;
}
const none = { data: [] as never[] };

async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}
type Admin = Awaited<ReturnType<typeof admin>>;

/** Verified email of the signed-in caller, from the bearer token. */
async function callerEmail(db: Admin) {
  const auth = getRequest()?.headers.get("authorization") ?? "";
  const jwt = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!jwt) throw new Error("Please sign in again.");
  const { data, error } = await db.auth.getUser(jwt);
  if (error || !data.user?.email || !data.user.email_confirmed_at) throw new Error("Please sign in with a verified email.");
  return { email: data.user.email.toLowerCase(), userId: data.user.id, name: (data.user.user_metadata?.["full_name"] as string | undefined) ?? data.user.email };
}

async function resolveParty(access: Access) {
  const db = await admin();
  const cols = "id, deal_id, email, role, expires_at, revoked_at";
  let party: { id: string; deal_id: string; email: string; role: string; expires_at: string; revoked_at: string | null } | null;
  if ("token" in access) {
    party = (await db.from("deal_parties").select(cols).eq("token_hash", await sha256(access.token)).maybeSingle()).data;
    if (!party || party.revoked_at || new Date(party.expires_at) < new Date()) throw new Error("This link has expired or was revoked. Ask the buyer for a new one.");
  } else {
    const me = await callerEmail(db);
    party = (await db.from("deal_parties").select(cols).eq("id", access.partyId).ilike("email", me.email).maybeSingle()).data;
    if (!party || party.revoked_at) throw new Error("You no longer have access to this deal.");
  }
  const { data: deal } = await db.from("deals").select("id, firm_id, name, address").eq("id", party.deal_id).maybeSingle();
  if (!deal) throw new Error("This deal is no longer available.");
  return { db, party, deal };
}

export const getRoom = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ access: accessSchema }).parse(input))
  .handler(async ({ data }) => {
    // An expired link is an expected outcome, not a server error: return it as data.
    let resolved: Awaited<ReturnType<typeof resolveParty>>;
    try { resolved = await resolveParty(data.access); }
    catch (e) { return { unavailable: e instanceof Error ? e.message : "This link isn't working" } as const; }
    const { db, party, deal } = resolved;
    const role = party.role;
    const tier = tierFor(role);
    const [{ data: firm }, dd, title, tasks, files, docs, comments, fin] = await Promise.all([
      db.from("firms").select("name, brand_color, logo_path, contact_name, contact_email").eq("id", deal.firm_id).maybeSingle(),
      tier.requests ? scope(db.from("deal_dd_items").select("id, label, category, received, file_path, assigned_role").eq("deal_id", deal.id), role, tier).order("created_at") : none,
      tier.titleItems ? scope(db.from("deal_title_items").select("id, section, item, status, due_date, file_path, assigned_role").eq("deal_id", deal.id), role, tier).order("created_at") : none,
      tier.tasks ? scope(db.from("deal_tasks").select("id, title, due_date, done, assigned_role").eq("deal_id", deal.id), role, tier).order("due_date") : none,
      db.from("deal_files").select("id, name, created_at").eq("deal_id", deal.id).contains("shared_with", [role]).order("created_at", { ascending: false }),
      db.from("deal_documents").select("id, title, sections").eq("deal_id", deal.id).contains("shared_with", [role]),
      db.from("item_comments").select("item_id").eq("deal_id", deal.id).eq("audience", role),
      tier.financing ? db.from("deals").select("lines, assumptions").eq("id", deal.id).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    let financing: null | { price: number; loan: number; ltv: number; rate: number; amortYears: number; income: number; expenses: number; noi: number; debtService: number; dscr: number; capRate: number; lines: { label: string; kind: string; amount: number }[] } = null;
    if (fin.data) {
      // Buyer's underwriting column only — never broker/T-12 gaps, retrade findings, IRR or other lenders' quotes.
      const lines = (fin.data.lines as unknown as LineItem[]) ?? [];
      const a = fin.data.assumptions as unknown as Assumptions;
      const r = analyze(lines, a);
      financing = { price: a.price, loan: r.loan, ltv: a.ltv, rate: a.rate, amortYears: a.amortYears, income: r.income, expenses: r.expenses, noi: r.noi, debtService: r.debtService, dscr: r.dscr, capRate: r.capRate,
        lines: lines.map((l) => ({ label: l.label, kind: l.kind, amount: l.underwrite })) };
    }
    const counts: Record<string, number> = {};
    for (const c of comments.data ?? []) counts[c.item_id] = (counts[c.item_id] ?? 0) + 1;
    let logoUrl: string | null = null;
    if (firm?.logo_path) logoUrl = (await db.storage.from("firm-assets").createSignedUrl(firm.logo_path, 3600)).data?.signedUrl ?? null;
    await db.from("deal_parties").update({ last_seen_at: new Date().toISOString() }).eq("id", party.id);
    await db.from("deal_party_events").insert({ party_id: party.id, deal_id: deal.id, kind: "view" });
    return {
      unavailable: null,
      dealId: deal.id, role, email: party.email, expiresAt: party.expires_at,
      deal: { name: deal.name, address: deal.address },
      firm: { name: firm?.name ?? "", brandColor: firm?.brand_color ?? null, logoUrl, contactName: firm?.contact_name ?? null, contactEmail: firm?.contact_email ?? null },
      requests: (dd.data ?? []).map((r) => ({ id: r.id, label: r.label, category: r.category, received: r.received, hasFile: !!r.file_path, mine: r.assigned_role === role, comments: counts[r.id] ?? 0 })),
      titleItems: (title.data ?? []).map((r) => ({ id: r.id, section: r.section, item: r.item, status: r.status, dueDate: r.due_date, hasFile: !!r.file_path, mine: r.assigned_role === role, comments: counts[r.id] ?? 0 })),
      tasks: (tasks.data ?? []).map((t) => ({ id: t.id, title: t.title, dueDate: t.due_date, done: t.done, mine: t.assigned_role === role, comments: counts[t.id] ?? 0 })),
      messages: counts[deal.id] ?? 0,
      financing, tier: tier.summary,
      files: files.data ?? [],
      documents: (docs.data ?? []).map((d) => ({ id: d.id, title: d.title, sections: (d.sections as { title: string; body: string }[] | null) ?? [] })),
    };
  });

export const getRoomFileUrl = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ access: accessSchema, fileId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { db, party, deal } = await resolveParty(data.access);
    const { data: file } = await db.from("deal_files").select("path, name").eq("id", data.fileId).eq("deal_id", deal.id).contains("shared_with", [party.role]).maybeSingle();
    if (!file) throw new Error("File not available to you");
    const { data: signed } = await db.storage.from("deal-files").createSignedUrl(file.path, 600);
    if (!signed?.signedUrl) throw new Error("Could not open this file");
    await db.from("deal_party_events").insert({ party_id: party.id, deal_id: deal.id, kind: "download", detail: file.name });
    return { url: signed.signedUrl };
  });

type ItemType = "request" | "title" | "task" | "deal";
/** Label of an item only if it is shared with the role (the deal channel is always open to parties). */
async function sharedItem(db: Admin, type: ItemType, id: string, deal: { id: string; name: string }, role: string) {
  if (type === "deal") return id === deal.id ? { label: deal.name } : null;
  const tier = tierFor(role);
  if (type === "request") {
    if (!tier.requests) return null;
    const { data } = await scope(db.from("deal_dd_items").select("label").eq("id", id).eq("deal_id", deal.id), role, tier).maybeSingle();
    return data ? { label: data.label } : null;
  }
  if (type === "task") {
    if (!tier.tasks) return null;
    const { data } = await scope(db.from("deal_tasks").select("title").eq("id", id).eq("deal_id", deal.id), role, tier).maybeSingle();
    return data ? { label: data.title } : null;
  }
  if (!tier.titleItems) return null;
  const { data } = await scope(db.from("deal_title_items").select("item").eq("id", id).eq("deal_id", deal.id), role, tier).maybeSingle();
  return data ? { label: data.item } : null;
}

const uploadSchema = z.object({ access: accessSchema, itemType: z.enum(["request", "title"]), itemId: z.string().uuid(), fileName: z.string().min(1).max(200) });

/** Step 1 of a guest upload: a one-time signed upload slot for a shared item. */
export const startRoomUpload = createServerFn({ method: "POST" })
  .inputValidator((input) => uploadSchema.parse(input))
  .handler(async ({ data }) => {
    const { db, party, deal } = await resolveParty(data.access);
    if (!(await sharedItem(db, data.itemType, data.itemId, deal, party.role))) throw new Error("This request isn't shared with you");
    const path = `${deal.firm_id}/${deal.id}/guest/${Date.now()}-${data.fileName.replace(/[^\w.-]+/g, "_")}`;
    const { data: slot, error } = await db.storage.from("deal-files").createSignedUploadUrl(path);
    if (error || !slot) throw new Error("Could not start the upload");
    return { path, uploadToken: slot.token };
  });

/** Step 2: attach the uploaded file to the item and put a review task on the buyer's Today queue. */
export const finishRoomUpload = createServerFn({ method: "POST" })
  .inputValidator((input) => uploadSchema.extend({ path: z.string().min(1).max(1024) }).parse(input))
  .handler(async ({ data }) => {
    const { db, party, deal } = await resolveParty(data.access);
    if (!data.path.startsWith(`${deal.firm_id}/${deal.id}/guest/`)) throw new Error("Invalid upload");
    const item = await sharedItem(db, data.itemType, data.itemId, deal, party.role);
    if (!item) throw new Error("This request isn't shared with you");
    const { data: exists } = await db.storage.from("deal-files").list(data.path.split("/").slice(0, -1).join("/"), { search: data.path.split("/").pop() ?? "" });
    if (!exists?.length) throw new Error("Upload not found");
    await db.from("deal_files").insert({ deal_id: deal.id, kind: "guest", name: data.fileName, path: data.path, shared_with: [party.role] });
    if (data.itemType === "request") await db.from("deal_dd_items").update({ file_path: data.path }).eq("id", data.itemId);
    else await db.from("deal_title_items").update({ file_path: data.path, status: "received" }).eq("id", data.itemId);
    await db.from("deal_tasks").insert({ deal_id: deal.id, firm_id: deal.firm_id, kind: "task", title: `Review upload from ${party.email}: ${item.label}`, due_date: new Date().toISOString().slice(0, 10) });
    await db.from("deal_party_events").insert({ party_id: party.id, deal_id: deal.id, kind: "upload", detail: `${item.label} — ${data.fileName}` });
    return { ok: true };
  });

const threadSchema = z.object({ access: accessSchema, itemType: z.enum(["request", "title", "task", "deal"]), itemId: z.string().uuid() });

/** The party's thread on one item: only comments in its own role's audience, never internal notes. */
export const getRoomThread = createServerFn({ method: "POST" })
  .inputValidator((input) => threadSchema.parse(input))
  .handler(async ({ data }) => {
    const { db, party, deal } = await resolveParty(data.access);
    if (!(await sharedItem(db, data.itemType, data.itemId, deal, party.role))) throw new Error("Not shared with you");
    const { data: rows } = await db.from("item_comments").select("id, author_name, author_party, body, created_at")
      .eq("deal_id", deal.id).eq("item_id", data.itemId).eq("audience", party.role).order("created_at");
    return (rows ?? []).map((r) => ({ id: r.id, author: r.author_name, fromYou: r.author_party === party.id, body: r.body, at: r.created_at }));
  });

export const postRoomComment = createServerFn({ method: "POST" })
  .inputValidator((input) => threadSchema.extend({ body: z.string().trim().min(1).max(4000) }).parse(input))
  .handler(async ({ data }) => {
    const { db, party, deal } = await resolveParty(data.access);
    const item = await sharedItem(db, data.itemType, data.itemId, deal, party.role);
    if (!item) throw new Error("Not shared with you");
    await db.from("item_comments").insert({ deal_id: deal.id, item_type: data.itemType, item_id: data.itemId, audience: party.role, author_party: party.id, author_name: party.email, body: data.body });
    await db.from("deal_party_events").insert({ party_id: party.id, deal_id: deal.id, kind: "comment", detail: item.label });
    return { ok: true };
  });

/** Every deal the signed-in person is invited to, across all buyers, with what's waiting on them. */
export const listMyDeals = createServerFn({ method: "POST" }).handler(async () => {
  const db = await admin();
  const me = await callerEmail(db);
  const { data: parties } = await db.from("deal_parties").select("id, deal_id, role").ilike("email", me.email).is("revoked_at", null);
  await db.from("deal_parties").update({ user_id: me.userId }).ilike("email", me.email).is("user_id", null);
  const { data: membership } = await db.from("firm_members").select("firm_id").eq("user_id", me.userId).maybeSingle();
  const today = new Date().toISOString().slice(0, 10);
  const out = [];
  for (const p of parties ?? []) {
    const tier = tierFor(p.role);
    const [{ data: deal }, dd, title, tasks] = await Promise.all([
      db.from("deals").select("name, address, firm_id, firms(name)").eq("id", p.deal_id).maybeSingle(),
      tier.requests ? scope(db.from("deal_dd_items").select("id, label, received, file_path, assigned_role").eq("deal_id", p.deal_id), p.role, tier) : none,
      tier.titleItems ? scope(db.from("deal_title_items").select("id, item, status, due_date, assigned_role").eq("deal_id", p.deal_id), p.role, tier) : none,
      tier.tasks ? scope(db.from("deal_tasks").select("id, title, due_date, done, assigned_role").eq("deal_id", p.deal_id), p.role, tier) : none,
    ]);
    if (!deal) continue;
    const todo = [
      ...(dd.data ?? []).filter((r) => r.assigned_role === p.role && !r.received && !r.file_path).map((r) => ({ id: r.id, label: r.label, due: null as string | null })),
      ...(title.data ?? []).filter((r) => r.assigned_role === p.role && !["cleared", "accepted", "done", "received"].includes(r.status)).map((r) => ({ id: r.id, label: r.item, due: r.due_date })),
      ...(tasks.data ?? []).filter((r) => r.assigned_role === p.role && !r.done).map((r) => ({ id: r.id, label: r.title, due: r.due_date })),
    ].sort((a, b) => (a.due ?? "9999").localeCompare(b.due ?? "9999"));
    out.push({ partyId: p.id, role: p.role, tier: tier.summary, dealName: deal.name, address: deal.address, buyer: (deal.firms as { name: string } | null)?.name ?? "", todo, overdue: todo.filter((t) => t.due && t.due < today).length });
  }
  return { email: me.email, hasFirm: Boolean(membership), deals: out };
});
