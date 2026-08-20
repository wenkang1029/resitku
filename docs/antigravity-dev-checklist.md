# Development Checklist — Antigravity Build Plan
## Personal Expense Tracker + Tax Relief (Merged v1+v2 scope, single-user deployment)

**How to use this with Antigravity:** Antigravity works best when you give it clearly-scoped, self-contained tasks it can plan → execute → verify (via terminal/browser) → report back on, rather than one giant "build the whole app" prompt. Each phase below is sized to be one or a few Agent Manager tasks. Use the Editor View for small hands-on tweaks; delegate whole phases to the Manager Surface when the scope is well-defined (which it is, since you now have the PRD).

**Before you start:** Have the PRD (`expense-tax-relief-app-PRD.md`) open/attached in the project — Antigravity's project memory (`.gemini/antigravity/brain/`) will pick up architectural decisions from it once referenced, so feed it the doc early rather than re-explaining decisions per task.

---

### Phase 0 — Project Setup
- [ ] Create project repo, initialize with Next.js (App Router) + Tailwind + shadcn/ui
- [ ] Set up Supabase project (Postgres + Auth + Storage)
- [ ] Add PRD as a reference doc in the repo (e.g. `/docs/PRD.md`) so Antigravity's agents can read it for context on future tasks
- [ ] Give Antigravity one task: *"Set up the base Next.js project with Tailwind and shadcn/ui, connect to this Supabase project using these env vars, verify the connection with a simple health-check API route."* Let it plan, execute, and verify via terminal.
- [ ] Manually confirm: local dev server runs, Supabase connection confirmed

### Phase 1 — Data Model
- [ ] Write out the schema from PRD §6 as a migration task: `users`, `receipts`, `receipt_line_items`, `relief_rules`
- [ ] Task Antigravity: *"Create Supabase migrations for these tables [paste schema], enable RLS on all tables scoped to `auth.uid()`, even though only one user exists today."*
- [ ] Verify: inspect generated SQL before applying — don't blindly trust agent-generated RLS policies; check `auth.uid() = user_id` logic is actually present on every table
- [ ] Manually seed one test row per table to confirm structure works end-to-end

### Phase 2 — Relief Rules (Manual Seed, v1 assessment year)
- [ ] Manually research and write `relief_rules_by_year` seed data for the current assessment year (do this yourself first — don't let an agent invent tax figures without a source)
- [ ] Task Antigravity: *"Write a seed script to populate `relief_rules` from this JSON [paste your researched data]."*
- [ ] Verify seeded data against your source manually — one careful pass, since this feeds every downstream categorization

### Phase 3 — LLM Extraction Service
- [ ] Task Antigravity: *"Build an API route that accepts an image, calls [Gemini/Claude] with a multimodal prompt to extract merchant, date, total, line items, spending_category, and relief_category (using the active relief_rules for the receipt's assessment year as context), and returns structured JSON."*
- [ ] Provide the agent your exact prompt requirements from PRD FR-2/FR-3 (dual categorization, no self-reported confidence score — use the cross-check heuristics instead)
- [ ] Test with 5-10 real receipt photos (varied: clear thermal receipt, faded one, mixed-language one, one with obvious line items) — use Antigravity's browser-in-the-loop testing if you build a quick test UI for this, or just hit the API route directly and inspect JSON output
- [ ] Verify: does extraction correctly split line items? Does it flag ambiguous ones per FR-3.1 logic (not a made-up confidence number)?

### Phase 4 — Telegram Bot
- [ ] Task Antigravity: *"Build a Telegram bot using grammY that accepts photo uploads, calls the extraction API route, and replies with an inline-keyboard confirm/edit card."*
- [ ] Set up bot token, test webhook locally (ngrok or similar) before deploying
- [ ] Verify: zero-typing confirm flow actually works end-to-end from your own phone
- [ ] Deploy bot host (Railway/Fly.io free tier) — task Antigravity to write the deployment config, but do the actual deploy step yourself the first time to understand what's happening

### Phase 5 — Dashboard (Dual View)
- [ ] Task Antigravity: *"Build a dashboard with two views: (1) expense view — monthly/category spend trends using Recharts, (2) relief view — category totals vs. limits with progress bars, assessment-year selector."*
- [ ] Verify: both views pull from the same `receipts` table correctly filtered by `spending_category` vs `relief_category`
- [ ] Add basic edit UI for flagged/pending_review receipts (manual correction flow, FR-3.2)

### Phase 6 — Profile-Based Personalization (FR-4.1a)
- [ ] Task Antigravity: *"Build a simple onboarding form (marital status, filing type, dependent count, disability status, parental healthcare) and a conditional filter function that applies the correct relief categories/limits based on profile — a plain filter, not RAG or embeddings."*
- [ ] Verify manually: test with 2-3 different profile combinations, confirm the applied relief categories match what you'd expect by hand

### Phase 7 — Line-Item Extraction Refinement (v2 scope)
- [ ] Refine Phase 3's prompt specifically for mixed receipts (e.g. pharmacy: medication vs. cosmetics)
- [ ] Test against a real mixed receipt — verify line items split correctly into separate `receipt_line_items` rows with correct `is_claimable` flags

### Phase 8 — Export
- [ ] Task Antigravity: *"Build an export feature generating a CSV/PDF summary per assessment year, organized by relief category, for personal filing reference."*
- [ ] Verify: exported totals match what's shown on the dashboard for the same year

### Phase 9 — LLM-Assisted Rule Drafting (FR-4.4)
- [ ] Task Antigravity: *"Build a rule-drafting workflow: accept a source document (PDF/text) of LHDN budget/guideline changes, use the LLM to produce a structured diff against the previous year's active rule_version, save as status: DRAFT, and build a review UI showing the diff with source references for human approval before it can be marked ACTIVE."*
- [ ] This is the most novel/complex piece — expect to iterate with the agent over a few passes
- [ ] Test with next year's actual rule changes when they're announced (or a past year's changes as a dry run) — manually verify every proposed diff against the source before approving, per PRD §8 Q4 guidance

### Phase 10 — Review & Harden
- [ ] Full walkthrough: capture a real receipt via Telegram → confirm → check both dashboard views → export → confirm data is correct end to end
- [ ] Confirm RLS policies actually block cross-user access (even with one user, write a quick test asserting a second dummy user can't see the first user's data — cheap insurance before you ever add a second real user)
- [ ] Review Antigravity's walkthrough/audit trail for each phase — since it logs exactly what files were touched, use this as your own lightweight code review pass rather than re-reading everything from scratch

---

## Antigravity Workflow Tips for This Project
- **Use the Manager Surface for whole phases** (e.g. "build Phase 3 end to end") since each phase here is well-scoped and self-contained — this is exactly the kind of well-defined, boilerplate-heavy work Antigravity handles well.
- **Stay hands-on for Phase 2 (rule data) and rule-approval steps in Phase 9** — these are the two places where an agent inventing or misreading a number has real downstream consequences (per PRD §7), so don't fully delegate the *content*, only the *scaffolding*.
- **Reference the PRD explicitly in your first prompt of each phase** (e.g. "per FR-3.1 in the PRD, confidence should come from cross-checks, not a self-reported LLM score") — this keeps the agent's project "brain" aligned with your actual design decisions instead of defaulting to generic patterns.
- **Use the audit trail/walkthrough feature as your review step**, not a substitute for actually testing — Antigravity shows what changed and why, but you still confirm behavior (especially extraction accuracy and rule correctness) against real data yourself.
