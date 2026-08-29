# Acceptance Criteria: SPEC-CART-001 — 장바구니 및 게스트→회원 카트 병합

Tier M — AC 상한 16개 이내(현재 15개). REQ-CART-001~015 전체가 아래 AC로 커버된다(§4 REQ↔AC 매핑 표 참고).

## §1. Given-When-Then 시나리오

**AC-CART-001** — 데이터 모델 무결성 (REQ-CART-001)
- Given: 상품 카탈로그에 재고가 있는 상품이 존재한다
- When: 담기 요청 후 `GET /api/cart`를 호출한다
- Then: 응답의 카트 항목이 해당 상품의 `productId`와 요청한 `quantity`를 정확히 참조한다.

**AC-CART-002** — Bearer 토큰이 회원 카트로 해석됨 (REQ-CART-003)
- Given: 유효한 액세스 토큰을 가진 로그인 사용자
- When: 동일 토큰으로 서로 다른 두 요청(예: 담기 후 조회)을 보낸다
- Then: 두 요청 모두 동일한 카트(`userId` 기준)를 조작/조회한다 — 두 번째 요청에서 첫 번째 요청의 담기 결과가 보인다.

**AC-CART-003** — 무인증 요청은 게스트 쿠키로 해석되고, 발급된 쿠키가 이후 요청에서 재사용됨 (REQ-CART-003)
- Given: `Authorization` 헤더도 없고 `guest_cart_id` 쿠키도 없는 최초 요청
- When: `GET /api/cart`를 호출한다
- Then: 응답에 새 `guest_cart_id` 쿠키가 설정된다. 그 쿠키 값을 담아 담기 요청 후 다시 조회하면, 동일한 게스트 카트에 담긴 항목이 보인다.

**AC-CART-004** — 게스트 쿠키 속성 (REQ-CART-004)
- Given: 새로 발급된 `guest_cart_id` 쿠키
- When: 쿠키 옵션과 이름을 검사한다
- Then: `httpOnly: true`, 이름이 `refresh_token`/`csrf_token`/`oauth_state`와 다르며, 만료(maxAge)가 리프레시 토큰의 기본 30일과 다른 독립적인 값(기본 14일)으로 설정되어 있다.

**AC-CART-005** — 활동 이력 없는 조회는 DB 행 생성 없이 빈 카트 반환 (REQ-CART-005, REQ-CART-006 지연 생성)
- Given: 아직 담기 요청을 한 번도 하지 않은 신원(게스트 또는 회원)
- When: `GET /api/cart`를 호출한다
- Then: 응답 200, `{ items: [], subtotal: 0, itemCount: 0 }`. 이 신원에 대한 `Cart` 행이 DB에 생성되지 않는다(§2.6 지연 생성 검증 — 리포지토리 계층 조회로 확인).

**AC-CART-006** — 담기 시 항목 생성 및 소계 반영 (REQ-CART-005, REQ-CART-006)
- Given: 가격 `39000`, 재고 `10`인 상품
- When: `POST /api/cart/items`로 `{ productId, quantity: 2 }`를 요청한다
- Then: 응답 200(전체 카트 형태), 새 카트 항목이 `quantity: 2`로 생성되고, `subtotal`이 `78000`(2 × 39000, 상품의 **현재** 가격 기준)이다.

**AC-CART-007** — 같은 상품 재담기는 수량 증분(신규 행 아님) (REQ-CART-006)
- Given: 이미 상품 A가 수량 2로 담긴 카트
- When: 동일 상품 A를 `quantity: 3`으로 다시 담는다
- Then: 응답 200, 카트에는 상품 A 항목이 하나만 존재하며 수량이 `5`(2+3)다 — 중복 행이 생기지 않는다.

**AC-CART-008** — 재고 초과 담기는 거부됨 (REQ-CART-007)
- Given: 재고가 `3`인 상품
- When: `POST /api/cart/items`로 `{ productId, quantity: 4 }`를 요청한다
- Then: 응답 400, 어떤 카트 항목도 생성/변경되지 않는다(이후 `GET /api/cart`에 해당 상품이 없거나 이전 수량 그대로다).

**AC-CART-009** — 수량 변경은 절대값 설정 (REQ-CART-008)
- Given: 재고 `10`, 현재 수량 `2`로 담긴 상품 A
- When: `PATCH /api/cart/items/:itemId`로 `{ quantity: 5 }`를 요청한다
- Then: 응답 200, 상품 A의 수량이 정확히 `5`다(2+5=7이 아님 — 담기와 다른 의미론).

**AC-CART-010** — 항목 삭제는 다른 항목에 영향 없음 (REQ-CART-009)
- Given: 상품 A, 상품 B가 함께 담긴 카트
- When: 상품 A의 카트 항목을 `DELETE /api/cart/items/:itemId`로 삭제한다
- Then: 응답 200, 카트에는 상품 B만 남아 있고 수량은 변경되지 않았다.

**AC-CART-011** — 존재하지 않거나 남의 카트 항목 대상 요청은 404 (REQ-CART-010)
- Given: 신원 X의 카트에 속하지 않는(또는 아예 존재하지 않는) `itemId`
- When: 신원 X로 `PATCH` 또는 `DELETE`를 그 `itemId`에 요청한다
- Then: 응답 404, 신원 X의 카트도 다른 어떤 카트도 변경되지 않는다.

