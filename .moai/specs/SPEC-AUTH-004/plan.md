# SPEC-AUTH-004 — 구현 계획

> staff 화면에서 고객용 `SiteHeader`가 노출되는 결함을, 헤더를 루트 레이아웃에서 `(shop)` 라우트 그룹 레이아웃으로 내려 구조적으로 제거한다.

---

## §A. 맥락 — 이 계획이 서 있는 사실 기반

이 절의 모든 인용은 plan-phase에서 **소스를 직접 열어 재확인**한 것이다. 착수 전 정찰 요약을 그대로 옮기지 않았다 — 그 요약의 증상 서술이 실제로 틀렸기 때문이다(spec.md §1.1).

### A.1 직접 확인한 인용

| 확인 항목 | 근거 | 결과 |
|---|---|---|
| 루트 레이아웃이 헤더를 무조건 렌더 | `src/app/layout.tsx:51` | `<SiteHeader />`가 `<body>` 안, `{children}` 위에 조건 없이 배치 |
| 저장소에 중첩 레이아웃 선례 없음 | `find src/app -name "layout.tsx"` | `src/app/layout.tsx` **단 하나**. 이 SPEC이 만드는 것이 저장소 최초의 중첩 레이아웃이다 |
| `resolveSession()`에 역할 필터 없음 | `src/lib/auth/session-resolver.ts:67-71` | 폐기/만료만 검사하고 `record.user.role`을 그대로 반환 |
| `resolveAdminSession()`은 admin 요구 | `src/features/admin/services/admin-session.ts:72-74` | `role !== "admin"` → `null` |
| 두 함수가 같은 쿠키·같은 테이블 | 양쪽 모두 리터럴 `"refresh_token"` + `prisma.refreshToken.findFirst({where:{tokenHash}})` | 동일 |
| staff가 고객 로그인 엔드포인트 사용 | `src/app/staff/login/page.tsx:50` | `fetch("/api/auth/login", …)` — 별도 관리자 로그인 라우트 없음 |
| 로그아웃이 역할 비인지 | `src/app/api/auth/logout/route.ts:43-58` | CSRF 검사 후 `tokenHash`로 찾아 `revokedAt` 갱신. **역할 검사 없음** |
| 헤더의 로그인 분기 | `src/components/layout/SiteHeader.tsx:34-41` | `session === null` → "로그인" / 아니면 "내 정보" + `<LogoutButton />` |

### A.2 결론

유효한 staff 세션에서 헤더는 "내 정보" + 로그아웃 버튼을 렌더하고, 그 버튼은 관리자 세션을 종료시킨다. 원 리포트의 "로그아웃된 것처럼 보인다"는 정확히 반대다.

---

## §B. 설계 — 왜 `(shop)` 라우트 그룹인가

### B.1 기각한 메커니즘 1 — `src/app/staff/layout.tsx` 추가 (no-op)

착수 지시가 처음 제시한 메커니즘은 "`src/app/staff/layout.tsx`를 새로 만들어 `{children}`만 렌더한다"였고, 그 근거는 "세그먼트 자체 레이아웃은 부모 레이아웃이 렌더했을 것을 **대체**한다"는 전제였다. **이 전제는 사실이 아니다.**

Next.js 공식 문서(`nextjs.org/docs/app/api-reference/file-conventions/layout`)는 `layout.js`를 "route segment 안에서 가장 바깥 컴포넌트"로 정의하며, 루트 레이아웃의 정의를 "**위에 `layout.js`가 없는** 레이아웃"으로 못 박는다. `src/app/staff/layout.tsx`는 위에 `src/app/layout.tsx`가 있으므로 루트 레이아웃이 아니라 **중첩** 레이아웃이고, 렌더 결과는 이렇게 된다:

```
<html><body>
  <SiteHeader />                        ← 루트 레이아웃 — 여전히 렌더된다
  <StaffLayout>{staff page}</StaffLayout>
</body></html>
```

헤더는 제거되지 않는다. 중첩 레이아웃은 부모가 렌더한 UI를 걷어낼 수단을 갖지 않는다. 이 메커니즘은 채택하지 않는다.

### B.2 기각한 메커니즘 2 — 경로 인지 헤더 (미들웨어 헤더 주입)

미들웨어가 `x-pathname`을 주입하고 `SiteHeader`가 `headers()`로 읽어 staff에서 스스로 `null`을 반환하는 방식. 테스트 변경 비용은 가장 싸지만 **기각**한다:

