# Picklog Alpha Slice 1 구현 할일 목록

작성일: 2026-06-07
상태: Draft v1
범위: `docs/functional-spec-alpha-slice-1.md`의 Alpha Slice 1
입력 문서: `docs/PRD.md`, `docs/functional-spec-alpha-slice-1.md`

## 1. 범위 결정

이 할일 목록은 **Alpha Slice 1만** 구현 대상으로 삼는다.

사용자 약속:

> 사용자가 앱 안에서 링크를 붙여넣으면, Picklog가 안전하게 메타데이터와 AI 초안을 만들고, 사용자가 확인/수정 후 저장하며, 저장한 항목을 리스트와 검색에서 다시 찾을 수 있다.

포함:

- 앱 내부 링크 붙여넣기
- URL 형식 검사
- 서버 URL 안전 게이트
- 공개 메타데이터 수집
- AI 구조화 추출
- `picklog_item_v1` 스키마 검증
- 확인/수정 화면
- 수동 저장 fallback
- SQLite 로컬 저장
- 저장함 리스트
- 검색/필터
- 상세/아카이브/삭제/복원/영구 삭제 계약
- Alpha/Beta 전환을 위한 identity, sync, tombstone, usage 계약
- 30개 Alpha 데이터셋 검증

제외:

- 사진 촬영과 사진첩 이미지 선택
- iOS/Android 공유 시트 수신
- Apple/Google 로그인
- 클라우드 백업/동기화
- 결제와 Pro 권한 enforcement
- 가격 변경 알림
- 자연어 검색
- 유사 이미지 검색
- 공개 컬렉션, 공유 피드, 팔로우

## 2. Office Hours 검증 트랙

`office-hours`는 구현 전에 제품 방향이 틀어지는 것을 막기 위한 검증 트랙으로 사용한다. 이 트랙은 코드를 만들지 않는다. 각 질문의 답은 구현 이슈의 우선순위와 30개 Alpha 데이터셋에 반영한다.

### OH-1. Demand Reality

질문:

- Picklog가 사라지면 실제로 아쉬워할 첫 사용자는 누구인가?
- 그 사용자는 지금 어떤 링크/사진/메모를 얼마나 자주 잃어버리는가?
- "관심 있다"가 아니라 반복 사용 행동으로 확인할 수 있는 신호는 무엇인가?

완료 증거:

- 실제 사용자 또는 사용자 역할 1개 이상을 문서화한다.
- 그 사람이 저장하는 URL 예시 3개 이상을 30개 Alpha 데이터셋의 `사용자 핵심 예시`에 넣는다.
- "다시 찾기 실패" 또는 "정리 귀찮음"이 실제 문제인지 한 문장으로 고정한다.

### OH-2. Status Quo

질문:

- 사용자는 지금 무엇으로 해결하는가? Notion, Apple Notes, Google Keep, 카카오톡 나에게 보내기, 브라우저 북마크, 인스타 저장 중 무엇인가?
- 현재 방식이 비용을 만드는 지점은 저장, 정리, 재검색 중 어디인가?

완료 증거:

- 현재 대체재 2개 이상과 Picklog가 첫 슬라이스에서 이기는 지점을 적는다.
- 저장 속도보다 재발견 성공률이 더 중요한지 확인한다.
- 검색/필터 우선순위에 반영한다.

### OH-3. Desperate Specificity

질문:

- "20-40대 모바일 쇼핑 사용자"가 아니라 가장 먼저 쓸 실제 인간은 누구인가?
- 그 사람은 쇼핑, 레시피, 영상, 생활 팁 중 무엇을 가장 많이 저장하는가?

완료 증거:

- 첫 Alpha 사용자를 1개 페르소나로 좁힌다.
- 30개 Alpha 데이터셋 비율이 그 페르소나를 반영하는지 확인한다.
- 첫 화면 예시 문구와 빈 상태 문구가 그 페르소나의 언어를 쓴다.

### OH-4. Narrowest Wedge

질문:

- 첫 주에 돈을 내거나 매일 쓸 만큼 좁은 기능은 무엇인가?
- "모든 생활정보 저장소"가 아니라 "AI 쇼핑/생활 링크 저장함"만으로 충분한가?

완료 증거:

- Alpha Slice 1은 링크 저장만 구현한다는 결정을 유지한다.
- 사진, 공유 시트, 로그인, 결제는 구현 이슈에서 제외한다.
- 대신 데이터 계약에는 Beta 준비 필드를 유지한다.

### OH-5. Observation And Surprise

질문:

- 실제 사용자가 링크를 붙여넣고 AI 초안을 확인하는 장면을 봤을 때 무엇이 예상과 다를 수 있는가?
- 사용자가 AI 필드를 고치지 않고 그냥 저장하는지, 가격/판매처를 꼭 확인하는지 어떻게 볼 것인가?

완료 증거:

- 내부 Alpha 관찰 체크리스트를 만든다.
- `needs_review`, `field_state_json`, `usage_events`로 관찰 가능한 이벤트를 남긴다.
- 30개 Alpha 데이터셋 검증 후 UX 수정 후보를 별도 backlog로 분리한다.

### OH-6. Future Fit

질문:

- 3년 뒤 링크 저장과 AI 추출이 더 흔해질 때 Picklog는 더 필요해지는가, 덜 필요해지는가?
- 클라우드 동기화와 공유 시트가 붙어도 Alpha 로컬 데이터 모델이 버틸 수 있는가?

완료 증거:

- `local_id`, `remote_id`, `device_id`, `sync_state`, `version`, `tombstone_until`, `sync_queue`, `usage_events`를 첫 DB 모델에 포함한다.
- Alpha의 `sync_queue`는 네트워크 큐가 아니라 local audit event log로 고정한다.
- Beta 전환 결정은 별도 ADR로 남긴다.

## 3. 구현 에픽

### E01. 프로젝트 골격과 품질 게이트

목표:

- React Native + Expo 앱과 Supabase Edge Function 작업 공간을 만든다.
- 테스트, lint, typecheck, formatter 실행 경로를 정한다.

할일:

- Expo 앱 구조 생성
- Supabase Edge Function 구조 생성
- 공통 TypeScript 설정 정리
- 앱/서버 공통 schema package 또는 shared module 위치 결정
- 테스트 러너와 명령 정의
- CI 후보 명령 문서화

완료 증거:

- 앱이 로컬에서 빈 화면으로 실행된다.
- Edge Function 테스트가 최소 1개 실행된다.
- `lint`, `typecheck`, `test` 중 최소 구현 가능한 명령이 문서화된다.

### E02. 로컬 데이터 모델과 마이그레이션

목표:

- Alpha Slice 1의 source of truth가 될 SQLite schema를 만든다.

할일:

- `items` 테이블 작성
- `extractions` 테이블 작성
- `price_observations` 테이블 작성
- `attachments` 테이블 작성
- `sync_queue` 테이블 작성
- `usage_events` 테이블 작성
- canonical tombstone field list 반영
- `active`, `archived`, `deleted`, `permanently_deleted` 상태 전환 테스트 작성

완료 증거:

- migration 적용/rollback 경로가 있다.
- 사용자 수정은 `items`에 반영되고 `extractions.normalized_output_json`은 immutable snapshot으로 남는다.
- 영구 삭제 후 사용자 콘텐츠 필드가 삭제 또는 scrub된다.

### E03. URL Parser와 안전 게이트

목표:

- 안전하지 않은 URL은 외부 fetch 전에 차단한다.

할일:

- 클라이언트 URL 형식 검사 구현
- 서버 URL parser 구현
- scheme allowlist 구현
- userinfo 차단
- 민감 query parameter 차단
- DNS/IP 대역 검증
- redirect마다 최종 URL 재검증
- redirect 최대 5회 제한
- 2MB response limit
- connect timeout 5초, 전체 timeout 15초
- unsupported content type 처리

완료 증거:

- `localhost`, 사설 IP, cloud metadata IP, non-http scheme, userinfo, 민감 query가 차단된다.
- public URL에서 private IP로 redirect되는 케이스가 차단된다.
- 안전 차단 URL은 수동 저장으로 넘어가지 않는다.

### E04. `/extract-url` API 계약과 idempotency

목표:

- 앱과 추출 서버 사이의 요청/응답 envelope를 고정한다.

할일:

- `POST /extract-url` 요청 validation
- `request_id`, `device_id`, `client_schema_version`, normalized URL 기반 `request_hash` 계산
- `in_progress`, `terminal_success`, `terminal_nonretryable_error`, `retryable_error_not_cached` lifecycle 구현
- `idempotency_conflict` 처리
- 오류 응답의 `retryable`, `manual_save_allowed`, `message_key` 정규화

완료 증거:

- 같은 `device_id + request_id + request_hash` 재시도는 중복 fetch/AI를 실행하지 않는다.
- 같은 `request_id`가 다른 hash로 오면 fetch 없이 conflict를 반환한다.
- retryable error는 cached terminal success처럼 재생되지 않는다.

### E05. Metadata Fetcher와 AI Boundary

목표:

- 공개 메타데이터만 제한적으로 수집하고 AI provider key를 앱 밖에 둔다.

할일:

- HTML script 실행 없는 metadata parser 구현
- oEmbed 또는 meta/open graph 필드 수집
- `visible_text_excerpt` 최대 8KB 제한
- AI payload 최대 16KB 제한
- AI 전송 allowlist 구현
- 금지 필드 제거 검증
- provider no-training/retention 설정 확인 체크 작성
- `raw_output_json.expires_at` 설정
- raw output 7일 cleanup 구현
- raw output cleanup 실행 방식을 background timer 또는 다음 앱 실행 시점 중 하나로 결정

완료 증거:

- 앱은 URL 본문을 직접 fetch하지 않는다.
- 앱은 AI provider API key를 보관하지 않는다.
- 서버 로그에 raw HTML body, prompt 전문, raw AI output이 남지 않는다.
- 만료된 `raw_output_json`은 7일 후 삭제된다.

### E06. `picklog_item_v1` Schema Validator

목표:

- AI 출력이 스키마를 통과해야만 사용자에게 보인다.

할일:

- 공통 필수 필드 validator 작성
- `metadata.kind` variant validator 작성
- `source_type`과 `metadata_json.kind` 매핑 검증
- `field_confidence`, `needs_review`, `extraction_notes` 검증
- schema invalid 오류 처리
- 낮은 신뢰도 가격/판매처 표시 규칙 테스트

완료 증거:

- malformed JSON과 필수 필드 누락은 사용자 표시 전 차단된다.
- 가격/판매처 confidence가 0.80 미만이면 "확인 필요"로 표시할 수 있는 draft가 생성된다.

### E07. 링크 입력과 추출 상태 UI

목표:

- 사용자가 앱 안에서 링크를 붙여넣고 추출 진행/실패/재시도/수동 저장 상태를 이해한다.

할일:

- 홈/링크 입력 화면 구현
- paste와 keyboard input 지원
- URL 형식 오류 상태 구현
- 추출 진행 상태 구현
- 취소 동작 구현
- retryable error 상태 구현
- `manual_save_allowed`에 따른 수동 저장 노출 제어
- 접근성 label/hint 추가
- 긴 URL overflow 처리

완료 증거:

- `ftp:`, 빈 문자열, malformed URL은 fetch 요청 없이 오류 처리된다.
- `manual_save_allowed=false` 오류에서는 수동 저장 폼이 보이지 않는다.
- 주요 액션 터치 영역은 최소 44x44pt다.

### E08. 확인/수정 화면

목표:

- AI 초안을 사용자가 신뢰 가능하게 확인하고 수정한다.

할일:

- 핵심 필드 그룹 구현
- 출처 정보 그룹 구현
- 쇼핑/레시피/영상/article/unknown variant별 표시
- 낮은 신뢰도 필드 label 구현
- 사용자 수정/확정 상태 반영
- `user_empty` 처리
- 재추출 액션 구현
- 저장 전 필수 필드 validation

완료 증거:

- `needs_review` 필드는 색상만이 아니라 텍스트 label로 표시된다.
- 수정한 필드는 `user_confirmed`로 저장된다.
- 비운 필드는 `user_empty`로 저장된다.

### E09. 로컬 저장과 리스트 반영

목표:

- 저장 완료 즉시 사용자가 리스트에서 항목을 볼 수 있다.

할일:

- draft -> `items` 저장 변환 구현
- `extractions` snapshot 연결
- `price_observations` 생성
- `usage_events` 생성
- `sync_queue` local audit event 생성
- partial write rollback 구현
- 저장 완료 화면 구현
- 리스트 화면 구현

완료 증거:

- DB write 실패 시 partial item이 남지 않는다.
- 저장 후 리스트에 즉시 반영된다.
- AI raw output과 사용자 메모는 `sync_queue.payload_json`에 들어가지 않는다.

### E10. 검색과 필터

목표:

- 저장한 항목을 예상 검색어로 다시 찾을 수 있다.

할일:

- 검색 대상 필드 구현: title, category, use_case, tags, seller, brand, product_name, source_type, user_note
- 카테고리 필터
- source type 필터
- 가격대 필터
- 판매처 필터
- 태그 필터
- archived 포함/제외 토글
- 최근 저장순, 가격 낮은순, 이름순 정렬
- 작은 화면 필터 UI 구현

완료 증거:

- `deleted` 항목은 일반 검색에 나오지 않는다.
- `archived` 항목은 기본 검색에서 제외되고 토글로 포함할 수 있다.
- 30개 Alpha 데이터셋에서 예상 검색어 재검색 성공률 70% 이상이다.

### E11. 상세, 아카이브, 삭제, 복원

목표:

- 저장 항목의 상태 전환과 보존 정책을 첫 구현부터 증명한다.

할일:

- 상세 화면 구현
- 원본 링크 열기
- 메모 수정
- inline edit 또는 edit mode 결정
- 아카이브/복원 구현
- 휴지통 구현
- 삭제/복원 구현
- 영구 삭제 구현
- `deleted_at + 30 days` cleanup 방식 결정
- permanent delete cascade 테스트
- `usage_events` deletion scrub 테스트

완료 증거:

- `active -> archived -> active` 전환이 동작한다.
- `active -> deleted -> active` 전환이 동작한다.
- `deleted -> permanently_deleted` 전환 후 사용자 콘텐츠가 삭제 또는 scrub된다.
- 영구 삭제 marker에는 사용자 콘텐츠가 없다.
- 영구 삭제 후 `raw_output_json`, `normalized_output_json`, `price_observations`, `attachments`는 남지 않는다.
- 영구 삭제 후 `usage_events`는 item/extraction과 다시 연결될 수 없다.

### E12. 개인정보, AI 처리 고지, Alpha 설정

목표:

- 내부 Alpha라도 사용자가 데이터 처리 경계를 이해한다.

할일:

- AI 제공자 전송 범위 고지
- 저장 정보 기본 비공개 고지
- 기기 변경 시 로컬 데이터 유실 가능성 고지
- 삭제 가능성 고지
- Pro 준비 영역 또는 AI 사용량 표시 placeholder 구현

완료 증거:

- 앱 안에서 개인정보와 AI 처리 고지를 확인할 수 있다.
- usage counter 또는 `usage_events` 기반 표시 후보가 존재한다.

### E13. 30개 Alpha 데이터셋과 Eval

목표:

- 첫 슬라이스가 실제 저장/재검색 문제를 풀었는지 검증한다.

할일:

- 쇼핑 URL 10개
- 레시피/블로그 URL 5개
- 영상/쇼츠 URL 5개
- 일반 글/생활 팁 URL 4개
- 지원 불가/안전 차단 URL 3개
- 사용자 핵심 예시 3개
- 각 row에 입력 URL, 출처 타입, 왜 저장했는지, 나중에 찾을 검색어, must-hit field, nice-to-have field, 틀리면 안 되는 field, 확인 필요 field 기록
- eval runner 또는 수동 검증 sheet 작성

완료 증거:

- 필수 필드 허용 정확도 80% 이상
- 가격/판매처 불확실성의 "확인 필요" 표시 100%
- 예상 검색어 재검색 성공률 70% 이상
- 안전 차단 케이스 100% 차단
- AI 실패/timeout/manual save fallback 통과

## 4. 실행 순서

1. OH-1부터 OH-4까지 답을 채워 첫 사용자와 가장 좁은 웨지를 고정한다.
2. E01 프로젝트 골격과 품질 게이트를 만든다.
3. E02 데이터 모델과 마이그레이션을 먼저 구현한다.
4. E03 URL 안전 게이트 테스트를 코드보다 먼저 작성한다.
5. E04 `/extract-url` 계약과 idempotency를 구현한다.
6. E05 metadata fetcher와 AI boundary를 구현한다.
7. E06 schema validator를 구현한다.
8. E07 링크 입력과 추출 상태 UI를 구현한다.
9. E08 확인/수정 화면을 구현한다.
10. E09 로컬 저장과 리스트 반영을 구현한다.
11. E10 검색과 필터를 구현한다.
12. E11 상세/아카이브/삭제를 구현한다.
13. E12 개인정보와 AI 처리 고지를 구현한다.
14. E13 30개 Alpha 데이터셋으로 검증한다.
15. OH-5 관찰 항목을 실제 Alpha 사용 기록으로 채운다.
16. OH-6 Beta 전환 적합성을 확인하고 다음 슬라이스 후보를 분리한다.

## 5. 구현 중 OMX가 결정해도 되는 것

- 카테고리 기본 목록의 초안
- 태그 자동 생성 개수의 초안
- 검색 필터 UI의 구체 형태
- 상세 화면 inline edit vs edit mode의 첫 구현 선택
- cleanup을 background timer로 할지 앱 실행 시점으로 할지의 Alpha 선택
- 테스트 파일 구조와 fixture 이름
- 30개 Alpha 데이터셋 파일 형식

## 6. 구현 중 사용자 확인이 필요한 것

- 첫 Alpha 사용자의 실제 페르소나
- 사용자 핵심 예시 3개
- 외부 Beta 전에 선택할 AI provider 정책
- 외부 Beta 전에 로컬 DB 암호화 또는 OS 보안 등가성 판단
- 공유 시트, 사진 입력, 로그인/동기화 중 다음 슬라이스 우선순위

## 7. 완료 정의

Alpha Slice 1은 다음 조건을 모두 만족하면 완료다.

- 링크 붙여넣기 저장 흐름이 정상/실패/수동 저장 경로를 모두 가진다.
- URL 안전 게이트 테스트가 통과한다.
- URL 정규화, 민감 query 차단, AI payload allowlist 테스트가 통과한다.
- AI 출력은 `picklog_item_v1` 스키마 검증을 통과해야 표시된다.
- 낮은 신뢰도 가격/판매처는 반드시 "확인 필요"로 표시된다.
- 낮은 신뢰도와 사용자 확정 상태는 저장 후에도 재현된다.
- 저장한 항목은 리스트와 검색에서 즉시 찾을 수 있다.
- 아카이브/삭제 상태가 검색 결과에 반영된다.
- 영구 삭제 cascade가 테스트로 증명된다.
- raw output 7일 cleanup이 테스트로 증명된다.
- `usage_events` deletion scrub이 테스트로 증명된다.
- 30개 Alpha 데이터셋 기준을 통과한다.
- 개인정보와 AI 처리 고지가 앱 안에 존재한다.
- Beta 전환을 위한 identity/sync/tombstone/usage 계약이 데이터 모델에 반영된다.
