# Acceptance Criteria: SPEC-STOREFRONT-002 — 장바구니 화면·담기 UI 및 체크아웃 스타일 정리

Tier M — AC 상한 16개 이내(현재 15개). `STOREFRONT` 도메인 번호를 SPEC-STOREFRONT-001(AC-STOREFRONT-001~015)에서 이어받는다.

## §1. Given-When-Then 시나리오

**AC-STOREFRONT-016** — 장바구니 화면 서버 렌더 (REQ-STOREFRONT-016)
- Given: 게스트 쿠키가 가리키는 카트에 상품 A(수량 2)·상품 B(수량 1)가 있다
- When: `/cart`를 요청한다
- Then: 응답 HTML에 이미 상품 A·B의 이름·단가·수량·품목 합계와 전체 소계가 채워져 있다. 페이지 컴포넌트의 정적 소스에 `fetch(`/`useEffect` 데이터 로딩 코드가 없다(정적 검사).

**AC-STOREFRONT-017** — 빈 장바구니·쿠키 부재 안내 (REQ-STOREFRONT-017)
- Given: (a) 게스트 쿠키가 없거나, (b) 쿠키는 있으나 카트 항목이 0개다
- When: `/cart`를 요청한다
- Then: 두 경우 모두 수량 조작 UI 대신 안내 화면이 렌더되고, 상품 목록으로 이동하는 링크가 존재한다.

**AC-STOREFRONT-018** — 품목·소계 표시 (REQ-STOREFRONT-018)
- Given: 이미지가 있는 상품 A(단가 10,000원, 수량 3)
- When: 장바구니 화면을 렌더한다
- Then: 상품 A의 이미지(또는 이미지가 없을 때 대체 표시)·이름·단가·수량·품목 합계(30,000원)가 표시되고, 화면 하단에 전체 소계가 표시된다.

**AC-STOREFRONT-019** — 수량 변경 시 전체 화면 갱신 (REQ-STOREFRONT-019)
- Given: 상품 A(수량 2)가 담긴 장바구니 화면이 렌더되어 있다
- When: 수량 스테퍼로 상품 A의 수량을 5로 바꾼다
- Then: `PATCH /api/cart/items/:itemId`가 `{ quantity: 5 }`로 호출되고, 응답의 전체 카트 형태로 품목 합계와 소계가 갱신되며, 전체 페이지 리로드(내비게이션)가 발생하지 않는다.

**AC-STOREFRONT-020** — 거부된 변경은 반영되지 않고 다른 상태를 잃지 않음 (REQ-STOREFRONT-020)
- Given: 상품 A(재고 3, 수량 2)·상품 B(수량 1)가 담긴 장바구니 화면
- When: 상품 A의 수량을 4로 바꾸려 시도하고 카트 API가 400을 반환한다
- Then: 상품 A 줄에 거부 사유 문구가 표시되고, 화면의 카트 상태는 여전히 상품 A 수량 2·상품 B 수량 1로 남아 있다(거부된 값이 반영되지 않음, 상품 B도 영향 없음).

**AC-STOREFRONT-021** — 항목 삭제 (REQ-STOREFRONT-021)
- Given: 상품 A·상품 B가 담긴 장바구니 화면
- When: 상품 A를 삭제한다
- Then: `DELETE /api/cart/items/:itemId` 호출 후 응답으로 화면이 갱신되어 상품 A는 사라지고 상품 B와 소계는 정상 값으로 남는다.

**AC-STOREFRONT-022** — 체크아웃 진입 (REQ-STOREFRONT-022)
- Given: 항목이 하나 이상 있는 장바구니 화면
- When: 화면을 렌더한다
- Then: `/checkout`으로 이동하는 링크/버튼이 존재한다. 항목이 0개인 화면(AC-STOREFRONT-017)에는 이 진입 동작이 존재하지 않는다.

**AC-STOREFRONT-023** — 장바구니 화면의 경계 (REQ-STOREFRONT-023)
- Given: 장바구니 화면 소스
- When: 정적 소스를 검사한다
- Then: 배송지·결제 수단 입력 필드, `fetch("/api/orders"...)` 호출 패턴이 매치 0건이다.

**AC-STOREFRONT-024** — 담기 컨트롤 표시 (REQ-STOREFRONT-024)
- Given: 재고가 있는 상품 상세 화면
- When: 화면을 렌더한다
- Then: 수량 입력(기본값 1)과 담기 버튼이 존재한다.

**AC-STOREFRONT-025** — 담기 성공 시 확인 및 링크 (REQ-STOREFRONT-025)
- Given: 재고가 충분한 상품의 상세 화면
- When: 수량 2로 담기를 실행하고 `POST /api/cart/items`가 200을 반환한다
- Then: 성공 문구가 표시되고 `/cart`로 이동하는 링크가 나타나며, 페이지는 여전히 상품 상세 화면이다(내비게이션 없음).

**AC-STOREFRONT-026** — 담기 실패 시 사유 표시 (REQ-STOREFRONT-026)
- Given: 재고가 3인 상품의 상세 화면
- When: 수량 5로 담기를 시도하고 API가 400을 반환한다
- Then: 실패 사유 문구가 상품 상세 화면 안에 표시되고, 화면 이동이 발생하지 않는다.

**AC-STOREFRONT-027** — 품절 상품의 담기 버튼 비활성화 (REQ-STOREFRONT-027)
- Given: 현재 재고가 0인 상품의 상세 화면
- When: 화면을 렌더한다
- Then: 담기 버튼이 `disabled` 상태이며, 버튼을 눌러도 `POST /api/cart/items` 요청이 발생하지 않는다(스파이로 호출 0회 확인).

