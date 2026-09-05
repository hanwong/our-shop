---
id: SPEC-AUTH-003
status: completed
updated: 2026-09-05
tier: M
---

# Progress: SPEC-AUTH-003 — 서버 렌더링 로그인 상태 확인 방식의 정본화 및 공유 사이트 헤더

## §E.0 Phase 1 (Explore 정찰) SKIP Rationale

**plan-phase의 별도 Explore 정찰을 실행하지 않았다 — 이미 실행되었기 때문이다.**

착수 직전 동일 세션에서 오케스트레이터가 `Explore`(읽기 전용) 정찰을 1회 완료했고, 그 결과가 위임 프롬프트에 요약되어 전달되었다. 정찰이 확립한 사실은 다음과 같다.

1. 원 카드의 전제("SSR 로그인 확인이 SPEC-AUTH-001의 메모리 전용 토큰과 구조적으로 충돌한다")가 **사실이 아니다** — 읽기 측은 이미 해결되어 프로덕션에서 동작 중이다.
2. `resolveSession()`(`src/lib/auth/session-resolver.ts`)이 httpOnly `refresh_token` 쿠키를 서버에서 해석하는 읽기 전용 함수로 존재한다.
3. 그 함수의 프로덕션 호출자가 2곳 있다 — `src/app/products/[productId]/page.tsx:49`(페이지 레벨 표시 게이트)와 `src/app/api/reviews/route.ts:29`(API 라우트 인증 게이트). 둘 다 SPEC-REVIEW-001 소유이며 **레이아웃 레벨 소비자는 없다**.
4. 이 저장소에 공유 사이트 헤더가 **하나도 없다** — `src/app/layout.tsx`가 SPEC-STOREFRONT-001 §3의 명시적 이연 결정에 따라 최소 셸로만 유지되고 있다.
5. 쓰기 측 회원 체크아웃 충돌(`Order`에 `userId` 부재, `POST /api/orders`의 회원 자격 증명 거부)은 **별개의 미해결 문제**이며 SPEC-ORDER-001 §3이 이미 소유자를 후속 SPEC으로 지정했다.

**다만 위임 요약을 그대로 받아쓰지 않았다.** plan-phase에서 위 5개 항목을 전부 소스 파일 직접 읽기로 재검증했다(아래 §E.1의 grounding 검증 참고). 중복 정찰을 생략한 것이지 검증을 생략한 것이 아니다.

또한 착수 전 사용자와의 Socratic AskUserQuestion 라운드로 범위가 확정된 상태로 위임되었다 — 헤더 내용을 로그인 상태 표시로 한정, 장바구니 아이콘·검색 제외, `resolveSession()` 재사용, `middleware.ts`·REQ-AUTH-009·`guest-identity.ts` 불가침, 쓰기 측 체크아웃 제외, SPEC-STOREFRONT-001 §3의 좁은 범위 개정. plan-phase 중 새로 발견된 미해결 모호성이 없어 clarification 마커를 하나도 남기지 않았다.

## §E.1 Plan-phase Audit-Ready Signal

plan_complete_at: 2026-09-05
plan_status: audit-ready

plan-phase 산출물 4종(`spec.md`, `plan.md`, `acceptance.md`, `spec-compact.md`) 작성 완료. Tier M.

**SPEC ID 검사** — 정규식 검사를 Bash로 실행해 관측했다.

```
$ ID="SPEC-AUTH-003"; [[ "$ID" =~ ^SPEC(-[A-Z][A-Z0-9]*)+-[0-9]{3}$ ]] && echo PASS || echo FAIL
PASS
```

**ID 유일성** — 디렉터리 부재와 기존 참조 0건을 생성 직전에 확인했다.

```
$ ls .moai/specs/ | grep -c "^SPEC-AUTH-003$"
0
$ grep -rl "SPEC-AUTH-003" .moai/specs/ | wc -l
0
```

**프론트매터** — 정본 12필드 전부 존재(`id`/`title`/`version`/`status`/`created`/`updated`/`author`/`priority`/`phase`/`module`/`lifecycle`/`tags`) + 선택 필드 `tier: M` · `depends_on: [SPEC-AUTH-002]` · `related_specs` 7건. `phase: "v0.2.0 target"`(AUTH-002 / ADMIN-001~003 / STOREFRONT-002~003과 동일한 미출시 릴리스 타깃 표기 — 워크플로 단계명이 아님), `status: draft`.

**REQ/AC 번호 이어받기** — `AUTH` 도메인의 기존 최대 번호를 직접 확인해 그 다음부터 시작했다.

```
$ grep -rhoE "REQ-AUTH-[0-9]+" .moai/specs/ | sort -u | tail -2
REQ-AUTH-036
REQ-AUTH-037
$ grep -rhoE "AC-AUTH-[0-9]+" .moai/specs/ | sort -u | tail -2
AC-AUTH-035
AC-AUTH-036
```

이 SPEC은 **REQ-AUTH-038 / AC-AUTH-037**부터 시작한다. 갭·중복 없음.

**REQ/AC 대응** — REQ 12건(REQ-AUTH-038~049) / AC 11건(AC-AUTH-037~047). Tier M 상한(REQ 16 / AC 16) 이내이며 각각 여유 4건 / 5건. `acceptance.md` §2의 추적 매트릭스에서 REQ 12건 전부가 최소 1개의 AC로 검증됨을 명시했고, 대응 REQ가 없는 고아 AC는 없다.

**Tier 판정: M.** 파일 7개 터치(신규 소스 2 + 신규 테스트 3 + 기존 수정 2) · LOC 추정 300~500 · REQ 12 / AC 11 — 세 축 모두 Tier M 가이드 이내다. 사용자가 `acceptance.md`를 별도 산출물로 명시 요구했다는 점(Tier S는 AC를 spec.md §3에 인라인)도 M 유지의 근거다. plan-auditor PASS 임계값 0.80.

