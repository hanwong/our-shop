# SPEC-BRAND-001 — 디자인 단계 지시서

이 SPEC은 **UI 노출 SPEC**이므로 Conditional Design Route(`plan → design → run`)를 탄다. 이 문서는 design phase(`manager-design`, D1-D5)에 대한 입력이며, plan-audit PASS + Implementation Kickoff Approval 이후에 소비된다.

> **경계**: 이 문서는 design phase가 **무엇을 확정해야 하는지**를 지시한다. plan-phase는 design phase를 실행하지 않는다.

---

## §1. 원천 (재조회 대상)

| 항목 | 값 |
|---|---|
| 플랫폼 | Claude Design |
| 프로젝트명 | **OUR** |
| `projectId` | `aa1263c0-57a7-4d65-8670-f5cb5e9daae7` |

`research.md`에 plan-phase 전사본이 고정되어 있다. design phase는 이를 **대체하지 않고 보강**한다 — 특히 `research.md` §8의 미확보 5건.

---

## §2. design phase가 반드시 확정해야 하는 것 (차단 항목)

`research.md` §8의 미확보 항목이 곧 이 절이다. 각 항목은 특정 마일스톤을 차단하고 있다.

### §2.1 제품 데이터 — **PROVISIONAL 해소 (2026-09-07, code-based fallback)**

✅ **해소됨(기존)**: 제품명·부제·가격 6종은 `research.md` §3.1에 축자 전사 완료. 카테고리 배정은 4건 원천 명시 + 2건 판단(§3.2 / `plan.md` §B.7).

⚠️ **PROVISIONAL 해소(이번 갱신, §7 DesignSync 부재로 인한 code-based fallback — 사용자 명시 승인)**:

**제품별 이미지 경로 → `Product.images[]`**: 실제 파일이 없으므로 이 저장소에 이미 존재하는 placeholder 이미지 컨벤션(`next.config.ts`의 `picsum.photos` 허용 호스트 — `NextConfig.images.remotePatterns`에 이미 등록되어 있고, 테스트 스위트 전반이 `https://picsum.photos/seed/<seed>/<w>/<h>` 형태를 이미 사용 중임을 확인, 예: `tests/unit/components/product-card.test.tsx`)를 재사용한다. 제품별 seed는 각 제품의 표준 로마자 표기를 사용한다:

| # | 제품명 | seed | `Product.images[0]` |
|---|---|---|---|
| 0 | 시로코 | `siroko` | `https://picsum.photos/seed/siroko/800/800` |
| 1 | 에지마 | `ejima` | `https://picsum.photos/seed/ejima/800/800` |
| 2 | 노마치 | `nomachi` | `https://picsum.photos/seed/nomachi/800/800` |
| 3 | 아키타 | `akita` | `https://picsum.photos/seed/akita/800/800` |
| 4 | 세토 | `seto` | `https://picsum.photos/seed/seto/800/800` |
| 5 | 하야마 | `hayama` | `https://picsum.photos/seed/hayama/800/800` |

각 제품 1장(배열 길이 1)으로 잠정 처리한다 — `ProductGallery.tsx`가 다중 이미지를 지원하지만(`tests/unit/components/product-gallery.test.tsx`가 3장 사례를 다룸), 실제 제품 사진 장수는 라이브 원천 없이는 알 수 없다.

**카테고리 `slug` 로마자 표기 → `Category.slug`**: 표준 영어 로마자 표기를 잠정 채택한다.

| 카테고리(한글) | `slug` |
|---|---|
| 더비 | `derby` |
| 로퍼 | `loafer` |
| 부츠 | `boots` |
| 몽크 | `monk` |

**⚠️ PROVISIONAL — 라이브 원천 재확인 필요.** 위 표 2건(이미지 경로 seed 매핑, `slug` 로마자 표기) 모두 DesignSync 도구 부재로 실제 Claude Design 프로젝트 "OUR"을 조회하지 못한 채 결정되었다. 사용자가 §7의 명시적 "비권장" 경고를 받고도 code-based fallback을 승인했다(2026-09-07). run-phase 완료 후 DesignSync가 확보되는 대로, 라이브 원천의 실제 이미지 자산·slug 표기와 대조 재확인이 필요하다 — 특히 실제 제품 이미지 자산이 존재한다면 `picsum.photos` placeholder를 실제 자산으로 교체해야 한다.

