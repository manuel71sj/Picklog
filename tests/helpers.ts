import { SCHEMA_VERSION, type PicklogDraft } from "../packages/shared/src/index.ts";

export function shoppingDraft(overrides: Partial<PicklogDraft> = {}): PicklogDraft {
  return {
    schema_version: SCHEMA_VERSION,
    title: "무선 스탠드 조명",
    summary: "침실이나 책상에 둘 수 있는 충전식 조명 후보",
    source_type: "shopping_url",
    category: "인테리어",
    use_case: "침실 조명 후보",
    tags: ["조명", "침실", "선물후보"],
    source_url: "https://store.example.com/lamp",
    thumbnail_url: "https://store.example.com/lamp.jpg",
    confidence: 0.82,
    field_confidence: {
      title: 0.92,
      seller: 0.74,
      price: 0.48
    },
    needs_review: ["seller", "price"],
    extraction_notes: "가격은 페이지 내 옵션에 따라 달라질 수 있어 확인 필요",
    metadata: {
      kind: "shopping",
      seller: "Example Store",
      brand: null,
      product_name: "무선 스탠드 조명",
      price: 59000,
      currency: "KRW",
      purchase_intent: "compare",
      needs_review: ["seller", "price"]
    },
    ...overrides
  };
}
