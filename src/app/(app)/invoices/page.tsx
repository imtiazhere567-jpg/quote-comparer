import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { FileText, Receipt, Send } from "lucide-react";
import { withProfile } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { money, shortDate, type Currency } from "@/lib/format";
import { sendClientInvoice } from "@/lib/actions/invoices";
import { ConfirmSubmit } from "@/components/confirm-dialog";
import { FilteredTable } from "@/components/filtered";
import { Badge, Empty, IconTile, PageHeader } from "@/components/ui";

export default function InvoicesPage() {
  return (
    <Suspense fallback={<div className="card h-96 animate-pulse" />}>
      <Invoices />
    </Suspense>
  );
}

type Ready = {
  id: string;
  title: string;
  client: string | null;
  currency: Currency;
  client_total: number;
  sub_total: number;
  sub_count: number;
};
type Inv = {
  id: string;
  number: string;
  job_id: string;
  title: string;
  currency: Currency;
  amount: number;
  status: "sent" | "paid";
  issued_at: string;
  paid_at: string | null;
  who: string | null;
};

async function Invoices() {
  const data = await withProfile(async (q, me) => {
    if (me.role !== "contractor") return null;
    const ready = await q<Ready>(
      `select j.id, j.title, coalesce(o.full_name, o.email, j.owner_email) as client, j.currency::text as currency,
              coalesce((select sum(l.total) from owner_quote_lines l
                         where l.quote_id = (select id from owner_quotes where job_id = j.id and status = 'accepted' order by version desc limit 1)), 0)::float8 as client_total,
              coalesce((select sum(amount) from invoices where job_id = j.id and kind = 'sub'), 0)::float8 as sub_total,
              (select count(*)::int from invoices where job_id = j.id and kind = 'sub') as sub_count
         from jobs j left join profiles o on o.id = j.owner_id
        where j.contractor_id = $1 and j.status = 'completed'
          and not exists (select 1 from invoices i where i.job_id = j.id and i.kind = 'client')
        order by j.updated_at desc`,
      [me.id],
    );
    const client = await q<Inv>(
      `select i.id, i.number, i.job_id, j.title, j.currency::text as currency, i.amount::float8 as amount, i.status::text as status,
              i.issued_at, i.paid_at, coalesce(o.full_name, o.email) as who
         from invoices i join jobs j on j.id = i.job_id left join profiles o on o.id = j.owner_id
        where j.contractor_id = $1 and i.kind = 'client'
        order by i.issued_at desc`,
      [me.id],
    );
    const sub = await q<Inv>(
      `select i.id, i.number, i.job_id, j.title, j.currency::text as currency, i.amount::float8 as amount, i.status::text as status,
              i.issued_at, i.paid_at, s.name as who
         from invoices i join jobs j on j.id = i.job_id
         join bid_invites bi on bi.id = i.invite_id join subcontractors s on s.id = bi.subcontractor_id
        where j.contractor_id = $1 and i.kind = 'sub'
        order by i.issued_at desc`,
      [me.id],
    );
    return { ready, client, sub };
  });
  if (!data) notFound();
  const { ready, client, sub } = data;
  const settings = await getSettings();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Invoices"
        description="Sub-contractors' invoices arrive automatically when they finish their work. When a project is done, send your client one invoice. When they pay, sub-contractors are paid automatically."
      />

      {ready.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-[15px] font-semibold">Ready to invoice</h2>
          {ready.map((r) => {
            const margin = r.client_total - r.sub_total;
            return (
              <form
                key={r.id}
                action={sendClientInvoice}
                className="card flex flex-wrap items-center gap-5 border-brand-soft-line bg-brand-soft p-5"
              >
                <input type="hidden" name="job_id" value={r.id} />
                <IconTile icon={Receipt} tone="brand" />
                <div className="min-w-[200px] flex-1">
                  <Link
                    href={`/jobs/${r.id}/progress`}
                    className="font-semibold hover:underline"
                  >
                    {r.title}
                  </Link>
                  <p className="text-[13px] text-muted">
                    All work done · client: {r.client ?? "—"} · {r.sub_count}{" "}
                    sub-contractor invoice{r.sub_count === 1 ? "" : "s"} in
                  </p>
                  <textarea
                    name="note"
                    defaultValue={settings.invoice_note ?? ""}
                    rows={1}
                    placeholder="Note to the client (optional), e.g. payment terms"
                    className="textarea mt-3 w-full max-w-lg bg-surface"
                  />
                </div>
                <dl className="grid grid-cols-3 gap-5 text-right text-[13px]">
                  <div>
                    <dt className="text-muted">Client pays</dt>
                    <dd className="num text-base font-semibold">
                      {money(r.client_total, r.currency)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted">Subs cost</dt>
                    <dd className="num text-base font-semibold">
                      {money(r.sub_total, r.currency)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted">Your margin</dt>
                    <dd className="num text-base font-semibold text-success">
                      {money(margin, r.currency)}
                    </dd>
                  </div>
                </dl>
                <ConfirmSubmit
                  confirm={{
                    title: `Send the invoice for ${r.title}?`,
                    amount: money(r.client_total, r.currency, 2),
                    body: `${r.client ?? "Your client"} gets it on their phone and can pay straight away. You keep ${money(margin, r.currency)}; sub-contractors are paid automatically.`,
                    confirmLabel: "Send invoice",
                  }}
                >
                  <Send /> Send invoice · {money(r.client_total, r.currency)}
                </ConfirmSubmit>
              </form>
            );
          })}
        </section>
      )}

      <InvoiceTable
        title="Invoices to clients"
        who="Client"
        rows={client}
        empty="When a project's work is done, send the client their invoice from here."
        status={(r) =>
          r.status === "paid" ? (
            <Badge tone="success">
              Paid {r.paid_at && shortDate(r.paid_at)}
            </Badge>
          ) : (
            <Badge tone="warning">Waiting for payment</Badge>
          )
        }
      />
      <InvoiceTable
        title="Invoices from sub-contractors"
        who="Sub-contractor"
        rows={sub}
        empty="Created automatically when a sub-contractor marks all their tasks done."
        status={(r) =>
          r.status === "paid" ? (
            <Badge tone="success">
              Paid {r.paid_at && shortDate(r.paid_at)}
            </Badge>
          ) : (
            <Badge tone="info">Paid when the client pays</Badge>
          )
        }
      />
    </div>
  );
}

