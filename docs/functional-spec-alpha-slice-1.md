# Picklog Functional Spec: Alpha Slice 1

작성일: 2026-06-07
상태: Draft v1
대상: iOS/Android 모바일 앱 첫 구현 슬라이스
소스 PRD: `docs/PRD.md`
검토 근거: PRD 리뷰 결정과 테스트 기준은 이 문서 본문에 통합되어 있다.

## 1. 목적

이 문서는 Picklog의 첫 번째 구현 슬라이스를 구현 가능한 기능 명세로 고정한다.

첫 슬라이스의 사용자 약속은 다음이다.

> 사용자가 앱 안에서 링크를 붙여넣으면, Picklog가 안전하게 메타데이터와 AI 초안을 만들고, 사용자가 확인/수정 후 저장하며, 저장한 항목을 리스트와 검색에서 다시 찾을 수 있다.

이 문서는 제품 코드를 구현하지 않는다. 구현 전에 화면, 상태, 데이터, AI 추출, URL 안전, 삭제/보존, 테스트 기준을 고정한다.

## 2. 첫 빌드 슬라이스

### 2.1 핵심 흐름

```text
링크 붙여넣기
  -> URL 형식 검사
  -> 서버 URL 안전 게이트
  -> 공개 메타데이터 수집
  -> AI 구조화 추출
  -> 사용자 확인/수정
  -> 로컬 저장
  -> 리스트/검색에서 재발견
```

### 2.2 첫 슬라이스의 성공 기준

- 사용자가 앱 내부 입력창에 링크를 붙여넣을 수 있다.
- 안전하지 않은 URL은 외부 fetch 전에 차단된다.
- 지원 가능한 URL은 공개 메타데이터와 AI 추출로 `picklog_item_v1` 초안을 만든다.
- 사용자는 AI 초안의 필드를 확인하고 수정할 수 있다.
- AI 실패, 메타데이터 실패, 낮은 신뢰도 상황에서도 수동 저장 경로가 있다.
- 저장한 항목은 로컬 DB에 저장되고 리스트에 즉시 보인다.
- 저장한 항목은 제목, 카테고리, 사용 목적, 태그, 판매처, 가격, 출처 타입으로 검색/필터링할 수 있다.
- 삭제/아카이브 상태가 검색 결과에 올바르게 반영된다.

### 2.3 첫 슬라이스 구현 토폴로지

첫 슬라이스의 구현 기준은 다음으로 고정한다.

| 계층 | 선택 | 이유 |
| --- | --- | --- |
| 모바일 앱 | React Native + Expo | PRD의 기본 후보이며 iOS/Android 첫 빌드 속도와 SQLite/이미지/공유 시트 Beta spike 연결성이 좋다. |
| 로컬 저장 | SQLite | 로컬 우선 저장과 검색/필터를 첫 슬라이스에서 검증하기에 충분하다. |
| 추출 서버 | Supabase Edge Function | URL fetch와 AI provider key를 앱 밖에 두고, Beta 동기화/Storage 후보와 맞물린다. |
| AI 호출 | 추출 서버에서만 호출 | provider key, URL 안전, 스키마 검증 책임을 서버 경계에 둔다. |

이 문서의 구현 준비 상태는 위 토폴로지를 전제로 한다. React Native + Expo 또는 Supabase Edge Function을 바꾸려면 구현 전에 별도 ADR을 작성하고, 공유 시트, SQLite, URL 안전 게이트, AI provider key 보관, App Store/Play Store 심사 영향이 동등하게 해결됨을 보여야 한다.

사진 슬라이스 확장 경로:

- 첫 슬라이스는 link-only지만, 다음 사진 슬라이스는 같은 `items` 테이블에 `source_type=photo`를 추가한다.
- `metadata_json.kind=photo` variant는 `photo_count`, `dominant_labels`, `detected_text`, `capture_context`, `needs_review`를 가진다.
- 사진 원본과 썸네일은 `attachments`가 소유하고, `items.image_asset_id`는 대표 attachment를 가리킨다.
- 사진 슬라이스는 URL 안전 게이트를 거치지 않지만, AI 전송 데이터 최소화와 field provenance 규칙은 동일하게 적용한다.

## 3. 범위

### 3.1 포함

- 앱 내부 링크 붙여넣기 입력
- URL 형식 검사
- 서버 URL 안전 게이트
- URL 타입 분류
- 공개 메타데이터 사전 수집
- AI 구조화 추출
- AI 출력 스키마 검증
- 확인/수정 화면
- 수동 저장 fallback
- 로컬 DB 저장
- 저장함 리스트
- 기본 검색과 필터
- 상세 화면
- 아카이브/복원
- 삭제/휴지통/복원/영구 삭제 계약
- Alpha/Beta 전환을 위한 데이터 필드와 상태 계약

### 3.2 제외

- 사진 촬영과 사진첩 이미지 선택 구현
- iOS/Android 공유 시트 수신 구현
- Apple/Google 로그인
- 클라우드 백업/동기화 구현
- 결제와 Pro 권한 enforcement
- 가격 변경 알림
- 자연어 검색
- 유사 이미지 검색
- 여러 사진 한 번에 저장
- 공개 컬렉션, 공유 피드, 팔로우
- 앱 내 직접 결제형 커머스

### 3.3 제외하지만 계약에 반영하는 항목

| 항목 | 첫 슬라이스 구현 | 계약 반영 방식 |
| --- | --- | --- |
| 사진 저장 | 제외 | `attachments`, `image_asset_id`, `thumbnail_url` 필드 유지 |
| 공유 시트 | 제외 | Beta payload shape와 spike 기준 정의 |
| 로그인/동기화 | 제외 | `local_id`, `remote_id`, `device_id`, `sync_state`, `version`, `tombstone_until` 유지 |
| Pro/AI 사용량 | 결제 제외 | 로컬 `usage_events` 또는 usage counter 계약 유지 |
| 클라우드 백업 | 제외 | 로컬 데이터 모델이 서버 동기화로 확장 가능해야 함 |

## 4. 사용자 흐름

### 4.1 정상 링크 저장

1. 사용자가 홈 화면의 입력창에 URL을 붙여넣는다.
2. 앱이 URL 형식을 검사한다.
3. 앱이 서버 추출 요청을 보낸다.
4. 서버가 URL 안전 게이트를 통과시킨다.
5. 서버가 공개 메타데이터를 수집한다.
6. 서버가 AI 구조화 추출을 실행한다.
7. 서버가 `picklog_item_v1` 스키마를 검증한다.
8. 앱이 확인/수정 화면을 표시한다.
9. 사용자가 필요한 필드를 수정하고 저장한다.
10. 항목이 로컬 DB에 저장된다.
11. 앱이 저장 완료 상태와 상세 보기/계속 저장 액션을 보여준다.
12. 저장 항목은 리스트와 검색에 즉시 반영된다.

### 4.2 낮은 신뢰도 링크 저장

1. AI가 가격, 판매처, 카테고리 같은 일부 필드를 낮은 신뢰도로 반환한다.
2. 앱은 해당 필드를 "확인 필요"로 표시한다.
3. 사용자는 확인 필요 필드를 수정하거나 비워둘 수 있다.
4. 저장 시 확인 필요 상태와 사용자 확정 상태가 구분되어 저장된다.

