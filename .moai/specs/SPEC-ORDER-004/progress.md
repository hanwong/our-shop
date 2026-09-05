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

### M1 — 데이터 모델과 마이그레이션: IMPLEMENTED, STAGED, commit pending final fix (B-1/B-2 RESOLVED)

**UPDATE (post-blocker-report resolution, verified by manager-lead independently, not merely relayed)**:
- **B-1 RESOLVED** — the parent orchestrator applied `npx prisma migrate deploy` directly against the local demo Postgres (`our-shop-demo-pg`, `localhost:5433`). Independently re-verified: `npx prisma migrate status` → "11 migrations found ... Database schema is up to date!"; `npx vitest run tests/integration/orders/concurrency.postgres.test.ts` → 19/19 passing.
- **B-2 RESOLVED** — `manager-spec` amended `plan.md`/`research.md`/`acceptance.md` (commit `d16006d664fcdf987bc7982f8a5932b4bd51b85a`, pushed) to correct M6's scope from "3 files/7 items" to the true union "6 files/12 items": the original 2-file/6-item behavior set (`route.test.ts` 5 + `create-order.test.ts` 1) union the 4-file/6-item schema set this session found (`scope-boundaries.test.ts` 1 + `orders/schema.test.ts` 3 + `payments/guest-only-scope.test.ts` 1 + `payments/schema.test.ts` 1), with `scope-boundaries.test.ts:237` counted once. Independently re-verified by grep against the live files — matches exactly.
- Post-resolution full suite: `npx vitest run --reporter=dot` → **4 files failed, 6 tests failed, 1520/1526 passed** — exactly the schema-side half of the now-12-item M6 rewrite target (the behavior-side 6 items in `route.test.ts`/`create-order.test.ts` have not started failing yet, correctly, since M2 has not landed).
- **B-3 fixed**: `e2e/support/order-fixture.ts:65` — non-null assertion on `order.guestId!` (this fixture only ever creates guest orders, so `guestId` is always populated). Verified: `npx tsc --noEmit` → exit 0, `npx eslint .` → exit 0, `npx prisma validate` → exit 0.

**M1-finish worker hit a second, structural blocker**: the local pre-commit gate (`moai gate`) runs the FULL `npm test` suite with no baseline/known-fail exception mechanism (`.moai/config/sections/gate.yaml` has `skip_tests: false`, no baseline key). This means M1's commit cannot pass gate while the 6 schema-side M6 rewrite-targets stay red by design (M1's own DoD requires exactly this red state — those 6 assertions are supposed to fail until M6 rewrites them). Structural deadlock: M1 can't commit until M6 lands, M6 can't land until M2-M5 land, M2-M5 depend on M1 landing.

**Resolution decided by manager-lead (commit-sequencing decision, within delegation authority — no SPEC-body edit, no design judgment introduced)**: pull forward the SCHEMA-SIDE half of M6 (4 files / 6 items: `scope-boundaries.test.ts:237`, `orders/schema.test.ts` ×3, `payments/guest-only-scope.test.ts` ×1, `payments/schema.test.ts` ×1) into a commit that lands immediately after M1's own commit. This is NOT a scope change — `research.md §2.6-§2.8` (written by manager-spec's own amendment) already fully specifies the exact rewritten assertion for each of the 6 items, with zero remaining design judgment, and its own prose already flags these 4 files as "M2~M5를 기다릴 필요 없이 지금 이미 깨져 있다" (don't need to wait for M2-M5, already broken now) — i.e., their dependency is on M1 alone, not on the full M6 milestone boundary. The BEHAVIOR-side half of M6 (`route.test.ts` ×5, `create-order.test.ts` ×1) still depends on M2 landing and stays with M6 proper. Once the schema-side 6 are rewritten, the full suite returns to 1526/1526 passing (the behavior-side 6 still describe true pre-M2 behavior and won't flip until M2 lands), so the gate passes on its own merits — no `SKIP_MOAI_PRECOMMIT`, no gate.yaml edit, no bypass.

Two commits will land: (1) `feat(SPEC-ORDER-004): M1 ...` — schema, migration, fixture fix, spec.md frontmatter, progress.md; (2) a separate immediately-following commit rewriting the 4 schema-side test files, clearly labeled as pulled-forward mechanical M6 work, not folded into M1's own commit message.

