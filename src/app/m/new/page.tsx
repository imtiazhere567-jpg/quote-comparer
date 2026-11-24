import { Suspense } from "react";
import { requireOwner } from "@/lib/mobile-auth";
import { asSystem } from "@/lib/db";
import type { ServiceArea } from "@/lib/project-wizard";
import { Wizard } from "./wizard";

import { getSettings } from "@/lib/settings";
export default function NewProjectPage() {
  return (
    <Suspense fallback={<div className="flex-1 animate-pulse bg-surface" />}>
      <Gate />
    </Suspense>
  );
}

async function Gate() {
  await requireOwner();
  const areas = await asSystem((q) =>
    q<ServiceArea>(`select country, city, region, zip_prefixes from service_areas where active order by country, city`),
  );
  return <Wizard areas={areas} company={(await getSettings()).company_name} />;
}
