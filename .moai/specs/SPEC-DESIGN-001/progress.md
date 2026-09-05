---
id: SPEC-DESIGN-001
status: in-progress
updated: 2026-09-05
tier: M
---

# Progress: SPEC-DESIGN-001 — 공통 디자인 토큰 체계 수립과 전체 사이트 반영

## §E.1 Plan-phase Audit-Ready Signal

plan_complete_at: 2026-09-05
plan_status: audit-ready

plan-phase 산출물 4종(spec.md, plan.md, acceptance.md, spec-compact.md) 작성 완료. Tier M.

### Phase 1 SKIP Rationale (사전 조사 재검증)

착수 지시가 사전 조사 결과를 요약해 전달했으나, **무비판적으로 수용하지 않고 전 항목을 직접 재확인했다.** 아래는 실행한 검증과 관측 결과다.

**확인된 항목:**

```
$ ls .moai/specs/ | grep -i design            → 매치 0건 (SPEC-DESIGN-001 충돌 없음)
$ grep -rl "SPEC-DESIGN-001" .moai/specs/     → 0건
$ grep -rn "REQ-DESIGN-\|AC-DESIGN-" .moai/specs/ → 0건 (번호 공간 미사용, 001부터 시작)
$ find src/app -name "page.tsx" | wc -l        → 15
$ cat .mcp.json                                → context7 / moai / playwright 3개만. DesignSync 미등록 확인
$ ls .moai/project/brand/                      → No such file or directory
$ grep -n interview_on_first_run .moai/config/sections/design.yaml → true (35행)
```

`src/app/globals.css` 원문 확인 — `@theme` 블록 부재 및 다음 주석 존재를 육안 확인했다: "No `@theme` block: a design-token system is excluded by spec.md §3, and inventing one here would fix project-wide styling decisions this SPEC has no mandate to make."

`src/components/layout/LogoutButton.tsx` 48행 원문 확인 — `<button type="button" onClick={handleLogout}>`, `className` 속성 전무. 조사 내용과 일치.

**조사 대비 정정 2건 (그대로 받아쓰지 않고 실측으로 교정):**

1. **선행 "범위 밖" 선언 건수: 3건(전제) → 2건(1차 정정) → 4건(전수 스캔 후 최종).** 착수 지시는 STOREFRONT-001·STOREFRONT-002·AUTH-002 3건을 전제했다. 1차 확인에서 SPEC-AUTH-002의 Out of Scope 절 7개(`spec.md` 100-119행) 중 디자인 시스템을 지목한 것이 **없음**을 확인했다(제외 대상은 **공통 헤더/내비게이션**, 106-107행). 그러나 그 확인은 **지목된 SPEC만 검증한 한 방향 점검**이었고 전수 조사가 아니었다 — plan-audit D1이 이 점을 지적했다. 전수 스캔으로 2건이 추가 발견됐다:

```
$ grep -rn "components/ui" .moai/specs/ --include=spec.md
SPEC-STOREFRONT-001/spec.md:143  SPEC-STOREFRONT-002/spec.md:159
SPEC-STOREFRONT-003/spec.md:132  SPEC-AUTH-003/spec.md:179
```

최종 사실: **명시적 제외 4건 + 인접 이연 인용 1건(AUTH-002)**. 특히 **SPEC-AUTH-003**은 이 SPEC의 `depends_on:`에 이미 있고 §C가 그 `plan.md:204`를 인용하므로, **같은 SPEC이 제약의 출처이자 반전 대상**이다 — 한쪽 파일만 읽고 다른 쪽을 놓친 것이 이번 누락의 원인이다. spec.md §1.1 / plan.md §A / spec-compact.md를 4건 기준으로 정정했다.

2. **페이지 고객/스태프 분할: 8+7 → 9+6.** 총계 15는 일치하나 분할이 달랐다. 실측:
   - 고객 `(shop)/` **9장**: `page.tsx`(홈), `products/[productId]`, `cart`, `checkout`, `checkout/complete/[orderId]`, `login`, `signup`, `orders/lookup`, `orders/lookup/[orderNumber]`
   - 스태프 **6장**: `staff/login`, `staff/products`, `staff/products/new`, `staff/products/[productId]`, `staff/orders`, `staff/orders/[orderId]`
   plan.md §F.3/§F.4에 정정된 분할로 열거했다.

**조사보다 강하게 확인된 항목 1건:** 버튼 클래스 수렴은 조사가 "5개 이상 파일 / 10개 이상 인스턴스"로 보수적으로 적었으나, 실측은 **13개 파일**이 `rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white`를 공유한다. 폼 입력은 **정확 일치 7개 파일** + **근접 변형 1개**(`CheckoutInteractive.tsx:138` — 선행 `mt-1` 없음) = 8개 소비자다(plan-audit D4 정정 반영). 오류 텍스트(`text-red-600`/`700`)는 15개 파일 21곳. spec.md §1.2에 실측값으로 기록했다.

이 재검증으로 Phase 1(별도 recon)은 SKIP한다 — 조사 범위가 이미 커버되었고 핵심 주장을 전부 직접 관측했다.

### SPEC ID 검사

정규식 검사를 Bash로 실행해 관측했다.

```
$ ID="SPEC-DESIGN-001"; [[ "$ID" =~ ^SPEC(-[A-Z][A-Z0-9]*)+-[0-9]{3}$ ]] && echo PASS || echo FAIL
PASS
```

### 프론트매터

정본 12필드 전부 존재 — `id`/`title`/`version`/`status`/`created`/`updated`/`author`/`priority`/`phase`/`module`/`lifecycle`/`tags`. 선택 필드 `tier: M`·`depends_on`·`related_specs` 포함. `phase: "v0.3.0 target"`(최신 미출시 릴리스 타깃 — 워크플로 단계명이 아닌 릴리스 타깃 표기), `status: draft`.

`depends_on` 3건은 전부 이 SPEC이 실제로 인용하는 선행 SPEC이다 — STOREFRONT-001/002(반전 대상 Out of Scope 선언의 출처), AUTH-003(PRESERVE 목록과 `LogoutButton` 결함의 출처).

### REQ/AC 대응

REQ 13건(REQ-DESIGN-001 ~ 013) / AC 16건(AC-DESIGN-001 ~ 016). **Tier M 상한(REQ 16 / AC 16) 이내** — REQ 여유 3건, AC 여유 0건(상한 정확히 도달). acceptance.md §C에 REQ↔AC 추적표로 1:다 대응까지 명시했고, 요구사항 13건 전부가 최소 1개 AC로 덮인다(미대응 REQ 0건).

### Tier 판정과 기록된 긴장 (감사자 주목)

**Tier M** — 사용자가 착수 전 확정. 다만 `spec-workflow.md` § SPEC Complexity Tier의 **"Files affected" 축과는 긴장이 있으며, 이를 숨기지 않고 plan.md §E에 표로 명시했다.**

| 축 | M 가이드 | 실측 | 판정 |
|---|---|---|---|
| LOC | 300-1000 | className 교체 위주, 1000 미만 예상 | 부합 |
| Files affected | 5-15 | **약 23** (plan.md §E 내역표) | **초과(L 구간)** |
| REQ/AC | 각 16 | 13 / 16 | 부합 |

사용자 결정 근거(재논의 대상 아님): 선행 디자인 산출물 SPEC 2건이 모두 Tier M으로 Conditional Design Route를 탔고 Tier L을 요구한 적이 없다는 선례 + 단일 파일 1000 LOC 초과 우려 부재. 완화 성질: 파일 수는 많으나 **파일당 변경이 얕고 균질**(className 참조 → 프리미티브 호출)하여, Tier L 기준이 겨냥하는 "이질적 다중 하위시스템 변경" 위험과 성격이 다르다.

**이 항목은 의도적으로 노출한다** — 놓친 것이 아니라 알고 내린 결정임을 감사자가 확인할 수 있도록.

### Conditional Design Route — 적용됨

**이 SPEC은 UI 노출 SPEC이며 `plan → design → run` 조건부 경로를 탄다.**

판정 근거: `spec-workflow.md` § Conditional Design Route의 UI-surface heuristic 두 갈래 중 **첫 번째**를 만족한다 — "explicit frontend-component / view / page deliverable in `acceptance.md`". `acceptance.md`의 AC-DESIGN-004(프리미티브 컴포넌트), AC-DESIGN-007(`LogoutButton` 렌더), AC-DESIGN-010(15개 페이지 렌더)이 프런트엔드 컴포넌트와 화면을 명시적 산출물로 검증한다. (두 번째 갈래인 `tier: L` 조건은 이 SPEC에 해당하지 않으나, 두 갈래는 OR이므로 무관하다.)

선례: SPEC-STOREFRONT-001/002/003이 동일 기준으로 Tier M에서 이 경로를 적용했다.

**경로 기록(사실 진술)**: 이 SPEC은 Conditional Design Route 대상이며, plan-audit PASS + Implementation Kickoff Approval 이후 run-phase M1 커밋 이전에 design phase를 경유한다. **이 plan-phase에서는 경로 판정만 기록했고 design phase 자체는 실행하지 않았다.**

### design phase의 남은 역할 — 재검증만 (토큰은 이미 확보됨)

**이 절은 이전 판에서 전면 교체됐다.** 이전에는 "design phase가 토큰 값을 확정한다"는 전제로 1차/폴백 두 경로를 기술했으나, **DesignSync 인가로 Classical 실제 토큰을 이미 확보해 `plan.md` §D.1에 원문 고정했다.** 따라서 design phase가 값을 *확보*하는 단계는 이미 끝났고, 남은 역할은 **재검증**뿐이다.

| design phase 실행 시점 조건 | 남은 역할 | 근거 |
|---|---|---|
| DesignSync 접근 가능 | §D.1 블록을 라이브 Classical과 대조해 불일치 기록 | REQ-DESIGN-009 / AC-DESIGN-014 |
| DesignSync 접근 불가 | §D.1을 오프라인 SSOT로 삼아 진행, 라이브 재검증 없었음을 기록 | REQ-DESIGN-010 / AC-DESIGN-013 |

**폐기된 개념 2건** — 이전 판이 상정했던 것들이며 더 이상 이 SPEC에 존재하지 않는다:
- "로컬 등가물 도출"(STOREFRONT-002/003 선례) — 코드에서 값을 역산할 필요가 없어졌다.
- "잠정 값 표시 + 사후 재동기화" — 모든 토큰이 실제 Classical 값이므로 잠정 값이 0건이다.

`manager-design.md` § Tool Availability의 graceful-degradation 계약은 여전히 유효하나, 이제 그 degradation이 잃는 것은 **재검증 한 단계**뿐이다. 어느 쪽이든 이 SPEC은 완전히 진행 가능하며, 이는 미해결 질문이 아니라 **양쪽이 정의된 조건 분기**다.

### PRESERVE 상호작용 — 명시 처리

SPEC-AUTH-004 §C의 선례("이름을 대고, 근거를 적고, 조용히 넘어가지 않는다")를 따라 plan.md §C에 전면 정리했다.

- **무관(수정 없음)**: `src/middleware.ts`, `session-resolver.ts`, `csrf.ts`, `cookies.ts`, `logout/route.ts`, `prisma/schema.prisma` — 스타일 표면이 없다.
- **무변경 유지**: `SiteHeader.tsx` — `LogoutButton`을 렌더할 뿐이며 스타일 변경은 `LogoutButton` 내부에서 일어나므로 이 파일은 diff 0.
- **스타일 목적 한정 수정**: `src/app/staff/**` 8개 파일(AUTH-003 `plan.md:204` 핀 대상). plan.md §C.2가 파일을 사전 열거했고 **AC-DESIGN-015가 실제 diff를 그 목록의 부분집합으로 요구**한다(정확 일치가 아니다 — D2 정정). 판단 근거: PRESERVE 핀은 그 SPEC의 run-phase 범위 제약이며(AUTH-003이 `git diff --stat`으로 검증한 대상) 영구 동결이 아니다. AUTH-004도 사용자 승인 하에 핀 파일을 이동한 선례가 있다.
- **유혹 차단**: `LogoutButton.tsx`의 CSRF 파서 공유 유틸 추출은 §C.3/§G 안티패턴 1로 명시 금지했다 — 이 SPEC이 `ProductForm.tsx`를 어차피 열게 되어 "이제 추출해도 되겠다"는 유혹이 생기는 지점이기 때문이다. (plan-audit D3으로 `CancelOrderButton.tsx`가 범위 밖이 되면서 세 번째 소비자 중 하나는 아예 열리지 않게 되어 유혹의 근거가 더 약해졌다.)

