---
id: SPEC-DESIGN-001
title: "공통 디자인 토큰 체계 수립과 전체 사이트 반영"
version: "0.2.0"
status: draft
created: 2026-09-05
updated: 2026-09-05
author: snake
priority: P1
phase: "v0.3.0 target"
module: "src/app, src/components"
lifecycle: spec-anchored
tags: "design-system, design-tokens, tailwind, theme, ui-primitives, claude-design, refactor"
tier: M
depends_on: [SPEC-STOREFRONT-001, SPEC-STOREFRONT-002, SPEC-AUTH-003]
related_specs: [SPEC-STOREFRONT-003, SPEC-AUTH-002, SPEC-AUTH-004, SPEC-ADMIN-002]
---

## HISTORY

| 날짜 | 버전 | 상태 | 비고 |
|---|---|---|---|
| 2026-09-05 | 0.1.0 | draft | plan-phase 최초 작성. 이 저장소가 **네 차례** 명시적으로 "범위 밖"으로 선언했던 디자인 토큰 체계·`src/components/ui/` 재사용 라이브러리를 **의도적으로 뒤집는** 첫 SPEC이다(§1.1 — STOREFRONT-001/002/003, AUTH-003). 착수 전 사용자가 AskUserQuestion으로 확정한 두 결정(Tier M, 단일 패스 전체 사이트 반영)을 반영했다. 미해결 명료화 항목 0건. UI 노출 SPEC이므로 Conditional Design Route(`plan → design → run`)를 탄다. |
| 2026-09-05 | 0.2.0 | draft | **핵심 프레이밍 전환 — "기계적 통합"에서 "실제 시각 방향 전환"으로**(§1.2 신설). DesignSync 인가로 대상 디자인 시스템 **"Classical"**(편집·서적풍)의 실제 토큰을 확보한 결과, 최초 전제가 틀렸음이 드러났다: Classical의 버튼은 **아웃라인**(현재 코드는 `bg-neutral-900` 솔리드 채움)이고 타이포는 **Cormorant Garamond + Lora 세리프**(현재는 시스템 sans)로, 현재 코드베이스와 **정반대**다. 따라서 13개 파일의 기존 수렴은 "보존해 토큰화할 자산"이 아니라 **교체 지점의 지도**로 역할이 바뀌었다. 확정 토큰은 `plan.md` §D.1에 원문 고정(값 이연 해소 — §1.5), REQ-002/005/008/009/010 및 AC-001/003/005/008/010/013/014 갱신, 범위 추가 2건(`SiteHeader.tsx`·`ProductCard.tsx`), 폰트 로딩 결정 확정(`next/font/google` + M0 안전장치). AC 총수는 16건 유지. |

---

## §1. 개요

`our-shop` 전체(15개 페이지, 5개 컴포넌트 도메인)에 **공통 디자인 토큰 체계**를 수립하고 일관되게 반영한다. 토큰의 원천은 사용자가 **Claude Design에 이미 만들어 둔 디자인 시스템 프로젝트**이며, 이 SPEC은 그 원천을 코드에 내려받아 고정하는 작업이다.

구체적으로 두 가지를 만든다.

1. `src/app/globals.css`에 Tailwind v4 `@theme` 블록 — 색상 역할·타이포그래피 스케일·간격·라운드 반경.
2. `src/components/ui/` 공유 프리미티브 레이어 — 지금 여러 파일에 문자열로 복제되어 있는 버튼·폼 필드 패턴의 단일 정의처.

### §1.1 이 SPEC은 선행 결정의 **의도적 반전**이다

이 저장소는 디자인 토큰 체계와 `src/components/ui/`를 **이름을 지목해 네 차례** 범위 밖으로 선언했다. 이 SPEC은 그 결정을 되돌린다 — 선행 SPEC들이 놓친 것이 아니라, 그때는 그 권한(mandate)이 없었고 이 SPEC이 처음으로 그 권한을 주장하는 것이다.