### 4.3 AI 실패 후 수동 저장

1. URL 안전 게이트는 통과했지만 메타데이터 수집 또는 AI 추출이 실패한다.
2. 앱은 실패 원인을 짧게 보여준다.
3. 사용자는 재시도하거나 수동 저장을 선택한다.
4. 링크 수동 저장 최소 필드는 `source_url`, `title`, `source_type`이다.
5. 사용자는 선택적으로 카테고리, 태그, 메모를 입력한다.
6. 저장하면 항목은 리스트와 검색에 반영된다.

### 4.4 안전하지 않은 URL

1. URL이 `http`/`https`가 아니거나, 안전 게이트에서 차단된다.
2. 앱은 "이 링크는 안전 검사를 통과하지 못해 자동으로 불러올 수 없습니다" 류의 메시지를 보여준다.
3. 서버는 차단된 URL의 본문을 fetch하지 않는다.
4. 사용자는 다른 링크를 입력할 수 있다.
5. 차단 URL은 수동 저장 항목으로 만들 수 없다.

### 4.5 클라이언트/서버/AI 경계

첫 슬라이스는 앱이 URL 본문을 직접 fetch하거나 AI provider를 직접 호출하지 않는다. URL 안전, 공개 메타데이터 수집, AI 호출, 스키마 검증은 서버 경계 안에서 수행한다.

```text
Mobile app
  - URL 입력과 형식 검사
  - 추출 요청 생성
  - AI 초안 표시
  - 사용자 수정/확정
  - 로컬 DB 저장
  - 리스트/검색/삭제 상태 관리
        |
        | POST /extract-url { url, device_id, request_id }
        v
Extraction server boundary
  - URL safety gate
  - redirect/IP/content-type/size/timeout 제한
  - 공개 메타데이터 fetch
  - 페이지 텍스트를 데이터로만 취급
  - AI provider 호출
  - picklog_item_v1 schema validation
        |
        | constrained prompt + metadata snapshot
        v
AI provider
  - 구조화 초안 생성
  - confidence, field_confidence, needs_review 반환

AI provider output
        |
        v
Extraction server boundary
  - raw output 7일 보존 정책 적용
  - invalid schema 차단
  - normalized_output_json 반환
        |
        | 200 draft / 4xx unsafe / 5xx retryable
        v
Mobile app
```

경계별 금지 사항:

| 경계 | 금지 |
| --- | --- |
| Mobile app | 서버 안전 게이트 없이 URL 본문 fetch 금지 |
| Mobile app | AI provider API key 보관 또는 직접 호출 금지 |
| Extraction server | 안전 차단 URL의 본문 fetch 금지 |
| Extraction server | 페이지 텍스트를 시스템 지시로 취급 금지 |
| AI provider | 사용자 확정값을 직접 쓰기 금지 |

경계별 책임:

| 경계 | 책임 |
| --- | --- |
| Mobile app | 사용자 입력, 확인/수정, 로컬 저장, 리스트/검색, 삭제 UX |
| Extraction server | SSRF 방어, 메타데이터 fetch 제한, AI 호출, 스키마 검증, 오류 정규화 |
| AI provider | 제한된 입력에서 구조화 초안 생성 |

### 4.6 `/extract-url` API 계약

요청:

```json
{
  "request_id": "uuid",
  "device_id": "uuid",
  "url": "https://example.com/item",
  "client_schema_version": "picklog_item_v1"
}
```

요청 규칙:

- `request_id`는 클라이언트가 생성하며 같은 URL 재시도 dedupe에 사용한다.
- 서버는 정규화된 `url`과 `client_schema_version`으로 `request_hash`를 계산한다.
- 같은 `device_id + request_id + request_hash` 요청은 cacheable lifecycle 상태에서 같은 normalized response를 반환해야 한다.
- 같은 `device_id + request_id`가 다른 `request_hash`와 함께 재사용되면 서버는 fetch를 수행하지 않고 `idempotency_conflict`를 반환한다.
- `url`은 클라이언트 형식 검사 후 전송하지만, 서버가 다시 URL 안전 게이트를 수행한다.
- 요청 body에는 사용자 메모, 기존 저장 항목, cookie/header/session 값을 넣지 않는다.

Idempotency lifecycle:

| 상태 | 캐시 여부 | 같은 key/hash 재시도 |
| --- | --- | --- |
| `in_progress` | 예 | fetch/AI를 중복 실행하지 않고 `idempotency_in_progress` 반환 |
| `terminal_success` | 예 | 같은 draft response 반환 |
| `terminal_nonretryable_error` | 예 | 같은 error response 반환 |
| `retryable_error_not_cached` | 아니오 | 같은 `request_id`로 실제 재시도 실행 |

`fetch_timeout`, `metadata_failed`, `ai_timeout`, `schema_invalid`는 `retryable_error_not_cached`다. 재시도는 같은 `request_id`와 같은 `request_hash`를 사용하되, 서버가 이전 retryable error를 cached terminal response처럼 재생하지 않는다.

성공 응답:

```json
{
  "status": "draft",
  "request_id": "uuid",
  "schema_version": "picklog_item_v1",
  "canonical_url": "https://example.com/item",
  "canonical_origin": "https://example.com",
  "fetch_summary": {
    "content_type": "text/html",
    "final_url": "https://example.com/item",
    "redirect_count": 0,
    "body_truncated": false
  },
  "draft": {
    "title": "string",
    "source_type": "shopping_url",
    "category": "string",
    "use_case": "string",
    "tags": [],
    "metadata": {},
    "confidence": 0.82,
    "field_confidence": {},
    "needs_review": []
  }
}
```

오류 응답:

```json
{
  "status": "error",
  "request_id": "uuid",
  "error_code": "unsafe_url",
  "retryable": false,
  "manual_save_allowed": false,
  "message_key": "url.unsafe"
}
```

허용 `error_code`:

| 코드 | retryable | manual_save_allowed |
| --- | --- | --- |
| `invalid_url` | false | false |
| `unsafe_url` | false | false |
| `sensitive_url` | false | false |
| `fetch_timeout` | true | true |
| `response_too_large` | false | true |
| `unsupported_content_type` | false | true |
| `metadata_failed` | true | true |
| `ai_timeout` | true | true |
| `schema_invalid` | true | true |
| `idempotency_conflict` | false | false |
| `idempotency_in_progress` | true | false |

클라이언트는 `manual_save_allowed=false`인 오류에서 수동 저장 폼을 보여주지 않는다. `retryable=true` 오류는 재시도 버튼을 보여주되, 같은 `request_id`로 재시도한다.

## 5. 화면과 상태

### 5.1 화면 목록

