/** Standard request lists and closing checklists, tailored by property type. */

type Req = { label: string; category: string };

const BASE_DD: Req[] = [
  { label: "Trailing-12 operating statement, month by month", category: "Financial" },
  { label: "Two prior years of annual operating statements", category: "Financial" },
  { label: "General ledger, trailing 12 months", category: "Financial" },
  { label: "Real estate tax bills and pending appeals", category: "Financial" },
  { label: "Capital expenditure history (3 years)", category: "Physical" },
  { label: "Property condition & environmental (Phase I) reports", category: "Physical" },
  { label: "Roof, HVAC and system warranties", category: "Physical" },
  { label: "Service, vendor and management contracts", category: "Legal & other" },
  { label: "Insurance loss runs (5 years)", category: "Legal & other" },
  { label: "Pending or threatened litigation", category: "Legal & other" },
  { label: "Title commitment (Schedule B-II review)", category: "Title" },
  { label: "ALTA/NSPS survey", category: "Title" },
  { label: "UCC / lien search", category: "Title" },
  { label: "Closing protection letter", category: "Title" },
  { label: "Payoff letters for existing loans", category: "Title" },
];

const BY_TYPE: Record<string, Req[]> = {
  Multifamily: [
    { label: "Current certified rent roll", category: "Financial" },
    { label: "Open work orders and unit turn schedule", category: "Physical" },
    { label: "Utility bills and billback (RUBS) history", category: "Financial" },
  ],
  Industrial: [
    { label: "Rent roll with lease expirations and options", category: "Financial" },
    { label: "All leases, amendments and abstracts", category: "Legal & other" },
    { label: "NNN expense reconciliations (2 years)", category: "Financial" },
    { label: "Tenant estoppels & SNDAs", category: "Title" },
    { label: "Phase II environmental (if Phase I flags)", category: "Physical" },
    { label: "Zoning report, clear height, loading and power specs", category: "Physical" },
  ],
  Hospitality: [
    { label: "Monthly P&L by department (USALI), 3 years", category: "Financial" },
    { label: "STR reports (occupancy, ADR, RevPAR vs. comp set)", category: "Financial" },
    { label: "Franchise agreement and brand PIP estimate", category: "Legal & other" },
    { label: "Management agreement and termination terms", category: "Legal & other" },
    { label: "Liquor license and transfer requirements", category: "Legal & other" },
    { label: "FF&E inventory and reserve history", category: "Physical" },
    { label: "Group bookings and advance deposits on the books", category: "Financial" },
  ],
  Retail: [
    { label: "Rent roll with co-tenancy and kick-out clauses", category: "Financial" },
    { label: "All leases, amendments and abstracts", category: "Legal & other" },
    { label: "Tenant sales reports (percentage rent)", category: "Financial" },
    { label: "CAM reconciliations (2 years)", category: "Financial" },
    { label: "Tenant estoppels & SNDAs", category: "Title" },
    { label: "Reciprocal easement agreements (REAs)", category: "Title" },
  ],
  Office: [
    { label: "Rent roll with expirations, TI and free rent outstanding", category: "Financial" },
    { label: "All leases, amendments and abstracts", category: "Legal & other" },
    { label: "Operating expense reconciliations (2 years)", category: "Financial" },
    { label: "Outstanding leasing commissions and TI obligations", category: "Financial" },
    { label: "Tenant estoppels & SNDAs", category: "Title" },
  ],
};

export function ddTemplate(propertyType: string): Req[] {
  return [...(BY_TYPE[propertyType] ?? BY_TYPE["Multifamily"] ?? []), ...BASE_DD];
}

const BASE_CLOSING = [
  "Escrow instructions executed",
  "ALTA settlement statement — draft review",
  "Lender's closing conditions cleared",
  "Wire instructions verified (call-back)",
  "Deed recorded & confirmation received",
  "Owner's & lender's title policies issued",
];
const CLOSING_BY_TYPE: Record<string, string[]> = {
  Multifamily: ["Security deposits credited on the settlement statement", "Tenant notification letters sent"],
  Industrial: ["Tenant estoppels & SNDAs collected", "Tenant notification letters sent"],
  Retail: ["Tenant estoppels & SNDAs collected", "CAM true-up proration agreed"],
  Office: ["Tenant estoppels & SNDAs collected", "Outstanding TI / leasing commission credits agreed"],
  Hospitality: ["Franchise change-of-ownership approval received", "Liquor license transfer or interim agreement in place", "Management agreement assigned or terminated", "Guest ledger, advance deposits and FF&E prorated"],
};
export function closingTemplate(propertyType: string): string[] {
  return [...BASE_CLOSING, ...(CLOSING_BY_TYPE[propertyType] ?? [])];
}