> 재사용 가능한 UI 컴포넌트 라이브러리(`src/components/ui/`), 디자인 토큰 체계, 다크 모드는 이번에 만들지 않는다.
> — SPEC-STOREFRONT-001 `spec.md` §3, `### Out of Scope — 디자인 시스템 및 SEO 심화` (141-143행)

> 수량 스테퍼·버튼 등을 위한 별도 디자인 토큰 체계나 `src/components/ui/` 재사용 라이브러리 구축은 이번 범위 밖이다(SPEC-STOREFRONT-001과 동일 결정).
> — SPEC-STOREFRONT-002 `spec.md` §3, `### Out of Scope — 디자인 시스템·재사용 컴포넌트 라이브러리` (157-159행)

> 재사용 가능한 UI 컴포넌트 라이브러리(`src/components/ui/`), 디자인 토큰 체계, 다크 모드는 이번에 만들지 않는다 — SPEC-STOREFRONT-001·SPEC-STOREFRONT-002와 동일 결정(§1).
> — SPEC-STOREFRONT-003 `spec.md` §3 (132행)

> 재사용 UI 컴포넌트 라이브러리(`src/components/ui/`), 디자인 토큰 체계, 다크 모드, 스크롤 고정(sticky) 동작, 진입 애니메이션은 만들지 않는다. 헤더의 시각 처리는 기존 화면들이 이미 쓰는 Tailwind 유틸리티 관례를 따르는 선까지다.
> — SPEC-AUTH-003 `spec.md` §3 (179행)

**네 번째 인용(SPEC-AUTH-003)은 특별히 중요하다.** 그 SPEC은 이 SPEC의 `depends_on:`에 이미 들어 있고, 이 SPEC은 그 `plan.md:204`(PRESERVE 목록)를 §C에서 인용한다. 즉 같은 SPEC이 **제약의 출처이자 반전 대상**이다 — 그리고 그 SPEC이 만든 `LogoutButton`의 스타일 부재(§1.2)는 바로 저 문장("기존 Tailwind 유틸리티 관례를 따르는 선까지")을 지키려다 유틸리티조차 붙이지 못한 결과다.

그리고 그 결정은 코드에도 주석으로 박제되어 있다. `src/app/globals.css`가 `@theme` 블록을 갖지 않는 이유를 스스로 이렇게 설명한다:

> No `@theme` block: a design-token system is excluded by spec.md §3, and inventing one here would fix project-wide styling decisions this SPEC has no mandate to make.
> — `src/app/globals.css` (SPEC-STOREFRONT-001 M1이 남긴 주석)

**이 SPEC이 바로 그 "mandate"다.** 위 주석은 이번에 삭제·교체된다.

인접 선례 한 건도 함께 기록한다. SPEC-AUTH-002는 디자인 시스템 자체가 아니라 **공통 헤더/내비게이션**을 범위 밖으로 두면서 "SPEC-STOREFRONT-001/002가 동일하게 이연했다"고 같은 이연 흐름을 인용했다(`spec.md` 106-107행).

정리하면 — 디자인 시스템/`src/components/ui/`를 **이름으로 제외한 SPEC 4건**(STOREFRONT-001/002/003, AUTH-003) + **그 이연 논리를 인용한 SPEC 1건**(AUTH-002). 네 건 모두 `status: completed`이며, 결정이 한 번의 판단이 아니라 **네 차례 재확인된 저장소 관례**였음을 보여준다. 그만큼 이 SPEC의 반전은 명시적이어야 한다.

### §1.2 [정정] 이것은 기계적 통합이 아니라 **실제 시각 방향 전환**이다

> **이 절은 이전 판의 핵심 전제를 뒤집는다.** 최초 작성 시점에는 Claude Design의 실제 토큰을 볼 수 없었고, 그래서 이 SPEC을 "이미 수렴한 값을 토큰으로 승격시키는 통합(consolidation)"으로 규정했다. 이후 DesignSync가 인가되어 실제 대상 디자인 시스템(**"Classical"** — 편집·서적풍 시스템)을 확인했고, **그 전제가 틀렸음이 드러났다.**

