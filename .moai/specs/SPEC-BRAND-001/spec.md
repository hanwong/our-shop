---
id: SPEC-BRAND-001
title: "\"OUR\" 수제화 브랜드 전환 — 브랜드 아이덴티티·내비게이션·신규 페이지"
version: "0.3.1"
status: completed
created: 2026-09-07
updated: 2026-09-07
author: snake
priority: P1
phase: "v0.4.0 target"
module: "src/app, src/components, prisma, public"
lifecycle: spec-anchored
tags: "branding, design-tokens, navigation, storefront, seed-data, claude-design, static-assets"
tier: L
depends_on: [SPEC-DESIGN-001, SPEC-AUTH-003, SPEC-AUTH-004, SPEC-CATALOG-001]
related_specs: [SPEC-CATALOG-002, SPEC-STOREFRONT-001, SPEC-STOREFRONT-002, SPEC-STOREFRONT-003]
---

## HISTORY

| 날짜 | 버전 | 상태 | 비고 |
|---|---|---|---|
| 2026-09-07 | 0.3.1 | draft | **plan-audit iter2 FAIL(0.94 / 임계 0.85 — 점수는 넘었으나 계약 위반) 대응.** iter2가 잡아낸 것은 **D1이 미수정으로 남았다**는 사실이다: v0.3.0에서 §4.2의 *결론 산문*은 고쳤으나 바로 아래 **증거 블록(`research.md`)은 iter1과 바이트 동일**하게 방치되어 있었다. 낡은 블록은 `grep -n "accent-2"`가 **1줄**을 반환한다고 적었으나 실제로는 **2줄**을 반환한다(L50 평면 토큰 + L55 `--color-accent-200` 내부의 부분 문자열). 즉 "램프가 없다"는 결론의 근거로 부적합한 명령이었다. 명령을 `grep -c 'accent-2-'`(하이픈 포함 램프 접두사, 출력 `0`)로 교체하고, 이 세션에서 **직접 재실행하여 출력을 관찰**한 뒤 절 헤더를 `[확인됨 — iter3 재실행 관찰]`로 정정했다. 같은 절의 폰트 증거 블록(L67/L69)도 함께 재확인했고 정확했다. **자기 정정**: v0.3.0의 "14건 전량 반영" 주장은 과장이었다 — 실제로는 13건이 완료였고 D1은 2차 수정이 필요했다(아래 행 참조). |
| 2026-09-07 | 0.3.0 | draft | **plan-audit iter1 FAIL(0.81 / 임계 0.85) 대응 — 14건 중 13건 반영, D1은 미완(iter2가 적발, v0.3.1에서 완료).** 7개 must-pass는 전부 PASS였고, 지적은 결속·정합·귀속 층에 집중되었다. 주요 수정: ① **AC 예산 해소** — 상보 쌍 2건 병합(구 AC-011+012 → AC-012 세션 분기 양방향, 구 AC-022+023 → AC-023 사이즈 균일 상태)으로 2칸 확보, 검증 손실 0(`acceptance.md` §F). ② **미결속 변경 2건 결속** — shadow/divider 기준색 변경(`#2d2b2b`/`#201f1d` → `#1f1f1f`)을 REQ-008 열거에 편입 + AC-009 신설, `/shop` 필터의 `Category` 파생 주장을 REQ-014 열거에 편입 + AC-016 신설(행 추가·제거가 코드 변경 없이 반영되는지 실제 검증). ③ **상호 참조 정정** — `plan.md` §C PRESERVE 표의 AC 참조 6건 중 **4건**이 오류였음(감사 보고서는 3건으로 집계). ④ **증거 등급 정정** — `[전사 제공]` 등급 신설, §3.1/§3.3/§4.1 재분류(VCI §2 귀속). ⑤ **시로코 카테고리 판단 완화** — 대립 가설(Oxford)을 명시하고 design phase 재확인 항목으로 승격. REQ 24 유지, AC 25 유지. |
| 2026-09-07 | 0.2.0 | draft | **원천 데이터 추가 전사로 미확보 항목 2건 해소.** 오케스트레이터가 자신의 DesignSync 직접 조회 결과를 축자 제공: (a) `renderVals()` 제품 6종의 부제·가격 전문(`research.md` §3.1), (b) 그레이스케일 팔레트 토큰 블록 전문(§4.1). **M2(토큰) 차단 해제** — M1·M4·M6는 여전히 차단. 신규 발견 3건: ① 원천의 `--color-accent-2-100..900` 램프 9개가 코드베이스에 없어 추가 시 REQ-BRAND-007 위반(§4.2), ② 원천의 리터럴 폰트값을 복사하면 t51이 승인한 `var(--font-*-nf)` 수정을 무효화(§4.2), ③ 사이즈 범위 문자열이 `i % 3` 인덱스 파생 **합성 채움값**이라 시드 금지(§3.3) — REQ-BRAND-024 신설. 카테고리 모호 2건에 명시적 판단(`plan.md` §B.7): 시로코→더비, 하야마→**몽크 신설**. REQ 23→24, AC 25 유지(REQ-024를 AC-020 2번째 절로 접음). |
| 2026-09-07 | 0.1.0 | draft | plan-phase 최초 작성. Claude Design 프로젝트 **"OUR"**(`aa1263c0-57a7-4d65-8670-f5cb5e9daae7`)를 원천으로 삼아 `our-shop`을 수제화 브랜드 **"OUR"**로 전환한다. 착수 전 사용자가 AskUserQuestion으로 확정한 네 결정(§2.3)을 반영했다. UI 노출 SPEC이므로 Conditional Design Route(`plan → design → run`)를 탄다. 미해결 명료화 항목 0건. |

