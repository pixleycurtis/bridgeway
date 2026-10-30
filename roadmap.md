# Roadmap
- [x] Approved daily deal desk: remove redundant subtitles and step hints, improve empty states.
- [x] Today: cross-deal task/date/DD queue with ownership filters and completion.
- [x] Deal and pipeline: next action/blocker signals from real task and DD records.
- [x] Trust pass: loading/error states, desktop/mobile, and outside-party file access (now via guest links, verified).
- [x] Move Schedule to step 01 and order the deal workspace from setup through documents.
- [x] Pipeline, deal workspace (reconcile / underwrite / retrade), insights
- [x] PDF/CSV upload that auto-fills OM + T-12 columns (AI extraction)
- [x] Accounts + cloud storage, sharing deals with partners/lenders
- [x] Branded PDF export (OM summary, retrade letter)
- [x] Pipeline stage tabs + board, filters, column picker
- [x] Insights: five factors, markets, speed, retrades, pass reasons, property-type filters
- [x] Firm-defined stages, property types, default targets

## Active: Title & closing (plan 2026-09-29)
- [x] New "Title & closing" deal step: commitment tracker (Schedule B-I/B-II, objection statuses), closing checklist, key dates
- [x] AI reads uploaded title commitment PDF into a review-before-apply preview
- [x] Commitment objection letter document (from tracked exceptions)
- [x] Title / escrow officer as an invited view-only party in Share
- [x] Data room "Title" category with standard title requests
- [x] "Closing" stage added to the default pipeline (open stage, before Closed)
- [x] Playwright verification of the above (commitment/closing tabs, key dates, stage select, share dialog, objection letter sourcing fixed to commitment items only)


## Active: 6 new buyer-facing sections (user request 2026-09-28)
- [x] Fix "Uncaught undefined" / hydration crash blanking preview (not reproducible on fresh load; ErrorComponent hardened in __root.tsx)
- [x] 1. Deal timeline & tasks (per-deal key dates, assign tasks, overdue on pipeline board)
- [x] 2. Document vault / data room (DD request tracker + files per deal)
- [x] 3. Assumptions library (firm-wide defaults per market + property type, prefill new deals)
- [x] 4. Portfolio / actuals vs. underwrite (closed deals, quarterly actuals vs plan)
- [x] 5. Lender & quote tracker (term sheet comparison per deal)
- [x] 6. Investor/committee memo (generated from deal data in document studio)

## Active: Private workspace, deal room, linked math (plan 2026-09-29)
- [x] Shared-with toggles on requests, title items, files, documents; role preview in Share
- [x] No-login guest links with upload, review task, expiry/revoke, activity log
- [x] Findings priced in data room/title + reconcile gaps flow into retrade and objection letter
- [x] Signed-in account access for outside parties

## Active: Bridgeway for every party (plan 2026-09-29)
- [x] Outside parties sign in (or use link); party-only accounts land on My work
- [x] My work page across deals; assign items/tasks to a party role
- [x] Item threads (internal + per role) and deal message channels; outside activity on Today
- [x] Property-type checklists (Multifamily, Industrial, Hospitality, Retail, Office) + hotel metrics
- [ ] Daily email digest — blocked: needs an email sender domain set up

- [x] Strict party tiers + magic-link sign-in for guests
- [ ] Daily email digest (blocked: needs an email sender on your domain)

## Active: Underwriting rebuild (plan 2026-10-15)
- [x] Model engine (monthly → annual), IO/bridge/hard money/refi, DSCR, closing items, opex lines
- [x] Rent roll + turnover, waterfall + cost tracker, working capital, comps, accounting check, custom fields
- [x] Model types + rule/Claude recommendation; firm templates; new-deal "enter vs upload" prompt

## Smart field matching (plan 2026-10-22)
- [x] Synonym matching, review screen, row rename/hide/notes, reorder, source dots, AI guess for unmatched
