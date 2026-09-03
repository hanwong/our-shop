---
id: SPEC-STOREFRONT-002
status: completed
updated: 2026-09-03
tier: M
---

# Plan: SPEC-STOREFRONT-002 — 장바구니 화면·담기 UI 및 체크아웃 스타일 정리

> 섹션 순서는 **되돌리기 어려운 결정 순**이다. §A~§E는 나중에 바꾸면 비용이 큰 결정(상태 소유 컴포넌트 경계, 서버 응답 소비 방식, 수량 조작 의미론, 오류 표시 방식, 체크아웃 리스타일 경계)이고, §F 이후는 구조·마일스톤·잔여 위험이다.

---

## §A. 장바구니 상호작용 상태는 어디에 사는가 — 단일 클라이언트 컴포넌트

가장 되돌리기 어려운 결정이다. SPEC-ORDER-001의 `CheckoutInteractive`(SPEC-DISCOUNT-001 M6b가 추가)가 이미 같은 문제를 풀어 두었다 — 쿠폰 적용 결과가 `OrderSummary`와 `CheckoutForm` 양쪽에 영향을 줘야 했고, 서버 컴포넌트는 클라이언트 상태를 가질 수 없으며 독립된 두 클라이언트 컴포넌트는 공통 소유자 없이 상태를 공유할 수 없었다. 그래서 하나의 클라이언트 컴포넌트가 상태를 소유하고 자식들에게 값을 내려주는 패턴을 채택했다.

이 SPEC의 장바구니 화면도 같은 모양이다 — 수량 변경·삭제가 각 품목 줄의 표시와 화면 하단 소계 양쪽에 영향을 준다. **결정: `CartView`라는 단일 클라이언트 컴포넌트(`"use client"`)가 카트 상태(`CartDTO`)를 `useState`로 소유하고, 초기값은 서버 컴포넌트(`/cart` 페이지)가 첫 렌더에 이미 채운 값을 그대로 받는다.** 개별 품목 줄을 별도 컴포넌트로 쪼개지 않는다 — 품목 수가 적고(장바구니는 통상 한 자릿수 항목), 쪼개면 상태를 다시 끌어올려야 하는 문제가 생기며 얻는 것이 없다(constitution Enforce Simplicity).

담기 버튼(`AddToCartButton`)은 장바구니 상태와 공유할 것이 없다 — 상품 상세 화면에 있고 장바구니 화면과 같은 렌더 트리에 있지 않다. 그래서 **별도의, 그 자신만의 지역 상태(성공/실패/제출 중)를 가진 독립 클라이언트 컴포넌트**로 만든다. `CheckoutForm`이 카트 상태와 무관하게 독립적으로 자기 상태를 가지는 것과 같은 모양이다.

## §B. 서버 응답 소비 방식 — 재조회 없이 응답으로 전체를 교체한다

SPEC-CART-001 plan.md §3이 이미 세운 계약: 담기·수량변경·삭제 3개 변경 엔드포인트 모두 `GET /api/cart`와 동일한 **전체 카트 형태**를 응답으로 반환한다. **결정: `CartView`의 모든 변경 핸들러(수량변경·삭제)는 성공 응답의 JSON 본문을 그대로 `setCart()`에 넣는다.** 별도로 `GET /api/cart`를 다시 호출하지 않는다 — 그 요청 자체가 이미 최신 전체 상태를 담고 있으므로 재조회는 불필요한 왕복이다.

`AddToCartButton`도 같은 계약을 소비한다 — `POST /api/cart/items`의 응답이 전체 카트를 담고 있으므로, 성공 문구에 표시할 "장바구니에 담긴 총 개수"(`itemCount`)는 그 응답에서 직접 읽는다. 별도 조회를 하지 않는다.

## §C. 수량 조작 의미론 — 절대값 설정, 즉시 커밋, 소프트 상한