Classical의 실제 스타일은 현재 코드베이스가 수렴해 있는 값과 **정반대**다.

| 축 | 현재 코드베이스 | Classical (실제 대상) | 관계 |
|---|---|---|---|
| 기본 버튼 | `bg-neutral-900` **솔리드 채움** + 흰 글자 (13개 파일) | **아웃라인** — `background: transparent`, accent 색 테두리·글자 | **정반대** |
| 타이포그래피 | 시스템 sans-serif 스택 (`globals.css`) | **Cormorant Garamond**(제목) + **Lora**(본문) 세리프 페어링 | **완전 교체** |
| 색상 | 무채색 neutral 계열 | 따뜻한 종이색 배경(`#f3f2f2`) + 단일 금색 accent(`#b68235`) | **완전 교체** |
| 구분선 | `border-neutral-300` | 헤어라인(`color-mix` 16% 잉크) | 교체 |

Classical의 readme는 이를 명시적으로 못박는다:

> Do not fill cards or buttons with solid accent color.

즉 **현재의 13개 파일 수렴은 "보존해서 토큰화할 자산"이 아니라 "교체 대상"이다.** 이 구분은 실질적이다 — 이전 전제대로 진행했다면 구현자가 현재의 솔리드 스타일을 그대로 토큰으로 굳혀, 목표와 정반대인 결과를 만들었을 것이다.

**그럼에도 13개 파일 수렴은 여전히 이 SPEC의 핵심 자산이다** — 다만 역할이 다르다. 값의 원천이 아니라 **교체 지점의 정확한 지도**다. 한 문자열이 13곳에 동일하게 복제되어 있다는 사실은, 프리미티브를 하나 만들어 그 13곳을 갈아끼우면 사이트 전체 버튼이 일관되게 전환된다는 뜻이다. 수렴이 없었다면 같은 작업이 13번의 개별 판단이었을 것이다.

**변하지 않는 것**: 단일 정의처를 세운다는 구조적 목표, `LogoutButton` 결함 수정, 15개 페이지 전수 반영, 동작 불변(REQ-DESIGN-007).
**변하는 것**: 결과 화면의 외형. 이 SPEC은 시각적으로 **눈에 띄는 변화**를 만든다(§3의 "시각적 재디자인 제외" 항목도 이에 맞춰 정정했다).

### §1.3 복제 실측 — 교체 지점의 지도

현재 코드베이스는 **교체 대상**이지만, 그 교체 지점은 이미 잘 정리되어 있다 — 스타일이 엉망이라서가 아니라, 같은 문자열이 반복되기 때문이다.

| 관측 | 실측값 | 성격 |
|---|---|---|
| 기본 액션 버튼 클래스 문자열 | **13개 파일**이 `rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white` 를 공유 | 복제(일관됨) |
| 폼 입력 클래스 문자열 | **7개 파일**이 `mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm` 를 **정확히** 공유 | 복제(일관됨) |
| 폼 입력 — 근접 변형 1건 | `CheckoutInteractive.tsx:138`은 동일 패턴이나 선행 `mt-1`이 없다 (`w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900`) | 근접 변형 |
| `LogoutButton.tsx:48` | `className` **전무** | 실제 이탈(불일치) |

폼 입력의 정확 일치는 **7건**이고, `CheckoutInteractive.tsx`는 `mt-1` 하나만 다른 8번째 소비자다. 이 SPEC은 그 파일을 **포함**한다 — 차이가 여백 하나뿐이라 프리미티브의 여백 prop으로 흡수되며, 제외하면 같은 화면 안에서 한 입력만 다른 경로를 타게 된다. 다만 "정확 일치 7 + 근접 변형 1"이라는 구분은 인수 기준에 그대로 반영한다(AC-DESIGN-009).

