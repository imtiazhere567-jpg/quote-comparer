/**
 * A counter that goes up whenever data changes. Screens poll it (cheap, no database)
 * and only re-fetch when it moved, instead of re-loading every few seconds.
 * Kept on globalThis so every route module in the server process shares it.
 */
const g = globalThis as unknown as { __dataRev?: number };

export function bumpRevision() {
  g.__dataRev = (g.__dataRev ?? Date.now()) + 1;
}

export function currentRevision() {
  g.__dataRev ??= Date.now();
  return g.__dataRev;
}

/** Does this SQL change data? (plain writes, or our security-definer functions that write) */
export function isWrite(sql: string) {
  return /^\s*(insert|update|delete|with)\b/i.test(sql) || /\b(respond_to_owner_quote|pay_client_invoice|claim_job_invites|link_job_parties|submit_project_feedback|app_settings)\s*\(/i.test(sql);
}
