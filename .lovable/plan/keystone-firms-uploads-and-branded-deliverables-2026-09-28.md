# Keystone: firms, uploads, and branded deliverables

Deliverables are the core product. The build turns Keystone from a single-user demo into a shared firm workspace that writes the documents buyers send to lenders and sellers.

## What gets built (in order)

1. **Accounts and firm workspaces**
   - Sign in with email and password, or with Google.
   - A work email (for example `jane@acmecapital.com`) puts you in your firm's workspace automatically. The first person from a domain creates the firm and becomes its admin. Personal emails (gmail, outlook) get a solo workspace.
   - Firm roles: Admin, Analyst, Broker, Property manager, Legal counsel. Everyone in the firm can view and edit every deal.
   - Outside parties (lenders, sellers) get invited to a specific deal by email and can only view it and its documents.
   - Deals move from your browser into the cloud. The 4 sample deals get seeded for each new firm.

2. **Firm branding and interface**
   - Settings page: firm name, logo upload, brand color, contact details (name, email, phone, address), and a document font choice.
   - The brand color also tints the app for everyone in the firm, so each firm gets its own look.

3. **Upload PDFs to fill the columns**
   - On the Reconcile step, drop in the broker's offering memo and the T-12 (PDF or CSV/Excel).
   - AI reads each file and fills the Broker and T-12 columns, plus unit count and asking price when it finds them.
   - You review a preview of what it found before it's applied. The files are kept with the deal.

4. **Deliverables studio**
   - A new Documents tab on each deal that generates, from the deal's numbers:
     - Offering summary (investment memo)
     - Retrade letter
     - Lender package (loan request, debt coverage, cash flows, sensitivity)
     - Letter of intent
     - Seller due-diligence request list
   - Each document is fully editable section by section, saved with the deal, and exported as a PDF on your letterhead (logo, colors, font, contact footer).
   - "Regenerate section" rewrites one part with AI while keeping the numbers.

5. **Learns your writing style**
   - Upload past memos, LOIs, or letters in Settings. Keystone learns the firm's tone and phrasing and uses it for every AI-written section.

## Out of scope for this pass
- Real-time live co-editing (edits save and refresh, last save wins).
- E-signatures and sending documents by email from inside the app.

## Technical details
- Lovable Cloud: auth (email + Google), Postgres, private storage buckets (`deal-files`, `firm-assets`, `style-samples`).
- Tables: `firms` (domain, branding), `firm_members` (firm_id, user_id, role enum), `profiles`, `deals` (jsonb lines/assumptions/adjustments, firm_id), `deal_shares` (deal_id, email, viewer), `deal_documents` (deal_id, kind, sections jsonb), `deal_files`, `style_samples`. Roles in their own table; RLS via security-definer `is_firm_member(firm_id)` and `can_view_deal(deal_id)`.
- Signup trigger: match email domain to firm or create one; free-mail domains get a personal firm; seed demo deals.
- AI via Lovable AI Gateway in server functions: PDF text/image sent to a Gemini model with a structured tool schema for line-item extraction; document section writing uses deal numbers plus a stored firm style profile summarized from samples.
- PDF export: print-optimized branded document route rendered to PDF in the browser (clean page breaks, header/footer), so no server PDF engine is needed.
- `finance.ts` stays the single source of numbers; `DealsProvider` is swapped to read/write the cloud.