- 현재 matcher는 `["/admin/:path*"]` 하나뿐이라 미들웨어가 `/staff`에서 **아예 실행되지 않는다**. 동작시키려면 matcher를 확장해야 한다.
- matcher 확장은 SPEC-AUTH-003 REQ-AUTH-047과 그 §G 안티패턴 6이 명시적으로 금지한다. `src/middleware.ts`는 이 저장소에서 가장 강한 PRESERVE 핀이다.

### B.3 채택한 메커니즘 — `(shop)` 라우트 그룹 분리

헤더를 **상속 경로에서 내린다**. 루트 레이아웃은 문서 셸만 남기고, 헤더는 고객 라우트만 감싸는 새 그룹 레이아웃으로 옮긴다. staff는 그 그룹 밖에 있으므로 헤더를 애초에 만나지 않는다.

```
src/app/layout.tsx              ← <html><body>{children}</body></html>  (헤더 제거)
src/app/(shop)/layout.tsx       ← <SiteHeader />{children}              (신규)
src/app/(shop)/page.tsx, cart/, checkout/, login/, orders/, products/, signup/
src/app/staff/**                ← 무변경. (shop) 밖 → 헤더 없음
src/app/api/**                  ← 무변경. 라우트 핸들러는 레이아웃과 무관
```

**staff 쪽에 새 파일이 필요 없다**는 점이 이 설계의 부수 이득이다 — `src/app/staff/`는 파일 한 개도 늘지 않는다(REQ-AUTH-057).

### B.4 Next.js 동작 검증 (문서 대조, 추정 아님)

| 검증 질문 | 문서 근거 | 결과 |
|---|---|---|
| 라우트 그룹이 URL을 바꾸는가? | route-groups 문서: 괄호 폴더는 "**should not be included** in the route's URL path" | 바꾸지 않음. `(shop)/cart/page.tsx` → `/cart` (REQ-AUTH-055) |
| 이 용도가 지원되는가? | route-groups 문서 Use cases: "**Opting specific route segments into sharing a layout, while keeping others out**" | 문서가 이 용도를 그대로 명시. 우회가 아니라 정규 용법 |
| full page load 캐비엇에 걸리는가? | route-groups 문서 Caveats: "This **only** applies to multiple root layouts" | 걸리지 않음. 최상위 `layout.tsx`를 **유지**하므로 `(shop)/layout.tsx`는 중첩 레이아웃이다 |
| 경로 충돌 캐비엇은? | 서로 다른 그룹이 같은 URL로 해석될 때만 발생 | 그룹이 하나뿐 → 해당 없음 |
| 홈 라우트 캐비엇은? | "multiple root layouts **without a top-level layout.js**"일 때만 적용 | 최상위 레이아웃을 유지하므로 해당 없음 |

### B.5 이동 파일의 임포트 안전성

이동 대상 10개 소스 파일 전체에 대해 상대 상위 임포트(`from "../…"`)를 grep한 결과 **0건**이다. 전부 `@/` 별칭을 쓰므로 디렉터리가 이동해도 임포트가 깨지지 않는다. 디렉터리 내부의 동급 임포트는 디렉터리 전체가 함께 이동하므로 그대로 유효하다.

---

## §C. PRESERVE 핀과의 상호작용 (명시적 정리)

### C.1 SPEC-AUTH-003의 `src/app/staff/**` 핀 — 이 SPEC은 저촉하지 않는다

SPEC-AUTH-003 `plan.md:204`는 `src/app/staff/**`를 PRESERVE로 열거하고, `:261`에서 `git diff --stat` 무변경으로 검증했다.

