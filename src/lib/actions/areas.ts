"use server";

import { refresh } from "next/cache";
import { withProfile } from "@/lib/auth";

export type AreaFormState = { error?: string; ok?: string } | undefined;

/** Admin adds a city Northline works in. ZIP/postcode prefixes are optional (comma separated). */
export async function addServiceArea(_prev: AreaFormState, formData: FormData): Promise<AreaFormState> {
  const country = String(formData.get("country") ?? "");
  const city = String(formData.get("city") ?? "").trim();
  const region = String(formData.get("region") ?? "").trim() || null;
  const prefixes = String(formData.get("prefixes") ?? "")
    .split(/[,\s]+/)
    .map((p) => p.trim().toUpperCase())
    .filter(Boolean);
  if (country !== "US" && country !== "UK") return { error: "Choose the United States or the United Kingdom." };
  if (city.length < 2) return { error: "Enter the city or town." };
  if (country === "US" && prefixes.some((p) => !/^\d{1,5}$/.test(p))) return { error: "US ZIP prefixes are digits, e.g. 787 or 78701." };
  if (country === "UK" && prefixes.some((p) => !/^[A-Z]{1,2}(\d[A-Z\d]?)?$/.test(p))) return { error: "UK postcode prefixes look like LS, M or LS1." };
  try {
    await withProfile(async (q, me) => {
      if (me.role !== "contractor" && me.role !== "admin") throw new Error("Only Northline can change service areas.");
      await q(`insert into service_areas (country, city, region, zip_prefixes) values ($1, $2, $3, $4)`, [country, city, region, prefixes]);
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    return { error: /unique|duplicate/i.test(msg) ? `${city} is already on the list.` : msg || "Could not add the area." };
  }
  refresh();
  return { ok: `${city} added. Homeowners there can now create projects.` };
}

export async function toggleServiceArea(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  await withProfile((q) => q(`update service_areas set active = not active where id = $1`, [id]));
  refresh();
}

export async function removeServiceArea(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  await withProfile((q) => q(`delete from service_areas where id = $1`, [id]));
  refresh();
}
