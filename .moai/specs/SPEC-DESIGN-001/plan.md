---
id: SPEC-DESIGN-001
status: draft
updated: 2026-09-05
tier: M
---

# Implementation Plan: SPEC-DESIGN-001

> 이 문서는 **결정의 되돌리기 어려움 순서**로 배치했다. 앞쪽(§B~§E)이 바뀔 가능성이 높고 검토 가치가 큰 결정이며, 뒤쪽(§F 이후)은 기계적 반영이다.

---

## §A. 배경 — 이 SPEC은 선행 결정의 반전이다

`spec.md` §1.1이 원문 인용과 함께 소유한다. 여기서는 plan 측 함의만 적는다.

디자인 토큰 체계와 `src/components/ui/`는 이 저장소에서 **이름을 지목해 네 차례 범위 밖으로 선언**됐다 — SPEC-STOREFRONT-001 `spec.md:143`, SPEC-STOREFRONT-002 `spec.md:159`, SPEC-STOREFRONT-003 `spec.md:132`, SPEC-AUTH-003 `spec.md:179`. 인접 사례로 SPEC-AUTH-002가 공통 헤더/내비게이션을 같은 이연 논리로 제외했다(`spec.md` 106-107행).

> **조사 정정 2건 (양방향 확인).**
>
> **(a) AUTH-002는 디자인 시스템을 제외하지 않았다.** 착수 지시의 전제와 달리, AUTH-002의 Out of Scope 절 7개 중 디자인 시스템을 지목한 것은 없다 — 제외 대상은 **공통 헤더/내비게이션**이었다.
>
> **(b) 그러나 제외 건수는 줄어든 것이 아니라 늘었다.** (a)의 확인은 한 방향(지목된 SPEC의 검증)이었고 전수 조사가 아니었다. `grep -rn "components/ui" .moai/specs/ --include=spec.md` 전수 스캔 결과 **SPEC-STOREFRONT-003:132**와 **SPEC-AUTH-003:179**가 추가로 발견됐다. 최종 수치는 **명시적 제외 4건 + 인접 이연 인용 1건**이다.
>
> **AUTH-003이 특히 중요하다** — 이 SPEC의 `depends_on:`에 이미 있고, 아래 §C가 그 `plan.md:204`(PRESERVE 목록)를 인용한다. 즉 **같은 SPEC이 제약의 출처이자 반전 대상**이다. 한쪽(`plan.md`)만 읽고 다른 쪽(`spec.md:179`)을 놓쳤던 것이 이번 정정의 교훈이다.

plan 측 함의는 두 가지다.

1. **`globals.css`의 주석은 반드시 교체된다.** 그 주석은 "이 SPEC은 그럴 권한이 없다"고 적혀 있고, 이 SPEC이 그 권한이다. 주석을 남긴 채 `@theme`만 추가하면 파일이 자기모순 상태가 된다(AC-DESIGN-002).
2. **선행 SPEC들을 수정하지 않는다.** 그들의 Out of Scope 선언은 *그 시점에 옳았던 결정*이며 사후 편집 대상이 아니다. 반전 사실은 이 SPEC 안에만 기록한다.

---

## §B. 되돌리기 어려운 결정 (검토 우선)

### §B.1 결정 — 공유 레이어의 메커니즘은 `src/components/ui/` 프리미티브 컴포넌트다

세 후보를 검토했고 1번을 택한다.

| 후보 | 내용 | 판정 |
|---|---|---|
| 1. `src/components/ui/` React 프리미티브 | `<Button>`, `<Field>` 등 컴포넌트로 감싼다 | **채택** |
| 2. Tailwind `@utility` / `@apply` 합성 클래스 | `globals.css`에 `.btn-primary` 같은 클래스를 만든다 | 기각 |
| 3. 토큰만 만들고 클래스 문자열은 그대로 복제 유지 | `@theme`만 추가 | 기각 |

**1을 택한 이유**: 실측된 복제는 클래스 문자열 단위가 아니라 *요소 단위*다 — 버튼 13곳은 `disabled:opacity-60`·`w-full`·`mt-6 inline-block` 같은 변형이 붙어 있고, 폼 필드 8곳은 라벨+입력+오류 텍스트가 **세트로** 반복된다. 컴포넌트 경계가 그 세트를 가장 정확히 포착한다.

**2를 기각한 이유**: `@apply` 합성 클래스는 복제를 CSS로 옮길 뿐 세트 구조(라벨-입력-오류)를 포착하지 못하고, Tailwind v4에서 권장되지 않는 방향이다.

**3을 기각한 이유**: 토큰만 있고 소비 지점이 복제된 채로 남으면 `LogoutButton` 같은 이탈이 재발한다 — 이 SPEC이 고치려는 결함의 원인이 정확히 "단일 정의처 부재"다.

**주의**: `src/components/ui/`는 선행 SPEC 4건이 **이름으로 지목해 제외한 바로 그 경로**다. 같은 이름을 쓰는 것은 의도적이다 — 선행 SPEC들이 "언젠가 만들 것"으로 상정한 경로를 그대로 실현해야 반전이 명확해진다.

### §B.1b 결정 — Route B (PR 경유), Tier 기본값을 명시적으로 재정의

**이 SPEC은 Route B(PR 경로)로 간다.** 사용자가 확정했다.

| 항목 | 값 |
|---|---|
| Tier S/M 기본 경로 | **Route A** — Hybrid Trunk main-direct (PR 없음, `main` 직접 푸시) |
| 이 SPEC이 택한 경로 | **Route B** — `manager-git`이 피처 브랜치 + PR 생성, PR 병합이 단계 전이 트리거 |
| 재정의 근거 | 약 23개 파일이 사이트 전체에 걸쳐 변경되며(§E 내역표), Classical 적용으로 시각 결과까지 바뀐다. 병합 전 리뷰 단계를 두는 편이 안전하다 |
| 발동 방법 | sync-phase에서 **`--pr` 플래그 사용** |

