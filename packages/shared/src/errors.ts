import type { ExtractUrlError, ExtractUrlErrorCode } from "./types.ts";

const ERROR_POLICIES: Record<ExtractUrlErrorCode, { retryable: boolean; manual_save_allowed: boolean; message_key: string }> = {
  invalid_url: { retryable: false, manual_save_allowed: false, message_key: "url.invalid" },
  unsafe_url: { retryable: false, manual_save_allowed: false, message_key: "url.unsafe" },
  sensitive_url: { retryable: false, manual_save_allowed: false, message_key: "url.sensitive" },
  fetch_timeout: { retryable: true, manual_save_allowed: true, message_key: "extract.fetch_timeout" },
  response_too_large: { retryable: false, manual_save_allowed: true, message_key: "extract.response_too_large" },
  unsupported_content_type: { retryable: false, manual_save_allowed: true, message_key: "extract.unsupported_content_type" },
  metadata_failed: { retryable: true, manual_save_allowed: true, message_key: "extract.metadata_failed" },
  ai_timeout: { retryable: true, manual_save_allowed: true, message_key: "extract.ai_timeout" },
  schema_invalid: { retryable: true, manual_save_allowed: true, message_key: "extract.schema_invalid" },
  idempotency_conflict: { retryable: false, manual_save_allowed: false, message_key: "extract.idempotency_conflict" },
  idempotency_in_progress: { retryable: true, manual_save_allowed: false, message_key: "extract.idempotency_in_progress" }
};

export function makeExtractError(requestId: string, error_code: ExtractUrlErrorCode): ExtractUrlError {
  return { status: "error", request_id: requestId, error_code, ...ERROR_POLICIES[error_code] };
}
