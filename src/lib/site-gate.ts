/**
 * Optional shared password for the whole site (set SITE_PASSWORD on Vercel).
 * The cookie stores a hash of the password, never the password itself.
 */
export const GATE_COOKIE = "site_pass";

export async function gateToken(password: string) {
  const data = new TextEncoder().encode(`bidlevel-gate:${password}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
