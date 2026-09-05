---
id: SPEC-AUTH-004
status: in-progress
updated: 2026-09-05
tier: M
---

# Progress: SPEC-AUTH-004 — staff 화면 고객 헤더 제거 + (shop) 라우트 그룹 분리

## §E.0 Phase 1 (Explore 정찰) SKIP Rationale

**plan-phase의 별도 Explore 정찰을 실행하지 않았다 — 이미 실행되었기 때문이다.**

착수 직전 오케스트레이터가 `Explore`(읽기 전용) 정찰을 완료했고 그 결과가 위임 프롬프트에 요약되어 전달됐다. **다만 그 요약을 받아쓰지 않았다.** 이 SPEC에서는 요약을 신뢰하지 않을 구체적 이유가 있었다 — 정찰이 전달한 증상 서술 자체가 틀렸을 가능성이 위임 프롬프트에서 이미 한 차례 지적됐기 때문이다. 따라서 핵심 주장을 전부 소스 직접 읽기로 재검증했고, 그 과정에서 **두 개의 잘못된 전제**를 발견해 정정했다.

중복 정찰을 생략한 것이지 검증을 생략한 것이 아니다.

---

## §E.1 Plan-phase Audit-Ready Signal

### Claim (주장)

SPEC-AUTH-004의 plan-phase 산출물 5종(spec.md, plan.md, acceptance.md, spec-compact.md, progress.md)이 작성 완료됐고, 결함 분석·설계 메커니즘·변경 범위가 전부 기계적으로 검증된 사실 위에 서 있다. 미해결 명료화 항목 0건.

### Evidence (증거)

**직접 소스 읽기로 확인한 결함 사실 (전부 재검증, 요약 인용 아님)**

| 확인 항목 | 명령/근거 | 관측 결과 |
|---|---|---|
| 루트 레이아웃 무조건 헤더 렌더 | `cat -n src/app/layout.tsx` | `:51` `<SiteHeader />` — 조건 없음 |
| 저장소 유일 레이아웃 | `find src/app -name "layout.tsx"` | `src/app/layout.tsx` 1건. 중첩 레이아웃 선례 **없음** |
| `resolveSession()` 역할 필터 부재 | `cat -n src/lib/auth/session-resolver.ts` | `:67-71` 폐기/만료만 검사 후 `record.user.role` 반환 |
| `resolveAdminSession()` admin 요구 | `cat -n src/features/admin/services/admin-session.ts` | `:72-74` `role !== "admin"` → `null` |
| staff가 고객 로그인 사용 | `cat -n src/app/staff/login/page.tsx` | `:50` `fetch("/api/auth/login", …)` |
| 로그아웃 역할 비인지 | `cat -n src/app/api/auth/logout/route.ts` | `:43-58` `tokenHash` 조회 후 `revokedAt` 갱신. 역할 검사 없음 |
| 헤더 로그인 분기 | `cat -n src/components/layout/SiteHeader.tsx` | `:34-41` null → "로그인" / 아니면 "내 정보" + `LogoutButton` |
| staff 파일 수 | `find src/app/staff -type f \| wc -l` | `13` |

**Next.js 동작 문서 대조 (추정 아님)**

| 질문 | 출처 | 관측 결과 |
|---|---|---|
| 중첩 레이아웃이 부모 UI를 대체하는가 | `nextjs.org/docs/app/api-reference/file-conventions/layout` | 아니오. "`layout.js` is the outermost component **in a route segment**"; 루트 레이아웃 = "Any layout **without a `layout.js` above it**" |
| 라우트 그룹이 URL을 바꾸는가 | `…/file-conventions/route-groups` | 아니오. "should **not be included** in the route's URL path" |
| 이 용도가 지원되는가 | 동일 문서 Use cases | 예. "Opting specific route segments into sharing a layout, **while keeping others out**" |
| full-page-load 캐비엇 적용 여부 | 동일 문서 Caveats | 미적용. "This **only** applies to multiple root layouts" |

