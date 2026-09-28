# Architecture
- Finance math lives in src/lib/finance.ts as pure functions; UI stays thin — keeps the engine portable and testable.
- Deals persist in localStorage via DealsProvider (src/lib/deals-store.tsx) until accounts/Cloud are added — zero-setup demo.
- Deal workflow runs Schedule → Data room → Reconcile → Underwrite → Financing → Diligence & retrade → Documents, so dates and source files precede analysis and final deliverables; pipeline learning lives on /insights.