---

## §1. 개요

`our-shop`은 지금까지 **도메인 중립적인 일반 쇼핑몰**로 만들어져 왔다. 이 SPEC은 그 껍데기에 **구체적인 브랜드 정체성**을 입힌다: 285-330mm 큰 사이즈 전문, 주문 후 한 켤레씩 손으로 꿰매는 수제화 브랜드 **"OUR"**.

전환은 네 층위에서 일어난다.

1. **문자열 층** — 사이트 제목·홈 헤딩·패키지명이 `our-shop`에서 `OUR`로 바뀐다.
2. **시각 층** — SPEC-DESIGN-001이 세운 Classical 토큰 체계의 **값**이 골드 액센트에서 OUR 그레이스케일 팔레트로 재조정된다.
3. **구조 층** — 로그인 상태 표시만 하던 헤더가 SHOP·BESPOKE·STORY·CART 내비게이션을 갖춘 브랜드 헤더로 확장되고, 3개 신규 페이지가 추가된다.
4. **콘텐츠 층** — 목업에 등장하는 6개 실제 제품이 시드 데이터로 들어온다.

### §1.1 이 SPEC이 SPEC-DESIGN-001과 맺는 관계 (핵심 구분)

**이 SPEC은 SPEC-DESIGN-001의 구조적 결정을 다시 열지 않는다.**

SPEC-DESIGN-001은 Tailwind v4 `@theme` 블록 안에 CSS 커스텀 프로퍼티로 토큰 **아키텍처**를 세웠다(`--color-bg`, `--color-accent`, `--color-neutral-100..900`, `--space-*`, `--radius-*`, `--shadow-*`, `--font-*`). 이 SPEC이 바꾸는 것은 **그 프로퍼티들의 값(hex 코드)뿐**이다. 프로퍼티 **이름**은 하나도 추가·삭제·개명되지 않는다(REQ-BRAND-007).

즉:

| 층위 | 소유 SPEC | 이 SPEC의 행위 |
|---|---|---|
| 토큰 이름·구조·Tailwind 매핑 방식 | SPEC-DESIGN-001 | **건드리지 않음** |
| 토큰 값(hex) | SPEC-DESIGN-001이 골드 Classical로 고정 | **그레이스케일 OUR로 교체** |
| 폰트 스택(Cormorant Garamond / Lora) | SPEC-DESIGN-001 | **건드리지 않음** — OUR 원천도 동일 |

미래의 독자가 "BRAND-001이 DESIGN-001의 토큰 설계를 뒤집었다"고 읽지 않도록, 이 구분을 §1.1에 명시적으로 고정한다.

### §1.2 확인된 디자인 원천