**변경 범위 기계적 계수**

| 명령 | 관측 결과 |
|---|---|
| `npx vitest run --reporter=dot` | `Test Files 113 passed (113)` / `Tests 1489 passed (1489)` — baseline green |
| 모듈 임포트 grep (`@/app/{page,cart,checkout,login,orders,products,signup}`) | 11개 테스트 파일 |
| fs 경로 grep (`"src/app/{cart,checkout,login,orders,products,signup}"`) | 7개 테스트 파일 |
| 두 집합의 합집합 | **12개** 테스트 파일 |
| 이동 대상 소스 파일 열거 | **10개** (7개 이동 항목: 디렉터리 6 + 파일 1) |
| 이동 파일 내 상대 상위 임포트 grep (`from "../`) | **0건** — 전부 `@/` 별칭, 이동해도 안 깨짐 |
| SPEC ID 정규식 self-check | `[[ "SPEC-AUTH-004" =~ ^SPEC(-[A-Z][A-Z0-9]*)+-[0-9]{3}$ ]]` → `PASS` |

### Baseline-attribution (baseline 귀속)

- **테스트 baseline**: `npx vitest run --reporter=dot`을 이 워크트리(`.claude/worktrees/t44`, 브랜치 `WT-staff-header-fix`, origin/main 기반)에서 이번 세션에 실행해 관측한 `113 passed / 1489 passed`. 과거 SPEC의 수치를 이월하지 않았다 — SPEC-AUTH-003 CHANGELOG가 같은 수치를 적고 있으나, 그것을 근거로 삼지 않고 직접 실행했다.
- **결함 사실 baseline**: 위 8개 항목 전부 이번 세션에 해당 파일을 열어 행 번호와 함께 관측했다. 위임 프롬프트의 요약 인용을 근거로 채택한 항목은 없다.
- **문서 baseline**: Next.js 공식 문서 2개 페이지를 이번 세션에 직접 조회해 인용 문구를 확보했다. 기억에 의존한 프레임워크 동작 주장은 없다.

### Gaps (미검증)

명시적으로 **관측하지 않은** 것들이다.

1. **`(shop)` 이동 후 실제 빌드·런타임 동작을 실행해 보지 않았다.** `next build`/`next dev`를 돌려 URL이 실제로 유지되는지, 레이아웃이 의도대로 중첩되는지 확인하지 않았다 — plan-phase에는 이동이 아직 일어나지 않았기 때문이다. 근거는 공식 문서 대조까지이며, 실물 확인은 run-phase AC-AUTH-052의 몫이다.
2. **11개 "경로 전용" 파일의 diff를 실제로 만들어 보지 않았다.** 경로 전용이라는 판정은 현재 소스의 grep 결과(모듈 임포트/ fs 경로 문자열만 매치)에 근거한 **예측**이다. 실제 diff가 경로 외 변경을 요구하는지는 run-phase에 AC-AUTH-054로 검증된다.
3. **`git mv`의 rename 탐지가 이 저장소 git 설정에서 실제로 접히는지 확인하지 않았다.** AC-AUTH-055가 이 불확실성을 명시적으로 흡수하도록 설계됐다(접히지 않으면 실패가 아니라 기록 의무).
4. **staff 화면의 시각적 결과를 보지 않았다.** 헤더가 사라진 뒤 staff 화면 상단이 어떻게 보이는지(여백·레이아웃 깨짐 여부)는 브라우저 확인이 필요하며, spec.md §3이 E2E를 범위에서 제외했으므로 자동 검증 대상이 아니다.
5. **`e2e/` 스위트를 실행하지 않았다.** baseline은 vitest만이다. `e2e/m4-edge-cases.spec.ts:106`이 주석에서 `src/app/checkout/page.tsx`를 언급하나 주석일 뿐 기능 참조가 아니어서 12개 계수에 포함하지 않았다 — 다만 e2e 스위트 자체의 green 여부는 관측하지 않았다.

