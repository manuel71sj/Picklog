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
- 링크 입력, 추출 상태, 확인/수정, 수동 저장 fallback, 리스트/검색/필터, 상세/아카이브/삭제/복원/영구 삭제, 개인정보 고지를 포함한 Expo 모바일 Alpha 화면
- `/extract-url`용 Supabase Edge Function skeleton
- Alpha Slice 1 테이블용 SQLite schema migration
- Office Hours 구현 가정과 내부 Alpha 관찰 체크리스트

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

이 머신에서는 `pnpm`이 기본 PATH에 없을 수 있습니다. 그 경우 현재 확인된 바이너리를 직접 사용할 수 있습니다.

```bash
/Users/manuel71/Library/pnpm/.tools/pnpm-exe/10.33.0/pnpm run verify
```

Lint와 formatter는 Biome을 사용합니다.

```bash
pnpm run check
pnpm run format
```

## 모바일 앱 실행

Expo Go를 사용할 수 없는 지역이나 환경에서는 QR 코드로 Expo Go를 여는 대신 로컬 네이티브 개발 빌드로 실행합니다.

```bash
pnpm install
pnpm run mobile:ios
```

Android 에뮬레이터나 연결된 Android 기기에서는 다음 명령을 사용합니다.

```bash
pnpm run mobile:android
```

이미 개발 빌드가 설치되어 있고 Metro 서버만 다시 띄우려면 다음 명령을 사용합니다.

```bash
pnpm run mobile:dev-client
```

`pnpm`이 PATH에 없다면 이 머신의 pnpm 바이너리를 직접 사용할 수 있습니다.

```bash
/Users/manuel71/Library/pnpm/.tools/pnpm-exe/10.33.0/pnpm run mobile:ios
```

### iOS Simulator 로그 참고

`pnpm run mobile:ios` 실행 중 `Build Succeeded`, `Opening on iPhone ...`, `iOS Bundled ...`가 출력된 뒤 다음 로그가 반복될 수 있습니다.

```text
CoreHaptics ... Failed to read pattern library data
UIKitCore ... Error creating CHHapticPattern
```

이 메시지는 iOS Simulator의 키보드/햅틱 피드백 관련 시스템 로그이며, 앱 빌드 실패나 JavaScript 번들 오류가 아닙니다. 앱 화면이 열리고 Metro가 `iOS Bundled ...`를 출력했다면 실행은 성공한 상태입니다.

## 런타임 참고

Supabase Edge Function은 의도적으로 AI provider를 설정하지 않은 상태로 둡니다. Beta 전에 provider policy가 승인되기 전까지 이 function은 server-only AI boundary를 유지하고, AI extraction을 사용할 수 없을 때 normalized failure path를 반환합니다.

Expo 화면은 현재 Alpha 계약을 검증하기 위한 로컬 우선 UI입니다. 실제 iOS/Android 런타임 QA와 `expo-sqlite` adapter 연결은 Beta 전환 전 별도 런타임 검증으로 남깁니다.