`spec-workflow.md` § SPEC Phase Discipline은 Route B를 "Tier L **OR** 명시적 `--pr`"로 규정한다. 이 SPEC은 Tier M이므로 **후자(명시적 `--pr`)**로 Route B에 진입한다 — Tier를 L로 올리지 않고도 PR 경로를 쓸 수 있으며, 이는 규칙이 의도한 사용법이다.

함의:
- 단계 전이 트리거가 커밋/푸시가 아니라 **PR 병합**이다.
- `manager-git`이 PR 생성을 담당한다(이 SPEC의 plan-phase 범위 밖 — sync-phase에서 발동).
- "단일 패스"(`spec.md` §1.3)는 **1 SPEC = 1 PR 단위**를 뜻하며, 내부 마일스톤 분할(§F)과 모순되지 않는다.

### §B.5 결정 — 폰트 로딩 방식: `next/font/google`, 단 **선행 실패의 재발 방지가 전제**

Classical은 자체 스타일시트 최상단에서 `@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600&family=Lora:wght@400;600&display=swap');`로 폰트를 불러온다. 그것은 **범용 HTML 문맥의 방식**이며 Next.js App Router 프로젝트에 그대로 복사할 대상이 아니다.

**여기에 이 저장소만의 사정이 있다 — 그리고 그것이 이 결정의 핵심이다.**

`src/app/layout.tsx:38-50`은 `next/font/google`을 **한 번 시도했다가 되돌린** 기록을 담고 있다. 원문:

> Typography comes from the system font stack in globals.css rather than `next/font/google`. […] plan.md §A named next/font/google, with §K R7 recording the build-time network fetch it introduces […] That fallback is taken here, for a second reason R7 did not anticipate: `next/font` needs the Next.js SWC font loader, which vitest does not run, so importing it made this shell untestable ("Inter is not a function").

즉 SPEC-STOREFRONT-001은 `next/font/google`을 채택했다가 **두 가지 구체적 실패**로 철회했다: (a) 빌드 타임 네트워크 페치, (b) **vitest에서 셸이 테스트 불가능해짐**(`Inter is not a function`).

세 후보를 놓고 판단한다.

| 후보 | 장점 | 이 저장소에서의 실제 비용 |
|---|---|---|
| 1. `next/font/google` | App Router 관용적. 렌더 차단 외부 요청 제거, 자동 self-host + preload, CLS 감소 | **선행 실패 2건이 그대로 재발한다.** vitest 회피책(폰트 로더 모킹) 필요 |
| 2. `globals.css`의 `@import` | Classical 원문 그대로. vitest 무영향. 구현 즉시 동작 | 렌더 차단 외부 요청 1건 추가. 오프라인/CI 빌드 의존성. FOUT/CLS |
| 3. 폰트 파일 self-host | 네트워크 의존 0, vitest 무영향 | 폰트 파일 커밋 + `@font-face` 수기 작성. 라이선스 확인 필요 |

**채택: 후보 1(`next/font/google`) — 단, vitest 대응을 별도 작업 항목으로 명시한다. 2026-09-05 사용자 확정.**

근거: (b)는 **해결 가능한 테스트 인프라 문제**이지 `next/font`의 본질적 결함이 아니다. vitest 설정에 폰트 로더 모듈 모킹을 추가하면 해소되며, 이는 Next.js + vitest 조합에서 널리 쓰이는 표준 대응이다. (a) 빌드 타임 페치는 `next/font`가 빌드 시 폰트를 내려받아 **self-host**하기 때문에 발생하는 것이고, 그 대가로 런타임 외부 요청이 **사라진다** — 후보 2는 정확히 그 반대(빌드 의존 없음, 런타임 의존 있음)라 사용자 체감 성능에서 더 나쁘다.

**단, 이 채택은 선행 SPEC의 판단을 가볍게 뒤집는 것이 아니다.** STOREFRONT-001은 "기본 타이포그래피"만 필요했으므로 시스템 스택으로 충분했고 철회가 합리적이었다. 이 SPEC은 **특정 세리프 페어링이 요구사항 자체**이므로 시스템 스택이라는 선택지가 없다. 전제가 달라졌기 때문에 결론이 달라진다.

**M1의 필수 선행 작업(생략 불가)**: vitest 폰트 로더 모킹을 먼저 넣고, `layout.tsx`의 낡은 주석(위 인용문)을 이 결정으로 교체한다. **모킹 없이 `next/font` import를 추가하면 셸 테스트가 즉시 깨지며, 이는 AC-DESIGN-012(무회귀)의 직접 위반이다.** 모킹이 실패하면 후보 2로 되돌린다 — 그 경우 되돌림 사실과 사유를 `layout.tsx` 주석에 남긴다.

### §B.6 결정 — Lucide 아이콘: 의존성 추가가 필요하나, **이번 범위에서는 도입하지 않는다**

Classical의 readme는 아이콘 체계로 **Lucide**를 지정한다.

**실측**: `package.json`에 `lucide-react`가 **없다.** 아이콘 라이브러리가 하나도 없다(`react-icons`/`@heroicons` 모두 부재).

**판단: 이번 SPEC에서는 도입하지 않는다.**

- 이 SPEC이 건드리는 요소(버튼·폼 필드·카드·헤더)에 **현재 아이콘이 하나도 없다** — 도입해도 사용처가 없다.
- AC-DESIGN-006이 **신규 의존성 0건**을 요구한다. 아이콘 도입은 그 AC를 깨며, 대체 AC를 만들 예산(16/16, 여유 0)이 없다.
- 아이콘이 실제로 필요해지는 시점(`.btn-icon`, 내비게이션 아이콘 등)은 이 SPEC이 계획한 작업 밖이다.

따라서 **`lucide-react`는 후속 SPEC의 의존성 항목으로 이월한다**(§4 전방 포인터). 이 SPEC은 아이콘 없이 Classical의 타이포·색·버튼 체계만 적용한다 — Classical 자체가 아이콘을 필수 전제로 삼지 않으므로 부분 적용이 성립한다.

