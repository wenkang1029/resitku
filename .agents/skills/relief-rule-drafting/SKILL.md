---
name: relief-rule-drafting
description: Use this skill whenever working on the tax relief rule registry (relief_rules table), including reading LHDN budget/gazette source documents, proposing changes to relief categories or limits for a new assessment year, or building/modifying the rule-drafting review workflow. Trigger on tasks mentioning "relief rules", "assessment year rules", "rule_version", "LHDN rule update", or "FR-4.4".
---

# Relief Rule Drafting Skill

## Purpose
This skill governs how the `relief_rules` table is ever modified. It exists because a wrong entry in this table silently affects every receipt categorized under that assessment year — unlike a single receipt extraction error, which affects one record. This asymmetry means rule changes require a strictly different, more conservative workflow than everyday feature work.

## Non-negotiable rules

1. **Never write directly to an ACTIVE rule_version.** All proposed changes go through a `status: DRAFT` row first. A DRAFT row is never read by the extraction pipeline — only ACTIVE rows are.

2. **Every proposed change must cite its source.** When drafting or modifying rules from an LHDN document (budget speech, Finance Bill, PIN guideline), each changed field must carry a `source_reference` (e.g. "Budget 2027 speech, para 84" or a direct quote reference paraphrased, never verbatim beyond a short attribution phrase) so a human reviewer can verify quickly without re-reading the whole source.

3. **Diff, don't rewrite.** When creating a new assessment year's rules, generate them as a diff against the prior year's ACTIVE version — most fields carry over unchanged. Only flag what actually changed. Do not regenerate the full rule set from scratch, since that makes review harder and increases the chance of introducing an unintended change to an unrelated field.

4. **A DRAFT never becomes ACTIVE without explicit human approval.** Never write code or automation that auto-promotes a DRAFT to ACTIVE on a timer, on merge, or on any trigger other than an explicit user action (e.g. clicking "Approve" in the review UI, or the project owner explicitly typing an approval instruction in chat).

5. **Numbers are never invented.** If a source document is ambiguous, incomplete, or not provided, do not guess a relief limit or category. Flag it as `needs_source` instead of filling in a plausible-looking number.

6. **Immutability of history.** Once a `rule_version` is ACTIVE and has receipts referencing it via foreign key, it must never be edited in place. Corrections become a new version; old receipts keep pointing to the version that was active when they were categorized.

## Expected data shape

```
relief_rules
  id, assessment_year, rule_version, status (draft | active),
  category_key, category_label, limit_amount,
  sub_cap_parent_id (nullable),
  source_reference, description,
  created_at, approved_at (nullable), approved_by (nullable)
```

## Workflow when asked to process a new source document

1. Read the provided source document/text.
2. Fetch the current ACTIVE rule_version for comparison.
3. Produce a structured diff: `added`, `changed` (old value → new value), `removed`, and `unchanged` (briefly, for completeness).
4. For every `added` or `changed` entry, include a `source_reference`.
5. Save all `added`/`changed`/`removed` entries as new rows with `status: draft` under a new `rule_version`, linked to the same `assessment_year` if updating, or a new one if creating.
6. Present the diff clearly (not the full rule set) for human review. Do not mark anything ACTIVE.
7. Only flip `status: active` (and set `approved_at`) when the user explicitly confirms approval, ideally after being shown the diff alongside the source excerpt.

## When in doubt
If unsure whether a change is safe to draft automatically, err toward flagging it for human review rather than proceeding. This skill's entire purpose is to slow down and add friction at exactly this one point in the system — that friction is intentional, not a bug to optimize away.