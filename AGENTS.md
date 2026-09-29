# Architecture
- Finance math lives in src/lib/finance.ts as pure functions; UI stays thin — keeps the engine portable and testable.
- Deal and action records persist in Lovable Cloud with firm-scoped policies; the deal provider exposes only accessible deals — keeps collaboration and Today consistent.
- Deal workflow runs Schedule → Data room → Reconcile → Underwrite → Financing → Diligence & retrade → Title & closing → Documents, so dates and source files precede analysis, closing coordination, and final deliverables; pipeline learning lives on /insights.
- Title commitment and closing items live in deal_title_items (section = commitment | closing); the objection letter document sources only commitment-section items — keeps closing tasks out of legal notices.
- Invited title/escrow officers are role-scoped deal_parties with guest links; buyers stay the editing firm — no title-shop product surface.
- Shared deal files use an authenticated server signer after deal and path checks, because storage access stays firm-member-only while invited parties can view the deal.
- Outside parties access deals only through /room/$token guest links (deal_parties, sha256 token hash, 30-day expiry, revocable); room server functions resolve the token then use the admin client limited to rows whose shared_with contains the party role — the private workspace is never exposed and can_view_deal now equals can_edit_deal.
- Findings carry an optional impact (annual | onetime | credit) on data room and title items; the retrade includes them as adjustments tagged with source, via finance.ts findingAdjustment/underwritingGaps.