### Residual-risk (잔여 위험)

1. **관측했음에도 남는 위험 — 이동 후 Next.js 캐시/타입 생성물.** `.next/types`의 생성된 라우트 타입이 이동을 따라가지 못해 `tsc --noEmit`이 일시적으로 실패할 수 있다. 클린 빌드로 해소되는 종류지만 run-phase에서 처음 나타날 수 있다.
2. **주석 안의 낡은 경로.** 여러 테스트가 주석에서 이웃 파일 경로를 언급한다(예: `staff-orders-page.test.tsx:17`, `order-lookup-result-view.test.tsx:78`). 이들은 기능적으로 깨지지 않아 12개 계수에서 제외했으나, 이동 후 주석이 낡은 경로를 가리키게 된다. 문서 부채이지 결함은 아니며, 이 SPEC은 "경로 전용 11개 외 테스트 무변경" 봉인을 유지하기 위해 **의도적으로 고치지 않는다**.
3. **`(shop)` 이름 선택.** 이 그룹에는 `/login`·`/signup`처럼 엄밀히는 쇼핑이 아닌 라우트도 들어간다. "고객 대면 영역"이라는 의미로는 정확하나, 이후 관리자 외 제3의 영역이 생기면 재명명 압력이 있을 수 있다. 되돌리기 비용은 낮다(디렉터리명 변경 + 경로 문자열 갱신).
4. **결함의 근본 원인은 남는다.** `POST /api/auth/logout`의 역할 비인지 폐기(spec.md §1.2)는 이 SPEC이 고치지 않는다. 노출 경로만 제거하므로, 이후 누군가 다른 경로로 그 버튼을 관리자 화면에 다시 노출하면 같은 위험이 재현된다. `@MX:WARN`과 spec.md §4 전방 포인터가 이 잔여 위험의 표지다.

### 두 차례의 전제 정정 기록 (감사 추적)

이 SPEC은 plan-phase에서 blocker 보고를 **두 번** 반환한 뒤 작성됐다. 두 번 다 위임된 전제가 코드/문서와 충돌했기 때문이다.

| # | 정정된 전제 | 실제 | 처리 |
|---|---|---|---|
| 1 | "`src/app/staff/layout.tsx`가 부모 레이아웃 UI를 **대체**한다" | 중첩 레이아웃은 부모 UI를 제거할 수 없음(no-op) | blocker 보고 → 사용자가 R1((shop) 라우트 그룹) 승인 |
| 2 | "테스트 변경은 `shell.test.tsx` **1개**" | 기계적 계수 결과 **12개** (경로 전용 11 + 구조 1) | blocker 보고 → 사용자가 12개 범위 + 재작성된 AC 승인 |

원 버그 리포트의 증상 서술 정정(§1.1)까지 포함하면 이 SPEC은 **3개의 잘못된 전제** 위에 놓일 뻔했다. 세 건 모두 소스/문서 직접 확인으로 발견됐다.

### plan-audit 결과 및 후속 정리 (동일 일자)

**독립 plan-auditor 심사: PASS — 반복 1회차 0.93 → 반복 2회차 0.95** (Tier M 임계 0.80). 보고서: `.moai/reports/plan-audit/SPEC-AUTH-004-2026-09-05.md`. 감사자 판단으로 **추가 감사 라운드 불필요**.

지적 3건(1회차 블로킹 2건 + 2회차 권고 1건)을 같은 날 전부 반영 완료했다.

