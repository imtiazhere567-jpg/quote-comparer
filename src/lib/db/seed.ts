import "server-only";
import type { Q } from "./index";
import { templateItems } from "@/lib/scope-templates";

/** Demo data so every screen has something to show. Runs once, on a fresh local database. */
export async function seedDemo(q: Q) {
  const user = async (email: string, meta: Record<string, string>) =>
    (await q<{ id: string }>(`insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`, [email, meta]))[0].id;

  const owner = await user("olivia@demo.test", { role: "owner", full_name: "Olivia Bennett" });
  const contractor = await user("chris@demo.test", { role: "contractor", full_name: "Chris Walker", company_name: "Northline Builders" });
  await user("sam@demo.test", { role: "owner", full_name: "Sam Patel" });

  // Contractor's sub-contractor address book
  const subs: { id: string; factor: number }[] = [];
  for (const [name, company, trades, email, factor] of [
    ["Mike Torres", "Torres Construction", ["Concrete", "Carpentry", "Drywall"], "mike@torres.test", 1.0],
    ["Priya Shah", "Shah & Sons", ["Plumbing", "HVAC", "Tiling"], "priya@shah.test", 0.93],
    ["Dan O'Neill", "O'Neill Trades", ["Electrical", "Drywall", "Decorating"], "dan@oneill.test", 1.08],
    ["Grace Kim", "Kim Building Co.", ["Roofing", "Flooring", "Landscaping"], "grace@kimbuild.test", 0.97],
  ] as const) {
    const id = (await q<{ id: string }>(
      `insert into subcontractors (contractor_id, name, company_name, trades, email) values ($1,$2,$3,$4,$5) returning id`,
      [contractor, name, company, trades, email],
    ))[0].id;
    subs.push({ id, factor });
  }

  // Job 1: draft, created by the owner, full scope ready for bidding
  const job1 = (await q<{ id: string }>(
    `insert into jobs (title, description, site_address, currency, units, created_by, owner_id, contractor_id)
     values ('Oakwood Lane new build', 'Detached 3-bed, 2-bath family home, approx. 2,000 sq ft.', '14 Oakwood Lane, Austin, TX', 'USD', 'imperial', $1, $1, $2)
     returning id`,
    [owner, contractor],
  ))[0].id;
  for (const it of templateItems("imperial")) {
    await q(
      `insert into scope_items (job_id, stage, trade, description, quantity, unit, sort_order) values ($1,$2,$3,$4,$5,$6,$7)`,
      [job1, it.stage, it.trade, it.description, it.quantity, it.unit, it.sort_order],
    );
  }

  // Job 2: remodel with bids already in, so the comparison screen has data
  const job2 = (await q<{ id: string }>(
    `insert into jobs (title, description, site_address, currency, units, status, created_by, contractor_id, owner_id)
     values ('Maple Street kitchen & bath', 'Full kitchen refit and main bathroom remodel.', '7 Maple Street, Austin, TX', 'USD', 'imperial', 'bidding', $1, $1, $2)
     returning id`,
    [contractor, owner],
  ))[0].id;
  const remodel: [string, string, string, number, string, number][] = [
    ["Site prep", "General", "Strip out existing kitchen and bathroom", 1, "lump sum", 2400],
    ["Plumbing", "Plumbing", "Reroute supply and waste lines", 1, "lump sum", 3800],
    ["Electrical", "Electrical", "New circuits, outlets and under-cabinet lighting", 1, "lump sum", 4200],
    ["Drywall", "Drywall", "Patch and skim walls and ceilings", 640, "sq ft", 3.1],
    ["Kitchen", "Joinery", "Install cabinets, island and quartz worktops", 1, "lump sum", 6800],
    ["Flooring", "Tiling", "Porcelain floor tiles", 320, "sq ft", 11.5],
    ["Bathrooms", "Plumbing", "Fit walk-in shower, vanity and WC", 1, "lump sum", 5200],
    ["Painting", "Decorating", "Paint walls, ceilings and trim", 900, "sq ft", 1.9],
  ];
  const items: { id: string; base: number }[] = [];
  for (const [i, [stage, trade, desc, qty, unit, base]] of remodel.entries()) {
    const id = (await q<{ id: string }>(
      `insert into scope_items (job_id, stage, trade, description, quantity, unit, sort_order) values ($1,$2,$3,$4,$5,$6,$7) returning id`,
      [job2, stage, trade, desc, qty, unit, i],
    ))[0].id;
    items.push({ id, base });
  }
  // Each sub prices items with their own spread; one sub skips an item, one is suspiciously cheap on another.
  const wobble = [1.0, 0.92, 1.12, 0.97, 1.05, 0.88, 1.1, 0.95];
  for (const [s, sub] of subs.entries()) {
    const invite = (await q<{ id: string }>(
      `insert into bid_invites (job_id, subcontractor_id, status, submitted_at) values ($1,$2,'submitted', now() - interval '1 day') returning id`,
      [job2, sub.id],
    ))[0].id;
    await demoMail(q, job2, invite, 30);
    await q(
      `insert into notifications (job_id, profile_id, kind, title, body, link, created_at, read_at)
       select $1::uuid, $2::uuid, 'bid_received', s.name || ' sent a bid', 'Maple Street kitchen & bath', '/jobs/' || $1::text || '/bids', now() - interval '1 day', now()
         from bid_invites i join subcontractors s on s.id = i.subcontractor_id where i.id = $3`,
      [job2, contractor, invite],
    );
    for (const [i, item] of items.entries()) {
      if (s === 3 && i === 1) continue; // Grace doesn't do plumbing
      let rate = item.base * sub.factor * wobble[(i + s * 3) % wobble.length];
      if (s === 2 && i === 5) rate = item.base * 0.45; // unusually low tile rate
      await q(`insert into bid_rates (invite_id, scope_item_id, unit_rate) values ($1,$2,$3)`, [invite, item.id, Math.round(rate * 100) / 100]);
    }
  }

  await seedMore(q, contractor, subs.map((x) => x.id));
}

