import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireProfile } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { PageHeader } from "@/components/ui";
import { SettingsForm } from "./settings-form";

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="card h-96 animate-pulse" />}>
      <Settings />
    </Suspense>
  );
}

async function Settings() {
  const me = await requireProfile();
  if (me.role !== "contractor" && me.role !== "admin") notFound();
  const s = await getSettings();
  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Your company details and the defaults used across projects, quotes, invoices and feedback." />
      <SettingsForm initial={s} />
    </div>
  );
}
