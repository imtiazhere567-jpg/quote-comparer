import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { ArrowRight, ChevronLeft } from "lucide-react";
import { asSystem } from "@/lib/db";
import { isDemoMode } from "@/lib/supabase/env";
import { LogoMark } from "@/components/ui";

import { getSettings } from "@/lib/settings";
/** One simulated email, with the button that opens the private bid link. */
export default function MailPage({ params }: PageProps<"/s/[subId]/mail/[id]">) {
  return (
    <Suspense fallback={<div className="flex-1 animate-pulse bg-surface" />}>
      <Mail params={params} />
    </Suspense>
  );
}

async function Mail({ params }: { params: Promise<{ subId: string; id: string }> }) {
  await connection();
  if (!isDemoMode) notFound();
  const { subId, id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(subId) || !/^\d+$/.test(id)) notFound();
  const mail = await asSystem(async (q) => {
    const [m] = await q<{ title: string; body: string | null; link: string | null; created_at: string; kind: string; email: string | null; name: string; read_at: string | null }>(
      `select n.title, n.body, n.link, n.created_at, n.kind, s.email, s.name, n.read_at
         from notifications n join subcontractors s on s.id = n.subcontractor_id
        where n.id = $1 and n.subcontractor_id = $2`,
      [Number(id), subId],
    );
    // only write the first time (writes make every open screen refresh)
    if (m && !m.read_at) await q(`update notifications set read_at = now() where id = $1 and read_at is null`, [Number(id)]);
    return m ?? null;
  });
  if (!mail) notFound();
  const co = (await getSettings()).company_name;

  return (
    <main className="flex-1 px-5 pt-12 pb-8">
      <Link href={`/s/${subId}`} className="inline-flex items-center gap-1 text-sm font-semibold text-muted">
        <ChevronLeft className="size-4" /> Inbox
      </Link>
      <h1 className="mt-4 text-[22px] leading-tight font-bold tracking-tight">{mail.title}</h1>
      <div className="mt-4 flex items-center gap-3 border-b border-border pb-4">
        <LogoMark className="size-10" />
        <div className="min-w-0 text-sm">
          <p className="font-semibold">{co}</p>
          <p className="truncate text-xs text-muted">
            to {mail.email ?? mail.name} · {new Date(mail.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
      </div>
      <div className="space-y-4 py-5 text-[15px] leading-relaxed">
        <p>Hi {mail.name.split(" ")[0]},</p>
        <p>{mail.body}</p>
        {mail.link && (
          <Link href={mail.link} className="flex h-13 items-center justify-center gap-2 rounded-2xl bg-hero text-[16px] font-semibold text-hero-num">
            {mail.kind === "job_awarded" ? "Open my task list" : "Open bid request"} <ArrowRight className="size-5" />
          </Link>
        )}
        <p className="text-sm text-muted">
          This link is private to you. No account or password needed.
          <br />— {co}
        </p>
      </div>
    </main>
  );
}
