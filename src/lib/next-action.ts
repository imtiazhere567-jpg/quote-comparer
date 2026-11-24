import type { JobStatus } from "@/lib/types";

export type NextActionInput = {
  jobId: string;
  status: JobStatus;
  items: number;
  invites: number;
  bidsIn: number;
  quoteStatus: string | null;
  /** live offers to sub-contractors, if known */
  offered?: number;
  accepted?: number;
  /** declined offers that haven't been re-awarded */
  declined?: number;
  /** status of the invoice to the client, if sent */
  invoice?: string | null;
};

export type NextAction = {
  /** short heading, e.g. "Compare the bids" */
  title: string;
  /** one sentence on why / what happens */
  body: string;
  /** where the button goes (null = nothing to do, just wait) */
  href: string | null;
  cta: string | null;
  /** waiting on someone else, not on the contractor */
  waiting: boolean;
  /** the button sends the work list to the contractor (owner only) */
  submit?: boolean;
};

/** The contractor's single next step for a project, in plain words. */
export function contractorNextAction(p: NextActionInput): NextAction {
  const base = `/jobs/${p.jobId}`;
  if (p.status === "accepted")
    return { title: "Client accepted: work is assigned", body: "Each sub-contractor has their task list. Follow their progress here.", href: `${base}/progress`, cta: "Track progress", waiting: false };
  if (p.status === "in_progress")
    return { title: "Work in progress", body: "Sub-contractors are updating their tasks as they go.", href: `${base}/progress`, cta: "Track progress", waiting: false };
  if (p.status === "completed") {
    if (p.invoice === "paid")
      return { title: "Paid in full", body: "The client paid. Sub-contractors were paid automatically and your margin is in Revenue.", href: "/revenue", cta: "View revenue", waiting: false };
    if (p.invoice === "sent")
      return { title: "Waiting for the client to pay", body: "The invoice is on their phone. When they pay, sub-contractors are paid automatically.", href: "/invoices", cta: "View invoice", waiting: true };
    return { title: "All work done: send the invoice", body: "Every task is marked done and the sub-contractors' invoices are in. Send your client the final invoice.", href: "/invoices", cta: "Send invoice", waiting: false };
  }
  if (p.status === "cancelled")
    return { title: "Project closed", body: "Nothing more to do here.", href: null, cta: null, waiting: true };

  if (p.quoteStatus === "changes_requested")
    return { title: "Update the quote", body: "Your client asked for changes. Read their note and send a new version.", href: `${base}/quote`, cta: "Update quote", waiting: false };
  if (p.quoteStatus === "rejected")
    return { title: "Quote rejected", body: "Your client turned down the last quote. You can revise it and send a new version.", href: `${base}/quote`, cta: "Revise quote", waiting: false };
  if (p.status === "quoted" || p.quoteStatus === "sent")
    return { title: "Waiting for the client", body: "Your quote has been sent. You'll see their reply here.", href: `${base}/quote`, cta: "View sent quote", waiting: true };

  if (p.items === 0)
    return { title: "Add work items", body: "List everything that needs doing, with quantities. Sub-contractors price each line.", href: `${base}#add-item`, cta: "Add items", waiting: false };

  if (p.status === "draft" || p.invites === 0)
    return { title: "Request bids", body: `The work list has ${p.items} items. Send it to your sub-contractors so they can price it.`, href: `${base}/bids`, cta: "Request bids", waiting: false };

  if (p.status === "awarding") {
    if ((p.declined ?? 0) > 0)
      return { title: "Re-award declined work", body: `${p.declined} offer${p.declined === 1 ? " was" : "s were"} declined. Pick the next-best price.`, href: `${base}/compare`, cta: "Choose again", waiting: false };
    return { title: "Send the client a quote", body: "Your choice of sub-contractors is saved. Add your markup and send the client one price. Sub-contractors are told after the client accepts.", href: `${base}/quote`, cta: "Build quote", waiting: false };
  }

  // bidding
  if (p.bidsIn === 0)
    return { title: "Waiting for bids", body: `0 of ${p.invites} sub-contractors have sent prices. You'll get a notification as each one arrives.`, href: `${base}/bids`, cta: "View bid requests", waiting: true };
  if (p.bidsIn < p.invites)
    return { title: `${p.bidsIn} of ${p.invites} bids in, ${p.invites - p.bidsIn} to come`, body: "You can compare now, or wait for the rest. You'll get a notification for each new bid.", href: `${base}/compare`, cta: "Compare bids so far", waiting: false };
  return { title: "Compare and award", body: `All ${p.invites} bids are in. Assign it to one contractor, auto-assign the cheapest, or choose item by item.`, href: `${base}/compare`, cta: "Compare bids", waiting: false };
}

export type OwnerNextInput = {
  jobId: string;
  status: JobStatus;
  items: number;
  /** owner has sent the work list to the contractor */
  submitted: boolean;
  quoteStatus: string | null;
};

/** The homeowner's single next step on the web project page. */
export function ownerNextAction(p: OwnerNextInput): NextAction {
  const base = `/jobs/${p.jobId}`;
  if (p.status === "accepted" || p.status === "in_progress" || p.status === "completed")
    return {
      title: p.status === "completed" ? "All work done" : p.status === "in_progress" ? "Work in progress" : "Quote accepted",
      body: p.status === "accepted" ? "Northline Builders has handed out the work. Follow the progress here." : "See how far each part of the work has got.",
      href: `${base}/progress`,
      cta: "View progress",
      waiting: false,
    };
  if (p.status === "cancelled")
    return { title: "Project closed", body: "Nothing more to do here.", href: null, cta: null, waiting: true };
  if (p.quoteStatus === "sent")
    return { title: "Review your quote", body: "Northline Builders sent you a quote. Accept it, or ask for changes.", href: `${base}/quote`, cta: "Review quote", waiting: false };
  if (p.quoteStatus === "changes_requested")
    return { title: "Your quote is being updated", body: "Northline Builders is working on the changes you asked for.", href: `${base}/quote`, cta: "View last quote", waiting: true };
  if (p.status !== "draft" || p.submitted)
    return { title: "Northline Builders is getting prices", body: "They're pricing your work list with their trades. You'll get a quote here when it's ready.", href: null, cta: null, waiting: true };
  if (p.items === 0)
    return { title: "Add your work items", body: "List everything you need done, with rough quantities.", href: `${base}#add-item`, cta: "Add items", waiting: false };
  return {
    title: "Send your work list to Northline Builders",
    body: `Your list has ${p.items} item${p.items === 1 ? "" : "s"}. When it's complete, send it so they can get prices.`,
    href: base,
    cta: "Send to Northline Builders",
    waiting: false,
    submit: true,
  };
}