Claude Design 프로젝트 **"OUR"**(`projectId: aa1263c0-57a7-4d65-8670-f5cb5e9daae7`)를 plan-phase에서 직접 읽어 확보했다. 원천 자료의 전문(全文) 인용은 `research.md`에 고정되어 있으며, run-phase는 DesignSync를 다시 호출하지 않고 `research.md`를 참조한다.

- `_ds/classical-*/styles.css` — Classical 시스템의 **그레이스케일 팔레트 오버라이드**
- `uploads/logo_mono_black.png`, `uploads/logo_gold_only.png` — 로고 에셋 2종
- `OUR UI Kit.dc.html` — 컴포넌트 레퍼런스 시트
- `OUR Store.dc.html` — 5개 인터랙티브 목업 화면(Home / Shop / Detail / Login / Signup)

---

## §2. 범위 판정과 확정된 결정

### §2.1 Tier L 판정 근거

이 저장소에서 "크고 횡단적인 단일 이니셔티브"의 가장 가까운 선례는 **SPEC-DESIGN-001(Tier M)**이다. 이 SPEC은 그보다 표면적이 넓다.

| 축 | SPEC-DESIGN-001 (Tier M) | SPEC-BRAND-001 (Tier L) |
|---|---|---|
| 관심사 개수 | **1개**(토큰 체계)를 전 사이트에 적용 | **여러 개**의 서로 다른 신규 서브시스템 |
| 신규 라우트 | 0개 | **3개**(`/shop`, `/bespoke`, `/story`) — 선례 없음 |
| 바이너리 에셋 | 없음 | **최초** — `public/` 디렉터리 자체가 저장소에 없음 |
| 시드 콘텐츠 | 없음 | **최초** 제품 시드 스크립트 |
| 내비게이션 구조 | 기존 헤더 재스타일 | 헤더 **내용 대폭 확장** |

Tier L 판정의 핵심은 "파일 수"가 아니라 **서로 독립적인 신규 서브시스템의 개수**다: 라우팅·에셋 파이프라인·콘텐츠 시드가 각각 처음 도입되며, 서로의 선례가 되어주지 못한다.

**분할하지 않는 이유**: SPEC-DESIGN-001은 15개 페이지·5개 컴포넌트 도메인에 걸친 작업을 **단일 SPEC + 내부 마일스톤(M0→M5)**으로 해결했고, 이 저장소에서 이런 종류의 판단에 대한 유일한 선례다. 이 SPEC도 그 패턴을 따라 **단일 SPEC-BRAND-001 + M0→M7 마일스톤**으로 간다. 브랜드 전환은 의미론적으로 하나의 사건이며, 문자열만 바뀌고 로고가 안 바뀐 중간 상태는 어떤 SPEC 경계에서도 배포 가능한 상태가 아니다.

### §2.2 스키마 변경이 필요 없다는 사실 (범위 축소 근거)

`prisma/schema.prisma`를 직접 읽어 확인했다. `Product`는 `name` / `price` / `description` / `images[]` / `stock` / `isActive` / `categoryId`를, `Category`는 `name` / `slug`를 갖는다. **전부 도메인 중립적**이다. 수제화 제품을 표현하는 데 새 컬럼이 필요 없다.

사이즈 표시가 **표시 전용**이라는 확정 결정(§2.3-3)과 결합하면, **이 SPEC은 Prisma 마이그레이션을 전혀 발생시키지 않는다.** 이것은 누락이 아니라 의도적으로 확인된 범위 축소 사실이다.

마찬가지로 `listProducts` 서비스가 이미 `category`(slug) 필터·`sort`(`newest`/`price_asc`/`price_desc`)·페이지네이션을 지원한다(`src/features/catalog/types/product.ts` 확인). `/shop`은 **새 조회 경로를 만들지 않고** 이 서비스를 재사용한다(REQ-BRAND-016).

### §2.3 사용자가 확정한 결정 (재론의 대상 아님)

