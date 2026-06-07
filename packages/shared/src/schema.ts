import { SCHEMA_VERSION, type FieldState, type MetadataKind, type PicklogDraft, type SourceType } from "./types.ts";

const KIND_BY_SOURCE_TYPE: Record<SourceType, MetadataKind> = {
  shopping_url: "shopping",
  recipe_url: "recipe",
  youtube_url: "video",
  instagram_url: "video",
  article_url: "article",
  photo: "photo",
  unknown: "unknown"
};

const REQUIRED_BY_KIND: Record<MetadataKind, string[]> = {
  shopping: ["seller", "product_name", "needs_review"],
  recipe: ["dish_name", "needs_review"],
  video: ["platform", "video_title", "needs_review"],
  article: ["site_name", "article_title", "needs_review"],
  photo: ["photo_count", "needs_review"],
  unknown: ["needs_review"]
};

export interface ValidationIssue {
  path: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
}

export function validatePicklogDraft(value: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];
  if (!isObject(value)) {
    return { ok: false, issues: [{ path: "$", message: "Draft must be an object." }] };
  }
  const draft = value as Partial<PicklogDraft>;
  requireEqual(issues, draft.schema_version, SCHEMA_VERSION, "schema_version");
  requireString(issues, draft.title, "title");
  requireString(issues, draft.source_type, "source_type");
  requireString(issues, draft.category, "category");
  requireString(issues, draft.use_case, "use_case");
  requireArray(issues, draft.tags, "tags");
  requireNumberRange(issues, draft.confidence, "confidence");
  requireObject(issues, draft.field_confidence, "field_confidence");
  requireArray(issues, draft.needs_review, "needs_review");
  requireString(issues, draft.extraction_notes, "extraction_notes");
  requireObject(issues, draft.metadata, "metadata");

  if (isSourceType(draft.source_type) && isObject(draft.metadata)) {
    const metadata = draft.metadata as Record<string, unknown>;
    const expectedKind = KIND_BY_SOURCE_TYPE[draft.source_type];
    if (metadata.kind !== expectedKind) {
      issues.push({
        path: "metadata.kind",
        message: `metadata.kind must be ${expectedKind} for ${draft.source_type}.`
      });
    }
    for (const field of REQUIRED_BY_KIND[expectedKind]) {
      if (!(field in metadata)) {
        issues.push({ path: `metadata.${field}`, message: "Required metadata field is missing." });
      }
    }
    if (!Array.isArray(metadata.needs_review)) {
      issues.push({ path: "metadata.needs_review", message: "metadata.needs_review must be an array." });
    }
  }

  if (isObject(draft.field_confidence)) {
    for (const [field, confidence] of Object.entries(draft.field_confidence)) {
      if (typeof confidence !== "number" || confidence < 0 || confidence > 1) {
        issues.push({ path: `field_confidence.${field}`, message: "Field confidence must be between 0 and 1." });
      }
    }
  }

  if (Array.isArray(draft.needs_review) && isObject(draft.field_confidence)) {
    const fieldConfidence = draft.field_confidence as Record<string, number>;
    for (const field of ["price", "seller"]) {
      const confidence = fieldConfidence[field];
      if (typeof confidence === "number" && confidence < 0.8 && !draft.needs_review.includes(field)) {
        issues.push({
          path: `needs_review.${field}`,
          message: "Low-confidence price or seller must be marked for review."
        });
      }
    }
  }

  return { ok: issues.length === 0, issues };
}

export function assertValidPicklogDraft(value: unknown): asserts value is PicklogDraft {
  const result = validatePicklogDraft(value);
  if (!result.ok) {
    throw new Error(result.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; "));
  }
}

export function buildInitialFieldState(draft: PicklogDraft): Record<string, FieldState> {
  const state: Record<string, FieldState> = {};
  const fields = new Set([
    "title",
    "category",
    "use_case",
    "tags",
    ...Object.keys(draft.field_confidence),
    ...draft.needs_review
  ]);
  for (const field of fields) {
    state[field] = draft.needs_review.includes(field) ? "needs_review" : "ai_draft";
  }
  return state;
}

export function markUserEdits(
  existing: Record<string, FieldState>,
  edits: Record<string, unknown>
): Record<string, FieldState> {
  const next = { ...existing };
  for (const [field, value] of Object.entries(edits)) {
    if (value === "" || value === null || (Array.isArray(value) && value.length === 0)) {
      next[field] = "user_empty";
    } else {
      next[field] = "user_confirmed";
    }
  }
  return next;
}

function requireEqual(issues: ValidationIssue[], actual: unknown, expected: unknown, path: string): void {
  if (actual !== expected) issues.push({ path, message: `Expected ${String(expected)}.` });
}

function requireString(issues: ValidationIssue[], actual: unknown, path: string): void {
  if (typeof actual !== "string" || !actual.trim()) {
    issues.push({ path, message: "Required non-empty string is missing." });
  }
}

function requireArray(issues: ValidationIssue[], actual: unknown, path: string): void {
  if (!Array.isArray(actual)) issues.push({ path, message: "Required array is missing." });
}

function requireObject(issues: ValidationIssue[], actual: unknown, path: string): void {
  if (!isObject(actual)) issues.push({ path, message: "Required object is missing." });
}

function requireNumberRange(issues: ValidationIssue[], actual: unknown, path: string): void {
  if (typeof actual !== "number" || actual < 0 || actual > 1) {
    issues.push({ path, message: "Required number between 0 and 1 is missing." });
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSourceType(value: unknown): value is SourceType {
  return typeof value === "string" && value in KIND_BY_SOURCE_TYPE;
}
