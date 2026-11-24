"use client";

import { useEffect, useState } from "react";

export const THEMES = [
  { id: "forest", label: "Forest + Sand", colors: ["#13362a", "#d9ab3f"] },
  { id: "navy", label: "Navy + Safety orange", colors: ["#0f1e33", "#f26a1b"] },
  { id: "charcoal", label: "Charcoal + Yellow", colors: ["#1c1c1c", "#ffc400"] },
  { id: "lime", label: "Ink + Lime", colors: ["#1b1b18", "#c8f03c"] },
] as const;

export function ThemeSwitcher() {
  const [theme, setTheme] = useState<string>("forest");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(document.documentElement.getAttribute("data-theme") ?? "forest");
  }, []);

  function choose(id: string) {
    setTheme(id);
    document.documentElement.setAttribute("data-theme", id);
    try {
      localStorage.setItem("bidlevel-theme", id);
    } catch {
      // storage blocked: the choice still applies for this visit
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label="Colour scheme"
      className="flex h-[38px] items-center gap-1.5 rounded-[10px] border border-border-strong bg-surface py-1 pr-1.5 pl-2.5 shadow-card-sm"
    >
      <span className="mr-0.5 hidden text-xs font-medium text-subtle sm:inline">Colors</span>
      {THEMES.map((t) => (
        <button
          key={t.id}
          role="radio"
          aria-checked={theme === t.id}
          title={t.label}
          aria-label={t.label}
          onClick={() => choose(t.id)}
          className={`grid size-[26px] grid-cols-2 overflow-hidden rounded-[7px] border-2 ${theme === t.id ? "border-foreground" : "border-transparent"}`}
        >
          <i style={{ background: t.colors[0] }} />
          <i style={{ background: t.colors[1] }} />
        </button>
      ))}
    </div>
  );
}