### §B.2 결정 — 토큰 값의 출처 (이전 판에서 변경)

`spec.md` §1.5가 소유한 결정. **이전 판에서 뒤집힌 부분**: 값 확정을 design phase로 이연한다고 적었으나, DesignSync 인가로 Classical의 실제 토큰을 확보해 **이 문서 §D.1에 원문 그대로 고정**했다.

plan 측 계약:

- **이 문서는 값을 발명하지 않는다** — §D.1 블록은 Classical `styles.css`의 축자 인용이다.
- 값의 SSOT는 §D.1이며, run-phase는 그 블록을 전사할 뿐 재계산·의역하지 않는다(REQ-DESIGN-008).
- design phase의 역할이 "값 확보"에서 **"값 재검증"**으로 바뀌었다(REQ-DESIGN-009/010, §B.3).

### §B.3 [해소됨] DesignSync 가용성 — 토큰 확보 완료, 역할은 "재검증"으로 축소

**이전 판의 조건 분기는 해소됐다.** 이전에는 `.mcp.json`에 DesignSync가 없어(등록된 서버는 `context7`/`moai`/`playwright` 3개) 1차 경로(내려받기) vs 폴백 경로(로컬 등가물)를 모두 정의해 두었다. **DesignSync가 인가되어 Classical 프로젝트의 `styles.css`·`readme.md`·컴포넌트 페이지를 실제로 읽었고, 확정 토큰은 §D.1에 원문으로 고정됐다.**

따라서 STOREFRONT-002/003이 세운 "로컬 등가물" 선례는 **이 SPEC에 더 이상 적용되지 않는다.** 그 선례는 원격 원천이 아예 없을 때의 대응이었고, 이제 원천 값을 갖고 있다.

남은 분기는 훨씬 좁다 — design phase 실행 시점에 DesignSync에 다시 접근할 수 있는지 여부뿐이다.

| 경로 | 조건 | 처리 |
|---|---|---|
| **재검증 (선호)** | design phase 실행 시 DesignSync 사용 가능 | §D.1 블록을 라이브 Classical 프로젝트와 대조해 불일치 여부를 기록(REQ-DESIGN-009) |
| **오프라인 진행** | 재접근 불가 | §D.1 블록을 오프라인 SSOT로 삼아 그대로 진행하고, 라이브 재검증이 없었음을 기록(REQ-DESIGN-010) |

**어느 쪽이든 이 SPEC은 완전히 진행 가능하다.** 값을 이미 갖고 있으므로 도구 부재가 더 이상 차단 요인이 아니다 — 이것이 이전 판 대비 가장 큰 상태 변화다. `manager-design.md` § Tool Availability의 graceful-degradation 계약은 여전히 유효하나, 이제 그 "degradation"이 잃는 것은 **재검증 한 단계**뿐이다.

### §B.4 결정 — 브랜드 인터뷰는 1차 경로가 아니다

**실측**: `.moai/project/brand/` 디렉터리가 **존재하지 않는다**. `design.yaml`은 `brand_context.dir: ".moai/project/brand"` + `interview_on_first_run: true`로 설정되어 있어, 통상적이라면 design phase가 브랜드 인터뷰를 트리거한다.

이 SPEC에서는 그 트리거가 **1차 경로가 아니다.** 디자인 원천이 이미 Claude Design 프로젝트로 존재하므로, 백지 상태에서 브랜드를 발굴하는 인터뷰가 아니라 **기존 원천의 내려받기**가 맞는 순서다. D1-D2가 인터뷰를 대체한다.

이는 **배경 사실이지 이 SPEC이 내리는 결정이 아니다** — `design.yaml` 설정을 바꾸지 않으며, design phase가 인터뷰를 시도할 경우 "원천이 이미 있다"는 사실을 근거로 D1-D2로 우회하면 된다. `product.md`는 타깃/도메인 정보(모바일 우선 B2C 패션, 게스트 체크아웃 친화)는 갖고 있으나 색상·타이포그래피·톤 내용은 0건이므로, 로컬 폴백 시에도 브랜드 서술을 발명하지 않는다.

---

## §C. PRESERVE 핀과의 상호작용 (명시적 정리)

SPEC-AUTH-004 §C가 확립한 처리 방식을 따른다 — **이름을 대고, 근거를 적고, 조용히 넘어가지 않는다.**

SPEC-AUTH-003 `plan.md:204`가 다음을 PRESERVE로 열거했다:

> `src/middleware.ts`, `src/lib/auth/session-resolver.ts`, `src/lib/auth/csrf.ts`, `src/lib/auth/cookies.ts`, `src/app/api/auth/logout/route.ts`, `src/app/products/[productId]/page.tsx`, `src/components/product/ProductDetailView.tsx`, `src/app/staff/**`, `prisma/schema.prisma`

### §C.1 이 SPEC이 건드리지 않는 핀 — 전원 무관

`src/middleware.ts`, `session-resolver.ts`, `csrf.ts`, `cookies.ts`, `logout/route.ts`, `prisma/schema.prisma`는 **스타일 표면이 전혀 없다**(라우팅·세션·CSRF·스키마 로직). 이 SPEC은 이들을 수정하지 않으며, 수정할 이유도 발생하지 않는다.

### §C.2 이 SPEC이 건드리는 핀 — `src/app/staff/**` (스타일 한정)

**충돌 지점**: AUTH-003이 `src/app/staff/**`를 PRESERVE로 핀했으나, 이 SPEC은 스태프 페이지 6장과 코로케이션 컴포넌트 1개(`ProductForm.tsx`)의 버튼·폼 필드를 프리미티브로 교체해야 한다.

**판단**: PRESERVE 핀은 **그 SPEC의 run-phase 범위 제약**이며(AUTH-003이 `git diff --stat` 무변경으로 검증한 대상), 이후 모든 SPEC에 대한 영구 동결이 아니다. AUTH-004도 핀된 파일을 사용자 승인 하에 이동한 선례가 있다(`plan.md:106`).

