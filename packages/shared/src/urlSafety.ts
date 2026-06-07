import { stableHash } from "./runtime.ts";
import type { ExtractUrlErrorCode } from "./types.ts";

export const SENSITIVE_QUERY_NAMES = new Set([
  "token",
  "access_token",
  "auth",
  "key",
  "api_key",
  "signature",
  "sig",
  "expires",
  "session",
  "jwt",
  "password",
]);

const ALLOWED_SCHEMES = new Set(["http:", "https:"]);
const MAX_REDIRECTS = 5;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES = ["text/html", "application/xhtml+xml", "application/json", "text/plain"];

export interface UrlSafetyOptions {
  resolvedIpsByHost?: Record<string, string[]>;
  redirectChain?: string[];
}

export interface SafeUrlResult {
  ok: true;
  canonical_url: string;
  canonical_origin: string;
  normalized_for_hash: string;
}

export interface UnsafeUrlResult {
  ok: false;
  error_code: ExtractUrlErrorCode;
  reason: string;
}

export type UrlSafetyResult = SafeUrlResult | UnsafeUrlResult;

export function validateClientUrl(input: string): UrlSafetyResult {
  const parsed = parseUrl(input);
  if (!parsed.ok) return parsed;
  if (!ALLOWED_SCHEMES.has(parsed.url.protocol)) {
    return unsafe("invalid_url", "Only http and https URLs are supported.");
  }
  if (parsed.url.username || parsed.url.password) {
    return unsafe("sensitive_url", "URL userinfo is not allowed.");
  }
  if (hasSensitiveQuery(parsed.url)) {
    return unsafe("sensitive_url", "Sensitive query parameter is not allowed.");
  }
  if (isBlockedHost(parsed.url.hostname)) {
    return unsafe("unsafe_url", "Host is in a blocked range.");
  }
  return makeSafe(parsed.url);
}

export function evaluateUrlSafety(input: string, options: UrlSafetyOptions = {}): UrlSafetyResult {
  const first = evaluateSingleUrl(input, options);
  if (!first.ok) return first;

  const chain = options.redirectChain ?? [];
  if (chain.length > MAX_REDIRECTS) {
    return unsafe("fetch_timeout", "Redirect limit exceeded.");
  }
  for (const redirect of chain) {
    const result = evaluateSingleUrl(redirect, options);
    if (!result.ok) {
      return unsafe(result.error_code, `Redirect blocked: ${result.reason}`);
    }
  }
  return chain.length ? evaluateSingleUrl(chain[chain.length - 1], options) : first;
}

export function normalizeUrl(input: string): string {
  const result = validateClientUrl(input);
  if (!result.ok) {
    throw new Error(result.reason);
  }
  return result.canonical_url;
}

export function computeRequestHash(url: string, schemaVersion: string): string {
  const normalized = normalizeUrl(url);
  return stableHash(`${schemaVersion}\n${normalized}`);
}

export function validateFetchEnvelope(input: {
  contentType: string;
  responseBytes: number;
  elapsedMs: number;
}): { ok: true } | { ok: false; error_code: ExtractUrlErrorCode; reason: string } {
  if (input.responseBytes > MAX_RESPONSE_BYTES) {
    return { ok: false, error_code: "response_too_large", reason: "Response exceeds 2MB." };
  }
  const contentType = input.contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  const isImage = contentType.startsWith("image/");
  if (!isImage && !ALLOWED_CONTENT_TYPES.includes(contentType)) {
    return { ok: false, error_code: "unsupported_content_type", reason: "Unsupported content type." };
  }
  if (input.elapsedMs > 15_000) {
    return { ok: false, error_code: "fetch_timeout", reason: "Fetch exceeded total timeout." };
  }
  return { ok: true };
}

function evaluateSingleUrl(input: string, options: UrlSafetyOptions): UrlSafetyResult {
  const parsed = parseUrl(input);
  if (!parsed.ok) return parsed;
  const url = parsed.url;
  if (!ALLOWED_SCHEMES.has(url.protocol)) {
    return unsafe("unsafe_url", "Scheme is not allowed.");
  }
  if (url.username || url.password) {
    return unsafe("sensitive_url", "URL userinfo is not allowed.");
  }
  if (hasSensitiveQuery(url)) {
    return unsafe("sensitive_url", "Sensitive query parameter is not allowed.");
  }
  if (isBlockedHost(url.hostname)) {
    return unsafe("unsafe_url", "Host is in a blocked range.");
  }
  const resolvedIps = options.resolvedIpsByHost?.[url.hostname.toLowerCase()] ?? [];
  for (const ip of resolvedIps) {
    if (isBlockedIp(ip)) {
      return unsafe("unsafe_url", "DNS resolved to a blocked range.");
    }
  }
  return makeSafe(url);
}

function parseUrl(input: string): { ok: true; url: URL } | UnsafeUrlResult {
  const trimmed = input.trim();
  if (!trimmed) return unsafe("invalid_url", "URL is empty.");
  try {
    return { ok: true, url: new URL(trimmed) };
  } catch {
    return unsafe("invalid_url", "URL is malformed.");
  }
}

function makeSafe(url: URL): SafeUrlResult {
  const normalized = new URL(url.toString());
  normalized.hash = "";
  normalized.hostname = normalized.hostname.toLowerCase();
  if (
    (normalized.protocol === "https:" && normalized.port === "443") ||
    (normalized.protocol === "http:" && normalized.port === "80")
  ) {
    normalized.port = "";
  }
  return {
    ok: true,
    canonical_url: normalized.toString(),
    canonical_origin: normalized.origin,
    normalized_for_hash: normalized.toString(),
  };
}

function unsafe(error_code: ExtractUrlErrorCode, reason: string): UnsafeUrlResult {
  return { ok: false, error_code, reason };
}

function hasSensitiveQuery(url: URL): boolean {
  for (const key of url.searchParams.keys()) {
    const normalized = key.toLowerCase();
    if (SENSITIVE_QUERY_NAMES.has(normalized) || normalized.startsWith("x-amz-")) {
      return true;
    }
  }
  return false;
}

function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (host === "metadata.google.internal") return true;
  if (isBlockedIp(host)) return true;
  return false;
}

export function isBlockedIp(input: string): boolean {
  const ip = input
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, "");
  if (ip === "::1" || ip === "0:0:0:0:0:0:0:1") return true;
  if (ip.startsWith("fe80:") || ip.startsWith("fc") || ip.startsWith("fd")) return true;
  if (ip === "169.254.169.254" || ip === "100.100.100.200") return true;
  const parts = ip.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}
