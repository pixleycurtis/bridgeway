// Strict permission tiers for outside parties. Server room functions enforce these;
// the buyer UI reads the same table to explain what each party will see.
export type PartyRole = "seller" | "title" | "lender" | "counsel";

export interface Tier {
  /** Data room / DD checklist requests. */
  requests: boolean;
  /** Title commitment + closing checklist items. */
  titleItems: boolean;
  /** Schedule tasks. */
  tasks: boolean;
  /** Read-only underwriting + financing summary (no broker/T-12, no retrade, no other lenders' quotes). */
  financing: boolean;
  /** Only items assigned to this role, not merely shared with it. */
  assignedOnly: boolean;
  summary: string;
}

export const TIERS: Record<PartyRole, Tier> = {
  seller: { requests: true, titleItems: false, tasks: false, financing: false, assignedOnly: true, summary: "Their assigned due-diligence requests only" },
  title: { requests: false, titleItems: true, tasks: false, financing: false, assignedOnly: true, summary: "Their assigned title and closing items only" },
  lender: { requests: false, titleItems: false, tasks: false, financing: true, assignedOnly: false, summary: "Financing and the underwriting summary" },
  counsel: { requests: true, titleItems: true, tasks: true, financing: false, assignedOnly: false, summary: "Shared requests, title items and tasks" },
};

export const tierFor = (role: string): Tier => TIERS[role as PartyRole] ?? { requests: false, titleItems: false, tasks: false, financing: false, assignedOnly: true, summary: "Nothing" };
