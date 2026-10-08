import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { parseJson, runAI, runClaude } from "./ai.server";
import { analyze, type Adjustment, type Assumptions, type LineItem } from "./finance";

const LINE_KEYS = {
  gpr: "Gross potential rent (annual)",
  vacancy: "Vacancy & credit loss (annual, positive number)",
  other: "Other income (annual)",
  taxes: "Real estate taxes",
  insurance: "Insurance",
  utilities: "Utilities",
  repairs: "Repairs & maintenance (incl. turnover, contract services)",
  mgmt: "Management fee",
  payroll: "Payroll",
  reserves: "Replacement reserves",
};

const fileInput = z.object({
  fileName: z.string().max(300),
  mime: z.string().max(200),
  base64: z.string().max(15_000_000).nullable(),
  text: z.string().max(400_000).nullable(),
});

function fileMessage(f: z.infer<typeof fileInput>, prompt: string) {
  const content: ({ type: "text"; text: string } | { type: "file"; data: string; mediaType: string; filename: string })[] = [{ type: "text", text: prompt }];
  if (f.base64) content.push({ type: "file", data: f.base64, mediaType: f.mime || "application/pdf", filename: f.fileName });
  if (f.text) content.push({ type: "text", text: `File "${f.fileName}":\n${f.text}` });
  return [{ role: "user" as const, content }];
}

export const extractFinancials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => fileInput.extend({ kind: z.enum(["om", "t12"]) }).parse(d))
  .handler(async ({ data }) => {
    const what = data.kind === "om"
      ? "a broker offering memorandum (OM). Use the broker's pro forma / Year-1 projected figures"
      : "a trailing-12-month operating statement (T-12). Use the 12-month TOTAL actual figures";
    const prompt = `You are a multifamily underwriting analyst. The attached document is ${what}.
Map it to these annual line items (USD, whole numbers). Sum sub-lines into the closest category. Use 0 if truly absent.
${Object.entries(LINE_KEYS).map(([k, v]) => `- ${k}: ${v}`).join("\n")}
Also pull the unit count and asking/purchase price if stated (null if not).
Reply with only JSON: {"values":{"gpr":0,...all keys},"units":number|null,"price":number|null,"propertyName":string|null,"notes":"one or two sentences on anything uncertain"}`;
    const text = await runAI(fileMessage(data, prompt));
    const out = parseJson<{ values: Record<string, number>; units: number | null; price: number | null; propertyName: string | null; notes: string }>(text);
    const values: Record<string, number> = {};
    for (const k of Object.keys(LINE_KEYS)) values[k] = Math.round(Math.abs(Number(out.values?.[k]) || 0));
    return { values, units: out.units ?? null, price: out.price ?? null, propertyName: out.propertyName ?? null, notes: out.notes ?? "" };
  });

export type CommitmentExtract = {
  proposedInsured?: string | null;
  policyAmount?: number | null;
  requirements?: { item: string }[];
  exceptions?: { item: string }[];
  dates?: { title: string; date: string | null }[];
  notes?: string;
};

export const extractCommitment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => fileInput.parse(d))
  .handler(async ({ data }) => {
    const prompt = `You are a real estate closing analyst reviewing a title insurance commitment (ALTA form) for a commercial or multifamily acquisition.
From the attached document extract:
- Schedule A: the proposed insured(s) and the policy amount in USD (number, null if not stated)
- Schedule B-I requirements: each requirement as one short item
- Schedule B-II exceptions: each exception as one short item (liens, easements, covenants, leases, taxes)
- Any stated deadlines or dates (title objection deadline, closing date, survey date) as {"title":"...","date":"YYYY-MM-DD"}; use null for an unclear date.
Reply with only JSON: {"proposedInsured":string|null,"policyAmount":number|null,"requirements":[{"item":"..."}],"exceptions":[{"item":"..."}],"dates":[{"title":"...","date":"YYYY-MM-DD"|null}],"notes":"one or two sentences on anything uncertain"}`;
    const text = await runAI(fileMessage(data, prompt));
    return parseJson<CommitmentExtract>(text);
  });

export const writeSection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    docTitle: z.string().max(200),
    sectionTitle: z.string().max(200),
    facts: z.string().max(20_000),
    current: z.string().max(20_000),
    instructions: z.string().max(2000),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: firm } = await context.supabase.from("firms").select("name, style_profile").maybeSingle();
    const system = `You write buy-side commercial real estate deliverables for ${firm?.name ?? "an investment firm"} — documents sent to lenders and sellers.
Write clear, confident, professional prose. Never invent numbers: use only the facts provided. Plain text only, no markdown headings, no asterisks. Short paragraphs; use "• " bullets only when listing.
${firm?.style_profile ? `Match this firm's house style:\n${firm.style_profile}` : ""}`;
    const prompt = `Document: ${data.docTitle}
Section: ${data.sectionTitle}

Deal facts:
${data.facts}

Current draft:
${data.current || "(empty)"}

${data.instructions ? `Instructions: ${data.instructions}` : "Rewrite this section so it is polished and ready to send."}
Return only the section text.`;
    const text = await runAI([{ role: "user", content: prompt }], system);
    return { text: text.trim() };
  });

