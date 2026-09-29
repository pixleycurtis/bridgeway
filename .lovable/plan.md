# Title & closing: buyer-side workspace, AI commitment reading, and title-company access

Keystone covers Schedule → Documents but stops before the closing table. This build adds the title/escrow leg of the deal — the part today handled by email and spreadsheets — as a new deal step, wires AI to read title commitments, and lets title/escrow officers be invited as named view-only parties. That completes the buyer-side workspace now and opens a path to sell to title companies later.

## 1. New "Title & closing" deal step (step 08, after Diligence & retrade)

A new step tab on every deal with two sections driven by one new table:

- **Title commitment tracker** — exceptions from Schedule B-II, each with status: `Open → Objected → Cleared / Accepted`, plus the objection-letter due date. Also tracks Schedule B-I requirements (deed recording, entity/authority docs, payoff letters, closing protection letter).
- **Closing checklist** — escrow instructions, settlement statement drafts, wire coordination, estoppels/SNDAs, recording confirmation; each row can carry a due date and an attached file (same signed-URL pattern the data room uses).
- Surfaces the nearest title/closing date in the existing next-action signals and Today view (they already read the shared task/date hooks — closing dates just join that queue).
- Pipeline: add "Closing" as an open stage between "Under contract" and "Closed" in the default stages (it must NOT go into the terminal list — terminal stages trigger pass-reason/final-price UI).

## 2. AI reads the title commitment

- Upload the commitment PDF on the Title & closing step. AI extracts, into a review-before-apply preview (same flow as the OM/T-12 upload): Schedule A deal facts (proposed insured, policy amount), Schedule B-I requirements, Schedule B-II exceptions as tracker rows, and any dates it states.
- On apply, rows land in the commitment tracker as `Open`; you mark each `Objected` / `Accepted` / `Cleared`.
- New deliverable in the Documents studio: **Commitment objection letter** (to seller/title company), generated from the tracked exceptions and editable/exportable like every other document, closing the loop from found exception → drafted objection → tracked resolution.

## 3. Title/escrow officer as an invited party

- Add "Title / escrow officer" to the Share dialog's party list (alongside Lender, Seller, Other). Sharing is already view-only by email and grants the same read access to deal, documents, files, tracker, and schedule regardless of party label — this is a UI addition only.
- Update share-dialog copy: outside parties with view access now named as lenders, sellers, and title/escrow officers.

## 4. Data room: "Title" category

- Add a "Title" category to the diligence tracker and move "Title policy and survey" into it, plus standard rows: title commitment, ALTA/NSPS survey, UCC/lien search, closing protection letter, payoff letters, tenant estoppels & SNDAs.

## Out of scope for this pass

- Selling to title companies as customers (no title-shop-facing order intake or multi-client portals) — this build makes them invited guests; the positioning work follows once buyer-side usage exists.
- Settlement-statement version control / redlining.
- E-signatures and in-app email.

## Technical details

- Migration `deal_title_items`: `id, deal_id, firm_id, section ('commitment'|'closing'), item text, status text default 'open', due_date date, file_path text, created_by, created_at`. RLS: SELECT via `can_view_deal(deal_id)`, INSERT/UPDATE/DELETE via `can_edit_deal(deal_id)`; GRANTs to `authenticated` + `service_role` in the same migration. `status` is free text, no enum needed.
- New server fn `extractCommitment` in `src/lib/ai.functions.ts`, modeled on `extractFinancials` (file base64/text input, structured JSON reply, `.middleware([requireSupabaseAuth])`).
- Files touched: `src/routes/_authenticated/deals.$dealId.tsx` (STEPS + render branch), new `src/components/deal-closing.tsx`, `src/lib/deal-tables.ts` (title-row hooks), `src/lib/documents.ts` (`objection` DocKind, DOC_KINDS entry, defaultSections case), `src/components/deal-vault.tsx` (Title category/template), `src/components/deal-extras.tsx` (Share party + copy), `src/lib/firm-settings.ts` (Closing stage, shared title tasks in action hooks if needed).
- `finance.ts` untouched; no schema changes to existing tables except none — everything additive.
