import test from "node:test";
import assert from "node:assert/strict";
import { evaluateUrlSafety, validateClientUrl, validateFetchEnvelope } from "../packages/shared/src/index.ts";

test("URL safety blocks unsafe schemes, local hosts, private ranges, userinfo, and sensitive query", () => {
  const blocked = [
    "ftp://example.com/item",
    "http://localhost:3000",
    "http://127.0.0.1",
    "http://10.0.0.12/item",
    "http://172.16.0.4/item",
    "http://192.168.1.10/item",
    "http://169.254.169.254/latest/meta-data",
    "https://user:pass@example.com/item",
    "https://example.com/item?access_token=secret",
    "https://example.com/item?x-amz-signature=secret"
  ];
  for (const url of blocked) {
    assert.equal(validateClientUrl(url).ok, false, url);
  }
});

test("URL safety allows public http and https while normalizing fragments and default ports", () => {
  const result = validateClientUrl("https://Example.com:443/item#section");
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.canonical_url, "https://example.com/item");
    assert.equal(result.canonical_origin, "https://example.com");
  }
});

test("server safety blocks DNS and redirect transitions into private ranges", () => {
  const dnsBlocked = evaluateUrlSafety("https://public.example/item", {
    resolvedIpsByHost: { "public.example": ["192.168.0.5"] }
  });
  assert.equal(dnsBlocked.ok, false);

  const redirectBlocked = evaluateUrlSafety("https://public.example/item", {
    redirectChain: ["http://169.254.169.254/latest/meta-data"]
  });
  assert.equal(redirectBlocked.ok, false);
});

test("fetch envelope enforces response size, content type, and total timeout", () => {
  assert.deepEqual(validateFetchEnvelope({ contentType: "text/html", responseBytes: 128, elapsedMs: 20 }), { ok: true });
  assert.equal(validateFetchEnvelope({ contentType: "application/pdf", responseBytes: 128, elapsedMs: 20 }).ok, false);
  assert.equal(validateFetchEnvelope({ contentType: "text/html", responseBytes: 2 * 1024 * 1024 + 1, elapsedMs: 20 }).ok, false);
  assert.equal(validateFetchEnvelope({ contentType: "text/html", responseBytes: 128, elapsedMs: 15_001 }).ok, false);
});
