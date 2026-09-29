# Keystone: private workspace, shared deal room, linked math

This fixes all three problems in one build, in three phases. Each phase depends on the one before it, so the order matters.

```text
Phase 1 Private vs shared   ->  Phase 2 No-login guest links  ->  Phase 3 Findings change the price
(what guests can see)          (how guests get in)               (numbers stay linked)
```

## Phase 1: Private by default, shared on purpose (counterparty problem)
- Every deal has two areas. The **private workspace** holds underwriting, reconciliation, retrade, insights, internal notes and consultant reports. It is never visible outside the firm.
- The **shared deal room** holds only what you choose to share: specific data room requests, title commitment items, closing checklist rows, and chosen files.
- Each invited party gets a role that sets what they can see:
  - Seller / seller's counsel: their data room requests and the title/survey/environmental items marked shared.
  - Title / escrow: the title commitment, the closing checklist and title files.
  - Lender: the financing package and the lender documents you release.
- Each item, request and file gets a "Shared with" control (private by default). A "What each party sees" preview shows the room from that party's side before anything goes out.
- Viewers who are already invited move into these roles, so nobody sees the full deal by accident anymore.

## Phase 2: Guest links with no account (login problem)
- Invite someone by email and role. Keystone creates a private link (for example `/room/abc123`). You copy it into your own email, so no email service is needed yet.
- Opening the link shows a simple guest page with their items, statuses, due dates, and an upload button on each request. No password and no signup.
- Uploads go straight to the matching item. Its status changes to "Received — review", and the upload shows up in the buyer's Today queue.
- Links expire (30 days by default) and can be revoked or regenerated from the Share dialog. Every view and upload is logged.
- Parties who prefer an account can still sign in and see the same limited room.

## Phase 3: Findings that change the price (disconnected-documents problem)
- Due diligence findings and title items get an optional **cost impact**: a one-time cost, a yearly income or expense change, or a price credit.
- Those impacts feed the underwriting automatically. The retrade step shows the price that still hits your target return, with each finding listed alongside it.
- The objection letter and retrade letter get one-click "include this finding" choices, with the dollar amounts taken from the linked numbers.
- When a rent roll or operating statement is uploaded to the data room, Keystone offers to check it against the reconciliation numbers and flags differences of 10% or more as findings.

## Out of scope for this pass
- Sending invites from inside Keystone (you copy the link yourself; built-in email can come later).
- E-signatures, wire instructions, and live chat threads (comments on items can come next).

## Technical details
- New `deal_parties` table (deal_id, email, role enum seller|title|lender|counsel, token_hash, expires_at, revoked_at). Existing `deal_shares` rows move over to it.
- New `shared_with text[]` column on deal_dd_items, deal_title_items, deal_files, and deal_documents. Existing viewer read policies are narrowed so shared parties only read rows whose `shared_with` includes their role (a new security-definer function `party_role(deal)`). Tables that stay private (deals.assumptions, lines, retrade, quotes, actuals) are no longer readable by outside parties. The guest room shows a summary view with just the deal name and address.
- Guest routes live at the public `/room/$token`. Server functions hash the token, check that it hasn't expired or been revoked, then read and write through the admin client, limited to that party's deal and role. Uploads go to `deal-files/{firm}/{deal}/guest/...` and use the signer in deal-files.functions.ts. A new `deal_party_events` table serves as the audit log.
- New `impact jsonb` column (type, amount, basis) on deal_dd_items and deal_title_items. `finance.ts` gains a pure `applyFindingImpacts()` used by the Underwrite and Retrade steps. `documents.ts` picks up the included findings.
- The rent roll / operating statement check reuses the existing extraction in ai.functions.ts and compares against the deal's lines.
- Verification uses Playwright: a signed-in buyer marks items shared, then a fresh unauthenticated browser opens the guest link, sees only the shared items, and uploads a file. A revoked link must be denied, and the retrade price must change when a finding impact is added.
