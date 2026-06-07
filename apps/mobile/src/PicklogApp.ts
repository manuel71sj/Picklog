import React, { useMemo, useState } from "react";
import { Linking, SafeAreaView, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import {
  type ExtractUrlError,
  type FieldState,
  type ItemRecord,
  type PicklogDraft,
  PicklogStore,
  SCHEMA_VERSION,
  type SearchFilters,
  type SourceType,
  validateClientUrl,
} from "../../../packages/shared/src/index.ts";

const TOUCH = 44;
const DEVICE_ID = "alpha-device";
const BASE_INPUT_STYLE = {
  minHeight: TOUCH,
  borderWidth: 1,
  borderColor: "#C9C2B8",
  padding: 12,
  borderRadius: 8,
  backgroundColor: "white",
};

type ExtractState =
  | { type: "idle" }
  | { type: "extracting"; canonicalUrl: string }
  | { type: "draft"; canonicalUrl: string; draft: PicklogDraft; fieldState: Record<string, FieldState> }
  | { type: "error"; error: ExtractUrlError; reason: string; canonicalUrl?: string }
  | { type: "saved"; localId: string };

type DraftEdits = Partial<Pick<PicklogDraft, "title" | "category" | "use_case" | "tags">> & {
  user_note?: string | null;
};

export function PicklogApp() {
  const store = useMemo(() => new PicklogStore(), []);
  const [url, setUrl] = useState("");
  const [extractState, setExtractState] = useState<ExtractState>({ type: "idle" });
  const [draftEdits, setDraftEdits] = useState<DraftEdits>({});
  const [, setRevision] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filters, setFilters] = useState<SearchFilters>({ sort: "recent" });

  const selected = selectedId ? store.items.find((item) => item.local_id === selectedId) : null;
  const visible = store.search(filters);
  const usageCount = store.usage_events.length;

  const refresh = () => {
    setRevision((value) => value + 1);
  };

  const updateFilters = (patch: SearchFilters) => {
    const next = { ...filters, ...patch };
    setFilters(next);
  };

  const beginExtraction = () => {
    const safety = validateClientUrl(url);
    if (!safety.ok) {
      setExtractState({
        type: "error",
        error: makeUiError("invalid_url", false, false),
        reason: safety.reason,
      });
      return;
    }
    setExtractState({ type: "extracting", canonicalUrl: safety.canonical_url });
    const draft = buildLocalDraft(safety.canonical_url);
    setDraftEdits({});
    setExtractState({
      type: "draft",
      canonicalUrl: safety.canonical_url,
      draft,
      fieldState: buildReviewState(draft),
    });
  };

  const simulateRetryableError = () => {
    const safety = validateClientUrl(url);
    if (!safety.ok) {
      setExtractState({
        type: "error",
        error: makeUiError("invalid_url", false, false),
        reason: safety.reason,
      });
      return;
    }
    setExtractState({
      type: "error",
      canonicalUrl: safety.canonical_url,
      error: makeUiError("ai_timeout", true, true),
      reason: "AI extraction timed out.",
    });
  };

  const saveManual = () => {
    const safety = validateClientUrl(url);
    if (!safety.ok) {
      setExtractState({
        type: "error",
        error: makeUiError("unsafe_url", false, false),
        reason: "Manual save is blocked until the URL is safe.",
      });
      return;
    }
    const item = store.saveManual({
      device_id: DEVICE_ID,
      source_url: safety.canonical_url,
      source_type: "unknown",
      title: safety.canonical_url,
      category: "inbox",
      use_case: "saved for later",
      tags: ["manual"],
    });
    setUrl("");
    setSelectedId(item.local_id);
    setExtractState({ type: "saved", localId: item.local_id });
    refresh();
  };

  const saveDraft = () => {
    if (extractState.type !== "draft") return;
    const merged = { ...extractState.draft, ...draftEdits };
    if (!merged.title?.trim() || !merged.category?.trim() || !merged.use_case?.trim()) {
      setExtractState({
        type: "error",
        canonicalUrl: extractState.canonicalUrl,
        error: makeUiError("schema_invalid", false, true),
        reason: "Title, category, and use case are required before saving.",
      });
      return;
    }
    const item = store.saveDraft({
      device_id: DEVICE_ID,
      canonical_url: extractState.canonicalUrl,
      draft: extractState.draft,
      fetch_summary: {
        content_type: "text/html",
        final_url: extractState.canonicalUrl,
        redirect_count: 0,
        body_truncated: false,
      },
      raw_output_json: { local_alpha_stub: true },
      user_edits: draftEdits,
    });
    setUrl("");
    setDraftEdits({});
    setSelectedId(item.local_id);
    setExtractState({ type: "saved", localId: item.local_id });
    refresh();
  };

  const updateSelectedNote = (text: string) => {
    if (!selected) return;
    store.updateItem(selected.local_id, { user_note: text });
    refresh();
  };

  const transitionSelected = (action: "archive" | "restore" | "delete" | "permanent_delete") => {
    if (!selected) return;
    if (action === "archive") store.archive(selected.local_id);
    if (action === "restore") store.restore(selected.local_id);
    if (action === "delete") store.delete(selected.local_id);
    if (action === "permanent_delete") store.permanentlyDelete(selected.local_id);
    refresh();
  };

  return React.createElement(
    SafeAreaView,
    { style: { flex: 1, backgroundColor: "#FAF8F4" } },
    React.createElement(
      ScrollView,
      { contentContainerStyle: { padding: 20, gap: 16 } },
      React.createElement(Text, { style: { fontSize: 28, fontWeight: "700", color: "#18202A" } }, "Picklog"),
      renderLinkInput(url, setUrl),
      renderPrimaryActions(beginExtraction, simulateRetryableError, saveManual, extractState),
      renderExtractionState(extractState, {
        onCancel: () => setExtractState({ type: "idle" }),
        onRetry: beginExtraction,
        onManualSave: saveManual,
        onSaveDraft: saveDraft,
        onReextract: beginExtraction,
        draftEdits,
        setDraftEdits,
      }),
      renderSearch(filters, updateFilters),
      renderList(visible, selectedId, setSelectedId),
      selected ? renderDetail(selected, updateSelectedNote, transitionSelected) : null,
      renderNotice(usageCount),
    ),
  );
}

