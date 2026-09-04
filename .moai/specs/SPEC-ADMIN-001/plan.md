# Plan: SPEC-ADMIN-001 — 관리자 주문 목록·상태 변경 백오피스

## §0. 결정 사항 (착수 전 확정 필요 — 사용자 확인 대상)

이 절은 plan-audit 이전에 사용자 확인이 필요한 항목을 모은다. 조사(research.md)로 근거는 이미 확보했으나, 아래 세 결정은 **되돌리기 비용이 큰 순서**로 나열했다 — 위쪽일수록 이후 모든 마일스톤이 그 결정 위에 세워진다.

### 결정 1 — 관리자 세션을 서버에서 판정하는 방법 (가장 되돌리기 비쌈)

**제안(잠정 결정)**: 리프레시 토큰 쿠키(REQ-AUTH-008, httpOnly)를 읽기 전용으로 해석하는 새 함수를 추가한다. `src/middleware.ts`는 무변경.

**기각한 대안 2건**(research.md §6):
- (A) `src/middleware.ts`의 matcher를 `/admin/:path*` → `/admin/api/:path*`로 좁혀 페이지는 통과시키기 — 완료·테스트로 고정된 SPEC-AUTH-001 파일을 수정해야 함.
- (B) 클라이언트 메모리 부트스트랩(마운트 시 액세스 토큰 재발급 후 fetch) — 최초 페이지 내비게이션 자체가 여전히 `/admin/:path*`에 걸려 리다이렉트되므로, 결국 페이지를 `/admin` 밖에 둬야 하는 것은 동일하다. 제안보다 새 코드가 더 많다.

**이 결정이 위험한 이유**: 리프레시 토큰을 판정에 쓰는 것은 `SPEC-AUTH-001`이 원래 의도한 소비처(`/auth/refresh`의 회전 로직)가 아닌 **새로운 소비처**를 추가하는 일이다. 회전을 트리거하지 않는 순수 조회이므로 REQ-AUTH-008/009/010 어느 것도 위반하지 않는다고 판단했지만, 이것이 "인증 설계를 재해석"하는 것으로 보일 수 있어 명시적으로 확인을 구한다. **대안**: 사용자가 원치 않으면 (A) 또는 (B)로 전환 가능 — 두 경로 모두 REQ-ADMIN-001~003의 의도(관리자만 서버 렌더 데이터를 받는다)는 동일하게 satisfy한다.

### 결정 2 — 관리자가 만들 수 있는 상태 전이의 범위

**제안(확정에 가까움 — product.md의 "결제 데이터 정합성 최우선" 제약에서 직접 도출)**: `pending_payment → cancelled`와 `paid → cancelled`만 허용. `→ paid`는 어떤 소스에서도 금지.

이것은 사용자 재량의 여지가 적다 — "관리자가 결제 없이 주문을 완료 처리할 수 있다"는 product.md의 최우선 제약을 정면 위반하므로, 이 결정은 plan.md에 기록만 하고 별도 확인 없이 채택한다(spec.md REQ-ADMIN-012에 이미 반영).

### 결정 3 — 관리자 로그인 화면을 이 SPEC이 만드는가

**제안(잠정 결정)**: 만든다 — 최소한의 이메일+비밀번호 폼 하나, 기존 `/api/auth/login` 그대로 호출. 저장소 전체에 로그인 UI가 하나도 없어(research.md §7), 이 화면 없이는 백오피스에 아무도 들어올 수 없다.

**대안**: 로그인 UI를 범위 밖으로 두고 관리자가 curl/Postman으로 로그인해 브라우저 쿠키를 수동 설정한다고 가정 — "1인 개발" 프로젝트 특성상 불가능하지 않지만, "백오피스"라는 산출물의 완결성을 해친다고 판단해 기각했다.

---

## §1. 사용자 흐름 (가장 변경 가능성 높은 UX 결정)

```
관리자 → GET /staff/login (로그인 폼)
       → POST /api/auth/login (기존 API, 무변경)
       → 성공 + role=admin → GET /staff/orders 로 이동
       → 성공 + role≠admin → 진입 거부(REQ-ADMIN-006)

관리자 → GET /staff/orders (목록, 상태 필터 쿼리 파라미터)
       → 행 클릭 → GET /staff/orders/[orderId] (상세)
       → 상태 변경 버튼(취소만) → PATCH /admin/api/orders/[orderId]/status
       → 성공 → 상세 화면 재렌더(새 상태 반영)
       → 실패(유효하지 않은 전이) → 오류 메시지, 상태 불변
```