**AC-STOREFRONT-028** — 체크아웃 스타일 정리 후 기능 무회귀 (REQ-STOREFRONT-028)
- Given: 이 SPEC 착수 전 체크아웃 관련 기존 테스트 스위트(SPEC-ORDER-001·SPEC-PAYMENT-001·SPEC-DISCOUNT-001이 작성한 것)
- When: 체크아웃 6개 파일의 스타일 정리를 적용한 뒤 그 테스트 스위트를 재실행한다
- Then: 전체 테스트가 무회귀로 통과한다(폼 제출·쿠폰 적용·결제 버튼 클릭·오류 표시 동작이 정리 전과 동일).

**AC-STOREFRONT-029** — 체크아웃 파일의 diff가 스타일 표기로만 한정됨 (REQ-STOREFRONT-029)
- Given: 체크아웃 6개 파일에 대한 이 SPEC의 최종 diff
- When: 각 파일의 diff에서 JSX `className` 리터럴이 아닌 줄(함수 시그니처, 훅 호출, 이벤트 핸들러 본문, import 목록)을 사람이 검토한다
- Then: 그런 줄의 추가/삭제가 0건이다(plan.md §E의 JSX 구조 래핑 예외만 허용).

**AC-STOREFRONT-030** — 접근성 (REQ-STOREFRONT-030)
- Given: 렌더된 장바구니 화면과 담기 컨트롤
- (a) When: Tab 키로 수량 스테퍼와 삭제 버튼에 순차 이동한다 → Then: 각 컨트롤에 포커스가 도달하고 Enter/Space로 활성화된다(role 검사 + `focus()` 후 `document.activeElement` 일치).
- (b) When: 각 컨트롤의 접근 가능한 이름을 조회한다 → Then: 수량 변경·삭제 버튼이 대상 상품명을 포함한 라벨을 갖는다(예: `aria-label="상품 A 삭제"`).
- (c) When: 장바구니의 상품 이미지 `alt` 속성을 조회한다 → Then: 모든 이미지 `alt`가 비어 있지 않고 상품명을 포함한다.

## §2. 엣지 케이스

| 케이스 | 기대 동작 |
|---|---|
| 게스트 쿠키가 변조되어 존재하지 않는 카트를 가리킴 | CART-001 §2.6과 동일하게 빈 카트로 취급, 크래시 금지(REQ-STOREFRONT-017과 동일 경로) |
| 수량 변경 요청 중 네트워크 오류(응답 자체를 못 받음) | `PATCH`/`POST` 실패와 동일하게 처리 — 오류 문구 표시, 상태 불변(§D) |
| 담기 수량 입력에 소수·음수·비정수 문자열 입력 | 클라이언트 측에서 정수 하한 1로 정규화하거나 제출을 막음; 서버가 어차피 400으로 거부하므로 이중 방어(REQ-CART-007) |
| 장바구니 화면에서 마지막 남은 항목을 삭제 | 삭제 후 화면이 AC-STOREFRONT-017의 빈 카트 안내로 전환됨(별도 리로드 없이) |
| 담기 성공 직후 같은 상품을 다시 담기 | CART-001 REQ-CART-006(증분)에 따라 기존 수량에 더해짐 — 이 화면은 그 의미론을 재정의하지 않음 |
| 체크아웃 스타일 정리 중 특정 파일에서 로직 변경 없이는 요구되는 시각 결과를 낼 수 없는 경우 | plan.md §J에 따라 멈추고 보고 — 임의로 REQ-STOREFRONT-029의 경계를 넘지 않음 |

## §3. 품질 게이트

- 전체 테스트 통과(`npm run test:coverage`), 회귀 0건(기존 인증·카탈로그·카트·주문·결제·할인 API 및 컴포넌트 영향 없음 — 특히 AC-STOREFRONT-028).
- 신규/수정 `.tsx`·`.ts` 파일 커버리지 ≥85%(lines/functions/statements), ≥80%(branches) — `coverage_exemptions.enabled: false`로 면제 경로 없음.
- 타입 검사(`npx tsc --noEmit`) exit 0.
- 린트(`npm run lint`) exit 0, 신규 이슈 0건.
- 체크아웃 6개 파일: `git diff --stat` 확인 + AC-STOREFRONT-029의 수동 diff 검토 기록.
- Definition of Done: REQ-STOREFRONT-016~030 전체가 위 AC로 커버되고 PASS 또는 (환경 제약에 한해) 명시적으로 기록된 PARTIAL 상태로 종결된다 — 조용한 생략 없음.

## §4. REQ ↔ AC 매핑 표 (명시적 커버리지 확인)

| REQ | AC |
|---|---|
| REQ-STOREFRONT-016 | AC-STOREFRONT-016 |
| REQ-STOREFRONT-017 | AC-STOREFRONT-017 |
| REQ-STOREFRONT-018 | AC-STOREFRONT-018 |
| REQ-STOREFRONT-019 | AC-STOREFRONT-019 |
| REQ-STOREFRONT-020 | AC-STOREFRONT-020 |
| REQ-STOREFRONT-021 | AC-STOREFRONT-021 |
| REQ-STOREFRONT-022 | AC-STOREFRONT-022 |
| REQ-STOREFRONT-023 | AC-STOREFRONT-023 |
| REQ-STOREFRONT-024 | AC-STOREFRONT-024 |
| REQ-STOREFRONT-025 | AC-STOREFRONT-025 |
| REQ-STOREFRONT-026 | AC-STOREFRONT-026 |
| REQ-STOREFRONT-027 | AC-STOREFRONT-027 |
| REQ-STOREFRONT-028 | AC-STOREFRONT-028 |
| REQ-STOREFRONT-029 | AC-STOREFRONT-029 |
| REQ-STOREFRONT-030 | AC-STOREFRONT-030 (a/b/c) |