1. `/shop` — 목업 리스트 화면대로 **실제 상품 목록 페이지**를 만든다(카테고리 필터 + 정렬). 내비만 홈으로 보내는 방식은 채택하지 않는다.
2. `/bespoke`·`/story` — **정적 안내 페이지만** 만든다. 주문 제작 플로우도, CMS도 만들지 않는다. **근거**: 디자인 원천 자체가 이 둘의 전용 화면을 갖고 있지 않다 — `OUR Store.dc.html`의 내비가 BESPOKE를 리스트 화면(`goList`)으로, STORY를 홈 화면(`goHome`)으로 연결한다. 즉 이것은 축소가 아니라 **원천에 맞춘 정확한 크기**다.
3. **사이즈 표시는 표시 전용**이다. 사이즈별 실재고 추적은 만들지 않으며, `Product.stock` 단일 정수가 유일한 재고 신호로 남는다(§3 Out of Scope에 전방 포인터).
4. **시드 데이터를 실제로 저작한다** — 목업의 명명 제품 6종을 `Category`/`Product` 행으로 생성하는 신규 시드 스크립트. 제품별 부제·가격은 `research.md` §3.1에 축자 전사되어 있다. 카테고리 배정 6건 중 4건은 원천이 명시하고, 모호한 2건(시로코·하야마)은 `plan.md` §B.7이 명시적 판단으로 잠정 해결한다(design phase 확인 대상) — `design.md` §3.5의 라이브 재조회 결과, 원천에 시로코·하야마 둘 다를 위한 전용 카테고리가 없다는 상위 사실이 확인되어 두 제품 모두 더비로 배정 확정되었고, 4번째 카테고리 `몽크` 신설안은 폐기되었다.

---

## §3. 범위 제외 (Out of Scope)

### Out of Scope — 사이즈별 실재고 추적 (Per-Size Inventory)

- 사이즈별 재고 수량을 저장하는 스키마(`ProductVariant` 등)를 도입하지 않는다. `Product.stock` 단일 정수가 유일한 재고 신호로 남는다(REQ-BRAND-023).
- 사이즈 선택 UI가 표시하는 비활성 상태는 **상품 전체의 품절 여부에서 파생된 표시**이며, 사이즈별 데이터가 아니다(REQ-BRAND-022).
- **전방 포인터**: 진짜 사이즈별 재고가 필요해지는 시점에 별도 SPEC(가칭 `SPEC-INVENTORY-001`)이 `ProductVariant` 모델과 마이그레이션을 다룬다. 그 SPEC이 REQ-BRAND-022/023을 대체한다.

### Out of Scope — 주문 제작(Bespoke) 플로우

- `/bespoke`에서 치수를 입력받거나, 주문 제작 요청을 제출하거나, 상담을 예약하는 기능을 만들지 않는다.
- 회원가입 화면의 발 길이/발볼 둘레 입력 필드(목업 Signup 화면에 OPTIONAL로 존재)는 이 SPEC에서 구현하지 않는다 — SPEC-AUTH-002가 소유한 화면이며, 선택 필드 추가는 스키마 변경을 부른다(§2.2의 무(無)마이그레이션 판정과 충돌).

### Out of Scope — JWT `ISSUER`/`AUDIENCE` 문자열 변경

- `src/lib/auth/jwt.ts`의 `ISSUER = "our-shop"` / `AUDIENCE = "our-shop-api"`를 변경하지 않는다(REQ-BRAND-004).
- **판단 근거**(명시적 결정, 누락 아님): 두 상수는 모듈 사설(private)이며 `jwt.ts` 안에서 서명·검증 양쪽에 동시에 쓰이는 **자기 정합적** 값이다(전체 저장소 grep 결과 참조처가 이 파일뿐임을 확인). 값을 바꿔도 기능은 깨지지 않지만, **이미 발급되어 유통 중인 모든 액세스 토큰이 `iss`/`aud` 불일치로 검증 실패**하여 전체 활성 세션이 조용히 로그아웃된다. 얻는 것은 사용자에게 보이지 않는 문자열의 미적 완결성이고, 치르는 것은 실재하는 세션 무효화 사건이다. 교환비가 맞지 않는다.
- **전방 포인터**: 브랜드 문자열 완결성이 필요해지면, 검증 측에서 구·신 `issuer`를 동시에 수용하는 이중 수용 기간을 둔 별도 SPEC으로 다룬다.

### Out of Scope — `.moai/project/product.md` 갱신