| ID | 심각도 | 지적 내용 | 조치 |
|---|---|---|---|
| D1 | major (blocking) | `SiteHeader.tsx`의 `@MX:ANCHOR`("rendered by layout.tsx on **every route**")와 `@MX:REASON`("via the **root layout**")이 이 SPEC 완료 시점에 **둘 다 거짓**이 되는데, 같은 파일이 REQ-AUTH-058 PRESERVE 대상이고 AC-AUTH-056이 diff 무변경을 요구한다 → 낡은 주석을 "친절하게" 고치는 구현자가 인수 조건을 깨뜨리는 함정 | `plan.md` §E에 낡음 명시 행 추가(고치지 않는 것이 의도임을 기록), `plan.md` §G에 안티패턴 9 추가, `spec-compact.md` 안티패턴 절에 강조 추가. SPEC-AUTH-003이 `session-resolver.ts`에 적용한 동일 처리(그 SPEC `plan.md:158` + 안티패턴 7) |
| D2 | minor (blocking) | REQ-AUTH-054가 `(When — 이벤트 탐지)`로 라벨링됐으나 트리거가 없다("…하더라도" 양보절 + 무조건 숨김). 본문은 유효한 Unwanted 절이며 라벨만 오류 | 3개 위치 전부 `(Unwanted)`로 정정 — `spec.md` REQ-AUTH-054, `spec-compact.md` 동 항목, `progress.md` GEARS 패턴 체크리스트(`When` 미사용 사실 반영) |

| D7 | 권고 (non-blocking, 2회차) | `SiteHeader.tsx:24-27`의 `@MX:NOTE`("the tree rooted at the **root layout**, so **every route** … dynamically rendered")가 **세 번째** 낡는 주석인데, 안티패턴 9가 D1에서 잡은 두 개(`:11`, `:14`)만 열거하고 있어 이 건이 규칙 밖에 남았다 | 안티패턴 9를 **열거식에서 파일 단위 금지로 일반화**했다 — "이 두 주석을 고치지 마라"가 아니라 "`SiteHeader.tsx`의 주석은 **하나도** 건드리지 마라". 세 번째 인스턴스와 향후 발견될 네 번째까지 한 문장으로 덮으며, 낡은 주석을 매번 열거할 필요가 없다. `plan.md` §G 안티패턴 9 + §E 행 + `spec-compact.md` 안티패턴 절 모두 반영. 확인 결과 그 파일의 `@MX:` 주석은 **3개가 전부이며 3개 모두 낡는다** |

**D3~D6은 의도적으로 반영하지 않았다.** 감사자 자신의 권고가 "이미 올바른 결론 위의 선택적 다듬기이며, 전부 고치면 실제 결함 대비 과잉 엔지니어링(scope creep)"이었다. 해당 항목(ADMIN-001 인용, SPEC-AUTH-003 §B.5 부분 되돌림 주석, `product-service.ts` 낡은 주석 누락, AC-AUTH-055의 REQ 미연결)은 이 SPEC의 결함 수정 범위를 넓히지 않는 선에서 미처리로 남긴다.

### plan-phase 자체 점검

- [x] SPEC ID 정규식 Bash 실행, `PASS` 출력 인용
- [x] 프론트매터 12개 정규 필드 전부 존재 + `tier`/`depends_on`/`related_specs` 부가
- [x] ID 유일성 — `.moai/specs/` 목록에 `SPEC-AUTH-004` 부재 확인
- [x] 요구사항 GEARS 표기 (REQ-AUTH-050~058, 9건 — Ubiquitous 4 / While 2 / Unwanted 3, `IF/THEN` 0건. `When`(이벤트 구동·이벤트 탐지) 패턴은 이 SPEC에 **해당 요구사항이 없다** — 트리거로 촉발되는 동작이 아니라 무조건적 구조 제약만 다루기 때문이다)
- [x] Out of Scope — H3 `### Out of Scope — <주제>` 7개 소제목, 각각 `-` 불릿 보유
- [x] Tier M 산출물 집합 (spec.md/plan.md/acceptance.md + spec-compact.md, progress.md)
- [x] spec.md에 구현 세부(함수 시그니처·클래스 구조) 미포함
- [x] 요구사항 ↔ AC 추적표 완비 (REQ 9건 전부 최소 1개 AC로 연결, AC 9건 전부 최소 1개 REQ에서 참조)
- [x] 미해결 명료화 항목 0건

---

## §E.2 Run-phase Evidence

