export type UserRole = "owner" | "contractor" | "admin";

export type JobStatus =
  | "draft"
  | "bidding"
  | "awarding"
  | "quoted"
  | "accepted"
  | "in_progress"
  | "completed"
  | "cancelled";

export type Profile = {
  id: string;
  role: UserRole;
  full_name: string;
  company_name: string | null;
  email: string;
  phone: string | null;
};

export type Job = {
  id: string;
  title: string;
  description: string | null;
  site_address: string | null;
  currency: "USD" | "GBP";
  units: "imperial" | "metric";
  status: JobStatus;
  created_by: string;
  owner_id: string | null;
  contractor_id: string | null;
  owner_email: string | null;
  contractor_email: string | null;
  details?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export const JOB_STATUS_LABEL: Record<JobStatus, string> = {
  draft: "Draft",
  bidding: "Collecting bids",
  awarding: "Comparing bids",
  quoted: "Quote sent",
  accepted: "Accepted",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const ROLE_LABEL: Record<UserRole, string> = {
  owner: "Owner",
  contractor: "Contractor",
  admin: "Admin",
};

export type ScopeItem = {
  id: string;
  job_id: string;
  stage: string;
  trade: string | null;
  description: string;
  quantity: number;
  unit: string;
  notes: string | null;
  sort_order: number;
};

export type Subcontractor = {
  id: string;
  contractor_id: string;
  name: string;
  company_name: string | null;
  trades: string[];
  email: string | null;
  phone: string | null;
};

export type InviteStatus = "sent" | "viewed" | "submitted" | "declined" | "expired";

export type BidInvite = {
  id: string;
  job_id: string;
  subcontractor_id: string;
  token: string;
  scope_item_ids: string[] | null;
  status: InviteStatus;
  sub_notes: string | null;
  expires_at: string;
  submitted_at: string | null;
  created_at: string;
};

export type BidRate = {
  invite_id: string;
  scope_item_id: string;
  unit_rate: number;
  note: string | null;
};

export type AwardStatus = "planned" | "offered" | "accepted" | "declined" | "withdrawn";

export type Award = {
  id: string;
  job_id: string;
  scope_item_id: string | null;
  invite_id: string;
  unit_rate: number | null;
  amount: number;
  status: AwardStatus;
  created_at: string;
};

export type QuoteStatus = "draft" | "sent" | "accepted" | "changes_requested" | "rejected";

export type OwnerQuote = {
  id: string;
  job_id: string;
  version: number;
  markup_percent: number;
  status: QuoteStatus;
  message: string | null;
  owner_response: string | null;
  sent_at: string | null;
  responded_at: string | null;
};

export type OwnerQuoteLine = {
  id: string;
  quote_id: string;
  scope_item_id: string | null;
  stage: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total: number;
  sort_order: number;
};

export const INVITE_STATUS_LABEL: Record<InviteStatus, string> = {
  sent: "Link sent",
  viewed: "Opened",
  submitted: "Bid received",
  declined: "Declined",
  expired: "Expired",
};

export const QUOTE_STATUS_LABEL: Record<QuoteStatus, string> = {
  draft: "Draft",
  sent: "Awaiting reply",
  accepted: "Accepted",
  changes_requested: "Changes requested",
  rejected: "Rejected",
};
