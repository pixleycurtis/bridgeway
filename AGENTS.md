# Architecture
- Finance math lives in src/lib/finance.ts as pure functions; UI stays thin — keeps the engine portable and testable.
- Deal and action records persist in Lovable Cloud with firm-scoped policies; the deal provider exposes only accessible deals — keeps collaboration and Today consistent.
- Deal workflow runs Schedule → Data room → Reconcile → Underwrite → Financing → Diligence & retrade → Documents, so dates and source files precede analysis and final deliverables; pipeline learning lives on /insights.
- Shared deal files use an authenticated server signer after deal and path checks, because storage access stays firm-member-only while invited parties can view the deal.
