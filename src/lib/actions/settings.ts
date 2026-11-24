"use server";

import { refresh } from "next/cache";
import { withProfile } from "@/lib/auth";

export type SettingsState = { error?: string; ok?: string } | undefined;

const text = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

export async function saveSettings(_prev: SettingsState, fd: FormData): Promise<SettingsState> {
  const appName = text(fd, "app_name");
  const company = text(fd, "company_name");
  const email = text(fd, "contact_email");
  const markup = Number(text(fd, "default_markup"));
  const bidDays = Number(text(fd, "bid_days"));
  const dueDays = Number(text(fd, "invoice_due_days"));
  const threshold = Number(text(fd, "rating_threshold"));
  const currency = text(fd, "default_currency");
  const units = text(fd, "default_units");

  if (appName.length < 2) return { error: "Enter the app name." };
  if (company.length < 2) return { error: "Enter the company name." };
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return { error: "Enter a valid contact email." };
  if (!Number.isFinite(markup) || markup < 0 || markup > 200) return { error: "Default margin must be between 0% and 200%." };
  if (!Number.isInteger(bidDays) || bidDays < 1 || bidDays > 90) return { error: "Bid deadline must be 1 to 90 days." };
  if (!Number.isInteger(dueDays) || dueDays < 0 || dueDays > 120) return { error: "Payment terms must be 0 to 120 days." };
  if (![2, 3, 4, 5].includes(threshold)) return { error: "Choose an approval level from 2★ to 5★." };
  if (!["USD", "GBP"].includes(currency) || !["imperial", "metric"].includes(units)) return { error: "Choose a currency and units." };

  try {
    await withProfile(async (q, me) => {
      if (me.role !== "contractor" && me.role !== "admin") throw new Error("Only Northline can change settings.");
      await q(
        `update app_settings set app_name = $1, company_name = $2, contact_email = $3, contact_phone = $4,
                default_markup = $5, default_currency = $6::currency_code, default_units = $7::unit_system,
                bid_days = $8, invoice_due_days = $9, invoice_note = $10, quote_message = $11,
                rating_threshold = $12, updated_at = now()
          where id = 1`,
        [appName, company, email || null, text(fd, "contact_phone") || null, markup, currency, units, bidDays, dueDays,
         text(fd, "invoice_note") || null, text(fd, "quote_message") || null, threshold],
      );
      // the contractor's own profile shows the same company name
      await q(`update profiles set company_name = $1 where id = $2`, [company, me.id]);
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not save." };
  }
  refresh();
  return { ok: "Settings saved." };
}
