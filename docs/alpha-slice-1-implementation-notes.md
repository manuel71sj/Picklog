# Alpha Slice 1 Implementation Notes

작성일: 2026-06-07

## 구현된 범위

- E01 프로젝트 골격: root package, shared package, Expo app skeleton, Supabase Edge Function skeleton, verification scripts.
- E02 데이터 모델: `items`, `extractions`, `price_observations`, `attachments`, `sync_queue`, `usage_events` SQLite migration and in-memory domain store.
- E03 URL parser와 안전 게이트: scheme, userinfo, sensitive query, localhost/private/link-local/metadata IP, DNS result, redirect chain, content-type, size, timeout envelope.
- E04 `/extract-url` 계약: request hash, idempotency lifecycle, conflict/in-progress handling, normalized error envelope.
- E05 metadata/AI boundary: script-free metadata parsing, AI payload allowlist, 8KB visible text limit, 16KB payload limit, raw output expiry.
- E06 `picklog_item_v1`: variant validator, source_type/kind mapping, low-confidence price/seller review invariant.
- E07-E11 local behavior contracts: manual save path, draft save conversion, field states, list/search/filter, archive/delete/restore/permanent delete and scrub.
- E13 Alpha dataset: 30-row fixture and eval thresholds for search, safety, must-hit fields, and review labels.

## 검증 증거

```bash
node --experimental-strip-types --test tests/*.test.ts
```

현재 통과 테스트:

- URL 안전 게이트와 fetch envelope
- `/extract-url` 안전 차단, 성공, schema invalid 오류
- idempotency duplicate/conflict
- `picklog_item_v1` validation
- field state 저장 규칙
- draft/manual store, sync_queue 민감 필드 제거
- archive/delete/search visibility
- permanent delete cascade and usage scrub
- raw output 7일 cleanup
- 30개 Alpha dataset eval

## 패키지/품질 도구

- 패키지 매니저는 `pnpm`으로 고정한다.
- workspace 범위는 `pnpm-workspace.yaml`의 `apps/*`, `packages/*`다.
- lint/formatter는 Biome을 사용한다.
- `pnpm run check`는 Biome 통합 검사, `pnpm run format`은 formatter 적용이다.

## 남은 런타임 검증

- `pnpm install` 후 `pnpm run check` 실행.
- Expo 의존성 설치 후 실제 iOS/Android 화면 실행.
- `expo-sqlite` 연결 repository 구현 또는 현재 shared store를 SQLite adapter에 연결.
- Supabase local serving and deploy check.
- AI provider 선택, no-training/retention 정책 확인, 실제 structured output adapter 연결.
- Office Hours OH-1부터 OH-6의 실제 사용자 답변 반영.