function renderLinkInput(url: string, setUrl: (value: string) => void) {
  return React.createElement(TextInput, {
    accessibilityLabel: "Link input",
    accessibilityHint: "Paste a public http or https link to extract or save manually",
    autoCapitalize: "none",
    multiline: true,
    onChangeText: setUrl,
    placeholder: "https://example.com/item",
    style: { ...BASE_INPUT_STYLE, minHeight: 88 },
    value: url,
  });
}

function renderPrimaryActions(
  beginExtraction: () => void,
  simulateRetryableError: () => void,
  saveManual: () => void,
  extractState: ExtractState,
) {
  const manualVisible = extractState.type !== "error" || extractState.error.manual_save_allowed;
  return React.createElement(
    View,
    { style: { flexDirection: "row", flexWrap: "wrap", gap: 12 } },
    button("Extract", "Extract link", "Creates an AI draft from the pasted link", beginExtraction, "primary"),
    button(
      "Timeout",
      "Simulate retryable timeout",
      "Shows retry and manual save fallback state",
      simulateRetryableError,
    ),
    manualVisible ? button("Manual Save", "Manual save", "Saves a safe URL without AI extraction", saveManual) : null,
  );
}

function renderExtractionState(
  state: ExtractState,
  actions: {
    onCancel: () => void;
    onRetry: () => void;
    onManualSave: () => void;
    onSaveDraft: () => void;
    onReextract: () => void;
    draftEdits: DraftEdits;
    setDraftEdits: (edits: DraftEdits) => void;
  },
) {
  if (state.type === "idle") return null;
  if (state.type === "extracting") {
    return panel(
      "Extracting",
      React.createElement(Text, { accessibilityLiveRegion: "polite" }, `Reading ${state.canonicalUrl}`),
      button("Cancel", "Cancel extraction", "Stops the current extraction state", actions.onCancel),
    );
  }
  if (state.type === "error") {
    return panel(
      "Needs attention",
      React.createElement(Text, { accessibilityLiveRegion: "polite", style: { color: "#A13A2A" } }, state.reason),
      React.createElement(
        View,
        { style: { flexDirection: "row", flexWrap: "wrap", gap: 12 } },
        state.error.retryable
          ? button("Retry", "Retry extraction", "Retries the extraction request", actions.onRetry)
          : null,
        state.error.manual_save_allowed
          ? button(
              "Manual Save",
              "Manual save after extraction failure",
              "Saves the safe link without AI",
              actions.onManualSave,
            )
          : null,
      ),
    );
  }
  if (state.type === "saved") {
    return panel(
      "Saved",
      React.createElement(Text, { accessibilityLiveRegion: "polite" }, "Saved to your Picklog list."),
    );
  }
  const draft = { ...state.draft, ...actions.draftEdits };
  return panel(
    "Review",
    renderDraftInputs(draft, state.fieldState, actions.draftEdits, actions.setDraftEdits),
    React.createElement(
      View,
      { style: { flexDirection: "row", flexWrap: "wrap", gap: 12 } },
      button(
        "Save",
        "Save reviewed draft",
        "Saves the confirmed draft to the local list",
        actions.onSaveDraft,
        "primary",
      ),
      button("Re-extract", "Re-extract link", "Runs extraction again for the same link", actions.onReextract),
      button("Cancel", "Cancel review", "Closes the draft without saving", actions.onCancel),
    ),
  );
}

