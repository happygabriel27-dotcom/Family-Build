/* ============================================================
   FamilyBuild — Wiki Seed Data
   Knowledge base content for Owner and Builder roles.
   ============================================================ */

import type { WikiArticle, WikiCategory } from "./types";

export const wikiCategoriesSeed: WikiCategory[] = [
  { id: "wc-start", name: "Getting Started", icon: "overview", description: "Orientation and how the company works." },
  { id: "wc-construction", name: "Construction Guides", icon: "project", description: "Field procedures and build standards." },
  { id: "wc-property", name: "Property Management", icon: "building", description: "Managing properties, tenants, and upkeep." },
  { id: "wc-materials", name: "Materials", icon: "inventory", description: "Material specs, storage, and handling." },
  { id: "wc-safety", name: "Safety", icon: "alert", description: "Site safety rules and emergency procedures." },
  { id: "wc-maintenance", name: "Maintenance", icon: "maintenance", description: "Repair playbooks and preventive schedules." },
  { id: "wc-pm", name: "Project Management", icon: "tasks", description: "Planning, scheduling, and task workflows." },
  { id: "wc-business", name: "Business Procedures", icon: "finance", description: "Purchasing, approvals, and finance rules." },
  { id: "wc-studies", name: "Studies", icon: "reports", description: "Research notes and lessons learned." },
];