- `product.md`가 여전히 "B2C 패션 온라인 쇼핑몰"로 기술하고 있어 이 SPEC 완료 후 실제와 어긋난다는 사실은 확인했다(8·9·14·18행).
- 그럼에도 이 SPEC에서 갱신하지 **않는다**. `product.md`는 `/moai project`가 생성·재생성하는 기획 산출물이며, 코드 SPEC이 손으로 고치면 다음 `/moai project` 실행에 덮어쓰인다. 또한 이 SPEC이 건드리지 않는 `structure.md`/`tech.md`와 짝이 어긋난 상태를 만든다.
- **⚠️ "다음 재실행"은 일어나지 않을 수 있다 (측정된 사실)**. plan-audit iter1 D14가 제기하고 manager-spec이 직접 확인했다:

  ```
  $ git log --oneline --follow -- .moai/project/product.md
  d5dc00e chore: initialize git repository with project scaffold
  ```

  커밋이 **단 1개** — 최초 스캐폴드뿐이다. 이 저장소에서 `/moai project`는 **한 번도 재실행된 적이 없다**. 따라서 "다음 재실행 때 갱신된다"는 전방 포인터는 사실상 발화하지 않는 조건에 기대는 것이며, 그대로 두면 `product.md`는 영구히 낡은 채 남는다.

- **추적 가능한 형태로 승격**: 이 SPEC 완료 시점에 **별도 백로그 카드를 실제로 생성**한다 — `moai todo add "SPEC-BRAND-001 후속: /moai project 재실행으로 product.md/structure.md/tech.md를 수제화 브랜드 OUR 기준으로 갱신 (product.md는 스캐폴드 이후 무갱신 상태)"`. 카드 생성은 sync-phase 완료 보고에 포함되며, 큐에 남아 있는 한 소실되지 않는다.
- 이것은 여전히 **이 SPEC의 AC가 아니다**(코드 SPEC이 기획 산출물을 소유하지 않는다는 판단은 유지). 바뀐 것은 후속 조치의 **추적 가능성**이지 범위가 아니다.

### Out of Scope — 관리자 화면의 브랜드 반영

- `/staff/**`는 SPEC-AUTH-004가 `(shop)` 라우트 그룹 밖에 두기로 한 내부 운영 화면이며, 고객 대상 브랜드 표면이 아니다. 이 SPEC의 내비게이션·로고는 `/staff/**`에 도달하지 않는다(REQ-BRAND-013 / AC-BRAND-013).

### Out of Scope — 로고 이외의 브랜드 에셋

- 파비콘, OG 이미지, 소셜 공유 카드 이미지, 제품 사진은 이 SPEC에서 만들지 않는다. `public/` 컨벤션(REQ-BRAND-005)만 세우고, 그 위에 얹히는 후속 에셋은 별도 작업으로 남긴다.

---

## §4. 요구사항 (GEARS)

### §4.1 브랜드 문자열 (M0)

- **REQ-BRAND-001** (Ubiquitous): 루트 레이아웃(`src/app/layout.tsx`)의 `metadata.title`은 "OUR" 브랜드명을 표시해야 한다(shall), `description`은 수제화 브랜드를 기술해야 한다.
- **REQ-BRAND-002** (Ubiquitous): 홈 화면(`src/app/(shop)/page.tsx`)의 최상위 제목 요소는 "OUR" 브랜드명을 표시해야 한다(shall) — 현재의 리터럴 `our-shop`을 대체한다.
- **REQ-BRAND-003** (Ubiquitous): `package.json`의 `name` 필드는 "our" 브랜드 식별자를 반영해야 한다(shall).
- **REQ-BRAND-004** (Unwanted): 이 SPEC은 `src/lib/auth/jwt.ts`의 `ISSUER`/`AUDIENCE` 상수 값을 변경해서는 안 된다(shall not) — 근거는 §3.

### §4.2 정적 에셋 파이프라인 (M1)

- **REQ-BRAND-005** (Ubiquitous): 저장소는 정적 바이너리 에셋을 `public/brand/` 아래에 두는 컨벤션을 확립해야 하며(shall), 브랜드 로고 이미지 파일이 그 컨벤션의 첫 사례가 되어야 한다.
- **REQ-BRAND-006** (Ubiquitous): 로고 이미지는 `next/image`의 `Image` 컴포넌트로, 명시적 `width`/`height`와 비어 있지 않은 `alt` 텍스트를 갖고 렌더링되어야 한다(shall).

