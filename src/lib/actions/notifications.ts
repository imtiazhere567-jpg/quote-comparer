"use server";

import { refresh } from "next/cache";
import { withProfile } from "@/lib/auth";

export async function markAllNotificationsRead() {
  await withProfile((q, me) => q(`update notifications set read_at = now() where profile_id = $1 and read_at is null`, [me.id]));
  refresh();
}

export async function markNotificationRead(id: number) {
  await withProfile((q, me) => q(`update notifications set read_at = now() where id = $1 and profile_id = $2 and read_at is null`, [id, me.id]));
}
