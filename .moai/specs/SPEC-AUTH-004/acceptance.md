# SPEC-AUTH-004 — 인수 조건

> 판정 대상: AC-AUTH-048 ~ AC-AUTH-056 (9항목). 전부 기계적으로 관측 가능해야 하며, 주관적 판단("헤더가 안 보인다")은 판정 근거가 아니다.

---

## §0. 판정 하네스 노트

**왜 "staff 페이지를 렌더해서 헤더가 없는지 본다"가 충분한 증거가 아닌가.** 단위 테스트에서 staff 페이지 컴포넌트를 직접 렌더하면 레이아웃은 애초에 개입하지 않으므로, 헤더 부재는 **수정 전에도 참**이다. 그런 테스트는 결함이 있을 때도 통과하므로 판정력이 0이다.

따라서 REQ-AUTH-053/054의 판정은 **구조 합성 증명**으로 한다 — 세 명제를 각각 기계적으로 고정하면 "staff는 헤더를 렌더하지 않는다"가 따라 나온다:

1. 루트 레이아웃이 `SiteHeader`를 렌더하지 않는다 (AC-AUTH-049)
2. `SiteHeader`를 렌더하는 레이아웃은 `(shop)/layout.tsx` 하나뿐이다 (AC-AUTH-050)
3. `src/app/staff/`는 `(shop)` 그룹 밖에 있다 (AC-AUTH-048)

**패턴 B(마운트 없는 element 트리 검사)** 를 레이아웃 검증에 재사용한다 — `shell.test.tsx:33-40`이 이미 쓰는 관례이며, `<html>`/`<body>` 중첩 경고와 async 서버 컴포넌트 도달 불가 문제를 동시에 피한다.

---

## §1. 인수 조건

### 결함 제거 — staff 화면의 헤더 부재

**AC-AUTH-048** — staff 라우트가 헤더 상속 경로 밖에 있다 (구조)
- **Given** 이동 완료된 `src/app` 디렉터리 트리에서
- **When** staff 라우트 파일들의 실제 경로와 `(shop)` 그룹의 경로를 각각 열거하면
- **Then** 실재하는 staff 페이지 최소 2개(`src/app/staff/products/page.tsx`, `src/app/staff/orders/page.tsx`)가 `src/app/staff/` 아래에 그대로 있어야 하고, 그 경로 중 어느 것도 `src/app/(shop)/`으로 시작하지 않아야 하며, `src/app/staff/` 아래에 `layout.tsx`가 **존재하지 않아야** 한다 — staff는 루트 레이아웃만 통과한다.

**AC-AUTH-049** — 루트 레이아웃이 헤더를 렌더하지 않는다 (패턴 B + 정적 스캔)
- **Given** `RootLayout({ children: MARKER })`를 **호출만** 하고 마운트하지 않은 반환 element 트리에서
- **When** `<html>` → `<body>`로 내려가 `body.props.children`을 검사하면
- **Then** 그것이 전달한 `MARKER`와 동일해야 하고(배열로 감싸인 경우 그 안에 `SiteHeader` 참조가 **없어야** 함), 그리고 `src/app/layout.tsx` 소스에 `SiteHeader` 문자열이 **0건**이어야 한다 — 임포트조차 남기지 않는다.

**AC-AUTH-050** — `(shop)` 레이아웃이 헤더를 children 앞에 정확히 1회 렌더한다 (패턴 B)
- **Given** `ShopLayout({ children: MARKER })`를 호출만 한 반환 element 트리에서
- **When** 최상위 children 배열을 검사하면
- **Then** `children[0].type`이 `SiteHeader` 컴포넌트 참조와 **동일 참조**여야 하고, `children[1]`이 `MARKER`여야 하며, 트리 전체에서 `SiteHeader` 출현이 정확히 1회여야 한다. 또한 이 레이아웃은 `<html>`/`<body>`를 **선언하지 않아야** 한다(루트 레이아웃이 이미 선언하므로 중복 선언은 오류다).

**AC-AUTH-051** — 헤더를 렌더하는 레이아웃이 `(shop)` 하나뿐이다 (정적 스캔)
- **Given** `src/app` 아래 모든 `layout.tsx` 파일을 열거한 목록에서
- **When** 각 파일 소스에서 `SiteHeader` 참조를 검색하면
- **Then** `src/app/(shop)/layout.tsx` **단 하나만** 매치해야 하고, 다른 어떤 `layout.tsx`도 매치하지 않아야 한다 — 세션 상태와 무관하게(게스트 / 유효 staff 세션 / 만료·폐기 세션 셋 다) staff 경로에 헤더가 도달할 구조적 경로가 존재하지 않음이 이것으로 고정된다 (REQ-AUTH-054).

