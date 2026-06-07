import { randomUUID } from "node:crypto";
import { rawOutputExpiresAt } from "./metadata.ts";
import { assertValidPicklogDraft, buildInitialFieldState, markUserEdits } from "./schema.ts";
import {
  type AttachmentRecord,
  type ExtractionRecord,
  type ItemRecord,
  type PicklogDraft,
  type PriceObservationRecord,
  SCHEMA_VERSION,
  type SearchFilters,
  type SourceType,
  SYNC_EVENT_SCHEMA_VERSION,
  type SyncQueueRecord,
  type UsageEventRecord,
} from "./types.ts";

interface SaveDraftInput {
  device_id: string;
  canonical_url: string;
  draft: PicklogDraft;
  fetch_summary: Record<string, unknown>;
  raw_output_json?: Record<string, unknown> | null;
  user_edits?: Partial<PicklogDraft> & { user_note?: string | null };
  now?: Date;
}

interface ManualSaveInput {
  device_id: string;
  source_url: string;
  source_type: SourceType;
  title: string;
  category?: string | null;
  use_case?: string | null;
  tags?: string[];
  user_note?: string | null;
  now?: Date;
}

export class PicklogStore {
  items: ItemRecord[] = [];
  extractions: ExtractionRecord[] = [];
  price_observations: PriceObservationRecord[] = [];
  attachments: AttachmentRecord[] = [];
  sync_queue: SyncQueueRecord[] = [];
  usage_events: UsageEventRecord[] = [];

  saveDraft(input: SaveDraftInput): ItemRecord {
    assertValidPicklogDraft(input.draft);
    const now = (input.now ?? new Date()).toISOString();
    const extraction: ExtractionRecord = {
      id: randomUUID(),
      item_id: null,
      input_type: "url",
      input_snapshot: {
        canonical_url: input.canonical_url,
        fetch_summary: input.fetch_summary,
      },
      model_provider: "configured-server-provider",
      model_name: "configured-structured-output-model",
      schema_version: SCHEMA_VERSION,
      raw_output_json: input.raw_output_json ?? null,
      normalized_output_json: structuredClone(input.draft),
      confidence: input.draft.confidence,
      error: null,
      created_at: now,
      expires_at: input.raw_output_json ? rawOutputExpiresAt(input.now ?? new Date()) : null,
    };
    const merged = { ...input.draft, ...input.user_edits };
    const fieldState = markUserEdits(buildInitialFieldState(input.draft), input.user_edits ?? {});
    const item: ItemRecord = {
      id: randomUUID(),
      local_id: randomUUID(),
      remote_id: null,
      user_id: null,
      device_id: input.device_id,
      sync_state: "local_only",
      version: 1,
      status: "active",
      source_type: merged.source_type,
      source_url: input.canonical_url,
      title: merged.title,
      summary: merged.summary ?? null,
      category: merged.category ?? null,
      use_case: merged.use_case ?? null,
      tags: merged.tags ?? [],
      thumbnail_url: merged.thumbnail_url ?? null,
      image_asset_id: null,
      metadata_json: structuredClone(merged.metadata),
      confidence: input.draft.confidence,
      field_confidence_json: structuredClone(input.draft.field_confidence),
      field_state_json: fieldState,
      extraction_id: extraction.id,
      user_note: input.user_edits?.user_note ?? null,
      created_at: now,
      updated_at: now,
      archived_at: null,
      deleted_at: null,
      tombstone_until: null,
    };
    extraction.item_id = item.id;
    this.extractions.push(extraction);
    this.items.push(item);
    this.createPriceObservationFromItem(item, now, "ai");
    this.recordUsage("ai_extraction_succeeded", item.local_id, extraction.id, { source_type: item.source_type }, now);
    this.recordSync(
      item.local_id,
      "create",
      {
        entity_local_id: item.local_id,
        entity_type: "item",
        created_at: now,
        changed_fields: ["title", "category", "use_case", "tags", "source_type", "metadata_json"],
      },
      now,
    );
    return item;
  }