`/staff/*`는 페이지(관리자용 SSR 화면), `/admin/api/*`는 API(REQ-AUTH-022 미들웨어 매처 안에 있으나, 이 SPEC은 그 미들웨어를 신뢰하지 않고 자체 세션 판정을 각 라우트 핸들러에서 다시 수행한다 — REQ-ADMIN-017). API를 `/admin/api/*`에 두는 것은 기존 미들웨어의 "이중 방어선" 역할을 얻기 위함이지, 그것에 의존하기 위함이 아니다(design.md §1이 두 경로가 겹치지 않는 이유를 상세히 기록).

> **승계 (`SPEC-ADMIN-003` REQ-ADMIN-042, 2026-09-04)**: 이 문단이 근거로 든 "이중 방어선"은 실제로는 일차 차단기였다 — 미들웨어가 핸들러보다 먼저 리다이렉트하므로 핸들러는 실행되지 않았다. 쓰기 API는 `/staff/api` 하위로 옮겨졌고, 위 문장은 승계의 1차 증거로 원문 그대로 보존한다.

## §2. 데이터 모델 변경 (스키마 — 두 번째로 변경 비용 높음)

### 신규 enum 값 1개 — `PaymentEventSource`

```prisma
enum PaymentEventSource {
  CONFIRM_API
  WEBHOOK
  ADMIN_ACTION // SPEC-ADMIN-001 — 관리자 백오피스가 트리거한 취소
}
```

- **소유**: 이 enum 자체는 `SPEC-PAYMENT-001`이 소유하지만, 이미 확장 가능하게 설계되어 있다(두 값이 나란히 있음). 기존 두 값의 의미·사용처는 전혀 바꾸지 않는다 — 순수 추가.
- **마이그레이션**: `ADMIN_ACTION` 값 추가 하나뿐, 컬럼·인덱스 변경 없음.

### 신규 타입은 없음

`Order`/`OrderItem`/`User`/`RefreshToken` 스키마는 전혀 건드리지 않는다. 이 SPEC은 오직 위 enum 값 1개만 추가한다.

## §3. 아키텍처 경계 — 새 파일과 EXTEND 대상

### 신규 (src/features/admin/**)

- `src/features/admin/services/admin-session.ts` — REQ-ADMIN-001~003. `resolveAdminSession(cookies)`: 리프레시 토큰 쿠키 원문 → `hashRefreshToken()`(session.ts에서 import, 재구현 안 함) → `RefreshToken` 조회 → `User.role` 확인 → `{ userId, role } | null`.
- `src/features/admin/repositories/admin-order-repository.ts` — `listOrdersForAdmin({ page, pageSize, status? })`, `findOrderByIdForAdmin(orderId)`, `cancelOrderAsAdmin(tx, orderId)`(REQ-ADMIN-012~015 — 소스 상태 `pending_payment`·`paid` 둘 다 조건부 갱신 대상, 재고 복원 + 쿠폰 해제 + 감사 로그를 한 트랜잭션에서 수행).
- `src/features/admin/types/admin.ts` — `AdminOrderListItemDTO`, `AdminOrderDetailDTO`, 상태 변경 입출력 타입.
- `src/app/staff/login/page.tsx` — 로그인 폼(Client Component, 기존 `/api/auth/login` 호출).
- `src/app/staff/orders/page.tsx` — 목록(Server Component, `resolveAdminSession()`으로 게이팅).
- `src/app/staff/orders/[orderId]/page.tsx` — 상세 + 상태 변경 폼.
- `src/app/admin/api/orders/[orderId]/status/route.ts` — `PATCH`(REQ-ADMIN-012~017, CSRF 방지 포함).

### EXTEND (기존 파일에 최소 추가)

- `prisma/schema.prisma` — `PaymentEventSource`에 `ADMIN_ACTION` 한 줄 추가.

### PRESERVE (절대 수정하지 않음)

- `src/middleware.ts` — REQ-ADMIN-018. `/staff/*`도 `/admin/api/*`도 이 파일의 matcher 로직에 의존하지 않는다(자체 세션 판정을 각자 수행).
- `src/features/payments/repositories/payment-repository.ts`(`markOrderPaid`/`markOrderCancelledAndRestoreStock`) — 참조만 하고 수정하지 않는다. `admin-order-repository.ts`가 별도로 재고 복원·쿠폰 해제 로직을 구현한다(중복이지만 소스 상태 조건이 다르고, 크로스-SPEC 파일 변경을 피하기 위한 의도적 선택 — design.md §2에 재검토 근거 기록).
- `src/lib/auth/{jwt,session,cookies,csrf}.ts` — 함수를 import만 하고 로직을 바꾸지 않는다.
- `src/app/api/auth/**` — 로그인·리프레시·로그아웃 라우트 무변경.

