# Underwriting rebuild: a real, flexible model

The analyst's message: underwriting is the core. Today it's one assumptions panel and one returns block. This plan turns the Underwrite step into a full model workspace with sub-tabs, a choice of model types, and firm-owned templates. Every number stays editable by hand; uploads only prefill.

## 1. Start a deal: "Enter my own" vs "Upload"
New-deal dialog asks first:
- **Enter my own data** — pick a model type (below) and a template, then land on Building info.
- **Upload data** — drop broker OM / T-12 / underwriting CSV or PDF; preview what was found; fill. Can mix both.

## 2. Model types (pick one per deal, switch anytime)
Each model type sets which sections and financing options appear and its default assumptions:
- Stabilized multifamily (current base, expanded)
- Value-add / renovation (unit turns, rent premiums, renovation budget)
- Bridge-to-perm (bridge loan during lease-up, refinance into permanent)
- Hard money / fix-and-flip (short hold, points, exit on sale)
- Small residential (1–4 units, owner-occupied option)
- Hospitality (RevPAR-driven, existing hotel panel folded in)
- Industrial / NNN (lease-by-lease, reimbursements)
A **Recommend a model** button reads the building info, comps and financing quotes and suggests the best-fit type with a short reason (Claude, grounded in deal data).

## 3. Underwrite sub-tabs
```text
Building | Rent roll | Operating expenses | Closing costs | Financing | Cash flow | Waterfall | Working capital | Comps | Accounting check | Summary
```
- **Building info**: year built, units/mix, SF, lot, construction, roof/HVAC age, parking, zoning, tax parcel, assessed value.
- **Rent roll (unit-by-unit)**: each unit's type, SF, current rent, market rent, lease end, status. Assumed turnover %, months vacant per turn, make-ready cost per turn, renovation premium. Rent growth per unit or per type.
- **Operating expenses**: itemized list (add/remove lines), each with its own basis (per unit, % of revenue, fixed) and its own growth rate; tax reassessment helper.
- **Closing costs**: itemized list (title, escrow, legal, lender fees, points, reports, transfer tax, reserves) feeding equity required.
- **Financing**: loan structures — amortizing, interest-only period, full IO, bridge (with future funding + extension), hard money (points, short term, balloon), refinance event. DSCR shown per year and per month; debt yield; max loan by DSCR/LTV.
- **Cash flow**: monthly and annual toggle for the whole projection (revenue, vacancy, expenses, NOI, debt service, capex, cash flow), with growth applied monthly.
- **Waterfall**: sources & uses plus cost tracking (budget vs spent), and an LP/GP distribution waterfall with pref and promote tiers.
- **Working capital tracker**: starting reserves, monthly draws for capex/turns/shortfalls, minimum balance warning.
- **Comps**: sale comps and rent comps (address, date, price, $/unit, cap, rent/SF); averages compared to this deal; feeds the recommendation.
- **Accounting check**: paste/upload actual P&L or GL categories; map to underwrite lines; side-by-side variance, flags ≥10%.
- **Summary**: returns (levered/unlevered IRR, multiple, CoC, DSCR, cap), sensitivity, and what flows into retrade and documents.

## 4. Custom underwriting templates (top priority)
- Firm settings gets an **Underwriting templates** library. A template saves: model type, which sub-tabs show, expense lines and bases, closing cost items, default growth/turnover/financing, comp columns, custom fields.
- **Custom fields & lines**: underwriters can add their own inputs (number/%/$) and custom line items anywhere; templates carry them.
- "Save this deal's setup as a template" and "Apply template" on any deal. Existing assumption defaults by market/type keep working as a layer on top.

## 5. Kept compatible
Reconcile, retrade, lender view, Ask AI, documents, insights keep reading the same headline numbers (NOI, price, loan, DSCR, IRR), now produced by the new engine. Existing deals open in "Stabilized" with their current numbers.

## Build order
1. Engine + storage, Building, Operating expenses, Closing costs, Financing (IO/bridge/hard money), monthly/annual cash flow.
2. Rent roll with turnover, unit-level growth; templates + custom fields; new-deal prompt.
3. Waterfall, working capital, comps, accounting check, model recommendation.
Each phase ends with tests on the math and a click-through on Oakridge Terrace and Dolores Street Flats.

## Technical details
- `src/lib/model/` pure modules: `engine.ts` (monthly projection → annual rollup), `debt.ts` (amortizing, IO, bridge, hard money, refi), `rentroll.ts`, `waterfall.ts`, `working-capital.ts`, `model-types.ts` (registry). `finance.ts` `analyze()` becomes a thin adapter so existing callers are unchanged.
- Migration: `deals.model jsonb default '{}'` (rent roll, expense items, closing items, loans, custom fields, model type), `deal_comps` table (firm-scoped RLS + grants), `underwrite_templates` table (firm_id, name, model_type, config jsonb; firm-member RLS). Accounting actuals stored in `deals.model.accounting`.
- Vitest per rule: IO payment, bridge points/extension, DSCR monthly vs annual, turnover vacancy loss, closing cost total into equity, waterfall pref/promote split, template apply.
- Recommendation via existing Claude Sonnet server function, deal data only.