function renderDraftInputs(
  draft: PicklogDraft,
  fieldState: Record<string, FieldState>,
  edits: DraftEdits,
  setEdits: (edits: DraftEdits) => void,
) {
  const needsReview = [...new Set([...draft.needs_review, ...draft.metadata.needs_review])];
  const setText = (field: keyof DraftEdits, value: string) => {
    setEdits({ ...edits, [field]: field === "tags" ? splitTags(value) : value });
  };
  return React.createElement(
    View,
    { style: { gap: 10 } },
    React.createElement(
      Text,
      { style: { fontWeight: "700" } },
      `${variantLabel(draft.source_type)} · ${draft.source_type}`,
    ),
    needsReview.length
      ? React.createElement(Text, { style: { color: "#8A4B10" } }, `확인 필요: ${needsReview.join(", ")}`)
      : null,
    textInput("Title", draft.title, (value) => setText("title", value), "Draft title"),
    textInput("Category", draft.category, (value) => setText("category", value), "Draft category"),
    textInput("Use case", draft.use_case, (value) => setText("use_case", value), "Why this link is saved"),
    textInput("Tags", draft.tags.join(", "), (value) => setText("tags", value), "Comma separated tags"),
    textInput("Note", edits.user_note ?? "", (value) => setText("user_note", value), "Private user note"),
    React.createElement(Text, { style: { color: "#5D6670" } }, `Field state: ${formatFieldState(fieldState)}`),
    React.createElement(Text, { style: { color: "#5D6670" } }, metadataSummary(draft)),
  );
}

