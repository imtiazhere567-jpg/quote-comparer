/**
 * Homeowner "new project" questionnaire: options, defaults and the
 * rules that turn the answers into a priced-ready work list.
 * Pure functions, safe to use on client and server.
 */

export type ProjectType = "new_home" | "extension" | "renovation" | "kitchen" | "bathroom";
export type Country = "US" | "UK";
export type Finish = "basic" | "standard" | "premium";
export type Garage = "none" | "single" | "double";

export type WizardAnswers = {
  type: ProjectType | null;
  country: Country;
  address: string;
  city: string;
  postcode: string;
  floors: number;
  /** In sq ft (US) or m² (UK), as the owner typed it */
  area: number | null;
  bedrooms: number;
  bathrooms: number;
  garage: Garage;
  /** Rooms the homeowner adds beyond bedrooms and bathrooms, e.g. a home office */
  extraRooms: { name: string; count: number }[];
  stages: string[];
  finish: Finish | null;
  start: string | null;
  budget: string | null;
  /** Your own extra items for the work list */
  customItems: string[];
  /** Typed budget when the owner picks "Enter my own" */
  budgetCustom: string;
  title: string;
  notes: string;
};

export const PROJECT_TYPES: { id: ProjectType; label: string; hint: string }[] = [
  { id: "new_home", label: "New home build", hint: "A full house, from the ground up" },
  { id: "extension", label: "Extension", hint: "Add rooms or a new floor" },
  { id: "renovation", label: "Full renovation", hint: "Gut and redo an existing home" },
  { id: "kitchen", label: "Kitchen remodel", hint: "New kitchen, same footprint" },
  { id: "bathroom", label: "Bathroom remodel", hint: "One or more bathrooms" },
];

export const STAGE_GROUPS: { label: string; stages: string[] }[] = [
  { label: "Structure", stages: ["Site prep", "Foundation", "Framing", "Roofing"] },
  { label: "Systems", stages: ["Plumbing", "Electrical", "HVAC", "Insulation"] },
  { label: "Finishes", stages: ["Windows & doors", "Drywall", "Flooring", "Kitchen", "Bathrooms", "Painting"] },
  { label: "Outside", stages: ["Exterior", "Garage"] },
];

export const ALL_STAGES = STAGE_GROUPS.flatMap((g) => g.stages);

export const DEFAULT_STAGES: Record<ProjectType, string[]> = {
  new_home: ALL_STAGES.filter((s) => s !== "Garage"),
  extension: ["Site prep", "Foundation", "Framing", "Roofing", "Plumbing", "Electrical", "Insulation", "Windows & doors", "Drywall", "Flooring", "Painting"],
  renovation: ["Plumbing", "Electrical", "HVAC", "Insulation", "Windows & doors", "Drywall", "Flooring", "Kitchen", "Bathrooms", "Painting"],
  kitchen: ["Site prep", "Plumbing", "Electrical", "Drywall", "Flooring", "Kitchen", "Painting"],
  bathroom: ["Site prep", "Plumbing", "Electrical", "Drywall", "Flooring", "Bathrooms", "Painting"],
};

/** Quick picks for "Other rooms" on the size step. */
export const ROOM_SUGGESTIONS = [
  "Living room",
  "Dining room",
  "Home office",
  "Laundry room",
  "Basement",
  "Guest suite",
  "Playroom",
  "Home gym",
  "Storage room",
];

export const FINISHES: { id: Finish; label: string; hint: string }[] = [
  { id: "basic", label: "Basic", hint: "Good-value materials, simple fittings" },
  { id: "standard", label: "Standard", hint: "Mid-range brands, what most people choose" },
  { id: "premium", label: "Premium", hint: "High-end materials and custom details" },
];

export const START_OPTIONS = ["As soon as possible", "In 1–3 months", "In 3–6 months", "Just exploring"];

export function budgetOptions(type: ProjectType | null, country: Country): string[] {
  const c = country === "UK" ? "£" : "$";
  switch (type) {
    case "new_home":
      return [`Under ${c}250k`, `${c}250k – ${c}400k`, `${c}400k – ${c}600k`, `Over ${c}600k`];
    case "extension":
    case "renovation":
      return [`Under ${c}50k`, `${c}50k – ${c}100k`, `${c}100k – ${c}200k`, `Over ${c}200k`];
    default:
      return [`Under ${c}15k`, `${c}15k – ${c}30k`, `${c}30k – ${c}60k`, `Over ${c}60k`];
  }
}