  saveManual(input: ManualSaveInput): ItemRecord {
    const now = (input.now ?? new Date()).toISOString();
    const item: ItemRecord = {
      id: randomUUID(),
      local_id: randomUUID(),
      remote_id: null,
      user_id: null,
      device_id: input.device_id,
      sync_state: "local_only",
      version: 1,
      status: "active",
      source_type: input.source_type,
      source_url: input.source_url,
      title: input.title,
      summary: null,
      category: input.category ?? null,
      use_case: input.use_case ?? null,
      tags: input.tags ?? [],
      thumbnail_url: null,
      image_asset_id: null,
      metadata_json: { kind: "unknown", needs_review: [] },
      confidence: null,
      field_confidence_json: {},
      field_state_json: {
        title: "user_confirmed",
        category: input.category ? "user_confirmed" : "user_empty",
        use_case: input.use_case ? "user_confirmed" : "user_empty",
        tags: input.tags?.length ? "user_confirmed" : "user_empty",
      },
      extraction_id: null,
      user_note: input.user_note ?? null,
      created_at: now,
      updated_at: now,
      archived_at: null,
      deleted_at: null,
      tombstone_until: null,
    };
    this.items.push(item);
    this.recordUsage("manual_save", item.local_id, null, { source_type: item.source_type }, now);
    this.recordSync(
      item.local_id,
      "create",
      {
        entity_local_id: item.local_id,
        entity_type: "item",
        created_at: now,
        changed_fields: ["title", "category", "use_case", "tags", "source_type"],
      },
      now,
    );
    return item;
  }

  updateItem(
    localId: string,
    edits: Partial<Pick<ItemRecord, "title" | "category" | "use_case" | "tags" | "user_note">>,
  ): ItemRecord {
    const item = this.requireItem(localId);
    const now = new Date().toISOString();
    Object.assign(item, edits);
    item.field_state_json = markUserEdits(item.field_state_json, edits);
    item.version += 1;
    item.updated_at = now;
    this.recordSync(item.local_id, "update", { changed_fields: Object.keys(edits), version: item.version }, now);
    return item;
  }

  archive(localId: string): ItemRecord {
    const item = this.requireItem(localId);
    const now = new Date().toISOString();
    item.status = "archived";
    item.archived_at = now;
    item.version += 1;
    item.updated_at = now;
    this.recordSync(item.local_id, "archive", { archived_at: now, version: item.version }, now);
    return item;
  }

  restore(localId: string): ItemRecord {
    const item = this.requireItem(localId);
    const now = new Date().toISOString();
    const previous_status = item.status;
    item.status = "active";
    item.archived_at = null;
    item.deleted_at = null;
    item.tombstone_until = null;
    item.version += 1;
    item.updated_at = now;
    this.recordSync(item.local_id, "restore", { previous_status, version: item.version }, now);
    return item;
  }

  delete(localId: string): ItemRecord {
    const item = this.requireItem(localId);
    const now = new Date().toISOString();
    const previous_status = item.status;
    item.status = "deleted";
    item.deleted_at = now;
    item.version += 1;
    item.updated_at = now;
    this.recordSync(item.local_id, "delete", { deleted_at: now, previous_status, version: item.version }, now);
    return item;
  }