- **(a) 그 핀은 SPEC-AUTH-003 자신의 범위 가드였다.** 헤더 작업이 관리자 영역으로 번지는 것을 막기 위한 장치이지, 이후 모든 SPEC을 구속하는 영구 동결이 아니다. 같은 계획이 `src/app/products/[productId]/page.tsx`도 함께 핀했다는 사실이 그 성격을 보여 준다 — 그 SPEC이 건드릴 이유가 없던 이웃 영역의 목록이다.
- **(b) 그런데 이 SPEC은 애초에 그 핀을 건드리지 않는다.** 채택 메커니즘(B.3)은 `src/app/staff/` 아래에 파일을 **추가하지도 수정하지도 않는다**. 기각된 메커니즘 1이었다면 `staff/layout.tsx`를 추가해야 했으나, 그 메커니즘은 애초에 동작하지 않아 채택되지 않았다. 결과적으로 `src/app/staff/**`는 `git diff --stat` 무변경으로 남는다 — SPEC-AUTH-003의 검증 방식 그대로 재확인한다(AC-AUTH-054).
- **(c) 이 SPEC은 SPEC-AUTH-003이 의도만 적고 집행하지 못한 절반을 집행한다.** `spec.md` §3의 "`/staff/*` 관리자 화면에 이 헤더를 적용하지 않는다"는 문장은 루트 레이아웃 배선 때문에 자동으로 위반되고 있었다(spec.md §1.4).

### C.2 SPEC-ADMIN-001/002/003의 staff 핀 — 충돌 없음

| SPEC | 핀 대상 | 이 SPEC과의 관계 |
|---|---|---|
| SPEC-ADMIN-001 | `src/app/staff/login/page.tsx`, `staff/orders/**` | 무변경 |
| SPEC-ADMIN-002 | `src/app/staff/orders/**`, `src/app/staff/api/orders/**` diff 0줄 | 무변경 |
| SPEC-ADMIN-003 | `src/app/staff/api/products/**`; 구조 테스트가 `walk("src/app/staff/api")` 수행 | 무변경. 이 SPEC은 `src/app/staff/api` 아래에 아무것도 만들지 않는다 |

이 SPEC은 `src/app/staff/` 전체를 건드리지 않으므로 세 SPEC의 핀 어느 것과도 교차하지 않는다. `git diff --stat`으로 기계적으로 재확인한다.

### C.3 `src/app/products/[productId]/page.tsx` 핀 — 승인된 위치 이동

SPEC-AUTH-003 `plan.md:204`/`:261`이 이 파일을 PRESERVE로 핀하고 `git diff --stat` 무변경을 검증했다. 이 SPEC은 그 파일을 `(shop)/` 안으로 **이동**한다 — 사용자 승인을 받은 예외다.

**핵심 제약: 위치만 바뀌고 내용은 바뀌지 않는다.** 이동 후 `git diff --stat`으로 내용 diff가 비어 있음(rename 탐지 시 0 insertions/0 deletions)을 확인한다. git 설정이 깔끔한 rename으로 접지 못하면 그 사실을 `progress.md`에 **명시적으로 기록**하며, 조용히 넘어가지 않는다(AC-AUTH-055).

---

## §D. 변경 파일 전수 — 추정이 아니라 재계수

SPEC-AUTH-003에서 파일 수 오차가 발생한 선례가 있어, 모든 수치를 기계적으로 재계수했다.

### D.1 소스 이동 — 7개 항목 (디렉터리 6 + 파일 1), 소스 파일 10개

| # | 이동 항목 | 파일 수 | 이동 후 |
|---|---|---|---|
| 1 | `src/app/page.tsx` | 1 | `src/app/(shop)/page.tsx` |
| 2 | `src/app/cart/` | 1 | `src/app/(shop)/cart/` |
| 3 | `src/app/checkout/` | 2 | `src/app/(shop)/checkout/` |
| 4 | `src/app/login/` | 1 | `src/app/(shop)/login/` |
| 5 | `src/app/orders/` | 2 | `src/app/(shop)/orders/` |
| 6 | `src/app/products/` | 2 (`[productId]/page.tsx`, `[productId]/not-found.tsx`) | `src/app/(shop)/products/` |
| 7 | `src/app/signup/` | 1 | `src/app/(shop)/signup/` |
| | **합계** | **10** | |

### D.2 레이아웃 파일 — 2개

| 파일 | 동작 |
|---|---|
| `src/app/layout.tsx` | 수정 — `<SiteHeader />` 및 그 임포트 제거, 주석 갱신 |
| `src/app/(shop)/layout.tsx` | **신규** — `SiteHeader` 임포트 + `{children}` 위 배치 |

### D.3 테스트 파일 — 12개 (11 경로 전용 + 1 구조)

**11개 — 경로 문자열 전용 재작성. 단언·의미 변경 0.**