/** Special budget values (the rest are ranges from budgetOptions) */
export const BUDGET_CUSTOM = "custom";
export const BUDGET_UNSURE = "Not sure yet";

/** The budget as a readable label, e.g. "$350,000" for a typed amount. */
export function budgetLabel(a: Pick<WizardAnswers, "budget" | "budgetCustom" | "country">) {
  if (a.budget !== BUDGET_CUSTOM) return a.budget;
  const n = Number(a.budgetCustom.replace(/[^0-9.]/g, ""));
  if (!n) return null;
  return new Intl.NumberFormat(a.country === "UK" ? "en-GB" : "en-US", {
    style: "currency",
    currency: a.country === "UK" ? "GBP" : "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export const isWholeHome = (t: ProjectType | null) => t === "new_home" || t === "extension" || t === "renovation";

export function emptyAnswers(): WizardAnswers {
  return {
    type: null,
    country: "US",
    address: "",
    city: "",
    postcode: "",
    floors: 2,
    area: null,
    bedrooms: 3,
    bathrooms: 2,
    garage: "none",
    extraRooms: [],
    stages: [],
    finish: null,
    start: null,
    budget: null,
    customItems: [],
    budgetCustom: "",
    title: "",
    notes: "",
  };
}

export function suggestedTitle(a: WizardAnswers) {
  const where = a.city.trim() || a.address.trim().split(",")[0];
  const what =
    a.type === "new_home"
      ? a.bedrooms
        ? `${a.bedrooms}-bed new home`
        : "New home"
      : a.type === "extension"
        ? "Home extension"
        : a.type === "renovation"
          ? a.bedrooms
            ? `${a.bedrooms}-bed renovation`
            : "Home renovation"
          : a.type === "kitchen"
            ? "Kitchen remodel"
            : a.type === "bathroom"
              ? `${a.bathrooms > 1 ? `${a.bathrooms} bathrooms` : "Bathroom"} remodel`
              : "New project";
  return where ? `${what} · ${where}` : what;
}

/* ---------------------------------------------------------------- work list generation */

export type GeneratedItem = { stage: string; trade: string; description: string; quantity: number; unit: string; notes: string | null };

const FINISH_NOTE: Record<Finish, string> = {
  basic: "Basic finish",
  standard: "Standard finish",
  premium: "Premium finish",
};

/**
 * Turns the answers into work items with sensible quantities.
 * Quantities are estimates from the floor area; the contractor can adjust them.
 */
export function generateWorkList(a: WizardAnswers): GeneratedItem[] {
  const metric = a.country === "UK";
  // work in imperial, convert at the end
  const sqft = Math.max(0, (a.area ?? 0) * (metric ? 10.764 : 1));
  const floors = isWholeHome(a.type) ? Math.max(1, a.floors) : 1;
  const footprint = sqft / floors;
  const finish = a.finish ? FINISH_NOTE[a.finish] : null;
  const has = (s: string) => a.stages.includes(s);
  const out: GeneratedItem[] = [];

  const area = (v: number) => (metric ? { quantity: round(v / 10.764), unit: "m²" } : { quantity: round(v), unit: "sq ft" });
  const vol = (v: number) => (metric ? { quantity: round(v * 0.7646, 1), unit: "m³" } : { quantity: round(v, 1), unit: "cu yd" });
  const len = (v: number) => (metric ? { quantity: round(v * 0.3048), unit: "m" } : { quantity: round(v), unit: "linear ft" });
  const each = (n: number) => ({ quantity: n, unit: "each" });
  const lump = { quantity: 1, unit: "lump sum" };
  const add = (stage: string, trade: string, description: string, q: { quantity: number; unit: string }, notes: string | null = null) => {
    if (q.quantity > 0) out.push({ stage, trade, description, ...q, notes });
  };

  const room = a.type === "kitchen" || a.type === "bathroom";

  if (has("Site prep"))
    add("Site prep", room ? "General" : "Excavation", room ? "Strip out and remove existing fittings" : "Clear site and excavate for foundations", lump);
  if (has("Foundation")) {
    add("Foundation", "Concrete", "Footings and foundation walls", vol(footprint * 0.025));
    add("Foundation", "Concrete", 'Ground floor slab, 4" with mesh', area(footprint));
  }
  if (has("Framing")) add("Framing", "Carpentry", "Wall and floor framing incl. sheathing", area(sqft));
  if (has("Roofing")) add("Roofing", "Roofing", "Roof structure, underlayment and covering", area(footprint * 1.25));
  if (has("Plumbing")) add("Plumbing", "Plumbing", room ? "Reroute supply and waste lines" : "First and second fix plumbing", lump);
  if (has("Electrical")) add("Electrical", "Electrical", room ? "New circuits, outlets and lighting" : "Full wiring: outlets, lighting, panel", lump);
  if (has("HVAC")) add("HVAC", "HVAC", "Heating, cooling and ventilation", lump);
  if (has("Insulation")) add("Insulation", "Insulation", "Wall and roof insulation", area(sqft * 1.7));
  if (has("Windows & doors")) {
    add("Windows & doors", "Glazing", "Supply and fit windows", each(isWholeHome(a.type) ? a.bedrooms * 2 + 6 : 2), finish);
    if (isWholeHome(a.type)) add("Windows & doors", "Carpentry", "External doors, supply and fit", each(a.type === "new_home" ? 2 : 1));
    if (isWholeHome(a.type)) add("Windows & doors", "Carpentry", "Internal doors, supply and fit", each(a.bedrooms + a.bathrooms + 3 + extraRoomCount(a)));
  }
  if (has("Drywall")) add("Drywall", "Drywall", "Hang, tape and finish drywall", area(sqft * (room ? 2.6 : 3.1)));
  if (has("Flooring")) {
    if (room) {
      add("Flooring", "Tiling", "Floor tiles", area(sqft), finish);
    } else {
      add("Flooring", "Flooring", "Wood or laminate flooring, living areas", area(sqft * 0.6), finish);
      add("Flooring", "Tiling", "Floor tiles, kitchen and bathrooms", area(sqft * 0.12 + a.bathrooms * 60), finish);
    }
  }
  if (has("Kitchen")) add("Kitchen", "Joinery", "Kitchen cabinets, worktops and appliances fitting", lump, finish);
  if (has("Bathrooms"))
    add("Bathrooms", "Plumbing", "Bathroom suite: shower or tub, vanity, WC", each(a.type === "bathroom" ? Math.max(1, a.bathrooms) : a.bathrooms), finish);
  if (has("Painting")) add("Painting", "Decorating", "Interior paint, walls, ceilings and trim", area(sqft * (room ? 2.6 : 3.1)));
  if (has("Exterior")) {
    add("Exterior", "Landscaping", "Driveway and paths", area(a.garage === "none" ? 600 : 800));
    add("Exterior", "Carpentry", "Fascia, soffit and guttering", len(Math.sqrt(Math.max(footprint, 1)) * 4.4));
  }
  if (has("Garage") && a.garage !== "none")
    add("Garage", "General", `${a.garage === "double" ? "Double" : "Single"} garage: slab, walls, roof and door`, lump);

  // Extra rooms the homeowner asked for (whole-home projects).
  if (isWholeHome(a.type)) {
    for (const r of a.extraRooms ?? []) {
      if (r.count > 0) add("Extra rooms", "General", `${r.name}: build and fit out`, each(r.count), finish);
    }
  }

  // The homeowner's own items: quantity is set by the contractor later.
  for (const extra of a.customItems ?? []) {
    const d = extra.trim();
    if (d) add("Other", "General", d, lump, "Added by homeowner");
  }

  return out;
}

export function extraRoomCount(a: Pick<WizardAnswers, "extraRooms">) {
  return (a.extraRooms ?? []).reduce((s, r) => s + (Number(r.count) || 0), 0);
}

/**
 * Fills in any missing fields with defaults and drops bad values.
 * Answers come from the browser, so never trust their shape (an older
 * open form, for example, may not have newer fields yet).
 */
export function normalizeAnswers(input: Partial<WizardAnswers>): WizardAnswers {
  const d = emptyAnswers();
  const a = { ...d, ...input };
  const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  return {
    ...a,
    stages: list(a.stages),
    customItems: list(a.customItems).map((x) => x.trim().slice(0, 80)).filter(Boolean),
    extraRooms: (Array.isArray(a.extraRooms) ? a.extraRooms : [])
      .filter((r) => r && typeof r.name === "string" && r.name.trim())
      .map((r) => ({ name: r.name.trim().slice(0, 40), count: Math.max(0, Math.min(6, Math.round(Number(r.count) || 0))) })),
    floors: Math.max(1, Math.min(4, Math.round(Number(a.floors) || 1))),
    bedrooms: Math.max(0, Math.min(8, Math.round(Number(a.bedrooms) || 0))),
    bathrooms: Math.max(0, Math.min(6, Math.round(Number(a.bathrooms) || 0))),
    area: a.area == null ? null : Math.max(0, Number(a.area) || 0),
    address: String(a.address ?? ""),
    city: String(a.city ?? ""),
    postcode: String(a.postcode ?? ""),
    title: String(a.title ?? ""),
    notes: String(a.notes ?? ""),
    budgetCustom: String(a.budgetCustom ?? ""),
  };
}

function round(v: number, digits = 0) {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}

/* ---------------------------------------------------------------- validation per step */

export const STEP_KEYS = ["type", "location", "size", "scope", "finish", "timing", "review"] as const;
export type StepKey = (typeof STEP_KEYS)[number];

export function stepValid(step: StepKey, a: WizardAnswers): boolean {
  switch (step) {
    case "type":
      return a.type !== null;
    case "location":
      return a.address.trim().length > 2 && a.city.trim().length > 1 && postcodeValid(a.country, a.postcode);
    case "size":
      return (a.area ?? 0) > 0;
    case "scope":
      return a.stages.length > 0 || a.customItems.length > 0;
    case "finish":
      return a.finish !== null;
    case "timing":
      return a.start !== null && a.budget !== null && (a.budget !== BUDGET_CUSTOM || budgetLabel(a) !== null);
    case "review":
      return a.title.trim().length > 0;
  }
}

/* ---------------------------------------------------------------- service areas */

/** A city Northline Builders works in (managed by the admin). */
export type ServiceArea = { country: Country; city: string; region: string | null; zip_prefixes: string[] };

const US_ZIP = /^\d{5}(-\d{4})?$/;
const UK_POSTCODE = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;

export function postcodeValid(country: Country, pc: string) {
  return (country === "UK" ? UK_POSTCODE : US_ZIP).test(pc.trim());
}

function prefixMatches(country: Country, pc: string, prefix: string) {
  const code = pc.replace(/\s+/g, "").toUpperCase();
  const p = prefix.replace(/\s+/g, "").toUpperCase();
  // UK "LS" or "M" = the postcode area (its leading letters); "LS1" = starts with
  if (country === "UK" && /^[A-Z]+$/.test(p)) return code.match(/^[A-Z]{1,2}/)?.[0] === p;
  return code.startsWith(p);
}

export type AreaCheck = { ok: true; area: ServiceArea } | { ok: false; reason: "postcode" | "outside"; message: string };

/** Is this address inside an area Northline Builders works in? */
export function checkServiceArea(a: Pick<WizardAnswers, "country" | "city" | "postcode">, areas: ServiceArea[]): AreaCheck {
  const zipWord = a.country === "UK" ? "postcode" : "ZIP code";
  if (!postcodeValid(a.country, a.postcode))
    return { ok: false, reason: "postcode", message: a.country === "UK" ? "Enter a valid UK postcode, e.g. LS1 4AP." : "Enter a 5-digit ZIP code, e.g. 78701." };
  const mine = areas.filter((x) => x.country === a.country);
  const covered = mine.map((x) => x.city).join(", ");
  const area = mine.find((x) => x.city.trim().toLowerCase() === a.city.trim().toLowerCase());
  const outside = (why: string): AreaCheck => ({
    ok: false,
    reason: "outside",
    message: mine.length
      ? `Sorry, we don't work in this area yet${why}. We currently cover: ${covered}.`
      : `Sorry, we don't work in the ${a.country === "UK" ? "United Kingdom" : "United States"} yet.`,
  });
  if (!area) return outside("");
  if (area.zip_prefixes.length && !area.zip_prefixes.some((p) => prefixMatches(a.country, a.postcode, p)))
    return outside(` (this ${zipWord} isn't in ${area.city})`);
  return { ok: true, area };
}