type Item = [stage: string, trade: string, description: string, qty: number, unit: string, baseRate: number];

const SCOPES: Record<string, Item[]> = {
  extension: [
    ["Foundation", "Concrete", "Strip footings and slab", 420, "sq ft", 14],
    ["Framing", "Carpentry", "Walls, floor and roof framing", 420, "sq ft", 22],
    ["Roofing", "Roofing", "Roof covering and flashing", 480, "sq ft", 9],
    ["Electrical", "Electrical", "Circuits, outlets and lighting", 1, "lump sum", 5200],
    ["Drywall", "Drywall", "Hang, tape and finish", 1300, "sq ft", 3.2],
    ["Painting", "Decorating", "Walls and ceilings", 1300, "sq ft", 1.9],
  ],
  bathroom: [
    ["Site prep", "General", "Strip out existing bathroom", 1, "lump sum", 1400],
    ["Plumbing", "Plumbing", "Move supply and waste", 1, "lump sum", 2600],
    ["Flooring", "Tiling", "Floor and wall tiles", 160, "sq ft", 13],
    ["Bathrooms", "Plumbing", "Shower, vanity and WC", 1, "each", 4800],
  ],
  kitchen: [
    ["Site prep", "General", "Strip out existing kitchen", 1, "lump sum", 1900],
    ["Electrical", "Electrical", "New circuits and lighting", 1, "lump sum", 3600],
    ["Kitchen", "Joinery", "Cabinets, island and worktops", 1, "lump sum", 9800],
    ["Flooring", "Tiling", "Porcelain floor tiles", 260, "sq ft", 11],
    ["Painting", "Decorating", "Walls, ceilings and trim", 700, "sq ft", 1.8],
  ],
  newhome: [
    ["Foundation", "Concrete", "Footings and slab", 1200, "sq ft", 12],
    ["Framing", "Carpentry", "Full frame and sheathing", 2400, "sq ft", 21],
    ["Roofing", "Roofing", "Roof structure and shingles", 1500, "sq ft", 9.5],
    ["Plumbing", "Plumbing", "First and second fix", 1, "lump sum", 18000],
    ["Electrical", "Electrical", "Full wiring and panel", 1, "lump sum", 16000],
    ["Drywall", "Drywall", "Hang, tape and finish", 7400, "sq ft", 3],
  ],
};

