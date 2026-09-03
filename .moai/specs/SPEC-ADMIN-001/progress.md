---
id: SPEC-ADMIN-001
status: draft
updated: 2026-09-03
tier: L
---

# Progress: SPEC-ADMIN-001 — 관리자 주문 목록·상태 변경 백오피스

## §E.1 Plan-phase Audit-Ready Signal

plan_complete_at: 2026-09-03
plan_status: audit-ready

plan-phase 산출물 5종(spec.md, plan.md, acceptance.md, design.md, research.md) 작성 완료. Tier L.

**SPEC ID 검사**: 정규식 검사를 Bash로 실행해 관측했다.

```
$ ID="SPEC-ADMIN-001"; [[ "$ID" =~ ^SPEC(-[A-Z][A-Z0-9]*)+-[0-9]{3}$ ]] && echo PASS || echo FAIL
PASS
```

동일 ID 부재도 확인했다 — 생성 직전:
```
$ ls .moai/specs/ | grep -c "^SPEC-ADMIN-001$"
0
$ grep -rl "SPEC-ADMIN-001" .moai/specs/ 2>/dev/null | wc -l
0
```

**프론트매터**: 정본 12필드 전부 존재(`id`/`title`/`version`/`status`/`created`/`updated`/`author`/`priority`/`phase`/`module`/`lifecycle`/`tags`) + 선택 필드 `tier: L`·`depends_on`·`related_specs`. `phase: "v0.2.0 target"`(SPEC-ORDER-003·SPEC-STOREFRONT-002와 동일한 최신 릴리스 타깃 표기), `status: draft`.

**REQ/AC 대응**: REQ 18건(REQ-ADMIN-001~018) / AC 18건(AC-ADMIN-001~018, 그중 AC-ADMIN-014만 a/b 두 하위 관측으로 묶임 — REQ-ADMIN-014 하나가 두 소스 상태 케이스를 검증받기 때문). 실측:
```
$ grep -oE "REQ-ADMIN-[0-9]+" .moai/specs/SPEC-ADMIN-001/spec.md | sort -u | wc -l
18
$ grep -oE "AC-ADMIN-[0-9]+" .moai/specs/SPEC-ADMIN-001/acceptance.md | sort -u | wc -l
18
```
Tier L 상한(REQ 25 / AC 25) 이내로, 각각 7건 여유가 있다.

**번호 부여 — 신규 도메인, 001부터 시작**: `.moai/specs/` 디렉터리 목록에 `ADMIN` 접두사 SPEC이 이전에 없었음을 확인했다.
```
$ ls .moai/specs/ | grep -E "ORDER|PAYMENT|AUTH|STOREFRONT|CART|CATALOG|DISCOUNT|CI|ADMIN"
SPEC-AUTH-001
SPEC-CART-001
SPEC-CATALOG-001
SPEC-CATALOG-002
SPEC-CI-001
SPEC-DISCOUNT-001
SPEC-ORDER-001
SPEC-ORDER-002
SPEC-ORDER-003
SPEC-PAYMENT-001
SPEC-STOREFRONT-001
SPEC-STOREFRONT-002
```
`ADMIN` 매치 0건. 따라서 이 SPEC은 기존 번호를 이어받을 대상이 없으며, REQ/AC 모두 001부터 신규로 시작한다(SPEC-STOREFRONT-002가 STOREFRONT 번호를 이어받은 것과 달리, 이 SPEC은 잇는 것이 아니라 새로 여는 경우다).

**SPEC ID 선택 근거 (spec.md에는 별도 절 없이 여기 progress.md에 기록 — Tier L의 spec.md는 도메인 선택 자체보다 요구사항 본문에 지면을 쓰는 편이 낫다고 판단)**: 후보 3건을 검토했다.
- `SPEC-ORDER-004`(ORDER 도메인 이어받기) 기각: 이 SPEC의 핵심 산출물은 "게스트/회원과 무관한 전체 주문 조회 + 상태 전이 규칙"이 아니라 "**관리자 인증·인가가 걸린 새 화면·API 표면**"이다 — SPEC-STOREFRONT-002의 progress.md가 CART-002를 기각한 것과 같은 논리: 이 SPEC이 `src/features/orders/**`(ORDER 도메인의 module)를 한 줄도 수정하지 않는다(별도 `src/features/admin/**`에 리포지토리를 새로 둔다 — plan.md §3). 또한 `t11`(관리자 상품 백오피스, 향후 SPEC)이 이 SPEC과 같은 관리자 세션 판정 로직을 재사용해야 하는데, 그 재사용 관계를 `ORDER` 도메인 번호로는 표현할 수 없다.
- `SPEC-BACKOFFICE-001`(신규 도메인, 다른 이름) 기각: `product.md` 핵심 기능 #6이 이미 "**관리자** 상품·주문 관리"라는 명칭을 쓰고 있고, 저장소 전체의 역할 필드도 `Role.admin`이다 — `admin`이 이 저장소가 이미 채택한 어휘이므로 `BACKOFFICE`라는 새 어휘를 도입할 이유가 없다.
- `SPEC-ADMIN-001` 채택: `t11`(상품)·`t12`(주문) 두 백로그 카드가 모두 `product.md` 핵심 기능 #6("관리자 상품·주문 관리") 하나에서 갈라져 나왔고, 이 SPEC이 만드는 관리자 세션 판정 로직(REQ-ADMIN-001~003)은 도메인 데이터(주문이든 상품이든)와 무관하게 `t11`이 그대로 재사용할 수 있도록 설계했다(design.md §1 — `/staff/*`·`/admin/api/*` 경로 관례). `ADMIN`은 "누가 접근하는가"를 축으로 하는 도메인이며, 이는 SPEC-STOREFRONT-001/002가 "무엇을 보여주는가(고객 대면 UI)"를 축으로 CART/CATALOG 등 백엔드 도메인과 분리한 선례와 정확히 같은 성격의 분리다.

**depends_on 근거**: 3개 SPEC 모두 `status: completed`를 각 SPEC의 `spec.md` 프론트매터를 직접 grep해 확인했다.
```
$ for s in AUTH-001 ORDER-001 PAYMENT-001; do echo -n "$s: "; grep "^status:" .moai/specs/SPEC-$s/spec.md; done
AUTH-001: status: completed
ORDER-001: status: completed
PAYMENT-001: status: completed
```
- `SPEC-AUTH-001` — `Role` enum·`User.role`·JWT 발급/검증·`REQ-AUTH-022` 미들웨어·`hashRefreshToken()`의 출처. 이 SPEC의 관리자 세션 판정(REQ-ADMIN-001~003)이 전적으로 의존한다.
- `SPEC-ORDER-001` — `Order`/`OrderItem` 모델, `OrderStatus` enum의 출처. 이 SPEC의 목록·상세 조회 대상.
- `SPEC-PAYMENT-001` — `markOrderCancelledAndRestoreStock()` 참조 구현, `PaymentAuditLog`/`PaymentEventSource`의 출처이자, `SPEC-PAYMENT-001` §3이 관리자 주도 취소를 이 SPEC(t12)에 명시적으로 위임한 문서.

**related_specs 근거**(비차단 참조): `SPEC-ORDER-002`(조건부 원자 갱신 패턴 — §0 잠재적 동시성 제외 항목의 근거), `SPEC-ORDER-003`(관리자 주문 관리를 §3에서 이 SPEC으로 이미 넘겨둔 선례), `SPEC-DISCOUNT-001`(쿠폰 해제 함수 `decrementRedeemedCountIfPositive`/`findCouponByCode`의 출처, design.md §4).

