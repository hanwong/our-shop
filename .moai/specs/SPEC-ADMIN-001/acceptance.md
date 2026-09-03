# Acceptance: SPEC-ADMIN-001 — 관리자 주문 목록·상태 변경 백오피스

REQ-ADMIN-001 ~ 018 (18건) 전부가 AC-ADMIN-001 ~ 018 (18건)로 1:1 대응된다.

---

**AC-ADMIN-001** — 유효한 관리자 리프레시 쿠키는 관리자로 판정된다
- **Given** `role: admin`인 `User`에 귀속되고 폐기·만료되지 않은 `RefreshToken` 행이 있을 때
- **When** 그 값을 리프레시 토큰 쿠키로 제시하며 `resolveAdminSession()`을 호출하면
- **Then** `{ userId, role: "admin" }`을 반환한다
- **Traces**: REQ-ADMIN-001

**AC-ADMIN-002** — 회전을 트리거하지 않는다
- **Given** AC-ADMIN-001과 동일한 유효 쿠키가 있을 때
- **When** `resolveAdminSession()`을 호출하면
- **Then** 그 호출 전후로 대상 `RefreshToken` 행의 `id`·`tokenHash`·`revokedAt`이 변경되지 않고, 새 `RefreshToken` 행이 생성되지 않는다
- **Traces**: REQ-ADMIN-002

**AC-ADMIN-003** — 무효 세션은 사유 구분 없이 거부된다
- **Given (a)** 쿠키가 아예 없을 때, **(b)** 만료된 리프레시 토큰일 때, **(c)** 폐기(`revokedAt` 설정)된 토큰일 때, **(d)** 유효하지만 `role: customer`인 토큰일 때
- **When** 관리자 페이지 또는 관리자 API에 요청하면
- **Then** 네 경우 모두 동일한 거부 응답(같은 상태 코드·같은 리다이렉트 대상 또는 같은 오류 코드)을 받으며, 응답으로 네 사유를 구별할 수 없다
- **Traces**: REQ-ADMIN-003

**AC-ADMIN-004** — 로그인 화면은 기존 API를 그대로 호출한다
- **Given** `/staff/login`이 렌더링되어 있을 때
- **When** 이메일·비밀번호를 입력해 제출하면
- **Then** 요청이 `POST /api/auth/login`으로 전송되며, 그 요청 바디·헤더가 기존 로그인 폼이 이미 보내는 것과 동일한 형태다(새 로그인 엔드포인트를 만들지 않았음을 네트워크 요청으로 확인)
- **Traces**: REQ-ADMIN-004

**AC-ADMIN-005** — 관리자 로그인 성공은 목록으로 이동한다
- **Given** `role: admin`인 계정의 자격 증명이 있을 때
- **When** `/staff/login`에서 로그인을 제출하면
- **Then** `/staff/orders`로 이동한다
- **Traces**: REQ-ADMIN-005

**AC-ADMIN-006** — 비관리자 로그인은 진입이 거부된다
- **Given** `role: customer`인 계정의 유효한 자격 증명이 있을 때
- **When** `/staff/login`에서 로그인을 제출하면
- **Then** 로그인 자체는 성공(자격 증명 유효)하지만 관리자 목록·상세 어떤 데이터도 응답 본문에 포함되지 않으며, 진입이 거부됨을 알리는 화면을 받는다
- **Traces**: REQ-ADMIN-006

**AC-ADMIN-007** — 전체 주문이 게스트 귀속과 무관하게 목록에 나온다
- **Given** 서로 다른 게스트 신원에 귀속된 주문 3건이 있을 때
- **When** 관리자 세션으로 `/staff/orders`에 진입하면
- **Then** 3건 전부가 목록에 나타나며, 각 행에 주문번호·상태·수령인 이름·총액·주문일시가 표시된다
- **Traces**: REQ-ADMIN-007

**AC-ADMIN-008** — 상태 필터가 적용된다
- **Given** `pending_payment` 2건, `paid` 1건, `cancelled` 1건인 주문이 있을 때
- **When** 상태 필터를 `paid`로 지정해 목록을 조회하면
- **Then** `paid` 상태인 1건만 반환된다
- **Traces**: REQ-ADMIN-008

**AC-ADMIN-009** — 페이지네이션이 카탈로그 관례를 따른다
- **Given** 주문이 `pageSize`보다 많이 있을 때
- **When** `page=1`·`page=2`로 각각 조회하면
- **Then** 두 페이지의 항목 집합이 겹치지 않고, 응답 형태(`items`/`page`/`pageSize`/`total` 등 필드 이름)가 `product-repository.ts`의 기존 목록 조회 응답 구조와 동일한 패턴이다
- **Traces**: REQ-ADMIN-009

**AC-ADMIN-010** — 상세 화면이 필요한 정보를 모두 보여준다
- **Given** 항목 2개짜리 주문 1건이 있을 때
- **When** 관리자 세션으로 그 주문 상세에 진입하면
- **Then** 배송지 스냅샷, 항목별 상품명·단가·수량, 상품 합계·배송비·총액, 현재 상태가 모두 표시된다
- **Traces**: REQ-ADMIN-010

**AC-ADMIN-011** — 결제 민감 정보가 노출되지 않는다
- **Given** `paymentKey`가 설정된 `paid` 주문이 있을 때
- **When** 관리자 상세를 조회하면
- **Then** 응답 본문·렌더링된 HTML 어디에도 `paymentKey` 값이나 카드번호류 필드가 존재하지 않는다
- **Traces**: REQ-ADMIN-011