SPEC-CART-001의 두 엔드포인트는 다른 의미론을 가진다 — `POST /items`(담기)는 증분, `PATCH /items/:id`(수량변경)는 절대값 설정이다(CART-001 plan.md §2.5). 이 SPEC은 그 의미론을 화면에서 뒤집지 않는다.

- **장바구니 화면의 +/- 스테퍼는 클릭마다 `PATCH`를 절대값으로 즉시 제출한다.** "적용" 버튼을 별도로 두지 않는다 — 사용자가 수량을 두 번 이상 클릭한 뒤에야 반영되는 지연은 즉시 반영보다 직관성이 떨어지고, 별도 "적용" 상태를 관리하는 복잡도를 정당화할 근거가 없다(YAGNI). 디바운스도 도입하지 않는다 — 트래픽·경합 문제가 현재 규모에서 관측되지 않았고, 최종 정합성은 서버(재고 조건부 갱신)가 항상 강제한다.
- **상품 상세의 수량 입력은 기본값 1, 하한 1의 정수 입력이며, 담기 버튼을 눌러야 `POST`가 나간다.** 담기는 소계에 즉시 영향을 주지 않는 별도 화면(상품 상세)에서 일어나므로, 장바구니 스테퍼와 달리 명시적 제출 동작이 자연스럽다.
- **재고를 넘는 클릭은 소프트하게 막는다** — 스테퍼의 "+"는 현재 알고 있는 `stock`(카트 응답이 함께 보내주는 값)에 도달하면 비활성화되지만, 이것은 UX 힌트일 뿐이다. 다른 탭·다른 방문자가 동시에 재고를 줄였다면 서버가 그 시점의 진짜 재고로 다시 판정하며(REQ-CART-007), 그 결과는 §D의 오류 표시로 흡수한다. 클라이언트가 재고를 확정적으로 아는 것처럼 행동하지 않는다.

## §D. 오류 표시 방식 — 그 자리에서, 비파괴적으로

SPEC-ORDER-001의 `CheckoutForm`이 이미 세운 패턴: 요청이 거부되면 그 컨트롤 안에 오류 문구를 표시하고, 이미 반영된 다른 상태는 건드리지 않는다. **결정: `CartView`와 `AddToCartButton` 둘 다 같은 패턴을 따른다.**

- `CartView`에서 어떤 항목의 `PATCH`/`DELETE`가 실패하면, 그 항목 줄에만 오류 문구를 표시하고(`role="alert"`), **`cart` 상태는 실패 이전 값 그대로 둔다** — 실패한 낙관적 갱신을 적용했다가 되돌리는 대신, 애초에 서버 응답을 받은 뒤에만 상태를 바꾼다(비관적 갱신). 이 선택으로 "적용했다가 롤백"의 깜빡임과 그 사이의 불일치 창을 원천적으로 없앤다 — 트레이드오프는 클릭과 화면 갱신 사이에 네트워크 왕복만큼의 지연이 보이는 것이며, 장바구니 규모(한 자릿수 항목)에서는 감내할 만하다.
- `AddToCartButton`에서 담기가 실패하면, 버튼 아래 오류 문구를 표시하고 페이지를 벗어나지 않는다. 성공 문구와 오류 문구는 같은 `role="status"`/`role="alert"` 영역을 공유하며 상호 배타적으로 렌더한다(직전 성공 문구가 다음 실패 시도 후에도 남아 있지 않도록).

## §E. 체크아웃 리스타일 경계 — 기계적으로 확인 가능한 규칙

REQ-STOREFRONT-029가 "마크업 구조와 Tailwind 클래스 표기만 허용"이라고 선언했지만, 이 선언이 검증 가능하려면 **기계적으로 판별하는 규칙**이 필요하다. **결정: 체크아웃 소유 6개 파일(`src/app/checkout/page.tsx`, `CheckoutForm.tsx`, `OrderSummary.tsx`, `CheckoutInteractive.tsx`, `CheckoutUnavailable.tsx`, `PayButton.tsx`)의 diff에서, `className` 문자열 리터럴이 아닌 줄의 추가/삭제는 원칙적으로 0줄이어야 한다.**

