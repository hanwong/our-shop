# progress.md — SPEC-ORDER-004

## §E.1 Plan-phase Audit-Ready Signal

plan_status: audit-ready
plan_complete_at: 2026-09-05
plan_audit_verdict: PASS (iteration 3/3)
plan_audit_score: 0.99 (Tier L 임계값 0.85 초과. iteration 1은 0.83 FAIL, iteration 2는 0.97이나 D3-R 미해결로 contract FAIL)
plan_audit_report: .moai/reports/plan-audit/SPEC-ORDER-004-2026-09-05.md

**plan-auditor iteration 1 verdict: FAIL** (독립 감사, score 0.83 < Tier L 임계값 0.85). must-pass 7개 기준은 전부 통과했고, FAIL은 총점 미달에서 나왔다 — Clarity 차원이 D1·D2 두 결함으로 0.60까지 떨어진 것이 주 원인이다. blocking 5건(D1-D5) + optional 5건(D6-D10)이 보고되었다.

**plan-auditor iteration 2 verdict: FAIL (contract)** — score 0.97로 임계값을 넉넉히 넘겼으나, D3가 **두 곳 중 한 곳만** 고쳐진 채 남아 통과하지 못했다. `design.md:174`가 여전히 낡은 호출자 수를 주장하면서, 같은 iteration이 새로 만든 올바른 `research.md:241` 표와 한 SPEC 안에서 모순했다. 점수가 아니라 정정 완결성이 막은 FAIL이다. iteration 3에서 그 한 곳을 고치고, 같은 실수가 다른 곳에도 있는지 6개 아티팩트를 전수 확인했다(아래 재검증 절).

**결함 수정 완료 (10건 전부 — optional 포함)**:

- **D1 (major, blocking, 수정됨)** — CSRF 순서 자기모순. "회원 경로에만 CSRF" + "CSRF를 모든 DB 접근보다 먼저" + "CSRF가 세션 해석보다 먼저"는 동시에 성립할 수 없다. 회원 여부를 판정하는 `resolveSession()` 자체가 DB 조회(`prisma.refreshToken.findFirst`)이기 때문이다. **정정**: 순서를 세션 해석 → (회원이면) CSRF → 본문 파싱 → 트랜잭션으로 뒤집고, `design.md` §3.4를 신설해 근거를 적었다 — `resolveSession()`은 읽기 전용이므로(REQ-AUTH-034) CSRF보다 앞서도 안전하며, 지켜야 할 불변식은 "CSRF가 DB보다 먼저"가 아니라 **"CSRF가 변경 동작보다 먼저"**다. `design.md` 흐름도·§3.3, `plan.md` M2, REQ-ORDER-064, AC-ORDER-069 전부 갱신. 감사가 지목한 선례(`staff/api/orders/[orderId]/status/route.ts:14-16`)를 §3.4에 인용하되, 그 라우트는 관리자 전용 단일 경로라 조건 판정이 필요 없다는 **구조적 차이**를 함께 적었다 — 물려받는 것은 배치가 아니라 원칙이다.
- **D2 (major, blocking, 수정됨)** — REQ-ORDER-055/AC-ORDER-057이 지정 메커니즘으로 충족 불가. `resolveCartIdentity()`는 **유효한** Bearer 토큰에 대해 `{kind:"user", userId}`를 반환하고 게스트 식별자를 만들지 않으므로(`cart-service.ts:69-76`), 그 함수로는 "유효 Bearer + 세션 없음 → 게스트 주문"을 만들 수 없다. **정정**: `design.md` §3.2.1을 신설해 실제 메커니즘을 지정했다 — 주문 라우트는 `resolveCartIdentity()`를 **호출하지 않고**, `resolveSession()`이 `null`이면 헤더와 무관하게 `readGuestCartId()` / `generateGuestCartId()` / `buildGuestCartCookie()`(전부 `guest-identity.ts`가 이미 export)로 게스트 신원을 직접 구성한다. AC-ORDER-057에 `grep -n "resolveCartIdentity" src/app/api/orders/route.ts` = 0건이라는 구조적 확인을 추가해, 무시가 주석이 아니라 **호출 부재**로 표현되게 했다.
- **D3 (major, blocking, iteration 2에서 부분 수정 → iteration 3에서 완결)** — 허위 "grep 검증" 주장. `resolveSession()` 호출자를 "정확히 둘"이라고 적었으나 실제로는 **셋**이다(`SiteHeader.tsx:30` 누락). 근본 원인은 재검증 없이 SPEC-AUTH-003 §1.3 표를 옮겨 적은 것 — 그 표는 AUTH-003이 자기 소비자(`SiteHeader`)를 만들기 **전에** 작성된 것이었다.

  **iteration 2에서 고친 것**: `research.md` §4의 표 하나. `grep -rn "resolveSession(" src`를 직접 실행해 3행으로 다시 만들고, 첫 행의 잘못된 경로(`src/app/products/...` → `src/app/(shop)/products/...`)를 고쳤으며, 오류의 원인을 같은 절에 기록했다.

  **iteration 2에서 놓친 것**: 같은 오류가 **두 곳**에 있었고 `design.md:174`(§3.1)를 고치지 않았다 — iteration 1 리포트가 그 위치도 함께 지목했는데, 표만 고치고 산문은 훑지 않았다. 그 문장은 같은 두 오류(호출자 수, `(shop)` 경로 누락)를 그대로 갖고 있었고, 결국 iteration 2가 만든 올바른 `research.md:241` 표와 **같은 SPEC 안에서 서로 모순**하는 상태가 되었다. iteration 2가 0.97을 받고도 contract FAIL이 난 원인이다.

  **iteration 3에서 고친 것**: `design.md:174`를 세 호출자 전부로 다시 쓰고(`(shop)` 경로 복원, `SiteHeader.tsx:30` 추가), 인용을 낡은 전사 출처(AUTH-003 §1.3)에서 `research.md` §4로 옮겼다. 그 문장에 있던 세 번째 오류 — "둘 다 리뷰 관심사"라는 서술 — 도 함께 고쳤다. `SiteHeader`는 리뷰 도메인이 아니므로 호출자가 셋이 되면서 그 문장도 거짓이 되었기 때문이다.

  **교훈(다음 정정에 적용)**: 한 사실이 여러 아티팩트에 흩어져 있을 때, 정본 표 하나를 고치는 것으로 정정이 끝났다고 보면 안 된다. 같은 주장을 하는 산문까지 grep으로 전수 확인해야 한다 — 표와 산문이 어긋나면 감사는 그것을 새 결함으로 읽는다.