**Conditional Design Route**: 적용됨(`plan → design → run`) — `acceptance.md`가 화면 컴포넌트를 명시적 산출물로 검증하므로 판정 기준의 첫 번째가 만족된다. SPEC-STOREFRONT-001/002/003 · SPEC-AUTH-002의 선례를 따른다. 이 plan-phase에서는 판정만 기록했고 design phase는 실행하지 않았다.

**Route (SPEC lifecycle)**: Tier M이므로 Route A(Hybrid Trunk main-direct) — PR 없이 커밋/푸시 이벤트로 phase가 전이된다.

**grounding 검증** — 위임 프롬프트가 제공한 사실을 그대로 받아쓰지 않고, 인용한 모든 파일·줄 번호를 직접 Read/Bash로 재확인한 뒤 산출물에 반영했다.

```
$ grep -n "export async function resolveSession" src/lib/auth/session-resolver.ts
54:export async function resolveSession(cookieStore: SessionCookieStore): Promise<Session | null> {
$ grep -rn "resolveSession(" src/
src/app/products/[productId]/page.tsx:49:    resolveSession(await cookies()),
src/app/api/reviews/route.ts:29:  const session = await resolveSession(jar);
src/lib/auth/session-resolver.ts:54:export async function resolveSession(...
$ grep -n "matcher" src/middleware.ts
    matcher: ["/admin/:path*"],
```

**호출자 열거 방법 정정 (plan-audit D1).** 최초 작성 시 이 검증은 `grep -n "resolveSession" src/app/products/[productId]/page.tsx`라는 **단일 파일 grep**이었고, 그것을 근거로 "호출자가 하나뿐"이라고 적었다. 단일 파일 grep은 그 파일에 호출이 있음을 보일 뿐 **저장소 전역에 다른 호출이 없음을 보일 수 없다** — 배타성 주장에 구조적으로 부적합한 도구였다. 실제로는 호출자가 2곳이었다(`api/reviews/route.ts:29` 누락). 위 명령을 저장소 전역 `grep -rn`으로 교체해 같은 오류가 조용히 재발하지 않게 했다. 이 정정은 사실만 바꾸며, §B.6의 결정(기존 호출 지점 독립 유지)은 영향을 받지 않는다 — 두 호출자 모두 페이지·라우트 레벨 도메인 게이트이고, 레이아웃 레벨 소비자는 여전히 없다.

Read로 직접 확인한 파일: `src/lib/auth/session-resolver.ts`, `src/middleware.ts`, `src/app/layout.tsx`, `src/app/products/[productId]/page.tsx`, `src/app/api/auth/logout/route.ts`, `src/lib/auth/csrf.ts`, `src/lib/auth/cookies.ts`, `src/app/page.tsx`, `.moai/specs/SPEC-STOREFRONT-001/spec.md` §3, `.moai/specs/SPEC-AUTH-002/spec.md` §3, `.moai/specs/SPEC-ORDER-001/spec.md` §3.

**위임 프롬프트 대비 정정 1건**: 위임문은 "로그아웃 엔드포인트가 이미 존재하는지 확인하고 재사용하라"고 했다. 확인 결과 `POST /api/auth/logout`은 존재하며, **DB 접근 이전에 `verifyCsrfRequest()`를 통과해야 한다**(REQ-AUTH-023, `src/app/api/auth/logout/route.ts`). 따라서 헤더의 로그아웃은 단순 `fetch` 한 줄이 아니라 `csrf_token` 쿠키를 읽어 `X-CSRF-Token` 헤더로 되돌려 보내는 클라이언트 컴포넌트가 필요하다 — 이 사실을 REQ-AUTH-044 / AC-AUTH-041과 plan.md §B.2/§B.3에 반영했다. 저장소에 동일 패턴 선례가 2건(`CancelOrderButton.tsx:29`, `ProductForm.tsx:38`) 존재함도 확인했으므로 새 백엔드 로직을 만들 필요는 없다(위임 제약 준수).

**컴포넌트 배치 관례 확인**: `src/components/` 아래는 `cart/` · `checkout/` · `orders/` · `product/` 4개로 전부 "도메인 이름 = 디렉터리 이름" 관례이며 `src/components/ui/` 같은 프리미티브 디렉터리는 없다. 신규 헤더는 관례를 따라 `src/components/layout/`에 둔다 — 위임문이 가정한 경로와 일치한다.

**의존 SPEC 상태 확인** — `depends_on` / `related_specs`에 인용한 SPEC들의 상태를 각 spec.md 프론트매터에서 직접 확인했다.

```
$ for s in AUTH-001 AUTH-002 REVIEW-001 STOREFRONT-001; do echo -n "$s: "; grep "^status:" .moai/specs/SPEC-$s/spec.md; done
AUTH-001: status: completed
AUTH-002: status: completed
REVIEW-001: status: completed
STOREFRONT-001: status: completed
```

**선행 결정 개정 기록**: 이 SPEC은 SPEC-STOREFRONT-001 §3(헤더 부재)과 SPEC-AUTH-002 §3(로그아웃 UI 부재 / 공통 헤더 부재)을 **좁게 개정**한다. 개정 범위와 유지 범위를 spec.md §1.4의 7행 표로 명시해, 내비게이션 범위 전체를 다시 여는 것으로 읽히지 않게 고정했다. 푸터·검색창·장바구니 배지·전역 내비는 선행 SPEC이 남긴 그대로 유지된다.

**미해결 명료화 항목**: 0건 — `plan.md` / `spec.md` / `acceptance.md` 전부에 clarification 마커가 없다.

## §E.1a Plan-Audit Result (iteration 1) — PASS, 동일자 5건 수정 반영

**Verdict: PASS** (score 0.85, Tier M 임계값 0.80 초과). 감사자: plan-auditor(독립 감사). 보고서: `.moai/reports/plan-audit/SPEC-AUTH-003-2026-09-05.md`.