**Tier 판정**: L. 근거:
1. **파일 수** — 신규 7개(`admin-session.ts`, `admin-order-repository.ts`, `admin.ts` 타입, `/staff/login`·`/staff/orders`·`/staff/orders/[orderId]` 페이지 3개, `/admin/api/orders/[orderId]/status` 라우트 1개 — `GET /admin/api/orders`는 plan-audit iter1 D3 정리 이후 범위 밖으로 확정, plan.md §3 "범위 밖" 참조) + 테스트 파일(마일스톤마다 1~2개, plan.md §5 기준 5개 마일스톤) + 스키마 1줄 EXTEND = 15개를 넘을 것으로 추정.
2. **아키텍처 신규성** — 이 저장소 최초의 "SSR에서 회원/관리자 신원을 판정하는" 패턴이다(SPEC-ORDER-001이 회원 체크아웃에서 구조적으로 포기했던 문제의 관리자 버전 해법). Tier M/S로는 이 설계 결정(design.md §1~2)을 담을 자리가 없다.
3. **크로스-SPEC 트레이드오프** — `payment-repository.ts`를 확장할지 별도 함수를 쓸지(design.md §4)는 다른 완료 SPEC의 소유 파일을 건드릴지 결정하는 문제로, plan-auditor의 정밀 검토가 필요한 성격이다.
4. Tier M 상한(REQ/AC 16)은 이미 넘었다(18/18) — Tier M으로는 예산 초과.

**§0 결정 사항 처리**: plan.md §0에 결정 3건을 기록했다. 결정 1(관리자 세션 판정 방법)이 가장 되돌리기 비싼 결정이므로 최상단에 배치했고, **사용자 확인이 필요한 상태로 남겨 두었다** — 이 progress.md와 함께 오케스트레이터에게 보고할 항목이다. 결정 2(허용 전이 범위)는 product.md의 최우선 제약에서 직접 도출되어 재량 여지가 낮다고 판단해 확정 채택했다. 결정 3(로그인 화면 포함 여부)도 잠정 결정으로 표시했다.

**관리자 인증 발견 사항 요약 (가장 중요 — 별도로도 보고)**:
- **이미 있음**: `Role` enum(`customer`/`admin`), `User.role` 컬럼, JWT 액세스 토큰의 `role` 클레임(`jwt.ts`), `REQ-AUTH-022` — `/admin/:path*` 경로에 대해 `Authorization: Bearer` 헤더의 `role === "admin"`을 검사하는 미들웨어(이미 M6에서 구현·테스트 완료).
- **막힌 지점**: 그 미들웨어 자신의 문서 주석이 스스로 인정하듯, 액세스 토큰이 클라이언트 메모리 전용(REQ-AUTH-009)이라 브라우저의 최상위 내비게이션은 `Authorization` 헤더를 실을 수 없다 — 즉 `/admin/*` 아래 어떤 페이지를 두어도 직접 열 수 없다("API 전용" 범위임을 그 주석이 명시). 이는 SPEC-ORDER-001이 회원 체크아웃에서 부딪힌 것과 같은 종류의 구조적 벽이다.
- **이 SPEC이 채택한 우회로**: 액세스 토큰과 달리 **리프레시 토큰은 이미 httpOnly 쿠키**(REQ-AUTH-008)로 전달되므로 서버가 읽을 수 있다. 새 쿠키·새 토큰 종류를 발명하지 않고, 기존 리프레시 토큰을 **읽기 전용으로** 조회해 `role`을 판정하는 함수 하나를 추가한다(회전을 트리거하지 않으므로 REQ-AUTH-008/009/010 어느 것도 위반하지 않는다).
- **남은 잔여 사항**: 이것은 잠정 결정이며(plan.md §0 결정 1), `src/middleware.ts` 자체를 수정하는 대안도 있었으나 완료된 SPEC의 파일을 건드리는 것을 피하기 위해 기각했다 — **사용자 확인을 구하는 항목**. 또한 관리자 계정을 만드는 경로가 애플리케이션 어디에도 없음을 확인했다(research.md §8) — 이 SPEC은 계정 프로비저닝을 범위에 포함하지 않으며, seed 절차가 별도로 필요하다.

**run-phase 진입을 막는 항목은 아직 판정되지 않았다.** plan-audit 게이트와 Implementation Kickoff Approval이 이 SPEC의 다음 단계이며, 특히 plan.md §0 결정 1(관리자 세션 판정 방법)은 Implementation Kickoff Approval 이전에 사용자 확인을 받는 것을 권장한다.

**plan-audit 상태 (iteration 1 — FAIL, 수정 완료, iteration 2 재감사 대기)**: plan-auditor가 `.moai/reports/plan-audit/SPEC-ADMIN-001-review-1.md`에서 iteration 1을 **FAIL**로 판정했다(원점수 0.857로 Tier L 임계값 0.85를 넘었으나, D2가 blocking 결함이라 verdict 자체는 FAIL). 3건의 결함을 모두 수정했다:

- **D2(major, blocking)** — `design.md` §4가 `markOrderCancelledAndRestoreStock()`을 확장하지 않는 이유로 제시한 "웹훅 감사 로그 기록이 그 함수 안에 한 몸으로 묶여 있다"는 주장이 코드와 다름을 발견(실제로는 호출부 `payment-service.ts:272-283`가 별도로 기록). `design.md` §4를 코드 검증된 내용(유일한 호출부 수정 필요 + 기존 테스트 스위트 재검증 필요 — PRESERVE 원칙만으로 이미 충분한 근거)으로 교체.
- **D1(minor, blocking)** — `spec.md:79` REQ-ADMIN-008이 `(Where — 능력 게이트)`로 잘못 라벨링되어 있던 것을 `(When)`으로 정정(요청별 조건부 필터이지 정적 기능 게이트가 아님).
- **D3(minor, optional)** — `plan.md`가 `GET /admin/api/orders`를 M5까지 유예 가능한 "신규" 파일로 나열했으나 그 라우트를 요구하는 REQ도 마일스톤도 없었던 문제를, 해당 파일을 "신규" 목록에서 제거하고 명시적 "범위 밖" 절로 옮겨 정리(design.md §1/§3, progress.md 파일 수 집계도 함께 갱신).

plan-phase 산출물은 이제 iteration 2 재감사 준비 완료 상태다.

## §E.2 Run-phase Evidence

### 마일스톤 M1 — 스키마 + 관리자 세션 판정

**RED** (`npx vitest run tests/unit/admin/admin-session.test.ts`, `admin-session.ts` 작성 전):
```
 ❯ tests/unit/admin/admin-session.test.ts (7 tests | 7 failed) 27ms
   × resolveAdminSession — AC-ADMIN-001 valid admin session > resolves { userId, role: 'admin' } for a valid, unexpired, unrevoked admin-owned token 24ms
     → Cannot find module '@/features/admin/services/admin-session' imported from
       '.../tests/unit/admin/admin-session.test.ts'.
   (동일 사유로 나머지 6건도 전부 FAIL — 모듈 부재)

 Test Files  1 failed (1)
      Tests  7 failed (7)
```

**GREEN** (`admin-session.ts` 작성 후, 동일 명령):
```
 ✓ tests/unit/admin/admin-session.test.ts (7 tests) 26ms

 Test Files  1 passed (1)
      Tests  7 passed (7)
```

**설계 대비 실측 보정 — `findUnique` → `findFirst`**: design.md §2 4단계는
`prisma.refreshToken.findUnique({ where: { tokenHash }, include: { user: true } })`를
지정했으나, 최초 구현을 `npx tsc --noEmit`로 검증한 결과 타입 오류 2건이
났다 — `RefreshToken` 모델은 `tokenHash`에 `@@index([tokenHash])`만 선언되어
있고 `@@unique`가 아니므로(스키마 실측, `prisma/schema.prisma:63-78`),
Prisma의 `findUnique` where 절은 `tokenHash` 단독을 받아들이지 않는다. 이
SPEC은 `RefreshToken` 모델 자체를 PRESERVE 대상으로 두므로(다른 SPEC 소유,
스키마 변경은 `PaymentEventSource` 값 1개 추가로 한정) 모델을 고치는 대신
쿼리를 `findFirst`로 바꿨다 — 동작은 동일한 단일 읽기 조회이며(토큰 해시는
실질적으로 유일하므로 결과 차이 없음), 여전히 쓰기 쿼리가 전혀 없다
(REQ-ADMIN-002 불변식 유지). 수정 후 `npx tsc --noEmit`는 오류 0건, 위
GREEN 결과는 이 수정 반영 후 재실행한 것이다.