function renderSearch(filters: SearchFilters, updateFilters: (patch: SearchFilters) => void) {
  return panel(
    "Saved",
    React.createElement(TextInput, {
      accessibilityLabel: "Search saved items",
      onChangeText: (query: string) => updateFilters({ query }),
      placeholder: "Search title, category, tags, seller",
      style: BASE_INPUT_STYLE,
      value: filters.query ?? "",
    }),
    React.createElement(
      View,
      { style: { flexDirection: "row", flexWrap: "wrap", gap: 8 } },
      chip("All", !filters.source_type, () => updateFilters({ source_type: undefined })),
      chip("Shopping", filters.source_type === "shopping_url", () => updateFilters({ source_type: "shopping_url" })),
      chip("Recipe", filters.source_type === "recipe_url", () => updateFilters({ source_type: "recipe_url" })),
      chip("YouTube", filters.source_type === "youtube_url", () => updateFilters({ source_type: "youtube_url" })),
      chip("Instagram", filters.source_type === "instagram_url", () => updateFilters({ source_type: "instagram_url" })),
      chip("Article", filters.source_type === "article_url", () => updateFilters({ source_type: "article_url" })),
      chip("Photo", filters.source_type === "photo", () => updateFilters({ source_type: "photo" })),
      chip("Unknown", filters.source_type === "unknown", () => updateFilters({ source_type: "unknown" })),
      chip("Archived", Boolean(filters.include_archived), () =>
        updateFilters({ include_archived: !filters.include_archived }),
      ),
      chip("Recent", filters.sort === "recent", () => updateFilters({ sort: "recent" })),
      chip("Price", filters.sort === "price_asc", () => updateFilters({ sort: "price_asc" })),
      chip("Name", filters.sort === "name_asc", () => updateFilters({ sort: "name_asc" })),
    ),
    React.createElement(
      View,
      { style: { flexDirection: "row", gap: 8 } },
      textInput(
        "Category",
        filters.category ?? "",
        (category) => updateFilters({ category: category || undefined }),
        "Category filter",
      ),
      textInput(
        "Seller",
        filters.seller ?? "",
        (seller) => updateFilters({ seller: seller || undefined }),
        "Seller filter",
      ),
      textInput(
        "Tag",
        filters.tags?.[0] ?? "",
        (tag) => updateFilters({ tags: tag ? [tag] : undefined }),
        "Tag filter",
      ),
    ),
    React.createElement(
      View,
      { style: { flexDirection: "row", gap: 8 } },
      textInput(
        "Min",
        filters.min_price?.toString() ?? "",
        (value) => updateFilters({ min_price: numberOrUndefined(value) }),
        "Minimum price",
      ),
      textInput(
        "Max",
        filters.max_price?.toString() ?? "",
        (value) => updateFilters({ max_price: numberOrUndefined(value) }),
        "Maximum price",
      ),
    ),
  );
}

function renderList(items: ItemRecord[], selectedId: string | null, setSelectedId: (id: string) => void) {
  return React.createElement(
    View,
    { style: { gap: 10 } },
    ...items.map((item) =>
      React.createElement(
        TouchableOpacity,
        {
          accessibilityLabel: `Open ${item.title || "deleted item"}`,
          accessibilityHint: "Opens item detail controls",
          key: item.local_id,
          onPress: () => setSelectedId(item.local_id),
          style: {
            minHeight: TOUCH,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: selectedId === item.local_id ? "#233147" : "#E4DDD3",
          },
        },
        React.createElement(
          Text,
          { numberOfLines: 2, style: { fontSize: 16, fontWeight: "700", color: "#18202A" } },
          item.title || "Deleted item",
        ),
        React.createElement(
          Text,
          { style: { color: "#5D6670" } },
          `${item.category ?? "uncategorized"} · ${item.source_type} · ${item.status}`,
        ),
      ),
    ),
  );
}

function renderDetail(
  item: ItemRecord,
  updateNote: (text: string) => void,
  transition: (action: "archive" | "restore" | "delete" | "permanent_delete") => void,
) {
  return panel(
    "Detail",
    React.createElement(Text, { style: { fontSize: 18, fontWeight: "700" } }, item.title || "Deleted item"),
    React.createElement(Text, { style: { color: "#5D6670" } }, `${item.status} · v${item.version}`),
    item.source_url
      ? button("Open Link", "Open original link", "Opens the original source URL", () =>
          Linking.openURL(item.source_url ?? ""),
        )
      : null,
    textInput("Memo", item.user_note ?? "", updateNote, "Edit private memo"),
    React.createElement(
      View,
      { style: { flexDirection: "row", flexWrap: "wrap", gap: 8 } },
      item.status === "active"
        ? button("Archive", "Archive item", "Moves this item out of default search", () => transition("archive"))
        : null,
      item.status === "archived" || item.status === "deleted"
        ? button("Restore", "Restore item", "Restores this item to active state", () => transition("restore"))
        : null,
      item.status !== "deleted" && item.status !== "permanently_deleted"
        ? button("Delete", "Delete item", "Moves this item to trash", () => transition("delete"))
        : null,
      item.status === "deleted"
        ? button("Delete Forever", "Permanently delete item", "Scrubs content and keeps only a deletion marker", () =>
            transition("permanent_delete"),
          )
        : null,
    ),
  );
}