| 화면 | 목적 | 주요 액션 |
| --- | --- | --- |
| 홈/링크 입력 | 링크를 빠르게 붙여넣고 추출 시작 | 붙여넣기, 추출 시작, 최근 저장 보기 |
| 추출 진행 | 사용자가 기다리는 중임을 이해 | 취소, 상태 확인 |
| 확인/수정 | AI 초안을 신뢰 가능하게 정리 | 필드 수정, 재시도, 저장 |
| 저장 완료 | 저장 결과 확인 | 상세 보기, 계속 저장 |
| 저장함 리스트 | 저장 항목 훑기 | 검색, 필터, 정렬, 항목 열기 |
| 상세 | 저장 항목 확인/편집 | 원본 링크 열기, 메모 수정, 아카이브, 삭제 |
| 휴지통 | 삭제 항목 복원 또는 영구 삭제 | 복원, 영구 삭제 |

### 5.2 화면/상태 매트릭스

| 상태 | 트리거 | 사용자에게 보여줄 것 | 허용 액션 | 저장/부작용 | 테스트 |
| --- | --- | --- | --- | --- | --- |
| 입력 대기 | 홈 진입 | 링크 입력창, 최근 저장 일부 | 붙여넣기, 추출 시작 | 없음 | 빈 입력, 잘못된 입력 |
| URL 형식 오류 | URL parser 실패 | 잘못된 링크 안내 | 수정, 다시 붙여넣기 | 없음 | `ftp:`, 빈 문자열 |
| 추출 준비 | 형식 통과 | 진행 표시 | 취소 | 요청 시작 | 취소 후 입력 화면 복귀 |
| URL 안전 차단 | SSRF/redirect/IP 차단 | 안전상 자동 불러오기 불가 | 다른 링크 입력 | 서버 fetch 금지 | private IP, redirect |
| 메타데이터 수집 중 | 안전 게이트 통과 | 진행 표시 | 취소 | fetch 제한 적용 | timeout, size limit |
| 지원하지 않는 content type | `unsupported_content_type` | 자동 추출 불가 안내 | 수동 저장, 다른 링크 입력 | fetch 요약만 기록 | unsupported content type |
| fetch timeout | `fetch_timeout` | 시간이 초과되었다는 안내 | 재시도, 수동 저장 | retryable error 기록 | timeout retry |
| oversized response | `response_too_large` | 페이지가 너무 커 자동 분석 불가 안내 | 수동 저장, 다른 링크 입력 | body 저장 금지, fetch 요약만 기록 | 2MB limit |
| AI 추출 중 | metadata 준비 | 진행 표시 | 취소 | AI request 기록 | cancel behavior |
| AI 스키마 실패 | schema invalid | AI 초안 생성 실패 | 재시도, 수동 저장 | error 기록 | malformed JSON |
| 재시도 소진 | 동일 request 3회 retryable error | 자동 분석이 반복 실패했다는 안내 | 수동 저장, 다른 링크 입력 | retry count 기록 | retry exhausted |
| 낮은 신뢰도 | `needs_review` 존재 | 확인 필요 필드 강조 | 수정, 저장, 재추출 | draft 저장 전 유지 | seller/price uncertainty |
| 일부 필드 실패 | optional 필드 누락 | 누락 사유 또는 빈 필드 | 수정, 저장 | 누락 필드 optional | missing price |
| 확인 가능 | schema valid | 핵심 필드와 출처 정보 | 수정, 저장, 재추출 | 저장 전 draft | happy path |
| 수동 저장 | AI/fetch 실패 후 선택 | 최소 입력 폼 | 저장, 취소 | manual item 생성 | manual save |
| 저장 완료 | 로컬 DB write 성공 | 저장 요약 | 상세 보기, 계속 저장 | item/extraction 생성 | search immediate |
| 저장 실패 | DB write 실패 | 저장 실패와 재시도 안내 | 재시도, 취소 | partial write rollback | rollback |

### 5.3 확인/수정 화면 필드 그룹

| 그룹 | 필드 | 표시 규칙 |
| --- | --- | --- |
| 핵심 | 제목, 카테고리, 사용 목적, 태그 | 저장 전 가장 먼저 보인다. |
| 출처 | 원본 URL, 출처 타입, 썸네일, 추출 시각 | 사용자가 원본과 AI 추출 근거를 확인할 수 있어야 한다. |
| 쇼핑 추정값 | 판매처, 브랜드, 상품명, 가격, 통화, 구매 의도 | 낮은 신뢰도면 "확인 필요"를 붙인다. |
| 레시피 추정값 | 요리명, 재료, 조리 시간, 난이도, 식사 타입 | 누락 가능 필드는 빈 값 허용. |
| 영상 추정값 | 크리에이터, 플랫폼, 영상 제목, 저장 이유 | 플랫폼 제한으로 누락될 수 있음을 허용. |
| 메모 | 사용자 메모 | AI와 무관한 사용자 입력으로 저장한다. |

### 5.4 모바일 UX와 접근성 기준

- 링크 입력은 키보드 paste와 시스템 clipboard paste를 모두 지원한다.
- 긴 URL은 한 줄로 화면 밖을 밀지 않는다. 입력/확인/상세 화면에서는 중간 ellipsis 또는 줄바꿈을 적용한다.
- 긴 제목과 상품명은 리스트에서 최대 2줄, 상세/확인 화면에서는 줄바꿈으로 전체 확인 가능해야 한다.
- 모든 주요 액션 버튼의 터치 영역은 최소 44x44pt다.
- 추출 진행, 안전 차단, 재시도 가능 오류, 확인 필요 필드는 VoiceOver/TalkBack label을 가진다.
- 아이콘만 있는 액션은 접근성 label과 hint를 가진다.
- 작은 화면에서는 필터가 가로 overflow 없이 bottom sheet 또는 compact segmented control로 열린다.
- 확인 필요 필드는 색상만으로 구분하지 않고 텍스트 label도 함께 제공한다.

## 6. 데이터 계약

### 6.1 공통 원칙

- 로컬 우선으로 저장한다.
- 모든 주요 레코드는 안정적인 `local_id`를 가진다.
- Alpha에서는 `remote_id`가 비어 있을 수 있다.
- Beta 확장을 위해 sync 관련 필드를 처음부터 둔다.
- AI 출력은 초안이며, 사용자 확정값과 구분되어야 한다.
- 삭제와 보존 정책은 첫 구현부터 테스트 가능해야 한다.

정규 소유권:

| 데이터 | 정규 소유자 | 변경 가능성 |
| --- | --- | --- |
| 사용자가 보는 저장 항목 | `items` | 사용자 수정 가능. 리스트/검색/상세 화면의 source of truth다. |
| AI 추출 원본과 검증 결과 | `extractions` | immutable audit snapshot. 사용자 수정으로 갱신하지 않는다. |
| 가격 관측 이력 | `price_observations` | 관측 이벤트 append-only. 사용자가 확정한 가격도 새 관측으로 남긴다. |
| 이미지/사진 참조 | `attachments` | 파일과 item 연결의 source of truth다. |
| 로컬 변경 이벤트 | `sync_queue` | Alpha에서는 local audit event log다. Beta transport는 별도 ADR/schema에서 결정한다. |

사용자가 AI 초안을 수정하면 `items`와 필요한 `price_observations`만 갱신한다. 기존 `extractions.normalized_output_json`은 "그 시점의 AI 검증 결과"로 남기고, 화면은 항상 `items`를 읽는다.

