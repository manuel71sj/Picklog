import assert from "node:assert/strict";
import test from "node:test";
import { buildInitialFieldState, markUserEdits, validatePicklogDraft } from "../packages/shared/src/index.ts";
import { shoppingDraft } from "./helpers.ts";

test("picklog_item_v1 validator accepts valid shopping drafts", () => {
  const result = validatePicklogDraft(shoppingDraft());
  assert.equal(result.ok, true, JSON.stringify(result.issues));
});

test("picklog_item_v1 validator blocks malformed schema and missing fields", () => {
  const result = validatePicklogDraft({
    schema_version: "wrong",
    title: "",
    source_type: "shopping_url",
    metadata: { kind: "article" },
  });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.path === "schema_version"));
  assert.ok(result.issues.some((issue) => issue.path === "metadata.kind"));
});

test("low-confidence price and seller must be marked as needs_review", () => {
  const draft = shoppingDraft({
    needs_review: [],
    metadata: {
      kind: "shopping",
      seller: "Example Store",
      product_name: "무선 스탠드 조명",
      price: 59000,
      currency: "KRW",
      needs_review: [],
    },
  });
  const result = validatePicklogDraft(draft);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.path === "needs_review.price"));
  assert.ok(result.issues.some((issue) => issue.path === "needs_review.seller"));
});

test("field states preserve needs_review, user_confirmed, and user_empty", () => {
  const initial = buildInitialFieldState(shoppingDraft());
  assert.equal(initial.price, "needs_review");
  assert.equal(initial.title, "ai_draft");
  const edited = markUserEdits(initial, { title: "확정 제목", seller: "", tags: [] });
  assert.equal(edited.title, "user_confirmed");
  assert.equal(edited.seller, "user_empty");
  assert.equal(edited.tags, "user_empty");
});
