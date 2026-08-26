# Changelog & Development Log

All notable changes and architectural decisions for **ResitKu** are documented here in reverse chronological order.

---

## 2026-08-26 — Data-Sync & Validation Correctness Fixes
- **Dynamic Tax Relief Form Amounts (`src/components/dashboard/TaxReliefProfileForm.tsx` & `src/app/dashboard/profile/page.tsx`):** Replaced hardcoded static RM caps with dynamic values derived directly from the statutory `relief_rules` record fetched from `/api/rules?year=2025`. Form now automatically reflects updated allowance limits for OKU spouse, personal OKU, and child education/disability tiers without requiring frontend JSX copy changes.
- **Client-Side File Size Enforcement (`src/components/dashboard/QuickUploadModal.tsx`):** Added strict programmatic validation in `handleFileSelect` rejecting images larger than 15MB before reading them into memory via `FileReader`, matching the modal's stated limit.
- **Category Key Standardization (`src/lib/relief/applicableCategories.ts`):** Fixed a category key discrepancy where disabled child studying relief was incorrectly mapped to `disabled_child_studying` instead of the canonical database seed key `disabled_child_higher_ed_additional`.

---

## 2026-08-24 — PWA Webapp Branding & Home Screen Icons
- **App Icons (`src/app/icon.png` & `src/app/apple-icon.png`):** Generated high-resolution 512x512 browser favicon and 180x180 Apple touch icon from the official ResitKu blue receipt logo.
- **PWA Web Manifest (`src/app/manifest.ts`):** Implemented typed Next.js App Router manifest configuration with `standalone` display mode, matching palette (`#0052FF` theme color, `#FAFAFA` background), and 192x192 / 512x512 icons for Android / Chrome / iOS Add-to-Home-Screen workflows.
- **Root Layout Metadata (`src/app/layout.tsx`):** Added `appleWebApp` configuration (`capable: true`, `statusBarStyle: 'default'`) for browser chrome-less mobile execution.

---

## 2026-08-24 — Project Structure Clean-up & Unified Test Suite
- **Orphan File Removal:** Deleted unused legacy files (`src/components/dashboard/BottomNav.tsx`, `scripts/run_date_tests.js`).
- **Centralized Domain Types (`src/types/index.ts`):** Created barrel export exporting canonical interfaces (`Receipt`, `ReceiptLineItem`, `ReliefRule`, `FilingProfile`, `DateValidationResult`).
- **Guaranteed Test Cleanup (`tests/verifyRpcClaimedAmount.test.ts`):** Wrapped database mutation test in a `try/finally` block to guarantee test receipts are deleted even if assertions or RPC calls fail.
- **Unified Test Script (`package.json`):** Added `"test:all"` running all test suites (`validateDate`, `verifyExport`, `verifyRpcClaimedAmount`) sequentially with 100% pass rate.

---