function InvoiceTable({
  title,
  who,
  rows,
  empty,
  status,
}: {
  title: string;
  who: string;
  rows: Inv[];
  empty: string;
  status: (r: Inv) => ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-[15px] font-semibold">
        {title} <span className="num ml-1 text-muted">{rows.length}</span>
      </h2>
      {rows.length === 0 ? (
        <Empty icon={FileText} title="No invoices yet">
          {empty}
        </Empty>
      ) : (
        <FilteredTable
          noun="invoices"
          search={`Search invoice, project or ${who.toLowerCase()}`}
          filters={[
            {
              key: "status",
              label: "Status",
              options: [
                { value: "sent", label: "Not paid yet" },
                { value: "paid", label: "Paid" },
              ],
            },
            {
              key: "who",
              label: who,
              options: [...new Set(rows.map((r) => r.who ?? "—"))]
                .sort()
                .map((w) => ({ value: w, label: w })),
            },
          ]}
          head={
            <tr className="text-left text-xs text-muted">
              <th className="border-b border-border bg-surface-2 px-5 py-3 font-medium">
                Invoice
              </th>
              <th className="border-b border-border bg-surface-2 px-3 py-3 font-medium">
                Project
              </th>
              <th className="border-b border-border bg-surface-2 px-3 py-3 font-medium">
                {who}
              </th>
              <th className="border-b border-border bg-surface-2 px-3 py-3 font-medium">
                Issued
              </th>
              <th className="border-b border-border bg-surface-2 px-3 py-3 text-right font-medium">
                Amount
              </th>
              <th className="border-b border-border bg-surface-2 px-5 py-3 font-medium">
                Status
              </th>
            </tr>
          }
          items={rows.map((r) => ({
            text: `${r.number} ${r.title} ${r.who ?? ""}`,
            tags: { status: r.status, who: r.who ?? "—" },
            node: (
              <tr key={r.id} className="hover:bg-surface-2/60">
                <td className="num border-b border-border px-5 py-3 font-semibold">
                  {r.number}
                </td>
                <td className="border-b border-border px-3 py-3">
                  <Link
                    href={`/jobs/${r.job_id}/progress`}
                    className="hover:underline"
                  >
                    {r.title}
                  </Link>
                </td>
                <td className="border-b border-border px-3 py-3">
                  {r.who ?? "—"}
                </td>
                <td className="border-b border-border px-3 py-3 text-muted">
                  {shortDate(r.issued_at)}
                </td>
                <td className="num border-b border-border px-3 py-3 text-right font-semibold">
                  {money(r.amount, r.currency, 2)}
                </td>
                <td className="border-b border-border px-5 py-3">
                  {status(r)}
                </td>
              </tr>
            ),
          }))}
        />
      )}
    </section>
  );
}
