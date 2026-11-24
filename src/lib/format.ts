export type Currency = "USD" | "GBP";

const formatters = new Map<string, Intl.NumberFormat>();

export function money(value: number, currency: Currency, decimals = 0) {
  const key = `${currency}-${decimals}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat(currency === "GBP" ? "en-GB" : "en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    formatters.set(key, f);
  }
  return f.format(value);
}

export function qty(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

export function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
