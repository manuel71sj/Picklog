import { extractUrl, IdempotencyStore, SCHEMA_VERSION, type ExtractUrlRequest } from "../../../packages/shared/src/index.ts";

const idempotency = new IdempotencyStore();

export async function handleExtractUrlRequest(request: Request): Promise<Response> {
  const body = await request.json() as ExtractUrlRequest;
  if (body.client_schema_version !== SCHEMA_VERSION) {
    return json({ status: "error", request_id: body.request_id, error_code: "schema_invalid", retryable: true, manual_save_allowed: true, message_key: "extract.schema_invalid" }, 422);
  }
  const begun = idempotency.begin(body);
  if (!begun.proceed) return json(begun.response, begun.response.status === "error" ? 409 : 200);

  const response = await extractUrl(body, {
    fetchMetadata: async (canonicalUrl) => {
      const started = Date.now();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15_000);
      try {
        const fetchResponse = await fetch(canonicalUrl, {
          redirect: "follow",
          signal: controller.signal
        });
        const bodyText = await fetchResponse.text();
        return {
          content_type: fetchResponse.headers.get("content-type") ?? "text/plain",
          final_url: fetchResponse.url,
          redirect_count: 0,
          body: bodyText,
          response_bytes: new TextEncoder().encode(bodyText).byteLength,
          elapsed_ms: Date.now() - started
        };
      } finally {
        clearTimeout(timeout);
      }
    },
    extractWithAi: async () => {
      throw new Error("AI provider is not configured for local Alpha skeleton.");
    }
  });
  idempotency.finish(begun.key, response);
  return json(response, response.status === "draft" ? 200 : 422);
}

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

declare const Deno: { serve?: (handler: (request: Request) => Promise<Response>) => void } | undefined;

if (typeof Deno !== "undefined" && Deno.serve) {
  Deno.serve(handleExtractUrlRequest);
}