### §4.3 디자인 토큰 재조정 (M2)

- **REQ-BRAND-007** (Unwanted): 이 SPEC은 `src/app/globals.css`의 `@theme` 블록에서 CSS 커스텀 프로퍼티의 **이름**을 추가·삭제·개명해서는 안 되며(shall not), 폰트 토큰(`--font-heading`, `--font-heading-weight`, `--font-body`)의 값을 변경해서도 안 된다 — 색상 값만 교체한다. 원천에만 존재하는 `--color-accent-2-100..900` 램프는 추가 대상이 아니다(`research.md` §4.2).
- **REQ-BRAND-008** (Ubiquitous): `@theme` 블록의 색상 토큰 값은 OUR 그레이스케일 팔레트와 일치해야 한다(shall). 이는 **평면 토큰과 파생 토큰 양쪽**을 포함한다:
  - 평면 토큰 — `--color-bg: #f2f2f2`, `--color-surface: #e9e9e9`, `--color-text: #1f1f1f`, `--color-accent: #2b2b2b`, `--color-accent-2: #2b2b2b`, 그리고 `--color-neutral-*` / `--color-accent-*` 램프 전체.
  - **파생 토큰** — `--color-divider`와 `--shadow-sm` / `--shadow-md` / `--shadow-lg`의 `color-mix()` 기준색이 `#1f1f1f`이어야 하며, 구 기준색 `#201f1d`(divider)·`#2d2b2b`(shadow)가 남아 있어서는 안 된다. 기하 인자(오프셋·블러·퍼센트)는 변경 대상이 아니다.
- **REQ-BRAND-009** (Ubiquitous): 스타일시트는 이미지 래퍼용 `.plate` 클래스를 제공해야 하며(shall), 그 클래스는 `grayscale(1) contrast(1.05)` 필터를 적용해야 한다.

### §4.4 내비게이션 확장 (M3)

- **REQ-BRAND-010** (Ubiquitous): `SiteHeader` 컴포넌트는 브랜드 로고 링크와 SHOP·BESPOKE·STORY·CART 내비게이션 링크를 렌더링해야 한다(shall).
- **REQ-BRAND-011** (While, state-driven): **While** `resolveSession()`이 `null`을 반환하는 상태에서, `SiteHeader`는 로그인 링크를 렌더링해야 한다(shall) — SPEC-AUTH-003의 기존 동작을 그대로 보존한다.
- **REQ-BRAND-012** (While, state-driven): **While** `resolveSession()`이 유효 세션을 반환하는 상태에서, `SiteHeader`는 내 정보 표시와 로그아웃 버튼을 렌더링해야 한다(shall) — SPEC-AUTH-003의 기존 동작을 그대로 보존한다.
- **REQ-BRAND-013** (Unwanted): `SiteHeader`는 `(shop)` 라우트 그룹 밖의 라우트(`/staff/**`)에서 렌더링되어서는 안 된다(shall not) — SPEC-AUTH-004의 구조적 배치를 보존한다.

### §4.5 `/shop` 상품 목록 (M5)

- **REQ-BRAND-014** (Ubiquitous): `/shop` 라우트는 상품 목록 그리드와 카테고리 필터 컨트롤, 정렬 컨트롤을 렌더링해야 한다(shall). 카테고리 필터 컨트롤의 **목록은 `Category` 테이블에서 파생**되어야 하며, 카테고리 이름을 소스 코드에 하드코딩해서는 안 된다 — `Category` 행의 추가·제거가 코드 변경 없이 렌더링된 필터 집합에 반영되어야 한다.
- **REQ-BRAND-015** (When, event-driven): **When** 방문자가 특정 카테고리 필터를 선택하면, `/shop`은 해당 `Category.slug`에 속한 상품만 포함하도록 렌더링되는 상품 집합을 갱신해야 한다(shall).
- **REQ-BRAND-016** (Unwanted): `/shop`은 새로운 상품 조회 경로를 구현해서는 안 된다(shall not) — 기존 `listProducts` 서비스(SPEC-CATALOG-001)를 재사용해야 한다.