export const wikiArticlesSeed: WikiArticle[] = [
  {
    id: "wa-1",
    categoryId: "wc-start",
    title: "How Our Project Workflow Works",
    summary: "From client request to completed work — the lifecycle every project follows.",
    tags: ["workflow", "projects", "basics"],
    authorId: "p-adm",
    updatedAt: "2026-07-01",
    relatedIds: ["wa-7", "wa-9"],
    content: `# How Our Project Workflow Works

Every project at FamilyBuild follows the same basic lifecycle. Understanding it helps everyone coordinate better.

## 1. Intake
A property owner submits a request, or the owner identifies a need. The request is reviewed and scoped.

## 2. Planning
A builder is assigned. They estimate budget, materials, and duration, then create the project record with a target end date.

## 3. Execution
The builder breaks work into tasks and assigns them to workers. Workers update progress daily and report blockers immediately.

## 4. Review & Closeout
Completed work is inspected, documents are filed, and finances are reconciled before the project is marked complete.

## Key Rules
- No task should sit in Blocked for more than 24 hours without escalation.
- All material purchases above ₱5,000 require owner approval.
- Clients see progress through their portal — keep project progress fields up to date.`,
  },
  {
    id: "wa-2",
    categoryId: "wc-start",
    title: "Using the Client Portal",
    summary: "What property owners can see and do, and how we support them.",
    tags: ["clients", "portal", "communication"],
    authorId: "p-adm",
    updatedAt: "2026-06-20",
    relatedIds: ["wa-1"],
    content: `# Using the Client Portal

Property owners have a simplified view of FamilyBuild focused on their own property.

## What clients can do
- View their property profile and active projects.
- Submit requests and report problems.
- Message the builder or company owner.

## What clients cannot see
- Internal budgets and financial reports.
- Other clients' properties.
- Worker management and internal notes.

## Response expectations
- Acknowledge new requests within one business day.
- Update request status as work progresses so the timeline is visible to the client.`,
  },
  {
    id: "wa-3",
    categoryId: "wc-construction",
    title: "Concrete Pouring Procedure",
    summary: "Step-by-step standard for slab and footing pours.",
    tags: ["concrete", "procedure", "field"],
    authorId: "p-bld-1",
    updatedAt: "2026-05-15",
    relatedIds: ["wa-4", "wa-8"],
    content: `# Concrete Pouring Procedure

## Before the pour
- Verify formwork dimensions against the plan.
- Check rebar spacing, cover blocks, and tying.
- Confirm weather forecast — avoid pouring in heavy rain.
- Ensure enough crew and equipment for a continuous pour.

## During the pour
- Use a concrete vibrator to eliminate voids; do not over-vibrate.
- Screed to level while fresh; check elevations with a level or transit.
- Keep pour time under 90 minutes from batching for best strength.

## After the pour
- Cure with water for at least 7 days (longer in hot months).
- Do not load the slab before 14 days unless approved by the engineer.
- Record the pour date, mix design, and weather in the project log.`,
  },
  {
    id: "wa-4",
    categoryId: "wc-construction",
    title: "Electrical Rough-In Standards",
    summary: "Conduit routing, box heights, and wire sizing used on all our sites.",
    tags: ["electrical", "standards"],
    authorId: "p-bld-1",
    updatedAt: "2026-04-10",
    relatedIds: ["wa-3"],
    content: `# Electrical Rough-In Standards

## Conduit routing
- Run conduits along walls and ceilings, never diagonally across future tile lines.
- Maintain 150mm clearance from plumbing lines where possible.

## Box heights (standard residential)
- Switches: 1.2m from finished floor.
- Convenience outlets: 300mm from finished floor.
- Bathroom outlets: GFCI protected, away from direct water spray.

## Wire sizing quick reference
- Lighting circuits: 2.0mm² THHN.
- Convenience outlets: 3.5mm² THHN.
- Air conditioning units: dedicated circuit per unit, sized per nameplate.

Always photograph rough-ins before closing walls.`,
  },
  {
    id: "wa-5",
    categoryId: "wc-property",
    title: "Tenant Move-In / Move-Out Checklist",
    summary: "Standard inspection flow for rental units.",
    tags: ["tenants", "checklist", "rentals"],
    authorId: "p-adm",
    updatedAt: "2026-03-30",
    relatedIds: ["wa-11"],
    content: `# Tenant Move-In / Move-Out Checklist

## Move-in
1. Walk through the unit with the tenant.
2. Photograph all rooms, fixtures, and meter readings.
3. Sign the condition report; give the tenant a copy.
4. Hand over keys and log the key count.

## Move-out
1. Schedule the inspection at least 7 days before move-out.
2. Compare condition against the move-in photos.
3. List damages beyond normal wear and estimate repair costs.
4. Settle deposit deductions transparently and document everything.

Keep both reports with the property records so they are easy to retrieve later.`,
  },
  {
    id: "wa-6",
    categoryId: "wc-materials",
    title: "Cement Storage & Handling",
    summary: "Keep cement usable: moisture is the enemy.",
    tags: ["cement", "storage", "materials"],
    authorId: "p-bld-2",
    updatedAt: "2026-02-18",
    relatedIds: ["wa-3"],
    content: `# Cement Storage & Handling

## Storage rules
- Store bags on pallets, at least 150mm off the ground.
- Keep indoors or under waterproof covering; never directly on soil.
- Stack max 10 bags high; use oldest stock first (FIFO).

## Shelf life
- Use within 60 days of delivery for structural work.
- Bags with lumps that do not crumble by hand are compromised — do not use for structural elements.

## Ordering tip
Order in quantities matched to a 2-week usage window to avoid stale stock.`,
  },
  {
    id: "wa-7",
    categoryId: "wc-safety",
    title: "Site Safety Essentials",
    summary: "Non-negotiable safety rules for every worker and visitor.",
    tags: ["safety", "ppe", "rules"],
    authorId: "p-bld-1",
    updatedAt: "2026-06-01",
    relatedIds: ["wa-8"],
    content: `# Site Safety Essentials

## Personal protective equipment
- Hard hats at all times on active sites.
- Safety shoes; gloves when handling rebar, lumber, or chemicals.
- Eye protection when cutting, grinding, or mixing.

## Housekeeping
- Clear walkways of debris and cables daily.
- Store materials neatly; never block exits or ladders.

## High-risk activities
- Work at height above 2m requires scaffolding or harnesses.
- Electrical work requires lockout/tagout of the supply.
- Report all incidents, even minor ones, the same day.

## Emergency contacts
Post the nearest clinic number and site lead's mobile at the gate.`,
  },
  {
    id: "wa-8",
    categoryId: "wc-safety",
    title: "Typhoon Preparation Checklist",
    summary: "What to secure on site when a storm is forecast.",
    tags: ["weather", "typhoon", "checklist"],
    authorId: "p-bld-2",
    updatedAt: "2026-08-01",
    relatedIds: ["wa-7"],
    content: `# Typhoon Preparation Checklist

When Signal No. 2 or higher is forecast:

## Site securing
- Tie down or store loose materials, sheets, and tarps.
- Brace scaffolding and unfinished walls.
- Clear drains and waterways around the site.
- Shut down and cover electrical panels.

## Equipment
- Fuel and test generators.
- Move tools and power equipment off the ground.

## People
- Suspend work during the signal period.
- Confirm every worker knows when to resume and who to call.`,
  },
  {
    id: "wa-9",
    categoryId: "wc-pm",
    title: "Writing Good Tasks",
    summary: "A task is only useful if the assignee knows exactly what done means.",
    tags: ["tasks", "planning"],
    authorId: "p-bld-1",
    updatedAt: "2026-05-05",
    relatedIds: ["wa-1"],
    content: `# Writing Good Tasks

## Anatomy of a good task
- **Title**: action + location. e.g. "Tile master bathroom walls — Riverside".
- **Description**: what, where, materials, and acceptance criteria.
- **Assignee**: one accountable person, not a group.
- **Due date**: realistic, accounting for dependencies.
- **Priority**: urgent only if it blocks other work or risks the schedule.

## Anti-patterns
- "Fix stuff" — no scope, no location.
- Assigning to two people — split the task instead.
- Setting every task to Urgent — dilutes real priorities.

## Updating
Workers should update progress at least once per working day and comment when blocked, including what they need to unblock.`,
  },
  {
    id: "wa-10",
    categoryId: "wc-business",
    title: "Purchasing Approval Rules",
    summary: "Who approves what, and how fast.",
    tags: ["purchasing", "approvals", "finance"],
    authorId: "p-adm",
    updatedAt: "2026-04-22",
    relatedIds: ["wa-1"],
    content: `# Purchasing Approval Rules

## Thresholds
- Below ₱5,000: builder may approve directly from petty cash.
- ₱5,000 – ₱50,000: requires owner approval via Purchasing.
- Above ₱50,000: requires written quotation comparison (minimum 2 suppliers).

## Process
1. Builder creates the purchase request linked to a project.
2. Owner reviews cost vs. budget and approves or rejects with a note.
3. Approved orders are delivered and received into inventory.
4. Delivered orders automatically increase stock counts.

## Records
Attach supplier quotations to the order notes whenever available.`,
  },
  {
    id: "wa-11",
    categoryId: "wc-maintenance",
    title: "Preventive Maintenance Calendar",
    summary: "Recurring checks per property type.",
    tags: ["maintenance", "schedule"],
    authorId: "p-bld-2",
    updatedAt: "2026-03-12",
    relatedIds: ["wa-5"],
    content: `# Preventive Maintenance Calendar

## Monthly
- Test smoke alarms and replace batteries as needed.
- Inspect common-area lighting.
- Check water pumps and pressure tanks.

## Quarterly
- Service air conditioning units.
- Inspect roofing and gutters after storm season.
- Test elevator safety features (commercial).

## Annually
- Full electrical panel inspection.
- Repaint exterior wood and metal surfaces as needed.
- Fire extinguisher recertification.

Log each completed check as a resolved maintenance entry with photos.`,
  },
  {
    id: "wa-12",
    categoryId: "wc-studies",
    title: "Lessons Learned: Highland Extension Delays",
    summary: "Root causes of the Q2 schedule slip and countermeasures adopted.",
    tags: ["retrospective", "delays", "highland"],
    authorId: "p-bld-1",
    updatedAt: "2026-07-28",
    relatedIds: ["wa-9", "wa-10"],
    content: `# Lessons Learned: Highland Extension Delays

## What happened
Steel deliveries slipped three weeks in Q2 due to a single-supplier dependency and late permit amendment.

## Root causes
- Permit amendment submitted after steel was ordered.
- No buffer between permit approval and fabrication start.
- Single supplier without an alternate quote.

## Countermeasures adopted
- Sequence rule: permits first, long-lead orders second.
- Always collect two quotes for orders above ₱50,000.
- Add a 10% time buffer to structural phases in schedules.

Track follow-ups as tasks attached to this study.`,
  },
];