허용되는 예외 — 마크업 구조 변경이되 로직이 아닌 것 (JSX 태그 중첩/래핑, 예: 시각적 그룹핑을 위한 `<div>` 추가):

- `useState`/`useEffect`/`fetch`/이벤트 핸들러 함수 시그니처·본문의 변경은 diff에 0건이어야 한다.
- 위 6개 파일이 import하는 훅·타입·함수 목록은 변경 전후 동일해야 한다(단, JSX 구조 변경으로 새 HTML 요소를 감쌀 때 그 요소 자체는 허용).
- `acceptance.md` §4 DoD 항목으로 `git diff --stat` + 수동 diff 검토를 등재한다.

이 경계는 SPEC-ORDER-001 plan.md §4.1이 카트 리포지토리에 연 예외("이름으로 못 박은 함수 2개, 기존 호출부 diff 0줄")와 같은 정신이다 — 허용된 변경의 폭을 문서가 아니라 diff로 확인 가능하게 만든다.

## §F. 컴포넌트 구조와 파일 배치

| 컴포넌트/파일 | 위치 | 종류 | 책임 |
|---|---|---|---|
| `CartPage` | `src/app/cart/page.tsx` | 서버(async) | 게스트 쿠키 읽기 → `getCart()` 직접 호출(§B, STOREFRONT-001 plan.md §B 선례) → 뷰에 전달. 얇은 데이터 어댑터 |
| `CartView` | `src/components/cart/CartView.tsx` | **클라이언트**(`"use client"`) | 카트 상태 소유, 품목 목록·수량 스테퍼·삭제·소계·체크아웃 진입 버튼 렌더 |
| `EmptyCart` | `src/components/cart/EmptyCart.tsx` | 서버(순수) | REQ-STOREFRONT-017의 안내 화면 + 상품 목록 링크 |
| `AddToCartButton` | `src/components/product/AddToCartButton.tsx` | **클라이언트**(`"use client"`) | 수량 입력 + 담기 버튼 + 성공/실패 표시. `productId`·`stock`만 props로 받음 |

기존 파일 EXTEND(마크업/스타일만, §E):

| 파일 | 변경 내용 |
|---|---|
| `src/app/products/[productId]/page.tsx` | `AddToCartButton`을 `ProductDetailView` 옆에 조립(§F 표와 동일하게 얇은 조립). `product.stock`을 그대로 넘긴다 |
| `src/app/checkout/page.tsx` 외 5개 체크아웃 컴포넌트 | Tailwind 클래스 정리만(§E) |

`src/components/cart/` 배치는 `structure.md`가 제안한 `components/<domain>/` 원칙과 SPEC-STOREFRONT-001이 세운 `components/product/` 선례를 그대로 따른다.

## §G. Tier 및 Conditional Design Route 판정

### Tier: M

| 축 | 추정 | 근거 |
|---|---|---|
| 변경 파일 수 | 약 13~14개 (신규 4 + 상품 상세 조립 1 + 체크아웃 스타일 6 + 테스트 3~4) | Tier M 가이드(5~15) 이내 |
| LOC | 약 300~600 | Tier M 구간(300~1000) 하단 — 체크아웃 6개 파일은 클래스 표기만 바뀌므로 각 파일 diff가 작다 |
| 요구사항 수 | 15개 | Tier M 상한 16 이내 |
| 수락 기준 수 | 15개 | Tier M 상한 16 이내 |

스키마·백엔드 변경이 전혀 없다는 점(SPEC-STOREFRONT-001과 달리 새 Prisma 모델이나 라우트 핸들러 신설이 없음 — 기존 4개 카트 API 엔드포인트를 소비만 함)이 Tier L을 요구하지 않는 근거다.

### Route: `plan → design → run` (Conditional Design Route 적용)