**따라서 이 SPEC은 다음 스태프 파일만 스타일 목적으로 수정한다. 이 목록은 허용 상한(allow-list)이며, AC-DESIGN-015는 실제 diff가 이 목록의 부분집합일 것을 요구한다 — 정확 일치가 아니다.**

| # | 파일 | 이 SPEC 범위의 대상 | 실제 수정 예상 |
|---|---|---|---|
| 1 | `src/app/staff/login/page.tsx` | 버튼 1, 폼 입력 2 | 예 |
| 2 | `src/app/staff/products/page.tsx` | 버튼 1 | 예 |
| 3 | `src/app/staff/products/ProductForm.tsx` | 버튼 1, 폼 입력 5 | 예 |
| 4 | `src/app/staff/products/new/page.tsx` | **0건**(폼은 ProductForm 소유) | 아니오(예상) |
| 5 | `src/app/staff/products/[productId]/page.tsx` | **0건**(폼은 ProductForm 소유) | 아니오(예상) |
| 6 | `src/app/staff/orders/page.tsx` | **0건** | 아니오(예상) |
| 7 | `src/app/staff/orders/[orderId]/page.tsx` | **0건** | 아니오(예상) |

**4-7번은 실측 결과 이 SPEC 범위의 버튼·링크·`rounded-md` 사용이 0건이다.** 목록에 남겨 두는 이유는 run-phase에서 예상치 못한 대상이 발견될 경우의 허용 상한을 미리 정해 두기 위해서이며, **변경되지 않은 채 남는 것이 정상이다.** 정확 일치를 요구하면 이 AC는 구조적으로 달성 불가능해지고, 억지로 맞추려면 AUTH-003 PRESERVE 핀 경로에 의미 없는 편집을 가해야 한다.

**`CancelOrderButton.tsx`는 이 목록에서 제외됐다** — 그 파일의 버튼(`:88`)은 `rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60`, 즉 위험(destructive) 변형이며 이 SPEC이 다루는 기본 액션 수렴(`bg-neutral-900`, 13개 파일)에 속하지 않는다. REQ-DESIGN-005도 §D.2 추출 표도 그 파일을 덮지 않는다. `spec.md` §3 `### Out of Scope — 위험/파괴적 액션 버튼 변형` 참조.

**제약**: 이 파일들에서 **스타일 이외 어떤 것도 바꾸지 않는다** — CSRF 파싱, 폼 제출 로직, 라우팅, 주석 전부 무수정. 특히 §G 안티패턴 1을 참조.

### §C.3 `LogoutButton.tsx`의 CSRF 유틸 — 손대지 않는다

`LogoutButton.tsx`의 `@MX:NOTE`(9-17행)는 `readCsrfToken()`을 공유 유틸로 추출하지 **않기로** 한 결정을 기록하고 있다. 근거는 그러려면 `CancelOrderButton.tsx`와 `ProductForm.tsx`(둘 다 PRESERVE)를 수정해야 한다는 것이었다.

**이 SPEC은 그 결정을 유지한다.** 이 SPEC이 §C.2에서 그 두 파일을 어차피 건드리므로 "이제 추출해도 되겠다"는 유혹이 생기지만, 그것은 **스타일 롤아웃의 범위가 아니다**(§G 안티패턴 1). 이 SPEC은 `LogoutButton.tsx`의 **48행 `<button>` 요소만** 바꾸고 CSRF 관련 코드와 주석은 한 글자도 건드리지 않는다.

### §C.4 [판정 변경] `SiteHeader.tsx` — 무변경 → **수정 대상**

**이전 판은 이 파일을 무변경으로 판정했다.** 근거는 "`LogoutButton`을 렌더할 뿐이므로 스타일 변경이 자식 컴포넌트 안에서 끝난다"였다. **Classical 토큰 확보로 그 판정이 뒤집혔다** — Classical의 `.nav` + `.nav-brand`가 사이트 헤더에 **1:1로 대응**하며(§D.3에서 가장 신뢰도 높은 매핑), 헤더만 이전 타이포·색으로 남으면 사이트에서 가장 눈에 띄는 요소가 나머지와 어긋난다.

**AC-AUTH-056과 충돌하지 않는다.** SPEC-AUTH-004 `plan.md:229`가 이 파일을 파일 단위로 봉인하고 AC-AUTH-056이 빈 diff를 요구한 것은 **그 SPEC의 run-phase에 한정된 제약**이며, AUTH-004는 이미 완료됐다. §C.2에서 `src/app/staff/**` PRESERVE 핀을 다룬 것과 동일한 논리다 — 핀은 해당 SPEC의 범위 제약이지 영구 동결이 아니다.

**적용 제약**: `.nav`/`.nav-brand`에 해당하는 **시각 스타일만** 바꾼다. AUTH-004가 이 파일에 걸어 둔 구조적 결정 — 헤더가 `src/app/(shop)/layout.tsx`에만 존재하고 루트 레이아웃에는 없다는 것(AC-AUTH-049) — 은 **건드리지 않는다.** 렌더 위치·조건부 렌더 로직·주석 전부 무수정.

---

## §D. 토큰·컴포넌트 인벤토리

### §D.1 Classical 토큰 블록 — 확정 값 (원문 인용, SSOT)

아래는 Classical 디자인 시스템 `styles.css`의 `:root` 블록 **원문 그대로**다. REQ-DESIGN-008이 이 블록의 축자 전사를 요구한다 — 재타이핑·의역·반올림 금지. Tailwind v4 `@theme`으로 옮길 때 변수명 매핑만 하고 값은 손대지 않는다.