### 미해결 명료화 항목

**0건.** 미해결 명료화 마커 없음. 두 범위 결정(Tier M, 단일 패스 전체 사이트)은 착수 전 사용자 라운드에서 확정됐고, DesignSync 가용성은 미해결 질문이 아니라 양쪽 경로가 정의된 조건 분기다.

### 워크플로 경로 — Route B (PR 경유), 사용자 확정

이 SPEC은 **Route B(PR 경로)**로 간다. Tier S/M 기본값은 Route A(Hybrid Trunk main-direct, PR 없음)이며, 이를 **명시적으로 재정의**한 것이다.

- **근거**: 약 23개 파일이 사이트 전역에 걸쳐 변경되고 Classical 적용으로 시각 결과까지 바뀌므로 병합 전 리뷰 단계가 필요하다(사용자 판단 + Classical 반영 후 강화됨).
- **진입 방법**: `spec-workflow.md` § SPEC Phase Discipline이 규정한 "Tier L **OR** 명시적 `--pr`" 중 **후자**. Tier를 L로 올리지 않고 `--pr`로 Route B에 진입하며, 이는 규칙이 의도한 사용법이다.
- **발동 시점**: sync-phase에서 `--pr` 플래그 사용. `manager-git`이 PR 생성 담당.
- **함의**: 단계 전이 트리거가 커밋/푸시가 아니라 **PR 병합**이다.

상세: plan.md §B.1b.

### plan-audit 결과 (iteration 1, 2026-09-05) — **FAIL 0.785**

독립 감사자(plan-auditor)가 **FAIL**, 종합 점수 **0.785**로 판정했다(Tier M 통과선 0.80 — 0.015 미달). 보고서: `.moai/reports/plan-audit/SPEC-DESIGN-001-2026-09-05.md`.

**Tier M 결정 자체는 유지됐다** — 감사자가 파일 수 초과분을 독립 재계산한 결과 명시 상한의 약 1.3-1.5배(이 문서가 최초에 추정한 2배가 아님)였고, "얕고 균질한 변경" 완화 논거도 성립함을 확인했다(15개 페이지 중 13개가 단일 문자열 변환).

**차단성 지적 5건 — 같은 날 전부 수정 완료:**

| ID | 등급 | 내용 | 처리 |
|---|---|---|---|
| D1 | major | 선행 제외가 2건이 아니라 **4건**(STOREFRONT-003:132, AUTH-003:179 누락) | spec.md §1.1에 2건 인용 추가, 전 산출물 4건 기준 정정 |
| D2 | major | AC-DESIGN-015가 **달성 불가능** — §C.2 열거 8개 중 4개는 이 SPEC 범위 대상이 0건 | 정확 일치 → **부분집합** 판정으로 변경 |
| D3 | major | `CancelOrderButton`은 `bg-red-600` **위험 변형**이라 13개 파일 수렴에 미포함인데 수정 목록에 있었음 | §C.2에서 제거 + `spec.md` §3에 Out of Scope 절 신설 |
| D4 | minor | 폼 파일 수 **7 vs 8** 불일치(Given은 엄격 7, 검증은 느슨 8) | 정확 7 + 근접 변형 1로 명시 정렬, `CheckoutInteractive.tsx` 차이 기록 |
| D5 | major | Route A/B 미결정 | **Route B 확정**(사용자), 위 절에 명시 |

**AC 예산**: D3이 위험 변형을 범위 밖으로 밀어내면서 17번째 AC 추가를 회피했다 — AC는 16건(Tier M 상한)을 유지한다.

### plan-audit iteration 2 (2026-09-05) — **PASS 0.936**

iteration 1의 5건(D1-D5) 수정 후 재감사에서 **PASS**, 종합 점수 **0.936**(Tier M 통과선 0.80). Tier M 결정도 유지 — 감사자가 파일 수 초과분을 독립 재계산해 명시 상한의 1.3-1.5배(이 문서의 최초 추정 2배가 아님)임을 확인했고, "얕고 균질" 완화 논거도 성립(15개 페이지 중 13개가 단일 문자열 변환).

**후속 정정 3건(재감사 불요, 수치 오류만)** — 전부 반영 완료:

| ID | 내용 | 처리 |
|---|---|---|
| R1 | plan.md §B.1 경고 단락이 "선행 SPEC 2건"으로 남아 있었음(D1은 파일 내 다른 곳에만 반영됨) | 4건으로 정정 |
| R3 | §C.2 서두가 "코로케이션 컴포넌트 2개"인데 D3으로 표에는 1개(`ProductForm.tsx`)만 남음 | 1개로 정정(§C.2 서두 + M4 제목) |
| R5 | D5 수정이 새 불일치 유발 — §B.1b는 "약 20개", §E는 "약 25-30" | **약 23**으로 통일 + 내역표 추가. 감사자 재계산 19-22에 Classical 매핑 추가분 2건(`SiteHeader`/`ProductCard`)을 더한 값. 기존 25-30은 버튼·폼 집합을 합집합이 아닌 단순 합산해 중복 계산한 수치였다 |

### Classical 토큰 확보 — 이 SPEC의 전제가 바뀐 지점

**DesignSync 인가로 실제 대상 디자인 시스템("Classical", 편집·서적풍)의 확정 토큰을 확보했다.** 이는 단순한 값 채우기가 아니라 **SPEC의 핵심 프레이밍이 뒤집힌 사건**이므로 별도로 기록한다.

**무엇이 틀렸었나**: 이전 판은 이 SPEC을 "이미 수렴한 값을 토큰으로 승격시키는 기계적 통합(consolidation)"으로 규정했다. 실제 Classical은 현재 코드베이스와 **정반대**다.

| 축 | 현재 코드 | Classical | 관계 |
|---|---|---|---|
| 버튼 | `bg-neutral-900` 솔리드 채움 (13개 파일) | **아웃라인**(투명 배경 + accent 테두리·글자) | 정반대 |
| 타이포 | 시스템 sans 스택 | Cormorant Garamond + Lora 세리프 | 완전 교체 |
| 배경/전경 | 흰 배경 + neutral | `#f3f2f2` 종이색 + `#201f1d` | 완전 교체 |

Classical readme 원문: *"Do not fill cards or buttons with solid accent color."*

**왜 중요한가**: 이전 프레이밍대로 진행했다면 구현자가 현재의 솔리드 스타일을 그대로 토큰으로 굳혀 놓고도 인수 기준을 통과시킬 수 있었다 — **목표와 정반대인 결과가 "합격"으로 기록되는 상태**. AC-DESIGN-008에 (b) 아웃라인 렌더 단언 + (c) accent 솔리드 채움 0건을 추가해 이 경로를 막았다.

**반영 내역**:
- `spec.md` §1.2 신설(정정 절), §1.5 재작성(값 확보 완료), REQ-002/005/008/009/010 갱신, Out of Scope 3개 절 수정
- `plan.md` §D.1에 Classical `:root` 블록 **원문 인용**(SSOT), §D.1b 교체 표, §D.3 컴포넌트 매핑, §D.4 readme 제약 5건
- AC 갱신: 001(축자 일치), 003(폰트 로딩), 005(포커스 링), 008(아웃라인), 010, 013/014(재검증 축으로 재정의)
- **AC 총수 16건 유지** — 신규 AC를 만들지 않고 기존 AC 문구에 병합(Tier M 상한, 여유 0)

**부수적으로 확인된 실측 2건**:
1. `src/components/product/ProductCard.tsx:40`이 포커스 스타일을 하드코딩하고 있다(`focus-visible:ring-2 ring-neutral-900`). Classical의 `:focus-visible` + `outline` 규칙과 충돌하므로 **제거 대상**이다. 저장소에서 포커스 스타일을 가진 유일한 지점임을 grep으로 확인했다(AC-DESIGN-005(c)).
2. `package.json`에 `lucide-react`가 **없다**(아이콘 라이브러리 전무). Classical readme가 Lucide를 지정하지만, 이 SPEC 범위에 아이콘 사용처가 없고 AC-DESIGN-006이 신규 의존성 0건을 요구하므로 **이월**했다(plan.md §B.6).

**범위 추가 2건**: `SiteHeader.tsx`(무변경 → 수정, Classical `.nav` 1:1 매핑 — §C.4 판정 변경), `ProductCard.tsx`(`.card` + 포커스 링 제거). 파일 수가 약 21 → 약 23이 됐다.

**AC-DESIGN-015 재확인**: 스태프 파일 부분집합 판정은 **영향 없음**. 그 AC는 "어떤 파일이 이 SPEC 범위의 클래스를 갖는가"를 다루며 목표 스타일이 무엇인지와 무관하다. 4개 파일의 대상 0건이라는 실측도 그대로다.

### [해소됨] 폰트 로딩 결정 — 사용자 확정 (2026-09-05)

**결정: `next/font/google` 채택 + M0 vitest 모킹 안전장치, `@import` 폴백 유지.** 사용자가 계획된 내용 그대로 확정했으며 문서 변경 요구는 없었다. 미해결 항목은 이제 **0건**이다.

아래는 그 결정에 이르게 된 근거 기록이다(이력으로 보존).

#### 배경 — 선행 SPEC의 철회 기록과의 충돌

`next/font/google` 채택을 권고받았고 그렇게 결정했으나(plan.md §B.5), **이 저장소에는 그 방식을 한 번 시도했다 철회한 기록이 있다.** `src/app/layout.tsx:38-50` 원문: `next/font`가 Next.js SWC 폰트 로더를 필요로 하는데 vitest가 그것을 실행하지 않아 셸이 테스트 불가능해졌다(`Inter is not a function`). 빌드 타임 네트워크 페치 문제도 함께 기록되어 있다.

권고를 따르되 **그 실패를 해소 가능한 테스트 인프라 문제로 판단**해 M0(vitest 폰트 모킹)를 선행 마일스톤으로 분리하고, 실패 시 `@import` 폴백 경로를 §B.5에 명시했다. 선행 SPEC의 판단을 뒤집는 근거는 전제 차이다 — STOREFRONT-001은 "기본 타이포그래피"만 필요했고, 이 SPEC은 특정 세리프 페어링이 요구사항 자체다.

이 판단은 모킹 실패 시 M0에서 막히고 폴백 전환 비용이 발생하므로 사용자 확인 대상으로 올렸고, **위와 같이 확정됐다.** 잔여 위험(모킹 실패 가능성)은 사라지지 않았으나 §B.5의 폴백 경로가 그것을 흡수한다.

### plan-audit iteration 3 (2026-09-05) — **PASS 0.868**, 최종 감사 라운드

**PASS**, 종합 점수 **0.868**(Tier M 통과선 0.80). 다만 두 신호가 동시에 발생했다:

- **STOP/회귀 신호**: 0.936 → 0.868 하락. 감사자는 이를 품질 저하가 아니라 **내용 분량 증가**(plan.md 330→466행)에 따른 것으로 귀속했다.
- **3회 감사 상한 도달**: `spec-workflow.md` § SPEC Complexity Tier의 plan-auditor 상한(SPEC당 최대 3회).

**사용자 결정: 6건 수정 후 Implementation Kickoff Approval로 직행 — 4차 감사 라운드 없음.** 이번이 이 SPEC의 마지막 수정 패스다.

#### 감사자 근본 원인 진단 (내재화함)

3회 전 반복에서 **동일한 실패 패턴**이 재발했다 — *바뀐 술어(predicate)를 1차 위치에서는 고쳤으나 문서 다른 곳의 낡은 재진술이 살아남는다*. 계보: D1→R1, D3→R3, D5→R5, D2→I3-3(3곳), 프레이밍 전환→I3-1/2/4/5(여러 곳).

**처방**: 술어/주장을 하나 바꿀 때마다 **5개 산출물 전체에서 그 술어의 모든 재진술을 grep한 뒤에야** 수정 완료를 선언한다. 처음 눈에 띈 곳만 고치지 않는다. 이번 패스는 편집 **이전에** 감사자의 grep(`일치|통합|잠정|두 차례`)을 먼저 돌려 대상 전수를 확보한 뒤 작업했다.