**이 수렴이 단일 패스를 가능하게 한다.** 13곳이 동일 문자열이므로 프리미티브 하나로 일괄 전환되고, 값이 제각각이었다면 필요했을 13번의 개별 판단이 사라진다. 다만 §1.2가 정정한 대로 **결과 값은 보존되지 않고 Classical 값으로 교체된다** — 수렴은 작업량을 줄여 줄 뿐, 목표 스타일을 정하지 않는다.

`LogoutButton`은 이 지도에서 유일하게 비어 있는 칸이다. 스타일이 하나도 없어 브라우저 기본 버튼으로 렌더되며, §2에 전용 요구사항으로 고정한다.

### §1.4 확정된 범위 결정 (착수 전 사용자 승인 완료)

1. **Tier M.** 이 저장소에서 디자인 산출물을 만든 선행 SPEC(SPEC-STOREFRONT-002 `design.md`, SPEC-STOREFRONT-003 `design-notes.md`)은 모두 Tier M으로 Conditional Design Route를 탔고 Tier L을 요구한 적이 없다. 단일 파일 1000 LOC 초과 우려도 없다.
2. **단일 패스 전체 사이트 반영.** 페이지 그룹별로 SPEC을 쪼개지 않는다. 15개 페이지 전부를 이 SPEC 하나에서 다룬다(내부 마일스톤 순서화는 허용 — plan.md §F).

### §1.5 토큰 값의 출처 — 확보 완료 (이전 판에서 변경)

이전 판은 "구체적 값은 design phase에서 내려받는다"고 이연했다. **그 이연은 해소됐다** — DesignSync 인가 후 Classical 프로젝트의 `styles.css` / `readme.md` / 컴포넌트 페이지를 실제로 읽어 확정 토큰 값을 확보했다. 전체 토큰 블록은 `plan.md` §D.1에 원문 그대로 인용되어 있으며, 그것이 이 SPEC의 값 SSOT다.

여전히 유효한 원칙: **이 SPEC이 값을 발명하지 않는다.** 값은 Classical에서 왔고, plan/run 어느 단계도 새 색상이나 스케일을 만들어 내지 않는다. 달라진 것은 그 값을 이제 *알고 있다*는 점뿐이다.

---

## §2. 요구사항 (GEARS)

### 토큰 체계

**REQ-DESIGN-001** (Ubiquitous)
The stylesheet `src/app/globals.css` shall define a Tailwind v4 `@theme` block declaring named token roles in four categories: color, typography scale, spacing, and border radius.

**REQ-DESIGN-002** (Ubiquitous)
The `@theme` block shall carry the token values of the "Classical" design system verbatim as its source of truth, and the stylesheet shall not retain the SPEC-STOREFRONT-001 comment asserting that no `@theme` block exists.

### 공유 프리미티브 레이어

**REQ-DESIGN-003** (Ubiquitous)
The component library shall provide a shared primitives directory `src/components/ui/` containing a button primitive and form-field primitives (field input, field label, field error text).

**REQ-DESIGN-004** (Ubiquitous)
Each primitive in `src/components/ui/` shall express its visual appearance through the `@theme` token roles defined by REQ-DESIGN-001, and shall not hard-code palette or spacing literals that bypass those roles.

### 반영 범위

**REQ-DESIGN-005** (Ubiquitous)
Every primary-action button and every form field across all 15 application pages shall render through the `src/components/ui/` primitives rather than through a locally repeated Tailwind class string, and every primary-action button shall render in the Classical **outlined** style — transparent background with an accent-colour border and accent-colour text — and shall not render as a solid-filled button.

**REQ-DESIGN-006** (Event-driven)
**When** a user opens the site header while a session is active, the `LogoutButton` component shall render with the shared button primitive's styling rather than with browser-default button styling.

**REQ-DESIGN-007** (Unwanted)
The rollout shall not alter the rendered DOM semantics, accessible names, form submission behavior, or routing of any page it restyles.

### 디자인 원천 연동 (design phase)

**REQ-DESIGN-008** (Ubiquitous)
The `@theme` token values shall be transcribed verbatim from the Classical token block recorded in `plan.md` §D.1, and shall not be paraphrased, re-derived from the existing codebase, or rounded.