**추가 확인 요청 — 해소(플랜 유지)**: `renderVals()`의 사이즈 범위 문자열이 `i % 3` 인덱스 파생 채움값이라는 판정(`research.md` §3.3)은 라이브 재확인 없이도 이 세션에서 재확인 가능한 순수 논리 판정(소스 코드 패턴 분석)이었으므로 plan-phase 판정을 그대로 유지한다 — REQ-BRAND-024 불변.

### §2.2 팔레트 램프 — ✅ **해소됨 (2026-09-07)**

**M2는 더 이상 차단되지 않는다.** 전체 토큰 블록이 `research.md` §4.1에 전사되어 있다(neutral 9 + accent 9 + 핵심 6 + shadow 3).

design phase가 할 일은 전사가 아니라 **검증**이다 — `research.md` §4.2가 식별한 두 함정이 실제로 그러한지 라이브 원천에서 확인한다:

1. **`--color-accent-2-100..900` 9개**가 원천에는 있고 코드베이스 `@theme`에는 없다는 것. 추가하면 REQ-BRAND-007 위반이므로 **추가하지 않는다**.
2. **폰트 토큰**이 코드베이스에서 `var(--font-heading-nf)` / `var(--font-body-nf)` 형태라는 것(t51 후속 카드 승인 이탈). 원천의 리터럴로 되돌리지 **않는다**.

**제약(불변)**: 프로퍼티 **이름**은 현재 `globals.css`의 `@theme` 블록과 정확히 일치해야 한다(REQ-BRAND-007). 원천에만 있는 이름은 **추가하지 말고 보고**한다 — 이름 집합 변경은 SPEC-DESIGN-001 재개봉이며 범위 밖이다.

### §2.3 로고 파일 확정 — **PROVISIONAL 해소 (2026-09-07, code-based fallback)**

**문제**: `logo_gold_only.png`라는 파일명이 현재 팔레트와 모순된다 — 이 프로젝트의 `--color-accent`는 골드(`#b68235`)가 아니라 다크 그레이(`#2b2b2b`)다.

**원래 요구 행위**: 두 파일(`logo_mono_black.png`, `logo_gold_only.png`)의 **실제 픽셀**을 확인하여 판별한다.

**⚠️ 픽셀 검증 불가 — DesignSync 부재로 인한 code-based fallback, 사용자 명시 승인.** §7이 기록한 대로 DesignSync 도구가 이 세션에 노출되지 않아 두 PNG 파일을 실제로 열어 픽셀을 확인할 방법이 없다.

**채택**: `plan.md` §B.2가 제시한 잠정 기본값 `logo_mono_black.png`를 그대로 **PROVISIONAL 확정**한다.

**근거(변경 없음, plan.md §B.2 재인용)**: 이름과 팔레트가 모순되지 않는 유일한 후보이며, 그레이스케일 전용 팔레트에서 모노 블랙은 정의상 안전하다. `gold_only`는 파일명이 실제로 골드를 의미한다면 팔레트와 충돌하고, 그레이스케일을 의미한다면 파일명이 낡은 것인데 — 어느 쪽이든 `mono_black`을 쓰는 것이 안전한 선택지다(전자는 회피, 후자는 무해).

**⚠️ PROVISIONAL — 라이브 원천 재확인 필요.** 이 결정은 픽셀 관찰이 아니라 **명칭 안전성 추론**에 근거한다. run-phase 완료 후 DesignSync가 확보되는 대로 두 파일의 실제 픽셀을 재확인하고, `gold_only`가 실제로는 별도 용도(심볼 전용 vs 워드마크 등)로 쓰여야 했다면 그때 재배정한다.

### §2.4 제작 기간 재확인 — **미재확인 — PROVISIONAL (2026-09-07)**

라이브 원천에서 "4주"와 "4개월" 중 어느 값이 맞는지 재확인하는 것이 원래 요구였으나, **DesignSync 부재로 라이브 재확인이 불가능하다**(§7). plan-phase의 판단 — 다수 일관성(3:1) 근거로 채택한 **"약 4주"**(`plan.md` §B.3) — 을 **뒤집지 않고 그대로 유지**한다. 신뢰도만 낮춰 "미재확인 — PROVISIONAL"로 표시한다. run-phase 완료 후 DesignSync 확보 시 재확인 필요 — 뒤집힐 경우 REQ-BRAND-017과 `/bespoke` 카피가 함께 수정된다.

### §2.6 시로코 카테고리 재확인 — **미재확인 — PROVISIONAL (2026-09-07)**, 차단 아님

`plan.md` §B.7이 시로코("스트레이트 팁 · 블랙 칼프")를 **더비로 잠정 배정**했으나, 원천은 이를 명시한 적이 없다. 실제 구두 용어에서 **블랙 칼프 스트레이트 팁은 옥스퍼드(클로즈드 레이싱)와 더 강하게 결부**되며, 더비(오픈 레이싱)는 두 번째 가설이다.

