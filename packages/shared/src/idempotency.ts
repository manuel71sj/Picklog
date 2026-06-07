import { computeRequestHash } from "./urlSafety.ts";
import type { ExtractUrlRequest, ExtractUrlResponse } from "./types.ts";

export type IdempotencyState =
  | "in_progress"
  | "terminal_success"
  | "terminal_nonretryable_error"
  | "retryable_error_not_cached";

export interface IdempotencyEntry {
  key: string;
  request_hash: string;
  state: IdempotencyState;
  response?: ExtractUrlResponse;
}

export class IdempotencyStore {
  private entries = new Map<string, IdempotencyEntry>();

  begin(request: ExtractUrlRequest): { proceed: true; key: string; request_hash: string } | { proceed: false; response: ExtractUrlResponse } {
    const request_hash = computeRequestHash(request.url, request.client_schema_version);
    const key = `${request.device_id}:${request.request_id}`;
    const existing = this.entries.get(key);
    if (!existing) {
      this.entries.set(key, { key, request_hash, state: "in_progress" });
      return { proceed: true, key, request_hash };
    }
    if (existing.request_hash !== request_hash) {
      return {
        proceed: false,
        response: {
          status: "error",
          request_id: request.request_id,
          error_code: "idempotency_conflict",
          retryable: false,
          manual_save_allowed: false,
          message_key: "extract.idempotency_conflict"
        }
      };
    }
    if (existing.state === "in_progress") {
      return {
        proceed: false,
        response: {
          status: "error",
          request_id: request.request_id,
          error_code: "idempotency_in_progress",
          retryable: true,
          manual_save_allowed: false,
          message_key: "extract.idempotency_in_progress"
        }
      };
    }
    if (existing.response && existing.state !== "retryable_error_not_cached") {
      return { proceed: false, response: existing.response };
    }
    this.entries.set(key, { key, request_hash, state: "in_progress" });
    return { proceed: true, key, request_hash };
  }

  finish(key: string, response: ExtractUrlResponse): void {
    const existing = this.entries.get(key);
    if (!existing) return;
    if (response.status === "draft") {
      this.entries.set(key, { ...existing, state: "terminal_success", response });
      return;
    }
    if (response.retryable && ["fetch_timeout", "metadata_failed", "ai_timeout", "schema_invalid"].includes(response.error_code)) {
      this.entries.set(key, { ...existing, state: "retryable_error_not_cached" });
      return;
    }
    this.entries.set(key, { ...existing, state: "terminal_nonretryable_error", response });
  }
}
