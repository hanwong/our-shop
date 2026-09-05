# SPEC-E2E-001 (compact)

> 결제·주문 경로 E2E 테스트 시나리오 (게스트 전용) — Tier M · P1 · v0.2.0 target

## 한 줄 요약

이 저장소에 **처음으로** 브라우저 레벨 E2E를 세우고, 장바구니 → `/checkout` → 결제 → 주문 완료 여정을 실제 브라우저·실제 HTTP·실제 서버로 훑는다. Toss는 전 구간 모킹한다.

## 왜

기존 110개 Vitest 파일은 핸들러를 직접 호출하거나 jsdom에 마운트한다 — **실제 HTTP를 만들지 않는다.** 그래서 `src/middleware.ts`, 라우팅·리다이렉트 체인, 서버렌더→하이드레이션 경계, 쿠키 왕복이 통째로 미검증이다. `/admin/*` 라우트가 미들웨어에 막혀 도달 불가였는데 당시 전체 단위·통합 스위트와 plan-audit을 모두 통과한 사례가 이 공백의 증거다. (동기일 뿐, `/admin/*`은 이 SPEC의 검증 대상이 아니다.)

## 무엇을

| | |
|---|---|
| 도구 | Playwright (Chromium 단일, 버전 핀 고정) |
| 위치 | `e2e/` + 별도 `test:e2e` 스크립트 (기존 `test` 불변) |
| 여정 | 상품 상세 → 장바구니 → `/checkout` → 결제 → `/checkout/complete/{orderId}` |
| 신원 | 게스트 전용 (`GUEST_CART_COOKIE_NAME`) |
| 요구사항 | REQ-E2E-001 ~ 016 (GEARS, Tier M 상한 16) |
| 인수 기준 | AC-E2E-001 ~ 015 (Given-When-Then, 005a/005b 분기 포함 16항목) |

## 핵심 난점 — 결제 모킹이 두 프로세스에 걸쳐 있다

- **다리 1 (브라우저)**: `js.tosspayments.com/v2/standard` 스크립트 → Playwright `page.route()` 로 스텁 SDK 주입. 성공/실패 모드를 `window.__E2E_PAYMENT_MODE__` 로 전환.
- **다리 2 (서버)**: `/api/payments/confirm` → `confirmTossPayment()` → **하드코딩된** `api.tosspayments.com`. `page.route()` 로 못 잡는다.
  → **확정** (`plan.md` §B): 테스트 전용 undici `setGlobalDispatcher` 네트워크 모킹으로 `confirm`/조회 두 호출을 가로챈다. **프로덕션 소스 변경 0줄** (베이스 URL 환경 변수 이음매는 기각). M1 스파이크가 실제 가로채기를 먼저 증명한다.

전 시나리오에 **Toss 호스트 감시 라우트**를 설치해 요청이 한 건이라도 나가면 실패시킨다.

## 마일스톤

M1 하네스 뼈대 + 다리 2 스파이크 → M2 스텁 SDK → M3 해피 패스 → M4 실패·엣지 → M5 격리 정리 → M6 문서

## 범위 밖 (누락 아님, 확정된 제외)

- 동시성 · 재고 경합 · 롤백 → SPEC-ORDER-002
- `/orders/lookup` 재방문 → SPEC-ORDER-003
- 로그인 회원 결제 → 앱에 경로 자체가 없음 (`409 MEMBER_CHECKOUT_UNSUPPORTED`)
- `/admin/*` 도달 가능성 → 별개 표면
- **CI 통합** → CI에 도달 가능한 데이터베이스가 없다 (SPEC-CI-001은 completed·DB 범위 밖). 로컬 실행 전용.
- 테스트 코드 작성 자체 → run-phase

## 전제

로컬 PostgreSQL(시드 상품 필요) · `DATABASE_URL` · `NEXT_PUBLIC_PG_CLIENT_KEY` · `PG_SECRET_KEY` (값은 스텁 가능, 존재는 필수) · Node 22
