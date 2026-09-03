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

_<pending run-phase>_

## §E.3 Run-phase Audit-Ready Signal

_<pending run-phase>_

## §E.4 Sync-phase Audit-Ready Signal

_<pending sync-phase>_