  permanentlyDelete(localId: string, nowDate = new Date()): ItemRecord {
    const item = this.requireItem(localId);
    const now = nowDate.toISOString();
    const tombstoneUntil = new Date(nowDate.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
    item.status = "permanently_deleted";
    item.version += 1;
    item.source_url = null;
    item.title = "";
    item.summary = null;
    item.category = null;
    item.use_case = null;
    item.tags = [];
    item.thumbnail_url = null;
    item.image_asset_id = null;
    item.metadata_json = {};
    item.confidence = null;
    item.field_confidence_json = {};
    item.field_state_json = {};
    item.extraction_id = null;
    item.user_note = null;
    item.updated_at = now;
    item.archived_at = null;
    item.tombstone_until = tombstoneUntil;

    this.extractions = this.extractions.filter((record) => record.item_id !== item.id);
    this.price_observations = this.price_observations.filter((record) => record.item_id !== item.id);
    this.attachments = this.attachments.filter((record) => record.item_id !== item.id);
    for (const event of this.usage_events) {
      if (event.item_local_id === localId) {
        event.item_local_id = null;
        event.extraction_id = null;
        event.metadata_json = { scrubbed: true };
      }
    }
    this.recordSync(
      item.local_id,
      "permanent_delete",
      {
        deleted_at: item.deleted_at,
        tombstone_until: tombstoneUntil,
        version: item.version,
      },
      now,
    );
    return item;
  }

  cleanupExpiredRawOutputs(nowDate = new Date()): number {
    let count = 0;
    for (const extraction of this.extractions) {
      if (
        extraction.expires_at &&
        new Date(extraction.expires_at).getTime() <= nowDate.getTime() &&
        extraction.raw_output_json
      ) {
        extraction.raw_output_json = null;
        count += 1;
      }
    }
    return count;
  }

  search(filters: SearchFilters = {}): ItemRecord[] {
    let results = this.items.filter((item) => {
      if (item.status === "permanently_deleted") return false;
      if (!filters.include_deleted && item.status === "deleted") return false;
      if (!filters.include_archived && item.status === "archived") return false;
      if (filters.category && item.category !== filters.category) return false;
      if (filters.source_type && item.source_type !== filters.source_type) return false;
      if (filters.seller && extractSeller(item).toLowerCase() !== filters.seller.toLowerCase()) return false;
      if (filters.tags?.length && !filters.tags.every((tag) => item.tags.includes(tag))) return false;
      const price = extractPrice(item);
      if (filters.min_price !== undefined && (price === null || price < filters.min_price)) return false;
      if (filters.max_price !== undefined && (price === null || price > filters.max_price)) return false;
      if (filters.query && !searchCorpus(item).includes(filters.query.toLowerCase())) return false;
      return true;
    });

    switch (filters.sort ?? "recent") {
      case "price_asc":
        results = results.sort(
          (a, b) => (extractPrice(a) ?? Number.MAX_SAFE_INTEGER) - (extractPrice(b) ?? Number.MAX_SAFE_INTEGER),
        );
        break;
      case "name_asc":
        results = results.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "recent":
        results = results.sort((a, b) => b.created_at.localeCompare(a.created_at));
        break;
    }
    return results;
  }

  private createPriceObservationFromItem(
    item: ItemRecord,
    observed_at: string,
    source: "metadata" | "ai" | "user",
  ): void {
    if (item.metadata_json.kind !== "shopping") return;
    const metadata = item.metadata_json;
    if (metadata.price === undefined && !metadata.seller) return;
    this.price_observations.push({
      id: randomUUID(),
      item_id: item.id,
      seller: metadata.seller ?? null,
      price: metadata.price ?? null,
      currency: metadata.currency ?? null,
      observed_at,
      source,
      needs_review: metadata.needs_review.includes("price") || metadata.needs_review.includes("seller"),
    });
  }

  private recordUsage(
    event_type: UsageEventRecord["event_type"],
    item_local_id: string | null,
    extraction_id: string | null,
    metadata_json: Record<string, unknown>,
    occurred_at: string,
  ): void {
    this.usage_events.push({ id: randomUUID(), event_type, item_local_id, extraction_id, metadata_json, occurred_at });
  }

  private recordSync(
    entity_local_id: string,
    operation: SyncQueueRecord["operation"],
    payload_json: Record<string, unknown>,
    now: string,
  ): void {
    this.sync_queue.push({
      id: randomUUID(),
      schema_version: SYNC_EVENT_SCHEMA_VERSION,
      queue_mode: "alpha_audit",
      entity_type: "item",
      entity_local_id,
      operation,
      payload_json,
      status: "done",
      attempt_count: 0,
      last_error: null,
      created_at: now,
      updated_at: now,
    });
  }

  private requireItem(localId: string): ItemRecord {
    const item = this.items.find((record) => record.local_id === localId);
    if (!item) throw new Error(`Item not found: ${localId}`);
    return item;
  }
}

function extractSeller(item: ItemRecord): string {
  return item.metadata_json.kind === "shopping" ? (item.metadata_json.seller ?? "") : "";
}

function extractPrice(item: ItemRecord): number | null {
  return item.metadata_json.kind === "shopping" ? (item.metadata_json.price ?? null) : null;
}

function searchCorpus(item: ItemRecord): string {
  const metadata = JSON.stringify(item.metadata_json);
  return [
    item.title,
    item.summary,
    item.category,
    item.use_case,
    item.tags.join(" "),
    item.source_type,
    item.source_url,
    metadata,
    item.user_note,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}