PASS 판정과 별개로 **blocking 등급 결함 5건**이 지적되었고, 전부 같은 날 수정했다. 아래는 결함별 처분이며, 각 항목의 "검증" 열은 **실제로 재확인한 것만** 적었다.

| ID | 등급 | 결함 | 수정 | 검증 |
|---|---|---|---|---|
| D1 | major | `resolveSession()` 호출자가 "1곳"이라는 서술이 사실과 다름 — 실제 2곳 | spec.md §1.3(표로 재작성)·plan.md §A.1 증거3·plan.md §H·progress.md §E.0 4곳 정정 + 검증 명령을 단일 파일 grep → 저장소 전역 `grep -rn`으로 교체 | 저장소 전역 grep 재실행해 2곳 확인(아래 §E.1 grounding 블록) |
| D2 | major | AC-AUTH-040이 새 하네스 없이는 판정 불가 | plan.md §B.7 신설(패턴 A/B 분리 결정) + AC-AUTH-040 재작성 + M3에 구현 형태 명시 | `shell.test.tsx:33-40`와 `product-detail-page.test.tsx:130`을 직접 Read해 두 선례 존재 확인. **테스트를 작성해 실행한 것은 아니다**(run-phase 범위) |
| D3 | minor | AC-AUTH-044가 `<nav>` 태그를 전면 금지 — REQ-AUTH-046 범위보다 넓음 | AC-AUTH-044에서 `<nav>` 스캔 제거, 내비 **링크** 존재 여부 판정으로 축소 + 근거 주석 추가 | REQ-AUTH-046 본문과 대조해 범위 일치 확인 |
| D4 | minor | plan.md §E "파일 수 6개"가 본문 7개와 불일치 | "7개"로 정정 | plan.md 파일 목록·spec-compact.md 표와 대조해 7개 확인 |
| D9 | minor | AC-AUTH-047(b)의 회귀 baseline 숫자가 없음 | plan.md §C에 캡처 단계(§C-6) 추가 + **plan-phase에서 실제 실행해 baseline 확정** | `npx vitest run` 실행 → `Tests 19 passed (19)` / `Test Files 2 passed (2)` 관측 |

**D1의 근본 원인**과 그 처분은 §E.1의 grounding 블록에 별도로 기록했다 — 단일 파일 grep으로 저장소 전역 배타성을 주장한 것이 원인이며, 명령 자체를 교체해 재발을 막았다.

**재검증 범위.** 수정 후 실제로 재실행해 관측한 것:

```
$ moai spec lint .moai/specs/SPEC-AUTH-003/spec.md
✓ No findings — all SPEC documents are valid

$ moai spec lint            # 저장소 전역
✓ No findings — all SPEC documents are valid

$ grep -rc "NEEDS CLARIF" .moai/specs/SPEC-AUTH-003/
spec.md:0  plan.md:0  acceptance.md:0  progress.md:0  spec-compact.md:0
```

추가로 재확인한 것: REQ 12건 / AC 11건 개수 재계수(Tier M 상한 16 이내 유지), 추적 매트릭스 REQ 행 12개 일치, `### Out of Scope —` H3 10개, `IF/THEN` 레거시 0건, D9 baseline 테스트 19 passed 실측.

**lint 도구 사용에 관한 자기 정정.** 처음에는 `plan.md`를 lint에 직접 넘겨 `MissingExclusions` 경고 1건을 받고 이를 결함으로 오인했다. 확인해 보니 이 lint는 넘겨받은 파일을 **SPEC 문서(spec.md)로 간주**하므로 `plan.md`를 직접 넘기는 것은 도구 오용이다 — 기존 완료 SPEC들도 같은 방식으로 넘기면 더 많은 지적이 나온다(`SPEC-AUTH-002/plan.md` 경고 10건, `SPEC-REVIEW-001/plan.md` 오류 11건). 실제 게이트는 저장소 전역 실행이며 그 결과는 위와 같이 clean이다.

**미검증으로 남긴 것 (Gap).** D2에서 확정한 테스트 패턴은 **선례 파일 2개를 직접 Read해 존재를 확인한 데까지**이고, 실제로 테스트를 작성해 통과시킨 것은 아니다(run-phase 범위). 패턴 B가 `SiteHeader` 추가 후에도 `shell.test.tsx`의 기존 단정과 공존한다는 판단은 현재 `layout.tsx` 구조를 읽고 내린 추론이며, 실행으로 확인하지 않았다.

## §E.1b Plan-Audit Result (iteration 2) — PASS 0.93, 잔여 2건 정리

**Verdict: PASS** (score 0.93, iteration 1의 0.85에서 상승. Tier M 임계값 0.80 초과). iteration 1에서 수정한 5건이 전부 반영된 것으로 확인되었고, 잔여 지적 2건을 같은 날 정리했다.

| ID | 등급 | 결함 | 수정 | 검증 |
|---|---|---|---|---|
| D10 | blocking | `spec.md:47` §1.1 결론이 여전히 "흩어진 채 **한 곳에서만** 쓰이던 그 결정"이라고 서술 — D1으로 정정한 §1.3("둘")과 모순 | "리뷰 도메인 안에서만 쓰이던(§1.3의 호출자 2곳 — 페이지 레벨 표시 게이트와 API 라우트 인증 게이트) ... **최초의** 레이아웃 레벨 소비자"로 교체 | 수정 후 §1.1 결론과 §1.3 표를 나란히 읽어 호출자 수·성격 서술이 일치함을 확인 |
| D11 | optional | `acceptance.md`의 REQ-AUTH-046 매트릭스 셀이 "정적 스캔 0건" 단일 판정으로 남아, D3 수정 후 2부로 나뉜 AC-AUTH-044와 불일치 | 셀을 "(1) 소스 정적 스캔 0건 + (2) 렌더 출력의 내비 링크 0개"로 갱신 | AC-AUTH-044 본문과 매트릭스 셀을 대조해 2부 구성 일치 확인 |

