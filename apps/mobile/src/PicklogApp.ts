import React, { useMemo, useState } from "react";
import { SafeAreaView, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { PicklogStore, SCHEMA_VERSION, validateClientUrl, type ItemRecord } from "../../../packages/shared/src/index.ts";

const TOUCH = 44;

export function PicklogApp() {
  const store = useMemo(() => new PicklogStore(), []);
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ItemRecord[]>([]);
  const [query, setQuery] = useState("");

  const saveManual = () => {
    const safety = validateClientUrl(url);
    if (!safety.ok) {
      setError("This link cannot be saved because it failed URL validation.");
      return;
    }
    store.saveManual({
      device_id: "alpha-device",
      source_url: safety.canonical_url,
      source_type: "unknown",
      title: safety.canonical_url,
      category: "inbox",
      use_case: "saved for later",
      tags: ["manual"]
    });
    setItems(store.search({ query }));
    setUrl("");
    setError(null);
  };

  const validateOnly = () => {
    const safety = validateClientUrl(url);
    if (!safety.ok) {
      setError(safety.reason);
      return;
    }
    setError(`Ready for ${SCHEMA_VERSION} extraction: ${safety.canonical_url}`);
  };

  const visible = query ? store.search({ query }) : items;

  return React.createElement(
    SafeAreaView,
    { style: { flex: 1, backgroundColor: "#FAF8F4" } },
    React.createElement(
      ScrollView,
      { contentContainerStyle: { padding: 20, gap: 16 } },
      React.createElement(Text, { style: { fontSize: 28, fontWeight: "700", color: "#18202A" } }, "Picklog"),
      React.createElement(TextInput, {
        accessibilityLabel: "Link input",
        accessibilityHint: "Paste a public http or https link to extract or save manually",
        autoCapitalize: "none",
        multiline: true,
        onChangeText: setUrl,
        placeholder: "https://example.com/item",
        style: { minHeight: 88, borderWidth: 1, borderColor: "#C9C2B8", padding: 12, borderRadius: 8, backgroundColor: "white" },
        value: url
      }),
      error
        ? React.createElement(
            Text,
            { accessibilityLiveRegion: "polite", style: { color: error.startsWith("Ready") ? "#265A3A" : "#A13A2A" } },
            error
          )
        : null,
      React.createElement(
        View,
        { style: { flexDirection: "row", gap: 12 } },
        React.createElement(
          TouchableOpacity,
          {
            accessibilityLabel: "Validate link",
            accessibilityHint: "Checks URL format before server extraction",
            onPress: validateOnly,
            style: { minHeight: TOUCH, justifyContent: "center", paddingHorizontal: 16, borderRadius: 8, backgroundColor: "#233147" }
          },
          React.createElement(Text, { style: { color: "white", fontWeight: "700" } }, "Validate")
        ),
        React.createElement(
          TouchableOpacity,
          {
            accessibilityLabel: "Manual save",
            accessibilityHint: "Saves a safe URL without AI extraction",
            onPress: saveManual,
            style: { minHeight: TOUCH, justifyContent: "center", paddingHorizontal: 16, borderRadius: 8, backgroundColor: "#E7DED2" }
          },
          React.createElement(Text, { style: { color: "#18202A", fontWeight: "700" } }, "Manual Save")
        )
      ),
      React.createElement(TextInput, {
        accessibilityLabel: "Search saved items",
        onChangeText: (text: string) => {
          setQuery(text);
          setItems(store.search({ query: text }));
        },
        placeholder: "Search title, category, tags, seller",
        style: { minHeight: TOUCH, borderWidth: 1, borderColor: "#C9C2B8", padding: 12, borderRadius: 8, backgroundColor: "white" },
        value: query
      }),
      React.createElement(
        View,
        { style: { gap: 10 } },
        ...visible.map((item) =>
          React.createElement(
            View,
            { key: item.local_id, style: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#E4DDD3" } },
            React.createElement(
              Text,
              { numberOfLines: 2, style: { fontSize: 16, fontWeight: "700", color: "#18202A" } },
              item.title
            ),
            React.createElement(Text, { style: { color: "#5D6670" } }, `${item.category ?? "uncategorized"} · ${item.source_type}`)
          )
        )
      )
    )
  );
}