function renderNotice(usageCount: number) {
  return panel(
    "Privacy",
    React.createElement(
      Text,
      { style: { color: "#38414B" } },
      "AI receives the public URL metadata excerpt only. Saved items stay private on this device during Alpha.",
    ),
    React.createElement(
      Text,
      { style: { color: "#38414B" } },
      "Changing devices can lose local data until sync ships. Deleted content can be scrubbed from the local model.",
    ),
    React.createElement(Text, { style: { color: "#38414B" } }, `Alpha usage events recorded locally: ${usageCount}`),
  );
}

function panel(title: string, ...children: Array<React.ReactNode>) {
  return React.createElement(
    View,
    { style: { borderTopWidth: 1, borderTopColor: "#DED7CD", paddingTop: 14, gap: 10 } },
    React.createElement(Text, { style: { fontSize: 18, fontWeight: "700", color: "#18202A" } }, title),
    ...children,
  );
}

function button(
  label: string,
  accessibilityLabel: string,
  accessibilityHint: string,
  onPress: () => void,
  tone: "primary" | "secondary" = "secondary",
) {
  return React.createElement(
    TouchableOpacity,
    {
      accessibilityLabel,
      accessibilityHint,
      onPress,
      style: {
        minHeight: TOUCH,
        justifyContent: "center",
        paddingHorizontal: 16,
        borderRadius: 8,
        backgroundColor: tone === "primary" ? "#233147" : "#E7DED2",
      },
    },
    React.createElement(Text, { style: { color: tone === "primary" ? "white" : "#18202A", fontWeight: "700" } }, label),
  );
}

function chip(label: string, active: boolean, onPress: () => void) {
  return React.createElement(
    TouchableOpacity,
    {
      accessibilityLabel: label,
      onPress,
      style: {
        minHeight: TOUCH,
        justifyContent: "center",
        paddingHorizontal: 12,
        borderRadius: 8,
        backgroundColor: active ? "#233147" : "#EFE9E1",
      },
    },
    React.createElement(Text, { style: { color: active ? "white" : "#18202A", fontWeight: "700" } }, label),
  );
}

function textInput(label: string, value: string, onChangeText: (value: string) => void, accessibilityLabel: string) {
  return React.createElement(TextInput, {
    accessibilityLabel,
    onChangeText,
    placeholder: label,
    style: { ...BASE_INPUT_STYLE, flex: 1 },
    value,
  });
}

