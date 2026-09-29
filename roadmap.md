# Roadmap
- [x] Approved daily deal desk: remove redundant subtitles and step hints, improve empty states.
- [x] Today: cross-deal task/date/DD queue with ownership filters and completion.
- [x] Deal and pipeline: next action/blocker signals from real task and DD records.
- [ ] Trust pass: loading/error states and desktop/mobile verified; invited-viewer file opening awaits a separate shared-party test account with an attached file.
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
- [ ] Playwright verification of the above


## Active: 6 new buyer-facing sections (user request 2026-09-28)
- [x] Fix "Uncaught undefined" / hydration crash blanking preview (not reproducible on fresh load; ErrorComponent hardened in __root.tsx)
- [x] 1. Deal timeline & tasks (per-deal key dates, assign tasks, overdue on pipeline board)
- [x] 2. Document vault / data room (DD request tracker + files per deal)
- [x] 3. Assumptions library (firm-wide defaults per market + property type, prefill new deals)
- [x] 4. Portfolio / actuals vs. underwrite (closed deals, quarterly actuals vs plan)
- [x] 5. Lender & quote tracker (term sheet comparison per deal)
- [x] 6. Investor/committee memo (generated from deal data in document studio)
