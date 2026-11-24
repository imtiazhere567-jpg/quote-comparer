import "server-only";
import { asSystem } from "@/lib/db";

/**
 * This system has ONE contractor: Northline Builders.
 * Every homeowner project goes to them automatically.
 *
 * Set HOUSE_CONTRACTOR_EMAIL to pin the account; otherwise the first
 * contractor account is used (in demo mode: Chris Walker, Northline Builders).
 */
export async function getHouseContractor(): Promise<{ id: string; email: string; name: string } | null> {
  const pinned = process.env.HOUSE_CONTRACTOR_EMAIL?.trim().toLowerCase();
  const rows = await asSystem((q) =>
    q<{ id: string; email: string; name: string }>(
      `select id, email, coalesce(company_name, full_name) as name
         from profiles
        where role = 'contractor' and ($1::text is null or lower(email) = $1)
        order by created_at
        limit 1`,
      [pinned ?? null],
    ),
  );
  return rows[0] ?? null;
}

export const HOUSE_CONTRACTOR_NAME = "Northline Builders";