### §4.6 정적 안내 페이지 (M6)

- **REQ-BRAND-017** (Ubiquitous): `/bespoke` 라우트는 주문 제작 안내 정적 콘텐츠를 렌더링해야 하며(shall), 285-330mm 사이즈 범위, 수제 제작 방식, 약 4주 제작 기간, 15만-30만원 가격대를 포함해야 한다.
- **REQ-BRAND-018** (Ubiquitous): `/story` 라우트는 브랜드 스토리 정적 콘텐츠를 렌더링해야 한다(shall).
- **REQ-BRAND-019** (Unwanted): `/bespoke`와 `/story`는 서버 상태를 변경하는 어떤 상호작용 요소(주문 제출, 장바구니 담기, 폼 제출)도 포함해서는 안 된다(shall not).

### §4.7 제품 시드 (M4)

- **REQ-BRAND-020** (Ubiquitous): 시드 스크립트는 목업에 명명된 6개 제품(시로코·에지마·노마치·아키타·세토·하야마)을 `research.md` §3.1의 전사 가격·부제와 함께, 그리고 §3.2가 배정한 카테고리들을 `Product`/`Category` 행으로 생성해야 한다(shall).
- **REQ-BRAND-021** (When, event-driven): **When** 시드 스크립트가 이미 시드된 데이터베이스에 대해 재실행되면, 스크립트는 중복 행을 만들지 않고 기존 행을 갱신해야 한다(shall) — `upsert` 멱등성, `prisma/seed-coupons.ts`의 확립된 선례를 따른다.
- **REQ-BRAND-024** (Unwanted): 시드 스크립트는 목업의 인덱스 파생 사이즈 범위 문자열(`i % 3` 기반 `"250–330mm"` / `"260–320mm"`)을 `Product` 행에 저장해서는 안 된다(shall not) — 합성 채움값이며 제품 속성이 아니다(`research.md` §3.3).

### §4.8 사이즈 표시 (M7)

- **REQ-BRAND-022** (While, state-driven): **While** 상품의 `stock`이 `0`인 상태에서, 사이즈 선택 UI는 모든 사이즈 옵션을 비활성(disabled)으로 렌더링해야 한다(shall); **While** `stock`이 `0`보다 큰 상태에서는 모든 사이즈 옵션을 선택 가능하게 렌더링해야 한다.
- **REQ-BRAND-023** (Unwanted): 사이즈 선택 UI는 사이즈별 재고를 조회·저장·표현해서는 안 된다(shall not) — 개별 사이즈가 서로 다른 활성 상태를 갖는 렌더링은 허용되지 않는다.

---

## §5. 선행 SPEC과의 상호작용

| 선행 SPEC | 보존 대상 | 이 SPEC의 처리 |
|---|---|---|
| **SPEC-DESIGN-001** | `@theme` 토큰 **이름**·구조·폰트 스택 | 값만 교체(REQ-BRAND-007/008). 아키텍처 불변 — §1.1 |
| **SPEC-AUTH-003** | `SiteHeader`의 로그인 상태 분기(REQ-AUTH-038~043) | 분기 로직 그대로 보존, 주변에 내비 추가(REQ-BRAND-011/012) |
| **SPEC-AUTH-004** | 헤더가 `(shop)/layout.tsx`에만 존재(AC-AUTH-049) | **구조적 배치 불변**(REQ-BRAND-013). 이 SPEC은 컴포넌트 *내용*만 확장 |
| **SPEC-CATALOG-001** | `listProducts` 서비스 계약 | 재사용, 변경 없음(REQ-BRAND-016) |
| **SPEC-STOREFRONT-003** | 홈의 상품 그리드 | `<h1>` 문자열만 교체(REQ-BRAND-002), 그리드 로직 불변 |

---

## §6. 완료 조건

- REQ-BRAND-001~024 전부가 대응 AC(또는 AC의 특정 절)로 검증된다(`acceptance.md` §D 추적 행렬).
- 기존 테스트 스위트가 회귀 없이 통과한다(baseline 캡처 대조).
- Prisma 마이그레이션이 0건이다(§2.2).
