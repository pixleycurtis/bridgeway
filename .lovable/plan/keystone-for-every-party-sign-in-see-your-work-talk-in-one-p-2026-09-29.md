# Keystone for every party: sign in, see your work, talk in one place

## Does the model work beyond multifamily?
Yes for investment deals: industrial, hospitality, retail, office and small residential income property (2+ units). The parties are the same (buyer, seller, lender, title, counsel, broker) and so is the core problem: shared work with private numbers. What changes is the checklists and a few numbers.
- **Industrial:** tenant estoppels, lease abstracts, environmental Phase I/II, zoning and clear height, triple-net expense reconciliation.
- **Hospitality:** franchise agreement and required upgrades after a sale, hotel performance reports, management agreement, liquor license transfer, furniture and equipment inventory, and income by room night instead of by rent.
- **Single-family homes:** not a fit. Homebuyers use agents and consumer rules, and the tools there are already locked in. Keep Keystone on income property.

## What gets built
1. **Outside parties sign in.** An invited seller, lender, title officer or attorney can create a free account with the invited email, or keep using the no-login link. Either way they get exactly the same limited view. One person can be a party on deals with many different buyers.
2. **"My work" home for each role.** Outside parties land on one page covering all their deals: what's requested from them, what's due, and what's waiting on them, sorted by due date. Buyers keep Today.
3. **Assign requests to a party.** Any request, title item or closing row can be assigned to a role (for example "Seller" or "Title"). It shows up on that party's list and turns overdue on both sides.
4. **Conversation on each item.** Every shared item gets a comment thread visible to the firm plus that role. Buyer-only notes stay in a separate internal thread that is never shown to guests. Comment and upload counts show up on Today.
5. **Deal messages by party.** Each deal gets one channel per party (Seller, Lender, Title, Counsel) for anything that doesn't belong to a single item, plus a buyer-only channel.
6. **Checklists by property type.** Standard request lists, title and closing checklists, and data room categories change with the property type (Multifamily, Industrial, Hospitality, Retail, Office). Hospitality gets revenue-per-room fields in Reconcile.
7. **Daily email digest (opt-in).** Each person gets one morning email covering new requests, comments and due dates, with a link straight to their page. This needs an email sender set up on your domain.

## Confidentiality rules (unchanged, extended)
- Underwriting, retrade, lender quotes, internal notes and internal threads are never visible outside the firm.
- Each party sees only what is shared with or assigned to its role, whether it signs in or uses a link.
- Every view, upload and comment is logged in deal activity.

## Out of scope
- E-signatures, wire instructions, and video calls.
- Parties editing the buyer's numbers or documents.

## Technical details
- `deal_parties.user_id` (nullable) is linked on first sign-in when the verified email matches. A security-definer `my_party_deals()` returns deal id/name/address/role for the signed-in party. Party reads go through server functions that reuse the room resolvers (token OR bearer + party row), so both paths share one filter.
- Party sign-in must not auto-create a firm: `ensure_membership` skips creating a workspace for emails that only have party invites. The app shell routes party-only users to `/work`.
- New `assigned_role text` on deal_dd_items, deal_title_items and deal_tasks (assigning auto-adds that role to `shared_with`).
- New `item_comments` table (deal_id, item_type, item_id, audience 'internal'|role, author user or party, body). RLS: firm members see all; parties are served only their role's rows via server functions.
- New `deal_messages` table with the same audience model.
- Type-specific templates move into `firm-settings.ts` keyed by property type; hospitality metrics go in `finance.ts` as pure helpers.
- The digest runs as a scheduled server route under `/api/public/digest` (cron secret) once the email domain is configured.
- Verification: a signed-in party account on two deals sees only its role's items and threads; internal comments never reach a guest; checklists switch with property type.
