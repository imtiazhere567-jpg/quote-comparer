"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  Bath,
  Building2,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  CircleCheck,
  CookingPot,
  Hammer,
  House,
  LoaderCircle,
  MapPinOff,
  Minus,
  Plus,
  Search,
  Sparkles,
  X,
  type LucideIcon,
} from "lucide-react";
import { createOwnerProject } from "@/lib/actions/owner";
import {
  ALL_STAGES,
  BUDGET_CUSTOM,
  BUDGET_UNSURE,
  checkServiceArea,
  budgetLabel,
  budgetOptions,
  DEFAULT_STAGES,
  emptyAnswers,
  FINISHES,
  generateWorkList,
  isWholeHome,
  PROJECT_TYPES,
  ROOM_SUGGESTIONS,
  START_OPTIONS,
  STAGE_GROUPS,
  STEP_KEYS,
  stepValid,
  suggestedTitle,
  type AreaCheck,
  type ProjectType,
  type ServiceArea,
  type StepKey,
  type WizardAnswers,
} from "@/lib/project-wizard";
import { qty } from "@/lib/format";

const TYPE_ICON: Record<ProjectType, LucideIcon> = {
  new_home: House,
  extension: Building2,
  renovation: Hammer,
  kitchen: CookingPot,
  bathroom: Bath,
};

const STEP_TEXT: Record<StepKey, { title: string; hint: string }> = {
  type: { title: "What are you planning?", hint: "Pick the one that fits best. You can add details later." },
  location: { title: "Where is the property?", hint: "Your contractor uses this to plan the work." },
  size: { title: "How big is it?", hint: "A rough size is fine. We use it to estimate quantities." },
  scope: { title: "What should be included?", hint: "We've ticked the usual work. Add anything else you need." },
  finish: { title: "What level of finish?", hint: "This guides the materials your contractor prices." },
  timing: { title: "Timing and budget", hint: "Helps your contractor plan. It's never shared with trades." },
  review: { title: "Check and create", hint: "Make sure everything looks right." },
};

export function Wizard({ areas, company }: { areas: ServiceArea[]; company: string }) {
  const router = useRouter();
  const [a, setA] = useState<WizardAnswers>(emptyAnswers);
  const [i, setI] = useState(0);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const step = STEP_KEYS[i];
  const areaCheck = checkServiceArea(a, areas);
  const valid = stepValid(step, a) && (step !== "location" || areaCheck.ok);
  const set = <K extends keyof WizardAnswers>(k: K, v: WizardAnswers[K]) => setA((p) => ({ ...p, [k]: v }));

  function next() {
    if (!valid) return;
    if (STEP_KEYS[i + 1] === "review" && !a.title.trim()) set("title", suggestedTitle(a));
    if (i < STEP_KEYS.length - 1) {
      setI(i + 1);
      window.scrollTo({ top: 0 });
    } else submit();
  }
  function back() {
    if (i > 0) setI(i - 1);
  }
  function goTo(k: StepKey) {
    setI(STEP_KEYS.indexOf(k));
  }

  function submit() {
    setError(null);
    start(async () => {
      try {
        const { id } = await createOwnerProject(a);
        router.replace(`/m/projects/${id}?created=1`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
      }
    });
  }

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-20 bg-background/95 px-4 pt-11 pb-3 backdrop-blur">
        <div className="flex h-10 items-center justify-between">
          {i === 0 ? (
            <Link href="/m" className="flex size-10 items-center justify-center rounded-full bg-surface ring-1 ring-border" aria-label="Cancel">
              <X className="size-5" />
            </Link>
          ) : (
            <button onClick={back} className="flex size-10 items-center justify-center rounded-full bg-surface ring-1 ring-border" aria-label="Back">
              <ChevronLeft className="size-5" />
            </button>
          )}
          <p className="text-[15px] font-semibold">New project</p>
          <p className="num w-10 text-right text-[13px] text-muted">
            {i + 1}/{STEP_KEYS.length}
          </p>
        </div>
        <div className="mt-3 flex gap-1" aria-hidden>
          {STEP_KEYS.map((k, n) => (
            <span key={k} className={`h-1 flex-1 rounded-full transition-colors ${n <= i ? "bg-hero" : "bg-border-strong"}`} />
          ))}
        </div>
      </header>

      {/* Step */}
      <main key={step} className="animate-step-in flex-1 px-5 pt-4 pb-8">
        <h1 className="text-[26px] leading-tight font-bold tracking-tight">{STEP_TEXT[step].title}</h1>
        <p className="mt-1.5 text-[15px] text-muted">{STEP_TEXT[step].hint}</p>
        <div className="mt-6">
          {step === "type" && <TypeStep a={a} setA={setA} />}
          {step === "location" && <LocationStep a={a} set={set} areas={areas} check={areaCheck} />}
          {step === "size" && <SizeStep a={a} set={set} />}
          {step === "scope" && <ScopeStep a={a} set={set} />}
          {step === "finish" && <FinishStep a={a} set={set} />}
          {step === "timing" && <TimingStep a={a} set={set} />}
          {step === "review" && <ReviewStep a={a} set={set} goTo={goTo} company={company} />}
        </div>
      </main>

      {/* Footer */}
      <footer className="sticky bottom-0 z-20 border-t border-border bg-surface/95 px-5 pt-3 pb-[max(env(safe-area-inset-bottom),22px)] backdrop-blur">
        {error && (
          <p role="alert" className="mb-2.5 rounded-xl bg-danger-soft px-3 py-2 text-[13px] text-danger">
            {error}
          </p>
        )}
        <button
          onClick={next}
          disabled={!valid || pending}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-hero text-[16px] font-semibold text-hero-num transition active:scale-[0.99] disabled:opacity-40"
        >
          {pending ? <LoaderCircle className="size-5 animate-spin" /> : step === "review" ? <Check className="size-5" /> : null}
          {pending ? "Creating your project…" : step === "review" ? "Create project" : "Continue"}
        </button>
      </footer>
    </div>
  );
}