- **D4 (minor, blocking, 수정됨)** — `verifyCsrfRequest()` 호출자를 2곳(logout, refresh)이라고 적었으나 실제로는 **6곳**이다(staff 라우트 4곳 누락). `grep -rn "verifyCsrfRequest(" src` 직접 실행으로 6행 표를 `research.md` §4.1에 작성. 핵심 주장(`POST /api/orders`에는 CSRF가 전혀 없다)은 재확인 결과 그대로 유효하다.
- **D5 (minor, blocking, 수정됨)** — `scope-boundaries.test.ts`의 소스 텍스트 단언을 5건으로 셌으나 실제로는 **6건**이다(`:134` `throw new OrderAbort` 누락). 이 단언이 가장 무거운 속성을 지킨다 — Prisma는 던진 오류에 롤백하고 **반환된 값에는 커밋하므로**, 회원 분기의 거부를 `return`으로 쓰면 부분 주문이 저장된다. `research.md` §2.5에 6행 표를 만들고, `design.md` §6.3의 잘못된 행 범위(`:118-124` → 실제 `:122`,`:123`,`:127`,`:128`)를 정정했으며, `plan.md`(4곳)·`acceptance.md` AC-ORDER-060의 인용을 전부 갱신했다.
- **D6 (optional, 수정됨)** — `plan.md` §A가 문구 밀스톤을 M6이라 했으나 §F 목록에서는 M7이다. §A에 전체 순서(M1~M7)를 명시해 정렬했다.
- **D7 (optional, 수정됨)** — `research.md` §3의 기준선 인용을 AC-ORDER-063 → AC-ORDER-072로 정정(게스트 무회귀는 AC-ORDER-071이 별도로 담당함을 함께 명시).
- **D8 (optional, 수정됨)** — SPEC-ORDER-003 인용 행 번호를 `:111-112` → `:113`으로 정정(`:111`은 절 제목). `spec.md` 두 곳 전부.
- **D9 (optional, 수정됨)** — AUTH-003 표에 "원문 그대로" 라벨을 달았으나 실제로는 두 셀을 고쳤다. **의도적 각색임을 명시**하는 쪽으로 처리했다 — 원문의 자기지시 표현 "이 SPEC"이 이 문서 안에서는 SPEC-ORDER-004를 가리키는 것으로 오독되므로 `SPEC-AUTH-003`으로 바꿨고, 무엇을 왜 바꿨는지 표 아래에 적었다.
- **D10 (optional, 수정됨)** — REQ-ORDER-053의 GEARS 라벨이 `(Event-detected)`였으나 본문은 실패 모드가 아니라 정상 상태(게스트 방문자)를 서술한다. `(State-driven)`으로 정정하고 본문도 `While` 절로 다시 썼으며, D2의 메커니즘(쿠키 읽기 또는 신규 발급)을 요구사항 안에 명시했다.