/** Extra demo projects at every stage so the dashboard, lists and pagination have data. */
async function seedMore(q: Q, contractor: string, subIds: string[]) {
  const owner = async (email: string, name: string) => {
    const found = await q<{ id: string }>(`select id from profiles where email = $1`, [email]);
    if (found[0]) return found[0].id;
    return (await q<{ id: string }>(`insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`, [email, { role: "owner", full_name: name }]))[0].id;
  };
  const sam = await owner("sam@demo.test", "Sam Patel");
  const james = await owner("james@demo.test", "James Carter");
  const aisha = await owner("aisha@demo.test", "Aisha Khan");
  const tom = await owner("tom@demo.test", "Tom Rivera");
  const emily = await owner("emily@demo.test", "Emily Chen");

  type Spec = {
    title: string;
    address: string;
    owner: string;
    scope: keyof typeof SCOPES;
    status: "draft" | "bidding" | "quoted" | "accepted";
    bids: number;
    waiting?: number;
    quote?: "sent" | "accepted" | "changes_requested";
    daysAgo: number;
  };
  const specs: Spec[] = [
    { title: "Pine Hill extension", address: "31 Pine Hill Rd, Austin, TX", owner: sam, scope: "extension", status: "bidding", bids: 3, daysAgo: 1 },
    { title: "Lakeview bathroom remodel", address: "9 Lakeview Dr, Cedar Park, TX", owner: james, scope: "bathroom", status: "bidding", bids: 2, waiting: 1, daysAgo: 2 },
    { title: "Elm Street new home", address: "120 Elm St, Georgetown, TX", owner: aisha, scope: "newhome", status: "draft", bids: 0, daysAgo: 0 },
    { title: "Brookside kitchen", address: "4 Brookside Ln, Austin, TX", owner: tom, scope: "kitchen", status: "bidding", bids: 4, daysAgo: 3 },
    { title: "Willow Court renovation", address: "18 Willow Ct, Round Rock, TX", owner: emily, scope: "extension", status: "quoted", bids: 3, quote: "sent", daysAgo: 4 },
    { title: "Harbor Road loft conversion", address: "77 Harbor Rd, Austin, TX", owner: sam, scope: "extension", status: "accepted", bids: 3, quote: "accepted", daysAgo: 9 },
    { title: "Maple Grove kitchen", address: "6 Maple Grove, Pflugerville, TX", owner: james, scope: "kitchen", status: "quoted", bids: 2, quote: "changes_requested", daysAgo: 6 },
    { title: "Cedar Lane bathroom", address: "52 Cedar Ln, Austin, TX", owner: aisha, scope: "bathroom", status: "bidding", bids: 1, waiting: 2, daysAgo: 1 },
  ];

  const spread = [0.94, 1.0, 1.07, 0.97, 1.12, 0.9];
  for (const [n, sp] of specs.entries()) {
    const hoursAgo = sp.daysAgo * 24 + n * 3;
    const job = (await q<{ id: string }>(
      `insert into jobs (title, site_address, currency, units, status, created_by, owner_id, contractor_id, created_at, updated_at)
       values ($1,$2,'USD','imperial',$3,$4,$4,$5, now() - make_interval(hours => $6::int), now() - make_interval(hours => $6::int))
       returning id`,
      [sp.title, sp.address, sp.status, sp.owner, contractor, hoursAgo],
    ))[0].id;
    const items: { id: string; qty: number; base: number; item: Item }[] = [];
    for (const [i, it] of SCOPES[sp.scope].entries()) {
      const id = (await q<{ id: string }>(
        `insert into scope_items (job_id, stage, trade, description, quantity, unit, sort_order) values ($1,$2,$3,$4,$5,$6,$7) returning id`,
        [job, it[0], it[1], it[2], it[3], it[4], i],
      ))[0].id;
      items.push({ id, qty: it[3], base: it[5], item: it });
    }

    // submitted bids, plus invites still waiting
    const cheapest = new Map<string, number>();
    for (let b = 0; b < sp.bids + (sp.waiting ?? 0); b++) {
      const submitted = b < sp.bids;
      const invite = (await q<{ id: string }>(
        `insert into bid_invites (job_id, subcontractor_id, status, submitted_at)
         values ($1,$2,$3::invite_status, case when $4 then now() - make_interval(hours => $5::int) else null end) returning id`,
        [job, subIds[(b + n) % subIds.length], submitted ? "submitted" : b % 2 ? "viewed" : "sent", submitted, Math.max(hoursAgo - b - 1, 0)],
      ))[0].id;
      await demoMail(q, job, invite, hoursAgo + 2);
      if (!submitted) continue;
      await q(
        `insert into notifications (job_id, profile_id, kind, title, body, link, created_at, read_at)
         select $1::uuid, $2::uuid, 'bid_received', s.name || ' sent a bid', $3, '/jobs/' || $1::text || '/bids',
                now() - make_interval(hours => $4::int), case when $4::int > 30 then now() end
           from bid_invites i join subcontractors s on s.id = i.subcontractor_id where i.id = $5`,
        [job, contractor, sp.title, Math.max(hoursAgo - b - 1, 0), invite],
      );
      for (const [i, it] of items.entries()) {
        const rate = Math.round(it.base * spread[(i + b + n) % spread.length] * 100) / 100;
        await q(`insert into bid_rates (invite_id, scope_item_id, unit_rate) values ($1,$2,$3)`, [invite, it.id, rate]);
        cheapest.set(it.id, Math.min(cheapest.get(it.id) ?? Infinity, rate));
      }
    }

    if (sp.status === "accepted") {
      // whole job to the first bidder, already accepted by the owner, work under way
      const [first] = await q<{ id: string; token: string; subcontractor_id: string }>(
        `select id, token, subcontractor_id from bid_invites where job_id = $1 and status = 'submitted' order by created_at limit 1`,
        [job],
      );
      if (first) {
        const [aw] = await q<{ id: string }>(
          `insert into awards (job_id, invite_id, amount, status, responded_at) values ($1,$2,0,'accepted', now() - interval '5 days') returning id`,
          [job, first.id],
        );
        for (const [i, it] of items.entries()) {
          const st = i < 2 ? "done" : i === 2 ? "in_progress" : "not_started";
          await q(
            `insert into work_tasks (job_id, award_id, invite_id, scope_item_id, stage, description, quantity, unit, status, started_at, done_at, sort_order)
             values ($1,$2,$3,$4,$5,$6,$7,$8,$9::task_status,
                     case when $9 <> 'not_started' then now() - make_interval(days => $10::int) end,
                     case when $9 = 'done' then now() - make_interval(days => $10::int - 1) end, $11)`,
            [job, aw.id, first.id, it.id, it.item[0], it.item[2], it.qty, it.item[4], st, 5 - i, i],
          );
        }
        await q(`update jobs set status = 'in_progress' where id = $1`, [job]);
        await q(
          `insert into notifications (job_id, subcontractor_id, kind, title, body, link, created_at)
           values ($1, $2, 'job_awarded', $3, 'Northline Builders has confirmed your work. Open your task list and start when you''re ready.', '/bid/' || $4, now() - interval '5 days')`,
          [job, first.subcontractor_id, `You got the job: ${sp.title}`, first.token],
        );
      }
    }

    if (sp.quote) {
      const quote = (await q<{ id: string }>(
        `insert into owner_quotes (job_id, version, markup_percent, status, message, sent_at, responded_at, owner_response)
         values ($1, 1, 15, $2::quote_status, $3, now() - make_interval(hours => $4::int),
                 case when $2 = 'sent' then null else now() - make_interval(hours => greatest($4::int - 20, 0)) end, $5)
         returning id`,
        [
          job,
          sp.quote,
          "Thanks for the opportunity. We can start within three weeks of acceptance.",
          hoursAgo,
          sp.quote === "changes_requested" ? "Could you price a cheaper worktop option?" : null,
        ],
      ))[0].id;
      for (const [i, it] of items.entries()) {
        const unitPrice = Math.round((cheapest.get(it.id) ?? it.base) * 1.15 * 100) / 100;
        await q(
          `insert into owner_quote_lines (quote_id, scope_item_id, stage, description, quantity, unit, unit_price, total, sort_order)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [quote, it.id, it.item[0], it.item[2], it.qty, it.item[4], unitPrice, Math.round(unitPrice * it.qty * 100) / 100, i],
        );
      }
    }
  }
}

/** Simulated email: a bid request with the private link, in the sub-contractor's inbox. */
async function demoMail(q: Q, jobId: string, inviteId: string, hoursAgo: number) {
  await q(
    `insert into notifications (job_id, subcontractor_id, kind, title, body, link, created_at, read_at)
     select j.id, i.subcontractor_id, 'bid_request', 'Bid request from Northline Builders: ' || j.title,
            'Northline Builders would like your prices for ' || j.title || coalesce(' (' || j.site_address || ')', '') ||
            '. Open the link, enter a rate for each item and send it back.',
            '/bid/' || i.token, now() - make_interval(hours => $3::int),
            case when i.status = 'submitted' then now() end
       from bid_invites i join jobs j on j.id = i.job_id
      where i.id = $2 and j.id = $1`,
    [jobId, inviteId, hoursAgo],
  );
}

/**
 * Demo client feedback: star ratings for the sub-contractors' past work, a few of them low
 * with the client's reason. Runs once (only when there are no ratings yet).
 */
export async function seedDemoFeedback(q: Q) {
  const [{ n }] = await q<{ n: number }>(`select count(*)::int as n from work_ratings`);
  if (n > 0) return;
  const invites = await q<{ invite_id: string; job_id: string; subcontractor_id: string; name: string; trades: string[]; created_at: string }>(
    `select i.id as invite_id, i.job_id, i.subcontractor_id, s.name, s.trades, i.created_at
       from bid_invites i join subcontractors s on s.id = i.subcontractor_id
      where i.status = 'submitted'
      order by i.created_at`,
  );
  const LOW: Record<string, string> = {
    "Dan O'Neill": "Finished late. The tiling took two weeks longer than agreed",
    "Grace Kim": "Messy site. Left debris in the garden after the plumbing work",
  };
  // per sub: a typical score, so the demo shows a clear best and worst
  const BASE: Record<string, number[]> = {
    "Mike Torres": [5, 5, 4, 5],
    "Priya Shah": [5, 4, 5, 4],
    "Dan O'Neill": [3, 4, 2, 4],
    "Grace Kim": [4, 2, 5, 3],
  };
  const seen: Record<string, number> = {};
  for (const inv of invites) {
    const k = seen[inv.name] ?? 0;
    seen[inv.name] = k + 1;
    const pattern = BASE[inv.name] ?? [4, 5, 4];
    const stars = pattern[k % pattern.length];
    const reason = stars < 4 ? (LOW[inv.name] ?? "Quality was below what we expected") : null;
    const label = inv.trades.length ? inv.trades.slice(0, 2).join(", ") : "General work";
    await q(
      `insert into work_ratings (job_id, invite_id, subcontractor_id, work_label, stars, reason, approved, created_at)
       values ($1, $2, $3, $4, $5, $6, $5 >= 4, now() - make_interval(days => $7::int))
       on conflict do nothing`,
      [inv.job_id, inv.invite_id, inv.subcontractor_id, label, stars, reason, 2 + k * 3],
    );
  }
  await q(
    `insert into project_feedback (job_id, comment)
     select distinct job_id, 'Great communication from the team. Happy with the result overall.' from work_ratings
     on conflict do nothing`,
  );
}
