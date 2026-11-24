import "server-only";
import { cache } from "react";
import { asSystem } from "@/lib/db";
import type { Currency } from "@/lib/format";

export type AppSettings = {
  app_name: string;
  company_name: string;
  contact_email: string | null;
  contact_phone: string | null;
  default_markup: number;
  default_currency: Currency;
  default_units: "imperial" | "metric";
  bid_days: number;
  invoice_due_days: number;
  invoice_note: string | null;
  quote_message: string | null;
  rating_threshold: number;
};

export const DEFAULT_SETTINGS: AppSettings = {
  app_name: "BidLevel",
  company_name: "Northline Builders",
  contact_email: null,
  contact_phone: null,
  default_markup: 15,
  default_currency: "USD",
  default_units: "imperial",
  bid_days: 14,
  invoice_due_days: 14,
  invoice_note: null,
  quote_message: null,
  rating_threshold: 4,
};

/** The app's settings (one row). Cached per request. */
export const getSettings = cache(async (): Promise<AppSettings> => {
  const rows = await asSystem((q) =>
    q<AppSettings>(
      `select app_name, company_name, contact_email, contact_phone, default_markup::float8 as default_markup,
              default_currency::text as default_currency, default_units::text as default_units, bid_days,
              invoice_due_days, invoice_note, quote_message, rating_threshold
         from app_settings where id = 1`,
    ),
  ).catch(() => []);
  return rows[0] ?? DEFAULT_SETTINGS;
});

/** Just the company name, for messages. */
export async function companyName() {
  return (await getSettings()).company_name;
}
