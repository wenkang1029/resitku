# Product Requirements & System Design Document
## Personal Expense Tracker with Malaysian Tax Relief Detection

**Document type:** Combined PRD / SRS
**Status:** Draft v1
**Scope:** Individual self-upload and record-keeping only. This system does **not** submit anything to LHDN on the user's behalf, and MyInvois integration (where used) is read-only corroboration, never a filing path.

---

## 1. Overview

### 1.1 Purpose
A personal finance tool where the primary loop is everyday expense tracking (capture a receipt, see where money goes), with tax relief detection as an automatic byproduct of the same data — not a separate tool bolted on top. Malaysian tax residents lose relief money every year simply because receipts are scattered, forgotten, or physically degraded by filing season. This system removes that friction while giving genuine year-round utility, which is what drives people to actually use it consistently.

### 1.2 Product Positioning
- **Primary value:** "Know where your money goes."
- **Differentiator:** "...and automatically know what you can claim back."
- Tax relief tracking is the headline differentiator in messaging, but architecturally it rides on top of general expense data — same capture flow, dual categorization.

### 1.3 Out of Scope (all versions)
- LHDN e-filing / submission integration
- MyInvois document submission API (read-only verification only, v3+)
- Budgeting, recurring-transaction detection, bank/card sync, multi-currency — standard expense-app territory that would blow scope without serving the core differentiator
- Formal contractual data retention SLA

---

## 2. Stakeholders & Personas

| Persona | Need | Behavior |
|---|---|---|
| **Primary user (you / working professional)** | Track daily spending + maximize relief utilization before year-end | Uploads receipts regularly via Telegram; checks dashboard monthly and heavily in Q4 |
| **Elderly / non-tech-savvy dependent** | Frictionless logging, zero typing | Telegram-native; expects one-tap confirmation |


---

## 3. Functional Requirements

### FR-1: Receipt & Expense Ingestion
- **FR-1.1** Accept image uploads (`.jpeg`, `.png`, `.webp`, `.heic`) via Telegram bot and web dashboard.
- **FR-1.2** Compress/resize images before persistent storage (target: WebP, reasonable size cap for free-tier storage limits).
- **FR-1.3** *(v3)* If a MyInvois QR code is detected, fetch the public verification page as a read-only corroboration signal (merchant/amount cross-check) — not a primary extraction path, given partial rollout coverage (see §7).

### FR-2: Dual-Category Extraction
- **FR-2.1** LLM-based multimodal extraction produces structured output per receipt: merchant, date, total amount, and (where feasible) line items.
- **FR-2.2** Each receipt/line item is tagged with **two independent category types**:
  - `spending_category` (e.g. groceries, dining, transport, utilities) — everyday expense view
  - `relief_category` (e.g. medical, lifestyle, education, or `none`) — tax relief view, evaluated against the active `relief_rules` for the receipt's assessment year
- **FR-2.3** A receipt may have a spending category with no relief category (e.g. groceries), or both simultaneously.
- **FR-2.4** *(v2)* Line-item level splitting for mixed receipts (e.g. pharmacy: medication vs. cosmetics on one bill).

### FR-3: Extraction Confidence & Review
- **FR-3.1** Confidence is **not** derived from an LLM self-reported score (unreliable — see §7). Instead, flag for manual review when:
  - Extracted total is missing/unparseable
  - Relief category is ambiguous against the active rule set
  - MyInvois corroboration (if present) disagrees with LLM extraction
- **FR-3.2** Flagged items surface as a simple confirm/edit card (Telegram inline buttons; dashboard edit view).

