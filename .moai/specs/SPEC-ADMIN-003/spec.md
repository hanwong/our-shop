---
id: SPEC-ADMIN-003
title: "관리자 쓰기 API 경로 이전과 미들웨어 통과 검증 계층"
version: "0.1.2"
status: in-progress
created: 2026-09-04
updated: 2026-09-04
author: snake
priority: P0
phase: "v0.2.0 target"
module: "src/app/staff/api"
lifecycle: spec-anchored
tags: "admin, backoffice, middleware, routing, regression-guard, silent-failure"
tier: L
depends_on: [SPEC-ADMIN-001, SPEC-ADMIN-002, SPEC-AUTH-001]
related_specs: [SPEC-ORDER-001, SPEC-PAYMENT-001, SPEC-CATALOG-001]
---

# SPEC-ADMIN-003 — 관리자 쓰기 API 경로 이전과 미들웨어 통과 검증 계층

## HISTORY

| 날짜 | 버전 | 상태 | 내용 |
|------|------|------|------|
| 2026-09-04 | 0.1.0 | draft | plan-phase 최초 작성. 백로그 카드 `t28`을 다룬다. `SPEC-ADMIN-002` sync-audit이 실측한 결함 — 관리자 쓰기 API 4개가 `src/middleware.ts`의 매처에 가로막혀 핸들러가 아예 실행되지 않고, 브라우저 `fetch`가 307 리다이렉트를 따라가 200을 받으므로 폼이 **성공했다고 보고**한다 — 을 닫는다. 실측 증거는 라이브 서버 7회 프로브(`.moai/state/verify/sync-t11/audit-middleware-probe.log`). 이 SPEC은 **두 겹**으로 닫는다: (1) 네 라우트를 매처 밖 `/staff/api`로 옮기고, (2) 이 부류가 재발했을 때 자동으로 실패하는 검증 계층을 추가한다 — 저장소에 미들웨어를 통과하는 테스트가 단 한 건도 없었다는 것이 268개 테스트·24개 AC·plan-audit PASS가 전부 이 결함을 놓친 근본 원인이기 때문이다(research.md §4). |
| 2026-09-04 | 0.1.1 | draft | plan-audit iteration 1 **FAIL**(집계 0.79 < Tier L 0.85, MP-7 clarification gate 실패)에 대한 iteration 2 개정. blocking 12건(D1~D12) + optional 2건 전건 해소. 핵심 두 가지: (1) **`tests/`가 영향 집합에서 통째로 빠져 있던 것** — D2·D4·D11·D12의 공통 뿌리 — 을 §1 "테스트 파일 봉투" 표 · REQ-ADMIN-054/055 · AC-ADMIN-054/055 · plan.md M3로 구조적으로 닫았고, (2) A층 가드가 세 곳에서 **조용히 느슨해질 수 있던 것**(빈 매처 fail-open, `route.ts` 한 확장자만 열거, `:param*`의 0세그먼트 누락)을 design.md §3.1 ①②③과 AC-048/049 강화로 닫았다. 결정 2(리다이렉트 실패 처리)는 사용자 결정으로 확정되어 명확화 마커 2건을 제거했고, 결정 1의 셋째 근거는 실측 반증에 따라 철회했다. 항목별 조치는 progress.md §E.1의 이력 표. |
| 2026-09-04 | 0.1.2 | draft | plan-audit iteration 2 **FAIL**(집계 0.87 ≥ Tier L 0.85, must-pass 7건 전부 통과 — 판정을 가른 것은 **미해소 blocking 2건**)에 대한 iteration 3 개정이자 retry loop 상한. (1) 철회된 결정 1의 셋째 근거가 `progress.md`의 승인 게이트 요약에 살아남아 있던 것을 제거하고, 구조적 잠금이 없으며 **A층 배치 가드가 유일한 방어층** 이라는 귀결을 명시했다. (2) 사용자 결정 2(리다이렉트 실패 처리)의 **변별 요소가 REQ·AC 어디에도 없어 기각된 `redirect: "manual"`이 16개 AC를 전부 통과하던 것** 을 닫았다 — REQ-ADMIN-046에 전용 상수 문구, REQ-ADMIN-047에 `response.ok` 앞 배치를 올리고 AC-ADMIN-046a·046b·047이 이를 판정한다. optional 5건(요약의 (c) 취소선 표기, AC-053a 자기 아티팩트 제외, REQ-045 이중 집행 정정, AC-049 무조건 FAIL 픽스처, 이동 파일 자신의 문서 주석 4건 M1 등재)도 함께 처리했다. REQ 14건 · AC 16건 개수는 불변. 항목별 조치는 progress.md §E.1의 이력 표. |