**REQ-DESIGN-009** (Capability gate)
**Where** the DesignSync tool is operational when the design phase runs, the design phase shall re-verify the `plan.md` §D.1 token block against the live Classical project and record any divergence before implementation begins.

**REQ-DESIGN-010** (Event-detected)
**When** the design phase detects that the DesignSync tool is unavailable, the design phase shall proceed using the `plan.md` §D.1 verbatim token block as the offline source of truth, and shall record that no live re-verification occurred.

### 경계 보존

**REQ-DESIGN-011** (Unwanted)
The rollout shall not relocate staff components out of their route-colocated positions under `src/app/staff/`.

**REQ-DESIGN-012** (Ubiquitous)
The rollout shall preserve the passing state of the existing test suite, measured against a baseline captured before the first rollout edit.

**REQ-DESIGN-013** (Ubiquitous)
Each new primitive module shall carry the `@MX` annotations its call-in count and role require.

---

## §3. 범위 밖 (Out of Scope)

### Out of Scope — 다크 모드
- 다크 모드 테마, `prefers-color-scheme` 대응, 색상 역할의 라이트/다크 이중 정의는 이번 범위 밖이다. `@theme`은 단일(라이트) 팔레트만 정의한다. SPEC-STOREFRONT-001이 다크 모드를 디자인 토큰과 함께 제외했고, 이 SPEC은 토큰만 되살리고 다크 모드는 이연한다.

### Out of Scope — 레이아웃 재설계
- **색·타이포·버튼 스타일은 바뀐다**(§1.2 — Classical 적용). 이 절이 제외하는 것은 **레이아웃**이다: 화면 구조 변경, 그리드 재배치, 신규 화면, 컴포넌트 계층 개편은 하지 않는다. 토큰과 프리미티브를 갈아끼우는 선까지다.
- Classical의 여백 스케일(`--space-*`)은 토큰으로 도입하되, 각 화면의 여백 배치를 재설계하지는 않는다.
- 픽셀 단위 완전 일치(total pixel parity)는 주장하지 않는다 — 검증 가능한 범위는 이 SPEC이 실제로 건드린 요소(버튼·폼 필드·카드·헤더)로 한정한다.
- Classical이 제공하지만 이 저장소에 대응 컴포넌트가 없는 클래스(`.table`, `.dialog`, `.tag`, `.seg`, `.plate` 등)는 도입하지 않는다. 기존 컴포넌트가 이미 필요로 하는 것만 매핑한다.

### Out of Scope — 위험/파괴적 액션 버튼 변형
- 위험(destructive) 액션 버튼은 이번 범위 밖이다. `src/app/staff/orders/[orderId]/CancelOrderButton.tsx:88`은 `rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60`을 쓰며, 이는 13개 파일이 공유하는 **기본 액션 수렴(`bg-neutral-900`)과 별개의 의미론적 색상**이다.
- 이 SPEC은 **기본 액션 버튼 수렴만** 다룬다. 위험 변형을 프리미티브에 편입하면 인수 기준이 늘어나는데, 이번 Tier M 예산(AC 16건, 여유 0)이 그것을 수용하지 못한다.
- **Classical은 위험 변형용 색상 역할을 제공하지 않는다** — 팔레트가 단일 accent(mono) 체계이며 `--color-accent` 하나뿐이다. 따라서 위험 변형 처리는 값 매핑이 아니라 **디자인 결정**(Classical에 없는 역할을 새로 정의)이 되며, 이는 이 SPEC의 "값을 발명하지 않는다"(§1.5) 원칙과 정면으로 충돌한다. 후속 SPEC이 Classical 소유자와 함께 결정해야 한다.
- `CancelOrderButton.tsx`는 따라서 **수정 대상이 아니다**(plan.md §C.2 수정 목록에서 제외). `bg-red-600` 솔리드 채움 상태로 남으며, 이는 Classical의 "솔리드 채움 금지"와 어긋나는 **알려진 잔여 불일치**다 — 숨기지 않고 §4에 이월한다.