**Prisma 마이그레이션**: `npx prisma migrate dev --name admin_action_event_source`
실행 결과 로컬 PostgreSQL(`localhost:5433`)에 정상 적용되었다(exit 0).
생성된 `prisma/migrations/20260903110422_admin_action_event_source/migration.sql`:
```sql
-- AlterEnum
ALTER TYPE "PaymentEventSource" ADD VALUE 'ADMIN_ACTION';
```
순수 추가(pure additive) — 컬럼·인덱스·기존 두 값 어느 것도 변경하지 않았다.
`npx prisma generate`도 별도로 실행해 Prisma Client를 재생성했다(exit 0).

**발견된 회귀 — 별도 조치 필요 (수정하지 않음, PRESERVE 경계)**:
`npx vitest run --exclude "**/tests/integration/auth/login.test.ts"` 전체
스위트 재실행 결과 `tests/unit/payments/schema.test.ts`의 기존 테스트
"declares exactly the two event-source values"가 1건 FAIL한다(987/988
통과) — `PaymentEventSource` enum 값이 정확히 `["CONFIRM_API", "WEBHOOK"]`
두 개여야 한다고 하드코딩된 검사가, 이 마일스톤이 명시적으로 요구한
`ADMIN_ACTION` 추가와 정면으로 충돌한다. 이 테스트 파일은
`tests/unit/payments/**`(다른 SPEC 소유, 이 마일스톤의 PRESERVE 목록에
"other SPEC's files"로 포함)에 있어 이 마일스톤의 파일 목록 밖이므로 직접
수정하지 않았다 — 최종 보고서의 Blocker 절에 그대로 남겨 사용자/오케스트레이터
판단을 구한다.

산출물: `src/features/admin/services/admin-session.ts`(신규),
`tests/unit/admin/admin-session.test.ts`(신규, 7 tests),
`prisma/schema.prisma`(`PaymentEventSource`에 `ADMIN_ACTION` 한 줄 추가),
`prisma/migrations/20260903110422_admin_action_event_source/`(신규,
`ALTER TYPE ... ADD VALUE` 1문). AC-ADMIN-001/002/003 커버.

### 마일스톤 M2 — 관리자 로그인 화면

**Task 0 — SPEC-PAYMENT-001 소유 테스트 파일의 사전 존재 회귀(M1 파생) 수정**: M1이 커밋한
`PaymentEventSource.ADMIN_ACTION` 추가(plan-audited, 순수 확장 — plan.md §2)로 인해
`tests/unit/payments/schema.test.ts`의 기존 검사 "declares exactly the two event-source
values"가 하드코딩된 2값 목록과 충돌해 FAIL 상태였다. 이 테스트 파일 자체는 다른 SPEC
소유이므로(`tests/unit/payments/**`) 이 마일스톤의 파일 목록 밖이지만, M1이 만든 회귀이므로
단언 1줄만 3값으로 갱신했다(이 파일의 다른 모든 테스트는 바이트 단위로 무변경):
```
- expect(values).toEqual(["CONFIRM_API", "WEBHOOK"]);
+ expect(values).toEqual(["CONFIRM_API", "WEBHOOK", "ADMIN_ACTION"]);
```
`npx vitest run tests/unit/payments/schema.test.ts` — 수정 전 14건 중 1건 FAIL, 수정 후
14건 전부 PASS.

**RED** (`npx vitest run tests/unit/app/staff-login-page.test.tsx`, `src/app/staff/login/page.tsx`
작성 전):
```
FAIL  tests/unit/app/staff-login-page.test.tsx [ tests/unit/app/staff-login-page.test.tsx ]
Error: Failed to resolve import "@/app/staff/login/page" from
"tests/unit/app/staff-login-page.test.tsx". Does the file exist?
Test Files  1 failed (1)
     Tests  no tests
```

**GREEN** (동일 명령, `src/app/staff/login/page.tsx` 작성 후):
```
✓ tests/unit/app/staff-login-page.test.tsx (6 tests) 109ms
Test Files  1 passed (1)
     Tests  6 passed (6)
```

**설계 대비 실측 보정 — 없음**: `OrderLookupForm.tsx`의 폼-상태/오류-처리 패턴(`useId()` 파생
id, `role="alert"` 최상위 폼 오류, 제출 중 `disabled` + 버튼 라벨 전환, 동일 Tailwind 클래스
문자열)을 그대로 따랐다. `/api/auth/login`은 필드별 오류(`fieldErrors`)를 반환하지 않고 단일
`error` 문자열만 반환하므로(route.ts 실측), `aria-describedby`/`aria-invalid` 필드 단위
패턴은 적용 대상이 없어 이식하지 않았다 — `role="alert"` 최상위 오류 요소만 존재.