### 6.2 `items`

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `id` | string/integer | 예 | 로컬 DB 기본키 |
| `local_id` | UUID string | 예 | 기기 내 안정 ID |
| `remote_id` | string nullable | 아니오 | Beta 동기화 후 서버 ID |
| `user_id` | string nullable | 아니오 | Alpha 익명 모드에서는 null |
| `device_id` | string | 예 | 레코드 생성 기기 |
| `sync_state` | enum | 예 | Alpha 기본값 `local_only` |
| `version` | integer | 예 | 로컬 변경마다 증가 |
| `status` | enum | 예 | `active`, `archived`, `deleted`, `permanently_deleted` |
| `source_type` | enum | 예 | `shopping_url`, `youtube_url`, `instagram_url`, `recipe_url`, `article_url`, `photo`, `unknown` |
| `source_url` | string nullable | URL 항목 예 / 사진 항목 아니오 | 원본 URL. `source_type=photo`에서는 비어 있을 수 있다. |
| `title` | string | 예 | 사용자가 이해하는 이름 |
| `summary` | string nullable | 아니오 | 한두 문장 설명 |
| `category` | string nullable | 아니오 | 표준 카테고리 |
| `use_case` | string nullable | 아니오 | 저장 목적 |
| `tags` | string[] | 예 | 검색용 태그, 기본 빈 배열 |
| `thumbnail_url` | string nullable | 아니오 | 공개 썸네일 또는 로컬 이미지 참조 |
| `image_asset_id` | string nullable | 아니오 | 사진 Alpha 대비 |
| `metadata_json` | object | 예 | source_type별 구조화 필드 |
| `confidence` | number nullable | 아니오 | 전체 AI 신뢰도 |
| `field_confidence_json` | object | 예 | 필드별 AI 신뢰도, 기본 `{}` |
| `field_state_json` | object | 예 | 필드별 `ai_draft`, `needs_review`, `user_confirmed`, `user_empty` 상태 |
| `extraction_id` | string/integer nullable | 아니오 | 마지막 AI 추출 snapshot 참조 |
| `user_note` | string nullable | 아니오 | 사용자 메모 |
| `created_at` | datetime | 예 | 생성 시각 |
| `updated_at` | datetime | 예 | 수정 시각 |
| `archived_at` | datetime nullable | 아니오 | 아카이브 시각 |
| `deleted_at` | datetime nullable | 아니오 | 휴지통 이동 시각 |
| `tombstone_until` | datetime nullable | 아니오 | 삭제 동기화 보존 기한 |

필수 규칙:

- 위 표의 `필수` 값은 `active`, `archived`, `deleted` 상태에 적용한다.
- `source_url`은 URL 기반 `source_type`(`shopping_url`, `youtube_url`, `instagram_url`, `recipe_url`, `article_url`, `unknown`)에만 필수다. `photo` 항목의 원본 참조는 `attachments`와 `image_asset_id`가 소유한다.
- `permanently_deleted` tombstone row는 사용자 콘텐츠 필드의 필수 제약에서 제외된다.
- `permanently_deleted` 상태에서 남는 필드는 아래 canonical tombstone field list와 같다.
- DB schema가 nullable을 허용하지 않는다면 영구 삭제 cascade는 사용자 콘텐츠 필드를 `null` 대신 명시적 scrubbed default로 바꿔야 한다. 예: `title=\"\"`, `tags=[]`, `metadata_json={}`.

Canonical tombstone field list:

| 필드 | 처리 |
| --- | --- |
| `id` | row가 남는 동안 유지 |
| `local_id` | 유지 |
| `remote_id` | nullable로 유지. Alpha에서는 null 가능 |
| `device_id` | 유지 |
| `sync_state` | 유지. Alpha 기본 `local_only` |
| `version` | permanent delete 시 증가 |
| `status` | `permanently_deleted` |
| `created_at` | 유지 |
| `updated_at` | permanent delete 시각으로 갱신 |
| `archived_at` | null로 scrub |
| `deleted_at` | 유지 |
| `tombstone_until` | `now + 30 days` |

### 6.3 `metadata_json`

`metadata_json`은 자유 JSON이 아니라 `source_type`으로 구분되는 variant여야 한다.

```json
{
  "kind": "shopping",
  "seller": "string or null",
  "brand": "string or null",
  "product_name": "string or null",
  "price": 59000,
  "currency": "KRW",
  "price_observed_at": "2026-06-07T00:00:00Z",
  "purchase_intent": "compare",
  "needs_review": ["price", "seller"]
}
```

필수 variant:

- `shopping`
- `recipe`
- `video`
- `article`
- `photo`
- `unknown`

`source_type`과 `metadata_json.kind` 매핑:

| `source_type` | `metadata_json.kind` |
| --- | --- |
| `shopping_url` | `shopping` |
| `recipe_url` | `recipe` |
| `youtube_url` | `video` |
| `instagram_url` | `video` |
| `article_url` | `article` |
| `photo` | `photo` |
| `unknown` | `unknown` |

Kind별 필드:

| kind | 필수 필드 | 선택 필드 |
| --- | --- | --- |
| `shopping` | `seller`, `product_name`, `needs_review` | `brand`, `price`, `currency`, `price_observed_at`, `purchase_intent` |
| `recipe` | `dish_name`, `needs_review` | `ingredients`, `cooking_time_minutes`, `difficulty`, `meal_type` |
| `video` | `platform`, `video_title`, `needs_review` | `creator`, `duration_seconds`, `why_saved` |
| `article` | `site_name`, `article_title`, `needs_review` | `author`, `published_at`, `topics` |
| `photo` | `photo_count`, `needs_review` | `dominant_labels`, `detected_text`, `capture_context` |
| `unknown` | `needs_review` | `raw_title`, `raw_description` |

### 6.4 `extractions`

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `id` | string/integer | 예 | 로컬 DB 기본키 |
| `item_id` | string/integer nullable | 아니오 | 저장 전 draft면 null 가능 |
| `input_type` | enum | 예 | `url` |
| `input_snapshot` | object | 예 | 정규화 URL, 공개 메타데이터 요약, fetch 결과 요약. 원문 HTML body와 민감 query는 저장하지 않는다. |
| `model_provider` | string | 예 | AI 제공자 |
| `model_name` | string | 예 | 모델명 |
| `schema_version` | string | 예 | `picklog_item_v1` |
| `raw_output_json` | object nullable | 아니오 | 기본 7일 보존 후 삭제 |
| `normalized_output_json` | object nullable | 아니오 | 검증된 출력 |
| `confidence` | number nullable | 아니오 | 전체 신뢰도 |
| `error` | string nullable | 아니오 | 실패 원인 |
| `created_at` | datetime | 예 | 생성 시각 |
| `expires_at` | datetime nullable | 아니오 | raw output 만료 시각 |

### 6.5 `price_observations`

쇼핑 항목에서 가격이 추출되었고 사용자에게 표시될 때 생성한다.