export const learnStyle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => fileInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: me } = await supabase.from("firm_members").select("firm_id").eq("user_id", userId).single();
    if (!me) throw new Error("No firm");
    const excerpt = (await runAI(fileMessage(data,
      `This is a past deliverable written by a real estate investment firm (memo, LOI, letter, or lender package). Describe its writing style in 6-10 bullet points: tone, formality, sentence length, how numbers are presented, recurring phrases, sign-offs, section structure. Then quote 2-3 short representative sentences. Plain text.`))).trim();
    const { error } = await supabase.from("style_samples").insert({ firm_id: me.firm_id, name: data.fileName, excerpt });
    if (error) throw new Error(error.message);
    const { data: all } = await supabase.from("style_samples").select("name, excerpt").eq("firm_id", me.firm_id);
    const profile = (await runAI([{ role: "user", content:
      `Combine these writing-style notes from a firm's past documents into one concise house style guide (max 180 words, bullet points, plain text):\n\n${(all ?? []).map((s) => `## ${s.name}\n${s.excerpt}`).join("\n\n")}` }])).trim();
    await supabase.rpc("set_style_profile", { _profile: profile });
    return { profile };
  });

export const askDeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    dealId: z.string().uuid(),
    question: z.string().min(1).max(4000),
    history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(8000) })).max(20).default([]),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [{ data: deal }, { data: dd }, { data: title }, { data: tasks }] = await Promise.all([
      supabase.from("deals").select("*").eq("id", data.dealId).maybeSingle(),
      supabase.from("deal_dd_items").select("label, category, received, notes, impact").eq("deal_id", data.dealId),
      supabase.from("deal_title_items").select("section, item, status, due_date, notes, impact").eq("deal_id", data.dealId),
      supabase.from("deal_tasks").select("title, due_date, done").eq("deal_id", data.dealId),
    ]);
    if (!deal) throw new Error("Deal not found");
    const a = deal.assumptions as Assumptions;
    const r = analyze((deal.lines as LineItem[]) ?? [], a, (deal.adjustments as Adjustment[]) ?? []);
    const money = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
    const ctx = `Deal: ${deal.name} — ${deal.address ?? ""} ${deal.market ?? ""} (${deal.property_type}, stage: ${deal.stage})
Price ${money(a.price)}, ${a.units} units, target IRR ${(deal.target_irr * 100).toFixed(1)}%, loan ${(a.ltv * 100).toFixed(0)}% LTV at ${(a.rate * 100).toFixed(2)}% / ${a.amortYears}yr am, exit cap ${(a.exitCap * 100).toFixed(2)}%, hold ${a.holdYears}yr.
Underwritten: NOI ${money(r.noi)}, cap rate ${(r.capRate * 100).toFixed(2)}%, DSCR ${r.dscr.toFixed(2)}x, debt service ${money(r.debtService)}, levered IRR ${(r.irr * 100).toFixed(1)}%.
Lines (broker / T-12 / underwritten, annual):
${((deal.lines as LineItem[]) ?? []).map((l) => `- ${l.label}: OM ${money(l.broker)} / T-12 ${money(l.t12)} / UW ${money(l.underwrite)}`).join("\n")}
DD requests:
${(dd ?? []).map((i) => `- [${i.received ? "received" : "open"}] ${i.label} (${i.category})${i.notes ? ` — ${i.notes}` : ""}${i.impact ? ` — impact: ${JSON.stringify(i.impact)}` : ""}`).join("\n") || "- none"}
Title & closing items:
${(title ?? []).map((i) => `- [${i.status}] ${i.item} (${i.section})${i.due_date ? ` due ${i.due_date}` : ""}${i.notes ? ` — ${i.notes}` : ""}`).join("\n") || "- none"}
Tasks:
${(tasks ?? []).map((t) => `- [${t.done ? "done" : "open"}] ${t.title}${t.due_date ? ` due ${t.due_date}` : ""}`).join("\n") || "- none"}`;
    const system = `You are the deal analyst inside Keystone, a buy-side real estate underwriting and diligence tool. Answer questions about the deal below using only this data — never invent numbers. Be concise and specific; cite figures. If the data doesn't contain the answer, say so. Plain text, short paragraphs, "• " bullets for lists.

${ctx}`;
    const messages = [...data.history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })), { role: "user" as const, content: data.question }];
    const text = await runClaude(messages, system);
    return { answer: text.trim() };
  });