**원래 요구 행위**는 라이브 원천(목업 Shop 화면의 필터 동작, 제품 카드의 분류 표시, UI Kit의 분류 어휘)에서 이 제품의 의도된 분류를 확인하는 것이었으나, **DesignSync 부재로 불가능하다**(§7).

**채택**: `plan.md` §B.7의 잠정 판단(**시로코 → 더비**)을 **뒤집지 않고 그대로 유지**한다 — 대립 가설(옥스퍼드)이 살아 있음을 인지한 채로, 신뢰도만 낮춰 "미재확인 — PROVISIONAL"로 표시한다. run-phase 완료 후 DesignSync 확보 시 재확인 필요 — 옥스퍼드로 판명되면 5번째 카테고리 신설 또는 재배정(시드 스크립트 1개 값 변경).

**왜 이 항목이 있는가**: 이 SPEC은 몽크 스트랩을 더비로 부르는 것이 "공예 브랜드에 대한 사실상 거짓 진술"이라며 4번째 카테고리를 신설했다. 시로코에 같은 잣대를 적용하지 않으면 그 논리가 일관되지 않는다 — 이 비일관성 리스크는 PROVISIONAL 표시로 명시적으로 인수인계된다.

### §2.5 `/story` 카피 확보 — **PROVISIONAL 해소 (2026-09-07, code-based fallback)**

목업 Home 화면의 "한 켤레에 나흘" 제작 스토리 블록에서 `/story` 페이지에 쓸 카피를 확보하는 것이 원래 요구였다. `/story`는 전용 화면이 설계되어 있지 않으므로(`research.md` §6), 홈의 스토리 블록이 유일한 카피 원천이다.

**확인 결과**: `research.md` §2가 이 블록의 **섹션 제목**("한 켤레에 나흘")과 구성("제작 스토리 블록 + 스펙 테이블")만 전사했고, **본문 축자 카피는 전사되어 있지 않다**(§8 미확보 목록에 있던 항목). DesignSync 부재로 라이브 원천에서 축자 카피를 새로 가져올 수 없다.

**PROVISIONAL 카피 (신중히 작성, `spec.md`/`research.md`의 확정 사실만 사용)**:

> ### 한 켤레에 나흘
>
> OUR의 신발은 주문을 받은 뒤 한 켤레씩 손으로 꿰맵니다. 재단부터 마무리까지, 한 켤레를 완성하는 데 꼬박 나흘이 걸립니다.
>
> 기계가 대신할 수 없는 공정을 고집하는 이유는 단순합니다 — 285mm부터 330mm까지, 큰 사이즈일수록 손으로 다듬는 균형이 더 중요해지기 때문입니다.
>
> 주문 후 완성까지는 약 4주가 걸립니다. 그 시간 동안 신발장 속 신발이 아니라, 발에 맞춰 만들어지는 한 켤레를 기다려 주십시오.

이 카피는 `research.md` §2가 전사한 확정 사실(285-330mm, 손바느질, 약 4주, 15-30만원대 — 가격은 카피에 넣지 않음)과 `spec.md` §1(장인정신·수제화 포지셔닝)에서 벗어나지 않는 범위로 작성했다. "한 켤레에 나흘"이라는 제목과 "제작 스토리"라는 구성만 원천에서 가져왔고, 본문 문장은 **새로 작성**했다.

**⚠️ PROVISIONAL — 라이브 원천 재확인 필요.** 이 카피의 본문은 원천의 축자 전사가 아니라 신중하게 작성된 대체 문안이다. run-phase 완료 후 DesignSync 확보 시 라이브 원천의 실제 카피로 교체해야 한다.

---

## §3. design phase가 결정해야 하는 시각 설계 — **확정 (2026-09-07, code-based fallback)**

DesignSync 부재로 라이브 UI Kit을 다시 조회할 수 없으므로, 이 문서 자신이 이미 제시한 후보안을 그대로 채택하여 확정한다(사용자 지시 §5). 아래 4건은 PROVISIONAL이 아니라 **확정**이다 — 시각 스타일 세부(정확한 픽셀 값, 간격 등)는 run-phase 구현 시 기존 `@theme` 토큰·Tailwind 유틸리티로 자연스럽게 해석하면 되며, 라이브 원천 재확인이 반드시 필요한 항목이 아니기 때문이다.

### §3.1 품절 상품의 사이즈 그리드 표현 — **확정: 태그 오버레이**