### FR-4: Tax Relief Rule Engine
- **FR-4.1** Rules are stored per assessment year (`relief_rules_by_year`), not as a single flat list, since categories and limits change annually.
- **FR-4.1a** *(v1)* **Profile-based personalization via structured filtering, not RAG.** A lightweight onboarding captures marital status, filing type (joint/separate), and dependent count. Applicable relief categories/limits are selected via simple deterministic conditionals against the rule table (e.g. spouse relief only if married + separate assessment; child education relief scaled by dependent count). This is a filter/lookup operation, not a retrieval problem — RAG is deliberately not used here (see §7). Pulled into v1 since it's cheap once the rule table exists and meaningfully improves relevance of what a user sees from day one.
- **FR-4.2** *(v2)* Parent-child limit logic supported (e.g. total medical cap RM10,000, with an internal sub-cap for specific items). Full disability/parental-care-tier profile fields also added here, expanding on the basic v1 profile.
- **FR-4.3** Every receipt stores an immutable foreign-key reference to the exact `rule_version` active at the time it was categorized. Later rule corrections never silently alter historical records.
- **FR-4.4** *(v2/v3)* **LLM-assisted rule drafting, human-approved:**
  - LLM reads official source documents (Budget speech, Finance Bill, LHDN PIN guidelines) and proposes a **diff** against the prior year's rules, with each proposed change linked to its source reference.
  - Proposed changes are saved as `status: DRAFT` — never auto-published to `status: ACTIVE`.
  - A human (you) reviews the diff against the source and explicitly approves before it becomes the active rule set for that year.
  - Rationale: a wrong entry in the shared rule registry silently affects every user's categorization for the whole year, unlike a single extraction error which affects one record. This asymmetry is why rule edits require a stricter human-in-the-loop gate than receipt extraction does.

### FR-5: Dashboards & Reporting
- **FR-5.1** Expense view: monthly/category spending trends, general financial overview.
- **FR-5.2** Relief view: category totals vs. statutory limits, assessment-year selector, progress indicators.
- **FR-5.3** *(v2)* Export: CSV/PDF summary per assessment year, organized to align with Form BE relief line items, for the user's own filing reference (not a submission artifact).

### FR-6: Multi-User Support *(v2)*
- **FR-6.1** Multi-user auth with per-user data isolation.
- **FR-6.2** Expanded personalized relief ceilings (disability status, parental healthcare qualification) building on the basic v1 profile filter (FR-4.1a).

---

## 4. Non-Functional Requirements

| ID | Requirement | Notes |
|---|---|---|
| NFR-1 | Per-user data isolation once multi-user (v2) | Enforced via Row-Level Security once real other-users' data is involved — not needed pre-v2 |
| NFR-2 | Reasonable responsiveness on free-tier infra | No hard latency SLA (see §7) — use immediate ack + async update pattern instead |
| NFR-3 | Data retention stated as **policy**, not **SLA** | Free-tier personal infra cannot make contractual durability guarantees; be explicit about this to any family/friends using it |
| NFR-4 | Best-effort PII pattern detection *(v3)* | Regex-based NRIC/card-number pattern flagging with manual review — not a guaranteed redaction pipeline |
| NFR-5 | Zero-typing confirmation flow on Telegram | Inline keyboards for all standard confirm/edit actions |

---

## 5. System Architecture

```
┌──────────────────┐     ┌──────────────────┐
│  Telegram Bot     │     │  Web Dashboard    │
│  (capture layer)  │     │  (expense + tax   │
│                   │     │   dual view)      │
└─────────┬─────────┘     └─────────┬─────────┘
          │                         │
          └───────────┬─────────────┘
                       │
             ┌─────────▼──────────┐
             │   API Layer         │
             │ (Next.js API routes │
             │  / Supabase Edge)   │
             └─────────┬──────────┘
                        │
      ┌─────────────────┼──────────────────┐
      │                 │                  │
┌─────▼──────┐  ┌───────▼────────┐  ┌──────▼──────┐
│  Supabase   │  │  LLM Service    │  │  Supabase   │
│  Postgres   │  │  - Extraction   │  │  Storage    │
│ (receipts,  │  │  - Rule-draft   │  │ (receipt    │
│  rules,     │  │    assistant    │  │  images)    │
│  users)     │  │    (v2/v3)      │  │             │
└─────────────┘  └─────────────────┘  └─────────────┘
```

---

## 6. Data Model (Core Entities)

```
users
  ├─ id, email, telegram_id, filing_profile (v2), created_at

receipts
  ├─ id, user_id, image_url, merchant, total_amount,
  │  transaction_date, assessment_year,
  │  spending_category, relief_category,
  │  confidence_flag, status (pending_review / confirmed),
  │  rule_version_id, created_at

receipt_line_items (v2)
  ├─ id, receipt_id, description, amount,
  │  spending_category, relief_category, is_claimable

relief_rules
  ├─ id, assessment_year, rule_version, status (draft/active),
  │  category_key, category_label, limit_amount,
  │  sub_cap_parent_id (nullable), source_reference, description
```