#### iteration 3 지적 6건 — 전부 반영 완료

| ID | 등급 | 내용 | 처리 |
|---|---|---|---|
| I3-6 | major | AC-008(c) grep이 **가장 유력한 실제 위반을 놓침** — Tailwind v4는 `@theme` 색상 토큰에서 `bg-accent` 유틸리티를 자동 생성하는데(`tailwindcss ^4.3.3` 실측), 기존 패턴은 `bg-[var(--color-accent)]` 형태만 검사했다 | 패턴을 3형태 전부 거부하도록 교체(자동 생성 유틸리티 / 임의값 CSS 변수 / 직접 CSS 선언), `bg-transparent`만 예외. **패턴 실행 검증 완료** — 현재 코드의 솔리드 채움을 실제로 포착함 |
| I3-2 | major | plan.md §G 안티패턴 4의 "이 SPEC은 통합이지 재디자인이 아니다"가 §1.2 프레이밍 전환과 정면 충돌. §G는 run-phase가 "하지 말 것"을 읽는 곳이라 구현을 잘못된 스타일 보존 쪽으로 편향시킬 위험 | 경계선을 명시하도록 재작성 — 색·타이포·버튼은 **바뀌고**, 화면 구조만 그대로 |
| I3-3 | major | "정확 일치" 술어가 D2 수정 후에도 3곳 잔존(acceptance.md DoD, plan.md M5, plan.md §I) | 3곳 전부 부분집합 술어로 교체. **전수 grep으로 감사자가 지목하지 않은 4번째(progress.md:122)를 추가 발견해 함께 수정** |
| I3-4 | major | progress.md DesignSync 절이 iteration-1 폴백 프레이밍·"잠정 값"·낡은 REQ 번호를 담고 있었고, 오케스트레이터 라우팅 지시가 provenance 기록에 섞여 있었음 | 절 전면 교체 — design phase의 남은 역할을 **재검증 한정**으로 재기술, 폐기 개념 2건(로컬 등가물/잠정 값) 명시, 라우팅 지시를 사실 진술로 전환 |
| I3-1 | major | HISTORY가 "두 차례"(§1.1은 "네 차례") + 프레이밍 전환 자체에 HISTORY 항목 부재 | "네 차례"로 정정 + **0.2.0 HISTORY 항목 신설**(프레이밍 전환 기록). 프론트매터 `version:`도 0.2.0으로 동반 갱신 — 안 하면 이번 진단이 경고한 바로 그 drift가 새로 생긴다 |
| I3-5 | minor | spec.md §4가 삭제된 REQ-010의 옛 의미("잠정 토큰 표시")를 참조 | Classical 스냅샷 재동기화 조건으로 교체 + "잠정 값은 없다" 명시 |

#### 자체 검증 (감사자 방법론을 직접 실행)

편집 완료 후 감사자가 사용한 grep을 그대로 재실행해 잔존 0건을 확인했다:

```
$ grep -rn "일치\|통합\|잠정\|두 차례" .moai/specs/SPEC-DESIGN-001/
→ 잔존 낡은 진술 0건. 남은 매치는 전부 문맥상 정확:
  · "축자 일치"(토큰 값 일치 요구) · "정확 일치 7건"(폼 파일 실측, D4)
  · "정확 일치가 아니다"(부분집합 명시) · "불일치"(재검증 결과)
  · "기계적 통합이 아니라"(프레이밍 전환 진술문) · "잠정 값은 없다"(부재 선언)
```

**SPEC은 Implementation Kickoff Approval 준비 완료. 추가 plan-audit 라운드 없음.**

### run-phase 진입 전 남은 게이트

1. ~~plan-audit~~ — **종료**. iteration 3 PASS 0.868로 통과했고, STOP/회귀 신호와 3회 상한이 함께 발생해 사용자가 **"6건 수정 후 직행"**을 선택했다. iteration 3의 6건 전부 반영 완료. **4차 라운드 없음**
2. Implementation Kickoff Approval (사용자 승인) — 폰트 로딩 결정은 이미 확정됐으므로 별도 확인 불필요
3. **design phase (manager-design D1-D5)** — Conditional Design Route 판정에 따라 run-phase M1 커밋 이전에 경유. 단 역할이 축소됐다: 토큰은 이미 확보되어 있으므로 design phase는 **재검증**(REQ-DESIGN-009)이며, 접근 불가 시에도 §D.1 오프라인 SSOT로 진행 가능(REQ-DESIGN-010)
4. run-phase 진입 시 **M0(vitest 폰트 모킹)를 M1보다 먼저** 실행 — 생략하면 셸 테스트가 즉시 깨진다

## §F Phase 4 Mode Selection

**Input parameters**: tier=M(문서 산출물 기준; 파일 수 축은 L 초과이나 사용자가 M 유지를 확정), scope≈23 files (버튼·폼 소비 13 + 나머지 페이지 6 + globals.css/layout.tsx 2 + 신규 프리미티브 2 + SiteHeader/ProductCard 2), domain count=1(프런트엔드 디자인 시스템 롤아웃 — 서버/DB/인증 로직 무관), file language mix=TSX/CSS, concurrency benefit=LOW(coding-heavy, M0가 M1을, M1이 M2~M4를 순차적으로 게이트).

| Mode | Selected? | Rationale |
|---|---|---|
| `direct` | No | 비자명 — 사이트 전체 시각 결과가 바뀌는 다마일스톤 작업 |
| `serial` | **YES** | M0(폰트 모킹, 실패 가능성 있는 인프라)가 M1(토큰+프리미티브)을 게이트하고, M1이 M2~M4(프리미티브 소비)를 게이트하는 강한 순차 의존. 마일스톤별로 사용자가 단계 확인을 선택함(자동 진행 아님) |
| `fanout` | No | 리서치형 다중 도메인 작업이 아님 — 단일 도메인의 코딩 중심 작업 |
| `sweep` | No | 23개 파일 중 상당수가 클래스명 치환이라는 점에서 기계적 성격이 있으나, M0(인프라)·M2(구체 결함 수정)·M3/M4(매핑 판단이 필요한 시각 전환)가 섞여 있어 "단일 균일 변환 규칙"이 아님. 실패 시 되돌림 경로(§B.5 후보 2)가 있는 M0는 특히 sweep에 부적합 |

**Decision: serial**

**Justification**: M0→M1→{M2,M3,M4}→M5의 강한 순차 의존과, 사용자가 명시적으로 선택한 "단계마다 확인"(세미-자동 진행) 축이 결합해 마일스톤 단위 순차 위임이 맞다. M0는 실패·되돌림 경로가 정의된 인프라 작업이라 독립 확인이 필요하고, 코딩 중심 작업이므로 Anthropic의 coding-task parallelism caveat에 따라 fanout/sweep보다 serial이 안전하다.

**Implementation Kickoff Approval**: user approved 2026-09-05 via AskUserQuestion (option: "지금 시작 (권장)"); progression mode = semi-autonomous ("단계마다 확인 (권장)")로 시작 — M0/M1 완료 후 각각 사용자 확인을 받았다.

**진행 방식 전환 (M2 진행 중, 2026-09-05)**: 사용자가 "마일스톤 넘어가는것은 자동으로 계속 진행해줘"라고 직접 지시 — 이 시점부터 M3 이후는 **자동 진행**으로 전환한다. 각 마일스톤 병합·검증(typecheck/lint/전체 스위트/PRESERVE diff)은 계속 오케스트레이터가 직접 수행하고 리드에게도 계속 보고하되, 사용자 확인 라운드(AskUserQuestion)는 마일스톤 사이에서 생략한다.

## §G Design-phase Evidence (D1-D5, manager-design)

design_phase_completed_at: 2026-09-05
design_phase_status: proceeded-offline (REQ-DESIGN-010 path)

이 절은 design phase(D1-D5)의 실행 증거를 기록한다. `progress.md` §E.1 위쪽
"design phase의 남은 역할 — 재검증만" 절이 이미 기술한 조건 분기(재검증 vs
오프라인 진행)가 이번 실행에서 어느 쪽으로 실제 귀결됐는지가 이 절의 내용이다.

### DesignSync 가용성 실측 (D1)

이 세션에서 실제로 확인했다:

```
$ grep -c "DesignSync" .mcp.json
0
$ cat .mcp.json  # mcpServers: context7, moai, playwright — DesignSync 미등록
$ ls .moai/project/brand/
No such file or directory (예상된 상태 — plan.md §B.4)
```

이 세션의 에이전트 tool 목록에도 `mcp__DesignSync__*` 도구가 없다. **결론:
DesignSync는 이번 실행 시점에 가용하지 않다.** 인증 실패나 네트워크 오류가
아니라 `.mcp.json`에 서버 자체가 등록되지 않은 구조적 부재다.

### 경로 판정 — REQ-DESIGN-010 / AC-DESIGN-013 (오프라인 SSOT)

REQ-DESIGN-009("Where DesignSync가 가용할 때 재검증")의 전제 조건이 거짓이므로
REQ-DESIGN-009는 발동하지 않는다. REQ-DESIGN-010이 발동한다: `plan.md` §D.1을
오프라인 SSOT로 삼아 그대로 진행하고, 라이브 재검증이 수행되지 않았음을
명시적으로 기록한다(AC-DESIGN-013 요구 3항목 충족).

**라이브 대조 자체가 없었으므로 "일치 확인"이 아니라 "대조 미수행"이다** —
이 둘은 다르다. AC-DESIGN-014("재검증 결과 기록")는 이번 실행에서
"해당 없음(AC-DESIGN-013 경로)"이다.

### D2/D3 — 실행되지 않음 (이 SPEC의 축소된 역할과 일치)

이 SPEC의 착수 지시가 명시한 대로, design phase의 역할은 토큰 재파생이
아니라 재검증(또는 오프라인 진행)에 한정된다. Claude Design에 대한 신규
push(D2 `finalize_plan`/`write_files`)나 신규 캔버스 화면 생성(D3)은
이번 세션의 범위가 아니었고 수행하지 않았다.

### D4 — 산출물 페이스트 (실제 작업)

`plan.md` §D.1 토큰 블록을 축자 전사해 예약 경로에 페이스트했다:

- `.moai/design/tokens.json` — Classical `:root` 토큰 전체(색상·타이포·간격·
  라운드·그림자), 도구 가용성 기록 포함
- `.moai/design/components.json` — `plan.md` §D.2(추출 대상)·§D.3(클래스→
  컴포넌트 매핑)·§D.4(readme 제약 5건)를 M0-M5가 바로 소비할 수 있는 형태로
  재포장
- `.moai/design/brief/BRIEF-DESIGN-001.md` — D1-D5 실행 기록 + 도구 가용성
  판정 + M0-M5 소비 매핑

**축자 일치 자체 검증**:

```
$ grep -oE '#[0-9a-fA-F]{6}|4\.6px|9\.2px|13\.8px|18\.4px|27\.6px|36\.8px|Cormorant Garamond|Lora' .moai/specs/SPEC-DESIGN-001/plan.md | sort -u > /tmp/plan_vals
$ grep -oE '#[0-9a-fA-F]{6}|4\.6px|9\.2px|13\.8px|18\.4px|27\.6px|36\.8px|Cormorant Garamond|Lora' .moai/design/tokens.json | sort -u > /tmp/json_vals
$ diff /tmp/plan_vals /tmp/json_vals
(빈 출력 — 완전 일치, 26개 값 전부)
```

`.moai/design/assets/`는 페이스트하지 않았다 — 이 SPEC은 신규 이미지·아이콘
자산을 도입하지 않는다(Lucide 아이콘 도입은 명시적으로 이월, spec.md §4).

### D5 — 구현 연결

이 design-phase 세션은 산출물(디자인 SSOT + 검증 기록)만 만든다 —
manager-develop으로의 H8 Section A-E 재위임 패키지 조립은 오케스트레이터가
run-phase 진입 시점에 별도로 수행한다. 이 세션에서 애플리케이션 코드
(`.tsx`/`.css`)는 전혀 수정하지 않았다.

### plan.md 대비 추가 사실 — 없음

