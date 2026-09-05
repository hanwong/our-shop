# SPEC-DESIGN-001 (Compact) — 공통 디자인 토큰 체계 수립과 전체 사이트 반영

> Run-phase 로딩용 압축본. 반전 배경·기술 접근·PRESERVE 상호작용 근거는 spec.md/plan.md 참고.

## 핵심 전제 (3줄)

1. 이 SPEC은 선행 **4건**(STOREFRONT-001:143 / -002:159 / -003:132, AUTH-003:179)이 **이름을 지목해 제외**했던 디자인 토큰 + `src/components/ui/`를 의도적으로 되살린다. `globals.css`의 "no mandate" 주석이 교체 대상이다.
2. **[정정] 이것은 기계적 통합이 아니라 실제 시각 방향 전환이다.** 대상 시스템 **"Classical"**(편집·서적풍)은 현재 코드와 정반대다 — 버튼이 **아웃라인**(현재: `bg-neutral-900` 솔리드), 타이포가 **Cormorant Garamond + Lora 세리프**(현재: 시스템 sans), 배경이 종이색 `#f3f2f2`. Classical readme: *"Do not fill cards or buttons with solid accent color."*
3. 현재의 13개 파일 수렴은 **보존 대상이 아니라 교체 지점의 지도**다. 프리미티브 하나로 13곳이 일괄 전환된다.
4. 토큰 **값은 확보 완료** — plan.md §D.1에 Classical `styles.css` 원문이 고정되어 있다. run-phase는 **축자 전사**할 뿐 재계산·의역·반올림하지 않는다(REQ-DESIGN-008).

## Requirements (GEARS, REQ-DESIGN-001 ~ 013)

- **REQ-DESIGN-001** (Ubiquitous): `globals.css`가 색상·타이포 스케일·간격·반경 4개 카테고리의 토큰 역할을 선언하는 Tailwind v4 `@theme` 블록을 가져야 한다.
- **REQ-DESIGN-002** (Ubiquitous): `@theme`은 **Classical 토큰 값을 축자로** 담아야 하며, "no `@theme` block" 주장을 담은 기존 주석을 남겨서는 안 된다.
- **REQ-DESIGN-003** (Ubiquitous): `src/components/ui/`에 버튼 프리미티브와 폼 필드 프리미티브(입력·라벨·오류 텍스트)를 제공해야 한다.
- **REQ-DESIGN-004** (Ubiquitous): 각 프리미티브는 `@theme` 토큰 역할을 경유해야 하며 팔레트·간격 리터럴을 하드코딩해서는 안 된다.
- **REQ-DESIGN-005** (Ubiquitous): 15개 페이지 전체의 기본 액션 버튼과 폼 필드가 지역 복제 클래스 문자열이 아니라 프리미티브를 경유해 렌더되어야 하며, 기본 액션 버튼은 Classical **아웃라인** 스타일(투명 배경 + accent 테두리·글자)로 렌더되고 **솔리드 채움이어서는 안 된다**.
- **REQ-DESIGN-006** (When): 세션 활성 상태에서 헤더가 열리면, `LogoutButton`이 브라우저 기본 스타일이 아니라 공유 버튼 프리미티브 스타일로 렌더되어야 한다.
- **REQ-DESIGN-007** (Unwanted): 롤아웃은 재스타일한 페이지의 DOM 의미·접근성 이름·폼 제출 동작·라우팅을 변경해서는 안 된다.
- **REQ-DESIGN-008** (Ubiquitous): `@theme` 토큰 값은 plan.md §D.1의 Classical 블록에서 **축자 전사**해야 하며, 의역·코드에서 역산·반올림해서는 안 된다.
- **REQ-DESIGN-009** (Where): design phase 실행 시 DesignSync가 동작하는 경우, §D.1 블록을 라이브 Classical 프로젝트와 대조해 불일치를 구현 착수 전에 기록해야 한다.
- **REQ-DESIGN-010** (When-이벤트탐지): DesignSync 미가용이 탐지되면, design phase가 §D.1 블록을 오프라인 SSOT로 삼아 진행하고 라이브 재검증이 없었음을 기록해야 한다.
- **REQ-DESIGN-011** (Unwanted): 스태프 컴포넌트를 `src/app/staff/` 라우트 코로케이션 위치에서 이동시켜서는 안 된다.
- **REQ-DESIGN-012** (Ubiquitous): 첫 편집 이전에 캡처한 베이스라인 기준으로 기존 테스트 스위트의 통과 상태를 보존해야 한다.
- **REQ-DESIGN-013** (Ubiquitous): 신규 프리미티브 모듈은 fan-in과 역할이 요구하는 `@MX` 주석을 가져야 한다.

## Acceptance Criteria (Given-When-Then, AC-DESIGN-001 ~ 016)

전문은 `acceptance.md`. 이진 판정 명령 요약:

| AC | 판정 명령 / 기준 |
|---|---|
| 001 | `@theme` 존재 + **Classical 값 축자 일치**(`#f3f2f2`/`#b68235`/`4.6px`/`2px,4px,7px`/폰트 2종; `4.6px`→`5px` 반올림 금지) |
| 002 | `grep -c "No \`@theme\` block" src/app/globals.css` → 0 |
| 003 | 토큰 출처 "Classical (plan.md §D.1)" 명시 + 폰트 로딩 동작 + `layout.tsx` 낡은 주석 제거 |
| 004 | `ls src/components/ui/`에 버튼·폼 필드 프리미티브 존재 |
| 005 | `grep -rn "neutral-900\|neutral-300\|#[0-9a-fA-F]\{6\}" src/components/ui/` → 0건 · `grep -rn "focus-visible:ring" src/` → 0건 |
| 006 | `git diff --stat -- package.json` → 의존성 추가 0건 (**`lucide-react` 도입 안 함** — §B.6) |
| 007 | **`LogoutButton.tsx:48` 프리미티브 경유** (구체 결함 회귀 고정) |
| 008 | `grep -rl "rounded-md bg-neutral-900" src/ \| grep -v ui/` → 0건 **+ 아웃라인 렌더 단언 + accent 솔리드 채움 0건** |
| 009 | `grep -rl "w-full rounded-md border border-neutral-300" src/ \| grep -v ui/` → 0건 |
| 010 | 15개 페이지 전수 대조("해당 없음" 명시 포함) |
| 011 | 접근성 이름·폼 제출·라우팅 기존 단언 무파손 |
| 012 | 베이스라인 대비 신규 실패 0건 |
| 013 | DesignSync 재접근 불가 시: 도구 부재 + §D.1 오프라인 SSOT 사용 + 라이브 재검증 없음 기록 |
| 014 | DesignSync 재접근 가능 시: §D.1 ↔ 라이브 Classical 대조 결과 기록 |
| 015 | `git diff --name-only -- src/app/staff/` ⊆ plan.md §C.2 허용 목록 (**부분집합**, 정확 일치 아님) |
| 016 | fan-in ≥ 3 프리미티브에 `@MX:ANCHOR` |

## Files to Modify / Create

| 파일 | 종류 |
|---|---|
| `src/app/layout.tsx` | 수정 — **M0**: 폰트 로딩(§B.5) + 낡은 주석 교체. vitest 폰트 모킹 선행 필수 |
| `src/app/globals.css` | 수정 — §D.1 Classical 토큰 `@theme` 전사 + 낡은 주석 제거 + `:focus-visible` |
| `src/components/ui/` (버튼·폼 필드 프리미티브) | 신규 — 버튼은 **아웃라인** |
| `src/components/layout/LogoutButton.tsx` | 수정 — **48행 `<button>`만**, CSRF 코드·주석 무수정 |
| `src/components/layout/SiteHeader.tsx` | **수정 — 판정 변경**(이전: 무변경). Classical `.nav`/`.nav-brand` 1:1 매핑, **시각 스타일만**(§C.4) |
| `src/components/product/ProductCard.tsx` | 수정 — `.card` 계열 + 하드코딩 `focus-visible:ring-*` 제거(§D.4-4) |
| 고객 페이지 9 + 스태프 페이지 6 | 수정 — plan.md §F.3/§F.4 목록 |
| `src/components/{cart,checkout,orders,product}/**` | 수정 — 버튼·폼 필드 소비 지점 |
| `src/app/staff/products/ProductForm.tsx` | 수정 — plan.md §C.2 허용 목록 |
| `src/app/staff/orders/[orderId]/CancelOrderButton.tsx` | **범위 밖** — `bg-red-600` 위험 변형(spec.md §3) |
| `src/middleware.ts`, `src/lib/auth/**`, `prisma/schema.prisma` | **무변경(PRESERVE)** |

## Exclusions (What NOT to Build)

`spec.md` §3이 정본. 요약: 다크 모드 / **위험(destructive) 액션 버튼 변형**(Classical에 위험 색상 역할 부재) / **레이아웃 재설계**(색·타이포·버튼은 바뀐다) / 픽셀 패리티 주장 / 미대응 Classical 클래스(`.table`/`.dialog`/`.tag`/`.seg`/`.plate`) / **`lucide-react` 등 신규 의존성** / 스태프 컴포넌트 재배치 / 브랜드 인터뷰 1차 경로화 / SEO·접근성 전면 감사.

## 안티패턴 상위 3건 (갱신)

1. **현재의 솔리드 버튼 스타일을 그대로 토큰화하기.** 목표는 정반대(아웃라인)다 — AC-DESIGN-008 (b)/(c)가 이를 막는다.
2. **토큰 값을 재계산·반올림하기.** `4.6px`은 `5px`가 아니다. §D.1 축자 전사(REQ-DESIGN-008).
3. **vitest 폰트 모킹 없이 `next/font` import 추가하기.** 셸 테스트가 즉시 깨진다(선행 SPEC 실측) — M0가 이를 선행 작업으로 분리한다.

## 워크플로 경로

**Route B (PR 경유)** — Tier M 기본값인 Route A(main 직접 푸시)를 명시적으로 재정의한다. 근거: 약 23개 파일이 사이트 전역에 걸쳐 변경되므로 병합 전 리뷰가 필요. sync-phase에서 `--pr` 사용. 상세: plan.md §B.1b.

## 그 외 안티패턴

4. CSRF 파서를 공유 유틸로 추출하기 — SPEC-AUTH-003의 명시적 결정, 범위 밖(plan.md §C.3).
5. 레이아웃을 "겸사겸사" 개선하기 — 스타일은 바뀌지만 화면 구조는 그대로다.
6. `SiteHeader.tsx`의 렌더 구조·조건부 로직 건드리기 — 시각 스타일만 바꾼다(§C.4).