---

## §1. 배경 — 이 결함은 예측되어 있었고, 두 번 잘못 판단되었다

이 SPEC이 닫는 공백은 새로 발견된 것이 아니라, 저장소에 **두 곳에 문서로 남아 있던 예측이 각각 다른 이유로 빗나간** 결과다.

**첫 번째 — `src/middleware.ts` 자신의 문서 주석(`:16~31`)** 은 이 실패를 정확히 예고하고 범위 밖으로 선언했다:

> "A real frontend serving protected admin pages would need a same-origin API-call pattern (e.g. a client-side route guard that calls a same-origin endpoint carrying the header, rather than relying on a raw top-level navigation to carry auth) — that frontend pattern is outside this SPEC's API-only scope."

`SPEC-ADMIN-001`이 이 예고를 받아 **페이지** 를 `/staff`로 옮겼다(REQ-ADMIN-004). 옮기지 않은 것이 **API** 다.

**두 번째 — `SPEC-ADMIN-001` design.md §1** 이 API를 `/admin/api`에 남긴 근거:

> "왜 API는 `/admin/api` 안에 두는가: 미들웨어와의 충돌이 없다(API는 클라이언트 JS의 `fetch`가 호출하므로, 원한다면 `Authorization` 헤더도 얹을 수 있어 미들웨어의 검사를 통과할 여지가 있다) ... 단 API는 fetch 응답 리다이렉트를 그대로 받으므로 클라이언트가 302를 오류로 처리"

이 문장에는 **두 개의 사실 오류** 가 있고, 둘 다 실측으로 반증되었다(research.md §2·§3):

1. "원한다면 `Authorization` 헤더를 얹을 수 있다" — 얹을 수 없다. `REQ-AUTH-009`가 액세스 토큰을 **클라이언트 메모리에만** 두므로, `refresh_token` 쿠키로 인증하는 `/staff/*` 화면은 토큰을 애초에 손에 넣지 못한다. 헤더를 얹을 "여지"는 설계상 존재한 적이 없다.
2. "클라이언트가 302를 오류로 처리" — 처리하지 못한다. 브라우저 `fetch`의 기본 `redirect: "follow"`는 307을 **메서드를 유지한 채** 따라가 `/`에서 **200** 을 받는다. 따라서 `response.ok === true`이고, 호출부는 성공 분기로 들어간다.

두 오류가 합쳐진 결과가 이 카드의 증상이다: **아무것도 쓰이지 않았는데 화면은 성공을 보고한다.**

### 소비하는 계약

| 계약 | 종류 | 이 SPEC에서의 취급 |
|---|---|---|
| `SPEC-AUTH-001` `src/middleware.ts`(REQ-AUTH-022) | 미들웨어 | **완전 무변경(PRESERVE)** — 바이트 단위로 동일. `tests/unit/admin/middleware-preserve.test.ts`가 **수정 없이** 계속 통과해야 한다 |
| `SPEC-ADMIN-001` REQ-ADMIN-004 (매처와 겹치지 않는 별도 경로) | 요구사항 | **그대로 따른다** — 이 SPEC은 그 요구사항이 원래 덮으려 한 범위(백오피스 표면 전체)로 API까지 끌어온다 |
| `SPEC-ADMIN-001` `resolveAdminSession()` / `verifyCsrfRequest()` | 인증·CSRF | **호출부·순서·응답 모양 전부 불변** — 파일이 옮겨질 뿐 로직은 한 줄도 바뀌지 않는다 |
| `SPEC-ADMIN-002` REQ-ADMIN-040 (쓰기 API는 `/admin/api` 하위) | 요구사항 | **이 SPEC이 대체한다** — `SPEC-ADMIN-002`는 미병합 진행 중이므로 같은 PR에서 정정한다(plan.md §0 결정 3) |
| `SPEC-ADMIN-001` design.md §1 / plan.md `:46` (`/admin/api` 배치 근거) | 설계 기록 | **원문 보존 + 승계 표시만 추가** — 이 SPEC의 근본 원인 분석이 인용하는 1차 증거이므로 논거를 다시 쓰지 않는다 |