명시적으로 기록한다: 이 design phase 실행이 `plan.md`에 없던 새로운 불일치,
정정, 갱신을 제기하지 않는다. `tokens.json`에 전사된 값은 `plan.md` §D.1과
바이트 단위로 동일하다(독립 재파생이 아니라 직접 전사로 검증). SPEC 본문
(spec.md/plan.md/acceptance.md)에 대한 수정 요청도 없다 — REQ-DESIGN-010
경로는 SPEC 본문 변경 없이 완전히 진행 가능한 경로다.

## §E.2 Run-phase Evidence

### M0 — 폰트 로딩 선행 작업 (vitest 폰트 로더 모킹 + `next/font/google` 도입)

cycle_type: tdd. 워크트리 복구 경로(A.0)를 탔다 — 초기 `HEAD`가 기대값과 달라
`m0-font-mock` 브랜치를 `9f2a1886f8bd5d313077869096d172cae32a64fa`에서 새로
분기해 작업했다.

**베이스라인 캡처 (E1, AC-DESIGN-012의 SPEC 전체 베이스라인)** — 첫 편집 이전:

```
$ npm test
Test Files  113 passed (113)
     Tests  1493 passed (1493)
  Duration  19.40s
```

**RED 증거 (E8)** — `next/font/google` import를 모킹 없이 `layout.tsx`에
임시로 추가하고 `tests/unit/app/shell.test.tsx`를 실행해 STOREFRONT-001과
동일한 실패 형태를 재현했다:

```
$ npx vitest run tests/unit/app/shell.test.tsx
FAIL  tests/unit/app/shell.test.tsx [ tests/unit/app/shell.test.tsx ]
TypeError: Cormorant_Garamond is not a function
 ❯ src/app/layout.tsx:9:27
 Test Files  1 failed (1)
      Tests  no tests
```

재현 후 `git checkout -- src/app/layout.tsx`로 되돌려 원본 상태를 복원했다.

**모킹 접근 (E2)** — `vitest.config.ts`의 `resolve.alias`로 `next/font/google`을
`tests/mocks/next-font-google.ts` 스텁으로 치환했다. 스텁은 `Cormorant_Garamond`/
`Lora` 각각을 호출 가능한 함수로 제공하며, `className`/`style.fontFamily`/
`variable`을 가진 객체를 반환한다(실제 폰트 로더의 소비 형태만 최소 재현).

모킹만 추가한 상태(실제 import 추가 전)로 셸 테스트를 먼저 확인했다:

```
$ npx vitest run tests/unit/app/shell.test.tsx
 ✓ tests/unit/app/shell.test.tsx (9 tests) 85ms
 Test Files  1 passed (1)
      Tests  9 passed (9)
```

그다음 `src/app/layout.tsx`에 실제 `next/font/google` import를 다시 추가하고
(Cormorant Garamond 400/600 + Lora 400/600, `<html>` 요소에 두 `className`
적용), STOREFRONT-001의 낡은 주석(반전 시도·철회 기록)을 이 SPEC의 결정으로
교체했다(plan.md §B.5 근거 인용, vitest 모킹으로 (b) 실패가 해소됐음을 명시).
GREEN 확인:

```
$ npx vitest run tests/unit/app/shell.test.tsx
 ✓ tests/unit/app/shell.test.tsx (9 tests) 85ms
 Test Files  1 passed (1)
      Tests  9 passed (9)
```

**§B.5 후보 2 폴백은 필요하지 않았다** — 모킹이 첫 시도에 성공했다.

**E3 — 정적 검증**:

```
$ npx tsc --noEmit
(exit 0, no output)

$ npm run lint
> our-shop@0.1.0 lint
> eslint .
(exit 0, no output)
```

**E4 — 전체 회귀** (변경 후, E1 베이스라인과 대조):

```
$ npm test
Test Files  113 passed (113)
     Tests  1493 passed (1493)
  Duration  19.22s
```

베이스라인(113 파일 / 1493 테스트, 전부 통과)과 파일 수·테스트 수·통과 여부가
정확히 일치한다 — 신규 실패 0건, 카운트 변동 0건.

**E5 — 의존성 무변경**:

```
$ git diff --stat -- package.json package-lock.json
(빈 출력)
```

`package.json`/`package-lock.json` 변경 없음 — AC-DESIGN-006 충족.

**E6 — 브랜치/커밋 상태**: 브랜치 `m0-font-mock` (base
`9f2a1886f8bd5d313077869096d172cae32a64fa`). 커밋 후 `git push origin
m0-font-mock` 예정 — 오케스트레이터가 t47에서 머지.

**E0 — 워크트리 케이스**: A.0 경로 B(불일치)를 탔다. 초기 `git rev-parse HEAD`가
기댓값과 달라 `git checkout -b m0-font-mock
9f2a1886f8bd5d313077869096d172cae32a64fa`로 복구했고, SPEC 산출물과
`.moai/design/tokens.json` 존재를 확인한 뒤 `npm install`을 실행했다.

**실제 diff 범위** (scope discipline 준수 확인):

```
$ git status --short
 M src/app/layout.tsx
 M vitest.config.ts
?? tests/mocks/
```

`globals.css`, `src/components/ui/`, 페이지 파일은 전혀 건드리지 않았다 — M0
범위(폰트 import + 주석 교체 + vitest 모킹)와 정확히 일치.

**E7 — 결과**: 블로커 없음, 폴백 미사용. 모킹이 첫 시도에 성공했고 전 구간
GREEN이다.

### M1 — 토큰 + 프리미티브 (기반)

cycle_type: tdd. 워크트리 복구 경로(A.0)를 탔다 — 초기 `HEAD`가 기대값
(`e6bbcb2d775c0276809c365bd778b1ebf48fd9ce`)과 달라 `m1-tokens-primitives`
브랜치를 해당 커밋에서 새로 분기해 작업했다. 분기 직후 `layout.tsx`의
`Cormorant_Garamond` import와 `.moai/specs/SPEC-DESIGN-001/` 산출물 존재를
확인한 뒤 `npm install`을 실행했다.

**E0 — 워크트리 케이스**: A.0 경로 B(불일치)를 탔다. 위 문단 참조.

**RED 증거 (E9)** — 프리미티브 구현 전, `@/components/ui/Button` /
`@/components/ui/FormField`를 import하는 두 테스트 파일을 먼저 작성하고 실행:

```
$ npx vitest run tests/unit/components/ui-button.test.tsx tests/unit/components/ui-form-field.test.tsx
 FAIL  tests/unit/components/ui-button.test.tsx [ tests/unit/components/ui-button.test.tsx ]
Error: Failed to resolve import "@/components/ui/Button" from "tests/unit/components/ui-button.test.tsx". Does the file exist?
 FAIL  tests/unit/components/ui-form-field.test.tsx [ tests/unit/components/ui-form-field.test.tsx ]
Error: Failed to resolve import "@/components/ui/FormField" from "tests/unit/components/ui-form-field.test.tsx". Does the file exist?
 Test Files  2 failed (2)
      Tests  no tests
```

**GREEN** — `src/components/ui/Button.tsx` / `FormField.tsx` 구현 후 (중간에
`toHaveClass` — 이 저장소에 `jest-dom`이 설치되어 있지 않아 `Invalid Chai
property: toHaveClass`로 1차 FAIL, `.className.split(/\s+/)` 토큰 배열
검사로 교체해 해소):

```
$ npx vitest run tests/unit/components/ui-button.test.tsx tests/unit/components/ui-form-field.test.tsx
 ✓ tests/unit/components/ui-form-field.test.tsx (9 tests) 29ms
 ✓ tests/unit/components/ui-button.test.tsx (11 tests) 83ms
 Test Files  2 passed (2)
      Tests  20 passed (20)
```

**설계 결정 — 토큰 값 vs Tailwind 네임스페이스 매핑**: `plan.md` §D.1의
변수명은 대부분 Tailwind v4 `@theme`이 기대하는 네임스페이스(`--color-*`,
`--font-*`, `--radius-*`, `--shadow-*`)와 이미 일치해 별도 리네이밍이
필요 없었다. 유일한 예외는 `--space-*`다 — Tailwind가 인식하는 숫자 스케일
네임스페이스는 `--spacing-*`(단수)이며, `--space-1`..`--space-8`을 그
이름으로 옮기면 `p-4`/`gap-4` 같은 기존 숫자 유틸리티를 사이트 전역에서
재정의해 버린다. `spec.md` §3 "레이아웃 재설계" 절이 화면별 여백 재배치를
명시적으로 범위 밖에 두므로, `--space-*` 이름을 그대로 유지해 Tailwind의
자동 유틸리티 생성을 피하고 `var(--space-N)` 임의값 문법으로만 소비되게
했다(`px-[var(--space-4)]` 등). `globals.css`의 신규 주석 블록에 이 판단과
그 반대의 의도된 부작용(neutral-*·radius-md의 사이트 전역 즉시 재정의)을
모두 명시했다 — 착수 지시가 경고한 대로 "지금 당장은 아니지만 알고 있어야
할" 사실이다.

**설계 결정 — 오류 텍스트 색상**: Classical은 위험/오류 색상 역할이 없는
단일 accent(mono) 체계다(`plan.md` §D.1 note 2). `text-red-600`/`bg-red-600`은
`plan.md` §D.1b에서 "대응 토큰 없음 → 범위 밖"으로 명시되어 있으므로,
`FormField`의 오류 텍스트는 기존 8개 파일이 이미 쓰던 Tailwind 기본
`text-red-600`을 그대로 유지했다 — 새 색상 역할을 발명하지 않는다는 §1.5
원칙과 일치한다.

**설계 결정 — `<a>` 태그 소비자를 위한 `buttonClassName`/`fieldInputClassName`
export**: `CartView.tsx`/`EmptyCart.tsx`/`staff/products/page.tsx`가 버튼
스타일을 `<a href>`에 적용한다는 것을 13개 파일 실측에서 확인했다(§A 상단
survey). `Button`을 `<button>`/`<a>` 다형 컴포넌트로 만드는 대신, 클래스
문자열 빌더 함수를 별도 export해 M2-M4가 필요할 때 직접 `<a
className={buttonClassName({fullWidth: true})}>`로 소비하게 했다 —
Simplicity ladder에 따라 관측되지 않은 다형성 API를 미리 만들지 않았다.

**E1 — AC PASS/FAIL 매트릭스**:

| AC | Given-When-Then 핵심 | 검증 명령/방법 | 결과 |
|---|---|---|---|
| AC-DESIGN-001 | `@theme` 블록 존재 + Classical 값 축자 일치 | `grep -c "@theme" src/app/globals.css` → 1; `grep -oE '#[0-9a-fA-F]{6}\|4\.6px\|...'` plan.md vs globals.css `diff` → 빈 출력(완전 일치) | **PASS** |
| AC-DESIGN-002 | 낡은 "No `@theme` block" 주석 제거 | `grep -c "No \`@theme\` block" src/app/globals.css` → 0 | **PASS** |
| AC-DESIGN-003 | 토큰 원천 명시 + 폰트 로딩 동작 | (a) 신규 주석이 "Classical (plan.md §D.1)"를 원천으로 명시(파일 헤더 3-9행); (b)/(c) M0에서 이미 완료(`next/font/google` + 낡은 주석 교체, progress.md M0 절) | **PASS**(M1은 (a)만 추가 담당, (b)/(c)는 M0 산출물 재확인) |
| AC-DESIGN-004 | 프리미티브 디렉터리 + 구성 | `ls src/components/ui/` → `Button.tsx`, `FormField.tsx` 존재 | **PASS** |
| AC-DESIGN-005(a) | 프리미티브가 토큰 역할만 참조 | `grep -rn "neutral-900\|neutral-300\|#[0-9a-fA-F]{6}" src/components/ui/` → 0건(§E2 검증 블록) | **PASS** |
| AC-DESIGN-005(b) | 포커스 표시가 Classical `:focus-visible`+`outline`+`outline-offset` 규칙을 따름 | 두 프리미티브 단위 테스트가 `focus-visible:outline`/`outline-2`/`outline-offset-2`/`outline-accent` 클래스 존재를 단언(GREEN) | **PASS** |
| AC-DESIGN-005(c) | `ProductCard.tsx:40`의 `focus-visible:ring-*` 제거 | `grep -rn "focus-visible:ring" src/` → `ProductCard.tsx:40` 1건 잔존 | **명시적 DEFERRED — M3 소관**(아래 별도 절 참조, PASS로 잘못 표기하지 않음) |
| AC-DESIGN-006 | 신규 의존성 0건 | `git diff --stat -- package.json package-lock.json` → 빈 출력 | **PASS** |