```css
:root {
  --color-bg: #f3f2f2;
  --color-surface: #eae9e9;
  --color-text: #201f1d;
  --color-accent: #b68235;
  --color-accent-2: #ac803e;
  --color-divider: color-mix(in srgb, #201f1d 16%, transparent);
  --color-neutral-100: #f8f4f4; --color-neutral-200: #eae7e7; --color-neutral-300: #d7d3d3;
  --color-neutral-400: #bab6b6; --color-neutral-500: #9b9797; --color-neutral-600: #7d7979;
  --color-neutral-700: #605d5d; --color-neutral-800: #444141; --color-neutral-900: #2d2b2b;
  --color-accent-100: #fff3e4; --color-accent-200: #ffe3bf; --color-accent-300: #facb8d;
  --color-accent-400: #e1ad66; --color-accent-500: #c28d41; --color-accent-600: #a06f24;
  --color-accent-700: #7d5411; --color-accent-800: #5a3b0a; --color-accent-900: #3a270d;
  --font-heading: "Cormorant Garamond", system-ui, sans-serif;
  --font-heading-weight: 600;
  --font-body: "Lora", system-ui, sans-serif;
  --space-1: 4.6px; --space-2: 9.2px; --space-3: 13.8px; --space-4: 18.4px; --space-6: 27.6px; --space-8: 36.8px;
  --radius-sm: 2px; --radius-md: 4px; --radius-lg: 7px;
  --shadow-sm: 0 1px 2px color-mix(in srgb, #2d2b2b 14%, transparent);
  --shadow-md: 0 3px 10px color-mix(in srgb, #2d2b2b 16%, transparent);
  --shadow-lg: 0 12px 32px color-mix(in srgb, #2d2b2b 22%, transparent);
}
```

주의할 점 세 가지:

1. **`--color-neutral-*`는 현재 코드의 Tailwind `neutral-*`와 다른 값이다.** Classical의 neutral은 따뜻한 회색(`#f8f4f4`~`#2d2b2b`)이고 Tailwind 기본 neutral은 중성 회색이다. 이름이 같다고 같은 값으로 취급하면 안 된다.
2. **단일 accent(mono) 체계다.** `--color-accent`(+`-2`, 그리고 100-900 램프)뿐이며 **위험/오류용 색상 역할이 없다**. 현재 코드의 `text-red-600`(15개 파일 21곳)과 `bg-red-600`이 대응 토큰을 갖지 못한다 — `spec.md` §3이 위험 변형을 범위 밖으로 두는 근거다.
3. **간격 스케일이 1.15× 비율의 비정수 px다**(4.6 / 9.2 / 13.8 …). 정수로 반올림하지 않는다 — readme가 "의도적으로 넉넉한(airy)" 스케일이라고 명시한다.

### §D.1b 현재 값 → Classical 매핑 (교체 표)

| 현재 코드 | Classical 대체 | 성격 |
|---|---|---|
| `bg-neutral-900` + `text-white` (버튼) | `background: transparent` + `border-color: var(--color-accent)` + `color: var(--color-accent)` | **정반대 전환** |
| `text-neutral-900` (본문) | `var(--color-text)` = `#201f1d` | 값 교체 |
| `border-neutral-300` | `var(--color-divider)` (헤어라인) | 값 교체 |
| 흰 배경 | `var(--color-bg)` = `#f3f2f2` | 값 교체 |
| 시스템 sans 스택 | `var(--font-heading)` / `var(--font-body)` | **폰트 교체** |
| `rounded-md` | `var(--radius-md)` = `4px` | 근사 유지 |
| `px-4 py-2` / `px-3 py-2` | `--space-*` 스케일 기반 | 값 교체 |
| `text-red-600` / `bg-red-600` | **대응 토큰 없음** | 범위 밖(`spec.md` §3) |

### §D.2 프리미티브로 추출할 것 vs 유틸리티 클래스로 남길 것

| 대상 | 처리 | 근거 |
|---|---|---|
| 기본 액션 버튼 (13개 파일) | **프리미티브 추출** | 실측 복제 최대. 변형(`w-full`, `disabled:opacity-60`, `inline-block`)은 props로 흡수 |
| 폼 입력 + 라벨 + 오류 텍스트 (정확 일치 7개 파일 + 근접 변형 1개 = 8개) | **프리미티브 추출** | 세트로 반복됨. 근접 변형은 `CheckoutInteractive.tsx:138`(선행 `mt-1` 없음) — 여백 prop으로 흡수 |
| `LogoutButton` | **프리미티브 소비자로 전환** | 유일한 실제 이탈 |
| 레이아웃 그리드·여백·flex 배치 | **유틸리티 클래스 유지 (토큰 참조)** | 페이지별로 고유하며 복제가 아니다. 추출하면 과설계 |
| 타이포그래피 견출 (제목 등) | **유틸리티 클래스 유지 (토큰 참조)** | 복제 패턴 미관측 |
| 모달·토스트·드롭다운·탭 | **만들지 않음** | 코드에 존재하지 않음. `spec.md` §3 |

원칙: **실측된 복제에만 프리미티브를 만든다.** 예상되는 미래 수요로는 만들지 않는다.

### §D.3 Classical 컴포넌트 클래스 → 저장소 컴포넌트 매핑

| Classical 클래스 | 저장소 대상 | 신뢰도 |
|---|---|---|
| `.btn` / `.btn-primary` (아웃라인) / `.btn-block` (전폭) | 13개 파일의 기본 액션 버튼 — `PayButton`, `AddToCartButton`, `CheckoutForm`, `OrderLookupForm`, 스태프 저장 버튼 등 | 높음 (수렴 실측 완료) |
| `.btn-secondary` (divider 색 테두리) / `.btn-ghost` | `CartView`/`EmptyCart`의 보조 링크형 버튼 | 중간 (run-phase에서 개별 판단) |
| `.field` + `label` + `.input` (`textarea.input` 포함) | 폼 8개 파일 — `CheckoutForm`, `OrderLookupForm`, `ProductForm`, `ReviewForm`, `CheckoutInteractive`, login/signup ×2, staff/login | 높음 |
| `.nav` + `.nav-brand` | **`src/components/layout/SiteHeader.tsx`** | **최고 — 1:1 대응** |
| `.card` / `.card-title` / `.card-body` / `.card-meta` + `.elev-sm` | `src/components/product/ProductCard.tsx` | 높음 |
| `.radio`+`.dot`, `.seg`+`.seg-opt`, `.tag`, `.table`, `.dialog` | **도입하지 않음** — 대응 컴포넌트 부재 | `spec.md` §3 |
| `.plate` (사진 래퍼) | `ProductGallery.tsx` — **이번 범위 밖, 전방 포인터**(§4) | 이미지 처리는 이 SPEC이 계획한 대상이 아님 |