`spec-workflow.md` § Conditional Design Route의 두 갈래 중 첫 번째가 만족된다 — `acceptance.md`가 화면(`/cart`)과 프런트엔드 컴포넌트(`CartView`, `EmptyCart`, `AddToCartButton`)를 명시적 산출물로 검증한다. 따라서 design phase가 적용된다.

design phase가 다룰 것으로 예상되는 항목: `CartView`의 품목 줄 레이아웃(모바일/데스크톱 분기점), 수량 스테퍼의 시각적 형태, 체크아웃 6개 파일의 구체적 Tailwind 클래스 정리안(§E 경계 안에서). 이 plan-phase에서는 판정만 기록하고 실행하지 않는다(design phase는 Implementation Kickoff Approval 이후 `manager-design`이 수행).

## §H. 마일스톤 (우선순위 기준, 시간 추정 없음)

`quality.yaml`의 `development_mode: tdd` + `test_first_required: true`에 따라 각 마일스톤은 RED → GREEN → REFACTOR로 진행한다.

| # | 우선순위 | 내용 | 완료 신호 |
|---|---|---|---|
| **M1** | High | `/cart` 서버 컴포넌트 + `EmptyCart` + `CartView`(초기 렌더만, 수량/삭제 상호작용 제외). REQ-016~018 | 게스트 쿠키 있음/없음/빈 카트/항목 있음 4개 분기 렌더 테스트 통과. 초기 렌더에 `fetch`/`useEffect` 데이터 로딩 코드 부재(정적 검사) |
| **M2** | High | `CartView` 수량 변경·삭제 상호작용(§B/§C/§D). REQ-019~021 | PATCH/DELETE 성공 시 응답으로 상태 갱신, 실패 시 해당 줄만 오류 표시 + 다른 상태 불변 — 각각 테스트로 확인 |
| **M3** | High | 체크아웃 진입 버튼(REQ-022) + 장바구니 범위 경계 정적 검사(REQ-023 — 배송/결제 필드·`fetch("/api/orders")` 부재) | 체크아웃 링크 href가 `/checkout`. 정적 검사 매치 0건 |
| **M4** | High | `AddToCartButton` + 상품 상세 조립(§F). REQ-024~027 | 성공/실패/재고 0 세 경로 테스트 통과, 성공 시 `/cart` 링크 존재 |
| **M5** | Medium | 체크아웃 6개 파일 스타일 정리(§E). REQ-028/029 | `git diff --stat` + non-className 라인 diff 0건 확인, 기존 체크아웃 테스트 스위트 전량 무회귀 통과 |
| **M6** | Medium | 접근성 마감(REQ-030), 커버리지 임계값 충족, 통합 테스트 | `npm run lint`/`typecheck`/`test:coverage` 전부 통과. 스테퍼/삭제 버튼 role + 키보드 조작 + alt 텍스트 단언 |

M1→M2→M3→M4는 의존 순서다. M5는 M1~M4와 독립적이라 병행 가능하나, 체크아웃이 참조하는 시각적 컨벤션이 M1~M4에서 먼저 확정되는 편이 일관성 확인에 유리해 마지막에 둔다.

## §I. 리스크