**E2 — AC-DESIGN-008(c) 정확 3형태 grep** (버튼 프리미티브 최초 실행 시
`Button.tsx`/`FormField.tsx` 자체 JSDoc 주석이 `bg-neutral-900`/
`neutral-300` 문자열을 프로즈로 포함해 false positive가 발생 — 주석을
우회 표현으로 재작성해 해소):

```
$ grep -rnE 'bg-(accent|surface|bg|text|neutral)(-[0-9]{3})?\b|bg-\[var\(--color-|background(-color)?:\s*var\(--color-' src/components/ui/ | grep -v 'bg-transparent'
(빈 출력 — 0건)
```

**E3 — 정적 검증**:

```
$ npx tsc --noEmit
(exit 0, no output)

$ npm run lint
> our-shop@0.1.0 lint
> eslint .
(exit 0, no output)
```

`npm run build`(`next build`)도 별도로 실행해 확인 — 프로덕션 빌드가
Tailwind v4 `@theme` 블록을 오류 없이 컴파일하고 29개 페이지 전부
정적/동적 생성에 성공했다(신규 프리미티브는 아직 어떤 페이지도 import하지
않으므로 번들에는 포함되지 않는다 — M2-M4 소관).

**E4 — 전체 회귀** (M0 베이스라인 113 파일/1493 테스트 대비):

```
$ npm test
 Test Files  115 passed (115)
      Tests  1513 passed (1513)
  Duration  18.86s
```

115 파일 = 113(M0 베이스라인) + 2(신규 `ui-button.test.tsx`/
`ui-form-field.test.tsx`). 1513 테스트 = 1493 + 20(신규 프리미티브 테스트
11+9). 기존 테스트 실패 0건, 신규 실패 0건.

**E5 — 의존성 무변경**: `git diff --stat -- package.json package-lock.json`
→ 빈 출력. AC-DESIGN-006 충족.

**E6 — 토큰 표본 대조** (`src/app/globals.css` `@theme` 블록에서 그대로
발췌):

```css
--color-bg: #f3f2f2;
--color-accent: #b68235;
--color-text: #201f1d;
--space-1: 4.6px; --space-2: 9.2px; --space-3: 13.8px; --space-4: 18.4px; --space-6: 27.6px; --space-8: 36.8px;
--radius-sm: 2px; --radius-md: 4px; --radius-lg: 7px;
--font-heading: "Cormorant Garamond", system-ui, sans-serif;
--font-body: "Lora", system-ui, sans-serif;
```

`plan.md` §D.1 블록과의 축자 일치는 `grep -oE ... | sort -u | diff`로
확인 완료(빈 출력 = 완전 일치, 색상 26개 + 간격 6개 값 전부).

**E7 — 브랜치/푸시 상태**: 브랜치 `m1-tokens-primitives`(base
`e6bbcb2d775c0276809c365bd778b1ebf48fd9ce`). 커밋 후
`git push origin m1-tokens-primitives` 예정 — 오케스트레이터가 t47에서
머지.

**E8 — 블로커**: 없음.

**실제 diff 범위** (scope discipline 준수 확인):

```
$ git status --short
 M src/app/globals.css
?? src/components/ui/
?? tests/unit/components/ui-button.test.tsx
?? tests/unit/components/ui-form-field.test.tsx

$ git diff --name-only -- src/app/staff/
(빈 출력)
```

`src/app/(shop)/`, `src/app/staff/`, `LogoutButton.tsx`, `SiteHeader.tsx`,
`ProductCard.tsx`는 전혀 건드리지 않았다 — M1 범위(globals.css 토큰 +
`src/components/ui/` 신설)와 정확히 일치. M2-M4 위임 대상이다.

**AC-DESIGN-005(c) 명시적 이월 확인**: `ProductCard.tsx:40`의
`focus-visible:ring-2 ring-neutral-900 ring-offset-2` 하드코딩은 이번
M1에서 손대지 않았다(착수 지시가 명시적으로 금지). 저장소 전체
`focus-visible:ring` grep이 여전히 그 1건을 반환하므로 AC-DESIGN-005(c)는
**PASS로 표기하지 않고 M3로 이월**한다(`plan.md` §F M3, §D.4-4 실측
확인 문단). M1이 도입한 `focus-visible:outline` 방식은 `src/components/ui/`
프리미티브에서만 작동 중이며, `ProductCard.tsx`는 M3가 마이그레이션할 때
비로소 이중 포커스 표시 문제 없이 정리된다.

### M2 — `LogoutButton` 구체 결함 수정

cycle_type: tdd. 워크트리 복구 경로(A.0)를 탔다 — 초기 `HEAD`
(`0be83c5f182819fb58599cd9089abe7dc0842f05`)가 기대값
(`0cc391a2f8a50adb5ab789911ba026596ab063fc`)과 달라 `m2-logout-button`
브랜치를 후자에서 새로 분기해 작업했다. 분기 직후
`src/components/ui/Button.tsx`(M1 산출물) 존재를 확인한 뒤 `npm install`을
실행했다.

**E0 — 워크트리 케이스**: A.0 경로 B(불일치)를 탔다. 위 문단 참조.

**사전 확인 (Section C pre-flight)** — 편집 이전:

```
$ npx tsc --noEmit
(exit 0, no output)

$ npm run lint
(exit 0, no output)

$ npm test
Test Files  115 passed (115)
     Tests  1513 passed (1513)
```

M1 베이스라인(115 파일 / 1513 테스트)과 정확히 일치 — 편집 전 상태 확인 완료.

**RED 증거 (E7)** — AC-DESIGN-007이 "렌더 결과에 스타일 클래스가 부여됨을
단위 테스트로 확인"을 명시적으로 요구하므로, `LogoutButton.tsx`를 원본
(bare `<button>`) 상태로 둔 채 `tests/unit/components/logout-button.test.tsx`에
신규 테스트를 먼저 추가하고 실행했다:

```
$ npx vitest run tests/unit/components/logout-button.test.tsx
 ❯ tests/unit/components/logout-button.test.tsx (5 tests | 1 failed)
   × LogoutButton — AC-DESIGN-007 > renders through the shared Button
     primitive, not with browser-default styling
AssertionError: expected 0 to be greater than 0
 ❯ tests/unit/components/logout-button.test.tsx:57:32
Test Files  1 failed (1)
     Tests  1 failed | 4 passed (5)
```

기존 4개(AC-AUTH-041/042/043×2)는 원본 상태에서도 그대로 통과 —
새 실패는 신규 AC-DESIGN-007 단언 1건뿐임을 확인했다.

**GREEN** — `LogoutButton.tsx` 48행 부근의 `<button type="button"
onClick={handleLogout}>`을 `@/components/ui/Button`의 `<Button
type="button" onClick={handleLogout}>`로 교체(import 1줄 추가 + 요소
치환만):

```
$ npx vitest run tests/unit/components/logout-button.test.tsx
 ✓ tests/unit/components/logout-button.test.tsx (5 tests) 139ms
Test Files  1 passed (1)
     Tests  5 passed (5)
```

5개 전부 통과 — 기존 AC-AUTH-041/042/043 단언(요청 형태·refresh/push
호출·비200 무동작) 문구는 손대지 않았고 값도 변경되지 않았다.

**E1 — AC-DESIGN-007 PASS/FAIL**:

Given `src/components/layout/LogoutButton.tsx:48`의 `<button type="button"
onClick={handleLogout}>` — `className` 전무 상태,
When 롤아웃이 끝나면,
Then 해당 버튼이 공유 버튼 프리미티브를 경유해 렌더되며 브라우저 기본
버튼 스타일로 남지 않는다.

관측 증거: `LogoutButton.tsx`가 `import { Button } from
"@/components/ui/Button"`를 통해 프리미티브를 import하고, 렌더 요소가
`<Button>`이다. 단위 테스트가 렌더 결과 `button.className`을 검사해
1개 이상의 클래스 토큰과 `border-accent`(Classical 아웃라인 스타일의
표지 클래스, M1 `buttonClassName`) 존재를 단언하며 GREEN이다.

**결과: PASS.**

| AC | Given-When-Then 핵심 | 검증 명령/방법 | 결과 |
|---|---|---|---|
| AC-DESIGN-007 | `LogoutButton.tsx:48` 버튼이 공유 버튼 프리미티브를 경유해 렌더 | import 확인(`@/components/ui/Button`) + 신규 단위 테스트(className 비어있지 않음 + `border-accent` 포함) RED→GREEN | **PASS** |

**E2 — CSRF 코드 무변경 확인**:

```
$ git diff -- src/components/layout/LogoutButton.tsx
 "use client";

 import { useRouter } from "next/navigation";
+import { Button } from "@/components/ui/Button";

 /** ... (@MX:NOTE 등 CSRF 관련 주석 — 무수정) ... */
 function readCsrfToken() { ... }  // 무수정

 export function LogoutButton() {
   ...
   async function handleLogout() { ... }  // fetch 호출·CSRF 헤더·
                                            // router.refresh() 무수정
   return (
-    <button type="button" onClick={handleLogout}>
+    <Button type="button" onClick={handleLogout}>
       로그아웃
-    </button>
+    </Button>
   );
 }
```

실제 diff는 import 1줄 추가 + `<button>`↔`<Button>` 요소 치환 2줄뿐이다.
`readCsrfToken()`, `handleLogout()`의 fetch 호출·CSRF 헤더·
`router.refresh()`/`router.push()` 로직, `@MX:NOTE`를 포함한 모든 주석은
바이트 단위로 무수정임을 `git diff` 전문으로 확인했다(plan.md §C.3 /
§G 안티패턴 1 준수).

**E3 — 정적 검증** (편집 후):

```
$ npx tsc --noEmit
(exit 0, no output)

$ npm run lint
> our-shop@0.1.0 lint
> eslint .
(exit 0, no output)
```

**E4 — 전체 회귀** (M1 베이스라인 115 파일/1513 테스트 대비):

```
$ npm test
 Test Files  115 passed (115)
      Tests  1514 passed (1514)
  Duration  18.59s
```

115 파일 = M1과 동일(신규 파일 없음, 기존 테스트 파일에 케이스만 추가).
1514 테스트 = 1513(M1 베이스라인) + 1(신규 AC-DESIGN-007 단언). 기존
테스트 실패 0건, 신규 실패 0건. 사전 지시가 명시한
`tests/unit/components/logout-button.test.tsx`(SPEC-AUTH-003 산출)의
기존 4개 단언(AC-AUTH-041/042/043)이 전부 그대로 통과함을 재확인했다.

**E5 — 브랜치/푸시 상태**: 브랜치 `m2-logout-button`(base
`0cc391a2f8a50adb5ab789911ba026596ab063fc`). 커밋 후 `git push origin
m2-logout-button` 예정 — 오케스트레이터가 t47에서 머지.

**E6 — 블로커**: 없음.

**실제 diff 범위** (scope discipline 준수 확인):

```
$ git status --short
 M src/components/layout/LogoutButton.tsx
 M tests/unit/components/logout-button.test.tsx
```

CSRF 유틸(§C.3), `globals.css`, `src/components/ui/`, 다른 페이지·
컴포넌트는 전혀 건드리지 않았다 — M2 범위(`LogoutButton.tsx` 버튼 요소 +
그 검증 테스트 1개)와 정확히 일치.

**E7 — RED 증거 요약**: 위 "RED 증거" 문단 참조. 신규 AC-DESIGN-007
단언 1건이 원본 상태에서 실패(RED) → 프리미티브 교체 후 통과(GREEN)함을
확인했다. 기존 4개 단언은 애초에 통과 상태였고 적응(adaptation) 없이
그대로 유지됐다 — 선택자·값 변경 0건.

### M3 — 고객 화면 9장 + Classical 매핑 2건

cycle_type: tdd. 워크트리 복구 경로(A.0)를 탔다 — 초기 `HEAD`
(`0be83c5f182819fb58599cd9089abe7dc0842f05`)가 기대값
(`35444516e9b4bd62dd136ef6885ada297361363d`, M2 병합 커밋)과 달라
`m3-customer-pages` 브랜치를 후자에서 새로 분기했다. 분기 직후
`src/components/ui/Button.tsx`/`FormField.tsx`(M1 산출물) 존재를 확인한 뒤
`npm install`을 실행했다.

