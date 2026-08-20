---
name: receipt-extraction-schema
description: Use this skill whenever building, modifying, or debugging the receipt extraction pipeline — the API route or function that sends a receipt image to an LLM and returns structured data. Trigger on tasks mentioning "extraction", "receipt parsing", "LLM extraction", "spending_category", "relief_category", "receipts table", or "FR-2"/"FR-3".
---

# Receipt Extraction Schema Skill

## Purpose
Pins down the exact extraction output shape and confidence logic so it stays consistent across sessions, instead of the agent inventing its own format or a plausible-but-wrong confidence mechanism each time this pipeline is touched.

## Required output schema

Every extraction call must return JSON matching this shape:

```json
{
  "merchant": "string",
  "transaction_date": "YYYY-MM-DD",
  "total_amount": 0.00,
  "assessment_year": 2026,
  "spending_category": "groceries | dining | transport | utilities | medical | shopping | other",
  "relief_category": "medical | lifestyle | education | none | ...(per active relief_rules)",
  "line_items": [
    {
      "description": "string",
      "amount": 0.00,
      "spending_category": "string",
      "relief_category": "string | none",
      "is_claimable": true
    }
  ],
  "extraction_notes": "string, optional — anything the model found ambiguous"
}
```

Key points:
- `spending_category` and `relief_category` are **independent fields**. A receipt (or line item) can have a spending category with `relief_category: "none"`.
- `relief_category` values must be validated against the currently ACTIVE `relief_rules` for the given `assessment_year` — the extraction prompt should be given the active rule set as context, not asked to invent category names freely.
- `line_items` is optional in early/simple extraction but required once line-item splitting (PRD FR-2.4) is implemented — do not silently drop this field once it's expected downstream.

## Confidence handling — do NOT do this

**Never ask the LLM to output a numeric confidence score (e.g. `"confidence": 0.87`) and trust it as a calibrated probability.** LLMs are not statistically calibrated classifiers; a self-reported confidence number will look plausible but isn't grounded in anything measurable, and using it for auto-accept/reject thresholds produces inconsistent, sometimes overconfident results.

## Confidence handling — do this instead

Derive a `needs_review` flag from concrete, checkable conditions, evaluated in code after extraction returns, not by asking the model to self-assess:

```
needs_review = True if any of:
  - total_amount is missing, zero, or fails a basic sanity check
    (e.g. doesn't roughly match sum of line_items, if present)
  - relief_category is not found in the active relief_rules for
    that assessment_year (i.e. the model returned something invalid)
  - relief_category is present but ambiguous (e.g. model's
    extraction_notes flags uncertainty, or item could plausibly
    fall into more than one active category)
  - MyInvois corroboration (if available, v3) disagrees with the
    LLM-extracted merchant/amount
  - transaction_date is missing or unparseable
```

Receipts flagged `needs_review: true` go to the pending_review queue (manual confirm/edit card). Everything else can be treated as auto-accepted.

## Prompt construction requirements

When building or modifying the extraction prompt:
1. Always inject the active `relief_rules` for the receipt's likely assessment year as context (category keys + descriptions), so the model chooses from a real, current list rather than free-associating category names.
2. Do not ask the model for a confidence score field — omit it from the requested schema entirely.
3. Encourage the model to use `extraction_notes` for genuine ambiguity (e.g. "date is smudged, inferred from context") rather than fabricating certainty.
4. For mixed receipts (e.g. pharmacy), explicitly instruct the model to split line items rather than categorizing the whole receipt as one bucket.

## When modifying this pipeline
If a change would alter the output schema (adding/removing/renaming a field), check for and update every downstream consumer: the `receipts`/`receipt_line_items` table writes, the dashboard queries, and the Telegram confirm-card rendering — this schema is a shared contract across the whole system, not just the extraction route.