# Alpha Slice 1 Office Hours Decisions

작성일: 2026-06-07
상태: Alpha implementation assumption
입력: `docs/implementation-todo-alpha-slice-1.md`

이 문서는 구현을 멈추지 않기 위한 Alpha 가정이다. 실제 Alpha 사용자 인터뷰가 끝나면 같은 항목을 관찰 결과로 갱신한다.

## OH-1. Demand Reality

첫 사용자는 쇼핑 링크와 생활 팁 링크를 카카오톡 나에게 보내기, Apple Notes, 브라우저 탭에 흩어 두는 모바일 사용자로 둔다.

반복 행동 신호는 같은 주 안에 저장한 링크를 다시 찾으려다 실패하거나, 가격/판매처/용도를 다시 직접 확인하는 장면이다. Alpha의 문제 문장은 다음으로 고정한다.

> 사용자는 저장 자체보다 나중에 왜 저장했는지와 어느 가격/판매처였는지 다시 찾는 데 실패한다.

30개 Alpha 데이터셋의 사용자 핵심 예시는 다음 3개를 포함한다.

- 침실용 무선 스탠드 조명 비교 링크
- 주말 저녁용 간단 레시피 링크
- 청소/수납 생활 팁 글 링크

## OH-2. Status Quo

현재 대체재는 카카오톡 나에게 보내기, Apple Notes, 브라우저 북마크다. Picklog가 첫 슬라이스에서 이기는 지점은 저장 속도가 아니라 재발견 성공률이다.

검색/필터 우선순위는 title, category, use_case, tags, seller, brand, product_name, source_type, user_note 순으로 둔다. 기본 검색에서는 archived/deleted를 제외하고, archived는 토글로 다시 포함한다.

## OH-3. Desperate Specificity

첫 Alpha 페르소나는 "쇼핑 후보와 생활 팁을 모바일에서 자주 저장하지만 나중에 다시 못 찾는 30대 1인 가구 사용자"로 좁힌다.

빈 상태와 예시 문구는 범용 북마크보다 "나중에 다시 볼 후보", "침실 조명 후보", "주말에 다시 확인" 같은 저장 이유 중심 언어를 사용한다.

## OH-4. Narrowest Wedge

Alpha Slice 1은 앱 내부 링크 붙여넣기 저장만 구현한다. 사진, 공유 시트, 로그인, 동기화, 결제는 제외한다.

다만 Beta 전환을 위해 `local_id`, `remote_id`, `device_id`, `sync_state`, `version`, `tombstone_until`, `sync_queue`, `usage_events` 계약은 첫 DB 모델과 shared store에 유지한다.

## OH-5. Observation And Surprise

내부 Alpha 관찰 체크리스트:

- 사용자가 AI 초안의 낮은 신뢰도 필드를 실제로 읽는가?
- 가격/판매처가 "확인 필요"일 때 저장 전에 고치는가?
- 수동 저장 fallback을 이해하고 쓰는가?
- 저장 후 예상 검색어로 1분 안에 다시 찾는가?
- 아카이브와 삭제의 차이를 이해하는가?

관찰 이벤트 후보는 `usage_events`, `field_state_json`, `sync_queue`의 local audit event로 남긴다.

## OH-6. Future Fit

Alpha의 `sync_queue`는 네트워크 큐가 아니라 local audit event log다. 이 선택은 클라우드 동기화가 붙기 전에도 변경 이력과 삭제 scrub 정책을 검증하게 해준다.

Beta 전환 ADR에서 확인할 항목:

- AI provider no-training/retention 정책
- 로컬 DB 암호화 또는 OS 보안 등가성
- 공유 시트, 사진 입력, 로그인/동기화 중 다음 슬라이스 우선순위