**E0 — 워크트리 케이스**: A.0 경로 B(불일치)를 탔다. 위 문단 참조.

**사전 확인 (Section C pre-flight)** — 편집 이전:

```
$ npx tsc --noEmit
(exit 0, no output)

$ npm run lint
(exit 0, no output)

$ npm test
Test Files  115 passed (115)
     Tests  1514 passed (1514)

$ grep -n "focus-visible:ring" src/components/product/ProductCard.tsx
40:      className="group block overflow-hidden rounded-md border border-neutral-200 transition hover:border-neutral-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
```

M2 베이스라인(115 파일 / 1514 테스트)과 정확히 일치. M1이 이월한
AC-DESIGN-005(c)의 1건 잔존도 재확인했다.

**소비 파일 인벤토리 (편집 전 실측)** — plan.md §F M3 목록과 대조하기 위해
전수 grep을 먼저 실행했다:

```
$ grep -rl "rounded-md bg-neutral-900" src/
(shop)/signup/page.tsx, (shop)/login/page.tsx, staff/products/ProductForm.tsx,
staff/products/page.tsx, staff/login/page.tsx, product/AddToCartButton.tsx,
product/ReviewForm.tsx, checkout/CheckoutForm.tsx, checkout/CheckoutInteractive.tsx,
checkout/PayButton.tsx, cart/CartView.tsx, cart/EmptyCart.tsx,
orders/OrderLookupForm.tsx  → 13개 파일 (spec.md §1.3 실측과 일치)

$ grep -rl "w-full rounded-md border border-neutral-300" src/
(shop)/signup/page.tsx, (shop)/login/page.tsx, staff/products/ProductForm.tsx,
staff/login/page.tsx, product/ReviewForm.tsx, checkout/CheckoutForm.tsx,
checkout/CheckoutInteractive.tsx, orders/OrderLookupForm.tsx  → 8개 파일
```

스태프 3개 파일(`ProductForm.tsx`, `staff/products/page.tsx`,
`staff/login/page.tsx`)은 M4 소관 — 제외. 나머지 10개(버튼)/6개(폼, staff 2개
제외)가 정확히 plan.md §F M3의 동반 컴포넌트 목록과 1:1로 일치함을 확인했다.

**RED 증거 (E11)** — 이 마일스톤은 대부분 기존 테스트 적응(className 교체,
새 동작 없음)이라 신규 테스트는 스타일 단언 2건에 한정했다(`SiteHeader`/
`ProductCard`의 시각 매핑, 착수 지시 E11이 명시적으로 허용한 범위):

```
$ npx vitest run tests/unit/components/product-card.test.tsx
 FAIL — "does not use the hardcoded focus-visible:ring-* utility any more"
   AssertionError: expected 'group block overflow-hidden rounded-m…' not to match /focus-visible:ring/
 FAIL — "uses the Classical outline focus-visible rule and .card token styling"
   AssertionError: expected '...' to match /focus-visible:outline-accent/
 Test Files  1 failed (1)
      Tests  2 failed | 9 passed (11)

$ npx vitest run tests/unit/components/site-header.test.tsx
 FAIL — "applies Classical nav container styling (surface background, divider hairline)"
   AssertionError: expected '' to match /bg-surface/
 Test Files  1 failed (1)
      Tests  1 failed | 3 passed (4)
```

**GREEN** — 아래 구현 후 재실행:

```
$ npx vitest run tests/unit/components/product-card.test.tsx tests/unit/components/site-header.test.tsx
 ✓ tests/unit/components/site-header.test.tsx (4 tests)
 ✓ tests/unit/components/product-card.test.tsx (11 tests)
 Test Files  2 passed (2)
      Tests  15 passed (15)
```

**구현 내역**:

- `(shop)/login/page.tsx`, `(shop)/signup/page.tsx` — 이메일/비밀번호
  `<input>` 2개를 `FormField`로, 제출 `<button>`을 `<Button fullWidth>`로
  교체. `formError` 단락은 필드 종속 오류가 아니므로(전체 폼 오류) 그대로
  유지.
- `cart/CartView.tsx`, `cart/EmptyCart.tsx` — "결제하기"/"상품 목록으로
  이동" `<a>` CTA 링크를 `buttonClassName({ className: "mt-6" })`으로 교체.
  수량 스테퍼(+/−)와 삭제 링크는 13개 파일 수렴 문자열과 무관한
  보조(secondary) 컨트롤이라 plan.md §D.3의 "중간 신뢰도, run-phase 개별
  판단" 대상으로 남기고 손대지 않았다(§D.2 레이아웃 예외와 동일 논리).
- `checkout/CheckoutForm.tsx` — `FIELDS.map`의 라벨+입력+오류 블록 전체를
  `FormField`로 교체(요소당 3줄이던 것이 `FormField` 1개 호출로 축약).
  제출 버튼을 `<Button fullWidth>`로 교체.
- `checkout/CheckoutInteractive.tsx` — 쿠폰 입력(근접 변형,
  `CheckoutInteractive.tsx:138`)을 `<FormField>` 컴포넌트가 아니라 그
  익스포트된 빌더 `fieldInputClassName()`/`fieldLabelClassName()`으로
  직접 교체했다 — 입력이 "적용" 버튼과 같은 줄(flex row)에 나란히 있어
  `FormField`의 라벨-위/입력-아래 세로 레이아웃과 맞지 않기 때문
  (`buttonClassName`이 `<a>` 소비자를 위해 별도 export된 것과 동일한
  이유, M1 선례). 근접 변형의 "선행 mt-1 없음" 차이는 감싸는 `<div>`의
  `mt-1`을 제거하는 방식으로 흡수했다 — `fieldInputClassName()`이 이미
  자신의 `mt-[var(--space-1)]`를 내장하므로 중복 마진이 생기지 않는다
  (plan.md §1.3 "여백 prop으로 흡수"). "적용" 버튼은
  `buttonClassName({ className: "shrink-0" })`.
- `checkout/PayButton.tsx` — `<button>`을 `<Button fullWidth>`로 교체.
- `orders/OrderLookupForm.tsx` — 주문번호/연락처 `<input>` 2개를
  `FormField`로, 제출 버튼을 `<Button fullWidth>`로 교체.
- `product/AddToCartButton.tsx` — "장바구니에 담기" `<button>`을 `<Button>`
  으로 교체. 수량 `<input type="number">`는 13/8개 파일 수렴 문자열
  어디에도 없는 별도 폭(`w-20`, 실측 grep에서 미검출)이라 `<FormField>`
  컴포넌트로 감싸지 않고, `fieldInputClassName({ className: "!w-20" })`으로
  토큰 참조는 확보하되 폭은 Tailwind `!important` 수식자로 오버라이드했다
  (AC-DESIGN-010의 "모든 폼 필드가 프리미티브를 경유" 요건을 좁은 폭이라는
  이유로 예외 처리하지 않기 위함).
- `product/ReviewForm.tsx` — "리뷰 내용" `<textarea>`(정확히 8개 파일
  수렴에 포함)를 `<FormField multiline>`으로 교체. "평점" `<select>`는
  `<input>`/`<textarea>`만 다루는 `FormField`의 판별 유니언 밖이라 동일하게
  `fieldInputClassName({ className: "!w-auto" })` 직접 소비 패턴을 썼다.
  제출 버튼을 `<Button>`으로 교체.
- `layout/SiteHeader.tsx` (plan.md §C.4/§D.3, `.nav`/`.nav-brand`
  매핑) — **시각 스타일만** 변경: `bg-surface` + `border-divider`(헤어라인)
  + 토큰 패딩 + `font-body`/`text-text`를 `<header>`에 적용, 로그인 링크에
  `text-accent`. 렌더 구조·조건분기·자식 컴포넌트는 원문 그대로(AC-AUTH-049
  무영향 — 이 파일은 여전히 `(shop)/layout.tsx`에서만 렌더된다). 원래 두
  분기(guest/logged-in)에 감싸는 `<div>`를 새로 추가하지 않고 개별 요소에
  마진만 적용해 DOM 노드 수를 그대로 유지했다.
- `product/ProductCard.tsx` (plan.md §D.3/§D.4-4, `.card` 매핑 + 포커스
  링 교체) — 카드 `<a>`의 `border-neutral-200`/`hover:border-neutral-400`
  을 `border-divider`/`hover:border-accent`로, `bg-surface` +
  `shadow-sm`(whisper elevation)을 추가. 하드코딩된
  `focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900
  focus-visible:ring-offset-2`를 M1 프리미티브와 동일한
  `focus-visible:outline focus-visible:outline-2
  focus-visible:outline-offset-2 focus-visible:outline-accent`로 교체
  (M1이 도입한 규약의 재사용, 새 규약 발명 없음). 상품명에
  `text-neutral-900` → `text-text`(`.card-title`), 가격은 기존
  `text-neutral-700` 유지(`.card-meta`, 이미 @theme 오버라이드로 Classical
  값을 상속하는 literal이라 변경 불요).

**cascade follow-up — `src/app/layout.tsx` body 배경 토큰** (M3 파일
목록 밖, plan.md §D.1b 근거): AC-DESIGN-010은 "15개 페이지 전부가
Classical 배경(`--color-bg`)을 상속"을 요구하며, 그 상속 지점은
`layout.tsx` 단일 지점이라고 명시한다(acceptance.md AC-DESIGN-010 검증
절). 그런데 실측 결과 `layout.tsx`의 `<body>`가 여전히
`bg-white text-neutral-900`였다 — `text-neutral-900`은 M1의 `@theme`
오버라이드로 이미 Classical 값을 상속하지만(`--color-neutral-900`이
Classical의 따뜻한 어두운 색으로 재정의됨), `bg-white`는 Classical
토큰에 전혀 대응되지 않는 리터럴이라(plan.md §D.1b가 명시적으로
"흰 배경 → `var(--color-bg)`"를 값 교체 항목으로 열거) 이 SPEC의 어떤
마일스톤도 이 한 줄을 소유하지 않은 채 남아 있었다. 착수 지시의 M3 파일
목록에는 `layout.tsx`가 없지만, AC-DESIGN-010 — 바로 이 마일스톤이
책임지는 인수 기준 — 이 이 수정에 의존하므로, `.claude/agents/moai/`의
"SPEC 범위 내 cascade follow-up"(L46 귀속) 조항에 따라 `bg-white
text-neutral-900` → `bg-bg text-text`로 교체했다. 한 줄, 저위험, 이미
`plan.md §D.1b`에 명시된 값 매핑을 그대로 적용한 것이며, `shell.test.tsx`가
`<body>`의 리터럴 className을 단언하지 않음을 사전 확인했다. 변경 후 관련
테스트(`shell.test.tsx` 9건) 재실행해 GREEN 확인.

**기존 테스트 적응 (test-after 아님 — 동작 재검증)**: M1 이전
`SPEC-STOREFRONT-002 M5`가 작성한
`tests/unit/components/pay-button.test.tsx`의 한 단언이 `PayButton.tsx`
소스에 리터럴 `"px-4 py-2"` 문자열이 존재함을 검사했다. 이 SPEC이 그
패딩을 `src/components/ui/Button.tsx`의 단일 정의처로 이전했으므로(
`px-[var(--space-4)] py-[var(--space-2)]`) 그 리터럴이 더 이상
`PayButton.tsx` 자체에 없다 — RED로 확인 후, 단언을 "여전히 py-3가 아님
+ 이제 공유 Button 프리미티브를 import함"으로 교체했다(SPEC-DESIGN-001
§1.1이 명시적으로 반전하는 바로 그 이전 결정이므로 SPEC 요구사항에 의한
적응이며, 임의 삭제가 아니다). 근본 단언(일관된 패딩)은 유지되고, 검증
방식만 "리터럴 문자열 grep"에서 "단일 정의처 import 확인"으로 바뀌었다.

**E1 — AC PASS/FAIL 매트릭스**:

| AC | Given-When-Then 핵심 | 검증 명령/방법 | 결과 |
|---|---|---|---|
| AC-DESIGN-005(a) | 프리미티브가 토큰 역할만 참조(M3 신규 소비 지점 포함) | `grep -rn "neutral-900\|neutral-300\|#[0-9a-fA-F]{6}" src/components/ui/` → 0건(M1 이후 무변경) | **PASS** |
| AC-DESIGN-005(b) | 포커스 표시가 Classical `:focus-visible`+`outline`+`outline-offset` | `ProductCard.tsx` 신규 단위 테스트가 `focus-visible:outline-accent` 클래스 존재를 단언(GREEN) | **PASS** |
| AC-DESIGN-005(c) | `ProductCard.tsx:40`의 `ring-*` 방식 하드코딩 제거 | `grep -rn "focus-visible:ring" src/` → 0건(repo 전체, M1이 이월했던 유일 잔존 건 해소) | **PASS** (M1 DEFERRED → 이번 M3에서 해소) |
| AC-DESIGN-006 | 신규 의존성 0건 | `git diff --stat -- package.json package-lock.json` → 빈 출력 | **PASS** |
| AC-DESIGN-008(a) | 버튼 복제 문자열이 `src/components/ui/` 밖에 0건 | `grep -rl "rounded-md bg-neutral-900" src/ \| grep -v "src/components/ui/"` → staff 3개 파일만(M4 소관, M3 무관) | **PASS**(M3 소관 10개 파일 전부 소거 확인) |
| AC-DESIGN-008(b) | 버튼 프리미티브가 Classical 아웃라인 렌더 | M1 `ui-button.test.tsx`(11건, 무변경)가 이미 단언 + M3는 그 프리미티브를 10개 파일에서 소비 | **PASS** |
| AC-DESIGN-008(c) | accent 색 솔리드 채움 버튼 0건(3형태 전수) | 3형태 grep을 `src/` 전체에 재실행 → `bg-accent`/`bg-[var(--color-accent...)]` 형태 실사용 0건(주석 1건 제외); `bg-surface`/`bg-bg`/`bg-neutral-*` 형태 히트는 전부 비버튼(페이지 배경·nav surface·card surface·상태 배너·이미지 placeholder) — 아래 E5 참조 | **PASS** |
| AC-DESIGN-009 | 폼 필드 복제 문자열이 `src/components/ui/` 밖에 0건 | `grep -rl "w-full rounded-md border border-neutral-300" src/ \| grep -v "src/components/ui/"` → staff 2개 파일만(M4 소관) | **PASS**(M3 소관 6개 파일 전부 소거 확인) |
| AC-DESIGN-010 | 9개 고객 페이지 전수 커버 | 아래 페이지별 표 | **PASS**(9/9, N/A 명시 3건) |

**AC-DESIGN-010 페이지별 확인**:

| # | 페이지 | 기본 액션 버튼 | 폼 필드 | 판정 |
|---|---|---|---|---|
| 1 | `(shop)/page.tsx` (홈) | 없음(ProductGrid→ProductCard, 링크 카드) | 없음 | **N/A** (버튼/폼 없음, layout.tsx 상속으로 배경/타이포 충족) |
| 2 | `products/[productId]/page.tsx` | `AddToCartButton`(하위 컴포넌트, PASS) | `ReviewForm`의 평점 select + 리뷰 내용(하위 컴포넌트, PASS) | **PASS**(하위 컴포넌트 경유) |
| 3 | `cart/page.tsx` | `CartView`의 "결제하기" 또는 `EmptyCart`의 "상품 목록으로 이동"(하위 컴포넌트, PASS) | 없음 | **PASS**(버튼만, 폼 N/A) |
| 4 | `checkout/page.tsx` | `CheckoutInteractive`의 쿠폰 "적용" + `CheckoutForm`의 "주문하기"(하위 컴포넌트, PASS) | `CheckoutForm`의 배송 정보 5필드 + 쿠폰 입력(하위 컴포넌트, PASS) | **PASS** |
| 5 | `checkout/complete/[orderId]/page.tsx` | `PayButton`(pending_payment일 때만, 하위 컴포넌트, PASS) | 없음 | **PASS**(버튼만, 조건부 렌더는 REQ-DESIGN-007 무변경 확인 완료) |
| 6 | `login/page.tsx` | "로그인" 제출 버튼(직접 마이그레이션, PASS) | 이메일/비밀번호 2필드(직접 마이그레이션, PASS) | **PASS** |
| 7 | `signup/page.tsx` | "회원가입" 제출 버튼(직접 마이그레이션, PASS) | 이메일/비밀번호 2필드(직접 마이그레이션, PASS) | **PASS** |
| 8 | `orders/lookup/page.tsx` | `OrderLookupForm`의 "주문 조회"(하위 컴포넌트, PASS) | `OrderLookupForm`의 주문번호/연락처 2필드(하위 컴포넌트, PASS) | **PASS** |
| 9 | `orders/lookup/[orderNumber]/page.tsx` | 없음(`OrderLookupResultView`는 버튼/폼/링크 요소 0건, grep 확인) | 없음 | **N/A** (버튼/폼 없음, 쿠키 매치 시 즉시 결과 렌더) |

