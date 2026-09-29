import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Public endpoints: the guest link token is the credential. Every handler
// resolves the token to one party + one deal and only touches rows shared with that role.

const tokenSchema = z.string().min(20).max(200);

async function sha256(value: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function resolveParty(token: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: party } = await supabaseAdmin.from("deal_parties").select("id, deal_id, email, role, expires_at, revoked_at").eq("token_hash", await sha256(token)).maybeSingle();
  if (!party || party.revoked_at || new Date(party.expires_at) < new Date()) throw new Error("This link has expired or was revoked. Ask the buyer for a new one.");
  const { data: deal } = await supabaseAdmin.from("deals").select("id, firm_id, name, address").eq("id", party.deal_id).maybeSingle();
  if (!deal) throw new Error("This deal is no longer available.");
  return { admin: supabaseAdmin, party, deal };
}

export const getRoom = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ token: tokenSchema }).parse(input))
  .handler(async ({ data }) => {
    const { admin, party, deal } = await resolveParty(data.token);
    const role = party.role;
    const [{ data: firm }, dd, title, files, docs] = await Promise.all([
      admin.from("firms").select("name, brand_color, logo_path, contact_name, contact_email").eq("id", deal.firm_id).maybeSingle(),
      admin.from("deal_dd_items").select("id, label, category, received, file_path").eq("deal_id", deal.id).contains("shared_with", [role]).order("created_at"),
      admin.from("deal_title_items").select("id, section, item, status, due_date, file_path").eq("deal_id", deal.id).contains("shared_with", [role]).order("created_at"),
      admin.from("deal_files").select("id, name, created_at").eq("deal_id", deal.id).contains("shared_with", [role]).order("created_at", { ascending: false }),
      admin.from("deal_documents").select("id, title, sections").eq("deal_id", deal.id).contains("shared_with", [role]),
    ]);
    let logoUrl: string | null = null;
    if (firm?.logo_path) logoUrl = (await admin.storage.from("firm-assets").createSignedUrl(firm.logo_path, 3600)).data?.signedUrl ?? null;
    await admin.from("deal_parties").update({ last_seen_at: new Date().toISOString() }).eq("id", party.id);
    await admin.from("deal_party_events").insert({ party_id: party.id, deal_id: deal.id, kind: "view" });
    return {
      role, email: party.email, expiresAt: party.expires_at,
      deal: { name: deal.name, address: deal.address },
      firm: { name: firm?.name ?? "", brandColor: firm?.brand_color ?? null, logoUrl, contactName: firm?.contact_name ?? null, contactEmail: firm?.contact_email ?? null },
      requests: (dd.data ?? []).map((r) => ({ id: r.id, label: r.label, category: r.category, received: r.received, hasFile: !!r.file_path })),
      titleItems: (title.data ?? []).map((r) => ({ id: r.id, section: r.section, item: r.item, status: r.status, dueDate: r.due_date, hasFile: !!r.file_path })),
      files: files.data ?? [],
      documents: (docs.data ?? []).map((d) => ({ id: d.id, title: d.title, sections: (d.sections as { title: string; body: string }[] | null) ?? [] })),
    };
  });

export const getRoomFileUrl = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ token: tokenSchema, fileId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { admin, party, deal } = await resolveParty(data.token);
    const { data: file } = await admin.from("deal_files").select("path, name").eq("id", data.fileId).eq("deal_id", deal.id).contains("shared_with", [party.role]).maybeSingle();
    if (!file) throw new Error("File not available to you");
    const { data: signed } = await admin.storage.from("deal-files").createSignedUrl(file.path, 600);
    if (!signed?.signedUrl) throw new Error("Could not open this file");
    await admin.from("deal_party_events").insert({ party_id: party.id, deal_id: deal.id, kind: "download", detail: file.name });
    return { url: signed.signedUrl };
  });

const itemSchema = z.object({ token: tokenSchema, itemType: z.enum(["request", "title"]), itemId: z.string().uuid(), fileName: z.string().min(1).max(200) });

async function sharedItem(admin: Awaited<ReturnType<typeof resolveParty>>["admin"], type: "request" | "title", id: string, dealId: string, role: string) {
  if (type === "request") {
    const { data } = await admin.from("deal_dd_items").select("id, label").eq("id", id).eq("deal_id", dealId).contains("shared_with", [role]).maybeSingle();
    return data ? { label: data.label } : null;
  }
  const { data } = await admin.from("deal_title_items").select("id, item").eq("id", id).eq("deal_id", dealId).contains("shared_with", [role]).maybeSingle();
  return data ? { label: data.item } : null;
}

/** Step 1 of a guest upload: a one-time signed upload slot for a shared item. */
export const startRoomUpload = createServerFn({ method: "POST" })
  .inputValidator((input) => itemSchema.parse(input))
  .handler(async ({ data }) => {
    const { admin, party, deal } = await resolveParty(data.token);
    if (!(await sharedItem(admin, data.itemType, data.itemId, deal.id, party.role))) throw new Error("This request isn't shared with you");
    const path = `${deal.firm_id}/${deal.id}/guest/${Date.now()}-${data.fileName.replace(/[^\w.-]+/g, "_")}`;
    const { data: slot, error } = await admin.storage.from("deal-files").createSignedUploadUrl(path);
    if (error || !slot) throw new Error("Could not start the upload");
    return { path, uploadToken: slot.token };
  });

/** Step 2: attach the uploaded file to the item and put a review task on the buyer's Today queue. */
export const finishRoomUpload = createServerFn({ method: "POST" })
  .inputValidator((input) => itemSchema.extend({ path: z.string().min(1).max(1024) }).parse(input))
  .handler(async ({ data }) => {
    const { admin, party, deal } = await resolveParty(data.token);
    if (!data.path.startsWith(`${deal.firm_id}/${deal.id}/guest/`)) throw new Error("Invalid upload");
    const item = await sharedItem(admin, data.itemType, data.itemId, deal.id, party.role);
    if (!item) throw new Error("This request isn't shared with you");
    const { data: exists } = await admin.storage.from("deal-files").list(data.path.split("/").slice(0, -1).join("/"), { search: data.path.split("/").pop() ?? "" });
    if (!exists?.length) throw new Error("Upload not found");
    await admin.from("deal_files").insert({ deal_id: deal.id, kind: "guest", name: data.fileName, path: data.path, shared_with: [party.role] });
    if (data.itemType === "request") await admin.from("deal_dd_items").update({ file_path: data.path }).eq("id", data.itemId);
    else await admin.from("deal_title_items").update({ file_path: data.path, status: "received" }).eq("id", data.itemId);
    await admin.from("deal_tasks").insert({ deal_id: deal.id, firm_id: deal.firm_id, kind: "task", title: `Review upload from ${party.email}: ${item.label}`, due_date: new Date().toISOString().slice(0, 10) });
    await admin.from("deal_party_events").insert({ party_id: party.id, deal_id: deal.id, kind: "upload", detail: `${item.label} — ${data.fileName}` });
    return { ok: true };
  });