**D10의 성격**: 사실 오류가 아니라 **iteration 1 수정의 파급 누락**이다. D1을 고칠 때 §1.3(주장 지점)과 plan.md·progress.md는 정정했으나, 같은 사실에 의존하는 §1.1의 결론 문장을 함께 훑지 않았다. 교훈: 사실 하나를 정정하면 그 사실을 **인용하는 곳**뿐 아니라 그 사실에 **기대어 결론을 내리는 곳**까지 검색 범위에 넣어야 한다.

**범위 준수**: 이 iteration은 위 2줄만 수정했고 다른 내용은 건드리지 않았다.

**관측했으나 수정하지 않은 항목 (Gap).** `spec.md:45`의 §1.1 증거 4번은 여전히 호출자를 `page.tsx:49` 하나만 예시로 든다. 다만 이 문장의 주장은 "실사용 호출자가 **이미 존재한다**"는 존재 증명이지 배타성 주장이 아니므로(§1.3이 전체 열거를 담당) 사실 오류가 아니며, 이번 지시가 2줄 범위로 한정되어 손대지 않았다. 후속에서 완결성을 높이려면 이 줄에 두 번째 호출자를 병기할 수 있다.

**run-phase 진입을 막는 항목은 이제 Implementation Kickoff Approval(사용자 승인) 하나뿐이다.**

## §E.2 Run-phase Evidence

### M1+M2 — 헤더 상태 표현 + 로그아웃 어포던스 (TDD, RED-GREEN)

**커밋 순서에 관한 의도적 이탈 (기록).** plan.md §F는 M1(SiteHeader)을 M2(LogoutButton)보다 먼저 배치했고, 위임 지시(B9)는 "M1 커밋 → M2 커밋" 순서의 별도 두 커밋을 요구했다. 그런데 M1 자신의 마일스톤 서술("로그인: '내 정보' 표시 + `<LogoutButton />`")이 이미 M2의 산출물을 참조하므로, `SiteHeader.tsx`는 `LogoutButton.tsx`에 대한 하드 임포트 의존성을 갖는다. M1을 문자 그대로 먼저 커밋하면 그 커밋 트리에서 `npx tsc --noEmit`이 모듈 미해결로 실패한다 — 저장소의 기존 선례(commit `2322409`, "M3 product detail review section + M4 ReviewForm island")는 동일한 부모→자식 마일스톤 결합을 **하나의 커밋으로 합쳐** 처리했으나, 위임 지시는 "두 커밋, 합치지 않음"을 명시적으로 요구했다.

**결정**: 합치지 않고, 대신 **빌드 의존성 순서로 커밋**했다 — `LogoutButton.tsx`(M2 파일)를 먼저 커밋하고 `SiteHeader.tsx`(M1 파일)를 다음에 커밋했다. 두 커밋 모두 각자 독립적으로 `tsc --noEmit` 통과 + 자신의 테스트 파일 GREEN 상태를 유지한다. `git log`는 최신 커밋을 위에 보여 주므로, 이 순서는 `git log --oneline` 출력에서 오히려 "M1 다음 M2"로 읽힌다(최신인 M1 커밋이 위에 표시됨). 이 저장소의 시스템 프롬프트(Status Responsibility Matrix)가 "M1 커밋에서" 상태 전이를 명시하므로, `status: draft → in-progress` 전이는 (시간순으로는 두 번째지만) **M1 레이블 커밋**에 실었다.

**M2 — LogoutButton.tsx (RED 먼저 커밋)**:
- 신규: `src/components/layout/LogoutButton.tsx`, `tests/unit/components/logout-button.test.tsx`.
- RED 증거(§E.8 참고): 파일 부재로 인한 모듈 해석 실패를 관측한 뒤 구현.
- GREEN: 4개 테스트 전부 통과(AC-AUTH-041, 042, 043a, 043b).

**M1 — SiteHeader.tsx**:
- 신규: `src/components/layout/SiteHeader.tsx`, `tests/unit/components/site-header.test.tsx`.
- RED 증거(§E.8 참고): 파일 부재로 인한 모듈 해석 실패를 관측한 뒤 구현.
- GREEN: 3개 테스트 전부 통과(AC-AUTH-037, 038, 039). AC-AUTH-038 검증 중 `LogoutButton`이 실제로 렌더되므로 `next/navigation`의 `useRouter`를 모킹해야 했다(product-detail-page.test.tsx가 `ReviewForm`에 대해 이미 쓰는 것과 동일한 이유).

### PASS/FAIL 매트릭스

