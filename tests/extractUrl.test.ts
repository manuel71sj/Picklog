import assert from "node:assert/strict";
import test from "node:test";
import { extractUrl, SCHEMA_VERSION } from "../packages/shared/src/index.ts";
import { shoppingDraft } from "./helpers.ts";

test("extract-url blocks unsafe URLs before metadata fetch", async () => {
  let fetched = false;
  const response = await extractUrl(
    {
      request_id: "req-1",
      device_id: "dev-1",
      url: "http://localhost:3000",
      client_schema_version: SCHEMA_VERSION,
    },
    {
      fetchMetadata: async () => {
        fetched = true;
        throw new Error("must not fetch");
      },
      extractWithAi: async () => shoppingDraft(),
    },
  );
  assert.equal(response.status, "error");
  if (response.status === "error") {
    assert.equal(response.manual_save_allowed, false);
  }
  assert.equal(fetched, false);
});

test("extract-url returns draft only after metadata and schema validation pass", async () => {
  const response = await extractUrl(
    {
      request_id: "req-1",
      device_id: "dev-1",
      url: "https://store.example.com/lamp",
      client_schema_version: SCHEMA_VERSION,
    },
    {
      fetchMetadata: async () => ({
        content_type: "text/html",
        final_url: "https://store.example.com/lamp",
        redirect_count: 0,
        body: '<title>Lamp</title><meta property="og:title" content="Lamp">',
        response_bytes: 64,
        elapsed_ms: 10,
      }),
      extractWithAi: async () => shoppingDraft(),
    },
  );
  assert.equal(response.status, "draft");
  if (response.status === "draft") {
    assert.equal(response.draft.metadata.kind, "shopping");
  }
});

test("extract-url normalizes retryable and manual-save errors", async () => {
  const response = await extractUrl(
    {
      request_id: "req-1",
      device_id: "dev-1",
      url: "https://store.example.com/lamp",
      client_schema_version: SCHEMA_VERSION,
    },
    {
      fetchMetadata: async () => ({
        content_type: "text/html",
        final_url: "https://store.example.com/lamp",
        redirect_count: 0,
        body: "<title>Lamp</title>",
        response_bytes: 64,
        elapsed_ms: 10,
      }),
      extractWithAi: async () => ({ bad: true }),
    },
  );
  assert.equal(response.status, "error");
  if (response.status === "error") {
    assert.equal(response.error_code, "schema_invalid");
    assert.equal(response.retryable, true);
    assert.equal(response.manual_save_allowed, true);
  }
});