### M1 — CLOSED. Commits `814b620` (M1 proper) + `6a31c6b` (pulled-forward M6 schema-side, 4 files/6 items), pushed to `WT-member-checkout`. Independently confirmed: `git log`, clean `git status`, `0 0` divergence vs origin.

**Peer cross-validation (independent read-only Agent, NOT the author) — verdict per AC**:

| AC | Verdict | Evidence |
|----|---------|----------|
| AC-ORDER-050 | PASS | schema text + live-DB `information_schema`/`pg_constraint` cross-check, both confirm `userId String?`, `user User? @relation(..., onDelete: Restrict)`, `@@index([userId])`, `User.orders Order[]`, no `@unique` on `userId` |
| AC-ORDER-051 | PASS | migration.sql contains the exact `DROP NOT NULL` string; schema + live DB both show `guestId` nullable |
| AC-ORDER-052 | PARTIAL (correct, expected) | schema half done (both nullable); write-path discriminated-union enforcement correctly deferred to M3/M4 — `order-repository.ts` confirmed unchanged this milestone |
| AC-ORDER-053 | PASS | migration.sql non-destructive (0 DROP/DELETE/TRUNCATE/UPDATE statements — the one substring hit is a FK `ON DELETE RESTRICT` referential-action clause, not DML); header comment names SPEC ID + rollback data-loss point |
| AC-ORDER-072 (interim) | PASS | `npx vitest run` → 116/116 files, 1526/1526 tests, ALL passing (not just non-regressed); `npx prisma migrate status` confirms the migration applied and not rolled back |

**5 non-blocking flags from the peer reviewer (recorded for later milestones, none block M1 close)**:
1. A naive grep-based AC-ORDER-053 auto-checker would false-positive on `ON DELETE RESTRICT ON UPDATE CASCADE` (an FK referential-action clause, not DML) — any future mechanical AC-053 checker (M6/sync) should exclude comment lines and referential-action clauses, not do a bare substring match.
2. No regression test guards `Order.user`'s `onDelete: Restrict` — the schema and live DB are correct now, but nothing in the suite would catch an accidental future change to `Cascade`. Candidate for M6 test-coverage consideration, not required by any stated AC.
3. No mechanical test verifies migration.sql content (relies on human/agent reading) — this is acceptance.md §I's own acknowledged "one gate without mechanical verification" (B4), not a new gap.
4. `e2e/support/order-fixture.ts`'s `order.guestId!` non-null assertion is sound today (guest-only fixture) but is a comment-enforced invariant, not type-enforced — would silently break if the fixture is ever extended to member orders.
5. `spec.md`'s `updated:` field was left unchanged in `814b620` (only `status:` was bumped) — happens to still read correctly since today is 2026-09-05, but flagging the pattern so it doesn't drift on a later commit.

**Context-folding note**: `/compact` is unavailable in this subagent (spawned-agent) context — per `runtime-recovery-doctrine.md`'s built-in exception, noting this rather than blocking; evidence persistence (`.moai/state/verify/order004-m1/`) and this fold row substitute for the compact step. Proceeding to M2.

## §E.2 addendum — M2 blocked, then resolved via M2+M3+M4 merge decision

**M2 worker correctly caught a planning inconsistency in manager-lead's own delegation.** M2's brief said route.ts must call `createOrder(owner, body)` (the new `OrderOwner` discriminated union) while ALSO forbidding any change to `order-service.ts`/`order-repository.ts` this milestone. `order-service.ts:446`'s actual exported signature is `createOrder(guestId: string, body: unknown)` — a plain string, not `OrderOwner`. The worker implemented route.ts + order.ts types exactly as specified, hit the resulting `tsc` error, did NOT expand scope on its own authority, did NOT bypass the gate, and returned a well-evidenced blocker with 3 options (A: merge M2+M3+M4; B: reorder M3→M4→M2; C: rejected, gate bypass forbidden) and its own recommendation (B).