### 범위 밖(선택적, 이 SPEC의 마일스톤 어디에도 배정되지 않음)

- `src/app/admin/api/orders/route.ts`(`GET`, 목록 JSON) — design.md §3이 확정한 기본 데이터 경로에서는 `/staff/orders`(Server Component)가 `admin-order-repository.ts`의 `listOrdersForAdmin()`을 직접 호출하며, 이 API 라우트는 필요하지 않다(AC-ADMIN-009의 페이지네이션 검증도 Server Component의 직접 호출만으로 충족된다). 이 SPEC의 어떤 REQ-ADMIN-XXX도 이 라우트의 존재를 요구하지 않으므로 M1~M5 어느 마일스톤에도 배정하지 않는다. 향후 `t11`(관리자 상품 백오피스) 같은 다른 화면이나 외부 도구가 같은 목록 조회가 필요해지면, 그때 별도 SPEC 또는 이 SPEC의 후속 확장으로 추가한다 — 지금은 만들지 않는다.

## §4. 위험 요소

| 위험 | 완화 |
|---|---|
| `resolveAdminSession()`이 회전 로직과 중복된 해석을 갖게 되어 향후 `/auth/refresh` 변경 시 두 곳을 함께 수정해야 할 수 있음 | `hashRefreshToken()`은 import해 재사용(중복 없음). 조회 조건(`revokedAt`/`expiresAt`)도 `session.ts`가 이미 쓰는 것과 동일한 필드만 읽는다 — design.md §1에서 두 로직의 관계를 명시적으로 문서화 |
| `admin-order-repository.ts`가 `payment-repository.ts`의 재고 복원 로직을 복제해 향후 두 구현이 갈라질 위험(WET) | design.md §2에서 이 트레이드오프를 명시적으로 기록하고, 재고 복원 루프를 별도 공유 유틸(`src/features/payments/repositories/stock-restore.ts` 같은)로 뽑아내는 리팩터를 후속 개선 후보로 `@MX:NOTE`에 남긴다(이 SPEC에서는 실행하지 않음 — 크로스-SPEC 리팩터는 별도 승인 필요) |
| 관리자 계정이 실제로 없어 E2E 검증이 seed 스크립트에 의존 | plan-phase에서 테스트 seed(`tests/` 헬퍼)로 `role: admin` User를 생성하는 것으로 충분 — 애플리케이션 프로비저닝 UI는 범위 밖(spec.md §3) |
| CSRF 방지를 상태 변경 API에 새로 적용하는 것이 REQ-AUTH-023의 구현(더블서브밋/synchronizer)과 다르게 구현될 위험 | `src/lib/auth/csrf.ts`의 기존 헬퍼를 그대로 import해 재사용 — 새 CSRF 메커니즘을 발명하지 않는다 |

## §5. 마일스톤 (우선순위 기반, 시간 추정 없음)

1. **M1 — 스키마 + 관리자 세션 판정**: `PaymentEventSource.ADMIN_ACTION` 추가, `admin-session.ts`(`resolveAdminSession()`), 유닛 테스트(유효/만료/폐기/비관리자 4케이스).
2. **M2 — 관리자 로그인 화면**: `/staff/login` 폼, 기존 로그인 API 호출, role 체크 후 리다이렉트/거부.
3. **M3 — 관리자 주문 목록**: `admin-order-repository.ts`의 `listOrdersForAdmin()`, `/staff/orders` Server Component, 상태 필터.
4. **M4 — 관리자 주문 상세 + 상태 변경**: `findOrderByIdForAdmin()`, `cancelOrderAsAdmin()`(트랜잭션 — 상태 전이 + 재고 복원 + 쿠폰 해제 + 감사 로그), `/staff/orders/[orderId]` 페이지 + `PATCH /admin/api/orders/[orderId]/status` 라우트, CSRF 적용.
5. **M5 — 통합·회귀·접근성**: 전체 스위트 무회귀, 커버리지 임계값, `src/middleware.ts` 무변경 회귀 가드 테스트(정적 파일 diff 0줄 확인), 접근성(폼 라벨·오류 메시지 role="alert" 등).

## §6. 성공 기준

- REQ-ADMIN-001 ~ 018 각각 acceptance.md에 1:1 대응 AC 존재.
- `src/middleware.ts` diff 0줄.
- `payment-repository.ts`/`jwt.ts`/`session.ts`/기존 `/api/auth/**` diff 0줄(함수 호출만, 로직 변경 없음).
- `npm run typecheck` · `npm run lint` · `npm test` 종료 코드 0.
