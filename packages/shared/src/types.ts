export const SCHEMA_VERSION = "picklog_item_v1" as const;
export const SYNC_EVENT_SCHEMA_VERSION = "sync_event_v1" as const;

export type SourceType =
  | "shopping_url"
  | "youtube_url"
  | "instagram_url"
  | "recipe_url"
  | "article_url"
  | "photo"
  | "unknown";

export type MetadataKind = "shopping" | "recipe" | "video" | "article" | "photo" | "unknown";

export type ItemStatus = "active" | "archived" | "deleted" | "permanently_deleted";

export type SyncState = "local_only" | "pending" | "synced" | "conflict";
export type FieldState = "ai_draft" | "needs_review" | "user_confirmed" | "user_empty";
export type ExtractInputType = "url";
export type UsageEventType =
  | "ai_extraction_requested"
  | "ai_extraction_succeeded"
  | "ai_extraction_failed"
  | "manual_save";

export interface ShoppingMetadata {
  kind: "shopping";
  seller: string | null;
  brand?: string | null;
  product_name: string | null;
  price?: number | null;
  currency?: string | null;
  price_observed_at?: string | null;
  purchase_intent?: "want" | "compare" | "purchased" | "gift" | string | null;
  needs_review: string[];
}

export interface RecipeMetadata {
  kind: "recipe";
  dish_name: string | null;
  ingredients?: string[];
  cooking_time_minutes?: number | null;
  difficulty?: "easy" | "medium" | "hard" | string | null;
  meal_type?: string | null;
  needs_review: string[];
}

export interface VideoMetadata {
  kind: "video";
  platform: "YouTube" | "Instagram" | "TikTok" | "other" | string;
  video_title: string | null;
  creator?: string | null;
  duration_seconds?: number | null;
  why_saved?: string | null;
  needs_review: string[];
}

export interface ArticleMetadata {
  kind: "article";
  site_name: string | null;
  article_title: string | null;
  author?: string | null;
  published_at?: string | null;
  topics?: string[];
  needs_review: string[];
}

export interface PhotoMetadata {
  kind: "photo";
  photo_count: number;
  dominant_labels?: string[];
  detected_text?: string | null;
  capture_context?: string | null;
  needs_review: string[];
}

export interface UnknownMetadata {
  kind: "unknown";
  raw_title?: string | null;
  raw_description?: string | null;
  needs_review: string[];
}

export type PicklogMetadata =
  | ShoppingMetadata
  | RecipeMetadata
  | VideoMetadata
  | ArticleMetadata
  | PhotoMetadata
  | UnknownMetadata;

export interface PicklogDraft {
  schema_version: typeof SCHEMA_VERSION;
  title: string;
  summary?: string | null;
  source_type: SourceType;
  category: string;
  use_case: string;
  tags: string[];
  source_url?: string | null;
  thumbnail_url?: string | null;
  confidence: number;
  field_confidence: Record<string, number>;
  needs_review: string[];
  extraction_notes: string;
  metadata: PicklogMetadata;
}

export interface FetchSummary {
  content_type: string;
  final_url: string;
  redirect_count: number;
  body_truncated: boolean;
  response_bytes?: number;
  elapsed_ms?: number;
}

export interface ExtractUrlRequest {
  request_id: string;
  device_id: string;
  url: string;
  client_schema_version: typeof SCHEMA_VERSION;
}

export interface ExtractUrlSuccess {
  status: "draft";
  request_id: string;
  schema_version: typeof SCHEMA_VERSION;
  canonical_url: string;
  canonical_origin: string;
  fetch_summary: FetchSummary;
  draft: PicklogDraft;
}

export type ExtractUrlErrorCode =
  | "invalid_url"
  | "unsafe_url"
  | "sensitive_url"
  | "fetch_timeout"
  | "response_too_large"
  | "unsupported_content_type"
  | "metadata_failed"
  | "ai_timeout"
  | "schema_invalid"
  | "idempotency_conflict"
  | "idempotency_in_progress";

export interface ExtractUrlError {
  status: "error";
  request_id: string;
  error_code: ExtractUrlErrorCode;
  retryable: boolean;
  manual_save_allowed: boolean;
  message_key: string;
}

export type ExtractUrlResponse = ExtractUrlSuccess | ExtractUrlError;

export interface ItemRecord {
  id: string;
  local_id: string;
  remote_id: string | null;
  user_id: string | null;
  device_id: string;
  sync_state: SyncState;
  version: number;
  status: ItemStatus;
  source_type: SourceType;
  source_url: string | null;
  title: string;
  summary: string | null;
  category: string | null;
  use_case: string | null;
  tags: string[];
  thumbnail_url: string | null;
  image_asset_id: string | null;
  metadata_json: PicklogMetadata | Record<string, never>;
  confidence: number | null;
  field_confidence_json: Record<string, number>;
  field_state_json: Record<string, FieldState>;
  extraction_id: string | null;
  user_note: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  deleted_at: string | null;
  tombstone_until: string | null;
}

export interface ExtractionRecord {
  id: string;
  item_id: string | null;
  input_type: ExtractInputType;
  input_snapshot: Record<string, unknown>;
  model_provider: string;
  model_name: string;
  schema_version: typeof SCHEMA_VERSION;
  raw_output_json: Record<string, unknown> | null;
  normalized_output_json: PicklogDraft | null;
  confidence: number | null;
  error: string | null;
  created_at: string;
  expires_at: string | null;
}

export interface PriceObservationRecord {
  id: string;
  item_id: string;
  seller: string | null;
  price: number | null;
  currency: string | null;
  observed_at: string;
  source: "metadata" | "ai" | "user";
  needs_review: boolean;
}

export interface AttachmentRecord {
  id: string;
  item_id: string;
  type: "thumbnail" | "photo" | "remote_image";
  storage_url: string;
  mime_type: string | null;
  width: number | null;
  height: number | null;
  created_at: string;
}

export interface SyncQueueRecord {
  id: string;
  schema_version: typeof SYNC_EVENT_SCHEMA_VERSION;
  queue_mode: "alpha_audit";
  entity_type: "item" | "extraction" | "attachment" | "price_observation";
  entity_local_id: string;
  operation: "create" | "update" | "archive" | "restore" | "delete" | "permanent_delete";
  payload_json: Record<string, unknown>;
  status: "done" | "pending" | "failed";
  attempt_count: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface UsageEventRecord {
  id: string;
  event_type: UsageEventType;
  item_local_id: string | null;
  extraction_id: string | null;
  occurred_at: string;
  metadata_json: Record<string, unknown>;
}

export interface SearchFilters {
  query?: string;
  category?: string;
  source_type?: SourceType;
  min_price?: number;
  max_price?: number;
  seller?: string;
  tags?: string[];
  include_archived?: boolean;
  include_deleted?: boolean;
  sort?: "recent" | "price_asc" | "name_asc";
}