| AC | Given-When-Then (요약) | 관측 결과 | 판정 |
|---|---|---|---|
| AC-AUTH-037 | `resolveSession()`→null 상태에서 렌더 시 접근 가능한 이름 "로그인" 링크가 정확히 1개, `href="/login"` | `site-header.test.tsx` "shows exactly one login link..." — 1개, href `/login` 확인 | PASS |
| AC-AUTH-038 | `resolveSession()`→`{userId,role:"customer"}`에서 렌더 시 "내 정보" + "로그아웃" 버튼 존재, "로그인" 링크 부재 | 동일 파일 "shows account status and a logout button..." — 3개 단정 전부 통과 | PASS |
| AC-AUTH-039 | 3가지 null 사유(쿠키 부재/폐기/만료) 각각에서 렌더 출력이 서로 동일 | 동일 파일 "renders identically for every null-session reason..." — `outputs[0]===outputs[1]===outputs[2]`, 게스트 상태 포함 확인 | PASS |
| AC-AUTH-041 | 클릭 시 `fetch`가 `/api/auth/logout`에 POST 1회, `X-CSRF-Token` 헤더 값이 쿠키 값과 일치 | `logout-button.test.tsx` "sends the csrf_token cookie value..." — 1회 호출, 헤더 일치 확인 | PASS |
| AC-AUTH-042 | 200 응답 시 `router.refresh()` 정확히 1회, `router.push` 미호출 | 동일 파일 "refreshes the screen exactly once..." — 확인 | PASS |
| AC-AUTH-043(a) | 403 응답 시 이동/갱신 없음, 버튼 문서에 유지 | 동일 파일 "(a) does not navigate and keeps the button on a 403..." — 확인 | PASS |
| AC-AUTH-043(b) | 500 응답 시 이동/갱신 없음, 버튼 문서에 유지 | 동일 파일 "(b) does not navigate and keeps the button on a 500..." — 확인 | PASS |
| AC-AUTH-046(M1+M2 범위) | 신규 소스 2종에 금지 패턴(`Authorization`/`Bearer`/`localStorage`/`sessionStorage`/`createContext`/`useContext`/`useAuth`) 매치 0건 | §E.2 static-scan 명령 — 0건 확인(아래 §E.2 static-scan 블록) | PASS |
| AC-AUTH-047(b)(M1+M2 범위 회귀 가드) | `product-detail-page.test.tsx`+`product-detail-view.test.tsx`가 baseline과 동일한 통과 개수로 통과 | 재실행 결과 `19 passed / 2 files` — plan.md §C-6 baseline과 정확히 일치 | PASS |

M3(레이아웃 배선, AC-AUTH-040), M4(정적 스캔 테스트 파일 M4, PRESERVE 회귀 테스트 파일 나열, AC-AUTH-044/045/047(a))는 이 위임의 범위 밖이며 다음 마일스톤에서 판정된다. 다만 PRESERVE 무변경(AC-AUTH-045/047(a)의 일부)은 M1+M2 산출물에도 이미 해당되므로 §E.4에서 재확인했다.

### M3 — 루트 레이아웃 배선 (TDD, RED-GREEN)

**워크트리 복구 (기록).** 이 위임은 새 세션이 `main`에서 갈라진 격리 워크트리로 시작되어(`d0b9a3e` 미포함), 위임 프롬프트 §A.0의 복구 절차에 따라 `m3m4-layout-boundary` 브랜치를 `d0b9a3e9491080627e445c5a36064ba98ad9d652`(M1+M2 머지 커밋)에서 새로 만들고, `npm install`로 격리 워크트리 전용 `node_modules`를 준비한 뒤 진행했다.

- `src/app/layout.tsx` 수정: `<body>` 안, `{children}` 위에 `<SiteHeader />` 삽입(REQ-AUTH-041). 기존 헤더 주석을 plan.md §B.8 표대로 갱신 — 헤더만 추가되고 나머지(푸터·검색·장바구니·내비)는 여전히 제외임을 명시.
- `tests/unit/app/shell.test.tsx` 수정: plan.md §B.7 **패턴 B**(마운트 없이 `RootLayout({ children: MARKER })` 반환 트리 검사)로 배치를 판정하는 `it` 1개 추가. `body.props.children`이 배열인지, `[0].type === SiteHeader`(동일 참조), `[1] === MARKER`를 단정. 기존 단정은 제거 없이 추가만 함.
- RED 증거(§E.8 참고): 레이아웃 배선 전 `Array.isArray(bodyChildren)` 단정이 `expected false to be true`로 실패함을 관측한 뒤 구현.
- GREEN: `shell.test.tsx` 5개 테스트(기존 4 + 신규 1) 전부 통과.
- 검증 대상 AC: AC-AUTH-040.

### M4 — 경계 회귀 가드 (기계적)

- `tests/unit/components/site-header-boundary-static.test.ts` 신규: (1) `SiteHeader.tsx`/`LogoutButton.tsx` 소스 텍스트에 `cart`/`장바구니`/`search`/`검색`/`<footer` 매치 0건 정적 스캔(대소문자 무시), (2) `SiteHeader`를 게스트/회원 각각 렌더해 `/cart`·`/products?...`·카테고리 경로로 향하는 링크 0개 확인(`<nav>` 태그 자체는 스캔 대상 아님 — plan-audit D3). 새 소스 파일 없음 — M1/M2 산출물이 이미 경계를 준수하므로 이 테스트는 첫 실행부터(파일이 존재하게 된 순간) 통과했다.
- RED 증거(§E.8 참고): 파일 생성 전 해당 경로로 vitest 실행 시 `No test files found, exiting with code 1` 관측.
- GREEN: 신규 파일 3개 테스트 전부 통과.
- PRESERVE 확인: `git diff --stat`을 `d0b9a3e9491080627e445c5a36064ba98ad9d652` 대비로 `src/middleware.ts`, `src/lib/auth/session-resolver.ts`, `src/lib/auth/csrf.ts`, `src/lib/auth/cookies.ts`, `src/app/api/auth/logout/route.ts`, `src/app/products/[productId]/page.tsx`, `src/components/product/ProductDetailView.tsx`, `src/app/staff/`, `prisma/schema.prisma`에 대해 실행 — 전부 빈 출력(무변경).
- 무회귀 확인: `tests/unit/middleware.test.ts`(4 tests) + `tests/unit/auth/session-resolver.test.ts`(7 tests) = 11 passed / 2 files.
- **AC-AUTH-047(b) 정확 일치 확인**: `npx vitest run tests/unit/app/product-detail-page.test.tsx tests/unit/components/product-detail-view.test.tsx` 재실행 결과 `Test Files  2 passed (2)` / `Tests  19 passed (19)` — plan.md §C-6 baseline과 정확히 일치(증가·감소 없음).
- `layout.tsx`에 `@MX:NOTE` 추가 — 기존 주석의 "전부 제외" 서술이 M3 이후 부분적으로만 참임을 소스에 고정(plan.md §B.8).
- 검증 대상 AC: AC-AUTH-045, AC-AUTH-046, AC-AUTH-047.

### PASS/FAIL 매트릭스 (M3+M4)