**AC-ADMIN-012** — 허용된 전이만 상태 변경 UI에 제시된다
- **Given** `pending_payment` 상태 주문 1건과 `paid` 상태 주문 1건이 있을 때
- **When** 각각의 상세 화면을 열면
- **Then** 두 화면 모두 "취소" 조작만 제시되며, "결제완료로 변경" 같은 조작은 어디에도 나타나지 않는다
- **Traces**: REQ-ADMIN-012

**AC-ADMIN-013** — 정의되지 않은 전이는 거부되고 부작용이 없다
- **Given** 이미 `cancelled`인 주문이 있을 때
- **When** 그 주문에 취소 상태 변경을 다시 요청하면(또는 `paid`로의 전이를 직접 API에 요청하면)
- **Then** 요청이 거부되고, 주문 상태·상품 재고·`PaymentAuditLog` 행 수가 요청 전후로 전혀 변하지 않는다
- **Traces**: REQ-ADMIN-013

**AC-ADMIN-014a** — `pending_payment` 취소가 재고를 복원한다
- **Given** 재고가 이미 차감된 `pending_payment` 주문(항목 1개, 수량 2)이 있을 때
- **When** 관리자가 그 주문을 취소하면
- **Then** 주문 상태가 `cancelled`가 되고, 해당 상품 재고가 정확히 2 증가한다
- **Traces**: REQ-ADMIN-014

**AC-ADMIN-014b** — `paid` 취소가 재고와 쿠폰 사용분을 복원한다
- **Given** 쿠폰이 적용된 `paid` 주문이 있을 때
- **When** 관리자가 그 주문을 취소하면
- **Then** 주문 상태가 `cancelled`가 되고, 재고가 항목 수량만큼 복원되며, 그 쿠폰의 `redeemedCount`가 1 감소한다(`SPEC-PAYMENT-001`의 웹훅 취소가 만드는 결과와 동일)
- **Traces**: REQ-ADMIN-014

**AC-ADMIN-015** — 취소마다 감사 로그가 정확히 하나 기록된다
- **Given** 취소 전 특정 주문의 `PaymentAuditLog` 행 수를 N이라 할 때
- **When** 관리자가 그 주문을 취소하면
- **Then** 그 주문의 로그 행 수가 정확히 N+1이 되고, 새 행의 `source`는 `CONFIRM_API`도 `WEBHOOK`도 아닌 관리자 전용 값이다
- **Traces**: REQ-ADMIN-015

**AC-ADMIN-016** — CSRF 방지 없는 상태 변경 요청은 거부된다
- **Given** 유효한 관리자 리프레시 쿠키는 있지만 CSRF 토큰(더블서브밋/synchronizer, `src/lib/auth/csrf.ts` 방식)이 없거나 불일치하는 요청이 있을 때
- **When** `PATCH /admin/api/orders/[orderId]/status`를 호출하면
- **Then** 요청이 거부되고 주문 상태가 변하지 않는다
- **Traces**: REQ-ADMIN-016

**AC-ADMIN-017** — 상태 변경마다 세션이 다시 판정된다
- **Given** 관리자로 로그인한 뒤 그 사이 서버에서 해당 리프레시 토큰이 폐기되었을 때
- **When** 이미 열려 있던 상세 화면에서 상태 변경을 제출하면
- **Then** 페이지 진입 시점의 판정 결과를 재사용하지 않고 다시 판정해, 거부된다
- **Traces**: REQ-ADMIN-017

**AC-ADMIN-018** — 기존 파일이 변경되지 않는다
- **Given** 이 SPEC 구현 완료 시점이 있을 때
- **When** `git diff <base>..HEAD -- src/middleware.ts src/lib/auth/ src/app/api/auth/ src/features/payments/repositories/payment-repository.ts`를 실행하면
- **Then** 출력이 비어 있다(diff 0줄)
- **Traces**: REQ-ADMIN-018

---

## 잠재적 §0 제외 후보

- **AC-ADMIN-EXCL-CONCURRENCY**: 두 관리자가 같은 주문을 동시에 취소하는 경쟁 상황은 `SPEC-ORDER-002`가 이미 확립한 조건부 원자 갱신(`updateMany` where 조건에 현재 상태 포함)으로 자연히 막히지만, 그 직렬화의 실제 관측(살아있는 PostgreSQL 필요)은 이 SPEC의 자동 DoD에서 제외한다 — `SPEC-ORDER-002`의 `AC-013-EXCL-CONCURRENCY`와 동일한 성격의 제외이며, 조건부 갱신 형태 자체는(row-level where 조건에 소스 상태 포함) 정적 코드 검사로 확인한다.

## Definition of Done

- [ ] AC-ADMIN-001 ~ 018 (AC-ADMIN-014는 a/b 두 하위 관측 포함) 전부 PASS.
- [ ] `src/middleware.ts` diff 0줄(AC-ADMIN-018).
- [ ] `npm run typecheck` exit 0.
- [ ] `npm run lint` exit 0, 신규 이슈 0건.
- [ ] `npm test` 전체 스위트 무회귀.
- [ ] 신규/수정 파일 커버리지 ≥85%(statements/lines/functions), ≥80%(branches) — 프로젝트 전역 임계값과 동일.
- [ ] `PaymentEventSource.ADMIN_ACTION` 추가를 반영한 Prisma 마이그레이션이 존재하고 적용된다.
