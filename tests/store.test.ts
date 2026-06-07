import test from "node:test";
import assert from "node:assert/strict";
import { PicklogStore } from "../packages/shared/src/index.ts";
import { shoppingDraft } from "./helpers.ts";

test("draft save creates immutable extraction snapshot, price observation, usage event, and safe sync marker", () => {
  const store = new PicklogStore();
  const item = store.saveDraft({
    device_id: "dev-1",
    canonical_url: "https://store.example.com/lamp",
    draft: shoppingDraft(),
    fetch_summary: { content_type: "text/html" },
    raw_output_json: { draft: true },
    user_edits: { title: "내가 확정한 조명", user_note: "침실 후보" },
    now: new Date("2026-06-07T00:00:00.000Z")
  });

  assert.equal(item.title, "내가 확정한 조명");
  assert.equal(item.field_state_json.title, "user_confirmed");
  assert.equal(item.field_state_json.price, "needs_review");
  assert.equal(store.extractions.length, 1);
  assert.notEqual(store.extractions[0].normalized_output_json?.title, item.title);
  assert.equal(store.price_observations.length, 1);
  assert.equal(store.price_observations[0].needs_review, true);
  assert.equal(store.usage_events.length, 1);
  assert.equal(store.sync_queue.length, 1);
  assert.equal(JSON.stringify(store.sync_queue[0].payload_json).includes("침실 후보"), false);
  assert.equal(JSON.stringify(store.sync_queue[0].payload_json).includes("https://store.example.com/lamp"), false);
});

test("invalid draft save fails before partial records are written", () => {
  const store = new PicklogStore();
  assert.throws(() => {
    store.saveDraft({
      device_id: "dev-1",
      canonical_url: "https://store.example.com/lamp",
      draft: { ...shoppingDraft(), needs_review: [] },
      fetch_summary: {}
    });
  });
  assert.equal(store.items.length, 0);
  assert.equal(store.extractions.length, 0);
  assert.equal(store.price_observations.length, 0);
  assert.equal(store.usage_events.length, 0);
  assert.equal(store.sync_queue.length, 0);
});

test("search finds saved records and respects archived and deleted defaults", () => {
  const store = new PicklogStore();
  const item = store.saveDraft({
    device_id: "dev-1",
    canonical_url: "https://store.example.com/lamp",
    draft: shoppingDraft(),
    fetch_summary: {}
  });

  assert.equal(store.search({ query: "침실" }).length, 1);
  assert.equal(store.search({ seller: "Example Store" }).length, 1);
  assert.equal(store.search({ min_price: 50000, max_price: 60000 }).length, 1);
  store.archive(item.local_id);
  assert.equal(store.search({ query: "침실" }).length, 0);
  assert.equal(store.search({ query: "침실", include_archived: true }).length, 1);
  store.restore(item.local_id);
  store.delete(item.local_id);
  assert.equal(store.search({ query: "침실", include_archived: true }).length, 0);
  assert.equal(store.search({ query: "침실", include_deleted: true }).length, 1);
});

test("permanent delete scrubs user content, cascades linked records, and breaks usage linkage", () => {
  const store = new PicklogStore();
  const item = store.saveDraft({
    device_id: "dev-1",
    canonical_url: "https://store.example.com/lamp",
    draft: shoppingDraft(),
    fetch_summary: {},
    raw_output_json: { private: "raw" },
    user_edits: { user_note: "private note" }
  });
  store.delete(item.local_id);
  const tombstone = store.permanentlyDelete(item.local_id, new Date("2026-06-07T00:00:00.000Z"));

  assert.equal(tombstone.status, "permanently_deleted");
  assert.equal(tombstone.title, "");
  assert.equal(tombstone.source_url, null);
  assert.equal(tombstone.user_note, null);
  assert.deepEqual(tombstone.metadata_json, {});
  assert.equal(store.extractions.length, 0);
  assert.equal(store.price_observations.length, 0);
  assert.equal(store.attachments.length, 0);
  assert.equal(store.usage_events[0].item_local_id, null);
  assert.equal(store.usage_events[0].extraction_id, null);
  const marker = store.sync_queue.at(-1);
  assert.equal(marker?.operation, "permanent_delete");
  assert.equal(JSON.stringify(marker?.payload_json).includes("private note"), false);
});

test("expired raw AI outputs are deleted after seven days", () => {
  const store = new PicklogStore();
  store.saveDraft({
    device_id: "dev-1",
    canonical_url: "https://store.example.com/lamp",
    draft: shoppingDraft(),
    fetch_summary: {},
    raw_output_json: { raw: true },
    now: new Date("2026-06-01T00:00:00.000Z")
  });
  assert.equal(store.extractions[0].raw_output_json?.raw, true);
  assert.equal(store.cleanupExpiredRawOutputs(new Date("2026-06-08T00:00:01.000Z")), 1);
  assert.equal(store.extractions[0].raw_output_json, null);
});