**AC-ADMIN-006 스코프 — 부분(PARTIAL) 커버리지**: 이 AC의 전체 주장("관리자 데이터 노출 없음,
진입 거부")은 `/staff/orders`의 Server Component 게이트(M3, 아직 미작성)에 의존한다. 이
마일스톤에서 검증·구현한 것은 그 절반뿐이다 — 로그인 폼은 `200` 응답을 받으면 응답 본문 내용과
무관하게(role을 읽지도, 분기하지도 않고) 항상 동일한 `/staff/orders`로만 이동한다. 테스트
"navigates to the SAME target on every 200, regardless of response body content"가 서로
다른 두 `200` 응답 본문(하나는 가상의 `role: "customer"` 필드 포함)에 대해 동일한 내비게이션을
확인하고, 정적 회귀 가드 테스트가 `page.tsx` 소스에 `.role` 참조나 JWT 디코드 호출이 없음을
확인한다. **서버 측 거부 절반(실제 비관리자 세션의 관리자 데이터 접근 차단)은 M3에서
`resolveAdminSession()`을 읽는 `/staff/orders` Server Component가 구현할 때 검증된다** — 이
마일스톤은 AC-ADMIN-006을 PASS로 표시하지 않는다.

산출물: `src/app/staff/login/page.tsx`(신규), `tests/unit/app/staff-login-page.test.tsx`(신규,
6 tests), `tests/unit/payments/schema.test.ts`(1줄 수정 — M1 파생 회귀 해소, 다른 SPEC 소유
파일이지만 M1이 유발한 회귀이므로 최소 수정). AC-ADMIN-004/005 PASS 커버, AC-ADMIN-006
PARTIAL(클라이언트 절반만 — 서버 측 거부 절반은 M3에서 검증) 커버.

### 마일스톤 M3 — 관리자 주문 목록

**Task 0 — AC-ADMIN-006 서버 측 거부 절반 완결(M2가 유예해 둔 절반을 이 마일스톤에서 닫음)**:
M2의 progress.md 기록이 명시적으로 남겨 둔 대로, AC-ADMIN-006의 전체 주장("로그인은
성공하지만 관리자 데이터는 어디에도 노출되지 않고 진입이 거부된다")은 `/staff/orders`의
Server Component 게이트에 의존했다. 이 마일스톤이 그 게이트 자체다 — `resolveAdminSession()`을
호출해 결과가 `null`이면(쿠키 없음·만료·폐기·비관리자 역할, REQ-ADMIN-003에 따라 네 사유
모두 동일하게 취급) `redirect("/staff/login")`을 실행하며, 이 판정이 실패로 끝나는 경로에서는
`listOrdersForAdmin()`을 포함해 어떤 주문 데이터 조회도 일어나지 않는다. 신규 테스트 "never
calls listOrdersForAdmin ... on the redirected path"가 저장소 mock이 호출되지 않았음을 직접
관측해 이를 확인한다. **AC-ADMIN-006을 이제 PARTIAL이 아닌 완전 PASS로 표시한다** — M2가
검증한 클라이언트 절반(응답 본문 내용과 무관하게 역할 분기 없이 항상 동일한 목적지로 이동)과
이 마일스톤이 검증한 서버 절반(실제 차단 + 데이터 미노출)이 합쳐져 REQ-ADMIN-006을 완전히
충족한다.

**RED** (`admin-order-repository.test.ts`, 구현 전 — 모듈 부재로 6건 전부 FAIL):
```
$ npx vitest run tests/unit/admin/admin-order-repository.test.ts
 FAIL  tests/unit/admin/admin-order-repository.test.ts > ... > queries with an empty where
   filter when no status is given, and never scopes by guestId
 Error: Cannot find module '@/features/admin/repositories/admin-order-repository' imported
   from '.../tests/unit/admin/admin-order-repository.test.ts'.
 (동일 사유로 나머지 5건도 전부 FAIL — 모듈 부재)

 Test Files  1 failed (1)
      Tests  6 failed (6)
```

**RED** (`staff-orders-page.test.tsx`, 구현 전 — 페이지 파일 부재로 스위트 자체가 실패):
```
$ npx vitest run tests/unit/app/staff-orders-page.test.tsx
 FAIL  tests/unit/app/staff-orders-page.test.tsx [ tests/unit/app/staff-orders-page.test.tsx ]
Error: Failed to resolve import "@/app/staff/orders/page" from
"tests/unit/app/staff-orders-page.test.tsx". Does the file exist?
Test Files  1 failed (1)
     Tests  no tests
```

**GREEN** (동일 두 명령, 구현 후):
```
$ npx vitest run tests/unit/admin/admin-order-repository.test.ts tests/unit/app/staff-orders-page.test.tsx
 ✓ tests/unit/admin/admin-order-repository.test.ts (6 tests) 7ms
 ✓ tests/unit/app/staff-orders-page.test.tsx (10 tests) 37ms

 Test Files  2 passed (2)
      Tests  16 passed (16)
```

**설계 대비 실측 보정 — 없음**: `admin-order-repository.ts`는 `product-repository.ts`의
패턴(`LIST_SELECT satisfies Prisma.OrderSelect`, `Promise.all` 동시 조회, `skip`/`take`)을
그대로 따랐다. 다만 상태별 정렬 키가 필요했던 상품과 달리 주문은 이차 정렬 충돌이 없으므로
`SORT_ORDER_BY` 같은 `Record` 대신 `createdAt desc` + `id asc` 고정 2키 배열 하나만 둔다
(design.md가 요구한 대로). `page.tsx`의 `DEFAULT_PAGE`/`DEFAULT_PAGE_SIZE`/`MAX_PAGE_SIZE`
값(1/20/100)도 `product.ts`의 값을 그대로 재사용했다(REQ-ADMIN-009).

**타입 호환성 메모(리포지토리 계층 vs page/types 계층의 관례 차이)**: `admin-order-repository.ts`는
`@prisma/client`에서 `OrderStatus`를 타입으로 import한다(리포지토리 계층의 기존 관례,
`product-repository.ts`가 `Prisma.*`를 import하는 것과 동일). 반면 `admin.ts`와 `page.tsx`는
이 저장소 전체의 관례(`src/features/orders/types/order.ts`가 이미 확립한 "features/는 배송
메커니즘에 의존하지 않는다")를 따라 Prisma를 import하지 않고 `"pending_payment" | "paid" |
"cancelled"` 리터럴 유니온으로 상태값을 재기술한다 — Prisma가 생성하는 `OrderStatus` 타입
자체가 `(typeof OrderStatus)[keyof typeof OrderStatus]`로 동일한 리터럴 유니온으로 귀결되므로,
두 표현은 구조적으로 동일해 캐스트 없이 서로 호환된다(`npx tsc --noEmit` 오류 0건으로 확인).

산출물: `src/features/admin/repositories/admin-order-repository.ts`(신규),
`src/features/admin/types/admin.ts`(신규 — 이 SPEC에서 처음 사용),
`src/app/staff/orders/page.tsx`(신규),
`tests/unit/admin/admin-order-repository.test.ts`(신규, 6 tests),
`tests/unit/app/staff-orders-page.test.tsx`(신규, 10 tests — redirect-gate 2건 포함).
AC-ADMIN-006(PARTIAL→완전 PASS로 승격)/007/008/009 커버.

### 마일스톤 M4 — 관리자 주문 상세 + 상태 변경

**RED** (`admin-order-repository.test.ts` 확장분 — `findOrderByIdForAdmin`/`cancelOrderAsAdmin`
부재로 신규 12건 FAIL, 기존 M3 6건은 영향받지 않고 그대로 PASS):
```
$ npx vitest run tests/unit/admin/admin-order-repository.test.ts
 ❯ tests/unit/admin/admin-order-repository.test.ts (18 tests | 12 failed) 12ms
   × ... findOrderByIdForAdmin (AC-ADMIN-010, detail fields) > ...
     → findOrderByIdForAdmin is not a function
   × ... cancelOrderAsAdmin (AC-ADMIN-012/013, conditional transition) > ...
     → cancelOrderAsAdmin is not a function
   (동일 사유로 신규 12건 전부 FAIL — 두 export 모두 부재)

 Test Files  1 failed (1)
      Tests  12 failed | 6 passed (18)
```

**RED** (`order-status-route.test.ts`, 신규 — 라우트 파일 부재로 9건 전부 FAIL):
```
$ npx vitest run tests/unit/api/admin/order-status-route.test.ts
Error: Cannot find module '@/app/admin/api/orders/[orderId]/status/route' imported from
  '.../tests/unit/api/admin/order-status-route.test.ts'.

 Test Files  1 failed (1)
      Tests  9 failed (9)
```

**RED** (`staff-order-detail-page.test.tsx`, 신규 — 페이지 파일 부재로 스위트 자체가 실패):
```
$ npx vitest run tests/unit/app/staff-order-detail-page.test.tsx
Error: Failed to resolve import "@/app/staff/orders/[orderId]/page" from
  "tests/unit/app/staff-order-detail-page.test.tsx". Does the file exist?
 Test Files  1 failed (1)
      Tests  no tests
```

**GREEN** (동일 세 명령, 구현 후):
```
$ npx vitest run tests/unit/admin/admin-order-repository.test.ts tests/unit/app/staff-order-detail-page.test.tsx tests/unit/api/admin/order-status-route.test.ts
 ✓ tests/unit/admin/admin-order-repository.test.ts (18 tests) 18ms
 ✓ tests/unit/api/admin/order-status-route.test.ts (9 tests) 28ms
 ✓ tests/unit/app/staff-order-detail-page.test.tsx (8 tests) 93ms

 Test Files  3 passed (3)
      Tests  35 passed (35)
```

**설계 대비 실측 보정 1 — `cancelOrderAsAdmin`의 사전 상태 읽기**: design.md §4 의사코드는
`updateMany` 직전에 "이전 상태를 읽어둔다"는 주석만 남기고 실제 읽기 호출을 코드로 보이지
않았다. 구현은 `tx.order.findUnique({ where: { id: orderId }, select: { status: true } })`를
`updateMany` **이전**에 한 번 실행해 `previousStatus`용 스냅샷을 확보한다. 주문이 아예
존재하지 않는 경우(`findUnique`가 `null`) `updateMany`의 `count`도 자연히 0이 되므로,
`updated.count !== 1 || current === null` 한 조건으로 "이미 취소됨"과 "주문 부재"를 모두
동일하게 `{ transitioned: false }`로 귀결시켰다 — design.md가 명시하지 않은 타입 안전성
보강(성공 경로에서만 `current.status`를 읽으므로, null 분기가 그 경로에 도달하는 일은
구조적으로 없다).

**설계 대비 실측 보정 2 — `admin.ts`의 상세 DTO는 `OrderDTO`를 재사용하지 않고 독립 타입으로
재기술**: `AdminOrderDetailDTO`/`AdminShippingInfo`/`AdminOrderItemDTO`는
`src/features/orders/types/order.ts`의 `OrderDTO`/`ShippingInfo`/`OrderItemDTO`와 구조가
거의 동일하지만, admin 모듈이 orders 피처 타입에 의존하지 않는다는 기존 관례(리포지토리
계층이 이미 `order-repository.ts`를 import하지 않고 자체 Prisma 쿼리를 도는 것과 동일한
경계)를 그대로 따라 별도 타입으로 재기술했다.

**AC-ADMIN-011 검증 방식 — 쿼리 레벨 부재 + 렌더 레벨 부재의 이중 증명**: `findOrderByIdForAdmin`의
Prisma `select` 객체 자체에 `paymentKey` 키가 존재하지 않음을
`Object.prototype.hasOwnProperty.call(select, "paymentKey") === false`로 직접 관측하고
(리포지토리 테스트), 이어서 `paid` 상태이며 실제 `paymentKey` 값(`toss_pk_...` 형태)을 가진
DB 픽스처를 렌더링한 뒤 그 값이 `container.textContent`/`container.innerHTML` 어디에도
나타나지 않음을 관측했다(페이지 테스트) — "DB 행에 실재하는 값의 render-레벨 부재"라는
task 지시(양성-존재/음성-부재 조합)를 그대로 충족한다.

**AC-ADMIN-012 정적 회귀 가드에서 발견한 자기모순 수정**: `page.tsx`의 최초 doc comment가
"NEVER renders ... '결제완료로 변경' control"이라는 설명 문구 자체에 금지 문자열을 그대로
포함시켜, 같은 파일을 대상으로 하는 정적 소스 가드 테스트(`/결제\s*완료\s*(로|으로)?\s*변경/`)를
자기 자신이 트리거했다. 설명 의도는 그대로 두고 그 한국어 인용구만 영어 서술("only
SPEC-PAYMENT-001's confirm/webhook path may ever transition an order to the paid state")로
교체해 해소했다 — 코드에 그런 조작이 없다는 사실 자체는 애초에 변경되지 않았다.

**AC-ADMIN-010 테스트에서 발견한 픽스처 중복값 이슈**: 최초 테스트 픽스처가 수량 1개 상품이라
`unitPrice`와 `lineTotal`이 둘 다 "39,000원"으로 동일해 `screen.getByText(/39,000원/)`가
"여러 요소가 매치됨" 오류를 냈다(구현 결함이 아니라 테스트 단정문 자체의 모호성). `{ selector:
"dd" }`를 추가해 금액 내역 `<dl>` 안의 `<dd>`만 대상으로 좁혀 해소했다.

산출물: `src/app/staff/orders/[orderId]/page.tsx`(신규),
`src/app/staff/orders/[orderId]/CancelOrderButton.tsx`(신규),
`src/app/admin/api/orders/[orderId]/status/route.ts`(신규),
`src/features/admin/repositories/admin-order-repository.ts`(M3 파일 확장 — `findOrderByIdForAdmin`/
`cancelOrderAsAdmin` 추가, 기존 `listOrdersForAdmin`은 무변경),
`src/features/admin/types/admin.ts`(M3 파일 확장 — `AdminOrderDetailDTO` 등 추가, 기존
export 무변경), `tests/unit/admin/admin-order-repository.test.ts`(M3 파일 확장, 신규
18건 — 기존 6건 유지), `tests/unit/app/staff-order-detail-page.test.tsx`(신규, 8 tests),
`tests/unit/api/admin/order-status-route.test.ts`(신규, 9 tests). AC-ADMIN-010~017
(AC-ADMIN-014는 a/b 두 하위 관측 포함, 총 9건) 전부 PASS 커버.

### 마일스톤 M5 — 통합·회귀·접근성

이 마일스톤은 새 REQ/AC를 추가하지 않는다 — M1~M4가 이미 18건의 REQ-ADMIN/AC-ADMIN을
전부 구현했으므로, M5의 산출물은 전체 스위트 무회귀 확인, `src/middleware.ts` 회귀
가드, 정적 동시성 형태 검사, 접근성 검증, 그리고 아래 §E.3에 기록하는 누적
Audit-Ready 신호다.

**Task 1 — `src/middleware.ts` 무변경 회귀 가드 (REQ-ADMIN-018)**: 신규
`tests/unit/admin/middleware-preserve.test.ts`. `readFileSync`로 파일 내용을 직접
읽어 (1) `export const config = { matcher: [...] }`이 정확히 `["/admin/:path*"]`인지,
(2) 파일 어디에도 `/staff` 참조가 없는지, (3) 바이트 길이 + SHA-256 콘텐츠 스냅샷이
스냅샷 값과 일치하는지 3가지를 단정한다. (3)은 (1)/(2)가 못 잡는 임의의 향후 수정까지
잡아내는 전역 가드다 — git diff 셸아웃이 아니라 파일 콘텐츠 자체를 읽으므로 vitest
테스트 안에서 git 없이도 항상 재현 가능하다.

**RED** (스냅샷 상수를 의도적으로 틀린 값 `0` / `0…0`으로 둔 상태, 콘텐츠 스냅샷 단정문만):
```
$ npx vitest run tests/unit/admin/middleware-preserve.test.ts
 ❯ tests/unit/admin/middleware-preserve.test.ts (3 tests | 1 failed) 5ms
   × ... byte-length + SHA-256 content snapshot ... 3ms
     → expected 2485 to be +0 // Object.is equality

 Test Files  1 failed (1)
      Tests  1 failed | 2 passed (3)
```

**GREEN** (스냅샷 상수를 실측값 `2485` /
`8d82d3c13a3d00131be8e22ff088384f378bc4183d9c772f97e6591153d332e0`로 교체):
```
$ npx vitest run tests/unit/admin/middleware-preserve.test.ts
 ✓ tests/unit/admin/middleware-preserve.test.ts (3 tests) 2ms

 Test Files  1 passed (1)
      Tests  3 passed (3)
```

`src/middleware.ts` 자체는 이 마일스톤에서도 (그리고 SPEC 전체에서) 단 한 줄도
건드리지 않았다 — 이 테스트는 검증만 한다.

**Task 2 — AC-ADMIN-EXCL-CONCURRENCY 정적 형태 검사**: `tests/unit/admin/admin-order-repository.test.ts`
말미에 신규 `describe` 블록 2건 추가. `acceptance.md`의 "잠재적 §0 제외 후보" 절이
명시한 대로, 두 관리자의 동시 취소 레이스에 대한 **실측(살아있는 PostgreSQL 필요)은
제외**하되, 그 직렬화를 가능하게 하는 **형태**(`updateMany` where 절에 소스 상태
`{ in: [...] }` 조건 포함, 단순 `update()`가 아님)는 `admin-order-repository.ts`의
소스 텍스트를 `readFileSync`로 읽어 정적으로 확인한다 — `SPEC-ORDER-002`의
`AC-013-EXCL-CONCURRENCY`가 확립한 것과 동일한 성격의 정적 형태 검사.

**RED** (첫 번째 신규 테스트의 정규식을 의도적으로 실재하지 않는 플레이스홀더로 둔 상태):
```
$ npx vitest run tests/unit/admin/admin-order-repository.test.ts -t "AC-ADMIN-EXCL-CONCURRENCY"
 ❯ ... uses tx.order.updateMany(...) ...
   → expected '...(admin-order-repository.ts 전체 소스)...' to match /RED_PLACEHOLDER_DOES_NOT_EXIST_IN_SOURCE/

 Test Files  1 failed (1)
      Tests  1 failed | 1 passed | 18 skipped (20)
```

**GREEN** (정규식을 실제 검사 — `tx\.order\.updateMany\(` 존재 + 그 호출의 where 절에
`status:\s*\{\s*in:\s*\[` — 로 교체):
```
$ npx vitest run tests/unit/admin/admin-order-repository.test.ts
 ✓ tests/unit/admin/admin-order-repository.test.ts (20 tests) 13ms

 Test Files  1 passed (1)
      Tests  20 passed (20)
```

**Task 3 — 접근성 점검 (M2~M4 렌더 UI 전체)**: 신규 `tests/unit/admin/accessibility.test.tsx`
(기존 페이지별 테스트 파일을 확장하는 대신 새 전용 파일을 택한 이유: 이 마일스톤의
작업은 이미 구현된 4개 화면 — 로그인 폼·주문 목록·주문 상세·취소 버튼 — 을 가로지르는
**점검**이라, 각자 REQ/AC 스코프를 이미 가진 4개 파일에 흩어 넣기보다 점검 범위를
한 파일에서 보이게 하는 편이 낫다고 판단했다). 점검 결과 — **모든 항목이 이미 충족되어
있었고, UI 코드 변경은 없었다**:

- 로그인 폼(M2): `<label htmlFor>`로 이메일·비밀번호 두 입력 모두 연결되어 있음을
  `getByLabelText`로 확인(단순 htmlFor grep보다 강한 검사 — 스크린리더와 동일한
  연결 해석을 거친다) + 제출 실패 메시지가 `role="alert"`로 렌더됨을 확인.
- 주문 목록(M3): 모든 `<th>`가 `scope="col"`을 가짐을 확인(DOM 순회로 전수 검사) +
  `<nav aria-label="상태 필터">`·`<nav aria-label="페이지네이션">` 두 랜드마크가
  모두 존재함을 확인.
- 주문 상세(M4): 취소 버튼의 접근 가능한 이름이 그 화면 텍스트("취소")와 일치함을
  확인.
- `CancelOrderButton.tsx`(M4): 제출 중 버튼이 `disabled`되고 텍스트가 "취소 처리
  중…"로 바뀌는, M2 로그인 버튼과 동일한 disabled+텍스트 전환 패턴이 실제로 동작함을
  확인 + 실패 시 오류 메시지가 `role="alert"`로 렌더됨을 확인.

진짜 접근성 결함은 발견되지 않았다 — 있지도 않은 문제를 지어내지 않았다.

**RED** (레이블/헤더/버튼 이름 단정 3건을 각각 존재하지 않는 값으로 바꾼 상태):
```
$ npx vitest run tests/unit/admin/accessibility.test.tsx
 Test Files  1 failed (1)
      Tests  3 failed | 4 passed (7)
```

**GREEN** (실제 값으로 되돌림):
```
$ npx vitest run tests/unit/admin/accessibility.test.tsx
 ✓ tests/unit/admin/accessibility.test.tsx (7 tests) 116ms

 Test Files  1 passed (1)
      Tests  7 passed (7)
```

**Task 4의 커버리지 분석에서 발견한 진짜 결함 하나 — `CancelOrderButton.tsx` 분기
커버리지 69.23%(임계값 80% 미달)**: 최초 전체 커버리지 실행에서
`CancelOrderButton.tsx`가 `98/69.23/100/98`(statements/branches/functions/lines)로
측정되었다 — branches가 프로젝트 전역 임계값 80%에 못 미쳤다. 원인은 기존 어떤
테스트도 (a) `fetch()` 자체가 reject하는 네트워크 실패 경로(바깥쪽 `catch` 블록,
63행)와 (b) 실패 응답의 본문이 JSON으로 파싱되지 않는 경로(`.json().catch(() => ({}))`의
인라인 catch, 60행)를 구동하지 않았기 때문이다. `accessibility.test.tsx`에 신규
테스트 2건을 추가해 두 경로를 모두 구동했다(UI 코드는 건드리지 않음 — 이미 올바르게
동작하던 두 fallback 분기에 대한 테스트가 없었을 뿐이다).

**RED** (두 신규 테스트의 기대값을 플레이스홀더로 둔 상태):
```
$ npx vitest run tests/unit/admin/accessibility.test.tsx
 FAIL ... a network failure (fetch() rejects) falls back ...
   AssertionError: expected '주문을 취소하지 못했습니다. 잠시 후 다시 시도해 주세요' to be 'RED_PLACEHOLDER'
 FAIL ... a non-ok response whose body fails to parse as JSON ...
   AssertionError: expected '주문을 취소하지 못했습니다' to be 'RED_PLACEHOLDER_2'

 Test Files  1 failed (1)
      Tests  2 failed | 7 passed (9)
```

**GREEN** (실제 기대 메시지로 교체):
```
$ npx vitest run tests/unit/admin/accessibility.test.tsx
 ✓ tests/unit/admin/accessibility.test.tsx (9 tests) 125ms

 Test Files  1 passed (1)
      Tests  9 passed (9)
```

**커버리지 전/후 비교(`CancelOrderButton.tsx`)**:

| 시점 | Stmts | Branch | Funcs | Lines | Uncovered |
|---|---|---|---|---|---|
| 두 테스트 추가 전 | 98 | **69.23** | 100 | 98 | 63 |
| 두 테스트 추가 후 | 100 | **87.5** | 100 | 100 | 28,41 |

87.5% ≥ 80% 임계값 — 통과. 잔여 uncovered 28/41행은 (a) `readCsrfToken()`의
"쿠키 없음" 폴백 분기 중 아직 실측 안 된 한쪽 방향과 (b) `if (submitting) return;`
가드로, 후자는 버튼의 `disabled` 속성이 UI 클릭으로는 재진입 자체를 막아(jsdom도
네이티브 동작을 그대로 따른다) 실제 브라우저 조작으로는 도달이 사실상 불가능한
방어적 코드다 — 별도 소스 변경을 정당화할 만한 결함이 아니라고 판단해 그대로 두었다
(잔여 위험으로 아래 §E.3에 기록).

**Task 5 — PRESERVE 누적 재확인 (SPEC 전체 이력)**: `git merge-base HEAD origin/main`으로
확인한 병합 기준(`265b54b72828160adf2dece66a33919e57e9ee76`)과 현재 HEAD 사이,
plan.md §3 PRESERVE 4개 경로 + `src/app/api/auth/` 전체를 diff했다.

```
$ git rev-parse --abbrev-ref HEAD
feat/SPEC-ADMIN-001
$ git fetch origin main
$ git merge-base HEAD origin/main
265b54b72828160adf2dece66a33919e57e9ee76
$ git diff --stat 265b54b72828160adf2dece66a33919e57e9ee76 -- src/middleware.ts src/features/payments/repositories/payment-repository.ts src/lib/auth/jwt.ts src/lib/auth/session.ts src/lib/auth/cookies.ts src/lib/auth/csrf.ts src/app/api/auth/
(출력 없음 — 0줄)
```

AC-ADMIN-018을 SPEC 전체 이력에 대해 재확인 — 빈 diff.

산출물(M5 신규 생성): `tests/unit/admin/middleware-preserve.test.ts`(신규, 3 tests),
`tests/unit/admin/accessibility.test.tsx`(신규, 9 tests). 산출물(M5 확장):
`tests/unit/admin/admin-order-repository.test.ts`(M3/M4 파일 확장, 신규 2건 추가 —
기존 18건 유지, 총 20건). 이 마일스톤에서 M1~M4의 구현 파일(`admin-session.ts`,
`admin-order-repository.ts`, `admin.ts`, 4개 페이지, `CancelOrderButton.tsx`,
`status/route.ts`)은 어느 것도 수정하지 않았다 — 전부 테스트 파일 추가/확장뿐이다.

## §E.3 Run-phase Audit-Ready Signal

run_complete_at: 2026-09-03
run_status: audit-ready

M1~M5 전체에 대한 누적 Audit-Ready 신호. 이 시점의 tree는 M4까지 커밋된 HEAD
`10c5cc91a95e4b4ebb4ea62874a7c76b6c87897d`(`10c5cc9`) 위에 M5의 신규/확장 테스트
파일 3개(커밋 전, working tree)가 얹힌 상태다 — M5는 git 조작이 허용되지 않는
milestone이므로 커밋은 다음 세션(오케스트레이터 또는 후속 위임)의 몫이다.

### 누적 18건(AC-ADMIN-014 a/b 포함 19행) AC PASS 매트릭스

| AC | 검증 명령 | 핵심 출력(verbatim) | 상태 |
|---|---|---|---|
| AC-ADMIN-001 | `npx vitest run tests/unit/admin/admin-session.test.ts` | `✓ tests/unit/admin/admin-session.test.ts (7 tests) 214ms` | PASS |
| AC-ADMIN-002 | `npx vitest run tests/unit/admin/admin-session.test.ts` | `✓ tests/unit/admin/admin-session.test.ts (7 tests) 214ms` | PASS |
| AC-ADMIN-003 | `npx vitest run tests/unit/admin/admin-session.test.ts` | `✓ tests/unit/admin/admin-session.test.ts (7 tests) 214ms` | PASS |
| AC-ADMIN-004 | `npx vitest run tests/unit/app/staff-login-page.test.tsx` | `✓ tests/unit/app/staff-login-page.test.tsx (6 tests) 261ms` — `AC-ADMIN-004 — submits the existing login API unchanged > POSTs /api/auth/login...` | PASS |
| AC-ADMIN-005 | `npx vitest run tests/unit/app/staff-login-page.test.tsx` | `✓ tests/unit/app/staff-login-page.test.tsx (6 tests) 261ms` | PASS |
| AC-ADMIN-006 | `npx vitest run tests/unit/app/staff-login-page.test.tsx tests/unit/app/staff-orders-page.test.tsx` | `✓ tests/unit/app/staff-login-page.test.tsx (6 tests) 261ms` + `✓ tests/unit/app/staff-orders-page.test.tsx (10 tests) 206ms`(redirect-gate 2건 포함, M3에서 PARTIAL→완전 PASS로 승격) | PASS |
| AC-ADMIN-007 | `npx vitest run tests/unit/admin/admin-order-repository.test.ts tests/unit/app/staff-orders-page.test.tsx` | `✓ tests/unit/admin/admin-order-repository.test.ts (20 tests) 20ms` + `✓ tests/unit/app/staff-orders-page.test.tsx (10 tests) 206ms` | PASS |
| AC-ADMIN-008 | 위와 동일 | 위와 동일 | PASS |
| AC-ADMIN-009 | 위와 동일 | 위와 동일 | PASS |
| AC-ADMIN-010 | `npx vitest run tests/unit/app/staff-order-detail-page.test.tsx` | `✓ tests/unit/app/staff-order-detail-page.test.tsx (8 tests) 537ms` | PASS |
| AC-ADMIN-011 | 위와 동일 | 위와 동일 — "renders no trace of the DB row's paymentKey value" 케이스 포함 | PASS |
| AC-ADMIN-012 | 위와 동일 | 위와 동일 — pending_payment/paid는 취소 버튼 노출, cancelled는 미노출 + 정적 소스 가드 | PASS |
| AC-ADMIN-013 | `npx vitest run tests/unit/admin/admin-order-repository.test.ts` | `✓ tests/unit/admin/admin-order-repository.test.ts (20 tests) 20ms` — "AC-ADMIN-013 no side effects on an invalid transition" 케이스 포함 | PASS |
| AC-ADMIN-014a | 위와 동일 | 위와 동일 — "pending_payment cancel restores stock" 케이스 포함 | PASS |
| AC-ADMIN-014b | 위와 동일 | 위와 동일 — "paid cancel restores stock + coupon redemption" 케이스 포함 | PASS |
| AC-ADMIN-015 | 위와 동일 | 위와 동일 — "writes exactly one PaymentAuditLog row" 케이스 포함 | PASS |
| AC-ADMIN-016 | `npx vitest run tests/unit/api/admin/order-status-route.test.ts` | `✓ tests/unit/api/admin/order-status-route.test.ts (9 tests) 41ms` | PASS |
| AC-ADMIN-017 | 위와 동일 | 위와 동일 — 세션 재판정(REQ-ADMIN-017) 케이스 포함 | PASS |
| AC-ADMIN-018 | `git diff --stat 265b54b72828160adf2dece66a33919e57e9ee76 -- src/middleware.ts src/features/payments/repositories/payment-repository.ts src/lib/auth/jwt.ts src/lib/auth/session.ts src/lib/auth/cookies.ts src/lib/auth/csrf.ts src/app/api/auth/` | (출력 없음 — 0줄) | PASS |

19행 전부 PASS. FAIL/INCONCLUSIVE 행 없음.

### Task 4 전체 검증 스위트 — 전체 verbatim 결과

**`npx tsc --noEmit`**:
```
$ npx tsc --noEmit
(표준출력 없음)
EXIT:0
```

**`npx eslint .`**:
```
$ npx eslint .
(표준출력 없음)
EXIT:0
```

**`npm run build`**:
```
> our-shop@0.1.0 build
> next build

 ⚠ Warning: Next.js inferred your workspace root, but it may not be correct.
 We detected multiple lockfiles and selected the directory of /Users/samuel/projects/pnpm-lock.yaml as the root directory.
 To silence this warning, set `outputFileTracingRoot` in your Next.js config, or consider removing one of the lockfiles if it's not needed.
   See https://nextjs.org/docs/app/api-reference/config/next-config-js/output#caveats for more information.
 Detected additional lockfiles: 
   * /Users/samuel/projects/our-shop/.claude/worktrees/SPEC-ADMIN-001/package-lock.json
   * /Users/samuel/projects/our-shop/package-lock.json

   ▲ Next.js 15.5.24
   - Environments: .env

   Creating an optimized production build ...
 ✓ Compiled successfully in 3.7s
   Linting and checking validity of types ...
   Collecting page data ...
   Generating static pages (0/23) ...
 ✓ Generating static pages (23/23)
   Finalizing page optimization ...
   Collecting build traces ...

Route (app)                                 Size  First Load JS
┌ ○ /                                      164 B         106 kB
├ ○ /_not-found                            993 B         103 kB
├ ƒ /admin/api/orders/[orderId]/status     167 B         102 kB
├ ƒ /api/auth/google                       167 B         102 kB
├ ƒ /api/auth/google/callback              167 B         102 kB
├ ƒ /api/auth/login                        167 B         102 kB
├ ƒ /api/auth/logout                       167 B         102 kB
├ ƒ /api/auth/refresh                      167 B         102 kB
├ ƒ /api/auth/signup                       167 B         102 kB
├ ƒ /api/cart                              167 B         102 kB
├ ƒ /api/cart/items                        167 B         102 kB
├ ƒ /api/cart/items/[itemId]               167 B         102 kB
├ ƒ /api/discounts/validate                167 B         102 kB
├ ƒ /api/orders                            167 B         102 kB
├ ƒ /api/orders/lookup                     167 B         102 kB
├ ƒ /api/payments/confirm                  167 B         102 kB
├ ƒ /api/payments/webhook                  167 B         102 kB
├ ƒ /api/products                          167 B         102 kB
├ ƒ /api/products/[productId]              167 B         102 kB
├ ƒ /cart                                1.68 kB         104 kB
├ ƒ /checkout                            2.95 kB         105 kB
├ ƒ /checkout/complete/[orderId]         1.08 kB         103 kB
├ ○ /orders/lookup                        2.1 kB         104 kB
├ ƒ /orders/lookup/[orderNumber]           167 B         102 kB
├ ƒ /products/[productId]                6.99 kB         109 kB
├ ○ /staff/login                         1.06 kB         103 kB
├ ƒ /staff/orders                          167 B         102 kB
└ ƒ /staff/orders/[orderId]                908 B         103 kB
+ First Load JS shared by all             102 kB

ƒ Middleware                             39.5 kB

○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand
EXIT:0
```

**`npx vitest run --exclude "**/tests/integration/auth/login.test.ts"`** — 전체 87개
테스트 파일, 관리자 관련 파일만 발췌(전체 87개 파일 결과는 아래 요약 참조):
```
 ✓ tests/unit/admin/admin-order-repository.test.ts (20 tests) 20ms
 ✓ tests/unit/api/admin/order-status-route.test.ts (9 tests) 41ms
 ✓ tests/unit/admin/admin-session.test.ts (7 tests) 214ms
 ✓ tests/unit/admin/middleware-preserve.test.ts (3 tests) 4ms
 ✓ tests/unit/app/staff-order-detail-page.test.tsx (8 tests) 537ms
 ✓ tests/unit/admin/accessibility.test.tsx (9 tests) 642ms
 ✓ tests/unit/app/staff-orders-page.test.tsx (10 tests) 206ms
 ✓ tests/unit/app/staff-login-page.test.tsx (6 tests) 261ms

 Test Files  87 passed (87)
      Tests  1053 passed (1053)
   Start at  22:35:29
   Duration  15.19s (transform 1.75s, setup 0ms, collect 7.65s, tests 38.09s, environment 26.16s, prepare 7.28s)
EXIT:0
```

`tests/integration/auth/login.test.ts`(사전 존재 flaky, `AC-AUTH-005`, backlog `t20`)는
이 실행에서 0건 매치 — 정상적으로 제외되었다. `tests/unit/api/auth/login.test.ts`(별개
경로, non-flaky)는 정상 포함되어 11건 전부 PASS.

**`npm run test:coverage -- --exclude "**/tests/integration/auth/login.test.ts"`** —
전역 임계값 + 이 SPEC이 생성/수정한 8개 파일 전체:
```
 Test Files  87 passed (87)
      Tests  1053 passed (1053)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   98.11 |     93.4 |   99.55 |   98.11 |
 src               |     100 |      100 |     100 |     100 |
  middleware.ts    |     100 |      100 |     100 |     100 |
 ...rderId]/status |     100 |      100 |     100 |     100 |
  route.ts         |     100 |      100 |     100 |     100 |
 ...pp/staff/login |     100 |    86.66 |     100 |     100 |
  page.tsx         |     100 |    86.66 |     100 |     100 | 44,62
 ...p/staff/orders |   99.17 |    93.33 |     100 |   99.17 |
  page.tsx         |   99.17 |    93.33 |     100 |   99.17 | 173
 ...ders/[orderId] |     100 |    92.85 |     100 |     100 |
  ...derButton.tsx |     100 |     87.5 |     100 |     100 | 28,41
  page.tsx         |     100 |      100 |     100 |     100 |
 ...n/repositories |     100 |      100 |     100 |     100 |
  ...repository.ts |     100 |      100 |     100 |     100 |
 ...admin/services |     100 |      100 |     100 |     100 |
  admin-session.ts |     100 |      100 |     100 |     100 |
 ...es/admin/types |     100 |      100 |     100 |     100 |
  admin.ts         |     100 |      100 |     100 |     100 |
-------------------|---------|----------|---------|---------|-------------------
EXIT:0
```

**전역 임계값 판정** (`vitest.config.ts` 설정값: lines≥85, functions≥85, branches≥80,
statements≥85 대비 실측 `All files` 행):

| 지표 | 임계값 | 실측 | 판정 |
|---|---|---|---|
| Lines | 85 | 98.11 | PASS |
| Statements | 85 | 98.11 | PASS |
| Functions | 85 | 99.55 | PASS |
| Branches | 80 | 93.4 | PASS |

**8개 SPEC 생성/수정 파일 개별 판정** (동일 임계값을 파일별로 적용):

| 파일 | Stmts | Branch | Funcs | Lines | 판정 |
|---|---|---|---|---|---|
| `admin-session.ts` | 100 | 100 | 100 | 100 | PASS |
| `admin-order-repository.ts` | 100 | 100 | 100 | 100 | PASS |
| `admin.ts`(types) | 100 | 100 | 100 | 100 | PASS(자명 — 타입 전용 파일) |
| `staff/login/page.tsx` | 100 | 86.66 | 100 | 100 | PASS |
| `staff/orders/page.tsx` | 99.17 | 93.33 | 100 | 99.17 | PASS |
| `staff/orders/[orderId]/page.tsx` | 100 | 100 | 100 | 100 | PASS |
| `CancelOrderButton.tsx` | 100 | 87.5 | 100 | 100 | PASS(2건 추가 전 69.23 — 위 M5 Task 4 절 참조) |
| `admin/api/orders/[orderId]/status/route.ts` | 100 | 100 | 100 | 100 | PASS |

8개 전부 PASS. 미달 파일 없음.

### PRESERVE 4경로 + auth API 전체 — SPEC 전체 이력 재확인

```
$ git merge-base HEAD origin/main
265b54b72828160adf2dece66a33919e57e9ee76
$ git diff --stat 265b54b72828160adf2dece66a33919e57e9ee76 -- src/middleware.ts src/features/payments/repositories/payment-repository.ts src/lib/auth/jwt.ts src/lib/auth/session.ts src/lib/auth/cookies.ts src/lib/auth/csrf.ts src/app/api/auth/
(출력 없음 — 0줄)
```

AC-ADMIN-018 재확인 — PASS(빈 diff, M1~M5 전체 이력에 걸쳐).

### 알려진 잔여 항목 2건 (문서화됨, 이 SPEC의 자동 DoD 밖)

(a) **사전 존재 flaky `AC-AUTH-005` 테스트**(`tests/integration/auth/login.test.ts`,
backlog `t20`) — 이 SPEC과 무관, M1~M5 전 마일스톤의 확립된 관례에 따라 모든 검증
실행에서 제외했다. `AC-ADMIN-*` 어느 것도 이 파일에 의존하지 않는다.

(b) **AC-ADMIN-EXCL-CONCURRENCY**(정적 형태 검사만) — `acceptance.md` 자체의 제외
절이 명시한 대로, 두 관리자의 동시 취소가 실제 PostgreSQL에서 직렬화되는 것의
**실측 관측**은 이 SPEC의 자동 DoD에서 제외된다. `cancelOrderAsAdmin()`이
조건부 원자 `updateMany`(where에 소스 상태 포함) 형태를 쓴다는 것만 정적으로
확인했다(M5 Task 2) — 실제 두 트랜잭션이 동시에 붙었을 때의 락 경합·직렬화 순서는
관측하지 않았다. `SPEC-ORDER-002`의 `AC-013-EXCL-CONCURRENCY`와 동일한 성격·동일한
근거의 제외다.

## §E.4 Sync-phase Audit-Ready Signal

_<pending sync-phase>_