| AC | Given-When-Then (요약) | 관측 결과 | 판정 |
|---|---|---|---|
| AC-AUTH-040 | `RootLayout({children:MARKER})` 호출(마운트 없음) 시 `body.props.children`이 배열, `[0].type===SiteHeader`(동일 참조), `[1]===MARKER` | `shell.test.tsx` "places SiteHeader inside body, above children..." — 3개 단정 전부 통과 | PASS |
| AC-AUTH-044 | 신규 소스 2종 정적 스캔 0건 + 렌더 출력의 내비 링크 0개(게스트/회원 각각) | `site-header-boundary-static.test.ts` 3개 테스트 전부 통과 | PASS |
| AC-AUTH-045 | PRESERVE 목록(middleware/session-resolver/csrf/cookies/logout-route) `git diff --stat` 무변경 + `middleware.test.ts`/`session-resolver.test.ts` 무회귀 | 위 §E.2 M4 절 — 전부 빈 diff, 11 passed/2 files | PASS |
| AC-AUTH-046 | 신규 소스 2종에 `Authorization`/`Bearer`/`localStorage`/`sessionStorage`/`createContext`/`useContext`/`useAuth` 매치 0건 | M1+M2에서 이미 확인(§E.2 static-scan 블록); M4 정적 스캔이 cart/search/footer 축을 추가로 확인 — 교집합 없음, 둘 다 0건 | PASS |
| AC-AUTH-047(a) | `page.tsx`/`ProductDetailView.tsx` `git diff --stat` 무변경 | 위 §E.2 M4 절 — 빈 diff | PASS |
| AC-AUTH-047(b) | `product-detail-page.test.tsx`+`product-detail-view.test.tsx`가 baseline(19/2)과 정확히 동일한 통과 개수 | 재실행 결과 `19 passed (19)` / `2 passed (2)` — 일치 | PASS |

**11건 AC 전부(AC-AUTH-037~047, 서브케이스 포함) PASS — M1~M4 전체 완료.**

### 전체 스위트 회귀 (M3+M4 이후)

```
$ npm test
 Test Files  113 passed (113)
      Tests  1489 passed (1489)
```

baseline(M1+M2 완료 시점 112 files / 1485 tests) 대비 +1 file(M4 신규 테스트 파일) / +4 tests(M3 shell.test.tsx +1, M4 신규 파일 +3). 회귀 0건.

### 타입체크/린트 (M3+M4)

```
$ npx tsc --noEmit
(출력 없음, exit 0)

$ npm run lint
(출력 없음, exit 0 — eslint . 무경고/무오류)
```

### RED 증거 (M3+M4, §E.8)

```
$ npx vitest run tests/unit/app/shell.test.tsx
 ❯ ... places SiteHeader inside body, above children — AC-AUTH-040 (plan.md §B.7 pattern B)
   AssertionError: expected false to be true // Object.is equality
    ❯ tests/unit/app/shell.test.tsx:76:41
        expect(Array.isArray(bodyChildren)).toBe(true);
 Test Files  1 failed (1)
      Tests  1 failed | 4 passed (5)
```

(레이아웃 배선 전 관측. 배선 후 5/5 GREEN.)

```
$ npx vitest run tests/unit/components/site-header-boundary-static.test.ts
No test files found, exiting with code 1
```

(파일 생성 전 관측. 생성 후 3/3 GREEN — 소스 변경 없이 통과, M1/M2가 이미 경계를 준수했기 때문.)

### 커밋 (B9 — 두 개의 별도 feat 커밋)

```
$ git log --oneline -2
1a73ad9 feat(SPEC-AUTH-003): M4 boundary regression guard + @MX:NOTE update
a986a30 feat(SPEC-AUTH-003): M3 wire SiteHeader into root layout above children
```

브랜치: `m3m4-layout-boundary`(위임 §A.0 복구 절차로 `d0b9a3e`에서 분기) → `git push origin m3m4-layout-boundary` 완료. 오케스트레이터가 t18(M1+M2 브랜치 계보)로부터 머지한다.

### static-scan (E2, AC-AUTH-046 범위)

```
$ grep -niE "Authorization|Bearer|localStorage|sessionStorage|createContext|useContext|useAuth" src/components/layout/SiteHeader.tsx src/components/layout/LogoutButton.tsx
(매치 없음, exit 1)
```

### 타입체크/린트 (E3)

```
$ npx tsc --noEmit
(출력 없음, exit 0)

$ npm run lint
(출력 없음, exit 0 — eslint . 무경고/무오류)
```

### PRESERVE 무변경 (E4)

```
$ git diff --stat 0a6d491 -- src/middleware.ts src/lib/auth/session-resolver.ts src/lib/auth/csrf.ts src/lib/auth/cookies.ts src/app/api/auth/logout/route.ts
(빈 출력)
$ git diff --stat 0a6d491 -- "src/app/products/[productId]/page.tsx" src/components/product/ProductDetailView.tsx
(빈 출력)
$ git diff --stat 0a6d491 -- src/app/staff/ prisma/schema.prisma
(빈 출력)
```

### 커버리지 (E5)

```
$ npx vitest run --coverage tests/unit/components/site-header.test.tsx tests/unit/components/logout-button.test.tsx
 src/components/layout | 100 | 100 | 100 | 100 |
  LogoutButton.tsx      | 100 | 100 | 100 | 100 |
  SiteHeader.tsx        | 100 | 100 | 100 | 100 |
```
(전역 threshold 오류는 이 targeted 실행이 나머지 `src/**`를 0%로 집계하기 때문이며, 신규 파일 2종 자체는 lines/statements/functions/branches 전부 100% — 요구 기준 85%/80%를 상회한다.)

### 전체 스위트 회귀 (D9/DoD)

```
$ npx vitest run
 Test Files  112 passed (112)
      Tests  1485 passed (1485)
```