**재검증 (감사 메시지 내용을 옮겨 적지 않고 직접 실행)**: `grep -rn "resolveSession(" src` → 호출 3곳 확인. `grep -rn "verifyCsrfRequest(" src` → 호출 6곳 확인. `grep -n "orderService" tests/unit/orders/scope-boundaries.test.ts` → 단언 6건 확인. 미해소 명료화 마커 0건. REQ 20개(046~065) / AC 24개(050~073) 유지 — Tier L 상한 25 이내이며 시퀀스 공백 없음.

**iteration 3 전수 확인 (D3 재발 방지)**: 6개 아티팩트 전부를 대상으로 호출자 수·단언 수 주장을 grep으로 훑었다. 결과 — `resolveSession()` "셋"이 `design.md:174`와 `research.md:233` 두 곳에서 일치, `verifyCsrfRequest()` "여섯"이 `design.md:241`과 `research.md:256`에서 일치, 소스 텍스트 단언 "여섯"이 `acceptance.md:124` / `design.md:376` / `plan.md`(4곳) / `research.md`(4곳)에서 일치, `resolveCartIdentity()` "5곳 중 4곳"이 `spec.md:202` / `design.md:194` / `research.md:279`에서 일치. 남아 있는 `SPEC-AUTH-003 §1.3` 언급과 `src/app/products/...` 문자열은 전부 **정정 기록 안에서 낡은 출처를 명시적으로 인용하는 문장**이며(`research.md:241`, `progress.md` D3 항목), 살아 있는 주장이 아니다.

### Phase 1 SKIP Rationale — 별도 명료화 라운드를 돌리지 않은 이유

착수 전 사용자가 AskUserQuestion으로 **세 가지 범위 결정을 이미 확정한 상태**로 위임되었다.

1. **신원 해석 메커니즘** = `resolveSession()` 쿠키 방식(Bearer 토큰 경로가 아님). 근거: 저장소에 클라이언트 측 인증 상태 저장소가 하나도 없어 체크아웃 제출 시점에 메모리 전용 액세스 토큰을 쥐고 있을 보장이 없는 반면, httpOnly 쿠키는 페이지 로드 시점과 무관하게 항상 붙는다.
2. **스키마 형태** = 평문 nullable `userId String?` + `@@index([userId])`. `Cart`식 `@unique` XOR이 **아니다** — 회원당 주문은 여럿이다.
3. **범위 경계** = 주문 **생성**만. 회원 주문 조회·자기 조회 이력은 제외이며 SPEC-ORDER-003은 무변경.

따라서 Socratic 라운드 없이 진행했고, 미해소 명료화 마커는 plan.md·research.md 어디에도 남기지 않았다 — 세 결정이 전부 확정되어 표시할 미결 항목 자체가 없다.

### 정찰 재검증 — 브리프 대비 정정 3건

위임 브리프의 정찰 내용을 실제 파일과 대조했다(브리프 자체가 "starting point not gospel"로 지시). 세 건이 사실과 달랐고 전부 spec.md §1.4 / research.md §5에 근거와 함께 기록했다.

- **정정 1**: `resolveCartIdentity()`의 Bearer 분기는 죽은 코드가 **되지 않는다**. 호출자 5곳 중 4곳이 SPEC-CART-001 장바구니 라우트이며 이 SPEC은 주문 라우트 1곳만 떼어 낸다. → 결정: **유지**(REQ-ORDER-054), 근거는 살아 있는 소비자 4곳.
- **정정 2**: 재작성 대상은 2파일 6건이 아니라 **3파일 7건**. `tests/unit/orders/scope-boundaries.test.ts:237`이 살아 있는 `prisma/schema.prisma`를 읽어 `User`에 `orders Order` 패턴이 없음을 단언하며, Prisma 관계 규칙상 확실히 깨진다.
- **정정 3**: API만 고치면 UI로 도달 불가능하고, SPEC-ORDER-001 §3이 이름 붙인 결함("회원 주문이 조용히 만들어졌다가 정작 그 회원이 열어볼 수 없는 상태", `spec.md:129`)을 **재현한다**. `/checkout`과 `/checkout/complete/[orderId]` 둘 다 게스트 쿠키만 읽는데 로그인 시 그 쿠키는 무조건 만료된다. → 두 화면과 안내 문구를 범위에 포함.

