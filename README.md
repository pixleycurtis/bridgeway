# Keystone

**Buy-side underwriting, due diligence, and retrade software for real estate acquisitions.**

Keystone connects the whole acquisition, from the first broker OM to closing. It takes the seller's numbers, checks them against the real operating history, underwrites the deal with an institutional-grade model, and turns diligence findings into a price adjustment backed by the math. All parties work in one place, and the buyer's confidential analysis never leaves the buyer's workspace.

Built for small-balance acquisitions (roughly 2–50 units, $1–15M) across multifamily, residential, hospitality, industrial, and commercial property.

---

## Why Keystone

Acquisition teams usually juggle Excel models, email threads, data-room links, and PDF checklists. Keystone fixes three gaps:

1. **The DD-to-underwriting loop.** Diligence findings (a roof estimate, a tax reassessment, a title exception) feed straight into NOI, price, and IRR, so the retrade comes out of the numbers instead of a guess.
2. **Confidential versus shared.** Internal underwriting, retrade memos, and committee material stay private ("bunker"). Sellers, lenders, title officers, and counsel see only the items shared with their role ("bridge").
3. **Login fatigue.** Outside parties join through tokenized guest links or magic-link email sign-in. They don't need an account or a password.

---

## Features

### Deal workflow
Each deal moves through ordered steps:

**Schedule → Data room → Reconcile → Underwrite → Diligence & retrade → Title & closing → Documents → Ask AI**

- **Schedule**: key dates, tasks, and assignments; shows up on the cross-deal *Today* queue.
- **Data room**: DD request tracker and document vault, with upload, delete, and replace.
- **Reconcile**: broker OM compared line by line with the T-12, with the gaps highlighted.
- **Underwrite**: the full model (see below), with lender quotes in the Financing tab.
- **Diligence & retrade**: priced findings (annual, one-time, or credit) produce a retrade that holds the target IRR.
- **Title & closing**: commitment requirements and exceptions, objection tracking, and a dedicated closing checklist page with PDF export.
- **Documents**: branded, editable deliverables (committee memo, objection letter, retrade memo, OM-style summaries).

### Underwriting engine
- Seven model types: stabilized, value-add, bridge-to-perm, hard money / fix-and-flip, small residential, hospitality, and industrial / NNN.
- Unit-by-unit rent roll with turnover, rent growth, and expense growth.
- Itemized operating expenses and closing costs, viewable month by month or year by year.
- Debt: amortizing, interest-only, bridge, hard money, and refinance, with DSCR, debt yield, and loan sizing.
- Monthly and annual cash flow, waterfall, sources & uses, working-capital tracker.
- Comparables tab and model recommendations (rule-based plus AI).
- Accounting cross-reference tab comparing actuals with the underwrite.
- Custom fields, reorderable rows, and firm-level **underwriting templates**.
- Sensitivity and summary dashboards.

### Smart import
- Upload a Broker OM, T-12, or underwriting CSV, either when you start a deal or later.
- **Terminology matching**: recognizes equivalent labels (*year built / date built*, *stories / floors*, *real estate taxes / property taxes / ad valorem*, *terminal cap / exit cap*, and more).
- Review screen shows the confidence for every row before anything is filled in; an *Ask AI to guess* option handles unmatched rows.
- Every imported value keeps its source (file and row).
- Firms can save their own term corrections so later uploads match automatically.

### Collaboration & permissions
- Firm workspaces with team invites and per-deal team assignment.
- Role-scoped outside parties with strict tiers:
  - **Seller**: only the DD requests assigned to them
  - **Title / escrow**: only assigned title and closing items
  - **Lender**: read-only underwriting and financing summary
  - **Counsel**: explicitly shared items
- Guest rooms at `/room/<token>`: hashed tokens, 30-day expiry, revocable.
- **My Work** (`/work`): a signed-in view for outside parties listing what they need to do.
- Item threads and deal channels with internal and role-specific audiences.
- Audit events on shared activity.

### Pipeline & insights
- Pipeline with stage tabs and table/board views; stages, property types, and pass reasons are configurable per firm.
- Insights: funnel, time in stage, retrade outcomes, pass reasons, and OM vs. T-12 gaps, filterable by property type.
- Portfolio view comparing actuals with the underwrite.

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | [TanStack Start](https://tanstack.com/start) v1 (React 19, SSR, server functions) |
| Build | Vite 7 |
| Styling | Tailwind CSS v4, shadcn/ui |
| Backend | Lovable Cloud (Postgres, auth, storage, row-level security) |
| AI | Lovable AI Gateway (document extraction, drafting, model recommendations) |
| Runtime | Edge (Cloudflare Workers compatible) |
| Tests | Vitest |

---

## Project structure

```text
src/
├── routes/                 # File-based routes (TanStack Router)
│   ├── _authenticated/     # Firm workspace: pipeline, deals, insights, settings
│   ├── room.$token.tsx     # Guest deal room (no login)
│   └── work.tsx            # My Work for outside parties
├── components/             # UI: underwrite model, importer, templates library, etc.
├── lib/
│   ├── finance.ts          # Core pure finance math (analyze, retrade, findings)
│   ├── model/              # Full underwriting engine: types, debt, engine, analytics, match, import
│   ├── party-tiers.ts      # Outside-party permission tiers
│   ├── checklists.ts       # Standard DD/closing checklists by property type
│   ├── underwrite-csv.ts   # CSV underwriting parser
│   └── *.functions.ts      # Server functions (rooms, AI, files)
└── styles.css              # Design tokens & theme
supabase/migrations/        # Database schema & security policies
```

### Design principles
- **Pure finance core.** All math is in pure, tested functions (`src/lib/finance.ts`, `src/lib/model/`), and the UI stays thin.
- **One headline calculation.** Every consumer calls `analyzeDeal`, so the retrade, lender, and AI views always agree.
- **Private by default.** Storage is limited to firm members. Outside parties get files only through server-signed URLs after their role has been checked.

---

## Getting started

Requires Node.js 20+ (or Bun).

```sh
git clone <this-repository-url>
cd <repository-name>
npm install
npm run dev
```

The app runs at `http://localhost:8080`.

### Environment
The backend connection uses these variables (set automatically in Lovable):

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_SUPABASE_PROJECT_ID=
```

### Tests

```sh
npx vitest run
```

Covers the underwriting engine, the CSV parser, and terminology matching.

---

## Demo data

Two sample deals show the workflow:

- **Oakridge Terrace Apartments**: 32 units in Charlotte, NC. The broker OM says $419K NOI and the T-12 says $298K, which drives a retrade.
- **Dolores Street Flats**: 8 units in San Francisco, CA, with reassessed taxes and a seismic retrofit finding.

All demo properties, addresses, and figures are fictional.

---

## Author

**Pixley Curtis**

Built with [Lovable](https://lovable.dev).
