"use server";

import { refresh } from "next/cache";
import { withProfile } from "@/lib/auth";
import { withOwner } from "@/lib/mobile-auth";

/**
 * Northline sends the homeowner the final invoice, once every task is done.
 * Lines are the accepted quote's lines (the client's prices, never sub-contractor rates).
 */
export async function sendClientInvoice(formData: FormData) {
  const jobId = String(formData.get("job_id") ?? "");
  const note = String(formData.get("note") ?? "").trim() || null;
  await withProfile(async (q, me) => {
    if (me.role !== "contractor") throw new Error("Only the builder can send invoices.");
    const [job] = await q<{ id: string; title: string; owner_id: string | null; status: string; quote_id: string | null }>(
      `select j.id, j.title, j.owner_id, j.status::text,
              (select id from owner_quotes where job_id = j.id and status = 'accepted' order by version desc limit 1) as quote_id
         from jobs j where j.id = $1 and j.contractor_id = $2`,
      [jobId, me.id],
    );
    if (!job) throw new Error("Project not found.");
    if (job.status !== "completed") throw new Error("Send the invoice when every task is done.");
    if (!job.quote_id) throw new Error("This project has no accepted quote.");
    const [exists] = await q(`select 1 from invoices where job_id = $1 and kind = 'client'`, [jobId]);
    if (exists) throw new Error("The invoice was already sent.");

    const [inv] = await q<{ id: string; number: string; amount: string }>(
      `insert into invoices (number, job_id, kind, amount, note)
       select next_invoice_number('client'), $1, 'client', coalesce(sum(total), 0), $3
         from owner_quote_lines where quote_id = $2
       returning id, number, amount::text`,
      [jobId, job.quote_id, note],
    );
    await q(
      `insert into invoice_lines (invoice_id, description, quantity, unit, unit_price, total, sort_order)
       select $1, description, quantity, unit, unit_price, total, sort_order from owner_quote_lines where quote_id = $2`,
      [inv.id, job.quote_id],
    );
    if (job.owner_id)
      await q(
        `insert into notifications (job_id, profile_id, kind, title, body, link) values ($1,$2,'invoice_sent',$3,$4,$5)`,
        [jobId, job.owner_id, `Invoice ${inv.number} from ${(await q<{ c: string }>(`select company() as c`))[0].c}`, `${job.title}: the work is finished. Tap to view and pay.`, `/m/projects/${jobId}`],
      );
    await q(`insert into audit_log (job_id, actor_id, action, details) values ($1,$2,'invoice_sent',$3)`, [
      jobId,
      me.id,
      { invoice: inv.number, amount: Number(inv.amount) },
    ]);
  });
  refresh();
}

/** Homeowner pays the invoice (simulated payment). Northline keeps its margin; sub-contractors are paid automatically. */
export async function payClientInvoice(formData: FormData) {
  const invoiceId = String(formData.get("invoice_id") ?? "");
  await withOwner(async (q, me) => {
    await q(`select pay_client_invoice($1)`, [invoiceId]);
    // ask for feedback on the work
    await q(
      `insert into notifications (job_id, profile_id, kind, title, body, link)
       select i.job_id, $2, 'feedback_request', 'How was the work? Rate it', j.title || ': tell us how each part went. It takes a minute.', '/m/projects/' || i.job_id
         from invoices i join jobs j on j.id = i.job_id where i.id = $1`,
      [invoiceId, me.id],
    );
  });
  refresh();
}