### 회귀 방지 — 고객 영역 불변

**AC-AUTH-052** — 고객 라우트 URL이 불변이다 (구조)
- **Given** 이동 전 고객 라우트 URL 목록(`/`, `/cart`, `/checkout`, `/checkout/complete/[orderId]`, `/login`, `/orders/lookup`, `/orders/lookup/[orderNumber]`, `/products/[productId]`, `/signup`)에서
- **When** 이동 후 파일 경로에서 `(shop)` 세그먼트를 제거해 URL을 재구성하면
- **Then** 9개 URL이 이동 전 목록과 **완전히 일치**해야 하고, `src/app/(shop)/` 아래에 `(shop)`이라는 문자열을 URL로 노출하는 라우트가 없어야 한다 — Next.js 라우트 그룹의 URL 투명성이 이 저장소에서 실제로 성립함을 고정한다.

**AC-AUTH-053** — 고객 헤더의 표시 동작이 이전과 동일하다
- **Given** `(shop)/layout.tsx`를 통과하는 고객 라우트 렌더 환경에서
- **When** `resolveSession()`이 `null`을 반환하는 경우와 `{userId, role}`을 반환하는 경우를 각각 렌더하면
- **Then** 전자는 `/login`으로 향하는 "로그인" 링크를, 후자는 "내 정보" 표시와 로그아웃 어포던스를 보여야 한다 — SPEC-AUTH-003 REQ-AUTH-042/043이 정한 동작이 이동 후에도 그대로여야 한다 (REQ-AUTH-056).

### 변경 범위 봉인

**AC-AUTH-054** — 테스트 변경이 정확히 12개이며 11개는 경로 전용이다

> All 113 test files / 1489 tests pass. Exactly 12 test files change: 11 mechanical path-only rewrites with zero assertion deltas (verifiable — diff contains only path-string changes), and 1 structural assertion update in `shell.test.tsx`. No other test file is touched.

- **Given** 구현 완료 후의 작업 트리에서
- **When** `npx vitest run`을 실행하고 `git diff --stat -- tests/`로 변경 테스트 파일을 열거하면
- **Then** 스위트가 **113 files / 1489 tests 전부 통과**해야 하고(baseline과 동일 — 신규 가드 추가분은 증가로 허용하되 감소·실패는 0), 변경된 테스트 파일이 **정확히 12개**여야 하며, 그중 `shell.test.tsx`를 제외한 **11개의 diff에는 경로 문자열 변경 외의 변경(단언·기대값·금지 토큰 목록·주석 의미 변경)이 0건**이어야 한다.
- **판정 방법**: 11개 파일의 `git diff`에서 제거 라인과 추가 라인을 짝지어, 각 짝이 경로 문자열(`@/app/…` 또는 `src/app/…`)만 다른지 확인한다. 짝이 맞지 않거나 경로 외 토큰이 다르면 실패다.

**AC-AUTH-055** — 이동 파일의 내용이 변경되지 않았다
- **Given** `git mv`로 이동한 §D.1의 소스 파일 10개에 대해
- **When** `git diff --stat <base> -- src/app/` 를 실행하면
- **Then** 각 이동 파일이 rename(0 insertions / 0 deletions)으로 보고되어야 한다.
- **미충족 시 처리**: git 설정이 rename으로 접지 못해 삭제+추가로 보고되면, 실패로 판정하지 않되 그 사실과 대체 검증(이동 전후 파일의 내용 해시 일치)을 `progress.md`에 **명시적으로 기록**해야 한다. 조용히 통과시키는 것은 금지한다.

