# Smart field matching and fully customizable input rows

Goal: an uploaded underwriting CSV (or OM/T-12) lands in the right boxes even when wording differs, the analyst confirms every match before anything is filled, and every input row in every underwrite can be renamed, added, removed, reordered and saved to a template.

## 1. Terminology dictionary (synonyms)
- One shared field catalog covering every underwrite input: building info, rent roll columns, operating expense lines, closing costs, financing, growth/exit assumptions, income lines.
- Each field has a canonical name plus built-in synonyms, e.g.
  - Year built = date built, construction year, YOC, built
  - Stories = floors, levels, # of floors
  - Real estate taxes = property taxes, RE taxes, ad valorem, tax expense
  - Gross potential rent = GPR, scheduled rent, potential rental income
  - Repairs & maintenance = R&M, maintenance, turnover repairs
  - Management fee = mgmt, property management, PM fee
  - Purchase price = price, asking, acquisition price, contract price
  - Exit cap = terminal cap, reversion cap, residual cap
- Matching ignores case, punctuation, "#", "&"/"and", abbreviations and plurals; scores close spellings (typos) and returns a confidence.
- Firms can add their own synonyms in Settings → Underwriting → Terminology, and teach it from the upload screen ("always map 'Ad Val' to Real estate taxes").

## 2. Upload review screen ("Confirm the mapping")
Replaces today's simple preview. Every row in the file appears with:
```text
File label          | File value | Goes to (dropdown)         | Current  | Match
Date Built          | 1987       | Building > Year built      | —        | Exact synonym
Ad Valorem Tax      | 48,200     | Opex > Real estate taxes   | 45,000   | Learned
Pest Control        | 2,400      | + New opex line            | —        | No match
Parking income      | 6,000      | Skip                       |          | No match
```
- Each row: change destination from a searchable dropdown of all fields, create a new custom row on the spot, or skip.
- Colored confidence (exact / synonym / close guess / unmatched); unmatched and close guesses are sorted to the top and must be reviewed.
- "Remember these mappings" saves corrections to the firm's terminology.
- Summary count before applying ("24 fields to fill, 3 new rows, 2 skipped"). Nothing changes until "Fill underwriting".
- After filling, each filled box shows a small source marker ("from Oakridge_Underwriting.csv, row 'Ad Valorem Tax'") so brokers and underwriters can audit it; undo for the whole import.
- Works for the full model too (building, opex, closing costs, loan, rent roll unit rows), not only the quick model.

## 3. Fully customizable input rows
Every section of the Underwrite tabs (Building, Rent roll columns, Operating expenses, Closing costs, Financing inputs, Assumptions, Income) gets the same row controls:
- Rename any row label (the original field stays linked underneath so math still works).
- Add custom rows anywhere with type (number, $, %, text, date) and what it affects (none, income, expense, closing cost, capex).
- Hide/remove, drag to reorder, add a note per row.
- Templates save the full row layout and labels, so an analyst's preferred layout applies to every new deal.
- Renamed labels also act as synonyms for future uploads.

## 4. Kept compatible
Existing deals, templates, retrade, lender view and documents keep reading the same numbers; renaming changes display only.

## Technical details
- `src/lib/model/fields.ts`: field catalog (id, section, canonical label, kind, synonyms, path into model/assumptions/lines).
- `src/lib/model/match.ts`: pure normalizer + scorer (token normalization, abbreviation table, Levenshtein/Jaccard) returning ranked candidates with confidence; firm synonyms merged in.
- `parseUnderwriteCsv` becomes raw row extraction; matching moves to `match.ts`; an apply function writes mapped values into model/assumptions/lines and records `model.sources[fieldId]`.
- Row customization stored in `model.layout` per section (`{ fieldId, label?, hidden?, order, note? }`) plus existing `custom` fields; templates include `layout`.
- Firm synonyms in firm settings JSON (or a small firm-scoped table with RLS + grants).
- AI fallback (Claude Sonnet) only for rows still unmatched, suggestions shown as "AI guess" for confirmation.
- Vitest: each listed synonym pair maps correctly, typo match, firm-learned mapping wins, unmatched stays unmatched, apply writes to correct field, rename doesn't change math.
