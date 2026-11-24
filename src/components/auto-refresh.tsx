"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Keeps the screen up to date without hammering the server:
 * every couple of seconds it asks /api/rev (a counter, no database work) whether
 * anything changed, and only then re-fetches the page's data.
 * Waits while the user is typing or a popup is open, and while the tab is hidden.
 */
export function AutoRefresh({ seconds = 2 }: { seconds?: number }) {
  const router = useRouter();
  const seen = useRef<number | null>(null);
  const pending = useRef(false);

  useEffect(() => {
    let busy = false;
    const busyUser = () => {
      const el = document.activeElement as HTMLElement | null;
      return (
        (el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName))) || Boolean(document.querySelector("dialog[open]"))
      );
    };
    const tick = async () => {
      if (busy || document.visibilityState !== "visible") return;
      busy = true;
      try {
        const res = await fetch("/api/rev", { cache: "no-store" });
        const { rev } = (await res.json()) as { rev: number };
        if (seen.current !== null && rev !== seen.current) pending.current = true;
        seen.current = rev;
        if (pending.current && !busyUser()) {
          pending.current = false;
          router.refresh();
        }
      } catch {
        // offline or server restarting: try again next tick
      } finally {
        busy = false;
      }
    };
    void tick();
    const id = window.setInterval(tick, seconds * 1000);
    window.addEventListener("focus", tick);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", tick);
    };
  }, [router, seconds]);
  return null;
}
