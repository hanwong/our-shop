---
id: SPEC-AUTH-003
status: draft
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

_<pending run-phase>_

## §E.3 Run-phase Audit-Ready Signal

_<pending run-phase>_

## §E.4 Sync-phase Audit-Ready Signal

_<pending sync-phase>_