회귀 0건. baseline 대비 파일 수 2개 증가(신규 테스트 2종)는 예상된 변화.

### RED 증거 (E8)

```
$ npx vitest run tests/unit/components/logout-button.test.tsx tests/unit/components/site-header.test.tsx
 FAIL  tests/unit/components/logout-button.test.tsx [ tests/unit/components/logout-button.test.tsx ]
Error: Failed to resolve import "@/components/layout/LogoutButton" from "tests/unit/components/logout-button.test.tsx". Does the file exist?
 FAIL  tests/unit/components/site-header.test.tsx [ tests/unit/components/site-header.test.tsx ]
Error: Failed to resolve import "@/components/layout/SiteHeader" from "tests/unit/components/site-header.test.tsx". Does the file exist?
 Test Files  2 failed (2)
      Tests  no tests
```

이 실패를 관측한 뒤에만 `LogoutButton.tsx`(먼저) → `SiteHeader.tsx`(다음)를 구현했다. 각 구현 직후 해당 테스트 파일만 재실행해 GREEN을 확인했다(로그: 위 §E.2 M1/M2 절 참고).

### @MX 태그 (plan.md §B.8 계획 이행)

```
$ grep -n "@MX:" src/components/layout/SiteHeader.tsx src/components/layout/LogoutButton.tsx
SiteHeader.tsx:  @MX:ANCHOR rendered by layout.tsx on every route ...
SiteHeader.tsx:  @MX:REASON layout.tsx renders this on every route ...
SiteHeader.tsx:  @MX:NOTE calls resolveSession() ... (dynamic-rendering 귀결 포함)
LogoutButton.tsx: @MX:NOTE reads the csrf_token cookie via the SAME inline document.cookie parse ...
```

계획대로 부여함: ANCHOR+REASON 1쌍 · NOTE 각 파일 1건. WARN/TODO 없음(계획대로).

### M4 @MX 태그 (layout.tsx)

```
$ grep -n "@MX:" src/app/layout.tsx
 * @MX:NOTE this comment previously stated that header/footer/nav/search/cart
```

plan.md §B.8 "layout.tsx 수정분 — @MX:NOTE 갱신" 이행. 기존 파일에는 @MX 태그가 없었으므로(사전 grep 확인, 매치 0건) "갱신"이 아니라 신규 부여로 처리했다 — 사실관계는 계획이 지시한 내용과 동일(전부 제외 서술이 부분적으로 거짓이 됨을 고정).

## §Definition of Done Cross-Check (acceptance.md §5 — 이 SPEC의 최종 완료 신호)

| 항목 | 판정 | 근거 |
|---|---|---|
| AC-AUTH-037~047 11건 전부 PASS(서브케이스 포함) | PASS | M1+M2 PASS/FAIL 매트릭스(§E.2) 7건 + M3+M4 PASS/FAIL 매트릭스(§E.2) 6건 = 11건 위치 전부 PASS(037/038/039/040/041/042/043a/043b/044/045/046/047ab) |
| `npx tsc --noEmit` exit 0 | PASS | M1+M2 §E.3 블록 + M3+M4 §E.2 "타입체크/린트" 블록 — 두 시점 모두 출력 없음/exit 0 |
| `npm run lint` exit 0, 신규 이슈 0건 | PASS | 동일 — 두 시점 모두 무경고/무오류 |
| 신규 소스 2종 커버리지 lines/statements ≥85%, branch ≥80% | PASS | §E.2 M1+M2 "커버리지(E5)" 블록 — `SiteHeader.tsx`/`LogoutButton.tsx` 전부 100/100/100/100. M3/M4는 신규 소스 파일을 추가하지 않음(layout.tsx는 기존 파일의 수정) |
| 전체 테스트 스위트 회귀 0건 | PASS | M1+M2 완료 시점 112 files/1485 tests → M3+M4 완료 시점 113 files/1489 tests, 전부 통과. 실패 0건 |
| PRESERVE 목록(plan.md §D) 전부 `git diff --stat` 무변경 | PASS | M1+M2 §E.2 "PRESERVE 무변경(E4)" + M3+M4 §E.2 "M4" 절 — 9개 대상 전부 빈 diff |
| plan.md §G 안티패턴 8건 전부 미범 | PASS | 1(csrf 유틸 추출) 미범 — LogoutButton이 인라인 파싱 유지; 2(클라이언트 컴포넌트+API) 미범 — SiteHeader는 서버 컴포넌트, 새 엔드포인트 없음; 3(Authorization 헤더) 미범 — M1+M2/M4 정적 스캔 0건; 4(리뷰 게이트 리팩터) 미범 — `page.tsx`/`ProductDetailView.tsx` git diff 빈 출력; 5(장바구니·검색·푸터 추가) 미범 — M4 정적 스캔 0건; 6(middleware matcher 확장) 미범 — `middleware.ts` git diff 빈 출력; 7(session-resolver.ts 낡은 주석 수정) 미범 — PRESERVE 목록에 포함되어 git diff 빈 출력으로 확인; 8(router.push 홈 이동) 미범 — `LogoutButton.tsx` 소스에 `router.push` 호출 없음(코드 확인, 200 경로에서 `router.refresh()`만 호출) |
| plan.md §B.8의 @MX 태그 계획대로 부여/갱신 완료 | PASS | SiteHeader.tsx(ANCHOR+REASON+NOTE), LogoutButton.tsx(NOTE), layout.tsx(NOTE 신규 부여) — 위 grep 블록들로 확인. session-resolver.ts의 낡은 NOTE는 계획대로 미수정(PRESERVE) |
| `package.json` 무변경(신규 의존성 0건) | PASS | `git diff --stat d0b9a3e9491080627e445c5a36064ba98ad9d652 -- package.json` — 이번 위임 범위(M3+M4)에서 별도 확인, 빈 출력 |