| 필드 | 필수 | 설명 |
| --- | --- | --- |
| `item_id` | 예 | 대상 항목 |
| `seller` | 아니오 | 판매처 |
| `price` | 아니오 | 관측 가격 |
| `currency` | 아니오 | 통화 |
| `observed_at` | 예 | 관측 시각 |
| `source` | 예 | `metadata`, `ai`, `user` 중 하나 |

낮은 신뢰도 가격은 `source = ai`여도 `needs_review`가 있어야 하며, 사용자가 확정하기 전까지 확정 가격처럼 표시하지 않는다.

### 6.6 `attachments`

첫 슬라이스는 사진 입력을 구현하지 않지만, 삭제 cascade와 Beta 준비를 위해 최소 테이블 계약을 둔다.

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `id` | string/integer | 예 | 로컬 DB 기본키 |
| `item_id` | string/integer | 예 | 연결된 item |
| `type` | enum | 예 | `thumbnail`, `photo`, `remote_image` |
| `storage_url` | string | 예 | 로컬 파일 URI 또는 원격 Storage URL |
| `mime_type` | string nullable | 아니오 | MIME type |
| `width` | integer nullable | 아니오 | 이미지 너비 |
| `height` | integer nullable | 아니오 | 이미지 높이 |
| `created_at` | datetime | 예 | 생성 시각 |

Alpha에서 `image_asset_id`는 `attachments.id`를 참조한다. 첫 슬라이스에서 실제 사진 입력이 없더라도 썸네일 또는 원격 이미지 참조가 생기면 이 테이블을 사용한다.

### 6.7 `sync_queue`

Alpha에서는 서버 전송 큐가 아니라 로컬 이벤트 로그로 사용한다.

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `id` | string/integer | 예 | 로컬 DB 기본키 |
| `schema_version` | string | 예 | Alpha 기본값 `sync_event_v1` |
| `queue_mode` | enum | 예 | Alpha 기본값 `alpha_audit` |
| `entity_type` | enum | 예 | `item`, `extraction`, `attachment`, `price_observation` |
| `entity_local_id` | UUID string | 예 | 대상 local id |
| `operation` | enum | 예 | 아래 operation 목록 |
| `payload_json` | object | 예 | Alpha에서는 민감 필드를 제거한 로컬 이벤트 요약 |
| `status` | enum | 예 | 아래 status 목록 |
| `attempt_count` | integer | 예 | Alpha 기본값 0 |
| `last_error` | string nullable | 아니오 | 실패 원인 |
| `created_at` | datetime | 예 | 생성 시각 |
| `updated_at` | datetime | 예 | 수정 시각 |

Alpha 허용 operation:

- `create`
- `update`
- `archive`
- `restore`
- `delete`
- `permanent_delete`

Alpha 허용 status:

- `done`
- `pending`
- `failed`

Beta 전환 시 이 이벤트 로그는 migration 참고 입력으로만 사용한다. 서버 전송 큐는 `replication_queue_v1` 또는 별도 ADR로 정의한 schema를 사용한다.

Alpha의 `payload_json`에는 원본 URL 전체, 페이지 본문, raw AI output, 사용자 메모를 넣지 않는다. Beta transport queue로 전환할 때도 민감 필드 전송은 서버 API 계약에서 별도로 allowlist한다.

Operation별 `payload_json` invariant:

| operation | payload invariant |
| --- | --- |
| `create` | `entity_local_id`, `entity_type`, `created_at`, 민감 필드 제거 후 변경 필드 이름 목록 |
| `update` | 변경 필드 이름 목록, `version`, 사용자 콘텐츠 원문 제외 |
| `archive` | `archived_at`, `version` |
| `restore` | 복원 대상 상태, `version` |
| `delete` | `deleted_at`, 이전 상태, `version` |
| `permanent_delete` | `deleted_at`, `tombstone_until`, `version`, 콘텐츠 없는 marker |

Replay 규칙:

- Alpha에서는 `sync_queue`를 UI 상태 복구와 삭제 cascade 테스트용 `sync_event_v1` local audit envelope로만 읽는다.
- Beta transport는 이 테이블을 그대로 네트워크 큐로 사용하지 않는다. Beta 전환 전 `replication_queue_v1` 별도 schema를 만들지, `sync_event_v1`을 migration할지 ADR로 결정한다.
- 어떤 경우에도 `permanent_delete` replay는 사용자 콘텐츠를 재생성할 수 없다.

### 6.8 `usage_events`

Pro 결제는 첫 슬라이스 범위가 아니지만 AI 사용량 준비는 필요하다.

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `id` | string/integer | 기본키 |
| `event_type` | enum | `ai_extraction_requested`, `ai_extraction_succeeded`, `ai_extraction_failed`, `manual_save` |
| `item_local_id` | UUID nullable | 관련 item |
| `extraction_id` | string/integer nullable | 관련 extraction |
| `occurred_at` | datetime | 발생 시각 |
| `metadata_json` | object | 토큰/모델/실패 원인 등 최소 정보 |

`metadata_json`에는 원본 URL, 사용자 메모, raw AI output, raw page body를 넣지 않는다.

## 7. 상태 머신

### 7.1 추출 상태

```text
idle
  -> validating_url

validating_url
  -> blocked_invalid_url
  -> blocked_unsafe_url
  -> idempotency_in_progress
  -> fetching_metadata

fetching_metadata
  -> metadata_failed
  -> extracting

extracting
  -> extraction_failed
  -> schema_invalid
  -> needs_review
  -> ready_to_save

metadata_failed
  -> manual_save
  -> validating_url
  -> retry_exhausted

extraction_failed
  -> manual_save
  -> extracting
  -> retry_exhausted

schema_invalid
  -> manual_save
  -> extracting
  -> retry_exhausted

idempotency_in_progress
  -> validating_url

retry_exhausted
  -> manual_save

needs_review
  -> saving

ready_to_save
  -> saving

manual_save
  -> saving

saving
  -> saved
  -> save_failed
```

전환 규칙:

- `blocked_unsafe_url`은 서버 fetch를 수행하지 않는다.
- `metadata_failed`, `extraction_failed`, `schema_invalid`는 수동 저장으로 갈 수 있다.
- `needs_review`는 저장 가능하지만 확인 필요 필드를 명확히 보여줘야 한다.
- `save_failed`는 partial write가 없어야 한다.

### 7.2 항목 상태

```text
active -> archived -> active
active -> deleted -> active
archived -> deleted
deleted -> permanently_deleted
```

전환 규칙:

- `archived`는 기본 검색에서 제외된다.
- `deleted`는 일반 리스트와 검색에서 제외된다.
- `deleted`는 휴지통에서 복원 가능하다.
- `permanently_deleted`는 사용자 콘텐츠가 삭제 또는 익명화된 상태이며 일반 화면에 나타나지 않는다.

### 7.3 사용자 확정 상태

필드 단위로 다음 상태를 가진다.

| 상태 | 의미 |
| --- | --- |
| `ai_draft` | AI가 만든 초안 |
| `needs_review` | AI가 불확실하다고 표시한 값 |
| `user_confirmed` | 사용자가 확인하거나 수정한 값 |
| `user_empty` | 사용자가 의도적으로 비워둔 값 |

저장 규칙:

- `field_state_json`은 화면에 표시되는 주요 필드별 상태를 저장한다.
- `field_confidence_json`은 AI가 반환한 필드별 confidence를 저장한다.
- 사용자가 필드를 수정하거나 저장 시 명시적으로 확인하면 해당 필드는 `user_confirmed`가 된다.
- 사용자가 확인 화면에서 값을 비우고 저장하면 해당 필드는 `user_empty`가 된다.
- 저장 후 상세 화면에서 신뢰도/확정 상태를 다시 보여줄 때는 `items.field_state_json`과 `items.field_confidence_json`을 읽는다.

## 8. AI 추출 계약

### 8.1 스키마

AI 출력 스키마 버전은 `picklog_item_v1`이다.

필수 공통 필드:

- `title`
- `source_type`
- `category`
- `use_case`
- `tags`
- `confidence`
- `extraction_notes`
- `field_confidence`
- `needs_review`

예시:

```json
{
  "schema_version": "picklog_item_v1",
  "title": "무선 스탠드 조명",
  "summary": "침실이나 책상에 둘 수 있는 충전식 조명 후보",
  "source_type": "shopping_url",
  "category": "인테리어",
  "use_case": "침실 조명 후보",
  "tags": ["조명", "침실", "선물후보"],
  "confidence": 0.82,
  "field_confidence": {
    "title": 0.92,
    "seller": 0.74,
    "price": 0.48
  },
  "needs_review": ["price"],
  "extraction_notes": "가격은 페이지 내 옵션에 따라 달라질 수 있어 확인 필요",
  "metadata": {
    "kind": "shopping",
    "seller": "Example Store",
    "brand": null,
    "product_name": "무선 스탠드 조명",
    "price": 59000,
    "currency": "KRW",
    "purchase_intent": "compare"
  }
}
```

### 8.2 신뢰도 표시 규칙

| 조건 | UI 표시 |
| --- | --- |
| 필드 confidence >= 0.80 | 일반 AI 초안 |
| 0.50 <= confidence < 0.80 | 연한 "확인 권장" 표시 |
| confidence < 0.50 | "확인 필요" 표시 |
| 가격/판매처 confidence < 0.80 | 확정값처럼 표시 금지 |
| AI가 출처 제한을 언급 | `extraction_notes`를 확인 화면에 표시 |

가격과 판매처는 사용자가 확정하기 전까지 "관측값" 또는 "추정값"이다. "최저가", "실시간 가격", "공식 판매처"처럼 보장하는 문구를 쓰지 않는다.

### 8.3 실패 처리

| 실패 | 처리 |
| --- | --- |
| 메타데이터 fetch 실패 | AI가 URL만 보고 추출하거나 수동 저장 |
| AI timeout | 재시도 또는 수동 저장 |
| AI JSON 파싱 실패 | schema invalid로 처리하고 수동 저장 |
| 필수 필드 누락 | 확인/수정 화면에서 필수 필드 입력 요구 |
| 플랫폼 제한 | 제한 이유를 보여주고 원본 링크 중심 저장 |

### 8.4 프롬프트 주입 경계

URL 본문, 메타태그, 페이지 텍스트는 모두 데이터다. 시스템 지시, 스키마, 보안 규칙을 덮어쓸 수 없다.

서버는 다음을 지켜야 한다.

- 페이지 텍스트를 AI 시스템 프롬프트로 넣지 않는다.
- 페이지 텍스트 안의 "이전 지시를 무시하라" 류의 문장을 명령으로 취급하지 않는다.
- AI 출력은 스키마 검증을 통과해야 사용자에게 표시된다.

### 8.5 AI 전송 데이터 최소화

AI provider로 전송할 수 있는 필드는 allowlist 방식으로 제한한다.

허용 필드:

- `schema_version`
- `source_type`
- `canonical_url`
- `canonical_origin`
- `page_title`
- `meta_description`
- `open_graph_title`
- `open_graph_description`
- `open_graph_image_url`
- `content_type`
- `visible_text_excerpt`
- `fetch_status`

금지 필드:

- `device_id`
- `user_id`
- `request_id`
- 원본 URL의 민감 query parameter
- URL fragment
- URL userinfo
- cookie/header/session 값
- 사용자 메모
- raw HTML body 전체
- 앱 로컬 DB의 다른 저장 항목

크기와 보존:

- `visible_text_excerpt`는 UTF-8 기준 최대 8KB다.
- AI provider 전송 payload는 UTF-8 기준 최대 16KB다.
- 서버 로그에는 AI prompt 전문, raw page body, raw AI output을 남기지 않는다.
- `raw_output_json`은 디버깅을 위해 최대 7일만 보존하고 이후 삭제한다.
- AI provider 설정은 가능한 경우 학습 사용 opt-out 또는 no-training 옵션을 켠다.
- provider가 no-training/retention opt-out을 제공하지 않으면 내부 Alpha 데이터에만 사용하고, 외부 Beta 전에는 provider 정책을 다시 승인해야 한다.

## 9. URL 안전 계약

### 9.1 허용

- `http`
- `https`

### 9.2 차단

- `localhost`
- loopback IP
- 사설 IP
- link-local IP
- cloud metadata IP
- non-http scheme
- URL userinfo 포함 URL
- 민감 query parameter 포함 URL
- DNS 조회 후 금지 대역으로 해석되는 host
- redirect 후 금지 대역으로 이동하는 URL

### 9.3 제한

| 항목 | 요구 |
| --- | --- |
| redirect | 최대 5회. redirect마다 URL parse, DNS/IP 대역, scheme, content host를 재검증한다. |
| 응답 크기 | metadata fetch 응답은 최대 2MB. 초과 시 body read를 중단하고 safe fetch failure로 처리한다. |
| fetch 시간 | connect timeout 5초, 전체 fetch timeout 15초. |
| content type | `text/html`, `application/xhtml+xml`, `application/json`, `text/plain`, `image/*` 메타데이터만 허용한다. |
| HTML 처리 | 스크립트를 실행하지 않고 텍스트와 메타태그만 파싱한다. |

정규화:

- URL fragment는 서버 전송 전에 제거한다.
- host는 IDNA/punycode 정규화 후 검사한다.
- default port는 제거하되, 비표준 port는 유지하고 allow/deny 판단에 포함한다.
- query parameter 이름이 `token`, `access_token`, `auth`, `key`, `api_key`, `signature`, `sig`, `expires`, `session`, `jwt`, `password`이거나 `x-amz-`로 시작하면 자동 추출을 차단한다.
- userinfo가 포함된 URL은 자동 추출을 차단한다.

fallback 구분:

- 안전 차단 URL은 수동 저장 항목으로 만들 수 없다.
- 안전 게이트를 통과했지만 fetch timeout, oversized response, 지원하지 않는 content type, AI failure가 발생한 URL은 수동 저장을 허용한다.
- 수동 저장 허용 시에도 `source_url`은 정규화 URL을 저장하고, 민감 query는 저장하지 않는다.

### 9.4 URL 안전 테스트