### Out of Scope — 프리미티브 확장
- 모달·토스트·드롭다운·탭·테이블 등 현재 코드에 복제 패턴이 존재하지 않는 컴포넌트는 만들지 않는다. 프리미티브는 실측된 복제(버튼 13개 파일, 폼 필드 8개 파일)에 대응하는 것만 만든다.
- CVA(class-variance-authority) 등 신규 의존성 도입은 범위 밖이다.

### Out of Scope — 스태프 컴포넌트 재배치
- `src/app/staff/**`에 라우트 코로케이션된 컴포넌트(`ProductForm.tsx`, `CancelOrderButton.tsx`)를 `src/components/`로 옮기지 않는다. 코로케이션은 SPEC-ADMIN-002가 확립한 명시적 저장소 관례이며, 이 SPEC이 뒤집을 대상이 아니다(REQ-DESIGN-011).

### Out of Scope — 브랜드 인터뷰
- `.moai/project/brand/` 신규 작성과 `design.yaml`의 `interview_on_first_run` 브랜드 인터뷰는 이 SPEC의 1차 경로가 아니다. 디자인 원천이 이미 Claude Design 프로젝트로 존재하므로 D1-D2의 내려받기가 인터뷰를 대체한다(plan.md §B.3).

### Out of Scope — SEO·접근성 전면 감사
- 구조화 데이터·메타데이터·접근성 전면 감사는 이 SPEC이 다루지 않는다. 다만 REQ-DESIGN-007이 기존 접근성 이름의 보존을 요구하고, Classical의 `:focus-visible` 규칙은 토큰 도입에 포함된다(plan.md §D.4).
- **웹폰트는 더 이상 범위 밖이 아니다**(이전 판에서 변경) — Classical이 Cormorant Garamond + Lora를 요구하므로 폰트 로딩이 이 SPEC의 필수 작업이 됐다. 로딩 방식 결정은 plan.md §B.5. 다만 서브세팅 최적화·가변폰트 전환은 여전히 범위 밖이다.

---

## §4. 후속 SPEC을 위한 전방 포인터

- **다크 모드**: `@theme`이 색상 역할을 이름으로 갖게 되므로, 후속 SPEC은 역할별 다크 값만 추가하면 된다.
- **위험/파괴적 액션 변형**: `CancelOrderButton.tsx`(`bg-red-600`)를 포함한 destructive 변형. **Classical이 위험용 색상 역할을 제공하지 않으므로**(단일 accent mono 체계) 후속 SPEC은 값 매핑이 아니라 Classical 소유자와의 디자인 결정부터 시작해야 한다.
- **Lucide 아이콘 도입**: Classical readme가 지정하지만 `package.json`에 `lucide-react`가 없고, 이 SPEC이 건드리는 요소에 아이콘 사용처가 없어 이월했다(plan.md §B.6).
- **`.plate` 사진 래퍼**: `ProductGallery.tsx` 등 이미지 컴포넌트에 Classical의 `.plate` 처리를 적용하는 작업. 이 SPEC은 이미지 컴포넌트를 계획 대상에 포함하지 않았다(plan.md §D.3).
- **미도입 Classical 클래스**: `.table` / `.dialog` / `.tag` / `.seg` / `.radio` — 대응 컴포넌트가 생기는 시점에 이 SPEC이 세운 토큰 위에서 도입한다.
- **프리미티브 확장**: 모달·토스트 등은 실제 복제가 관측되는 시점에 이 레이어를 이어받는다.
- **Classical 원본 변경 시 재동기화**: 이 SPEC이 `@theme`에 고정한 값은 §D.1 시점의 Classical 스냅샷이다. Classical 프로젝트가 이후 갱신되면 §D.1 블록과 `@theme`을 함께 다시 맞춰야 한다. **잠정 값은 없다** — 모든 값이 실제 Classical에서 왔으므로(§1.5), 이전 판이 상정했던 "로컬 등가 잠정 토큰의 사후 대체"는 발생하지 않는다.