**`SiteHeader.tsx`는 §C.4의 이전 판정이 뒤집힌 지점이다** — 자세한 내용은 §C.4 참조.

### §D.4 Classical readme의 명시적 제약 (제안이 아니라 제약)

run-phase가 반드시 지켜야 하는 항목이다. 각 항목은 readme 원문 지시에서 왔다.

1. **버튼·카드는 아웃라인/테두리. accent 색으로 솔리드 채움 금지.** — readme 원문: *"Do not fill cards or buttons with solid accent color."* REQ-DESIGN-005가 이를 고정한다.
2. **무거운 그림자 금지.** 입면(elevation)은 "속삭임" 수준 — `--shadow-sm/md/lg` 세 개만 사용하고 새 그림자를 만들지 않는다.
3. **본문은 레이아웃이 허용하는 곳에서 양쪽 정렬(justified).** 행간을 좁히거나 여백을 빽빽하게 만들지 않는다 — 간격 스케일은 의도적으로 1.15× 넉넉하다.
4. **포커스 링**: `:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }`. 브라우저 기본 포커스 링을 그대로 두지 않는다.
   > **실측 확인 — 제거 대상 1건 발견.** `src/components/product/ProductCard.tsx:40`이 이미 다른 포커스 스타일을 하드코딩하고 있다: `focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2`. Classical 규칙을 적용하려면 이 `ring-*` 방식을 제거해야 한다(`outline` 방식과 병존하면 이중 표시). 저장소 전체에서 포커스 스타일을 가진 곳은 이 한 곳뿐임을 grep으로 확인했다.
5. **아이콘은 Lucide.** → §B.6 의존성 결정 참조.

---

## §E. Tier 판정과 기록된 긴장

**Tier M** — 착수 전 사용자가 확정(`spec.md` §1.3).

정직하게 기록한다: **`spec-workflow.md` § SPEC Complexity Tier의 "Files affected" 축과는 긴장이 있다.**

| 축 | Tier M 가이드 | 이 SPEC 실측 | 판정 |
|---|---|---|---|
| LOC | 300-1000 | 대부분 className 문자열 교체 — 1000 미만 예상 | M 부합 |
| Files affected | 5-15 | **약 23** (아래 내역) | **M 초과, L 구간** |
| REQ / AC | 각 16 이하 | REQ 13 / AC 16 | M 부합 |
| 산출물 | spec/plan/acceptance 3종 | 3종 + `spec-compact.md` | M 부합 |

**파일 수 내역(이전 판 "25-30"은 집합 중복 계산이었다 — plan-audit R5 정정)**:

| 구분 | 수 |
|---|---|
| 버튼·폼 소비 파일 (폼 8은 버튼 13의 부분집합) | 13 |
| 버튼/폼이 없는 나머지 페이지 (전체 15장 중) | 6 |
| `globals.css` + `layout.tsx` | 2 |
| 신규 프리미티브 (`src/components/ui/`) | 2 |
| Classical 매핑 추가 — `SiteHeader.tsx`, `ProductCard.tsx` | 2 |
| **합계** | **약 23** |

감사자의 독립 재계산(19-22)에 Classical 매핑 추가분 2건을 더한 값이다. 이전 판의 "25-30"은 버튼 집합과 폼 집합을 합집합이 아니라 단순 합산해 중복을 세었다.

**사용자 결정 근거(재논의 대상 아님)**: (a) 이 저장소에서 디자인 산출물을 만든 선행 SPEC 2건이 모두 Tier M으로 Conditional Design Route를 탔고 Tier L을 요구한 적이 없다, (b) 단일 파일 1000 LOC 초과 우려가 없다.

**Classical 반영 후 재평가.** 감사자가 확인한 완화 논거("얕고 균질한 변경")는 유지된다 — 23개 파일 대부분이 className을 프리미티브 호출로 바꾸는 동일 변환이다. 다만 **위험은 이전 판보다 올라갔다**: 아웃라인 전환과 폰트 교체는 값 치환이 아니라 시각 결과를 바꾸는 변경이고, M0(vitest 폰트 모킹)는 실패 가능성이 있는 인프라 작업이다. 그럼에도 Tier 상향 사유로 보지 않는 근거는 파일당 변경 깊이가 그대로라는 점과, M0를 독립 마일스톤으로 분리해 실패 시 되돌림 경로(§B.5 후보 2)를 미리 정의해 둔 점이다.

**긴장을 완화하는 성질**: 파일 수는 많지만 **파일당 변경이 얕고 균질하다**(className 참조를 프리미티브 호출로 교체). Tier L의 "Files affected > 15" 기준이 겨냥하는 위험은 서로 다른 하위 시스템에 걸친 이질적 변경인데, 이 SPEC은 한 종류의 변경을 넓게 반복한다.

**이 항목은 plan-audit에 그대로 노출한다** — 감사자가 놓친 것이 아니라 알고 내린 결정임을 보이기 위해서다. 미해결 명료화 항목으로 두지 않는 이유는 사용자가 이미 확정했기 때문이다.

---

## §F. 마일스톤

단일 패스(1 SPEC / 1 PR 단위)이며, 내부 순서만 나눈다.