**AC-AUTH-056** — PRESERVE 대상과 staff 트리가 무변경이며 관리자 헤더가 생성되지 않았다
- **Given** 구현 완료 후의 작업 트리에서
- **When** `git diff --stat <base> --` 로 REQ-AUTH-058의 대상(`src/middleware.ts`, `src/lib/auth/session-resolver.ts`, `src/features/admin/services/admin-session.ts`, `src/app/api/auth/logout/route.ts`, `src/components/layout/SiteHeader.tsx`, `src/components/layout/LogoutButton.tsx`, `prisma/schema.prisma`)과 `src/app/staff/`를 각각 확인하고, `src/app/staff/` 아래 파일 수를 이동 전후로 비교하면
- **Then** 모든 대상의 diff가 **비어 있어야** 하고, `src/app/staff/` 파일 수가 **13개로 동일**해야 하며(추가 0 / 삭제 0), 저장소 전체에서 관리자 전용 헤더·관리자 전용 로그아웃 컴포넌트로 볼 수 있는 신규 파일이 **0건**이어야 한다 (REQ-AUTH-057).

---

## §2. 요구사항 ↔ 인수 조건 추적

| 요구사항 | 인수 조건 | 판정 수단 |
|---|---|---|
| REQ-AUTH-050 (루트 레이아웃 헤더 미렌더) | AC-AUTH-049 | 패턴 B element 트리 + 소스 정적 스캔 0건 |
| REQ-AUTH-051 ((shop) 레이아웃이 헤더 1회 렌더) | AC-AUTH-050 | 패턴 B 동일 참조 비교 + 출현 1회 |
| REQ-AUTH-052 (고객 라우트가 (shop) 안에 위치) | AC-AUTH-048, AC-AUTH-052 | 경로 열거 + URL 재구성 일치 |
| REQ-AUTH-053 (staff 렌더 출력에 헤더 콘텐츠 부재) | AC-AUTH-048, AC-AUTH-049, AC-AUTH-050, AC-AUTH-051 | 구조 합성 증명 (§0) |
| REQ-AUTH-054 (세션 상태와 무관한 무조건 숨김) | AC-AUTH-051 | 헤더 렌더 레이아웃이 (shop) 유일 → staff 도달 경로 부재 |
| REQ-AUTH-055 (고객 URL 불변) | AC-AUTH-052 | URL 9개 완전 일치 |
| REQ-AUTH-056 (고객 헤더 표시 동작 불변) | AC-AUTH-053 | 두 세션 분기 렌더 검사 |
| REQ-AUTH-057 (관리자 헤더 미생성 · staff 무변경) | AC-AUTH-056 | `git diff --stat` 무변경 + 파일 수 13개 동일 + 신규 파일 0건 |
| REQ-AUTH-058 (PRESERVE 불가침) | AC-AUTH-056 | `git diff --stat` 무변경 |
| (범위 봉인 — 전 REQ 공통) | AC-AUTH-054, AC-AUTH-055 | 스위트 전수 통과 + 12개 정확 + 11개 경로 전용 diff + rename 무변경 |

---

## §3. 엣지 케이스

| 상황 | 기대 동작 |
|---|---|
| staff 구성원이 유효한 관리자 세션으로 `/staff/products` 진입 | 헤더 없음. 로그아웃 버튼이 화면에 존재하지 않으므로 §1.2의 무자각 세션 종료 경로가 사라진다 |
| 게스트가 `/staff/login` 진입 | 헤더 없음. 이전에는 고객용 `/login`으로 가는 "로그인" 링크가 관리자 로그인 화면에 함께 떠 혼선을 만들었다 |
| 만료·폐기된 세션으로 staff 경로 진입 | 헤더 없음. 기존 `resolveAdminSession()` 리다이렉트 동작은 이 SPEC이 건드리지 않는다 |
| 고객이 `/` 또는 `/cart` 진입 | 헤더가 이전과 동일하게 표시된다 (AC-AUTH-053) |
| `/products/[productId]` 직접 진입 | URL 불변, 화면 불변 (AC-AUTH-052, AC-AUTH-055) |

---

## §4. Definition of Done

- [ ] AC-AUTH-048 ~ AC-AUTH-056 (9항목) 전부 PASS
- [ ] `npx vitest run` — 113 files / 1489 tests 전부 통과, 실패 0
- [ ] `npx tsc --noEmit` exit 0
- [ ] `npm run lint` exit 0
- [ ] 변경 테스트 파일 정확히 12개, 그중 11개 경로 전용 diff 확인
- [ ] `src/app/staff/` `git diff --stat` 무변경, 파일 수 13개 유지
- [ ] REQ-AUTH-058 PRESERVE 목록 전체 `git diff --stat` 무변경
- [ ] §E의 @MX 태그 4종이 실제 소스에 반영
- [ ] `progress.md`에 rename 탐지 결과 기록 (접히지 않은 경우 명시)
