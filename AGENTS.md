# Architecture
- Finance math lives in src/lib/finance.ts as pure functions; UI stays thin — keeps the engine portable and testable.
- Deals persist in localStorage via DealsProvider (src/lib/deals-store.tsx) until accounts/Cloud are added — zero-setup demo.
- Deal workflow is 3 steps in one workspace: Reconcile → Underwrite → Diligence & retrade; pipeline learning lives on /insights.