## 2026-08-24 — Tax Profile Component Modularization
- **Component Separation (`src/app/dashboard/profile/page.tsx`):** Refactored the 584-line monolithic profile page into two focused, isolated sub-components:
  - `TelegramLinkCard.tsx` ([`src/components/dashboard/TelegramLinkCard.tsx`](file:///c:/Users/ASUS/Desktop/resitku/src/components/dashboard/TelegramLinkCard.tsx)): Manages Telegram pairing, 6-digit code generation, countdown timers, clipboard copying, and disconnect modal.
  - `TaxReliefProfileForm.tsx` ([`src/components/dashboard/TaxReliefProfileForm.tsx`](file:///c:/Users/ASUS/Desktop/resitku/src/components/dashboard/TaxReliefProfileForm.tsx)): Manages filing status, joint/separate switches, personal and spouse OKU disability relief, and dynamic dependent children allowance forms.
- **Page Container Simplification:** Reduced `page.tsx` from 584 lines to 65 lines with zero behavioral or styling regression.

---

## 2026-08-24 — Pending Review RLS Session Fetch Fix
- **Pending Review Page (`src/app/dashboard/pending/page.tsx`):** Fixed an issue where the pending count badge rendered on the sidebar (queried via SSR server client with user cookies), but the client-side pending page used an unauthenticated standalone client (`createClient`), causing PostgreSQL Row-Level Security (RLS) to return an empty array (`[]`). Routed the pending page fetch through the session-authenticated `GET /api/receipts?status=pending_review` endpoint.

---

## 2026-08-24 — RPC `claimed_amount` Consolidation & Responsive Assessment Year Navigation
- **`confirm_receipt_admin` RPC Consolidation (`009_confirm_receipt_rpc_claimed_amount.sql`):** Moved the `claimed_amount = SUM(amount WHERE include_in_records = true)` calculation logic directly inside PostgreSQL. Guarantees 100% identical behavior across Web dashboard (`/api/receipts/confirm`) and Telegram bot confirm paths.
- **Telegram Bot Cleanup (`src/bot/index.ts`):** Removed redundant TypeScript `claimed_amount` summation logic and now relies exclusively on the database RPC.
- **Left Sidebar Assessment Year Selector (`src/components/dashboard/Navigation.tsx`):** Placed the interactive `<select>` dropdown inside the left desktop sidebar header alongside the logo. Top bar (`DashboardHeader.tsx`) now displays a clean, static `YA <year>` indicator on desktop.
- **Mobile Assessment Year Dropdown (`src/components/dashboard/DashboardHeader.tsx`):** Ensured the interactive year dropdown renders in the top sticky header on mobile screens (`<1024px`) where the sidebar is hidden.
- **Per-User Scoped Storage (`src/context/YearContext.tsx`):** Scoped localStorage key to `resitku_selected_ya_<userId>` to ensure strict isolation across different user sessions on shared devices.

---

## 2026-08-24 — Global Assessment Year Sync & Navbar Centralization
- **Global Assessment Year Context (`src/context/YearContext.tsx`):** Created `YearProvider` with persistent `localStorage` support (`resitku_selected_ya`) syncing the selected Assessment Year (`2026`, `2025`, `2024`) across the entire web application.
- **Removed Duplicate In-Page Year Selectors:** Removed redundant in-page year cycle buttons from `/dashboard/expenses` and `/dashboard/relief`, replacing them with clear static `YA <year>` badges while delegating all year switching strictly to the navigation.

---

## 2026-08-24 — UX Modernization: Toast Notifications & Confirmation Modals
- **Replaced `alert()` & `window.confirm()`:** Replaced all raw browser popups with Apple-styled UI elements:
  - Installed `sonner` toast provider in root layout (`src/app/layout.tsx`) for non-blocking success/error feedback (3.5s auto-dismiss).
  - Created reusable `ConfirmDialog.tsx` modal for destructive actions (receipt deletion, Telegram unlinking).
- **Telegram Bot Friendly Guidance:** Wrapped raw technical LLM extraction errors in a plain-English, elderly-friendly retry tip prompt.

---

## 2026-08-24 — Dynamic Assessment Year Fallback Fix
- **Extraction Route Correctness Fix (`src/app/api/extract/route.ts`):** Replaced hardcoded `const targetYear = 2026` with dynamic `const targetYear = new Date().getFullYear()`. Eliminates the risk of undated receipts being misattributed to 2026 when future calendar years (2027+) begin.

---

## 2026-08-24 — Security Audit & Link Code Logging
- **Security Audit Passed:** Re-verified Postgres Row-Level Security (RLS) across all 5 tables (`receipts`, `receipt_line_items`, `users`, `relief_rules`, `link_codes`). Confirmed strict `auth.uid()` scoping with zero client-side `SUPABASE_SERVICE_ROLE_KEY` leaks.
- **Link Code Security Logging (`src/bot/index.ts`):** Added structured `console.warn` audit alerts on any failed `/link` attempt (recording the invalid/used/expired code, `telegramId`, and Telegram `username`) to ensure full operational visibility against brute-force probing.
- **Backlog Hardening Note (Pre-v3 expansion):** Before opening to public / multi-tenant signups beyond personal/family use, implement an IP / Telegram-ID sliding-window rate limiter (e.g. 5 attempts per 10 minutes) and an authenticated quota throttle on `/api/extract`.

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