| # | 파일 | 변경 성격 |
|---|---|---|
| 1 | `tests/unit/app/cart-page.test.tsx` | 모듈 임포트 + `readdirSync` 경로 |
| 2 | `tests/unit/app/checkout-complete-page-payment.test.tsx` | 모듈 임포트 |
| 3 | `tests/unit/app/checkout-complete-page.test.tsx` | 모듈 임포트 + fs 경로 |
| 4 | `tests/unit/app/checkout-page.test.tsx` | 모듈 임포트 + fs 경로 |
| 5 | `tests/unit/app/home-page.test.tsx` | 모듈 임포트 |
| 6 | `tests/unit/app/login-page.test.tsx` | 모듈 임포트 + `path.resolve` 경로 |
| 7 | `tests/unit/app/order-lookup-by-number-page.test.tsx` | 모듈 임포트 + fs 경로 |
| 8 | `tests/unit/app/order-lookup-page.test.tsx` | 모듈 임포트 |
| 9 | `tests/unit/app/product-detail-page.test.tsx` | 모듈 임포트 + fs 경로 |
| 10 | `tests/unit/app/signup-page.test.tsx` | 모듈 임포트 |
| 11 | `tests/unit/auth/auth-boundary-static.test.ts` | fs 경로 |

**1개 — 구조 변경(승인됨).**

| # | 파일 | 변경 성격 |
|---|---|---|
| 12 | `tests/unit/app/shell.test.tsx` | 모듈 임포트 **+ 구조 단언 이전** — `first.type === SiteHeader`가 루트 레이아웃에서 `(shop)/layout.tsx`로 옮겨진다 |

### D.4 두 특수 테스트에 대한 명시적 확인

- **`tests/unit/app/product-detail-page.test.tsx`** — SPEC-AUTH-003 `plan.md:261`이 지명한 무회귀 가드다. 이 SPEC에서 바뀌는 것은 **이 테스트가 겨누는 파일 경로뿐**이다(`@/app/products/[productId]/page` → `@/app/(shop)/products/[productId]/page`, `roots = ["src/app/products", …]` → `["src/app/(shop)/products", …]`). 단언문·정적 스캔 금지 토큰 목록·기대값은 **한 글자도 바뀌지 않는다.** 따라서 SPEC-AUTH-003이 이 가드로 확보한 보장은 그대로 유효하며, 같은 대상을 새 위치에서 계속 감시한다.
- **`tests/unit/auth/auth-boundary-static.test.ts`** — 보안 경계 정적 스캔이다(`:19-20`이 `login/page.tsx`·`signup/page.tsx`를 핀). 바뀌는 것은 **스캔 대상 경로 문자열 2개뿐**이며, 금지 토큰 집합과 단언은 불변이다. 스캔이 겨누는 실제 파일은 동일한 파일이고 내용도 동일하므로, 원 SPEC이 확보한 보안 보장은 축소되지 않는다.

두 파일 모두 "경로 전용 11" 안에 있다. 이 성격은 **독립 검증 가능하다** — 두 파일의 diff에 경로 문자열 외 변경이 없어야 한다(AC-AUTH-054).

### D.5 총계

**소스 10 (이동) + 레이아웃 2 (수정 1, 신규 1) + 테스트 12 = 24개 파일.**

---

## §E. @MX 태그 계획