### 검증한 인용

전부 실제 파일을 열어 대조했다: `SPEC-ORDER-001/spec.md:112-129`(회원 체크아웃 제외 절과 인계 항목), `SPEC-AUTH-003/spec.md` §1.2(읽기/쓰기 분할 표), `SPEC-REVIEW-001/spec.md:48-50`(구매 인증 제외), `SPEC-STOREFRONT-002/spec.md:135`(백로그 `t23`), `SPEC-ORDER-003/spec.md:111-114`(회원 신원 조회 제외), `20260831120000_add_order_models/migration.sql:14-20`(DROP NOT NULL 사전 승인), `cart-repository.ts:51-53`(동결 불변식 2함수 목록), `csrf.ts:96-98` / `cookies.ts:42-44`(쿠키 속성).

SPEC ID 사전 검사: `[[ "SPEC-ORDER-004" =~ ^SPEC(-[A-Z][A-Z0-9]*)+-[0-9]{3}$ ]]` → `PASS`. `.moai/specs/` 22개 디렉터리 대조 결과 충돌 없음(ORDER-001/002/003 전부 `completed`).

### 산출물

Tier L 5종 전부 작성 완료: `spec.md`, `plan.md`, `acceptance.md`, `design.md`, `research.md`. REQ-ORDER-046 ~ 065(20개, 상한 25), AC-ORDER-050 ~ 073(24개, 상한 25). 번호는 기존 최대치(REQ-ORDER-045 / AC-ORDER-049) 다음부터 이어 붙였다.

### 테스트 기준선 (회귀 대조용)

```
$ npx vitest run --reporter=dot
 Test Files  116 passed (116)
      Tests  1526 passed (1526)
```

커밋 `6c8b00b`, 브랜치 `WT-member-checkout`, 2026-09-05 측정. AC-ORDER-072의 대조 기준이다.

### 다음 단계

plan-auditor 독립 감사(Tier L 임계값 0.85). 통과 후 Implementation Kickoff Approval.

## §E.2 Run-phase Evidence

_<pending run-phase>_

## §F Phase 4 Mode Selection

**Input parameters**: tier=L; scope≈15+ files (schema.prisma, 1 migration, order-repository.ts, order-service.ts, cart-service.ts, orders/route.ts, guest-identity.ts, 2 checkout screens, 7 rewritten test files, plus SPEC artifacts); domain count=5 (DB/migration, identity+CSRF security, service/repository layer, frontend screens, test suite); file language mix=TypeScript + Prisma schema/SQL; concurrency benefit=LOW (coding-heavy, ordered milestones with real inter-milestone dependencies — M1 schema must land before M3/M4 consume it).

**Mode evaluation**:
- `direct` — not selected (far beyond typo/single-line scope).
- `fanout` — not selected (coding-heavy per Anthropic's coding-task parallelism caveat; milestones are sequentially dependent, not independently parallelizable).
- `sweep` — not selected (this is semantic/new-code work with 5 different transform rules across domains, not one uniform mechanical transformation).
- `serial` via `manager-lead` — **selected**. 7 milestones (M1-M7) ≥ 3, ~15+ files ≥ 10, and cross-domain fan-out (DB/security/service/frontend/tests) — meets the manager-lead entry predicate (orchestration-mode-selection.md §G.2). The lead session's own dispatch note flagged this explicitly ("Tier L이라 다마일스톤 조율이 필요하면 manager-lead 경유를 검토해주세요").

**Decision: serial (manager-lead coordination)**

**Justification**: SPEC-ORDER-004 is a 7-milestone Tier L SPEC with a hard sequential dependency chain (M1 schema → M2 identity/CSRF → M3 repository → M4 service → M5 screens → M6 test rewrites → M7 copy) and a security-critical CSRF-ordering decision (D1/D2 from the plan-audit) that benefits from milestone-boundary context folding rather than a single unbounded manager-develop run. Per Anthropic's coding-task parallelism caveat, the work itself stays `serial`-shaped (no independently parallelizable milestones); `manager-lead` is the correct coordination layer for that serial shape at this scope, not a parallel-fan-out mode.

## §E.3 Run-phase Audit-Ready Signal

_<pending run-phase>_

## §E.4 Sync-phase Audit-Ready Signal

_<pending sync-phase>_