**manager-lead traced the dependency chain further before deciding** (verification, not blind acceptance of the worker's recommendation): `order-repository.ts`'s `CreateOrderRow.guestId: string → owner: OrderOwner` change (M3, per design.md §6.2) breaks `order-service.ts`'s existing call site — M3 alone will not compile. And `order-service.ts`'s top-level signature change to accept `owner: OrderOwner` (M4, per design.md §6.3) breaks `route.ts`'s existing call site — M3+M4 alone, with route.ts unchanged, ALSO will not compile. **M2, M3, and M4 are one atomic TypeScript compile-unit** — there is no ordering of the three that keeps every intermediate commit independently green without inventing a throwaway compatibility shim (rejected: adds complexity the SPEC never scoped, against the Enforce Simplicity ladder). The worker's Option B would hit the identical wall one level higher up the call chain.

**Decision: Option A — merge M2+M3+M4 into one implementation cycle**, landing as clearly-labeled separate commits within that cycle (not one undifferentiated commit) so the history stays reviewable: one commit for the combined production code (route.ts + order.ts types [already drafted by the M2 worker, carried forward verbatim] + order-repository.ts + cart-repository.ts + order-service.ts), a second commit for the pulled-forward M6 behavior-side test rewrites (route.test.ts + create-order.test.ts — these literally cannot go green without M3/M4 existing, confirming the worker's own diagnosis that Task 3 was blocked on code, not on judgment). This is a commit-sequencing/milestone-boundary decision within manager-lead's coordination authority — plan.md's per-milestone WHAT/WHY content is unchanged; only the git-landing grouping is corrected to match the code's actual dependency graph (which the original M1-through-M7 prose sequence undercounted at the compile-atomicity level, though it already flagged M2→M3→M4 as tightly sequential).

The B3 risk the worker flagged (M4 must preserve `scope-boundaries.test.ts`'s six PRESERVE-listed regex assertions: `:113,:122,:123,:127,:128,:134`) is unchanged by this merge — it was always going to require careful authorship (explicit `if` branches, literal `findCartByGuestId(guestId, tx)` string form, `throw new OrderAbort` not `return`) regardless of which commit boundary the work landed in.

### M2+M3+M4 — CLOSED. Commits `7a89629` (production) + `28ce187` (M6 behavior-side, 2 files/6 items). Independently confirmed: `git log`, clean status, `0 0` divergence, `npx vitest run` → 116/1553 all passing.

**Peer cross-validation (independent read-only Agent) — all 12 assigned ACs PASS**: AC-ORDER-054, 055, 056, 057, 058, 059, 060, 061, 062a/b, 063, 069, 070. Security axis (cross-owner idempotency isolation, CSRF-before-transaction, no-disclosure response shape) verified as CLOSED BY THE TYPE SYSTEM — the discriminated union makes the `null === null` idempotency collision structurally unrepresentable, not merely avoided by convention. `throw new OrderAbort` confirmed (no `return`-shaped rejection in the transaction callback); the six PRESERVE-listed `scope-boundaries.test.ts` regex assertions pass unmodified; `git diff --stat` on the PRESERVE paths (`src/lib/auth`, `src/middleware.ts`, `src/app/api/cart`, `src/features/cart/services`) confirmed 0 lines since before M1.

**The flagged `cart-repository-tx.test.ts` premise reversal — independently judged sound by the peer reviewer**, on 5 grounds: the reversal is SPEC-mandated (AC-ORDER-060 requires it, written before this code existed), the original assertion's own comment conditioned itself on "a function this SPEC never calls" (no longer true), the widening is mechanically capped to exactly one function (8 others still explicitly denied), the underlying invariant survives (optional-trailing-parameter shape, `cart-service.ts` still 0 lines changed), and 3 new positive tests were added alongside the one reversed assertion (not a bare flip).

**Documentation drift — CONFIRMED REAL, larger than initially estimated, needs `manager-spec` correction before sync**:
- `research.md:78/290` still say "6 files / 12 items" and assert nothing outside those 6 files is touched — the second claim is now **literally false**. Actual footprint is **10 files** (the 6 already documented + `order-service.test.ts`, `order-repository.test.ts`, `concurrency.postgres.test.ts`, `cart-repository-tx.test.ts` — all mechanical call-site adaptations of the mandated signature change, one of which is the judged-sound premise reversal above).
- `acceptance.md:223`'s file enumeration covers only 60% of the actual footprint (6 of 10 files named).
- `acceptance.md:223`'s "no `it` block deleted" clause is **literally false in wording** — 6 `it` blocks were deleted (5 in `route.test.ts`, 1 in `create-order.test.ts`), each replaced by a new block verifying the new behavior, net test count +27 (not negative). The underlying INTENT (no coverage lost) is satisfied; the literal wording is not.
- This is a recurrence of the SAME class of finding as B-2 in the M1 cycle (SPEC-documented test-rewrite scope undercounting reality) — second occurrence. Not committed to spec body by this session (outside manager-lead's authority per the ownership matrix); recorded here for the parent orchestrator to route to `manager-spec` before sync-phase closes. Non-blocking for M5/M6/M7 — the code and tests are independently verified correct; only the SPEC's own bookkeeping is stale.

**2 non-blocking quality notes from the peer reviewer** (neither changes any AC verdict): (1) `order-service.test.ts:400/410`'s cross-owner assertion has a short-circuit pattern (`result.ok === true && result.data.orderNumber !== "..."`) that passes trivially when `result.ok` is `false` — the real AC-063 evidence is the integration test (`create-order.test.ts:966/981`), so the verdict is unaffected, but this specific unit assertion is weaker than it reads; candidate for tightening whenever this file is next touched. (2) `cart-repository-tx.test.ts`'s describe-block label ("the exception does not widen") is now stale (3 exceptions exist, not 2) — cosmetic.

Proceeding to M5 (screens).

### M5 — CLOSED. Commit `b101823`, pushed. Independently confirmed: `git log`, clean status, `0 0` divergence, `npx vitest run` → 116/1572 all passing (+19 from 1553, 0 regressions, 15 `it` blocks added / 0 deleted).

**Peer cross-validation — all 4 assigned ACs PASS**: AC-ORDER-064, 065, 066, 067. AC-065 verified with unusually strong evidence — an actual spy asserting the guest-cookie getter (`jar.get("guest_cart_id")`) is never invoked in the member branch (not just "the right cart rendered"), corroborated by reading `session-resolver.ts` source directly (single `refresh_token` read only). AC-066/067's ownership check verified at the repository `where`-clause level (`findFirst({ where: { id: orderId, userId } })`), not app-level fetch-then-filter — structurally cannot leak another owner's order. No member→guest fallback exists (confirmed both structurally and by an explicit test). No `Authorization`/Bearer header read anywhere in either screen file. PRESERVE (`middleware.ts`, `src/lib/auth`, `cart-service.ts`) confirmed 0 lines changed; `/checkout*` confirmed NOT a protected route.

**Urgent, expected, self-resolving finding**: the peer reviewer confirmed `CheckoutUnavailable.tsx:35`'s copy is now literally false — it still claims "member checkout is not yet supported," which M5 just made untrue (an empty-cart member will see this exact false copy). This is precisely M7's job (plan.md M7 DoD: no such sentence anywhere in the component) and is being closed immediately next, not deferred. One collision to hand to the M7 worker: `checkout-page.test.tsx`'s existing `"says member checkout is out of scope"` test actively requires the old copy via regex match — M7 must update this test too, or it will pin the exact defect M7 exists to remove.

**Documentation-drift running total** (unresolved, non-blocking, for `manager-spec` before sync): M5 added one more mechanically-required adjacent test file (`checkout-complete-page-payment.test.tsx`, needed a `getOrderForUser` mock stub) not enumerated in any SPEC artifact. Running total now 11 files touched in test-rewrite/adjacent-fixup work vs. the SPEC's documented 6.

Proceeding to M7 (copy fix — the final milestone; M6 was completed as a byproduct of M1 and M2+M3+M4's cycles).

### M7 — CLOSED. Commit `548e861`, pushed. `CheckoutUnavailable.tsx`'s now-false scope-notice paragraph removed (not rephrased); "게스트" qualifier dropped from the surviving true-for-both-audiences sentence. The pre-existing `checkout-page.test.tsx` test that pinned the old false copy was rewritten (not left to fight the fix) to assert the copy's absence + the new sentence's presence. `npx vitest run` → 116/1572, 0 regressions. `tsc`/`eslint` clean.

## SPEC-ORDER-004 — RUN-PHASE COMPLETE (all 7 milestones landed; final independent peer sign-off obtained)

**Final AC matrix — all 24/24 PASS** (M1: 050/051/052-full/053; M2-4: 054-063/069/070; M5: 064-067; M6: absorbed, no standalone ACs; M7: 068; SPEC-wide: 071/072/073). Every AC independently peer-verified across 4 cross-validation cycles (M1, M2+M3+M4, M5, and this final sweep for 068/071/072/073 plus a full DoD re-walk).

**Final gate state**: `npx vitest run` → 116 files / 1572 tests, 0 failures (baseline 1526, +46). `npx tsc --noEmit` / `npx eslint .` / `npx prisma validate` all clean. Coverage (measured for the first time this cycle) → 96.98% stmts / 93.63% branch / 98.69% funcs / 96.98% lines, clearing the 85/80/85/85 thresholds by 11-18 points. PRESERVE set (all 8 plan.md §D paths) confirmed 0 lines changed across the ENTIRE SPEC (`4613f6a..HEAD`), not just per-milestone. Full DoD checklist (acceptance.md §I + every per-milestone DoD in plan.md §F) walked item-by-item — all PASS.

**Commit accounting**: 7 commits in `4613f6a..HEAD` (the manager-spec `d16006d` correction + 6 run-phase commits: `814b620`, `6a31c6b`, `7a89629`, `28ce187`, `b101823`, `548e861`). 9 commits ahead of `main`; confirmed NOT merged to `main` by any route (`git merge-base --is-ancestor` = false, `main..HEAD` empty in reverse). Pushed to `origin/WT-member-checkout` only, `0 0` divergence — awaiting the parent orchestrator's own merge/PR routing, per this session's original instructions.

**4 residual gaps, all non-blocking for merge, surfaced by the final peer reviewer**:
- **G1** — `acceptance.md:223`'s "삭제된 `it` 블록이 없다" is literally false (10 `it` blocks deleted, each replaced; net +11 in the affected files, +46 suite-wide — the AC's *intent* holds with margin, its *wording* does not). Needs a `manager-spec` wording correction.
- **G2** — the declared M6 footprint (6 files) vs. actual (14 test/fixture files touched across the SPEC) — every one individually documented somewhere in this file, but `research.md:78/290`'s "nothing outside 6 files" claim is now false in the SPEC body. This is the THIRD occurrence of the same undercounting class (B-2 at M1, the M2-4 under-count, now this) — the peer reviewer explicitly recommends a root-cause look at *why* this keeps recurring, not just a third patch. Needs `manager-spec` before sync.
- **G3** — the `cart-repository-tx.test.ts` premise reversal (flagged at the M2-4 cycle) re-confirmed sound by this independent final reviewer on the same 5 grounds. No action needed; recorded as verified twice now.
- **G4** — this file itself was sitting uncommitted at the time of the final peer review. Resolved by this commit.

**Reconciliation needed before sync-phase closes** (routed to the parent orchestrator, not actioned by this session — outside manager-lead's SPEC-body-edit authority): `manager-spec` should (a) correct `acceptance.md:223`'s wording per G1, (b) correct `research.md §2` / `plan.md` M6's file-count claims to the true footprint per G2 and consider why 3 undercounts happened, (c) no action needed for G3. None of this blocks the code from merging — the code and tests are independently verified correct; only the SPEC's own bookkeeping needs a pass.

manager-lead dispatched a leaf worker for M1 (schema + migration). Implementation is complete and internally verified (AC-ORDER-050/051/053 PASS with evidence — see below), but the local pre-commit quality gate (`moai gate`, invoked by `.git/hooks/pre-commit`) blocks the commit on 18 test failures. HEAD is unchanged at `4613f6a440ddb6aa7aa2c658981cbbb4591869eb`. Staged (uncommitted):

```
M  .moai/specs/SPEC-ORDER-004/spec.md   (frontmatter status draft→in-progress, not yet landed)
A  prisma/migrations/20260905140254_add_order_user_ownership/migration.sql
M  prisma/schema.prisma
```

**AC evidence (verified, not blocking)**:
- AC-ORDER-050 (userId column/relation/index, no @unique): PASS — schema.prisma shows `userId String?`, `user User? @relation(..., onDelete: Restrict)`, `@@index([userId])`, `User.orders Order[]`; confirmed no `@unique` on Order.userId.
- AC-ORDER-051 (guestId nullable): PASS — schema `guestId String?`; migration has `ALTER TABLE "Order" ALTER COLUMN "guestId" DROP NOT NULL;`.
- AC-ORDER-053 (non-destructive migration): PASS — migration.sql contains only ALTER/ADD COLUMN/CREATE INDEX/ADD CONSTRAINT; zero DROP/DELETE/TRUNCATE/UPDATE; header comment states SPEC ID + rollback data-loss point.
- B4 manual migration.sql ↔ schema.prisma comparison: DONE, full field-by-field table recorded in the leaf worker's report (16 rows, all match).
- `npx prisma validate`: PASS. `npx eslint .`: PASS (clean).

**Two blockers surfaced, both outside this orchestrator's (manager-lead's) delegation authority — escalated to the parent orchestrator via blocker report (this session did NOT resolve them unilaterally):**

- **B-1 (premise-falsifying, critical)**: `design.md` §2.3 / `research.md` §1.1-1.3 state "no reachable database exists in this sandbox or CI." A live PostgreSQL demo container (`our-shop-demo-pg`, `localhost:5433`, up 7 days, `.env`-configured, deliberately ephemeral/disposable per `tests/integration/orders/concurrency.postgres.test.ts`'s own header comment) IS reachable in THIS sandbox. This falsifies a premise that survived 3 rounds of plan-audit. 12 of 18 test failures are `tests/integration/orders/concurrency.postgres.test.ts` failing because the new migration has not been applied to this live DB (`npx prisma migrate status` confirms 11/12 migrations applied, this SPEC's migration pending). Independently re-verified by manager-lead: `.env` confirms the connection string, `docker ps` confirms the container, the test file's own header confirms it is SPEC-ORDER-002's intentional, disposable, idempotent local dev DB — not an accident. Applying `prisma migrate deploy` (non-destructive, unlike `migrate dev`) would resolve these 12 failures, but mutates a resource shared across ALL worktree sessions on this machine — a decision this session (manager-lead) is not authorized to make unilaterally. `mcp__moai__session_list` shows 0 concurrent sessions scoped to SPEC-ORDER-004 and 1 unrelated global session (this task's own parent), so no active race was detected, but the resource is shared infrastructure regardless.
- **B-2 (SPEC-body scope gap, major)**: `research.md` §2 / `plan.md` M6 enumerate the test-rewrite scope as "3 files, 7 assertions." The actual repo-wide count (independently re-verified by manager-lead via `grep -rln "schema.prisma" tests/` + re-running all 9 matching files) is **6 assertions across 4 files**: `tests/unit/orders/schema.test.ts` (3), `tests/unit/orders/scope-boundaries.test.ts:237` (1, the one the SPEC did predict), `tests/unit/payments/guest-only-scope.test.ts` (1), `tests/unit/payments/schema.test.ts` (1). The last two are owned by SPEC-PAYMENT-001, not SPEC-ORDER-004 — a cross-SPEC scope question the SPEC body never addresses. The remaining 5 schema.prisma-reading test files (catalog ×2, admin, cart, db) are confirmed unaffected (98 tests, all pass). Widening M6's declared scope requires a `plan.md`/`research.md`/`acceptance.md` body edit, which is `manager-spec`'s exclusive ownership — outside manager-lead's and any leaf worker's authority.
- **B-3 (minor, NOT blocking, deferred)**: `npx tsc --noEmit` fails on one pre-existing line in `e2e/support/order-fixture.ts:65` (`order.guestId` now typed `string | null` after REQ-ORDER-047, assigned to a `string`-typed field) — a mechanical, one-line consequence of an already-approved requirement, outside M1's declared file scope. Verified genuinely NEW via baseline restore + re-check (clean before, this one error after). Will be folded into the next dispatch once B-1/B-2 are resolved — does not itself need escalation.

Evidence persisted at `.moai/state/verify/order004-m1/` (gitignored, cited paths confirmed to resolve): `baseline-vitest.txt`, `after-vitest.txt`, `failures-by-file.txt`, `eslint.txt`, `migration-ts.txt`, `schema.old.prisma`, `schema.new.prisma`.

**Gaps**: migration SQL never executed against a server (B-1 unresolved — the 12-failure attribution to "migration not yet applied" is a well-evidenced inference, not a proven fact, until the migration is actually applied or the decision is made not to). Coverage not measured this milestone (not required until sync).

### M2+M3+M4 — identity/CSRF + repository + service: IMPLEMENTED, all gates green

Landed as the merged cycle §E.2 addendum decided. Baseline at entry (HEAD `6a31c6b` + the prior M2 worker's uncommitted route.ts/order.ts): **2 files / 30 tests failing** — the expected consequence of route.ts already calling `createOrder(owner, …)` against a service still typed `createOrder(guestId: string, …)`.

**Final state**: `npx vitest run --reporter=dot` → **116 files / 1553 tests, 0 failing**. `npx tsc --noEmit` → exit 0. `npx eslint .` → exit 0. `npx prisma validate` → exit 0. Evidence: `.moai/state/verify/order004-m234/`.

Test count moved 1526 → 1553 (+27, all additions; no `it` block deleted), satisfying AC-ORDER-072's "≥ 1526".

**M2 (carried forward + verified against design.md §3)**: the prior worker's route.ts and order.ts were re-read line by line and match §3.4's non-reorderable sequence (session → member-CSRF → body → transaction), §3.2.1's inlined guest branch, and §3.3's guest-path CSRF exemption. Only the `createOrder(owner, body)` call site needed the M4 signature to exist. No corrections were required.

**M3**: `CreateOrderRow.guestId: string` → `owner: OrderOwner`; `createOrderWithItems` spreads the union into exactly one column (the other is omitted, not written `null`); `findOrderForUser` added with ownership in the `where`; `findCartByUserId` gained the optional trailing client, and `cart-repository.ts:51-53`'s frozen-invariant comment now names three functions. `cart-service.ts` is unchanged (0 lines).

**M4**: `createOrder(owner: OrderOwner, …)`; explicit two-branch cart dispatch inside the transaction preserving the literal `findCartByGuestId(guestId, tx)` text; `isSameOwner()` replacing the `guestId`-only comparison at BOTH idempotency sites; `getOrderForUser()` mirroring `getOrderForGuest()`.

**The six PRESERVE-listed `scope-boundaries.test.ts` assertions (`:113`,`:122`,`:123`,`:127`,`:128`,`:134`) all still pass, unmodified** — verified before, during and after (15/15 in that file). The file was not touched.

#### Scope finding — M6 was under-counted a second time (6 files/12 items → 10 files/16 items)

`research.md` §2's union was itself incomplete. The M2+M3+M4 signature changes mechanically break **four more test files** the SPEC never enumerated. All four are pure call-site adaptations of a mandated change — no design judgment — and are the same class as §2.7/§2.8's PAYMENT-001 files, which the SPEC admitted into M6 scope on exactly this reasoning ("이 SPEC의 변경이 기계적으로 깨뜨리는 결과이므로 M6 범위에 포함한다"). They were therefore fixed rather than escalated, but the count is recorded so the SPEC body can be reconciled at sync:

1. `tests/unit/orders/order-service.test.ts` — 57 type errors (`createOrder("G1", …)`), plus `:273` "attributes the order to the guest and to no one else", which asserted `row.guestId` on the service→repository boundary. Rewritten to assert the owner union; the property is unchanged, only where it is expressed.
2. `tests/unit/orders/order-repository.test.ts` — 3 type errors (the `CreateOrderRow` fixture).
3. `tests/integration/orders/concurrency.postgres.test.ts` — 6 type errors (three guest-vs-guest race scenarios).
4. `tests/unit/cart/cart-repository-tx.test.ts` — **not a type error, a runtime assertion**: `:117` asserted `findCartByUserId` does NOT take a client ("the member path is out of scope"). That is SPEC-ORDER-001's scope guard, and this SPEC's design.md §6.1 deliberately reverses its premise. Rewritten to assert the three-function list plus the optional-trailing-parameter shape — the suite's actual property is "the exception does not widen SILENTLY", not "the list is frozen at two".

Item 4 is the one worth a second look at sync: it is the only case where a passing SPEC-ORDER-001 guard was inverted rather than extended.

#### AC coverage added beyond the mechanical fixes

AC-ORDER-052/061 (repository-level XOR, both directions), AC-ORDER-060 (member cart read+delete on the tx client), AC-ORDER-062a/b and AC-ORDER-063 (both cross-owner directions, at unit AND integration level, including the anonymous-500 shape), AC-ORDER-069/070 (CSRF gating, and the guest exemption).

**Gaps**: M5 (the two checkout screens) and M7 (the copy) are untouched — still open, as planned. AC-ORDER-064~068 are therefore unverified. Coverage was not measured this cycle (not required until sync). The Postgres concurrency suite's 6 rewritten call sites were type-checked but the suite itself skips without a reachable database in this run.

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
