/** Catalog of every underwriting input an upload can fill, with the terms people use for it. */
export type FieldKind = "text" | "usd" | "pct" | "n";
export type FieldSection = "Building" | "Deal terms" | "Growth & exit" | "Financing" | "Income" | "Operating expenses" | "Closing costs" | "Custom";
export interface FieldDef { id: string; label: string; section: FieldSection; kind: FieldKind; syn: string[] }

const f = (id: string, label: string, section: FieldSection, kind: FieldKind, syn: string[] = []): FieldDef => ({ id, label, section, kind, syn });

export const BUILDING_FIELDS: FieldDef[] = [
  f("b.yearBuilt", "Year built", "Building", "text", ["date built", "built", "construction year", "year of construction", "yoc", "year completed", "vintage", "built in"]),
  f("b.renovated", "Last renovated", "Building", "text", ["year renovated", "renovation year", "rehab year", "remodeled", "last remodel", "year updated"]),
  f("b.buildingSf", "Building SF", "Building", "text", ["square feet", "square footage", "gross sf", "gsf", "rentable sf", "rsf", "net rentable area", "nra", "building size", "total sf", "gba", "gross building area"]),
  f("b.lotAcres", "Lot (acres)", "Building", "text", ["acres", "acreage", "lot size", "land area", "site size", "parcel size"]),
  f("b.stories", "Stories / buildings", "Building", "text", ["stories", "floors", "levels", "number of floors", "number of stories", "buildings", "number of buildings"]),
  f("b.construction", "Construction", "Building", "text", ["construction type", "frame", "structure", "building type", "exterior"]),
  f("b.roof", "Roof type & age", "Building", "text", ["roof", "roof age", "roof type", "roofing"]),
  f("b.hvac", "HVAC type & age", "Building", "text", ["hvac", "heating", "cooling", "air conditioning", "heating and cooling", "mechanical"]),
  f("b.plumbing", "Plumbing / electrical", "Building", "text", ["plumbing", "electrical", "wiring", "piping"]),
  f("b.parking", "Parking spaces", "Building", "text", ["parking", "parking count", "stalls", "garage spaces", "parking ratio"]),
  f("b.zoning", "Zoning", "Building", "text", ["zoning code", "zone", "zoning district", "land use"]),
  f("b.parcel", "Tax parcel", "Building", "text", ["apn", "parcel number", "parcel id", "pin", "tax id", "assessor parcel number", "folio"]),
  f("b.assessed", "Assessed value", "Building", "text", ["assessment", "tax assessed value", "assessor value", "appraised value county"]),
  f("b.millage", "Tax rate (%)", "Building", "text", ["millage", "mill rate", "property tax rate", "real estate tax rate", "tax rate"]),
  f("b.unitMix", "Unit mix", "Building", "text", ["mix", "bedroom mix", "unit types"]),
  f("b.amenities", "Amenities", "Building", "text", ["features", "community amenities"]),
  f("b.utilities", "Utility billing (RUBS, sub-metered…)", "Building", "text", ["utility billing", "rubs", "submetered", "metering", "utility reimbursement method"]),
  f("b.flood", "Flood zone", "Building", "text", ["fema zone", "flood", "fema flood zone"]),
];

const CORE: FieldDef[] = [
  f("a.price", "Purchase price", "Deal terms", "usd", ["price", "asking price", "asking", "acquisition price", "contract price", "offer price", "list price", "sale price", "purchase"]),
  f("a.units", "Units / keys", "Deal terms", "n", ["units", "unit count", "number of units", "total units", "doors", "keys", "rooms", "apartments"]),
  f("a.capex", "Upfront capex", "Deal terms", "usd", ["capex", "capital expenditures", "renovation budget", "rehab budget", "capital improvements", "upfront capital", "value add budget"]),
  f("targetIrr", "Target IRR", "Deal terms", "pct", ["irr target", "hurdle rate", "required irr", "target return"]),
  f("a.closingPct", "Closing costs (% of price)", "Deal terms", "pct", ["closing costs", "closing cost", "acquisition costs", "transaction costs"]),
  f("a.rentGrowth", "Rent growth / yr", "Growth & exit", "pct", ["rent growth", "revenue growth", "income growth", "annual rent increase", "rent escalation"]),
  f("a.expenseGrowth", "Expense growth / yr", "Growth & exit", "pct", ["expense growth", "opex growth", "expense inflation", "cost growth", "expense escalation"]),
  f("a.holdYears", "Hold (years)", "Growth & exit", "n", ["hold", "hold period", "holding period", "investment horizon", "hold years"]),
  f("a.exitCap", "Exit cap rate", "Growth & exit", "pct", ["exit cap", "terminal cap", "terminal cap rate", "reversion cap", "residual cap", "going out cap", "disposition cap"]),
  f("a.sellPct", "Selling costs", "Growth & exit", "pct", ["sale costs", "disposition costs", "cost of sale", "selling expenses", "exit costs", "broker fee at sale"]),
  f("loan.ltv", "LTV", "Financing", "pct", ["loan to value", "leverage", "ltv ratio"]),
  f("loan.rate", "Interest rate", "Financing", "pct", ["rate", "interest", "coupon", "note rate", "loan rate", "mortgage rate"]),
  f("loan.amortYears", "Amortization (yrs)", "Financing", "n", ["amortization", "amortization period", "amort", "amortization years"]),
  f("loan.ioMonths", "Interest-only months", "Financing", "n", ["io period", "interest only", "interest only period", "io months"]),
  f("loan.termMonths", "Loan term (months)", "Financing", "n", ["term", "loan term", "maturity", "term months"]),
  f("loan.points", "Origination points", "Financing", "pct", ["points", "origination fee", "lender points", "loan fee"]),
  f("loan.dscrTarget", "DSCR requirement", "Financing", "n", ["dscr", "min dscr", "debt service coverage", "minimum dscr", "dscr covenant"]),
  f("line.gpr", "Gross potential rent", "Income", "usd", ["gpr", "gross potential income", "scheduled rent", "potential rental income", "gross scheduled rent", "rental income", "rent", "rents", "gross rent", "market rent total"]),
  f("line.vacancy", "Vacancy & credit loss", "Income", "usd", ["vacancy", "credit loss", "economic vacancy", "vacancy loss", "bad debt", "collection loss"]),
  f("line.other", "Other income", "Income", "usd", ["ancillary income", "misc income", "miscellaneous income", "fee income", "rubs income", "parking income", "laundry income", "utility reimbursement"]),
];

