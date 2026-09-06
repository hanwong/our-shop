# SPEC-BRAND-001 — 인수 기준

## §A. 형식

각 AC는 `Given … When … Then …` 형태의 **이진 판정 가능한** 시나리오다. 요구사항(GEARS)은 `spec.md` §4에 있으며 여기서 반복하지 않는다.

일부 AC는 절이 둘이다(`그리고 Given …` / `그리고 When …`). 이는 **상호 보완적인 두 방향을 하나의 행동으로 검증**하기 위한 것이며, 각 절은 독립적으로 이진 판정된다. 절을 나눠도 정보가 늘지 않는 쌍만 병합했다(§F 병합 근거).

## §B. 기준선 캡처 (선행 조건)

M0 착수 전에 회귀 기준선을 캡처한다. 이후 모든 회귀 단언은 이 기준선에 귀속된다.

```bash
npm run test 2>&1 | tee .moai/state/verify/brand-001/baseline-test.txt
npm run typecheck 2>&1 | tee .moai/state/verify/brand-001/baseline-typecheck.txt
```

---

## §C. 인수 기준

### 브랜드 문자열

**AC-BRAND-001**
Given 애플리케이션이 빌드된 상태에서,
When 임의의 고객 라우트를 요청하면,
Then 응답 HTML의 `<title>`이 "OUR" 브랜드명을 포함하고 리터럴 `our-shop`을 포함하지 않는다.

**AC-BRAND-002**
Given 홈 라우트(`/`)가 렌더링된 상태에서,
When 최상위 제목 요소를 조회하면,
Then 그 텍스트가 "OUR" 브랜드명이며 리터럴 `our-shop`이 아니다.

**AC-BRAND-003**
Given 저장소 루트에서,
When `package.json`의 `name` 필드를 읽으면,
Then 값이 OUR 브랜드 식별자이며 `our-shop`이 아니다.

**AC-BRAND-004** (부작위 단언)
Given 이 SPEC의 전체 diff에 대해,
When `src/lib/auth/jwt.ts`의 변경 여부를 확인하면,
Then 해당 파일이 diff에 나타나지 않으며, `ISSUER`/`AUDIENCE` 값이 각각 `"our-shop"` / `"our-shop-api"`로 남아 있다.

### 정적 에셋

**AC-BRAND-005**
Given 저장소가 체크아웃된 상태에서,
When `public/brand/` 경로를 확인하면,
Then 디렉터리가 존재하고 브랜드 로고 이미지 파일을 최소 1개 포함한다.

**AC-BRAND-006**
Given 로고를 렌더링하는 컴포넌트에서,
When 렌더링 결과를 조회하면,
Then 로고가 `next/image`의 `Image`로 렌더링되고, 비어 있지 않은 `alt` 속성과 명시적 `width`/`height`를 갖는다.

### 디자인 토큰

**AC-BRAND-007** (아키텍처 보존 — PRESERVE)
Given 변경 전후의 `src/app/globals.css`에 대해,
When `@theme` 블록에서 선언된 CSS 커스텀 프로퍼티 **이름** 집합을 각각 추출해 비교하면,
Then 두 집합이 정확히 동일하며(추가·삭제·개명 0건), 특히 `--color-accent-2-100` ~ `--color-accent-2-900`이 **추가되지 않았다**;
그리고 When 폰트 토큰 값을 조회하면,
Then `--font-heading`과 `--font-body`가 각각 `var(--font-heading-nf)` / `var(--font-body-nf)` 형태를 유지하며, 리터럴 `"Cormorant Garamond"` / `"Lora"`로 바뀌지 않았다.

**AC-BRAND-008** (평면 색상 토큰)
Given `src/app/globals.css`의 `@theme` 블록에서,
When 색상 토큰 값을 조회하면,
Then `--color-bg`=`#f2f2f2`, `--color-surface`=`#e9e9e9`, `--color-text`=`#1f1f1f`, `--color-accent`=`#2b2b2b`, `--color-accent-2`=`#2b2b2b`이고,
`--color-neutral-100..900`이 `#f5f5f5`/`#e8e8e8`/`#d4d4d4`/`#b7b7b7`/`#989898`/`#7a7a7a`/`#5e5e5e`/`#424242`/`#2b2b2b`이며,
`--color-accent-100..900`이 `#f5f5f5`/`#e8e8e8`/`#d4d4d4`/`#989898`/`#6b6b6b`/`#4a4a4a`/`#343434`/`#262626`/`#1a1a1a`이다.