**전체 판정: 11개 DoD 항목 전부 PASS. SPEC-AUTH-003의 모든 마일스톤(M1-M4)이 완료되었다.**

## §E.3 Run-phase Audit-Ready Signal

```yaml
run_milestone: M4
next_milestone: none — all milestones complete
m1_files:
  - src/components/layout/SiteHeader.tsx
  - tests/unit/components/site-header.test.tsx
m2_files:
  - src/components/layout/LogoutButton.tsx
  - tests/unit/components/logout-button.test.tsx
m3_files:
  - src/app/layout.tsx   # modified, not new
  - tests/unit/app/shell.test.tsx   # modified, not new
m4_files:
  - tests/unit/components/site-header-boundary-static.test.ts
  - src/app/layout.tsx   # @MX:NOTE update (same file as M3's modification)
ac_pass_count: 11   # AC-AUTH-037/038/039/040/041/042/043a/043b/044/045/046/047ab — full 11-AC set
ac_fail_count: 0
preserve_list_post_run_count: 0   # 무변경 확인 완료 (M1-M4 누적)
new_warnings_or_lints_introduced: 0
cross_platform_build:
  tsc_noemit: pass
  eslint: pass
total_run_phase_files: 6   # 신규 소스 2 + 신규 테스트 3 + 기존 수정 1(layout.tsx, M3+M4 공유)
m1_to_mN_commit_strategy: >
  네 개의 별도 feat 커밋(M1/M2/M3/M4 각각, 합치지 않음, B9 준수) — M1/M2는
  빌드 의존성 순서로 커밋(LogoutButton 먼저, SiteHeader 다음); M3/M4는
  선언 순서 그대로 커밋(레이아웃 배선 → 경계 가드, M4는 M1+M2 산출물에만
  의존하고 M3의 layout.tsx 변경과는 독립적이므로 상호 의존 없음).
  status: draft→in-progress 전이는 M1 레이블 커밋에 실었다(Status
  Responsibility Matrix 준수). 근거는 위 §E.2 "커밋 순서에 관한 의도적
  이탈" 절 참고. M4 완료로 이 SPEC의 전체 마일스톤(M1-M4)이 완료되었다.


## §E.4 Sync-phase Audit-Ready Signal

```yaml
sync_complete_at: 2026-09-05
sync_commit_sha: 4873d74
sync_status: audit-ready
b12_self_test_a: "grep -c 'SPEC-AUTH-003' CHANGELOG.md → 0 before write (verified twice — orchestrator pre-flight + this agent's own re-verification)"
b12_self_test_b: "AC count match — grep -oE 'AC-AUTH-0(3[7-9]|4[0-7])' acceptance.md | sort -u | wc -l → 11 distinct AC-IDs (037/038/039/040/041/042/043a/043b/044/045/046/047), matches CHANGELOG entry's stated 11"
b12_self_test_c: "file path verification — ls src/components/layout/SiteHeader.tsx src/components/layout/LogoutButton.tsx src/app/layout.tsx → all 3 exist"
changelog_entry_position: "top of [Unreleased], before the SPEC-E2E-001 entry"
frontmatter_status_transitions.spec_md: "in-progress → completed (this sync commit)"
canary_compliance_check: "n/a — this SPEC does not define a forward-looking canary policy that its own sync tests"
```

sync-auditor 독립 재검증 결과: PASS — Functionality 98 / Security 95 / Craft 100 / Consistency 100, weighted 97.95. 전체 보고서: `.moai/reports/sync-audit/SPEC-AUTH-003-2026-09-05.md`.

README.md 교차 참조 정정 완료: `SPEC-AUTH-002`의 "알려진 한계" 문단에서 "헤더·전역 내비게이션 부재로 로그인해도 화면이 달라지지 않는다"는 서술을 이 SPEC이 낡게 만들었으므로, 헤더 부분만 해소됐음을 밝히고 전역 내비게이션·검색·장바구니는 여전히 부재임을 정확히 남기는 보강 문단을 추가했다. 신규 "로그인 상태 헤더 (SPEC-AUTH-003)" 섹션도 README에 추가했다. `SPEC-STOREFRONT-001`/`SPEC-STOREFRONT-003`의 헤더·내비게이션 관련 서술은 각 SPEC 자신이 그 시점에 만들지 않았다는 역사적 사실을 그대로 서술하고 있어 여전히 정확하므로 수정하지 않았다(그 SPEC들 자신의 범위 밖 결정에 대한 서술이지, 저장소 현재 상태에 대한 서술이 아님).

## §F Phase 4 Mode Selection

**Input parameters**: tier=M, scope=7 files (2 new source, 3 new test, 2 modified), domain count=1 (frontend/layout — server + client component pair), file language mix=TypeScript/TSX, concurrency benefit=LOW (coding-heavy, M3 depends on M1+M2 existing).

| Mode | Selected? | Rationale |
|---|---|---|
| `direct` | No | Non-trivial: 2 new components + layout wiring + boundary tests |
| `serial` | **YES** | Coding-heavy, small scope; M1/M2 independent then M3/M4 depend on them |
| `fanout` | No | Not multi-domain research; single layout/auth-display concern |
| `sweep` | No | Not mechanical/uniform; new-code work with design judgment already settled in plan-phase |

**Decision: serial**

**Justification**: Coding-heavy implementation of a small, well-specified SPEC (7 files, all design decisions settled in plan-phase per §B.1-B.8). M1(SiteHeader)+M2(LogoutButton) are independent new components with no interdependency, batched into one delegation; M3(layout wiring)+M4(boundary/regression) both depend on M1/M2 existing and are mechanical, batched into a second delegation — 2 serial `Agent()` spawns rather than 4, reducing per-spawn worktree-isolation overhead for a SPEC this small.

**Implementation Kickoff Approval**: user approved 2026-09-05 via AskUserQuestion (option: "지금 시작 (권장)"); progression mode = autonomous ("자동 진행 (권장)").
