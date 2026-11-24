"use client";

import { useEffect } from "react";
import { markOwnerNotificationsRead } from "@/lib/actions/owner";

/** Marks the homeowner's notifications as read once they've opened the list (the dots stay visible until next visit). */
export function MarkOwnerRead() {
  useEffect(() => {
    void markOwnerNotificationsRead();
  }, []);
  return null;
}