9/9 페이지 전부 확인. 3건(#1, #9 전체 + #3의 폼)이 명시적 N/A이며,
누락과 구분해 기록했다(acceptance.md AC-DESIGN-010의 요구사항).

**E2 — AC-DESIGN-008(a) grep**:
```
$ grep -rl "rounded-md bg-neutral-900" src/ | grep -v "src/components/ui/"
src/app/staff/products/ProductForm.tsx
src/app/staff/products/page.tsx
src/app/staff/login/page.tsx
```
(스태프 3개 — M4 소관, M3 무관. M3 대상 10개 파일 전부 소거 확인)

**E3 — AC-DESIGN-009 grep**:
```
$ grep -rl "w-full rounded-md border border-neutral-300" src/ | grep -v "src/components/ui/"
src/app/staff/products/ProductForm.tsx
src/app/staff/login/page.tsx
```
(스태프 2개 — M4 소관, M3 무관. M3 대상 6개 파일 전부 소거 확인)

**E4 — AC-DESIGN-005(c) grep**:
```
$ grep -rn "focus-visible:ring" src/
(빈 출력 — 0건, repo 전체. 착수 전 1건 → 0건)
```

**E5 — AC-DESIGN-008(c) 3형태 grep, `src/` 전체**:
```
$ grep -rnE 'bg-(accent|surface|bg|text|neutral)(-[0-9]{3})?\b|bg-\[var\(--color-|background(-color)?:\s*var\(--color-' src/ | grep -v 'bg-transparent'
```
19건 히트, 검토 결과:
- `bg-accent`/`bg-[var(--color-accent...)]` 실사용: **0건**(정밀 재검색으로
  재확인 — accent 전용 패턴만 별도 grep, 히트는 globals.css의 주석 1건뿐)
- `layout.tsx`(`bg-bg`, cascade), `SiteHeader.tsx`(`bg-surface`, nav
  컨테이너), `ProductCard.tsx`(`bg-surface`, 카드 컨테이너) — 모두 M3가
  이번에 도입한 것이며 전부 **비-accent** 배경(페이지 캔버스/nav
  표면/card 표면 역할). Classical readme 제약은 "버튼·카드를 **accent**
  색으로 솔리드 채움 금지"이지 "배경을 아예 쓰지 말라"가 아니다 — `.card`가
  `--color-surface`를 배경으로 갖는 것은 §D.4-1의 정상 범위다.
- 나머지 히트(staff 파일 3건, `ProductGallery.tsx`, `OrderLookupResultView.tsx`
  등)는 M3 미소관 파일이거나 M3 편집 이전부터 있던 `bg-neutral-100`
  placeholder/상태-배너 배경(비버튼) — 판단 근거는 위 §D.2/§D.4 텍스트.
- **버튼/Button-프리미티브 인접 요소에 accent 솔리드 채움 0건** 확인.

**E6 — tsc/lint**:
```
$ npx tsc --noEmit
(exit 0, no output)

$ npm run lint
> our-shop@0.1.0 lint
> eslint .
(exit 0, no output)
```

**E7 — 전체 회귀** (M2 베이스라인 115 파일/1514 테스트 대비):
```
$ npm test
 Test Files  115 passed (115)
      Tests  1517 passed (1517)
  Duration  17.78s
```
115 파일 = M2와 동일(신규 테스트 파일 없음, 기존 2개 파일에 케이스 추가).
1517 테스트 = 1514(M2 베이스라인) + 3(신규: `ProductCard` 2건 +
`SiteHeader` 1건). 기존 테스트 실패 0건, 신규 실패 0건.
`pay-button.test.tsx`의 1건은 교체(적응)이지 삭제가 아니므로 카운트에
포함된 채 유지된다(7건 그대로).

**E8 — 스태프 무변경**:
```
$ git diff --stat -- src/app/staff/
(빈 출력)
```

**E9 — 브랜치/푸시 상태**: 브랜치 `m3-customer-pages`(base
`35444516e9b4bd62dd136ef6885ada297361363d`, M2 병합 커밋). 커밋 후
`git push origin m3-customer-pages` 예정 — 오케스트레이터가 t47에서 머지.

**E10 — 블로커**: 없음. 판단이 필요했던 지점(cascade follow-up 1건,
CheckoutInteractive/AddToCartButton/ReviewForm의 비-`<FormField>` 직접
소비 패턴 3건)은 전부 plan.md §D.1b/§1.3의 명시적 근거를 인용해 위
"구현 내역"/"cascade follow-up" 절에 투명하게 기록했다.

**실제 diff 범위** (scope discipline 준수 확인):
```
$ git status --short
 M src/app/(shop)/login/page.tsx
 M src/app/(shop)/signup/page.tsx
 M src/app/layout.tsx
 M src/components/cart/CartView.tsx
 M src/components/cart/EmptyCart.tsx
 M src/components/checkout/CheckoutForm.tsx
 M src/components/checkout/CheckoutInteractive.tsx
 M src/components/checkout/PayButton.tsx
 M src/components/layout/SiteHeader.tsx
 M src/components/orders/OrderLookupForm.tsx
 M src/components/product/AddToCartButton.tsx
 M src/components/product/ProductCard.tsx
 M src/components/product/ReviewForm.tsx
 M tests/unit/components/pay-button.test.tsx
 M tests/unit/components/product-card.test.tsx
 M tests/unit/components/site-header.test.tsx
```
16개 파일 — 착수 지시 Section D의 9페이지 중 2개(login/signup, 직접
버튼/폼 보유) + 8개 동반 컴포넌트 전부 + SiteHeader/ProductCard 2개 +
cascade 1개(`layout.tsx`, 위 근거) + 테스트 3개(신규 단언 2 + 적응 1).
`src/app/staff/`, `LogoutButton.tsx`는 무변경.

MX 태그: `Button.tsx`/`FormField.tsx`의 fan-in 실측 재확인 —
`grep -rl 'from "@/components/ui/Button"' src/` → 11개 파일(M2 1개 +
M3 10개), `FormField` → 7개 파일(M3 전부). plan.md §H가 M5에서 확정하기로
한 항목이므로 이번 마일스톤에서 프리미티브 자체의 `@MX:ANCHOR` 주석은
수정하지 않았다(M1 원문 유지).

### M4 — 스태프 화면 3장(실제 대상 보유) + `ProductForm.tsx`

cycle_type: tdd. 워크트리 복구 경로(A.0)를 탔다 — 초기 `HEAD`
(`0be83c5f182819fb58599cd9089abe7dc0842f05`)가 기대값
(`bc5a2ab007445b6105fe92a202f2696f690423f9`, M3 병합 커밋)과 달라
`m4-staff-pages` 브랜치를 후자에서 새로 분기했다. 분기 직후
`src/components/ui/Button.tsx`/`FormField.tsx` 존재를 확인한 뒤
`npm install`을 실행했다.

**E1 — 워크트리 케이스**: A.0 경로 B(불일치)를 탔다. 위 문단 참조.

**사전 확인 (Section C pre-flight)** — 편집 이전:

```
$ npx tsc --noEmit
(exit 0, no output)

$ npm run lint
(exit 0, no output)

$ npm test
 Test Files  115 passed (115)
      Tests  1517 passed (1517)

$ grep -n "rounded-md bg-neutral-900\|w-full rounded-md border border-neutral-300" src/app/staff/products/page.tsx src/app/staff/products/ProductForm.tsx src/app/staff/login/page.tsx
src/app/staff/products/page.tsx:137:          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
src/app/staff/products/ProductForm.tsx:206,220,243,260,287: (5건, w-full rounded-md border border-neutral-300)
src/app/staff/products/ProductForm.tsx:341:          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
src/app/staff/login/page.tsx:86,101: (2건, w-full rounded-md border border-neutral-300)
src/app/staff/login/page.tsx:114:        className="w-full rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
```

M3 베이스라인(115 파일/1517 테스트)과 정확히 일치. plan.md §C.2 표의
"버튼 1 + 폼 입력 2(login) / 버튼 1(products) / 버튼 1 + 폼 입력 5(ProductForm)"과
grep 실측이 1:1로 일치함을 편집 전 확인했다.

**E2 — 허용 목록 4-7번(0건 대상) 독립 확인** — 표를 그대로 신뢰하지 않고
직접 grep으로 재확인했다(verification-claim-integrity 원칙):

```
$ grep -nE "rounded-md bg-neutral-900|w-full rounded-md border border-neutral-300|<button|<input|<textarea" src/app/staff/products/new/page.tsx
(빈 출력 — 0건)

$ grep -nE "rounded-md bg-neutral-900|w-full rounded-md border border-neutral-300|<button|<input|<textarea" "src/app/staff/products/[productId]/page.tsx"
(빈 출력 — 0건)

$ grep -nE "rounded-md bg-neutral-900|w-full rounded-md border border-neutral-300|<button|<input|<textarea" src/app/staff/orders/page.tsx
(빈 출력 — 0건)

$ grep -nE "rounded-md bg-neutral-900|w-full rounded-md border border-neutral-300|<button|<input|<textarea" "src/app/staff/orders/[orderId]/page.tsx"
(빈 출력 — 0건)
```

4개 파일 전부 확인. 추가로 `<a>`/`className=` 전수 확인 결과, 4/5번은
"상품 목록으로 돌아가기" 순수 텍스트 링크(버튼 스타일 없음)만 갖고, 6번은
상태 필터/페이지네이션 텍스트 링크만, 7번은 `CancelOrderButton`(위험 변형,
명시적 범위 밖)만 렌더한다. 표의 "0건" 판정이 실측과 일치함을 확인 —
**미변경으로 남긴 4개 파일은 정상 결과다.**

**M3 대비 테스트 전략 차이**: 이 마일스톤이 건드리는 3개 파일의 기존 테스트
(`staff-login-page.test.tsx`, `staff-products-page.test.tsx`,
`staff-product-form.test.tsx`, `accessibility.test.tsx`)를 전수 확인한 결과
className 리터럴을 단언하는 테스트가 **0건**이었다(M3의 `pay-button.test.tsx`와
달리 적응이 필요한 테스트가 없음). 대신 `staff-product-form.test.tsx`가
필드별 오류에 `role="alert"`를 요구하는 테스트 4건
(`getAllByRole("alert").length`)을 갖고 있어, `FormField`의 내장 `error` prop
(내부적으로 `role="alert"` 없는 `<p>`를 렌더함, `FormField.tsx:98-102`)을 그대로
쓰면 이 테스트들이 깨진다는 것을 편집 전에 파악했다. 그래서 `ProductForm.tsx`는
`FormField`에 `error` prop을 넘기지 않고 기존 `fieldError()` 헬퍼(`role="alert"`
포함)를 형제 요소로 유지하는 방식을 택했다 — 순수 스타일 교체이며 동작 변경이
아니다(§G 안티패턴 위반 아님, `aria-describedby`는 `FormField`의 rest-prop
오버라이드 경로로 그대로 전달).

**`<select>` 처리**: `categoryId` 필드는 `<select>`라 `FormField`의
input/textarea 판별 범위 밖이다. `ReviewForm.tsx`의 평점 `<select>`가 세운
선례(`fieldInputClassName()`/`fieldLabelClassName()` 직접 적용)를 그대로
따랐다.

**RED 증거**: 이 마일스톤은 순수 스타일 교체이며 신규 동작이 없다 — M3의
login/signup 페이지(직접 마이그레이션) 선례와 동일하게, 기존 동작 테스트가
안전망이고 grep(E3/E4)이 AC 검증 메커니즘이다. `Button`/`FormField` 프리미티브
자체는 M1에서 이미 RED-GREEN을 거쳐 테스트됐다(`ui-button.test.tsx`,
`ui-form-field.test.tsx`, 편집 없이 그대로 재사용). 신규 테스트 파일/케이스는
추가하지 않았다 — M3가 login/signup에 대해 취한 것과 동일한 판단이다.

**구현 내역**:

1. `src/app/staff/login/page.tsx` — 이메일/비밀번호 `<FormField>` 2개, 제출
   `<Button fullWidth>` 1개. `(shop)/login/page.tsx`(M3)와 구조적으로 동일한
   교체(성공 리다이렉트 대상만 다름, 원래부터 그랬음).
2. `src/app/staff/products/page.tsx` — "새 상품 등록" 링크형 버튼을
   `buttonClassName()`으로 교체(`CartView.tsx`/`EmptyCart.tsx`의 `<a>`-as-button
   선례 재사용). **범위 밖으로 남긴 것**: "검색" `<button>`(기존에 이미
   `border-neutral-300` 아웃라인 스타일이라 `bg-neutral-900` 수렴 대상이
   아님 — grep 미매치, plan.md 표의 "버튼 1"에 포함되지 않음).
3. `src/app/staff/products/ProductForm.tsx` — `name`/`price`/`description`
   3개 필드를 `<FormField>`로, `categoryId` `<select>`를
   `fieldInputClassName()`/`fieldLabelClassName()`으로, `stock` 필드를
   `<FormField>`(기존 `stock-hint` id 병합 유지)로, 저장 `<button>`을
   `<Button>`으로 교체. **범위 밖으로 남긴 것**: 이미지 URL 추가/제거
   버튼(기존 아웃라인 스타일, `bg-neutral-900` 미매치), 판매 중단/재개
   토글(`bg-red-600`/`bg-green-700` 위험·상태 변형, spec.md §3 범위 밖).
   CSRF 파싱(`readCsrfToken`)·제출 로직·주석 전부 무수정(§C.3/§G 안티패턴 1).

**E3 — AC-DESIGN-008(a) grep, repo-wide**:
```
$ grep -rl "rounded-md bg-neutral-900" src/ | grep -v "src/components/ui/"
(빈 출력 — 0건, repo 전체. M3 시점 스태프 3건 잔존 → 이번 마일스톤에서 전부 소거)
```

**E4 — AC-DESIGN-009 grep, repo-wide**:
```
$ grep -rl "w-full rounded-md border border-neutral-300" src/ | grep -v "src/components/ui/"
(빈 출력 — 0건, repo 전체. M3 시점 스태프 2건 잔존 → 이번 마일스톤에서 전부 소거)
```

**AC-DESIGN-008/009는 이제 스태프 예외 없이 완전히, repo-wide로 PASS다** —
M3가 명시적으로 남겨 둔 이연(deferral)이 이 마일스톤에서 정확히 닫혔다.

**E5 — AC-DESIGN-015 (부분집합 검사, 정확 일치 아님)**:
```
$ git diff --name-only -- src/app/staff/
src/app/staff/login/page.tsx
src/app/staff/products/ProductForm.tsx
src/app/staff/products/page.tsx
```
3개 전부 §C.2 허용 목록(7개)의 "수정 예상(예)" 3개와 정확히 일치. 목록 밖
파일 0건. 4-7번(수정 예상 없음)은 실제로 미변경 — E2에서 독립 재확인한 대로
정상 결과다.

**E6 — tsc/lint**:
```
$ npx tsc --noEmit
(exit 0, no output)

$ npm run lint
> our-shop@0.1.0 lint
> eslint .
(exit 0, no output)
```

**E7 — 전체 회귀** (M3 베이스라인 115 파일/1517 테스트 대비):
```
$ npm test
 Test Files  115 passed (115)
      Tests  1517 passed (1517)
  Duration  17.92s
```
115 파일 = M3와 완전히 동일(신규 테스트 파일 0건). 1517 테스트 = M3와 완전히
동일(신규/삭제/적응 테스트 0건 — className 단언 테스트가 애초에 없었으므로
적응할 대상이 없었다). 기존 테스트 실패 0건, 신규 실패 0건. 대상 4개 테스트
파일(`staff-login-page`/`staff-products-page`/`staff-product-form`/
`accessibility`, 총 67개 테스트) 단독 재실행으로도 전부 통과 확인.

**E8 — `CancelOrderButton.tsx` 무변경**:
```
$ git diff --stat -- src/app/staff/orders/\[orderId\]/CancelOrderButton.tsx
(빈 출력)
```

**E9 — 브랜치/푸시 상태**: 브랜치 `m4-staff-pages`(base
`bc5a2ab007445b6105fe92a202f2696f690423f9`, M3 병합 커밋). 커밋 후
`git push origin m4-staff-pages` 예정 — 오케스트레이터가 병합.

**E10 — 블로커**: 없음. 판단이 필요했던 지점 2건 — (a) `ProductForm.tsx`
필드 오류의 `role="alert"` 보존을 위해 `FormField`의 `error` prop을 쓰지
않고 기존 `fieldError()`를 유지한 결정, (b) "검색"/이미지 추가·제거/판매
중단·재개 버튼을 범위 밖으로 판단한 근거 — 둘 다 위 "구현 내역"/"M3 대비
테스트 전략 차이" 절에 투명하게 기록했다.

**실제 diff 범위** (scope discipline 준수 확인):
```
$ git status --short
 M src/app/staff/login/page.tsx
 M src/app/staff/products/ProductForm.tsx
 M src/app/staff/products/page.tsx
```
3개 파일 — 착수 지시 Section D가 지목한 정확히 그 3개(실제 대상을 가진
파일). 테스트 파일 0건(적응 불필요), `package.json` 무변경(신규 의존성
0건), `src/app/staff/products/new/page.tsx`·
`src/app/staff/products/[productId]/page.tsx`·`src/app/staff/orders/page.tsx`·
`src/app/staff/orders/[orderId]/page.tsx`·`CancelOrderButton.tsx` 전부
무변경.

MX 태그: `Button`/`FormField` fan-in 재실측 —
`grep -rl 'from "@/components/ui/Button"' src/` → 14개 파일(M2 1 + M3 10 +
M4 3), `grep -rl 'from "@/components/ui/FormField"' src/` → 9개 파일(M3 7 +
M4 2 — `staff/products/page.tsx`는 `Button`만 소비, `FormField` 아님).
plan.md §H가 M5에서 최종 확정하기로 한 항목이므로 이번 마일스톤에서도
프리미티브 자체의 `@MX:ANCHOR` 주석은 수정하지 않았다.

## §E.3 Run-phase Audit-Ready Signal

```yaml
run_milestone: M4
next_milestone: M5
run_status: in-progress
m0_status: complete
m0_fallback_taken: false
m1_status: complete
m2_status: complete
m3_status: complete
m4_status: complete
ac_design_007_status: PASS
ac_design_005c_status: PASS (resolved in M3, was deferred-from-M1)
ac_design_008_status: PASS (a/b/c all verified against full src/ tree, repo-wide, no staff exceptions remaining as of M4)
ac_design_009_status: PASS (repo-wide, no staff exceptions remaining as of M4)
ac_design_010_status: PASS (9/9 customer pages, 3 explicit N/A — unchanged from M3, M4 is staff-side)
ac_design_015_status: PASS (staff diff is exact subset of plan.md §C.2's 3 expected-to-change files; 4 zero-target files independently re-verified untouched)
ac_design_012_baseline: "113 files / 1493 tests passed (npm test, pre-M0-edit)"
ac_design_012_post_change: "115 files / 1517 tests passed (npm test, post-M4-edit) — 0 regressions, 0 new/removed/adapted test files or cases (no className-literal assertions existed in the 3 touched files' test suites, so no adaptation was needed, unlike M3's pay-button.test.tsx)"
new_warnings_or_lints_introduced: 0
package_json_diff: empty
cross_platform_build: not re-run this milestone (no platform-sensitive change; M1's npm run build pass still holds for the primitive layer)
cascade_follow_up: none this milestone
m1_to_mN_commit_strategy: single feature branch per milestone (m4-staff-pages), orchestrator merges per milestone
```

## §E.4 Sync-phase Audit-Ready Signal

_<pending sync-phase>_