function buildLocalDraft(canonicalUrl: string): PicklogDraft {
  const source_type = inferLocalSourceType(canonicalUrl);
  if (source_type === "shopping_url") {
    return {
      schema_version: SCHEMA_VERSION,
      title: "무선 스탠드 조명",
      summary: "침실이나 책상에 둘 수 있는 충전식 조명 후보",
      source_type,
      category: "인테리어",
      use_case: "침실 조명 후보",
      tags: ["조명", "침실", "선물후보"],
      source_url: canonicalUrl,
      thumbnail_url: null,
      confidence: 0.82,
      field_confidence: { title: 0.92, seller: 0.74, price: 0.48 },
      needs_review: ["seller", "price"],
      extraction_notes: "가격은 페이지 옵션에 따라 달라질 수 있어 확인 필요",
      metadata: {
        kind: "shopping",
        seller: "Example Store",
        brand: null,
        product_name: "무선 스탠드 조명",
        price: 59000,
        currency: "KRW",
        purchase_intent: "compare",
        needs_review: ["seller", "price"],
      },
    };
  }
  return {
    schema_version: SCHEMA_VERSION,
    title: "읽어볼 생활 팁",
    summary: "나중에 다시 찾기 위해 저장한 공개 글",
    source_type,
    category: source_type === "recipe_url" ? "요리" : "생활",
    use_case: "주말에 다시 확인",
    tags: source_type === "recipe_url" ? ["레시피", "저녁"] : ["생활팁", "읽을거리"],
    source_url: canonicalUrl,
    thumbnail_url: null,
    confidence: 0.86,
    field_confidence: { title: 0.9, category: 0.84 },
    needs_review: [],
    extraction_notes: "공개 메타데이터와 visible text excerpt만 사용",
    metadata: articleLikeMetadata(source_type),
  };
}

function articleLikeMetadata(source_type: SourceType): PicklogDraft["metadata"] {
  if (source_type === "recipe_url") return { kind: "recipe", dish_name: "간단 저녁 레시피", needs_review: [] };
  if (source_type === "youtube_url" || source_type === "instagram_url") {
    return {
      kind: "video",
      platform: source_type === "youtube_url" ? "YouTube" : "Instagram",
      video_title: "저장한 영상",
      needs_review: [],
    };
  }
  return { kind: "article", site_name: "Example", article_title: "읽어볼 생활 팁", topics: ["생활"], needs_review: [] };
}

function buildReviewState(draft: PicklogDraft): Record<string, FieldState> {
  const state: Record<string, FieldState> = {};
  for (const field of ["title", "category", "use_case", "tags", ...draft.needs_review]) {
    state[field] = draft.needs_review.includes(field) ? "needs_review" : "ai_draft";
  }
  return state;
}

function inferLocalSourceType(url: string): SourceType {
  const host = new URL(url).hostname.toLowerCase();
  if (host.includes("youtube.com") || host.includes("youtu.be")) return "youtube_url";
  if (host.includes("instagram.com")) return "instagram_url";
  if (host.includes("recipe") || host.includes("cook")) return "recipe_url";
  if (host.includes("shop") || host.includes("store") || host.includes("mall")) return "shopping_url";
  return "article_url";
}

function makeUiError(
  error_code: ExtractUrlError["error_code"],
  retryable: boolean,
  manual_save_allowed: boolean,
): ExtractUrlError {
  return {
    status: "error",
    request_id: "ui-local",
    error_code,
    retryable,
    manual_save_allowed,
    message_key: `ui.${error_code}`,
  };
}

function splitTags(value: string): string[] {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function formatFieldState(state: Record<string, FieldState>): string {
  return Object.entries(state)
    .map(([field, value]) => `${field}=${value}`)
    .join(", ");
}

function metadataSummary(draft: PicklogDraft): string {
  const metadata = draft.metadata;
  if (metadata.kind === "shopping")
    return `${metadata.seller ?? "seller unknown"} · ${metadata.price ?? "price unknown"}`;
  if (metadata.kind === "recipe") return metadata.dish_name ?? "recipe";
  if (metadata.kind === "video") return `${metadata.platform} · ${metadata.video_title ?? "video"}`;
  if (metadata.kind === "article") return `${metadata.site_name ?? "site"} · ${metadata.article_title ?? "article"}`;
  return metadata.kind;
}

function variantLabel(sourceType: SourceType): string {
  if (sourceType === "shopping_url") return "Shopping";
  if (sourceType === "recipe_url") return "Recipe";
  if (sourceType === "youtube_url" || sourceType === "instagram_url") return "Video";
  if (sourceType === "article_url") return "Article";
  return "Unknown";
}

function numberOrUndefined(value: string): number | undefined {
  const next = Number(value);
  return Number.isFinite(next) && value.trim() ? next : undefined;
}