| 테스트 | 기대 결과 |
| --- | --- |
| `https://example.com/item` | 허용 |
| `ftp://example.com/item` | 클라이언트 또는 서버에서 차단 |
| `http://localhost:3000` | 차단 |
| 사설 IP URL | 차단 |
| public URL -> private IP redirect | redirect 후 차단 |
| cloud metadata IP | 차단 |
| URL userinfo 포함 | 차단 |
| 민감 query parameter 포함 | 차단 |
| redirect 6회 이상 | 중단 후 safe fetch failure |
| 2MB 초과 응답 | 중단 후 수동 저장 가능 |
| 15초 timeout | 중단 후 재시도/수동 저장 |

## 10. 검색과 재발견 계약

### 10.1 검색 대상 필드

- `title`
- `summary`
- `category`
- `use_case`
- `tags`
- `source_type`
- `source_url`
- `metadata_json.seller`
- `metadata_json.brand`
- `metadata_json.product_name`
- `metadata_json.price`
- `user_note`

### 10.2 필터

첫 슬라이스 필수 필터:

- 카테고리
- 출처 타입
- 가격대
- 판매처
- 태그
- 아카이브 포함/제외

### 10.3 정렬

첫 슬라이스 필수 정렬:

- 최근 저장순
- 가격 낮은순
- 이름순

### 10.4 검색 수용 기준

- 저장 직후 항목이 리스트에 즉시 표시된다.
- 저장 직후 제목 검색으로 항목을 찾을 수 있다.
- 30개 Alpha 데이터셋 중 70% 이상이 사용자가 예상한 검색어로 검색된다.
- `deleted` 항목은 일반 검색에 나타나지 않는다.
- `archived` 항목은 기본 검색에 나타나지 않고, 아카이브 포함 토글에서만 나타난다.

## 11. 삭제와 보존 계약

### 11.1 삭제 상태

| 상태 | 의미 | 화면 표시 |
| --- | --- | --- |
| `active` | 일반 저장 항목 | 리스트/검색 표시 |
| `archived` | 보관 항목 | 기본 검색 제외 |
| `deleted` | 휴지통 항목 | 휴지통에서만 표시 |
| `permanently_deleted` | 영구 삭제 완료 | 표시 안 함 |

### 11.2 cascade

| 데이터 | 휴지통 이동 | 복원 | 영구 삭제 |
| --- | --- | --- | --- |
| `items` | `status=deleted`, `deleted_at` 설정 | 이전 상태 또는 `active`로 복원 | tombstone row만 유지하고 사용자 콘텐츠 필드 삭제 |
| `extractions.input_snapshot` | 유지 | 유지 | `url_hash`, `canonical_origin`, `fetch_status`만 남기고 URL/metadata/text 삭제 |
| `extractions.raw_output_json` | 만료 규칙 유지 | 유지 | 즉시 삭제 |
| `extractions.normalized_output_json` | 유지 | 유지 | 즉시 삭제 |
| `price_observations` | 유지 | 유지 | row 삭제 |
| `attachments` | 유지 | 유지 | 로컬/서버 파일 삭제 후 row 삭제 |
| `usage_events` | 유지 | 유지 | 관련 item/extraction 참조 제거, metadata를 aggregate counter만 남기도록 scrub |
| `sync_queue` tombstone | `delete` event 기록 | `restore` event 기록 | `permanent_delete` marker만 `tombstone_until`까지 유지 |

### 11.3 Alpha tombstone 규칙

Alpha에는 원격 동기화가 없지만 `tombstone_until`을 둔다. 이유는 Beta 전환 시 삭제 충돌을 처리하기 위해서다.

Alpha 기본값:

- 휴지통 이동 시 `deleted_at` 설정
- 사용자가 휴지통에서 영구 삭제하면 즉시 영구 삭제 cascade를 실행한다.
- `deleted_at + 30 days`가 지나면 다음 앱 실행 또는 cleanup job에서 자동 영구 삭제 cascade를 실행한다.
- 영구 삭제 시 `tombstone_until = now + 30 days`로 설정한다.
- tombstone row는 6.2의 canonical tombstone field list만 유지한다.
- tombstone 이후 로컬-only item이면 tombstone row와 local event marker를 삭제할 수 있다.
- Beta sync 대상 item이면 서버가 delete ack를 반환하기 전까지 tombstone marker를 삭제하지 않는다.
- 관련 `usage_events`는 row를 유지할 수 있지만 `item_local_id`, `extraction_id`, URL, 실패 세부 메시지를 제거하고 `event_type`, `occurred_at`, 모델/provider의 비식별 aggregate 정보만 남긴다.

영구 삭제 시 반드시 비워야 하는 `items` 필드:

- `source_url`
- `title`
- `summary`
- `category`
- `use_case`
- `tags`
- `thumbnail_url`
- `image_asset_id`
- `metadata_json`
- `confidence`
- `field_confidence_json`
- `field_state_json`
- `extraction_id`
- `user_note`

### 11.4 삭제 테스트 수용 기준

- 휴지통 이동 후 일반 리스트/검색에서 사라지고 휴지통에는 나타난다.
- 복원 후 이전 필드가 유지되고 일반 리스트/검색에 다시 나타난다.
- 사용자 영구 삭제 후 사용자 콘텐츠 필드는 모두 비거나 row가 삭제된다.
- `deleted_at + 30 days` cleanup 후 같은 cascade가 자동 실행된다.
- 영구 삭제 후 `raw_output_json`, `normalized_output_json`, `price_observations`, `attachments`는 남지 않는다.
- 영구 삭제 후 `usage_events`는 item/extraction과 다시 연결될 수 없다.
- `sync_queue.payload_json`의 `permanent_delete` marker에는 사용자 콘텐츠가 없다.

## 12. Alpha/Beta 준비 계약

### 12.1 공유 시트 Beta 준비

첫 슬라이스는 공유 시트를 구현하지 않는다.

준비 계약:

```json
{
  "payload_type": "url",
  "source_app": "string or null",
  "url": "string",
  "received_at": "datetime",
  "raw_title": "string or null",
  "raw_text": "string or null"
}
```

Beta spike 수용 기준:

- iOS 실제 기기에서 공유 시트 수신 검증
- Android 실제 기기에서 share intent 수신 검증
- 중복 payload 방지
- 수신 payload를 첫 슬라이스 링크 입력 흐름으로 연결
- Expo Sharing의 iOS receive caveat를 검토하고 우회가 필요한지 결정

### 12.2 로그인/동기화 준비

첫 슬라이스는 로그인과 클라우드 동기화를 구현하지 않는다.

준비 계약:

- 모든 주요 row는 `local_id`를 가진다.
- `remote_id`는 nullable로 둔다.
- `device_id`는 필수다.
- `version`은 로컬 update마다 증가한다.
- `sync_state`는 Alpha에서 `local_only`를 기본값으로 둔다.

Beta에서 추가할 동작:

- remote create/update/delete
- conflict detection
- tombstone reconciliation
- account deletion server cascade

### 12.3 Pro/사용량 준비

첫 슬라이스는 결제를 구현하지 않는다.

준비 계약:

- AI 추출 요청과 성공/실패를 `usage_events`에 기록한다.
- 설정 화면에는 "AI 사용량/Pro 준비 영역"을 둘 수 있지만 결제 액션은 제공하지 않는다.
- 무료 한도 enforcement는 Beta/v1 결정으로 남긴다.

