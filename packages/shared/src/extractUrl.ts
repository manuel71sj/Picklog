import { makeExtractError } from "./errors.ts";
import { buildAiPayload, parseHtmlMetadata } from "./metadata.ts";
import { assertValidPicklogDraft } from "./schema.ts";
import type { ExtractUrlRequest, ExtractUrlResponse, FetchSummary, PicklogDraft } from "./types.ts";
import { evaluateUrlSafety, validateFetchEnvelope } from "./urlSafety.ts";

export interface MetadataFetchResult {
  content_type: string;
  final_url: string;
  redirect_count: number;
  body: string;
  response_bytes: number;
  elapsed_ms: number;
}

export interface ExtractUrlDeps {
  fetchMetadata: (canonicalUrl: string) => Promise<MetadataFetchResult>;
  extractWithAi: (payload: Record<string, unknown>) => Promise<unknown>;
}

export async function extractUrl(request: ExtractUrlRequest, deps: ExtractUrlDeps): Promise<ExtractUrlResponse> {
  const safety = evaluateUrlSafety(request.url);
  if (!safety.ok) {
    return makeExtractError(request.request_id, safety.error_code);
  }
  let fetched: MetadataFetchResult;
  try {
    fetched = await deps.fetchMetadata(safety.canonical_url);
  } catch {
    return makeExtractError(request.request_id, "metadata_failed");
  }
  const envelope = validateFetchEnvelope({
    contentType: fetched.content_type,
    responseBytes: fetched.response_bytes,
    elapsedMs: fetched.elapsed_ms,
  });
  if (!envelope.ok) {
    return makeExtractError(request.request_id, envelope.error_code);
  }

  const metadata = fetched.content_type.startsWith("text/html") ? parseHtmlMetadata(fetched.body) : {};
  const aiPayload = buildAiPayload({
    schema_version: request.client_schema_version,
    source_type: inferSourceType(safety.canonical_url),
    canonical_url: safety.canonical_url,
    canonical_origin: safety.canonical_origin,
    content_type: fetched.content_type,
    fetch_status: "ok",
    ...metadata,
  });

  let draft: unknown;
  try {
    draft = await deps.extractWithAi(aiPayload);
  } catch {
    return makeExtractError(request.request_id, "ai_timeout");
  }

  try {
    assertValidPicklogDraft(draft);
  } catch {
    return makeExtractError(request.request_id, "schema_invalid");
  }

  const fetch_summary: FetchSummary = {
    content_type: fetched.content_type,
    final_url: fetched.final_url,
    redirect_count: fetched.redirect_count,
    body_truncated: fetched.response_bytes >= 2 * 1024 * 1024,
    response_bytes: fetched.response_bytes,
    elapsed_ms: fetched.elapsed_ms,
  };
  return {
    status: "draft",
    request_id: request.request_id,
    schema_version: request.client_schema_version,
    canonical_url: safety.canonical_url,
    canonical_origin: safety.canonical_origin,
    fetch_summary,
    draft: draft as PicklogDraft,
  };
}

export function inferSourceType(url: string): PicklogDraft["source_type"] {
  const host = new URL(url).hostname.toLowerCase();
  if (host.includes("youtube.com") || host.includes("youtu.be")) return "youtube_url";
  if (host.includes("instagram.com")) return "instagram_url";
  if (host.includes("recipe") || host.includes("cook")) return "recipe_url";
  if (host.includes("shop") || host.includes("store") || host.includes("mall")) return "shopping_url";
  return "article_url";
}
