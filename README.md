# Picklog

Picklog는 링크를 저장하고 검색 가능한 개인 지식 항목으로 바꾸는 로컬 우선 모바일 앱입니다.

이 저장소는 현재 다음 문서에 정의된 Alpha Slice 1 계약을 구현합니다.

- `docs/PRD.md`
- `docs/functional-spec-alpha-slice-1.md`
- `docs/implementation-todo-alpha-slice-1.md`

## 현재 Alpha Slice

구현된 범위:

- `packages/shared`의 공통 TypeScript 도메인 패키지
- URL 검증과 서버 측 안전 게이트 기본 기능
- `/extract-url` 요청, 오류, idempotency, metadata, AI boundary 계약
- `picklog_item_v1` schema validator
- 로컬 우선 item, extraction, price observation, sync queue, usage event, archive/delete/restore/permanent-delete 모델
- Raw AI output 7일 cleanup
- 30개 row Alpha dataset과 eval runner
- 공통 URL/store 계약을 사용하는 Expo 모바일 앱 skeleton
- `/extract-url`용 Supabase Edge Function skeleton
- Alpha Slice 1 테이블용 SQLite schema migration

## 검증

현재 저장소는 Node 24의 built-in TypeScript stripping으로 검증합니다. 따라서 패키지 설치 전에도 core를 실행할 수 있습니다.

```bash
node --experimental-strip-types --test tests/*.test.ts
```

패키지 설치 없이 syntax check를 실행하는 방법:

```bash
for f in packages/shared/src/*.ts tests/*.ts apps/mobile/src/*.ts supabase/functions/extract-url/*.ts; do
  node --experimental-strip-types --check "$f" || exit 1
done
```

workspace package manager는 pnpm입니다. pnpm과 의존성을 설치한 뒤에는 다음 명령을 사용합니다.

```bash
pnpm install
pnpm run verify
```

Lint와 formatter는 Biome을 사용합니다.

```bash
pnpm run check
pnpm run format
```

## 런타임 참고

첫 구현 pass에 사용한 로컬 머신에는 `node`만 있고 `pnpm`, `npm`, `corepack`, `tsc`가 없었습니다. 그래서 해당 pass에서는 dependency installation, Biome execution, Expo native launch, Supabase local serving을 실행하지 못했습니다.

Supabase Edge Function은 의도적으로 AI provider를 설정하지 않은 상태로 둡니다. Beta 전에 provider policy가 승인되기 전까지 이 function은 server-only AI boundary를 유지하고, AI extraction을 사용할 수 없을 때 normalized failure path를 반환합니다.