**AC-BRAND-009** (파생 색상 토큰 — `color-mix` 기준색)
Given `src/app/globals.css`의 `@theme` 블록에서,
When `--color-divider`와 `--shadow-sm` / `--shadow-md` / `--shadow-lg`의 `color-mix()` 기준색 인자를 조회하면,
Then 네 토큰 모두 기준색이 `#1f1f1f`이며, 구(舊) 기준색 `#201f1d`(divider)와 `#2d2b2b`(shadow)가 하나도 남아 있지 않다;
그리고 When `globals.css` 파일 전체를 대상으로 금지 hex를 검색하면,
Then `#b68235`, `#ac803e`, `#201f1d`, `#2d2b2b` 네 값이 **어디에도** 나타나지 않는다(그림자·구분선 내부 포함).

**AC-BRAND-010**
Given `src/app/globals.css`에서,
When `.plate` 클래스 규칙을 조회하면,
Then 규칙이 존재하고 `grayscale(1)`과 `contrast(1.05)`를 포함한 `filter` 선언을 갖는다.

### 내비게이션

**AC-BRAND-011**
Given 임의의 고객 라우트가 렌더링된 상태에서,
When `SiteHeader`의 렌더링 결과를 조회하면,
Then 브랜드 로고 링크와 SHOP·BESPOKE·STORY·CART 각각으로 향하는 내비게이션 링크가 모두 존재한다.

**AC-BRAND-012** (회귀 — AUTH-003 세션 분기 양방향 보존)
Given `resolveSession()`이 `null`을 반환하는 세션 없는 상태에서,
When `SiteHeader`를 렌더링하면,
Then `/login`으로 향하는 로그인 링크가 존재하고 로그아웃 버튼은 존재하지 않는다;
그리고 Given `resolveSession()`이 유효 세션을 반환하는 상태에서,
When `SiteHeader`를 렌더링하면,
Then 내 정보 표시와 로그아웃 버튼이 존재하고 로그인 링크는 존재하지 않는다.

**AC-BRAND-013** (회귀 — AUTH-004 구조적 배치 보존)
Given 저장소의 라우트 트리에서,
When `SiteHeader`를 임포트하는 파일을 전수 조회하면,
Then `src/app/(shop)/layout.tsx`가 유일한 임포트 지점이며, `/staff/**` 아래 어떤 파일도 이를 임포트하지 않는다.

### `/shop` 목록

**AC-BRAND-014**
Given 시드된 제품이 존재하는 상태에서,
When `/shop`을 요청하면,
Then 200으로 응답하고, 상품 그리드와 카테고리 필터 컨트롤과 정렬 컨트롤이 모두 렌더링된다.

**AC-BRAND-015** (필터가 실제로 집합을 바꾼다)
Given 서로 다른 두 카테고리에 속한 제품이 시드된 상태에서,
When `/shop?category=<slug>`를 요청하면,
Then 렌더링된 상품 집합이 해당 카테고리 소속 제품만 포함하며, 필터 없이 요청했을 때의 집합보다 **진부분집합**이다.

**AC-BRAND-016** (필터 목록이 `Category` 테이블에서 파생된다 — 하드코딩 아님)
Given `/shop`이 렌더링된 상태에서 현재 `Category` 행 집합을 기준으로 필터 버튼 목록을 관찰한 뒤,
When **코드를 전혀 변경하지 않고** `Category` 행을 하나 추가하고 `/shop`을 다시 요청하면,
Then 렌더링된 필터 버튼 집합에 그 카테고리가 나타난다;
그리고 When 같은 방식으로 그 `Category` 행을 제거하고 다시 요청하면,
Then 필터 버튼 집합에서 사라진다.

**AC-BRAND-017** (서비스 재사용 — 부작위 단언)
Given 이 SPEC의 전체 diff에 대해,
When 새로 추가된 상품 조회 코드를 확인하면,
Then `src/features/catalog/` 아래에 새 리포지토리·서비스 함수가 추가되지 않았고, `/shop` 페이지가 기존 `listProducts`를 호출한다.

### 정적 페이지

**AC-BRAND-018**
Given 애플리케이션이 실행 중인 상태에서,
When `/bespoke`를 요청하면,
Then 200으로 응답하고, 본문이 사이즈 범위(285-330mm)·수제 제작 방식·제작 기간·가격대 네 랜드마크를 모두 포함한다.

**AC-BRAND-019**
Given 애플리케이션이 실행 중인 상태에서,
When `/story`를 요청하면,
Then 200으로 응답하고, 본문이 브랜드 스토리 카피 랜드마크를 포함한다.