### 소비하는 계약 — 테스트 파일 봉투 (EXTEND)

위 표가 **문서** 계약을 다룬다면, 이 표는 같은 계약을 **기계적으로 집행하는 테스트 파일** 을 다룬다. 네 파일 모두 이 SPEC이 옮기는 네 라우트의 옛 경로를 리터럴로 담고 있으며(`grep -c 'admin/api'` 실측 합계 **41건**), 문서만 정정하고 이 표를 비워 두면 집행자가 계약과 어긋난 채 남는다. 네 파일은 하나의 봉투로 취급하며 REQ-ADMIN-054·055가 그 완료를 판정한다.

| 테스트 파일 | 소유 SPEC / 상태 | `admin/api` 실측 | 이 SPEC에서의 취급 |
|---|---|---|---|
| `tests/unit/admin/product-boundaries.test.ts` | `SPEC-ADMIN-002` · `implemented`, **미병합** — `AC-ADMIN-040`의 기계적 집행자 | 18 | **재작성** — 이 SPEC이 대체하는 `REQ-ADMIN-040`의 **역명제** 를 단언한다. `:198` `walk("src/app/admin")`과 `:213` `read("src/app/admin/api/products/route.ts")`은 이동 직후 실패가 아니라 **ENOENT 예외** 로 터진다. AC-ADMIN-040 집행 블록(`:186~219`)을 새 경로 규약으로 다시 쓰고, 경로 상수(`:27~30`·`:157~159`·`:171~173`)와 `:118~119` 필터를 갱신한다 (REQ-ADMIN-055) |
| `tests/unit/api/admin/order-status-route.test.ts` | **`SPEC-ADMIN-001` · `completed`, 병합됨(PR #15)** | 11 | **본문 정정** — `await import("@/app/admin/api/…")` 지정자 9건, 문서 주석 1건(`:4`), 요청 URL 리터럴 1건(`:32`). **완료·병합된 SPEC이 소유한 파일이므로 소유권 교차 승인 대상** 이다(plan.md §0 결정 3) |
| `tests/unit/api/admin/product-routes.test.ts` | `SPEC-ADMIN-002` · `implemented`, 미병합 | 8 | **본문 정정** — `await import` 지정자 3건(`:59`·`:60`·`:62`), 요청 URL 리터럴 3건(`:51`·`:53`·`:55`), describe 제목 2건(`:136`·`:158`) |
| `tests/unit/app/staff-product-form.test.tsx` | `SPEC-ADMIN-002` · `implemented`, 미병합 | 4 | **본문 정정** — URL 리터럴 단언 3건(`:107`·`:164`·`:294`)과 describe 제목 1건(`:94`). 전부 문자열 리터럴이므로 `npm run typecheck`로는 잡히지 않는다 |

---

## §2. 요구사항 (GEARS)

### 경로 이전

- **REQ-ADMIN-042** (Ubiquitous): 관리자 쓰기 API 라우트는 `src/middleware.ts`의 매처가 닿지 않는 `/staff/api` 하위 경로에 있어야 한다.
- **REQ-ADMIN-043** (Ubiquitous): 이전 대상 네 라우트와 그 공유 모듈은 파일 위치와 `import` 경로만 바뀌어야 하며, 각 핸들러의 검사 순서(CSRF 선행 → 세션 재판정 → 본문 검증 → 쓰기), 상태 코드, 응답 본문 모양은 이전 전후로 동일해야 한다.
- **REQ-ADMIN-044** (Ubiquitous): 이전이 끝난 뒤 `src/app/admin` 하위에는 파일이 0건이어야 한다.
- **REQ-ADMIN-045** (Ubiquitous): 런타임 동작에 관여하는 `src/` 하위에서, 옛 경로를 부르는 모든 호출부(`fetch` 인자)와 이를 언급하는 모든 문서 주석은 새 경로를 가리켜야 한다. (`tests/` 하위의 같은 문자열은 REQ-ADMIN-054가 별도로 덮는다. REQ-ADMIN-054의 grep 범위는 `src/ tests/`이므로 `src/`는 두 요구사항이 **이중으로 집행** 한다 — 양쪽 모두 0건을 요구하므로 판정이 상충하지 않는다. 이 한정의 목적은 범위 분리가 아니라, **이 요구사항이 책임지는 대상을 런타임 코드로 명시** 하는 것이다.)

### 조용한 실패를 소리 나는 실패로

- **REQ-ADMIN-046** (Event-driven): 관리자 쓰기 요청이 리다이렉트 응답을 받으면, 호출부는 그것을 성공이 아니라 **실패** 로 처리하고 사용자에게 오류를 표시해야 한다. 이때 표시되는 문구는 세 호출부가 **공유하는 단일 전용 상수** — `요청이 처리되지 않았습니다. 변경 사항이 저장되지 않았습니다.` — 여야 하며, 원인을 지우는 기존 일반 오류 문구로 대체되어서는 안 된다.
- **REQ-ADMIN-047** (Unwanted, shall not): 관리자 쓰기 호출부는 리다이렉트를 따라간 결과의 상태 코드만으로 성공 여부를 판정해서는 안 되며, 리다이렉트 여부를 검사하는 분기(`response.redirected` 검사)는 각 호출부의 소스에서 `response.ok` 판정보다 **앞에** 놓여야 한다.

### 재발을 자동으로 잡는 검증 계층

- **REQ-ADMIN-048** (Ubiquitous): 저장소는 `src/app` 하위의 **모든** 라우트 핸들러 파일 — Next.js App Router가 라우트 핸들러로 인식하는 파일명 집합 전체(`route.ts` · `route.tsx` · `route.js` · `route.jsx`) — 를 열거하고 각각의 URL 경로를 `src/middleware.ts`가 선언한 매처와 대조해, 매처에 걸리는 라우트 핸들러가 있으면 실패하는 배치 가드 테스트를 가져야 한다.
- **REQ-ADMIN-049** (Ubiquitous): 배치 가드는 매처 값을 테스트 안에 복제하지 않고 `src/middleware.ts`에서 읽어야 하며, 새 라우트 파일이 추가될 때 테스트를 손대지 않아도 자동으로 검사 대상에 포함해야 한다. 매처를 읽어 내지 못했을 때 — 추출 결과가 빈 배열인 경우를 포함해 — 가드는 통과가 아니라 **실패** 해야 한다.
- **REQ-ADMIN-050** (Ubiquitous): 저장소는 `src/middleware.ts`가 내보내는 `middleware()` 함수를 실제 `NextRequest`로 직접 호출해 그 응답을 검사하는 동작 테스트를 가져야 하며, 그 테스트는 무헤더 요청과 잘못된 `Bearer` 토큰 요청 모두에 대해 리다이렉트 응답이 반환된다는 것과, 그 응답이 **리다이렉트이기 때문에** 뒤따르는 `fetch`에서 성공으로 오인될 수 있다는 성질을 명시적으로 고정해야 한다.
- **REQ-ADMIN-051** (Ubiquitous): 위 두 테스트는 이 SPEC이 옮기는 네 라우트의 이름을 하드코딩하지 않고, 장래에 추가될 라우트에도 같은 판정을 적용해야 한다.

### 보존과 정정

- **REQ-ADMIN-052** (Unwanted, shall not): 이 SPEC은 `src/middleware.ts`, `resolveAdminSession()`, `verifyCsrfRequest()`, 그리고 `tests/unit/admin/middleware-preserve.test.ts`를 변경해서는 안 된다.
- **REQ-ADMIN-053** (Ubiquitous): 이웃 SPEC의 산출물은 **계약과 기록을 갈라** 다루어야 한다 — `SPEC-ADMIN-002`의 계약 문서(spec.md · plan.md · acceptance.md · design.md) 중 `/admin/api` 경로를 단언하거나 요구하는 부분(REQ-ADMIN-040 / AC-ADMIN-040 포함)은 이 SPEC과 같은 PR 안에서 새 경로로 정정되어야 하고, `SPEC-ADMIN-001`의 설계 근거 원문은 승계 표시만 덧붙인 채 보존되어야 하며, 두 SPEC의 `research.md`와 `progress.md`는 그 시점의 기록물이므로 변경되어서는 안 된다.

### 옛 경로를 집행하는 테스트 봉투

- **REQ-ADMIN-054** (Ubiquitous): §1 "소비하는 계약 — 테스트 파일 봉투" 표가 열거한 네 테스트 파일은 새 경로를 가리켜야 하며, 이전이 끝난 트리에서 `grep -rn 'admin/api' src/ tests/`의 출력은 0건이어야 한다.
- **REQ-ADMIN-055** (Ubiquitous): `tests/unit/admin/product-boundaries.test.ts`의 `AC-ADMIN-040` 집행 블록은 새 배치 규약(관리자 쓰기 API는 `/staff/api` 하위, 그 아래에 페이지 파일 0건, `src/app/admin` 부재)을 단언하도록 다시 쓰여야 하며, 같은 파일의 나머지 집행 블록(`AC-ADMIN-020` · `028` · `036` · `037` · `039` · `041`)의 판정 대상과 판정력은 경로 문자열 갱신 외에 바뀌어서는 안 된다.

---

## §3. 범위 밖 (Out of Scope)

이 절은 이 SPEC이 **만들지 않는 것** 을 고정한다. 아래 항목은 범위 밖이며, 이 SPEC의 어떤 마일스톤에도 배정되지 않는다.

### Out of Scope — 미들웨어 자체의 수정

- `src/middleware.ts`의 매처를 `/admin/api/:path*`로 좁히는 대안은 채택하지 않는다. `SPEC-ADMIN-001` plan.md `:12`가 이미 같은 대안을 검토하고 "완료·테스트로 고정된 `SPEC-AUTH-001` 파일을 수정해야 함"을 이유로 기각했다.
- 미들웨어에 쿠키 기반 세션 판정을 추가하는 대안도 채택하지 않는다 — 라우트 핸들러가 이미 스스로 판정하므로 두 번째 판정 지점을 만들 뿐이다.

### Out of Scope — 클라이언트 액세스 토큰 흐름

- `/staff/*` 화면이 액세스 토큰을 손에 넣어 `Authorization` 헤더를 얹게 만드는 프런트엔드 패턴은 만들지 않는다. `REQ-AUTH-009`(메모리 전용 액세스 토큰)를 건드리는 일이며, 이 카드가 요구하는 것보다 훨씬 넓다.

### Out of Scope — 관리자 조회 API

- `GET /staff/api/products`, `GET /staff/api/orders`는 만들지 않는다. `SPEC-ADMIN-001` design.md §3과 `SPEC-ADMIN-002` design.md §2가 이미 "서버 컴포넌트가 저장소를 직접 호출한다"로 확정했고, 이 SPEC은 그 결정을 바꾸지 않는다.

### Out of Scope — 라이브 서버 통합 테스트 하네스

- `next dev`/`next build`를 띄워 HTTP로 프로브하는 상시 테스트 하네스는 도입하지 않는다. 근거와 대안 비교는 design.md §3에 있다.

### Out of Scope — 완료된 SPEC의 설계 논거 재작성

- `SPEC-ADMIN-001`(`status: completed`, main 병합 완료)의 plan.md·design.md에 담긴 `/admin/api` 선택 근거는 **다시 쓰지 않는다**. 그 원문이 이 SPEC 근본 원인 분석의 1차 증거다.

### Out of Scope — 다른 백로그 카드

- `SPEC-ADMIN-002`가 넘긴 "장바구니에 담긴 판매 중단 상품이 결제까지 통과하는 공백"은 이 SPEC이 떠안지 않는다.
- 알려진 타이밍 flake 카드 `t20`은 이 SPEC의 범위가 아니다.