## 13. 개인정보와 정책 요구

### 13.1 첫 슬라이스 필수 고지

앱 안에 다음 내용을 사용자가 이해할 수 있게 표시한다.

- 링크와 공개 페이지 정보가 AI 분석에 사용될 수 있음
- 사용자의 메모와 저장 정보는 기본 비공개임
- AI가 생성한 값은 초안이며 틀릴 수 있음
- 가격과 판매처는 추출 시점의 관측/추정값임
- 사용자는 저장 항목을 삭제할 수 있음

### 13.2 App Store / Google Play 준비

첫 슬라이스가 내부 Alpha라도 다음 계약을 둔다.

- 사용자 데이터의 AI 제공자 전송 범위 명시
- 모델 학습 사용 여부 명시
- AI 오류/부적절 결과 피드백 경로 준비
- Pro 결제가 들어갈 경우 인앱결제 정책 검토
- 외부 콘텐츠를 표시할 경우 신고/삭제/차단 흐름 검토

## 14. 30개 Alpha 데이터셋

### 14.1 구성

| Source type | 최소 개수 | 포함해야 할 케이스 |
| --- | ---: | --- |
| 쇼핑 URL | 10 | 명확한 가격, 가격 불명확, 판매처 모호, 옵션별 가격, 품절/변형 페이지 |
| 레시피/블로그 URL | 5 | 구조화 레시피, 일반 블로그 레시피, 재료 누락 |
| 영상/쇼츠 URL | 5 | YouTube, 제한적 메타데이터 플랫폼, 제목/크리에이터 누락 |
| 일반 글/생활 팁 URL | 4 | article 분류, unknown 분류, 긴 제목 |
| 지원 불가/안전 차단 URL | 3 | non-http, unsafe redirect, 접근 불가 |
| 사용자 핵심 예시 | 3 | 실제로 자주 저장할 개인 예시 |

### 14.2 각 row 필드

- 입력 URL
- 출처 타입
- 왜 저장했는지
- 나중에 찾을 검색어
- must-hit 필드
- nice-to-have 필드
- 틀리면 안 되는 필드
- 불확실하면 "확인 필요"여야 하는 필드

### 14.3 eval 통과 기준

- 필수 필드 허용 정확도 80% 이상
- 가격/판매처 불확실성의 "확인 필요" 표시 100%
- 예상 검색어 재검색 성공률 70% 이상
- 안전 차단 케이스 100% 차단
- AI 실패/timeout/manual save fallback 통과

## 15. 테스트 계획 매핑

| 영역 | 테스트 유형 | 필수 여부 |
| --- | --- | --- |
| URL parser | unit | 필수 |
| SSRF guard | unit/integration | 필수 |
| redirect validation | integration | 필수 |
| URL normalization and sensitive query blocking | unit/integration | 필수 |
| metadata fetch timeout | integration | 필수 |
| metadata response size limit | integration | 필수 |
| `/extract-url` request/response envelope | contract | 필수 |
| `/extract-url` idempotent retry by request_id | integration | 필수 |
| `/extract-url` idempotency conflict | integration | 필수 |
| AI payload allowlist and size cap | unit | 필수 |
| provider retention/no-training configuration check | configuration review | 필수 |
| AI schema validator | unit | 필수 |
| low-confidence display | UI/E2E | 필수 |
| mobile accessibility and long text behavior | UI/E2E | 필수 |
| field provenance persistence | integration | 필수 |
| manual save fallback | E2E | 필수 |
| retry exhausted state | integration/E2E | 필수 |
| local DB save rollback | integration | 필수 |
| search/filter | E2E | 필수 |
| archive/delete/restore | integration/E2E | 필수 |
| permanent delete cascade | integration | 필수 |
| usage_events deletion scrub | integration | 필수 |
| automatic deleted_at + 30 days cleanup | integration | 필수 |
| 30-item eval | eval | 필수 |

## 16. 구현 순서

1. 데이터 모델과 마이그레이션 초안 작성
2. URL parser와 안전 게이트 테스트 작성
3. 링크 입력 화면과 추출 요청 상태 구현
4. 서버 metadata fetcher와 AI extractor boundary 구현
5. `picklog_item_v1` schema validator 구현
6. 확인/수정 화면 구현
7. 로컬 저장과 리스트 반영 구현
8. 검색/필터 구현
9. 상세/아카이브/삭제 구현
10. 30-item eval dataset으로 검증

## 17. Open Decisions

### 17.1 구현 전 닫힌 결정

다음 결정은 첫 슬라이스 기준으로 닫혔다.

- 앱 런타임은 React Native + Expo다.
- 로컬 저장은 SQLite다.
- 추출 서버 boundary는 Supabase Edge Function이다.
- AI provider는 앱에서 직접 호출하지 않는다.
- 안전 차단 URL은 수동 저장 항목으로 만들 수 없다.
- 첫 내부 Alpha는 로컬 DB 암호화 도입을 blocker로 두지 않는다. 대신 원문 본문 미저장, 민감 query 차단, raw output 7일 삭제, 영구 삭제 cascade를 필수로 둔다. 외부 Beta 전에 로컬 DB 암호화 또는 OS/플랫폼 보안 등가성은 별도 보안 결정으로 재검토한다.

### 17.2 구현 중 결정 가능

- 카테고리 기본 목록
- 태그 자동 생성 개수
- 검색 필터 UI 형태
- 상세 화면에서 inline edit인지 edit mode인지
- raw output 7일 삭제와 `deleted_at + 30 days` cleanup을 background timer로 할지 다음 앱 실행 시 cleanup으로 할지

### 17.3 Beta 전용 결정

- 공유 시트 구현 방식
- Apple/Google 로그인 우선순위
- 클라우드 백업 provider
- 외부 Beta용 로컬 DB 암호화 방식
- 무료 한도 기준
- Pro 구독과 일회성 결제 병행 여부
- 계정 삭제 서버 cascade 정책

## 18. 최종 수용 기준

첫 슬라이스는 다음을 만족하면 완료다.

- 링크 붙여넣기 저장 흐름이 정상/실패/수동 저장 경로를 모두 가진다.
- URL 안전 게이트 테스트가 통과한다.
- URL 정규화, 민감 query 차단, AI payload allowlist 테스트가 통과한다.
- AI 출력은 `picklog_item_v1` 스키마 검증을 통과해야 표시된다.
- 낮은 신뢰도 가격/판매처는 반드시 "확인 필요"로 표시된다.
- 낮은 신뢰도와 사용자 확정 상태는 저장 후에도 재현된다.
- 저장한 항목은 리스트와 검색에서 즉시 찾을 수 있다.
- 아카이브/삭제 상태가 검색 결과에 반영된다.
- 영구 삭제 cascade가 테스트로 증명된다.
- 30개 Alpha 데이터셋 기준을 통과한다.
- 개인정보와 AI 처리 고지가 앱 안에 존재한다.
- Beta 전환을 위한 identity/sync/tombstone/usage 계약이 데이터 모델에 반영된다.
