import assert from "node:assert/strict";
import test from "node:test";
import { type ExtractUrlSuccess, IdempotencyStore, SCHEMA_VERSION } from "../packages/shared/src/index.ts";
import { shoppingDraft } from "./helpers.ts";

test("idempotency prevents duplicate work while in progress and replays terminal success", () => {
  const store = new IdempotencyStore();
  const request = {
    request_id: "req-1",
    device_id: "dev-1",
    url: "https://example.com/item",
    client_schema_version: SCHEMA_VERSION,
  };
  const first = store.begin(request);
  assert.equal(first.proceed, true);
  const second = store.begin(request);
  assert.equal(second.proceed, false);
  if (!second.proceed) assert.equal(second.response.error_code, "idempotency_in_progress");

  const response: ExtractUrlSuccess = {
    status: "draft",
    request_id: request.request_id,
    schema_version: SCHEMA_VERSION,
    canonical_url: "https://example.com/item",
    canonical_origin: "https://example.com",
    fetch_summary: {
      content_type: "text/html",
      final_url: "https://example.com/item",
      redirect_count: 0,
      body_truncated: false,
    },
    draft: shoppingDraft(),
  };
  if (first.proceed) store.finish(first.key, response);
  const replay = store.begin(request);
  assert.equal(replay.proceed, false);
  if (!replay.proceed) assert.equal(replay.response.status, "draft");
});

test("idempotency returns conflict for same request id with different request hash", () => {
  const store = new IdempotencyStore();
  const first = store.begin({
    request_id: "req-1",
    device_id: "dev-1",
    url: "https://example.com/a",
    client_schema_version: SCHEMA_VERSION,
  });
  assert.equal(first.proceed, true);
  const conflict = store.begin({
    request_id: "req-1",
    device_id: "dev-1",
    url: "https://example.com/b",
    client_schema_version: SCHEMA_VERSION,
  });
  assert.equal(conflict.proceed, false);
  if (!conflict.proceed) assert.equal(conflict.response.error_code, "idempotency_conflict");
});