| # | 리스크 | 영향 | 완화 |
|---|---|---|---|
| R1 | `.tsx` 신규 산출물에 테스트 없이는 85% 커버리지 게이트를 통과할 수 없음(`coverage_exemptions.enabled: false`) | 높음 | §F 표의 신규 산출물 4개 전부에 M1~M4에서 테스트를 배정. STOREFRONT-001 R1과 동일한 완화 |
| R2 | §E의 "className 외 diff 0줄" 규칙이 체크아웃 하위 컴포넌트의 실제 필요(예: 레이아웃을 위한 wrapper `<div>` 추가)와 충돌할 수 있음 | 중간 | §E에 JSX 구조 변경(요소 추가/래핑)은 예외로 명시했다 — 금지되는 것은 로직·상태·이벤트 핸들러 변경뿐이다. 애매한 경우 멈추고 보고한다(§J) |
| R3 | 낙관적 갱신을 쓰지 않는 §D의 선택 때문에 체감 지연이 발생할 수 있음 | 낮음 | 장바구니 규모가 작고(한 자릿수 항목), 정합성이 체감 속도보다 우선한다는 판단(§D). 필요해지면 후속 SPEC에서 낙관적 갱신 + 롤백을 도입할 수 있다 |
| R4 | 상품 상세의 담기 버튼 조립이 SPEC-STOREFRONT-001의 클라이언트 경계 원칙("클라이언트 경계는 갤러리까지")과 충돌하는 것처럼 보일 수 있음 | 낮음 | 충돌이 아니라 확장이다 — `AddToCartButton`은 `ProductGallery`와 마찬가지로 페이지 전체가 아닌 자기 자신만 클라이언트 경계로 좁힌 별도 아일랜드다. `ProductDetailView`(순수 표시)는 여전히 서버 컴포넌트로 남는다 |
| R5 | 회원 신원 부재(§1)가 향후 SPEC에서 갑자기 채워지면(클라이언트 토큰 스토어 도입) 이 SPEC의 게스트 전용 경계가 좁아 보일 수 있음 | 낮음 | 수용된 잔여 위험. SPEC-ORDER-001이 이미 같은 판단을 내렸고(§0 #5), 이 SPEC은 그 판단을 뒤집지 않는다. 회원 지원이 필요해지면 별도 SPEC이 SPEC-AUTH-001과 함께 재설계한다 |

## §J. 안티패턴 — 하지 말 것

- **체크아웃 6개 파일에서 로직을 "개선"하기.** REQ-STOREFRONT-029가 금지한다. 리팩터가 필요해 보이면 멈추고 보고한다 — 이 SPEC의 위임 범위가 아니다.
- **`CartView` 안에서 낙관적 갱신 구현.** §D가 비관적 갱신을 명시적으로 선택했다.
- **장바구니 화면에서 배송지·결제 필드를 미리 준비.** REQ-STOREFRONT-023이 금지한다 — 체크아웃과의 경계를 흐린다.
- **`src/features/cart/**`를 수정.** 이 SPEC은 그 도메인을 소비만 한다(§1).
- **회원 신원 분기를 "미리 대비해" 추가.** §1에서 확인했듯 클라이언트 토큰 스토어가 없는 상태에서 회원 분기는 도달 불가능한 코드다(constitution — 도달 불가능한 방어 코드 금지, ORDER-001 §L 선례와 동일).
- **헤더·전역 내비게이션·장바구니 배지를 "이왕 만드는 김에" 추가.** §3 Out of Scope에서 명시적으로 제외했다.

## §K. 교차 참조

- `.moai/specs/SPEC-STOREFRONT-002/spec.md` — 요구사항(REQ-STOREFRONT-016~030), 도메인 선택 근거, Out of Scope
- `.moai/specs/SPEC-STOREFRONT-002/acceptance.md` — 수락 기준(AC-STOREFRONT-016~030)
- `.moai/specs/SPEC-CART-001/plan.md` §2.5, §3 — 담기=증분/수량변경=절대설정 의미론, 전체 카트 응답 계약
- `.moai/specs/SPEC-STOREFRONT-001/plan.md` §B, §F — 서버 컴포넌트가 서비스 직접 호출, 컴포넌트 분리 원칙
- `.moai/specs/SPEC-ORDER-001/plan.md` §0 #5 — 회원 체크아웃 제외 근거(이 SPEC이 상속)
- `.moai/specs/SPEC-DISCOUNT-001/spec.md` §4(체크아웃 UI), plan.md §0 확정 #1 — 체크아웃 스타일링 소유권을 이 SPEC(카드 t10)으로 넘긴 문서
- `src/app/checkout/page.tsx`, `src/components/checkout/*.tsx` — 이 SPEC이 EXTEND(스타일만)하는 기존 산출물
- `.claude/rules/moai/workflow/spec-workflow.md` § SPEC Complexity Tier, § Conditional Design Route — §G 판정 근거