---

## 7. Key Design Decisions & Corrections
*(carried forward from blueprint review — documented so they aren't accidentally re-introduced later)*

| Issue | Decision |
|---|---|
| LLM confidence scores | Don't trust self-reported 0.00–1.00 scores from the LLM — not statistically calibrated. Derive flags from concrete cross-checks instead. |
| Response latency | No hard SLA on free-tier infra. Immediate ack + async follow-up is better UX and an honest constraint. |
| Data retention | State as policy, not SLA, especially once family/friends rely on it. |
| MyInvois as primary path | Malaysia's e-invoicing rollout is phased by business size — small merchants/clinics (where much of this data comes from) will lack QR codes for a long while. Treat as optional bonus corroboration, never a dependency. |
| PII redaction | "Automated redaction" is a strong guarantee that's hard to deliver reliably. Scope to best-effort pattern detection + manual review flag. |
| Rule registry edits | LLM may *draft* proposed rule changes from official sources, but never auto-publishes. Human review and explicit approval required before a rule version goes active — the blast radius of a wrong rule (affects every user, silently, for a year) is categorically worse than a wrong single-receipt extraction. |
| RAG for personalization | **Not used.** Personalizing relief ceilings by marital status/dependents is a small, deterministic, structured lookup (FR-4.1a) — RAG is built for retrieval over large unstructured text, and applying it to ~20-30 clean rule rows adds infrastructure (vector DB, embeddings) with no accuracy gain over a plain conditional filter. RAG is reserved for v3's genuinely unstructured use case: free-form guideline interpretation questions (e.g. "can I claim my home office chair?") answered from LHDN's actual PDF guidelines. |

---

## 8. Open Questions — Resolved (Recommended Defaults)

**Q1: Should physical receipt disposal ever be recommended, or always framed as "keep both"?**
**Recommendation:** Always frame as "keep both, this app organizes — it doesn't replace originals." Do not advise disposal at any version. This is a legal-safety default: LHDN audit requirements can require original documentation, and the cost of being wrong (a user discards a receipt they needed) is asymmetric — much worse than the minor inconvenience of keeping paper a bit longer. Revisit only if you get an explicit, current LHDN statement confirming digital copies are audit-sufficient, and even then, default messaging should stay conservative.

**Q2: At what user count does the free-tier stack need to be reconsidered?**
**Recommendation:** Set a concrete trigger rather than waiting for something to break — review when you hit **~70–80% of Supabase's free-tier storage or DB row limits**, or when monthly LLM API spend (if you move off a free tier) exceeds a small self-set threshold (e.g. RM50/month). Treat it as a scheduled check-in (e.g. quarterly, once v2 has real users) rather than a reactive fire-fight. This is standard practice — define the threshold before you need it, not after you hit it.

**Q3: How much manual review burden is acceptable before elderly users find the correction step itself annoying?**
**Recommendation:** Target **zero-typing, ≤1 tap** for the common case (confirm), and treat any correction flow needing more than 2 taps as a UX failure worth redesigning. Concretely: track a simple internal metric — % of receipts requiring manual correction — and treat >20-25% as a signal that extraction prompts or the flagging heuristic (FR-3.1) need tuning, not that users need to "try harder." The tool should adapt to the user, not vice versa — this is standard UX best practice for tools aimed at low-friction adoption by non-technical users.

**Q4 (added from prior review): Who verifies each year's rule file against the actual LHDN gazette, and how is a transcription error caught?**
**Recommendation:** With FR-4.4 (LLM-assisted rule drafting) in place, the answer becomes structural rather than ad hoc: every proposed change is diffed, source-linked, and requires your explicit sign-off before going active — this **is** the verification step, not an extra task bolted on. As a secondary safety net, keep the previous year's rule version easily accessible for a quick side-by-side "does this change make sense" gut check, and don't approve a diff you haven't cross-referenced against the actual linked source excerpt at least once.

---

## 9. Development Approach: Merged v1+v2 Scope, Single-User Deployment

**Decision:** Build to v2 functional scope (multi-user-capable schema, expanded relief profile, line-item extraction, export, LLM-assisted rule drafting) but deploy and use it solely as a single personal account for now. v3 (RAG, MyInvois, PII detection, public scalability) remains a separate later phase, not merged in.

**Why this is a reasonable merge (and what NOT to skip even as a solo user):**
- Schema-level v2 features (line items, expanded profile fields, `rule_version` diffing) cost little extra to build now vs. retrofitting later — worth doing upfront.
- **Keep RLS enabled from the start** even with one user. It's a Supabase toggle, not a project — cheap now, expensive to bolt on after real data exists.
- **Skip what only matters at multi-user scale:** don't invest time in family-member-facing UX polish, invite/permission flows, or multi-tenant load testing — there's no second user to serve yet, so this effort has no payoff until it does.
- The **LLM-assisted rule drafting workflow (FR-4.4)** is worth building even solo — you're the one who'd otherwise manually transcribe LHDN rules every year regardless of user count, so this saves you real effort immediately.

---

## 10. Technology Stack

| Layer | Choice | Rationale |
|---|---|---|
| **Capture (bot)** | Telegram Bot API (`grammY` or `node-telegram-bot-api`) | Free, no business-account approval friction (unlike WhatsApp Business API), native inline-keyboard support for zero-typing confirmation flows |
| **Frontend (dashboard)** | Next.js (App Router) + Tailwind + shadcn/ui | Fast to build, free hosting fit (Vercel), good component primitives for dashboard UI |
| **Charts** | Recharts | Free, sufficient for spend-by-category and relief-progress visualizations |
| **Backend/API** | Next.js API routes + Supabase Edge Functions | Serverless, avoids standing up/maintaining a separate server; both bot and dashboard call the same shared extraction/rule logic |
| **Database** | Supabase (Postgres) | Generous free tier, built-in Row-Level Security for v2 multi-user isolation, relational model fits the receipts/rules/line-items schema well |
| **File storage** | Supabase Storage | Same platform as DB, free tier sufficient for compressed receipt images at personal/family scale |
| **Auth** | Supabase Auth (email magic link or Google OAuth) | Free, minimal setup, integrates directly with RLS |
| **LLM — extraction** | Gemini API (generous free tier) or Claude API (low pay-as-you-go cost) | Multimodal image-to-structured-JSON extraction; more robust to messy/faded/mixed-language receipts than traditional OCR |
| **LLM — rule drafting** *(v2/v3)* | Same provider as extraction, separate prompt/pipeline | Document-to-structured-diff task (FR-4.4); kept as a distinct, human-gated workflow, not part of the live extraction path |
| **RAG / retrieval** *(v3 only)* | Lightweight vector store (e.g. Supabase `pgvector`) over LHDN guideline documents | Reserved strictly for free-form guideline Q&A — not used for rule personalization (see §7) |
| **Bot hosting** | Railway or Fly.io (free tier) | Needs to stay running for Telegram webhook delivery |
| **Frontend hosting** | Vercel (free tier) | Native Next.js support, generous free bandwidth |

**Cost check (v1, personal/family use):** all components above have a free tier sufficient for individual or small-group usage; the only realistic ongoing cost is LLM API calls beyond free-tier limits, which stay low at personal receipt volume.

---

## 11. Version Roadmap Summary

| Version | Focus | Key additions |
|---|---|---|
| **v1+v2 (merged)** | Personal build, v2-scope features | Telegram capture, dual-category extraction, expanded profile-filtered relief ceilings, line-item extraction, dashboard (both views), export, LLM-assisted rule drafting (draft mode), RLS enabled — all deployed for single-user use |
| **v3** | Public-ready / portfolio | RAG for guideline Q&A, MyInvois read-only corroboration, PII pattern detection, scalability review, portfolio polish |

---

## 12. Success Criteria by Version
- **v1:** You can photograph a real receipt, get correct dual-category tagging, and see it reflected in both dashboard views.
- **v2:** 3-5 family/friends use it through a real tax season with no data isolation issues and no unnoticed major extraction errors; at least one rule-year rollover handled via the draft/approve flow without incident.
- **v3:** A stranger can use the system with no hand-holding; system demonstrates full-stack + applied-LLM skills suitable for a portfolio presentation.
