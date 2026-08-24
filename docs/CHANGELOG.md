# Changelog & Development Log

All notable changes and architectural decisions for **ResitKu** are documented here in reverse chronological order.

---

## 2026-08-24 — Phase 8: Form BE Tax Relief Export (CSV & Print / PDF)
- **Single Calculation Source of Truth (`exportRelief.ts`):** Built canonical exporter directly wrapping `calculateReliefProgress` from `calculateRelief.ts`. Ensures 100% mathematical parity across CSV download, Print / PDF view, and live dashboard.
- **Form BE Export API (`GET /api/export`):** Supports `?format=csv` for direct Form BE structured CSV download and `?format=json` for print rendering. Correctly respects `include_in_records: false` and groups umbrella caps (e.g. `medical_combined_umbrella`) alongside their sub-caps.
- **Dedicated Print / PDF Page (`/dashboard/relief/print`):** Clean, professional Form BE reference document with `@media print` rules, A4 page breaks, and one-click browser print / PDF saving.
- **Tax Relief Dashboard Export Card:** Added action card on `/dashboard/relief` with instant CSV download and Print / Save PDF navigation, alongside a clear legal disclaimer.



---

## 2026-08-24 — Production Deployment & Environment Hardening
- **Web App (Vercel):** Deployed Next.js frontend with SSR Supabase authentication cookies. Wrapped `useSearchParams()` in a `<Suspense>` boundary on `/login` to satisfy static compilation requirements.
- **Root Routing:** Updated `/` in `src/app/page.tsx` to automatically redirect authenticated users to `/dashboard/expenses` and unauthenticated users to `/login`.
- **Bot Service (Railway):**
  - Switched from file-dependent `.env.local` loading to direct `process.env` reading with explicit validation logging.
  - Resolved `BUTTON_DATA_INVALID` by shortening Telegram inline `callback_data` (using 0-based item indices, e.g. `t:<receipt_id>:0` instead of dual UUIDs) to stay safely within Telegram's 64-byte payload limit.

---

## 2026-08-23 — Universal Confirmation Flow & Line-Item Relief Attribution
- **Universal Confirm Default:** Moved from auto-confirming high-confidence extractions to a universal `status: 'pending_review'` requirement across all receipts. Receipts do not affect totals until confirmed.
- **Immediate DB State Persistence:** Toggling line items in Telegram (`include_in_records`) writes directly to Postgres on each tap, ensuring zero state loss across bot restarts.
- **Immutable Total vs Claimed Amount:**
  - Preserved `receipts.total_amount` as the immutable physical document total.
  - Added `receipts.claimed_amount` (numeric, nullable) to store the sum of included line items when exclusions occur.
  - Dashboard aggregations use `COALESCE(claimed_amount, total_amount)`.
- **Per-Item Relief Attribution:** Rewrote `calculateRelief.ts` to attribute each line item to its own `relief_category` rather than lumping mixed-category receipts under a single receipt-level bucket.
- **Unmapped Category Warning:** Added active check against `relief_rules` category keys; displays an alert banner on the Tax Relief page for any unmapped line items.
- **Maintenance Background Job:** Added 24-hour job running daily 3-day reminder digests and 7-day auto-confirm for unreviewed receipts (`auto_confirmed: true`).

---

## 2026-08-22 — Telegram Account Linking & Deterministic Date Validation
- **Secure Telegram Linking:** Replaced hardcoded default IDs with a 6-digit link code generation flow (`link_codes` table, 10-minute expiry) and `/link <code>` bot command.
- **Deterministic Date Validation (`validateDate.ts`):** Separated LLM extraction from date reconciliation. Parsed Malaysian `DD/MM/YY` dates programmatically and cross-checked against invoice numbers and year boundary constraints (>2 years, future dates).

---

## 2026-08-21 — Initial Core Build & Database Setup
- Initialized Next.js App Router, Tailwind CSS, Lucide icons, and Recharts.
- Configured Supabase Postgres database with RLS policies scoped to `auth.uid()`.
- Seeded statutory Malaysian LHDN relief rules for YA 2025/2026 including umbrella caps (`medical_combined_umbrella`) and sub-caps.
- Built multimodal receipt extraction endpoint using `@google/genai` with Gemini.
- Created Expense and Relief dashboard views.