**AC-BRAND-020** (범위 침식 방지 — 부작위 단언)
Given `/bespoke`와 `/story`가 렌더링된 상태에서,
When 각 페이지의 상호작용 요소를 전수 조회하면,
Then `<form>` 요소, 제출 버튼, 장바구니 담기 컨트롤이 **하나도 존재하지 않으며**, 모든 상호작용 요소가 내비게이션 링크(`<a>`)뿐이다.

### 시드 데이터

**AC-BRAND-021**
Given 빈 데이터베이스에서,
When 제품 시드 스크립트를 1회 실행하면,
Then 6개 `Product` 행(시로코 285000 · 에지마 240000 · 노마치 162000 · 아키타 198000 · 세토 276000 · 하야마 225000)이 `research.md` §3.1의 전사 가격 그대로 생성되고, 각 제품이 §3.2 배정대로 `Category`에 연결되며, 모든 카테고리가 `Category` 행으로 존재한다;
그리고 When 생성된 `Product` 행의 모든 문자열 필드를 조회하면,
Then 인덱스 파생 사이즈 범위 문자열(`"250–330mm"`, `"260–320mm"`)이 **어느 필드에도 저장되어 있지 않다**.

**AC-BRAND-022** (멱등성)
Given 시드 스크립트가 이미 1회 실행된 데이터베이스에서,
When 동일 스크립트를 다시 실행하면,
Then 스크립트가 오류 없이 종료하고, `Category`와 `Product`의 행 개수가 1회 실행 후와 정확히 동일하다.

### 사이즈 표시

**AC-BRAND-023** (확정된 메커니즘 그대로 — 실재고 아님)
Given `stock`이 `0`인 제품에 대해,
When 사이즈 선택 UI를 렌더링하면,
Then **모든** 사이즈 옵션이 `disabled`이며;
그리고 Given `stock`이 `0`보다 큰 제품에 대해,
When 동일 UI를 렌더링하면,
Then **모든** 사이즈 옵션이 선택 가능하고;
그리고 Given 임의의 제품에 대해,
When 사이즈 옵션들의 `disabled` 상태를 서로 비교하면,
Then 모든 옵션의 상태가 동일하며, 사이즈별로 상태가 갈리는 경우가 **존재하지 않는다**.

### 회귀 마감

**AC-BRAND-024**
Given §B에서 캡처한 기준선에 대해,
When `npm run test`, `npm run typecheck`, `npm run lint`를 실행하면,
Then 셋 다 성공하고, 기준선 대비 새로 실패하는 테스트가 0건이다.

**AC-BRAND-025** (무(無)마이그레이션 판정 검증)
Given 이 SPEC의 전체 diff에 대해,
When `prisma/migrations/` 아래 변경을 확인하면,
Then 새 마이그레이션 디렉터리가 0건이고 `npx prisma validate`가 성공한다.

---

## §D. 추적 행렬 (REQ ↔ AC)

| REQ | AC | 비고 |
|---|---|---|
| REQ-BRAND-001 | AC-BRAND-001 | |
| REQ-BRAND-002 | AC-BRAND-002 | |
| REQ-BRAND-003 | AC-BRAND-003 | |
| REQ-BRAND-004 | AC-BRAND-004 | 부작위 |
| REQ-BRAND-005 | AC-BRAND-005 | |
| REQ-BRAND-006 | AC-BRAND-006 | |
| REQ-BRAND-007 | AC-BRAND-007 | 부작위 — DESIGN-001 아키텍처 + 폰트 토큰 보존 |
| REQ-BRAND-008 | AC-BRAND-008, AC-BRAND-009 | 평면 토큰(008) + 파생 토큰 `color-mix` 기준색(009) |
| REQ-BRAND-009 | AC-BRAND-010 | `.plate` |
| REQ-BRAND-010 | AC-BRAND-011 | |
| REQ-BRAND-011 | AC-BRAND-012 (1번째 절) | AUTH-003 회귀 |
| REQ-BRAND-012 | AC-BRAND-012 (2번째 절) | AUTH-003 회귀 |
| REQ-BRAND-013 | AC-BRAND-013 | AUTH-004 회귀 |
| REQ-BRAND-014 | AC-BRAND-014, AC-BRAND-016 | 렌더링(014) + `Category` 파생(016) |
| REQ-BRAND-015 | AC-BRAND-015 | |
| REQ-BRAND-016 | AC-BRAND-017 | 부작위 |
| REQ-BRAND-017 | AC-BRAND-018 | |
| REQ-BRAND-018 | AC-BRAND-019 | |
| REQ-BRAND-019 | AC-BRAND-020 | 부작위 — 범위 침식 방지 |
| REQ-BRAND-020 | AC-BRAND-021 (1번째 절) | |
| REQ-BRAND-021 | AC-BRAND-022 | 멱등성 |
| REQ-BRAND-022 | AC-BRAND-023 (1·2번째 절) | |
| REQ-BRAND-023 | AC-BRAND-023 (3번째 절) | 부작위 |
| REQ-BRAND-024 | AC-BRAND-021 (2번째 절) | 부작위 — 합성 채움값 시드 금지 |
| — (횡단) | AC-BRAND-024 | 회귀 마감 |
| — (횡단) | AC-BRAND-025 | plan.md §D 무(無)마이그레이션 제약 검증 |