`plan.md` §B.1이 기록한 **의도적 이탈**을 시각적으로 다루는 방법을 다음과 같이 확정한다.

- 원천(UI Kit): *일부* 사이즈만 `disabled`
- 이 SPEC: `stock === 0`이면 **전부** disabled, 아니면 **전부** 활성

**확정 결정**: 품절 상품(`stock === 0`)은 사이즈 그리드를 렌더링하는 대신, UI Kit의 품절 태그 오버레이 패턴(불투명도 62% + "품절" 태그)을 상품 이미지/카드 위에 적용한다. 재고 있는 상품은 사이즈 그리드를 전부 활성 상태로 렌더링한다. 이렇게 하면 "전부 비활성" 그리드와 "일부만 비활성"인 목업 원본의 시각 언어가 섞이지 않는다 — 애초에 전부-비활성 그리드 자체를 노출하지 않기 때문이다.

**제약 준수**: 개별 사이즈에 서로 다른 상태를 부여하지 않는다(REQ-BRAND-023) — 재고 있는 상품의 사이즈 그리드는 항상 5개 전부 동일 상태(활성)로 렌더링된다.

### §3.2 내비게이션 레이아웃 — **확정**

현재 `SiteHeader`는 `<header>` 안에 세션 분기 하나만 갖는다. 확장 후 담을 것(확정):

- 브랜드 로고 링크 (→ `/`)
- SHOP (→ `/shop`) · BESPOKE (→ `/bespoke`) · STORY (→ `/story`)
- CART (→ `/cart`)
- 기존 세션 분기 (로그인 링크 **또는** 내 정보 + 로그아웃)

UI Kit의 `.nav` 어휘를 참조하되, **컴포넌트 클래스 레이어를 새로 만들지 않는다** — Tailwind 유틸리티 + `@theme` 커스텀 프로퍼티로 스타일링한다(`research.md` §7 주의).

**모바일 반응형 확정**: 데스크톱(`md:` 이상)에서는 로고 좌측 + 내비 6항목(SHOP·BESPOKE·STORY·CART·로그인 or 내정보/로그아웃) 우측 정렬 가로 배치. 모바일(`md:` 미만)에서는 로고 + 햄버거 토글 버튼만 헤더에 노출하고, 나머지 항목은 토글 시 펼쳐지는 세로 드롭다운 목록으로 접는다 — 신규 CSS 클래스 레이어 없이 Tailwind `hidden md:flex` / `md:hidden` 유틸리티 조합과 기존 `useState` 토글 패턴(코드베이스 다른 컴포넌트에서 이미 쓰이는 관용구)으로 구현 가능하다.

### §3.3 `/shop` 필터·정렬 컨트롤 — **확정**