### M1 — 레이아웃 경계 확정 (cycle_type=tdd)

#### Claim (주장)

`src/app/(shop)/layout.tsx`를 신규 작성하고 `src/app/layout.tsx`에서 `<SiteHeader />` 렌더·임포트를 제거했다. plan.md §F M1 / §E MX 계획대로 정확히 2개 파일만 변경했다. `src/components/layout/SiteHeader.tsx`는 무변경(REQ-AUTH-058, AC-AUTH-056)이다.

#### Evidence (증거)

**워크트리 복구 (Section A.0)** — 세션이 `main` 기반 새 워크트리로 격리되어 실행됐다(예상된 경우). 복구 절차대로 처리:

```bash
$ git rev-parse HEAD
04cb9aa9bc87860f5368085b3a66d3476ee5a40f   # 기대값 5b5db74… 와 불일치 → 복구 절차 실행
$ git checkout -b m1-shop-layout 5b5db74de39044012b7f8734c0721cab552204d4
Switched to a new branch 'm1-shop-layout'
$ ls .moai/specs/SPEC-AUTH-004/   # 확인됨
acceptance.md plan.md progress.md spec-compact.md spec.md
$ npm install   # 406 packages
```

**사전 점검 (Section C)**

```bash
$ find src/app -name "layout.tsx"
src/app/layout.tsx   # 정확히 1개 — 이 SPEC이 저장소 최초의 중첩 레이아웃을 만든다는 전제 확인
$ npx tsc --noEmit    # baseline: 에러 0건 (출력 없음)
$ npm run lint        # baseline: 경고/에러 0건
$ npx vitest run --reporter=dot
Test Files  113 passed (113)
Tests  1489 passed (1489)   # 기대 baseline과 일치
```

**변경 (Section D scope 정확히 2개 파일)**

1. `src/app/(shop)/layout.tsx` (신규) — `SiteHeader` 임포트, `{children}` 위 렌더, `@MX:ANCHOR` + `@MX:NOTE` (plan.md §E 문구 그대로).
2. `src/app/layout.tsx` (수정) — `<SiteHeader />` 렌더·임포트 제거, `@MX:WARN` 신규 추가, 기존 `@MX:NOTE`를 "헤더가 이제 이 파일에 없다"로 갱신.

```bash
$ git status --short
 M src/app/layout.tsx
?? src/app/(shop)/
$ git diff --stat HEAD
 src/app/layout.tsx | 35 +++++++++++++++++++++--------------
 1 file changed, 21 insertions(+), 14 deletions(-)
```

#### E1 — `(shop)/layout.tsx` 구조 확인

코드 검사: `SiteHeader` 임포트 후 `<SiteHeader />`를 `{children}` 위에 배치했음을 육안 확인 (파일 전문은 위 변경 내역 참조). `tsc --noEmit` + `npm run lint`가 이 신규 파일을 포함해 통과한 것 자체가 유효한 TSX 컴포넌트임을 나타내는 최소 스모크 검증이다 — 전체 행위 AC 검증(브라우저·통합 테스트)은 M4 소관이다.

#### E2 — SiteHeader.tsx 무변경 (REQ-AUTH-058, AC-AUTH-056)

```bash
$ git diff --stat 5b5db74de39044012b7f8734c0721cab552204d4 -- src/components/layout/SiteHeader.tsx
(빈 출력)
```

zero-diff 확인됨. 파일의 낡은 `@MX:` 주석 3개(plan.md §E 마지막 행, §G 안티패턴 9) 중 하나도 손대지 않았다.

#### E3 — 타입/린트 (변경 후)

```bash
$ npx tsc --noEmit
(에러 0건 — npm notice만 출력)
$ npm run lint
> our-shop@0.1.0 lint
> eslint .
(경고/에러 0건)
```

#### E4 — 전체 회귀

```bash
$ npx vitest run --reporter=dot
Test Files  1 failed | 112 passed (113)
Tests  1 failed | 1488 passed (1489)
```

