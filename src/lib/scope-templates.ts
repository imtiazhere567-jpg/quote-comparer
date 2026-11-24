export type UnitSystem = "imperial" | "metric";

export const UNITS: Record<UnitSystem, string[]> = {
  imperial: ["sq ft", "linear ft", "cu yd", "each", "hours", "lump sum"],
  metric: ["m²", "m", "m³", "each", "hours", "lump sum"],
};

export const STAGES = [
  "Site prep",
  "Foundation",
  "Framing",
  "Roofing",
  "Windows & doors",
  "Plumbing",
  "Electrical",
  "HVAC",
  "Insulation",
  "Drywall",
  "Flooring",
  "Kitchen",
  "Bathrooms",
  "Painting",
  "Exterior",
] as const;

type TemplateItem = {
  stage: string;
  trade: string;
  description: string;
  qty: number;
  unit: { imperial: string; metric: string };
};

const area = { imperial: "sq ft", metric: "m²" };
const length = { imperial: "linear ft", metric: "m" };
const volume = { imperial: "cu yd", metric: "m³" };
const each = { imperial: "each", metric: "each" };
const lump = { imperial: "lump sum", metric: "lump sum" };

/** Typical items for a detached new-build home. Quantities are example values for ~2,000 sq ft. */
export const NEW_BUILD_TEMPLATE: TemplateItem[] = [
  { stage: "Site prep", trade: "Excavation", description: "Clear site and excavate for foundation", qty: 1, unit: lump },
  { stage: "Foundation", trade: "Concrete", description: "Footings and foundation walls", qty: 45, unit: volume },
  { stage: "Foundation", trade: "Concrete", description: "Ground floor slab, 4\" with mesh", qty: 1100, unit: area },
  { stage: "Framing", trade: "Carpentry", description: "Wall and floor framing incl. sheathing", qty: 2000, unit: area },
  { stage: "Roofing", trade: "Roofing", description: "Roof trusses, underlayment and shingles", qty: 1400, unit: area },
  { stage: "Windows & doors", trade: "Glazing", description: "Supply and fit double-glazed windows", qty: 16, unit: each },
  { stage: "Windows & doors", trade: "Carpentry", description: "External doors, supply and fit", qty: 3, unit: each },
  { stage: "Plumbing", trade: "Plumbing", description: "First and second fix plumbing", qty: 1, unit: lump },
  { stage: "Electrical", trade: "Electrical", description: "Full rewire: outlets, lighting, panel", qty: 1, unit: lump },
  { stage: "HVAC", trade: "HVAC", description: "Heating and ventilation system", qty: 1, unit: lump },
  { stage: "Insulation", trade: "Insulation", description: "Wall and loft insulation", qty: 3400, unit: area },
  { stage: "Drywall", trade: "Drywall", description: "Hang, tape and finish drywall", qty: 6200, unit: area },
  { stage: "Flooring", trade: "Flooring", description: "Engineered oak flooring, living areas", qty: 900, unit: area },
  { stage: "Flooring", trade: "Tiling", description: "Porcelain floor tiles, kitchen and baths", qty: 350, unit: area },
  { stage: "Kitchen", trade: "Joinery", description: "Install kitchen cabinets and worktops", qty: 1, unit: lump },
  { stage: "Bathrooms", trade: "Plumbing", description: "Fit bathroom suites", qty: 2, unit: each },
  { stage: "Painting", trade: "Decorating", description: "Interior paint, two coats", qty: 6200, unit: area },
  { stage: "Exterior", trade: "Landscaping", description: "Driveway and paths", qty: 600, unit: area },
  { stage: "Exterior", trade: "Carpentry", description: "Fascia, soffit and guttering", qty: 220, unit: length },
];

export function templateItems(units: UnitSystem) {
  return NEW_BUILD_TEMPLATE.map((t, i) => ({
    stage: t.stage,
    trade: t.trade,
    description: t.description,
    quantity: units === "metric" && t.unit.imperial === "sq ft" ? Math.round(t.qty / 10.764) : t.qty,
    unit: t.unit[units],
    sort_order: i,
  }));
}
