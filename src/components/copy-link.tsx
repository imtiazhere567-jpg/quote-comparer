"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";

/** Copies the absolute bid link. Built from window.location so it works on any host/port. */
export function CopyLink({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        className="btn-secondary btn-sm"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(window.location.origin + path);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            window.prompt("Copy this link", window.location.origin + path);
          }
        }}
      >
        {copied ? <Check className="text-success" /> : <Copy />}
        {copied ? "Copied" : "Copy bid link"}
      </button>
      <a href={path} target="_blank" rel="noreferrer" className="btn-quiet btn-sm">
        <ExternalLink /> Open link
      </a>
    </span>
  );
}
