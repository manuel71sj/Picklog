const AI_ALLOWLIST = new Set([
  "schema_version",
  "source_type",
  "canonical_url",
  "canonical_origin",
  "page_title",
  "meta_description",
  "open_graph_title",
  "open_graph_description",
  "open_graph_image_url",
  "content_type",
  "visible_text_excerpt",
  "fetch_status",
]);

const MAX_VISIBLE_TEXT_BYTES = 8 * 1024;
const MAX_AI_PAYLOAD_BYTES = 16 * 1024;

export interface PageMetadata {
  page_title?: string;
  meta_description?: string;
  open_graph_title?: string;
  open_graph_description?: string;
  open_graph_image_url?: string;
  visible_text_excerpt?: string;
}

export function parseHtmlMetadata(html: string): PageMetadata {
  const title = matchFirst(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const visibleText = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return {
    page_title: decodeEntities(title),
    meta_description: decodeEntities(matchMeta(html, "description")),
    open_graph_title: decodeEntities(matchMeta(html, "og:title")),
    open_graph_description: decodeEntities(matchMeta(html, "og:description")),
    open_graph_image_url: matchMeta(html, "og:image") ?? undefined,
    visible_text_excerpt: truncateUtf8(visibleText, MAX_VISIBLE_TEXT_BYTES),
  };
}

export function buildAiPayload(input: Record<string, unknown>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (AI_ALLOWLIST.has(key) && value !== undefined) {
      payload[key] =
        key === "visible_text_excerpt" && typeof value === "string"
          ? truncateUtf8(value, MAX_VISIBLE_TEXT_BYTES)
          : value;
    }
  }
  return shrinkPayload(payload, MAX_AI_PAYLOAD_BYTES);
}

export function rawOutputExpiresAt(now = new Date()): string {
  return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
}

export function truncateUtf8(text: string, maxBytes: number): string {
  const encoder = new TextEncoder();
  if (encoder.encode(text).byteLength <= maxBytes) return text;
  let output = "";
  for (const char of text) {
    if (encoder.encode(output + char).byteLength > maxBytes) break;
    output += char;
  }
  return output;
}

function shrinkPayload(payload: Record<string, unknown>, maxBytes: number): Record<string, unknown> {
  const encoder = new TextEncoder();
  const next = { ...payload };
  while (encoder.encode(JSON.stringify(next)).byteLength > maxBytes && typeof next.visible_text_excerpt === "string") {
    next.visible_text_excerpt = truncateUtf8(
      next.visible_text_excerpt,
      Math.max(0, next.visible_text_excerpt.length - 512),
    );
  }
  if (encoder.encode(JSON.stringify(next)).byteLength > maxBytes) {
    delete next.visible_text_excerpt;
  }
  return next;
}

function matchMeta(html: string, name: string): string | undefined {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (
    matchFirst(
      html,
      new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']*)["'][^>]*>`, "i"),
    ) ??
    matchFirst(
      html,
      new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`, "i"),
    )
  );
}

function matchFirst(input: string, pattern: RegExp): string | undefined {
  return input.match(pattern)?.[1]?.trim();
}

function decodeEntities(value: string | undefined): string | undefined {
  return value
    ?.replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
