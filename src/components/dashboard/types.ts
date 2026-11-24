import type { Currency } from "@/lib/format";
import type { JobStatus } from "@/lib/types";

export type ProjectRow = {
  id: string;
  title: string;
  address: string | null;
  client: string | null;
  status: JobStatus;
  items: number;
  bidsIn: number;
  bidsOut: number;
  quoteStatus: string | null;
  quoteTotal: number | null;
  currency: Currency;
  updatedAt: string;
};

export type BidRow = {
  id: string;
  jobId: string;
  project: string;
  sub: string;
  company: string | null;
  total: number;
  priced: number;
  invited: number;
  submittedAt: string | null;
  currency: Currency;
};

export type QuoteRow = {
  id: string;
  jobId: string;
  project: string;
  client: string | null;
  version: number;
  total: number;
  status: string;
  sentAt: string | null;
  respondedAt: string | null;
  currency: Currency;
};