| 파일 | 태그 | 내용 |
|---|---|---|
| `src/app/(shop)/layout.tsx` (신규) | `@MX:ANCHOR` | 모든 고객 라우트가 이 레이아웃을 통과한다. 여기서의 회귀는 한 화면이 아니라 고객 영역 전체의 로그인 상태 표시를 깨뜨린다 (SPEC-AUTH-003 `SiteHeader`의 `@MX:ANCHOR`가 루트 레이아웃 기준으로 적던 것과 같은 사유가 이 파일로 이전된다) |
| `src/app/(shop)/layout.tsx` (신규) | `@MX:NOTE` | 이 파일의 **존재 자체가 결함 수정**이다. 헤더를 여기 두는 이유는 스타일이 아니라 `/staff/**`를 헤더 상속 경로 밖으로 빼내기 위함이며, 헤더를 루트 레이아웃으로 되돌리면 SPEC-AUTH-004가 고친 결함이 그대로 재발한다 |
| `src/app/layout.tsx` (수정) | `@MX:WARN` | 이 루트 레이아웃에 `<SiteHeader />`를 (다시) 추가하면 `/staff/**`가 고객 헤더를 상속하게 되고, 관리자가 고객용 로그아웃 버튼으로 자기 세션을 종료하는 SPEC-AUTH-004의 결함이 재발한다. 헤더는 `(shop)/layout.tsx`에만 둔다 |
| `src/app/layout.tsx` (수정) | 기존 `@MX:NOTE` 갱신 | SPEC-AUTH-003이 남긴 "헤더 한 줄만 개정됐다"는 주석이 다시 낡는다 — 헤더는 이제 이 파일에 없다. 푸터·검색·장바구니·카테고리 내비 제외는 여전히 유효 |
| `src/components/layout/SiteHeader.tsx`의 기존 주석 **전체**(`@MX:` 주석 3개 전부 포함) | **낡게 되는 대상 — 단, 이 SPEC에서는 하나도 손대지 않음** | 이 SPEC이 끝나면 그 파일의 `@MX:` 주석 **3개가 전부** 거짓이 된다 — `@MX:ANCHOR`(`:11` "rendered by layout.tsx on **every route**"), `@MX:REASON`(`:14` "via the **root layout**"), `@MX:NOTE`(`:24-27` "the tree rooted at the **root layout**, so **every route** rendered through it becomes dynamically rendered"). 헤더는 이제 `(shop)/layout.tsx`가 렌더하므로 every route가 아니고(`/staff/**` 제외), 동적 렌더 파급도 `(shop)` 하위로 한정된다. 그러나 REQ-AUTH-058이 이 파일 무변경을 요구하고 AC-AUTH-056이 diff가 비어 있을 것을 요구하므로, **이 SPEC에서 하나도 고치지 않는다.** 낡은 채로 두는 것이 의도된 선택이며(금지는 개별 주석이 아니라 **파일 단위**다 — §G 안티패턴 9), 후속 정리 후보로 여기 기록만 남긴다. |

---

## §F. 마일스톤 — 되돌리기 어려운 결정부터

가장 바뀔 가능성이 높은 결정(디렉터리 구조·레이아웃 경계)을 앞에, 기계적 후속 작업을 뒤에 둔다.

### M1 — 레이아웃 경계 확정 (가장 되돌리기 어려움)

가장 먼저 검토받아야 할 결정이다. 구조가 확정되면 나머지는 기계적이다.

1. `src/app/(shop)/layout.tsx` 신규 작성 — `SiteHeader` 임포트 + `{children}` 위 배치 + §E의 `@MX:ANCHOR`/`@MX:NOTE`.
2. `src/app/layout.tsx` 수정 — `SiteHeader` 임포트·렌더 제거, `@MX:WARN` 추가, 기존 `@MX:NOTE` 갱신.

### M2 — 라우트 이동 (URL 계약이 걸린 결정)

3. `git mv`로 §D.1의 7개 항목을 `src/app/(shop)/` 아래로 이동. **`git mv`를 쓴다** — 일반 삭제+생성은 rename 탐지를 잃어 §C.3의 내용 무변경 검증을 불가능하게 만든다.
4. `git diff --stat`으로 이동 파일들의 내용 diff가 비어 있음을 확인. rename으로 접히지 않으면 `progress.md`에 명시 기록.

### M3 — 테스트 경로 정렬 (기계적)

5. 경로 전용 11개 파일의 경로 문자열 재작성. 단언 변경 금지.
6. `shell.test.tsx` 구조 단언 이전 — 루트 레이아웃은 `SiteHeader`를 렌더하지 않음을, `(shop)/layout.tsx`가 렌더함을 각각 단언.

### M4 — 신규 회귀 가드 (기계적)

7. staff 라우트 헤더 부재 AC(AC-AUTH-048/049)와 고객 라우트 헤더 유지 AC(AC-AUTH-050)의 테스트 작성.

### M5 — 전수 검증

8. `npx vitest run` → 113 files / 1489 tests 전부 통과. `npx tsc --noEmit`, `npm run lint` exit 0.
9. PRESERVE `git diff --stat` 무변경 확인 (§C.1/C.2/REQ-AUTH-058 대상 전부).

---

## §G. 안티패턴 — 하지 말 것