/* ---------------------------------------------------------------- building blocks */

type SetFn = <K extends keyof WizardAnswers>(k: K, v: WizardAnswers[K]) => void;

function Choice({
  selected,
  onClick,
  title,
  hint,
  icon: Icon,
  right,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  hint?: string;
  icon?: LucideIcon;
  right?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex w-full items-center gap-3.5 rounded-2xl border p-4 text-left transition active:scale-[0.99] ${
        selected ? "border-select bg-select-bg shadow-[0_0_0_3px_var(--select-ring)]" : "border-border bg-surface"
      }`}
    >
      {Icon && (
        <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${selected ? "bg-hero text-hero-num" : "bg-surface-2 text-muted ring-1 ring-border"}`}>
          <Icon className="size-[22px]" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold">{title}</span>
        {hint && <span className="mt-0.5 block text-[13px] text-muted">{hint}</span>}
      </span>
      {right ?? (
        <span className={`flex size-6 shrink-0 items-center justify-center rounded-full border-2 ${selected ? "border-select-dot bg-select-dot" : "border-border-strong"}`}>
          {selected && <Check className="size-3.5 text-select-dot-in" strokeWidth={3} />}
        </span>
      )}
    </button>
  );
}

function Pill({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`h-11 rounded-full border px-4 text-sm font-semibold transition active:scale-95 ${
        selected ? "border-hero bg-hero text-hero-num" : "border-border-strong bg-surface text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function Stepper({
  label,
  value,
  min,
  max,
  onChange,
  hint,
  onRemove,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  hint?: string;
  onRemove?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-2xl border border-border bg-surface px-4 py-3">
      <div className="flex min-w-0 items-center gap-2">
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="-ml-1.5 flex size-8 shrink-0 items-center justify-center rounded-full text-subtle hover:bg-danger-soft hover:text-danger"
            aria-label={`Remove ${label}`}
          >
            <X className="size-4" />
          </button>
        )}
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold">{label}</p>
          {hint && <p className="text-xs text-muted">{hint}</p>}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className="flex size-10 items-center justify-center rounded-full bg-surface-2 ring-1 ring-border disabled:opacity-40"
          aria-label={`Fewer ${label.toLowerCase()}`}
        >
          <Minus className="size-4" />
        </button>
        <span className="num w-6 text-center text-lg font-bold" aria-live="polite">
          {value}
        </span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          className="flex size-10 items-center justify-center rounded-full bg-hero text-hero-num disabled:opacity-40"
          aria-label={`More ${label.toLowerCase()}`}
        >
          <Plus className="size-4" />
        </button>
      </div>
    </div>
  );
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-semibold">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

const mInput = "h-13 w-full rounded-2xl border border-border-strong bg-surface px-4 text-[16px] outline-none transition focus:border-select focus:ring-4 focus:ring-select-ring";

/* ---------------------------------------------------------------- steps */

function TypeStep({ a, setA }: { a: WizardAnswers; setA: React.Dispatch<React.SetStateAction<WizardAnswers>> }) {
  return (
    <div className="space-y-3">
      {PROJECT_TYPES.map((t) => (
        <Choice
          key={t.id}
          icon={TYPE_ICON[t.id]}
          title={t.label}
          hint={t.hint}
          selected={a.type === t.id}
          onClick={() =>
            setA((p) => ({
              ...p,
              type: t.id,
              // new type → reset the scope to that type's usual work
              stages: p.type === t.id ? p.stages : DEFAULT_STAGES[t.id],
              area: p.type === t.id ? p.area : null,
              bathrooms: t.id === "bathroom" ? 1 : p.bathrooms,
              garage: t.id === "new_home" ? p.garage : "none",
            }))
          }
        />
      ))}
    </div>
  );
}

function LocationStep({ a, set, areas, check }: { a: WizardAnswers; set: SetFn; areas: ServiceArea[]; check: AreaCheck }) {
  const mine = areas.filter((x) => x.country === a.country);
  // only complain once they've filled in city and a full ZIP/postcode
  const filled = a.city.trim().length > 1 && a.postcode.trim().length >= (a.country === "UK" ? 5 : 5);
  return (
    <div className="space-y-5">
      <div>
        <span className="mb-1.5 block text-[13px] font-semibold">Country</span>
        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-surface-2 p-1 ring-1 ring-border">
          {(["US", "UK"] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                if (c !== a.country) {
                  set("country", c);
                  set("area", null);
                  set("budget", null);
                }
              }}
              className={`h-11 rounded-xl text-[15px] font-semibold transition ${a.country === c ? "bg-surface shadow-card" : "text-muted"}`}
            >
              {c === "US" ? "🇺🇸 United States" : "🇬🇧 United Kingdom"}
            </button>
          ))}
        </div>
      </div>
      <Field label="Street address">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-subtle" />
          <input
            className={`${mInput} pl-11`}
            value={a.address}
            onChange={(e) => set("address", e.target.value)}
            placeholder={a.country === "UK" ? "e.g. 12 Station Road" : "e.g. 14 Oakwood Lane"}
            autoComplete="street-address"
          />
        </div>
      </Field>
      <div className="grid grid-cols-[1.4fr_1fr] gap-3">
        <Field label={a.country === "UK" ? "Town / city" : "City"}>
          <input
            className={mInput}
            value={a.city}
            onChange={(e) => set("city", e.target.value)}
            placeholder={mine[0]?.city ?? (a.country === "UK" ? "Leeds" : "Austin")}
            autoComplete="address-level2"
            list="service-cities"
          />
          <datalist id="service-cities">
            {mine.map((x) => (
              <option key={x.city} value={x.city} />
            ))}
          </datalist>
        </Field>
        <Field label={a.country === "UK" ? "Postcode" : "ZIP"}>
          <input
            className={mInput}
            value={a.postcode}
            onChange={(e) => set("postcode", e.target.value.toUpperCase())}
            placeholder={a.country === "UK" ? "LS1 4AP" : "78701"}
            autoComplete="postal-code"
            inputMode={a.country === "UK" ? "text" : "numeric"}
          />
        </Field>
      </div>

      {filled && !check.ok ? (
        <div role="alert" className="animate-step-in flex gap-3 rounded-2xl border border-danger/30 bg-danger-soft p-4 text-sm text-danger">
          <MapPinOff className="mt-0.5 size-5 shrink-0" />
          <p>
            <span className="block font-semibold">{check.reason === "outside" ? "We're not in this area yet" : "Check the " + (a.country === "UK" ? "postcode" : "ZIP code")}</span>
            {check.message}
          </p>
        </div>
      ) : filled && check.ok ? (
        <p className="flex items-center gap-2 text-sm font-semibold text-success">
          <CircleCheck className="size-4" /> Great, we work in {check.area.city}
          {check.area.region ? `, ${check.area.region}` : ""}.
        </p>
      ) : (
        mine.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold text-muted">We work in</p>
            <div className="flex flex-wrap gap-1.5">
              {mine.map((x) => (
                <button
                  key={x.city}
                  type="button"
                  onClick={() => set("city", x.city)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${
                    a.city.trim().toLowerCase() === x.city.toLowerCase() ? "border-select bg-select-bg" : "border-border-strong bg-surface text-muted"
                  }`}
                >
                  {x.city}
                  {x.region ? `, ${x.region}` : ""}
                </button>
              ))}
            </div>
          </div>
        )
      )}
    </div>
  );
}