### M0 — 폰트 로딩 선행 작업 (§B.5 전제)
- vitest 폰트 로더 모킹 추가 → 셸 테스트가 `next/font` import와 공존하는지 확인
- `src/app/layout.tsx`에 `next/font/google`로 Cormorant Garamond(400/600) + Lora(400/600) 로딩, 낡은 주석 교체
- **모킹이 실패하면 §B.5 후보 2(`@import`)로 되돌리고 사유를 주석에 기록** — 여기서 막힌 채로 M1로 넘어가지 않는다
- 산출: AC-DESIGN-012의 선행 조건(테스트 무회귀)

### M1 — 토큰 + 프리미티브 (기반)
- `src/app/globals.css`에 §D.1 Classical 토큰 블록을 `@theme`으로 전사, 낡은 주석 제거
- `src/components/ui/` 신설: 버튼 프리미티브(**아웃라인**), 폼 필드 프리미티브(입력/라벨/오류)
- `:focus-visible` 규칙 도입(§D.4-4)
- 프리미티브 단위 테스트 신규 작성
- 산출: AC-DESIGN-001~006

### M2 — `LogoutButton` 구체 결함 수정
- `src/components/layout/LogoutButton.tsx` 48행을 프리미티브 경유로 교체
- CSRF 코드·주석 무수정(§C.3)
- 산출: AC-DESIGN-007

> M2를 M3보다 먼저 두는 이유: 이 SPEC이 고치겠다고 약속한 **유일한 구체적 결함**이므로 대량 스윕에 섞여 묻히지 않게 독립 마일스톤으로 고정한다.

### M3 — 고객 화면 9장
1. `src/app/(shop)/page.tsx` (홈)
2. `src/app/(shop)/products/[productId]/page.tsx`
3. `src/app/(shop)/cart/page.tsx`
4. `src/app/(shop)/checkout/page.tsx`
5. `src/app/(shop)/checkout/complete/[orderId]/page.tsx`
6. `src/app/(shop)/login/page.tsx`
7. `src/app/(shop)/signup/page.tsx`
8. `src/app/(shop)/orders/lookup/page.tsx`
9. `src/app/(shop)/orders/lookup/[orderNumber]/page.tsx`

동반 컴포넌트: `src/components/cart/{CartView,EmptyCart}.tsx`, `src/components/checkout/{CheckoutForm,CheckoutInteractive,PayButton}.tsx`, `src/components/orders/OrderLookupForm.tsx`, `src/components/product/{AddToCartButton,ReviewForm}.tsx`

Classical 매핑으로 추가된 2건(§D.3):
- `src/components/layout/SiteHeader.tsx` — `.nav`/`.nav-brand` 적용(§C.4 판정 변경). **시각 스타일만**, 렌더 구조 무수정
- `src/components/product/ProductCard.tsx` — `.card` 계열 적용 + 하드코딩된 `focus-visible:ring-*` 제거(§D.4-4 실측)

### M4 — 스태프 화면 6장 + 코로케이션 컴포넌트 1개
1. `src/app/staff/login/page.tsx`
2. `src/app/staff/products/page.tsx`
3. `src/app/staff/products/new/page.tsx`
4. `src/app/staff/products/[productId]/page.tsx`
5. `src/app/staff/orders/page.tsx`
6. `src/app/staff/orders/[orderId]/page.tsx`

동반: `src/app/staff/products/ProductForm.tsx` (§C.2 허용 목록의 부분집합). `CancelOrderButton.tsx`는 위험 변형이라 범위 밖 — `spec.md` §3.

### M5 — 검증 마감
- AC-DESIGN-008/009 grep 소거 확인
- AC-DESIGN-010 15개 페이지 전수 대조("해당 없음" 명시 포함)
- AC-DESIGN-012 베이스라인 대조
- AC-DESIGN-015 스태프 diff가 §C.2 허용 목록의 **부분집합**인지 확인(목록 밖 0건; 미변경 파일은 정상)
- `@MX` 주석 확정(§H)

> **베이스라인 캡처는 M1 첫 편집 이전에 수행한다** — 롤아웃이 시작된 뒤 캡처하면 베이스라인이 오염된다(AC-DESIGN-012).

---

## §G. 안티패턴 (범하지 말 것)

1. **CSRF 파서를 공유 유틸로 추출하기.** §C.2에서 `ProductForm.tsx`를 어차피 열게 되므로 적기로 보이지만, SPEC-AUTH-003이 명시적으로 내린 결정이며 스타일 롤아웃의 범위가 아니다(§C.3). `CancelOrderButton.tsx`는 이제 아예 범위 밖이므로 유혹의 근거가 더 약해졌다.
2. **토큰 값을 발명·재계산·반올림하기.** §D.1 블록을 축자 전사한다. `4.6px`은 `5px`가 아니고, Classical의 `--color-neutral-*`는 Tailwind `neutral-*`와 다른 값이다(§D.1 주의 1).
2b. **현재의 솔리드 버튼 스타일을 그대로 토큰화하기.** 13개 파일 수렴은 교체 대상이지 보존 대상이 아니다(`spec.md` §1.2). AC-DESIGN-008 (b)/(c)가 이를 막는다.
2c. **vitest 폰트 모킹 없이 `next/font` import 추가하기.** 선행 SPEC이 실측한 `Inter is not a function` 실패가 재발하고 AC-DESIGN-012를 직접 위반한다(§B.5, M0).
2d. **`lucide-react`를 "어차피 필요하니" 미리 추가하기.** 이 SPEC 범위에 아이콘 사용처가 없고 AC-DESIGN-006이 신규 의존성 0건을 요구한다(§B.6).
3. **스태프 컴포넌트를 `src/components/`로 옮기기.** 코로케이션은 SPEC-ADMIN-002의 확립된 관례다(REQ-DESIGN-011).
4. **레이아웃을 "개선"하기.** 여백 리듬 재설계, 그리드 변경, 화면 재배치는 전부 범위 밖이다.
   > **경계선을 정확히**: 이 SPEC은 **색·타이포·버튼 스타일을 바꾼다**(Classical 적용 — `spec.md` §1.2). 바꾸지 않는 것은 **화면 구조**다. "재디자인이 아니다"를 "외형이 그대로여야 한다"로 읽으면 정반대다 — 외형은 눈에 띄게 달라지고, 레이아웃만 그대로다.