1. **`src/app/staff/layout.tsx`를 만들어 `{children}`만 렌더하기.** 동작하지 않는다(§B.1). 이 SPEC이 처음 지시받았다가 기각한 메커니즘이다.
2. **tsconfig 경로 별칭으로 이동한 임포트를 살려 두기.** `@/app/cart/*` → `src/app/(shop)/cart/*` 별칭을 추가하면 테스트 11개를 안 고쳐도 되지만, 실제 구조를 감춰 다음 독자를 오도한다. 경로는 정직하게 갱신한다.
3. **`git mv` 대신 삭제 후 재생성.** rename 탐지를 잃어 §C.3의 내용 무변경 증명이 불가능해진다.
4. **경로 전용 11개 파일에서 "이왕 여는 김에" 단언 손보기.** 그 순간 이 SPEC의 승인 근거(경로 전용이라 원 SPEC 보장이 유지된다)가 무너진다. diff에 경로 문자열 외 변경이 있으면 실패다.
5. **`src/middleware.ts` matcher 확장.** §B.2에서 기각됐고 SPEC-AUTH-003 REQ-AUTH-047이 금지한다.
6. **관리자용 헤더·로그아웃 버튼을 "이왕이면" 만들기.** spec.md §3이 명시적으로 제외한 범위다. staff 화면은 헤더가 **없어지는** 것이 이 SPEC의 완료 상태다.
7. **`logout/route.ts`에 역할 검사 추가.** §1.2의 라우트 측 문제는 별도 SPEC 소유다.
8. **`src/app/api/`를 `(shop)` 안으로 함께 옮기기.** 라우트 핸들러는 레이아웃을 통과하지 않으므로 옮길 이유가 없고, 옮기면 API 경로 관련 구조 테스트를 불필요하게 건드린다.
9. **`src/components/layout/SiteHeader.tsx`의 주석을 고치기 — 어떤 주석이든.** 이 SPEC이 끝나면 그 파일의 설명 주석 여러 개가 실제로 낡는다. 확인된 것만 해도 파일의 `@MX:` 주석 **3개 전부**가 낡는다: `@MX:ANCHOR`(`:11` "rendered by layout.tsx on every route"), `@MX:REASON`(`:14` "via the root layout"), `@MX:NOTE`(`:24-27` "cookies() the first dynamic API in the tree rooted at the **root layout**, so **every route** rendered through it becomes dynamically rendered" — 이동 후에는 `(shop)/layout.tsx`가 기점이고 동적 렌더 영향도 `(shop)` 하위로 한정된다).

   **금지 규칙은 개별 주석 열거가 아니라 파일 단위다 — `SiteHeader.tsx`의 주석은 하나도 건드리지 않는다.** 낡은 문장을 새로 발견하더라도 마찬가지다. 근거: 그 파일은 REQ-AUTH-058의 PRESERVE 대상이고 **AC-AUTH-056이 그 파일 diff가 비어 있을 것을 요구**하므로, 주석 한 줄만 고쳐도 인수 조건이 깨져 실패한다. 열거식으로 적으면 목록에 없는 네 번째 주석에서 같은 함정이 재발하므로 파일 단위로 봉인한다. §E에 후속 정리 후보로 기록해 두는 선까지다 — SPEC-AUTH-003이 `session-resolver.ts`의 낡은 `@MX:NOTE`에 대해 내린 것과 동일한 처리다(그 SPEC `plan.md:158` + 안티패턴 7).

---

## §H. 상호 참조

- `.moai/specs/SPEC-AUTH-003/` — 이 결함을 만든 SPEC. `plan.md:204`/`:261`(PRESERVE 목록·검증), `spec.md` §3(미집행 의도).
- `.moai/specs/SPEC-AUTH-002/` — `resolveSession()`의 소유 SPEC. 무변경.
- `.moai/specs/SPEC-ADMIN-001/002/003/` — staff 영역 소유 SPEC들. 전부 무변경(§C.2).
- Next.js 문서: `nextjs.org/docs/app/api-reference/file-conventions/layout`(중첩 규칙), `…/route-groups`(URL 투명성 · 지원 용도 · 캐비엇). §B.1/B.4에서 직접 대조.

**미해결 명료화 항목: 없음(0건).** 이 SPEC의 범위 결정(헤더를 숨긴다 / 관리자 전용 헤더를 만들지 않는다 / 새 SPEC으로 간다)은 착수 전 사용자 라운드에서 확정됐고, 메커니즘(`(shop)` 라우트 그룹)과 그 비용(테스트 12개, PRESERVE 핀 이동 승인)은 plan-phase 중 두 차례의 blocker 보고와 사용자 승인으로 확정됐다. plan-phase 종료 시점에 미해결 모호성이 없다.