function SizeStep({ a, set }: { a: WizardAnswers; set: SetFn }) {
  const metric = a.country === "UK";
  const unit = metric ? "m²" : "sq ft";
  const whole = isWholeHome(a.type);
  const presets = whole
    ? metric
      ? [100, 150, 200, 250]
      : [1500, 2000, 2500, 3000]
    : a.type === "kitchen"
      ? metric
        ? [12, 18, 25]
        : [120, 180, 250]
      : metric
        ? [4, 6, 9]
        : [40, 60, 90];

  return (
    <div className="space-y-5">
      <Field label={whole ? "Total floor area" : a.type === "kitchen" ? "Kitchen size" : "Bathroom size (each)"} hint="Not sure? Pick the closest.">
        <div className="relative">
          <input
            className={`${mInput} num pr-16 text-lg font-semibold`}
            inputMode="numeric"
            type="number"
            min={1}
            value={a.area ?? ""}
            onChange={(e) => set("area", e.target.value === "" ? null : Math.max(0, Number(e.target.value)))}
            placeholder="0"
          />
          <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-[15px] text-muted">{unit}</span>
        </div>
      </Field>
      <div className="flex flex-wrap gap-2">
        {presets.map((p) => (
          <Pill key={p} selected={a.area === p} onClick={() => set("area", p)}>
            {qty(p)} {unit}
          </Pill>
        ))}
      </div>

      {whole && (
        <div className="space-y-3 pt-2">
          <Stepper label="Floors" value={a.floors} min={1} max={4} onChange={(v) => set("floors", v)} />
          <OtherRooms a={a} set={set} />
        </div>
      )}
      {a.type === "bathroom" && (
        <Stepper label="Bathrooms" hint="How many to remodel" value={a.bathrooms} min={1} max={4} onChange={(v) => set("bathrooms", v)} />
      )}
      {a.type === "new_home" && (
        <div>
          <span className="mb-1.5 block text-[13px] font-semibold">Garage</span>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["none", "No garage"],
                ["single", "Single"],
                ["double", "Double"],
              ] as const
            ).map(([g, label]) => (
              <Pill
                key={g}
                selected={a.garage === g}
                onClick={() => {
                  set("garage", g);
                  set("stages", g === "none" ? a.stages.filter((s) => s !== "Garage") : [...new Set([...a.stages, "Garage"])]);
                }}
              >
                {label}
              </Pill>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function OtherRooms({ a, set }: { a: WizardAnswers; set: SetFn }) {
  const [draft, setDraft] = useState("");
  // Bedrooms and bathrooms are shown by default; the owner can remove them (and add them back).
  const [hidden, setHidden] = useState<Set<"bedrooms" | "bathrooms">>(() => new Set());
  const rooms = a.extraRooms ?? [];
  const has = (name: string) => rooms.some((r) => r.name.toLowerCase() === name.toLowerCase());
  const add = (name: string) => {
    const n = name.trim();
    if (!n) return;
    if (n.toLowerCase() === "bedrooms" || n.toLowerCase() === "bathrooms") {
      const key = n.toLowerCase() as "bedrooms" | "bathrooms";
      setHidden((h) => {
        const x = new Set(h);
        x.delete(key);
        return x;
      });
      if (a[key] === 0) set(key, 1);
      return;
    }
    if (has(n)) return;
    set("extraRooms", [...rooms, { name: n.slice(0, 40), count: 1 }]);
  };
  const update = (name: string, count: number) => set("extraRooms", rooms.map((r) => (r.name === name ? { ...r, count } : r)));
  const remove = (name: string) => set("extraRooms", rooms.filter((r) => r.name !== name));
  const removeBuiltIn = (key: "bedrooms" | "bathrooms") => {
    set(key, 0);
    setHidden((h) => new Set([...h, key]));
  };
  const suggestions = [
    ...(hidden.has("bedrooms") ? ["Bedrooms"] : []),
    ...(hidden.has("bathrooms") ? ["Bathrooms"] : []),
    ...ROOM_SUGGESTIONS.filter((r) => !has(r)),
  ];
  const isTaken = (name: string) =>
    has(name) || (name.trim().toLowerCase() === "bedrooms" && !hidden.has("bedrooms")) || (name.trim().toLowerCase() === "bathrooms" && !hidden.has("bathrooms"));

  return (
    <section className="pt-4">
      <p className="text-[15px] font-semibold">Rooms</p>
      <p className="mt-0.5 text-[13px] text-muted">Set how many of each. Use 0 or ✕ for rooms you don&apos;t need.</p>

      <div className="mt-3 space-y-2.5">
        {!hidden.has("bedrooms") && (
          <Stepper label="Bedrooms" value={a.bedrooms} min={0} max={8} onChange={(v) => set("bedrooms", v)} onRemove={() => removeBuiltIn("bedrooms")} />
        )}
        {!hidden.has("bathrooms") && (
          <Stepper label="Bathrooms" value={a.bathrooms} min={0} max={6} onChange={(v) => set("bathrooms", v)} onRemove={() => removeBuiltIn("bathrooms")} />
        )}
        {rooms.map((r) => (
          <Stepper key={r.name} label={r.name} value={r.count} min={0} max={6} onChange={(v) => update(r.name, v)} onRemove={() => remove(r.name)} />
        ))}
      </div>

      {suggestions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {suggestions.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => add(r)}
              className="inline-flex h-10 items-center gap-1.5 rounded-full border border-dashed border-border-strong bg-surface px-3.5 text-[13px] font-semibold text-muted transition active:scale-95"
            >
              <Plus className="size-3.5" /> {r}
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <input
          className="h-12 min-w-0 flex-1 rounded-xl border border-border-strong bg-surface px-3.5 text-[15px] outline-none focus:border-select focus:ring-4 focus:ring-select-ring"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(draft);
              setDraft("");
            }
          }}
          placeholder="Another room, e.g. Sunroom"
          aria-label="Room name"
        />
        <button
          type="button"
          onClick={() => {
            add(draft);
            setDraft("");
          }}
          disabled={!draft.trim() || isTaken(draft)}
          className="flex h-12 shrink-0 items-center gap-1 rounded-xl bg-hero px-4 text-sm font-semibold text-hero-num disabled:opacity-40"
        >
          <Plus className="size-4" /> Add room
        </button>
      </div>
    </section>
  );
}

function ScopeStep({ a, set }: { a: WizardAnswers; set: SetFn }) {
  const toggle = (s: string) => set("stages", a.stages.includes(s) ? a.stages.filter((x) => x !== s) : [...a.stages, s]);
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted">
          <span className="num font-bold text-foreground">{a.stages.length + (a.customItems ?? []).length}</span> selected
        </span>
        <div className="flex gap-1">
          <button type="button" className="rounded-full px-3 py-1.5 text-[13px] font-semibold text-muted" onClick={() => set("stages", ALL_STAGES)}>
            Select all
          </button>
          <button type="button" className="rounded-full px-3 py-1.5 text-[13px] font-semibold text-muted" onClick={() => set("stages", [])}>
            Clear
          </button>
        </div>
      </div>
      {STAGE_GROUPS.map((g) => (
        <section key={g.label}>
          <p className="eyebrow mb-2.5">{g.label}</p>
          <div className="flex flex-wrap gap-2">
            {g.stages.map((s) => {
              const on = a.stages.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggle(s)}
                  aria-pressed={on}
                  className={`inline-flex h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold transition active:scale-95 ${
                    on ? "border-select bg-select-bg" : "border-border-strong bg-surface text-muted"
                  }`}
                >
                  {on ? <Check className="size-4" strokeWidth={3} /> : <Plus className="size-4" />}
                  {s}
                </button>
              );
            })}
          </div>
        </section>
      ))}
      <CustomItems a={a} set={set} />
    </div>
  );
}

