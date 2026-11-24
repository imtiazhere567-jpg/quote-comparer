import { notFound } from "next/navigation";
import { Suspense } from "react";
import { MapPin, Pause, Play, Trash2 } from "lucide-react";
import { withProfile } from "@/lib/auth";
import { removeServiceArea, toggleServiceArea } from "@/lib/actions/areas";
import { ConfirmSubmit } from "@/components/confirm-dialog";
import { Badge, Empty, PageHeader } from "@/components/ui";
import { AreaForm } from "./area-form";

export default function ServiceAreasPage() {
  return (
    <Suspense fallback={<div className="card h-96 animate-pulse" />}>
      <Areas />
    </Suspense>
  );
}

type Area = { id: string; country: "US" | "UK"; city: string; region: string | null; zip_prefixes: string[]; active: boolean; projects: number };

async function Areas() {
  const areas = await withProfile(async (q, me) => {
    if (me.role !== "contractor" && me.role !== "admin") return null;
    return q<Area>(
      `select a.*,
              (select count(*)::int from jobs j where j.contractor_id = $1 and j.site_address ilike '%' || a.city || '%') as projects
         from service_areas a
        order by a.country desc, a.city`,
      [me.id],
    );
  });
  if (!areas) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Service areas"
        description="Where your company works. Homeowners outside these areas see “Sorry, we don't work in this area yet”. Add cities as the company grows."
      />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          {(["US", "UK"] as const).map((c) => {
            const list = areas.filter((a) => a.country === c);
            return (
              <section key={c} className="space-y-3">
                <h2 className="text-[15px] font-semibold">
                  {c === "US" ? "United States" : "United Kingdom"}{" "}
                  <span className="num ml-1 text-muted">{list.filter((a) => a.active).length} active</span>
                </h2>
                {list.length === 0 ? (
                  <Empty icon={MapPin} title="No areas yet">
                    Homeowners in the {c === "US" ? "United States" : "United Kingdom"} can&apos;t create projects until you add a city.
                  </Empty>
                ) : (
                  <ul className="card divide-y divide-border">
                    {list.map((a) => (
                      <li key={a.id} className={`flex flex-wrap items-center gap-4 px-5 py-3.5 ${a.active ? "" : "opacity-60"}`}>
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-brand-soft text-brand-soft-fg">
                          <MapPin className="size-4" />
                        </span>
                        <div className="min-w-[160px] flex-1">
                          <p className="font-semibold">
                            {a.city}
                            {a.region && <span className="font-normal text-muted">, {a.region}</span>}
                          </p>
                          <p className="text-xs text-subtle">
                            {a.zip_prefixes.length
                              ? `${c === "UK" ? "Postcodes" : "ZIP codes"} starting ${a.zip_prefixes.join(", ")}`
                              : `Any ${c === "UK" ? "postcode" : "ZIP code"}`}
                            {" · "}
                            {a.projects} project{a.projects === 1 ? "" : "s"}
                          </p>
                        </div>
                        {a.active ? <Badge tone="success">Active</Badge> : <Badge>Paused</Badge>}
                        <form action={toggleServiceArea}>
                          <input type="hidden" name="id" value={a.id} />
                          <button className="btn-secondary btn-sm" aria-label={`${a.active ? "Pause" : "Resume"} ${a.city}`}>
                            {a.active ? <Pause /> : <Play />} {a.active ? "Pause" : "Resume"}
                          </button>
                        </form>
                        <form action={removeServiceArea}>
                          <input type="hidden" name="id" value={a.id} />
                          <ConfirmSubmit
                            className="btn-quiet btn-sm text-danger"
                            confirm={{
                              title: `Remove ${a.city}?`,
                              body: "Homeowners there won't be able to create new projects. Existing projects are not affected.",
                              confirmLabel: "Remove",
                              tone: "danger",
                            }}
                          >
                            <Trash2 /> Remove
                          </ConfirmSubmit>
                        </form>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
        <AreaForm />
      </div>
    </div>
  );
}