const OPEX: FieldDef[] = [
  f("opex.taxes", "Real estate taxes", "Operating expenses", "usd", ["property taxes", "re taxes", "real estate tax", "property tax", "ad valorem", "ad valorem tax", "tax expense", "taxes"]),
  f("opex.insurance", "Insurance", "Operating expenses", "usd", ["property insurance", "hazard insurance", "liability insurance", "insurance premium"]),
  f("opex.utilities", "Utilities", "Operating expenses", "usd", ["water sewer", "electric", "gas and electric", "water", "common area utilities", "utility expense"]),
  f("opex.repairs", "Repairs & maintenance", "Operating expenses", "usd", ["repairs and maintenance", "r and m", "maintenance", "repairs", "general maintenance", "building maintenance"]),
  f("opex.mgmt", "Management fee", "Operating expenses", "usd", ["management", "property management", "pm fee", "management fees", "mgmt fee", "asset management"]),
  f("opex.payroll", "Payroll", "Operating expenses", "usd", ["salaries", "wages", "personnel", "on site staff", "staff", "salaries and wages"]),
  f("opex.reserves", "Replacement reserves", "Operating expenses", "usd", ["reserves", "capital reserves", "reserve for replacement", "capex reserve"]),
  f("opex.admin", "General & administrative", "Operating expenses", "usd", ["g and a", "administrative", "admin", "office expense", "general administrative"]),
  f("opex.marketing", "Marketing", "Operating expenses", "usd", ["advertising", "leasing and marketing", "promotion"]),
  f("opex.contract", "Contract services", "Operating expenses", "usd", ["contracted services", "service contracts"]),
  f("opex.landscaping", "Landscaping", "Operating expenses", "usd", ["grounds", "grounds maintenance", "lawn care", "landscape"]),
  f("opex.trash", "Trash removal", "Operating expenses", "usd", ["trash", "waste removal", "garbage", "refuse"]),
  f("opex.pest", "Pest control", "Operating expenses", "usd", ["extermination", "exterminator", "pest"]),
  f("opex.legal", "Legal & professional", "Operating expenses", "usd", ["legal", "professional fees", "accounting", "audit", "legal and accounting"]),
  f("opex.turnover", "Turnover / make-ready", "Operating expenses", "usd", ["make ready", "turn costs", "unit turns", "turnover"]),
];

const CLOSING: FieldDef[] = [
  f("cost.title", "Title insurance", "Closing costs", "usd", ["title", "owner title policy", "lender title policy", "title policy"]),
  f("cost.escrow", "Escrow / settlement", "Closing costs", "usd", ["escrow", "settlement fee", "closing fee", "escrow fee"]),
  f("cost.legal", "Legal (acquisition)", "Closing costs", "usd", ["attorney fees", "buyer legal", "acquisition legal"]),
  f("cost.appraisal", "Appraisal", "Closing costs", "usd", ["appraisal fee", "valuation"]),
  f("cost.environmental", "Environmental (Phase I)", "Closing costs", "usd", ["phase i", "phase 1", "esa", "environmental report"]),
  f("cost.pca", "Property condition report", "Closing costs", "usd", ["pca", "pcr", "property condition assessment", "inspection"]),
  f("cost.survey", "Survey", "Closing costs", "usd", ["alta survey", "alta"]),
  f("cost.transfer", "Transfer tax", "Closing costs", "usd", ["transfer taxes", "documentary stamps", "doc stamps", "recording fees", "deed tax"]),
  f("cost.lender", "Lender legal & fees", "Closing costs", "usd", ["lender fees", "lender legal", "loan closing costs"]),
];

/** Totals and results the model computes itself — never filled from a file. */
export const COMPUTED_TERMS = ["noi", "net operating income", "total expenses", "total operating expenses", "effective gross income", "egi", "total income", "cap rate", "going in cap", "cash on cash", "equity multiple", "irr", "levered irr", "unlevered irr", "debt service", "price per unit", "expense ratio"];

export const BASE_FIELDS: FieldDef[] = [...BUILDING_FIELDS, ...CORE, ...OPEX, ...CLOSING];
export const fieldById = (fields: FieldDef[], id: string) => fields.find((x) => x.id === id);