function CustomItems({ a, set }: { a: WizardAnswers; set: SetFn }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (!v || (a.customItems ?? []).includes(v)) return;
    set("customItems", [...(a.customItems ?? []), v]);
    setDraft("");
  };
  return (
    <section className="rounded-2xl border border-dashed border-border-strong bg-surface p-4">
      <p className="text-[15px] font-semibold">Add your own</p>
      <p className="mt-0.5 text-[13px] text-muted">Anything not listed, e.g. solar panels, a pool, a home office.</p>
      <div className="mt-3 flex gap-2">
        <input
          className="h-12 min-w-0 flex-1 rounded-xl border border-border-strong bg-surface px-3.5 text-[15px] outline-none focus:border-select focus:ring-4 focus:ring-select-ring"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Type an item"
          aria-label="Your own item"
        />
        <button
          type="button"
          onClick={add}
          disabled={!draft.trim()}
          className="flex h-12 shrink-0 items-center gap-1 rounded-xl bg-hero px-4 text-sm font-semibold text-hero-num disabled:opacity-40"
        >
          <Plus className="size-4" /> Add
        </button>
      </div>
      {(a.customItems ?? []).length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {(a.customItems ?? []).map((it) => (
            <li key={it} className="inline-flex h-10 items-center gap-1.5 rounded-full border border-select bg-select-bg pr-1.5 pl-3.5 text-sm font-semibold">
              {it}
              <button
                type="button"
                onClick={() => set("customItems", (a.customItems ?? []).filter((x) => x !== it))}
                className="flex size-7 items-center justify-center rounded-full hover:bg-black/5"
                aria-label={`Remove ${it}`}
              >
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function FinishStep({ a, set }: { a: WizardAnswers; set: SetFn }) {
  return (
    <div className="space-y-3">
      {FINISHES.map((f) => (
        <Choice
          key={f.id}
          title={f.label}
          hint={f.hint}
          selected={a.finish === f.id}
          onClick={() => set("finish", f.id)}
          icon={f.id === "premium" ? Sparkles : f.id === "standard" ? House : Hammer}
        />
      ))}
    </div>
  );
}

function TimingStep({ a, set }: { a: WizardAnswers; set: SetFn }) {
  return (
    <div className="space-y-7">
      <section>
        <p className="mb-2.5 text-[13px] font-semibold">When would you like to start?</p>
        <div className="flex flex-wrap gap-2">
          {START_OPTIONS.map((s) => (
            <Pill key={s} selected={a.start === s} onClick={() => set("start", s)}>
              {s}
            </Pill>
          ))}
        </div>
      </section>
      <section>
        <p className="mb-2.5 text-[13px] font-semibold">Rough budget</p>
        <div className="space-y-2">
          {budgetOptions(a.type, a.country).map((b) => (
            <Choice key={b} title={b} selected={a.budget === b} onClick={() => set("budget", b)} />
          ))}
          <Choice title="Enter my own amount" selected={a.budget === BUDGET_CUSTOM} onClick={() => set("budget", BUDGET_CUSTOM)} />
          {a.budget === BUDGET_CUSTOM && (
            <div className="animate-step-in relative">
              <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-lg font-semibold text-muted">
                {a.country === "UK" ? "£" : "$"}
              </span>
              <input
                className={`${mInput} num pl-9 text-lg font-semibold`}
                inputMode="numeric"
                autoFocus
                value={a.budgetCustom}
                onChange={(e) => {
                  const digits = e.target.value.replace(/[^0-9]/g, "").slice(0, 10);
                  set("budgetCustom", digits ? Number(digits).toLocaleString("en-US") : "");
                }}
                placeholder="350,000"
                aria-label="Your budget"
              />
            </div>
          )}
          <Choice title={BUDGET_UNSURE} selected={a.budget === BUDGET_UNSURE} onClick={() => set("budget", BUDGET_UNSURE)} />
        </div>
      </section>
    </div>
  );
}

function ReviewStep({ a, set, goTo, company }: { a: WizardAnswers; set: SetFn; goTo: (k: StepKey) => void; company: string }) {
  const items = useMemo(() => generateWorkList(a), [a]);
  const [open, setOpen] = useState(false);
  const unit = a.country === "UK" ? "m²" : "sq ft";
  const type = PROJECT_TYPES.find((t) => t.id === a.type);
  const stages = [...new Set(items.map((x) => x.stage))];

  const rows: { label: string; value: string; step: StepKey }[] = [
    { label: "Project", value: type?.label ?? "—", step: "type" },
    { label: "Address", value: [a.address, a.city, a.postcode].filter(Boolean).join(", "), step: "location" },
    {
      label: "Size",
      value: isWholeHome(a.type)
        ? [
            `${qty(a.area ?? 0)} ${unit}`,
            `${a.floors} floor${a.floors > 1 ? "s" : ""}`,
            a.bedrooms ? `${a.bedrooms} bed` : null,
            a.bathrooms ? `${a.bathrooms} bath` : null,
            a.garage !== "none" ? `${a.garage} garage` : null,
            ...(a.extraRooms ?? []).filter((r) => r.count > 0).map((r) => (r.count > 1 ? `${r.count}× ${r.name}` : r.name)),
          ]
            .filter(Boolean)
            .join(" · ")
        : `${qty(a.area ?? 0)} ${unit}${a.type === "bathroom" ? ` · ${a.bathrooms} bathroom${a.bathrooms > 1 ? "s" : ""}` : ""}`,
      step: "size",
    },
    {
      label: "Includes",
      value: `${a.stages.length} types of work${(a.customItems ?? []).length ? ` + ${(a.customItems ?? []).length} of your own` : ""}`,
      step: "scope",
    },
    { label: "Finish", value: FINISHES.find((f) => f.id === a.finish)?.label ?? "—", step: "finish" },
    { label: "Start", value: a.start ?? "—", step: "timing" },
    { label: "Budget", value: budgetLabel(a) ?? "—", step: "timing" },
  ];

  return (
    <div className="space-y-5">
      <Field label="Project name">
        <input className={mInput} value={a.title} onChange={(e) => set("title", e.target.value)} />
      </Field>

      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        {rows.map((r) => (
          <div key={r.label} className="flex items-start gap-3 border-b border-border px-4 py-3 last:border-b-0">
            <span className="w-24 shrink-0 text-[13px] text-muted">{r.label}</span>
            <span className="min-w-0 flex-1 text-sm font-medium break-words">{r.value}</span>
            <button type="button" onClick={() => goTo(r.step)} className="shrink-0 text-[13px] font-semibold underline decoration-brand decoration-2 underline-offset-4">
              Edit
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-hero text-hero-num">
          <Building2 className="size-5" />
        </span>
        <p className="text-sm">
          <span className="block font-semibold">{company} will prepare your quote</span>
          <span className="block text-[13px] text-muted">You&apos;ll get a notification when it&apos;s ready.</span>
        </p>
      </div>

      <div className="hero-panel overflow-hidden rounded-2xl">
        <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 p-4 text-left" aria-expanded={open}>
          <Sparkles className="size-5 shrink-0 text-hero-num" />
          <span className="flex-1">
            <span className="block text-[15px] font-semibold text-white">We&apos;ll create your work list</span>
            <span className="block text-[13px] opacity-80">
              {items.length} items across {stages.length} stages, with estimated quantities
            </span>
          </span>
          {open ? <ChevronUp className="size-5 shrink-0" /> : <ChevronDown className="size-5 shrink-0" />}
        </button>
        {open && (
          <ul className="max-h-72 space-y-px overflow-y-auto border-t border-white/10 px-4 py-2 text-[13px]">
            {items.map((it, n) => (
              <li key={n} className="flex justify-between gap-3 py-1.5">
                <span className="opacity-90">{it.description}</span>
                <span className="num shrink-0 font-semibold text-hero-num">
                  {qty(it.quantity)} {it.unit}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Field label="Anything else? (optional)">
        <textarea
          className="w-full rounded-2xl border border-border-strong bg-surface px-4 py-3 text-[16px] outline-none focus:border-select focus:ring-4 focus:ring-select-ring"
          rows={3}
          value={a.notes}
          onChange={(e) => set("notes", e.target.value)}
          placeholder="e.g. Open-plan kitchen, south-facing garden, solar panels…"
        />
      </Field>
    </div>
  );
}
