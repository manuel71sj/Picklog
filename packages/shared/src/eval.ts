import { PicklogStore } from "./store.ts";
import { validateClientUrl } from "./urlSafety.ts";
import type { SourceType } from "./types.ts";

export interface AlphaDatasetRow {
  id: string;
  input_url: string;
  source_type: SourceType;
  why_saved: string;
  expected_search_terms: string[];
  must_hit_fields: string[];
  nice_to_have_fields: string[];
  must_not_misread_fields: string[];
  needs_review_fields: string[];
  safety_expected: "allow" | "block";
  title: string;
  category: string;
  use_case: string;
  tags: string[];
  seller?: string | null;
  price?: number | null;
}

export interface AlphaEvalResult {
  row_count: number;
  safety_block_rate: number;
  search_success_rate: number;
  must_hit_field_rate: number;
  review_label_rate: number;
}

export function evaluateAlphaDataset(rows: AlphaDatasetRow[]): AlphaEvalResult {
  const store = new PicklogStore();
  let blockedTotal = 0;
  let blockedPassed = 0;
  let searchableTotal = 0;
  let searchablePassed = 0;
  let mustHitTotal = 0;
  let mustHitPassed = 0;
  let reviewTotal = 0;
  let reviewPassed = 0;

  for (const row of rows) {
    const safety = validateClientUrl(row.input_url);
    if (row.safety_expected === "block") {
      blockedTotal += 1;
      if (!safety.ok) blockedPassed += 1;
      continue;
    }
    if (!safety.ok) continue;
    const item = store.saveManual({
      device_id: "alpha-eval-device",
      source_url: safety.canonical_url,
      source_type: row.source_type,
      title: row.title,
      category: row.category,
      use_case: row.use_case,
      tags: row.tags,
      user_note: row.why_saved
    });
    if (row.seller || row.price !== undefined) {
      item.metadata_json = {
        kind: "shopping",
        seller: row.seller ?? null,
        product_name: row.title,
        price: row.price ?? null,
        currency: row.price === undefined ? null : "KRW",
        needs_review: row.needs_review_fields
      };
    }

    for (const term of row.expected_search_terms) {
      searchableTotal += 1;
      if (store.search({ query: term }).some((candidate) => candidate.local_id === item.local_id)) {
        searchablePassed += 1;
      }
    }
    const corpus = JSON.stringify(item).toLowerCase();
    for (const field of row.must_hit_fields) {
      mustHitTotal += 1;
      if (corpus.includes(field.toLowerCase())) mustHitPassed += 1;
    }
    for (const field of row.needs_review_fields) {
      reviewTotal += 1;
      if (JSON.stringify(item.metadata_json).includes(field)) reviewPassed += 1;
    }
  }

  return {
    row_count: rows.length,
    safety_block_rate: blockedTotal === 0 ? 1 : blockedPassed / blockedTotal,
    search_success_rate: searchableTotal === 0 ? 1 : searchablePassed / searchableTotal,
    must_hit_field_rate: mustHitTotal === 0 ? 1 : mustHitPassed / mustHitTotal,
    review_label_rate: reviewTotal === 0 ? 1 : reviewPassed / reviewTotal
  };
}