**1건 실패 — 예상되고 plan.md에 이미 문서화된 실패, M1 범위 밖 누출이 아님.**

실패 테스트: `tests/unit/app/shell.test.tsx > RootLayout — AC-STOREFRONT-001 / 002 > places SiteHeader inside body, above children — AC-AUTH-040 (plan.md §B.7 pattern B)` — `expect(first.type).toBe(SiteHeader)`가 루트 레이아웃 body의 첫 자식이 더 이상 `SiteHeader`가 아니므로 실패.

이 테스트는 plan.md §D.3의 "테스트 파일 12개" 표에서 **명시적으로 별도 분류**된 항목이다 — "1개 — 구조 변경(승인됨)": *"`shell.test.tsx` 모듈 임포트 + **구조 단언 이전** — `first.type === SiteHeader`가 루트 레이아웃에서 `(shop)/layout.tsx`로 옮겨진다."* 그 단언 이전은 plan.md §F **M3** 항목 6("`shell.test.tsx` 구조 단언 이전 — 루트 레이아웃은 `SiteHeader`를 렌더하지 않음을, `(shop)/layout.tsx`가 렌더함을 각각 단언")으로 명시적으로 위임돼 있다. M1은 "레이아웃 경계 확정"만 다루고 테스트 파일은 M1 변경 대상에 없다(§F M1 목록 2개 항목 모두 `src/app/*layout.tsx`).

이 실패는 M1의 구조적 결정(헤더를 루트 레이아웃에서 내린다)의 **필연적이고 사전에 문서화된 결과**이며, M1이 손대지 말아야 할 파일을 건드려서 생긴 범위 누출이 아니다 — 실패한 파일이 정확히 plan.md가 지명한 그 파일, 그 단언 한 줄이다. `shell.test.tsx`를 M1에서 고치지 않은 것은 위임 지시("M2-M5는 별도 위임 — 여기서 하지 말 것")를 그대로 지킨 결과다. 이 단언 수정은 M3 위임의 명시적 스코프로 남겨둔다.

#### E5 — 브랜치/푸시 상태

```bash
$ git branch --show-current
m1-shop-layout
```

M1 완료 시점에는 아직 커밋 전. 아래 커밋 후 `git push origin m1-shop-layout` 예정(Section A.0).

#### E6 — 블로커

없음. M1은 완전히 완료됐다. 위 E4의 1건 실패는 blocker가 아니라 plan.md에 이미 승인·문서화된 M3 소관 결과다.

#### E7 — RED 증거 (N/A)

이 마일스톤에 해당 없음. M1은 순수 구조 변경(레이아웃 파일 2개)이며 신규 테스트 파일을 만들지 않는다 — plan.md §F에 따라 신규 회귀 가드(AC-AUTH-048/049/050)는 **M4** 소관이다. RED 단계를 생략한 것이 아니라, 이 마일스톤에 새로 작성할 실패 테스트 자체가 없다.

---

## §E.3 Run-phase Audit-Ready Signal

```yaml
run_milestone: M1
next_milestone: M2
m1_files_changed: 2  # src/app/(shop)/layout.tsx (신규), src/app/layout.tsx (수정)
m1_preserve_zero_diff:
  - path: src/components/layout/SiteHeader.tsx
    verified: true
m1_tsc_errors: 0
m1_lint_errors: 0
m1_test_suite:
  files_total: 113
  files_failed: 1
  tests_total: 1489
  tests_failed: 1
  failed_test: "tests/unit/app/shell.test.tsx > places SiteHeader inside body, above children — AC-AUTH-040"
  failure_reason: "expected, plan.md §D.3 item 12 + §F M3 step 6 — structural assertion move owned by M3, not a M1 scope leak"
m1_branch: m1-shop-layout
m1_base_sha: 5b5db74de39044012b7f8734c0721cab552204d4
```

---

## §E.4 Sync-phase Audit-Ready Signal

_<pending sync-phase>_
