import type { ReactNode } from "react";
import { CircleCheck, Info, OctagonAlert, TriangleAlert, type LucideIcon } from "lucide-react";
import type { JobStatus } from "@/lib/types";

/* ---------------------------------------------------------------- logo */

export function LogoMark({ className = "size-8" }: { className?: string }) {
  return (
    <span className={`inline-grid shrink-0 place-items-center rounded-[9px] bg-ink-accent ${className}`} aria-hidden>
      <svg viewBox="0 0 18 18" className="size-[56%]">
        <rect x="1" y="10" width="4" height="7" rx="1" className="fill-ink" opacity=".55" />
        <rect x="7" y="6" width="4" height="11" rx="1" className="fill-ink" opacity=".8" />
        <rect x="13" y="1" width="4" height="16" rx="1" className="fill-ink" />
      </svg>
    </span>
  );
}

export function Logo({ tone = "dark", name = "BidLevel" }: { tone?: "dark" | "light"; name?: string }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark />
      <span className={`text-[17px] font-bold tracking-tight ${tone === "light" ? "text-ink-fg" : "text-foreground"}`}>{name}</span>
    </span>
  );
}

/* ---------------------------------------------------------------- avatar */

const AVATAR_TONES: [string, string][] = [
  ["#f6ddd0", "#8a3b12"],
  ["#dde6ea", "#2f4a57"],
  ["#efe6cf", "#6b5314"],
  ["#d7ece6", "#0a5c4b"],
  ["#e8def0", "#5b3a73"],
  ["#f3e3c3", "#7a4f06"],
];

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const [bg, fg] = AVATAR_TONES[[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % AVATAR_TONES.length];
  const dims = size === "sm" ? "size-7 text-[11px]" : size === "lg" ? "size-11 text-sm" : "size-[34px] text-xs";
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${dims}`}
      style={{ background: bg, color: fg }}
      aria-hidden
    >
      {initials(name) || "?"}
    </span>
  );
}

/* ---------------------------------------------------------------- badges */

type Tone = "neutral" | "brand" | "success" | "warning" | "danger" | "info";

const BADGE: Record<Tone, string> = {
  neutral: "bg-surface-2 text-muted ring-border-strong",
  brand: "bg-brand-soft text-brand-soft-fg ring-brand-soft-line",
  success: "bg-success-soft text-success ring-success-line",
  warning: "bg-warning-soft text-warning ring-warning-line",
  danger: "bg-danger-soft text-danger ring-danger/30",
  info: "bg-info-soft text-info ring-info/25",
};

export function Badge({ tone = "neutral", children, dot = true }: { tone?: Tone; children: ReactNode; dot?: boolean }) {
  return (
    <span className={`inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold whitespace-nowrap ring-1 ring-inset ${BADGE[tone]}`}>
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

/** Small uppercase tag used inside price cells ("Lowest", "Check"). */
export function Tag({ tone, children }: { tone: "success" | "warning"; children: ReactNode }) {
  return (
    <span
      className={`rounded-[5px] px-1.5 py-px text-[10px] font-bold tracking-wide uppercase ${
        tone === "success" ? "bg-success-tag text-success" : "bg-warning-tag text-warning"
      }`}
    >
      {children}
    </span>
  );
}

const STATUS_TONE: Record<string, Tone> = {
  draft: "neutral",
  bidding: "info",
  awarding: "brand",
  quoted: "brand",
  accepted: "success",
  in_progress: "success",
  completed: "neutral",
  cancelled: "neutral",
  sent: "info",
  viewed: "info",
  submitted: "success",
  declined: "danger",
  expired: "neutral",
  offered: "brand",
  withdrawn: "neutral",
  changes_requested: "warning",
  rejected: "danger",
};

export function StatusPill({ status, children }: { status: string; children: ReactNode }) {
  return <Badge tone={STATUS_TONE[status] ?? "neutral"}>{children}</Badge>;
}

/* ---------------------------------------------------------------- workflow progress */

export const STEPS: { key: JobStatus[]; label: string }[] = [
  { key: ["draft"], label: "Work list" },
  { key: ["bidding"], label: "Bids" },
  { key: ["awarding"], label: "Award" },
  { key: ["quoted"], label: "Client quote" },
  { key: ["accepted", "in_progress", "completed"], label: "Accepted" },
];

export function stepIndex(status: JobStatus) {
  const i = STEPS.findIndex((s) => s.key.includes(status));
  return i === -1 ? 0 : i;
}

/** Five-segment progress bar. `hints` gives the small grey line under each step. */
export function Progress({ status, hints = [] }: { status: JobStatus; hints?: (string | undefined)[] }) {
  const current = stepIndex(status);
  const done = ["accepted", "in_progress", "completed"].includes(status);
  return (
    <ol className="grid grid-cols-5 gap-2">
      {STEPS.map((s, i) => {
        const complete = i < current || (done && i === current);
        const now = i === current && !done;
        return (
          <li
            key={s.label}
            className={`overflow-hidden border-t-[3px] pt-2.5 text-xs sm:text-[13px] ${
              complete ? "border-success" : now ? "border-brand" : "border-border-strong"
            }`}
            aria-current={now ? "step" : undefined}
          >
            <b className="block font-semibold text-foreground">
              {s.label}
              {complete && <span className="text-success"> ✓</span>}
            </b>
            <span className="hidden text-subtle sm:block">{hints[i] ?? " "}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** Compact progress used on job cards. */
export function MiniProgress({ status }: { status: JobStatus }) {
  const current = stepIndex(status);
  const done = ["accepted", "in_progress", "completed"].includes(status);
  return (
    <div className="flex items-center gap-1" aria-label={`Step ${current + 1} of ${STEPS.length}: ${STEPS[current].label}`}>
      {STEPS.map((s, i) => (
        <span
          key={s.label}
          className={`h-1.5 w-7 rounded-full ${i < current || done ? "bg-success" : i === current ? "bg-brand" : "bg-border-strong"}`}
        />
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- layout bits */

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <div className="mb-2">{eyebrow}</div>}
        <h1 className="text-2xl font-bold tracking-tight text-balance sm:text-[30px] sm:leading-tight">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2.5">{actions}</div>}
    </div>
  );
}

export function SectionTitle({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        {hint && <p className="mt-0.5 text-sm text-muted">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

export function CardHeader({ title, hint, action }: { title: ReactNode; hint?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
      <div className="min-w-0">
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        {hint && <p className="mt-0.5 text-[13px] text-muted">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

const ICON_TONE = {
  neutral: "bg-surface-2 text-muted ring-1 ring-border",
  brand: "bg-brand-soft text-brand-soft-fg",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  info: "bg-info-soft text-info",
};

export function IconTile({ icon: Icon, tone = "neutral", size = "md" }: { icon: LucideIcon; tone?: keyof typeof ICON_TONE; size?: "sm" | "md" }) {
  return (
    <span className={`flex shrink-0 items-center justify-center ${size === "sm" ? "size-7 rounded-md" : "size-10 rounded-[10px]"} ${ICON_TONE[tone]}`}>
      <Icon className={size === "sm" ? "size-4" : "size-5"} />
    </span>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon: LucideIcon;
  tone?: keyof typeof ICON_TONE;
}) {
  return (
    <div className="card flex gap-4 p-5">
      <IconTile icon={icon} tone={tone} />
      <div className="min-w-0">
        <p className="text-[13px] text-muted">{label}</p>
        <p className="num text-2xl font-bold">{value}</p>
        {hint && <p className="text-xs text-subtle">{hint}</p>}
      </div>
    </div>
  );
}

export function Insight({ icon, tone, title, children }: { icon: LucideIcon; tone: keyof typeof ICON_TONE; title: ReactNode; children: ReactNode }) {
  return (
    <div className="card flex gap-3.5 p-[18px]">
      <IconTile icon={icon} tone={tone} />
      <div className="min-w-0">
        <p className="text-[15px] font-semibold">{title}</p>
        <p className="mt-0.5 text-[13px] text-muted">{children}</p>
      </div>
    </div>
  );
}

export function Empty({ title, children, icon: Icon, action }: { title: string; children?: ReactNode; icon?: LucideIcon; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-14 text-center">
      {Icon && (
        <span className="mb-4 flex size-12 items-center justify-center rounded-xl bg-surface-2 text-subtle ring-1 ring-border">
          <Icon className="size-6" />
        </span>
      )}
      <p className="font-semibold">{title}</p>
      {children && <div className="mt-1 max-w-sm text-sm text-muted">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

const CALLOUT = {
  warning: { cls: "border-warning-line bg-warning-soft text-warning-text", icon: TriangleAlert, iconCls: "text-warning" },
  danger: { cls: "border-danger/30 bg-danger-soft text-danger", icon: OctagonAlert, iconCls: "text-danger" },
  info: { cls: "border-border bg-surface text-muted", icon: Info, iconCls: "text-subtle" },
  success: { cls: "border-success-line bg-success-soft text-success", icon: CircleCheck, iconCls: "text-success" },
};

export function Callout({ tone = "info", children, title }: { tone?: keyof typeof CALLOUT; children: ReactNode; title?: string }) {
  const { cls, icon: Icon, iconCls } = CALLOUT[tone];
  return (
    <div className={`flex gap-2.5 rounded-[10px] border px-3.5 py-3 text-[13px] ${cls}`} role={tone === "danger" || tone === "warning" ? "alert" : undefined}>
      <Icon className={`mt-0.5 size-4 shrink-0 ${iconCls}`} />
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        <div>{children}</div>
      </div>
    </div>
  );
}
