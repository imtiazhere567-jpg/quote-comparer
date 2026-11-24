import { asSystem, isDemoDb } from "@/lib/db";
import { currentRevision } from "@/lib/db/revision";

/** Current data revision, for AutoRefresh. In-memory locally; one tiny query on a hosted database. */
export async function GET() {
  const rev = isDemoDb
    ? currentRevision()
    : Number((await asSystem((q) => q<{ rev: string }>(`select rev::text from app_revision where id = 1`)))[0]?.rev ?? 0);
  return Response.json({ rev }, { headers: { "cache-control": "no-store" } });
}