**AC-CART-012** — 로그인 시 병합: 합산 + 재고 클램프 + 미겹침 항목 이관 (REQ-CART-011, REQ-CART-012)
- Given: 게스트 카트에 상품 A(수량 3), 상품 C(수량 1)가, 기존 회원 카트에 상품 A(수량 2), 상품 B(수량 1)가 있다. 상품 A의 현재 재고는 4.
- When: 이 게스트 쿠키를 가진 상태로 로그인에 성공한다(이메일/비밀번호 또는 Google 무관)
- Then: 로그인 후 회원 카트에는 상품 A(수량 4 — 3+2=5가 재고 4로 클램프됨), 상품 B(수량 1, 변경 없음), 상품 C(수량 1, 새로 이관됨) 3개 항목이 존재한다.

**AC-CART-013** — 병합 시 재고 소진 상품은 항목으로 남지 않음 (REQ-CART-012, REQ-CART-002)
- Given: 게스트 카트에 상품 D(수량 2)가 있고, 상품 D의 현재 재고가 `0`이다
- When: 로그인에 성공해 병합이 실행된다
- Then: 병합된 회원 카트에 상품 D 항목이 전혀 존재하지 않는다(수량 0으로 남지 않고 완전히 생략됨).

**AC-CART-014** — 병합 후 게스트 카트는 재사용되지 않음(멱등) (REQ-CART-013)
- Given: 게스트 카트가 성공적으로 병합되어 회원 카트로 반영된 상태
- When: 같은(이제는 유효하지 않은) `guest_cart_id` 쿠키 값을 담아 다시 로그인 성공 흐름을 실행한다(예: 세션 만료 후 재로그인)
- Then: 두 번째 병합은 아무 항목도 추가하지 않는다(회원 카트 수량이 변하지 않음) — 이미 병합된 항목이 중복 반영되지 않는다.

**AC-CART-015** — 게스트 무인증 접근 및 재고 비차감 확인 (REQ-CART-014, REQ-CART-015)
- Given: `Authorization` 헤더가 전혀 없는 요청
- When: 그 상태로 담기/조회/수량변경/삭제 4개 작업을 모두 수행한다
- Then: 4개 작업 모두 401 없이 정상 처리된다(REQ-CART-014). 그리고 담기 직후 `GET /api/products/:id`로 해당 상품을 조회하면 `stock` 값이 담기 이전과 동일하다 — 카트 작업이 상품 재고를 차감하지 않는다(REQ-CART-015).

**AC-CART-016** — 수량변경으로 재고 초과 요청은 거부됨 (REQ-CART-007)
- Given: 재고 N인 상품이 카트에 quantity M(<N)으로 담겨 있다
- When: `PATCH /api/cart/items/:itemId`로 `{ quantity: N+1 }` 이상을 요청한다
- Then: 응답 400, 카트 항목 수량이 변경되지 않는다(REQ-CART-007).

## §2. 엣지 케이스

| 케이스 | 기대 동작 |
|---|---|
| 존재하지 않는 `productId`로 담기 | 400, 카트 변경 없음(REQ-CART-007) |
| `quantity: 0` 또는 음수 또는 소수/문자열로 담기·수량변경 | 400, 카트 변경 없음(REQ-CART-007) — "0으로 낮추기"는 반드시 `DELETE`로 표현(plan.md §2.5) |
| 게스트 쿠키 값이 존재하지 않는 카트를 가리킴(변조/만료 후 재사용) | 오류 없이 새 게스트 카트로 취급(§2.6 지연 생성과 동일하게 처리, 크래시 금지) |
| 게스트 카트도 회원 카트도 없는 상태에서 로그인 | 병합은 아무 것도 하지 않는 no-op |
| 게스트 카트만 있고 회원 카트가 없는 첫 로그인 | 게스트 카트가 회원 카트로 승격(소유권 이전) — 항목 수량·구성은 그대로 유지(plan.md §2.3) |
| `search`류 매우 큰 `quantity` 값(예: 999999999) | 재고 초과로 400(REQ-CART-007) — 서버 오류를 일으키지 않아야 함 |

## §3. 품질 게이트

- 전체 테스트 통과(`npx vitest run --coverage`), 회귀 0건(기존 인증/카탈로그 API 영향 없음).
- `src/features/cart/**`, `src/lib/auth/guest-identity.ts` 변경 파일 커버리지 ≥85%(기존 카탈로그/인증 SPEC 기준과 동일).
- 타입 검사(`npx tsc --noEmit`) exit 0.
- 린트(`npx eslint .`) exit 0, 신규 이슈 0건.
- 스키마 유효성(`npx prisma validate`) exit 0.
- Definition of Done: REQ-CART-001~015 전체가 위 AC로 커버되고, PASS 또는 (환경 제약에 한해) 명시적으로 기록된 PARTIAL 상태로 종결된다 — 조용한 생략 없음.

## §4. REQ ↔ AC 매핑 표 (명시적 커버리지 확인)

| REQ | AC |
|---|---|
| REQ-CART-001 | AC-CART-001 |
| REQ-CART-002 | AC-CART-013 |
| REQ-CART-003 | AC-CART-002, AC-CART-003 |
| REQ-CART-004 | AC-CART-004 |
| REQ-CART-005 | AC-CART-005, AC-CART-006 |
| REQ-CART-006 | AC-CART-005, AC-CART-006, AC-CART-007 |
| REQ-CART-007 | AC-CART-008, AC-CART-016 |
| REQ-CART-008 | AC-CART-009 |
| REQ-CART-009 | AC-CART-010 |
| REQ-CART-010 | AC-CART-011 |
| REQ-CART-011 | AC-CART-012 |
| REQ-CART-012 | AC-CART-012, AC-CART-013 |
| REQ-CART-013 | AC-CART-014 |
| REQ-CART-014 | AC-CART-015 |
| REQ-CART-015 | AC-CART-015 |