5. **모달·토스트 등 미래 프리미티브를 미리 만들기.** 실측 복제에만 대응한다(§D.2).
6. **`@apply`로 합성 클래스를 만들기.** §B.1에서 기각된 후보 2다.
7. **선행 SPEC의 Out of Scope 절을 수정하기.** 그 선언들은 당시 옳았고 사후 편집 대상이 아니다(§A).
8. **`SiteHeader.tsx`의 렌더 구조를 건드리기.** 이제 이 파일은 수정 대상이지만(§C.4 판정 변경) **시각 스타일만** 바꾼다 — 헤더가 `(shop)/layout.tsx`에만 존재한다는 AUTH-004의 구조 결정(AC-AUTH-049)은 무수정이다.
9. **다크 모드 대응을 "겸사겸사" 넣기.** `spec.md` §3이 명시적으로 제외한다.
10. **신규 의존성(CVA 등) 추가하기.** AC-DESIGN-006이 0건을 요구한다.

---

## §H. @MX 태그 계획

| 대상 | 예상 fan_in | 계획 |
|---|---|---|
| 버튼 프리미티브 | 13개 파일 이상 → 3건 초과 | **`@MX:ANCHOR` 필수** — 저장소 최고 fan-in 컴포넌트가 된다 |
| 폼 입력 프리미티브 | 8개 파일(정확 7 + 근접 1) → 3건 초과 | **`@MX:ANCHOR` 필수** |
| 라벨/오류 텍스트 프리미티브 | 폼 입력과 동반 | fan-in 실측 후 3건 이상이면 `@MX:ANCHOR`, 미만이면 `@MX:NOTE` |
| `globals.css` `@theme` 블록 | n/a (CSS) | 토큰 원천과 재동기화 조건을 설명하는 주석 — §A.1의 낡은 주석을 대체 |
| `LogoutButton.tsx` | 1 (SiteHeader) | 기존 `@MX:NOTE` 유지, **CSRF 관련 문장 무수정** |

`@MX:ANCHOR` 의무선은 fan_in ≥ 3(CLAUDE.md § MX Tag Quality Gates). 실측은 M5에서 확정한다 — 위 숫자는 현재 복제 파일 수 기준 예상치다.

---

## §I. 자체 검증 명령

```
npx tsc --noEmit
npm run lint
npm test                      # AC-DESIGN-012 베이스라인 대조
grep -rl "rounded-md bg-neutral-900" src/ | grep -v "src/components/ui/"     # AC-DESIGN-008 → 0건
grep -rl "w-full rounded-md border border-neutral-300" src/ | grep -v "src/components/ui/"  # AC-DESIGN-009 → 0건
grep -c "No \`@theme\` block" src/app/globals.css                            # AC-DESIGN-002 → 0
grep -rn "neutral-900\|neutral-300" src/components/ui/                       # AC-DESIGN-005 → 0건
grep -rn "focus-visible:ring" src/                                           # AC-DESIGN-005(c) → 0건 (착수 전 1건: ProductCard.tsx:40)
grep -c "rather than" src/app/layout.tsx                                     # AC-DESIGN-003(c) → 낡은 폰트 주석 0건
grep -E "4\.6px|#f3f2f2|#b68235|Cormorant Garamond|Lora" src/app/globals.css # AC-DESIGN-001 → Classical 값 축자 존재
grep -rn "bg-\[var(--color-accent)\]" src/components/ui/                     # AC-DESIGN-008(c) → 0건 (accent 솔리드 채움 금지)
git diff --name-only -- src/app/staff/                                       # AC-DESIGN-015 → 결과가 §C.2 목록의 부분집합(목록 밖 0건)
git diff --stat -- package.json                                              # AC-DESIGN-006 → 의존성 추가 0건
```

---

## §J. 미해결 명료화 항목

**0건.** 미해결 명료화 마커 없음. 사용자 확정 사항 정리:

| 항목 | 확정 내용 | 시점 |
|---|---|---|
| Tier | M (파일 수 축 초과를 알고 내린 결정 — §E) | 착수 전 |
| 롤아웃 | 단일 패스 전체 사이트 (1 SPEC / 1 PR 단위) | 착수 전 |
| 워크플로 경로 | Route B (PR 경유), Tier M 기본값 Route A를 `--pr`로 재정의 | plan-audit iter1 D5 |
| **폰트 로딩** | **`next/font/google` + M0 vitest 모킹 안전장치, `@import` 폴백 유지** | **2026-09-05 (§B.5)** |

**DesignSync 가용성은 미해결 질문이 아니다** — Classical 토큰을 이미 확보해 §D.1에 고정했으므로(§B.3), design phase 시점의 도구 접근 여부는 **재검증 수행 여부**만 가르는 조건 분기이며 양쪽 경로 모두 정의되어 있다(REQ-DESIGN-009/010). 어느 쪽이든 이 SPEC은 완전히 진행 가능하다.

**Implementation Kickoff Approval 시점에 사용자에게 물을 미결 사항: 없음.**

---

## §K. 상호 참조

- `spec.md` §1.1 — 선행 결정 반전의 원문 인용
- `acceptance.md` — AC-DESIGN-001~016
- `.claude/agents/moai/manager-design.md` § Tool Availability — DesignSync graceful degradation 원문
- `.moai/specs/SPEC-STOREFRONT-002/design.md` · `SPEC-STOREFRONT-003/design-notes.md` — 폴백 선례 2건
- `.moai/specs/SPEC-AUTH-003/plan.md:204` — PRESERVE 목록 출처
- `.moai/specs/SPEC-AUTH-004/plan.md` §C — PRESERVE 상호작용 처리 선례