- 카테고리 필터 버튼 **4개**(더비/로퍼/부츠/**몽크**) + 전체 — §3.5(§2.6과 함께 PROVISIONAL 유지된 4개 결정)를 따른다. 레이아웃은 `flex flex-wrap gap-*` 방식으로 **개수에 유연하게** 배치한다 — 고정 grid-cols 대신 wrap 가능한 flex 컨테이너를 쓰면, §3.5가 나중에 뒤집혀 3개로 줄어도 버튼 하나가 사라지는 것 외에 레이아웃 변경이 없다.
- 버튼 목록은 `Category` 테이블에서 파생되므로(REQ-BRAND-014 / AC-BRAND-016) 개수 하드코딩 금지 — `.map()`으로 렌더링한다.
- 정렬 컨트롤: `newest` / `price_asc` / `price_desc` 3개 옵션을 필터 버튼과 같은 링크 목록 스타일로 배치(별도 드롭다운 컴포넌트 신규 작성 없이 기존 링크 패턴 재사용).
- 선택 상태 시각 표현: 현재 `?category=`/`?sort=` 값과 일치하는 버튼에 `--color-accent` 배경 + 대비 텍스트(선택됨), 나머지는 `--color-neutral-200` 배경 + `--color-text`(미선택) — 기존 `@theme` 토큰만 사용, 신규 토큰 추가 없음.
- URL 파라미터 기반이므로 각 컨트롤은 `<Link href="?category=...&sort=...">`로 구현한다(`plan.md` §B.5).

### §3.4 `/bespoke` · `/story` 페이지 레이아웃 — **확정**

정적 안내 페이지 2종. UI Kit의 **"주문 제작 안내" 콜아웃 블록**을 `/bespoke`의 골격으로 채택 확정한다 — 헤딩 + 스펙 나열(사이즈 범위·제작 방식·제작 기간·가격대) + 짧은 브랜드 설명 문단 구조.

**제약 준수**: 폼·제출 버튼·장바구니 컨트롤을 두지 않는다(REQ-BRAND-019). 문의 폼이 UI Kit에 있으나 이 SPEC 범위 밖 — `/bespoke`·`/story` 모두 순수 정적 콘텐츠로 확정.

**사이즈 표기 확정**: `/bespoke` 카피는 브랜드 카피의 **"285mm부터 330mm까지"**를 따른다(REQ-BRAND-017 명문 요구사항이며, §2.4/§2.6과 달리 이것은 브랜드 카피 자체에서 이미 확정된 값이라 재확인 대상이 아니다). 목업의 제품별 사이즈 범위 채움값(250mm/260mm 시작)은 인덱스 파생 합성값이므로 권위가 없다(`research.md` §3.3) — 채택하지 않는다.

`/story`는 §2.5의 PROVISIONAL 카피("한 켤레에 나흘")를 본문으로 사용, 콜아웃 블록 없이 단일 흐름의 산문 레이아웃으로 확정한다.

### §3.5 카테고리 개수 — 3개 vs 4개 — **미재확인 — PROVISIONAL (2026-09-07), 4개 유지**

`plan.md` §B.7이 **4번째 카테고리 `몽크`를 신설**하기로 결정했다. 하야마("몽크 스트랩")를 더비로 분류하는 것이 제품에 대한 사실상 거짓 진술이기 때문이다.

**그러나 목업 필터 버튼은 3개다.** 원래는 design phase가 라이브 원천에서 이 이탈을 확인·뒤집기로 되어 있었으나, **DesignSync 부재로 라이브 확인이 불가능하다**(§7).

**채택**: plan-phase의 판단(**4개 — 몽크 신설**)을 **뒤집지 않고 그대로 유지**한다. 신뢰도만 낮춰 "미재확인 — PROVISIONAL"로 표시한다. §3.3의 필터 버튼 레이아웃은 이미 개수-유연 설계이므로, run-phase 완료 후 재확인 결과 3개로 되돌아가더라도 UI 코드 변경이 필요 없다(시드 스크립트 1개 값만 변경).

| design phase 판단(원래 계획) | 실제 처리(이번 갱신) |
|---|---|
| 4개 승인 | **PROVISIONAL 채택** — plan.md §B.7 판단 유지 |
| 3개 유지 | (재확인 가능해지면 재검토) |

어느 쪽이든 **필터 버튼 목록을 하드코딩하지 않는다**(`plan.md` M5)는 제약이 이 PROVISIONAL 상태를 값싸게 만든다 — 나중에 뒤집혀도 UI 코드 변경 없이 시드 데이터만 바뀐다.

---

## §4. design phase가 건드리면 안 되는 것

| 대상 | 이유 |
|---|---|
| `@theme` 프로퍼티 **이름** 집합 | SPEC-DESIGN-001 소유 (REQ-BRAND-007) |
| 폰트 스택 | SPEC-DESIGN-001 소유. OUR 원천도 Cormorant Garamond / Lora로 동일 |
| `SiteHeader`의 렌더링 위치 | SPEC-AUTH-004 소유. 루트 레이아웃 이동 = 결함 재발 |
| `SiteHeader`의 세션 분기 로직 | SPEC-AUTH-003 소유 |
| Prisma 스키마 | 무(無)마이그레이션 판정 (`spec.md` §2.2) |

---

## §5. 진입·종료 조건

**진입**: plan-audit PASS (≥0.85) → Implementation Kickoff Approval 통과.

**종료 (→ run-phase)**: D5 재위임 패키지가 아래를 모두 포함할 때.

- [x] ~~제품명·부제·가격 전사~~ — 해소 (`research.md` §3.1)
- [x] ~~팔레트 램프 전사~~ — 해소 (`research.md` §4.1)
- [x] 제품별 **이미지 경로** 확보 (§2.1) — **PROVISIONAL 해소** (picsum.photos seed 매핑, code-based fallback)
- [x] 카테고리 **slug** 확정 (§2.1) — **PROVISIONAL 해소** (표준 로마자 표기, code-based fallback)
- [x] 로고 파일 확정 + 근거 (§2.3) — **PROVISIONAL 해소** (`logo_mono_black.png`, 명칭 안전성 추론, 픽셀 미검증)
- [x] `/story` 카피 확보 (§2.5) — **PROVISIONAL 해소** (신중히 작성된 대체 카피, code-based fallback)
- [x] `research.md` §4.2의 두 함정 검증 — `accent-2` 램프 미추가 / 폰트 토큰 불변 (§2.2) — plan-audit iter3에서 이미 코드베이스 직접 재실행 관찰 완료(라이브 Claude Design 조회가 아니라 코드베이스 grep이므로 DesignSync 무관 — 그대로 유효)
- [x] 사이즈 범위 채움값 판정 확인 (§2.1 말미) — 순수 논리 판정(소스 코드 패턴), DesignSync 무관 — 그대로 유효
- [x] 제작 기간 값 재확인 (§2.4) — **미재확인 — PROVISIONAL**, plan-phase 판단("약 4주") 유지
- [x] 카테고리 3개/4개 확정 (§3.5) — **미재확인 — PROVISIONAL**, plan-phase 판단(4개) 유지
- [x] **시로코 카테고리 재확인** (§2.6) — **미재확인 — PROVISIONAL**, plan-phase 판단(더비) 유지. 옥스퍼드 대립 가설 여전히 살아 있음
- [x] §3.1~§3.4 시각 결정 4건 확정 — 이 문서가 제시했던 후보안을 그대로 채택 확정(§3)
- [x] §4 불변 항목이 전부 보존되었음 확인 — §3의 확정 결정 어느 것도 §4 항목을 건드리지 않음(아래 §8 확인 참조)

**2026-09-07 갱신 — code-based fallback으로 전체 해소.** §7이 기록한 DesignSync 도구 부재 상황에서, 사용자가 명시적 "비권장" 경고를 받고도 code-based fallback(추정값 사용)으로 진행하기로 결정했다(오케스트레이터 경유 지시). 위 12개 항목 전부 이 방식으로 해소되었으나, **7개 항목이 PROVISIONAL 표시로 남아 있다** — §8 참조. run-phase는 이제 진입 가능하나, PROVISIONAL 항목은 run-phase 완료 후 라이브 Claude Design 원천 확보 시 재확인이 필요하다.

---

## §6. 상호 참조

- `research.md` §8 — 미확보 항목 요약 (이 문서 §2의 원본)
- `plan.md` §B.1/§B.2/§B.3 — design phase가 확정할 판단들의 근거
- `plan.md` §G — 안티패턴
- `.claude/skills/moai/workflows/design.md` — D1-D5 파이프라인과 H1-H9 핸드오프 계약

---

## §7. D1 진입 시도 결과 (2026-09-07) — **DesignSync 도구 부재로 차단**

`manager-design`이 D1(연결 설정)을 시작하기 전에 DesignSync 도구의 운영 가용성을 확인했다.

**확인 방법**:
1. `.mcp.json` 전문 읽기 — 등록된 MCP 서버: `context7`, `moai`, `playwright` 3개뿐. `DesignSync`(또는 유사 명칭의 Claude Design 연동 서버) **미등록**.
2. 이 세션에 주입된 MCP 서버 사용 지침 블록 확인 — `claude.ai Lovable`, `claude.ai Supabase`, `context7` 3건만 존재. Claude Design/DesignSync 관련 지침 **없음**.
3. `.moai/config/sections/design.yaml` 확인 — `claude_design.enabled: true`로 설정은 되어 있으나, 이는 **정책 스위치**일 뿐 실제 도구 연결을 보장하지 않는다. `fallback_path: "code_based"`가 명시되어 있어, 설계상으로도 도구 부재 시 코드 기반 경로로 대체하도록 되어 있다.

**결론**: DesignSync 도구가 이 세션에 노출되어 있지 않다. 매니저 정의(`manager-design.md`) "Tool Availability (graceful degradation)" 절의 명시 규칙에 따라, D2-D5(디자인 시스템 생성/동기화, 화면 아티팩트 조회, 핸드오프 수신)는 **이 도구 없이는 실행 불가**하며, 대체 메커니즘(예: 일반 WebFetch로 claude.ai 접근)을 사용해서는 안 된다 — manager-design은 문서화된 DesignSync 도구 계약에만 결합한다.

**차단되는 §5 체크리스트 항목 전부**: §2.1(이미지 경로·slug), §2.3(로고 픽셀), §2.4(제작 기간 재확인), §2.5(`/story` 카피), §2.6(시로코 재확인), §3.5(카테고리 개수), §2.2 검증(라이브 원천 재확인)까지 — 이 항목들은 모두 라이브 Claude Design 프로젝트 "OUR"(`projectId: aa1263c0-57a7-4d65-8670-f5cb5e9daae7`)에 대한 실제 조회를 요구하며, 어느 것도 도구 없이 독립적으로 재확인할 수 없다. §3.1~§3.4의 시각 설계 결정 4건도 라이브 원천 대조가 전제이므로 마찬가지로 보류한다.

**H1(수신 경로) 적용**: 도구·로그인 부재 시 차단 보고를 반환한다. `/design-login`은 사용자 전용 TUI 명령이므로 오케스트레이터가 사용자에게 안내해야 한다.

**이 SPEC의 run-phase 진입은 §8의 사용자 승인 전까지 불가했다** — §5 종료 조건이 그대로 유효했다(로고·이미지 경로·slug·`/story` 카피 미해소). §8이 이 상태를 대체한다.

---

## §8. code-based fallback 승인 및 PROVISIONAL 값 인수인계 (2026-09-07)

### §8.1 사용자 승인 기록

**사용자가 DesignSync 부재 상황에서 code-based fallback(추정값 사용)으로 진행하기로 명시적으로 결정했다** — `.moai/config/sections/design.yaml`의 `claude_design.fallback_path: "code_based"`가 이미 예고한 대체 경로이며, manager-design(§7)이 "비권장" 경고(라이브 원천 재확인 불가, PROVISIONAL 리스크)를 보고한 뒤 사용자가 이를 인지하고도 선택했다. 이 승인은 오케스트레이터를 경유해 이 세션에 전달되었다.

**이 승인이 대체하는 것**: §7이 기록한 차단 상태. §7의 "run-phase 진입 불가" 결론은 이 §8로 **대체**된다 — DesignSync 부재는 해소되지 않았지만(§7의 사실관계는 그대로 유효), 사용자가 그 부재를 감수하고 code-based fallback으로 진행할 것을 승인했으므로 §5 종료 조건이 PROVISIONAL 표시와 함께 충족되었다.

### §8.2 새로운 추측을 만들지 않는다는 원칙 준수

이번 갱신에서 채택한 모든 값은 다음 두 원천 중 하나에서만 도출되었다 — 새로운 추측을 만들지 않았다:

1. **`research.md`/`plan.md`에 이미 있는 근거의 재사용**: 로고 파일(§2.3, `plan.md` §B.2 그대로), 제작 기간(§2.4, `plan.md` §B.3 그대로), 시로코 카테고리(§2.6, `plan.md` §B.7 그대로), 카테고리 4개(§3.5, `plan.md` §B.7 그대로), 사이즈 범위 채움값 판정(§2.1 말미, `research.md` §3.3 그대로) — **뒤집지 않고 유지**.
2. **이 저장소에 이미 존재하는 컨벤션의 재사용**: 이미지 경로(§2.1, `next.config.ts`의 `picsum.photos` 허용 호스트 + 테스트 스위트 전반의 기존 사용 패턴), 카테고리 slug(§2.1, 표준 영어 로마자 표기 — 새 규칙 발명 아님), `/bespoke`·`/story` 레이아웃(§3.4, 이 문서가 이미 제시했던 UI Kit "주문 제작 안내" 콜아웃 후보안).

유일하게 **신규 작성**된 것은 `/story` 카피 본문(§2.5)이며, 이는 `research.md`가 전사한 확정 사실(285-330mm, 손바느질, 약 4주)과 `spec.md`의 브랜드 톤(장인정신·수제화) 범위를 벗어나지 않도록 신중하게 작성했고, 즉시 PROVISIONAL로 표시했다.

### §8.3 PROVISIONAL 인수인계 목록 (run-phase 완료 후 재확인 필수)

| # | 항목 | 위치 | PROVISIONAL 사유 |
|---|---|---|---|
| 1 | 로고 파일 (`logo_mono_black.png`) | §2.3 | 픽셀 미검증 — 명칭 안전성 추론만 |
| 2 | 제품 이미지 경로 (picsum seed 매핑) | §2.1 | 실제 제품 사진 자산 없음 — placeholder |
| 3 | 카테고리 slug 로마자 표기 | §2.1 | 라이브 원천의 실제 slug 값 미확인 |
| 4 | `/story` 카피 본문 | §2.5 | 원천 축자 전사가 아니라 신규 작성 |
| 5 | 제작 기간 "약 4주" | §2.4 | 원천 내부 값 충돌(4주 vs 4개월) 미재확인 |
| 6 | 시로코 → 더비 카테고리 배정 | §2.6 | 옥스퍼드 대립 가설 미해소 |
| 7 | 카테고리 4개(몽크 신설) | §3.5 | 목업 필터 버튼 3개와의 불일치 미재확인 |

**필수 후속 조치**: run-phase 구현 완료 후, DesignSync 도구가 확보되는 대로 위 7건을 라이브 Claude Design 프로젝트 "OUR"(`projectId: aa1263c0-57a7-4d65-8670-f5cb5e9daae7`)과 대조 재확인해야 한다. 이 SPEC 완료 시점에 후속 백로그 카드를 생성하는 것을 권고한다(예: `moai todo add "SPEC-BRAND-001 후속: DesignSync 확보 시 PROVISIONAL 7건(design.md §8.3) 재확인"`).

### §8.4 D5 재위임 패키지 — manager-develop 위임용 Section A-E 요약

`.claude/rules/moai/development/manager-develop-prompt-template.md`의 5-섹션 구조에 맞춰 오케스트레이터가 조립할 위임 프롬프트의 핵심 내용을 여기 요약한다(전체 프롬프트는 오케스트레이터가 이 SPEC의 `spec.md`/`plan.md`/`acceptance.md`와 결합해 작성한다).

**Section A (Context)**:
- SPEC: `SPEC-BRAND-001`, Tier L, `plan → design → run` Conditional Design Route
- 최신 plan-audit: iter3 PASS, score 0.94 (임계 0.85)
- design phase 산출물: `design.md`(이 파일, §1-§8 전체), 특히 §3(확정 시각 결정 4건), §2.1/§2.3/§2.5(PROVISIONAL 데이터), §4(불변 항목)

**Section B (Known issues — PROVISIONAL 리스크 목록)**:
- §8.3의 7개 PROVISIONAL 항목 전부를 run-phase 구현 시 인지하고 있어야 한다 — 특히 이미지 경로는 `next.config.ts`에 이미 등록된 `picsum.photos` 호스트를 그대로 쓰면 되므로 config 변경 불필요.
- 시드 스크립트(`prisma/seed-*.ts` 컨벤션 — `node prisma/seed-X.ts` 직접 실행, upsert 멱등, npm 스크립트 미배선)를 따라 신규 `seed-brand.ts` 또는 유사 파일을 작성할 때 §2.1의 이미지/slug 표를 그대로 사용한다.
- REQ-BRAND-024(합성 사이즈 범위 문자열 시드 금지)는 재확인 불필요 — 그대로 유효.

**Section C (Pre-flight)**:
- `git status --short` 클린 확인, HEAD가 이 커밋(design phase 커밋) 위에 있는지 확인
- `grep -c 'accent-2-' src/app/globals.css` → `0` 재확인(REQ-BRAND-007 회귀 없음 확인)
- `ls prisma/` → 기존 시드 스크립트 컨벤션 확인

**Section D (Constraints — PRESERVE 목록, §4 불변)**:
- `@theme` 프로퍼티 이름 집합 불변 (SPEC-DESIGN-001 소유)
- 폰트 스택 불변 (SPEC-DESIGN-001 소유)
- `SiteHeader` 렌더링 위치 불변 — `src/app/(shop)/layout.tsx`에서만 (SPEC-AUTH-004 소유)
- `SiteHeader` 세션 분기 로직 불변 (SPEC-AUTH-003 소유)
- Prisma 스키마 변경 없음 (무마이그레이션 판정)
- design.md §3의 확정 시각 결정 4건은 캔버스 변경이 아니라 코드 구현 지침이므로 그대로 구현한다(design phase는 라이브 캔버스를 조회하지 못했으므로 이 문서의 확정 결정이 유일한 시각 스펙이다)

**Section E (Self-verification)**:
- E1 AC PASS/FAIL 매트릭스에 §8.3 PROVISIONAL 항목 7건이 각각 어떤 AC와 연결되는지 명시
- `grep -c 'accent-2-' src/app/globals.css` 결과 재관찰(0 기대)
- 시드 실행 후 `Category.slug` 4개(`derby`/`loafer`/`boots`/`monk`) 실제 DB 값 확인
- run-phase 완료 보고에 §8.3 PROVISIONAL 목록을 그대로 인용하여, sync-auditor가 브랜드 일관성 판단 시 이 목록을 알 수 있게 한다

### §8.5 §4 불변 항목 보존 확인

§3의 확정 시각 결정 4건(§3.1-§3.4) 어느 것도 §4의 불변 항목(theme 프로퍼티 이름, 폰트 스택, SiteHeader 위치/세션 로직, Prisma 스키마)을 건드리지 않는다 — 전부 기존 토큰·기존 컴포넌트 구조를 그대로 사용하는 Tailwind 유틸리티 레이아웃 결정이다. §4 위반 없음을 확인한다.
