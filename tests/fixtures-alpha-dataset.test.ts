import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { type AlphaDatasetRow, evaluateAlphaDataset } from "../packages/shared/src/index.ts";

test("30-row Alpha dataset meets safety, must-hit, review-label, and search thresholds", () => {
  const rows = JSON.parse(
    readFileSync(new URL("./fixtures/alpha-dataset.json", import.meta.url), "utf8"),
  ) as AlphaDatasetRow[];
  const result = evaluateAlphaDataset(rows);
  assert.equal(result.row_count, 30);
  assert.equal(result.safety_block_rate, 1);
  assert.ok(result.must_hit_field_rate >= 0.8, JSON.stringify(result));
  assert.ok(result.review_label_rate >= 1, JSON.stringify(result));
  assert.ok(result.search_success_rate >= 0.7, JSON.stringify(result));
});