**커버리지**: REQ 24건 전부가 최소 1개 AC(또는 AC의 특정 절)에 대응한다. 고아 AC는 024·025 둘뿐이며, 각각 `plan.md` §D 제약을 검증하는 횡단 기준이다.

**예산**: REQ **24**건 / AC **25**건 — Tier L 상한(각 25) 이내. AC는 상한에 정확히 도달해 있다(§F).

---

## §F. 예산 관리 — 병합 근거와 잔여 여유

plan-audit iter1(FAIL 0.81)이 지적한 대로, AC가 상한 25에 붙어 있어 신규 AC를 넣을 자리가 없었다. 아래 두 쌍을 병합해 자리를 만들고, 그 자리에 AC-009(파생 토큰)와 AC-016(`Category` 파생)을 넣었다.

| 병합 | 근거 | 손실된 검증 |
|---|---|---|
| 구 AC-011 + 구 AC-012 → **AC-012** | 하나의 상태 구동 행동(`resolveSession()` 반환값)의 **상호 배타적 두 분기**다. 두 절 모두 각각 이진 판정되며, 한 AC 안에서 양방향을 함께 검증하는 편이 "반대 분기가 깨졌는데 통과"하는 구멍을 오히려 막는다 | 없음 — 두 단언 모두 절로 보존 |
| 구 AC-022 + 구 AC-023 → **AC-023** | 구 022는 `stock` → 활성 상태 매핑, 구 023은 "옵션 간 상태가 갈리지 않는다"는 불변식. 같은 UI의 같은 속성(`disabled`)에 대한 단언이며, 3개 절로 전부 보존했다 | 없음 — 세 단언 모두 절로 보존 |

**병합하지 않은 후보**: AC-001/002/003(서로 다른 파일·표면이라 실패 귀속이 흐려짐), AC-018/019(서로 다른 라우트·콘텐츠), AC-024/025(서로 다른 도구·판정 대상). 억지로 병합하지 않았다.

**잔여 여유: 0.** AC는 25/25다. 추가 AC가 필요한 지적이 또 나오면, 설계된 완충 장치는 **M7(사이즈 UI) 분리**다 — `plan.md` §B.1이 이를 위해 격리해 두었고, 분리 시 REQ-022/023 + AC-023이 함께 후속 SPEC으로 빠져 2칸이 열린다. 다만 원 위임 지시가 "cosmetic-only 사이즈 메커니즘에 대한 AC"를 명시적으로 요구했고 오케스트레이터가 M7 유지를 확인했으므로, 이번 반복에서는 분리하지 **않았다**.

REQ는 24/25로 1칸 여유가 있다. 이를 지키려고 D6(파생 토큰)·D7(`Category` 파생)에 신규 REQ를 만드는 대신 **기존 REQ-008·REQ-014의 열거를 완성**했다 — 두 결함 모두 "요구사항 자체가 없다"가 아니라 "요구사항의 열거가 불완전해 변경분이 빠져나갔다"였으므로, 하나의 요구사항을 둘로 쪼개는 것보다 열거를 메우는 편이 정확하다.

---

## §E. 완료 정의 (Definition of Done)

- AC-BRAND-001~025 전부 PASS.
- `plan.md` §E의 5개 명령 전부 성공, 출력이 `.moai/state/verify/brand-001/` 아래 보존됨.
- Prisma 마이그레이션 0건(AC-BRAND-025).
- design phase의 미결 확인 항목(`design.md` §5 체크리스트) 전부 해소 — 로고 파일, 제작 기간, **시로코 카테고리**, 카테고리 개수 포함.
