# Plan: SPEC-ADMIN-003 — 관리자 쓰기 API 경로 이전과 미들웨어 통과 검증 계층

> 이 문서는 **바뀔 가능성이 큰 결정부터** 배치한다. §0의 세 결정이 승인 게이트의 실질이고, §F의 마일스톤은 그 결정이 정해지면 기계적으로 따라온다.

---

## §0. 승인 게이트에 올릴 결정

### 결정 1 — 목적지 경로 접두사: `/staff/api/*`

| | |
|---|---|
| 채택 | `/staff/api/*` |
| 검토 후 기각 | `/api/admin/*` |
| 근거 | research.md §5.1, design.md §1.1~§1.2 |

**두 가지** 가 이 선택을 떠받친다 (iteration 1까지 셋이었고, 셋째는 아래에서 철회한다):

1. `SPEC-ADMIN-001` REQ-ADMIN-004가 이미 "매처와 겹치지 않는 별도 경로"를 요구했고 `/staff`가 그 답이었다. 새 관례를 만드는 것이 아니라 **그 관례가 원래 덮으려던 범위로 API를 끌어온다.**
2. 유일한 소비자(`/staff/products`, `/staff/orders/[orderId]`)와 같은 곳에 놓인다.

근거는 위 둘뿐이며, 그 둘로 충분하다. 셋째 근거로 쓸 뻔한 "기존 테스트가 이 경로를 매처 밖에 묶어 준다"는 **변별 근거가 되지 못한다** — 실측으로 반증했으므로 승인 게이트에 올리지 않는다:

- `middleware-preserve.test.ts` `:69~75`의 바이트 길이 2485 + SHA-256 스냅샷 단언은 **파일에 대한 어떤 편집이든** 실패시킨다. 매처를 `/api/admin`까지 넓히는 변경도 반드시 이 테스트를 깬다. 즉 두 후보는 **동일한 강도** 로 보호된다.
- 같은 파일 `:66`의 `/staff` 단언은 `expect(source).not.toMatch(/\/staff/)` — **리터럴 문자열 일치** 다. `/staff/api/*`에 도달하면서 `/staff` 문자열을 담지 않는 매처를 쓸 수 있다(예: Next.js 문서가 표준 예시로 드는 부정 전방탐색 캐치올 `["/((?!_next|api).*)"]`, 또는 `["/:section(admin|staff)/:path*"]`). 구조적 보장이 아니라 부분적 억지력이다.

**따라서 이 우회를 실제로 막는 유일한 층은 A층 배치 가드(REQ-ADMIN-048)** 이며, design.md §3.1의 under-match 방어(빈 매처 FAIL, 확장자 전체 열거, 0세그먼트 포함)가 그만큼 더 중요해진다.

Next.js 안전성은 공식 문서와 파일 트리 실측으로 확인했고(research.md §5.1), `next build` 라우트 매니페스트를 통한 기계 확인은 M1의 종료 조건이다.

### 결정 2 — 리다이렉트를 실패로 읽는 방식: `response.redirected` 검사 (확정)

| | |
|---|---|
| 채택 | **`response.redirected` 검사 + 전용 오류 문구** |
| 검토 후 기각 | `redirect: "manual"` |
| 확정 시점 | 사용자 결정(plan-audit iteration 1 이후). 이 항목은 더 이상 열린 질문이 아니다 |

세 호출부(`ProductForm.tsx` 2곳, `CancelOrderButton.tsx` 1곳)는 `fetch` 응답을 받은 직후, `response.ok`를 보기 **전에** `response.redirected`를 검사하는 분기를 갖는다. 참이면 즉시 실패로 처리하고 아래 전용 문구를 표시하며, 성공 분기(`router.push` / `router.refresh` / `isActive` 토글)에는 **진입하지 않는다**.

**전용 오류 문구 (세 호출부 공통 상수)**

> `요청이 처리되지 않았습니다. 변경 사항이 저장되지 않았습니다.`

**이 문구를 고른 이유가 곧 이 결정의 이유다.** 이 결함의 피해는 "쓰이지 않았다"가 아니라 **"쓰이지 않았는데 화면이 성공이라고 말했다"** 이다. 화면이 거짓말을 한 것이 결함의 성격이므로, 고쳐진 화면은 **실제로 무슨 일이 일어났는지** 를 말해야 한다 — 요청이 처리되지 않았고 아무것도 저장되지 않았다는 사실 그대로. `redirect: "manual"`은 `ok: false`를 만들어 기존 분기가 자동으로 실패로 흐르지만, 이어지는 `response.json()`이 빈 본문을 만나 **기존 일반 오류 문구** 로 떨어진다 — 원인을 지우고 "저장에 실패했습니다" 부류의 일반 문구로 뭉갠다. 원인을 알려 주지 못하는 것이 기각 사유다.

**부수 효과**: 세 호출부 각각에 분기가 하나씩 늘어난다(총 3곳). M4의 작업 범위에 그 세 분기가 명시되어 있다.

**이 결정은 요구사항·판정 계층에 앵커되어 있다** (plan-audit iteration 2 D2). iteration 2까지 AC는 "관측 가능한 결과"(리다이렉트 응답 → 오류 표시, 성공 분기 진입 없음)로만 쓰여 있었고, 그 결과 **기각된 `redirect: "manual"` 구현이 16개 AC를 전부 통과했다** — `ok:false`/`status:0`이 기존 실패 분기로 흘러 오류는 표시되기 때문이다. 즉 결정의 변별 요소(전용 문구 · `response.ok` 앞 배치)가 어떤 판정에도 걸리지 않았다. 검증 계층이 실제로는 아무것도 검증하지 않아 결함이 살아남은 것이 이 SPEC의 존재 이유이므로, 같은 실패 형태를 SPEC 자신이 되풀이할 수는 없다. 따라서 iteration 3에서 REQ-ADMIN-046(전용 상수 문구)·REQ-ADMIN-047(`response.ok` 앞 배치)에 변별 요소를 올리고, AC-ADMIN-046a·046b가 문구 상수를, AC-ADMIN-047의 두 번째 블록이 소스 순서와 상수 단일 정의를 판정한다.

### 결정 3 — 이웃 SPEC 아티팩트를 건드리는 범위 (소유권 교차)

이 SPEC은 자기 소유가 아닌 두 SPEC의 아티팩트를 건드린다. 대칭이 아니고, 그 비대칭이 결정의 핵심이다(design.md §4).

| 대상 | 상태 | 처리 | 왜 |
|---|---|---|---|
| `SPEC-ADMIN-002` spec.md(3) · plan.md(13) · acceptance.md(1) · design.md(8) | `implemented`, **미병합** | **본문 정정** — REQ-ADMIN-040 / AC-ADMIN-040 포함 | 같은 PR으로 나가므로, 정정하지 않으면 자기가 실려 나가는 트리에 대해 **거짓인 AC** 가 병합된다 |
| `SPEC-ADMIN-001` acceptance.md `:105` | `completed`, 병합됨(#15) | **URL 토큰 한 개만** 교체 | `lifecycle: spec-anchored` — 구현과 함께 유지되는 계약이므로 존재하지 않는 경로를 부르게 둘 수 없다 |
| `SPEC-ADMIN-001` design.md §1 · plan.md `:46` | `completed`, 병합됨 | **원문 보존**, 승계 표시 한 줄만 덧붙임 | 그 논거의 원문이 이 SPEC 근본 원인 분석의 **1차 증거** 다(spec.md §1이 직접 인용). 다시 쓰면 이 SPEC이 서 있는 증거를 지운다 |
| 두 SPEC의 research.md · progress.md (`admin/api` 합계 13건) | — | **무변경** | 계약이 아니라 그 시점의 조사·실행 **기록** 이다. 사후 정정이 정보를 파괴한다(design.md §4.1) |
| `tests/unit/admin/product-boundaries.test.ts` (18) · `tests/unit/api/admin/product-routes.test.ts` (8) · `tests/unit/app/staff-product-form.test.tsx` (4) — 전부 `SPEC-ADMIN-002` 소유 | `implemented`, **미병합** | **본문 정정**(첫 파일은 AC-ADMIN-040 집행 블록 **재작성**) | 문서 계약만 고치고 그 계약을 **집행하는 테스트** 를 두면, 집행자가 계약과 어긋난 채 남는다. 첫 파일은 이동 직후 `walk("src/app/admin")`에서 **ENOENT 예외** 로 터진다 |
| **`tests/unit/api/admin/order-status-route.test.ts` (11) — `SPEC-ADMIN-001` 소유** | **`completed`, 병합됨(#15)** | **본문 정정** — import 지정자 9건 + 주석 1건 + 요청 URL 1건 | **이 표에서 가장 무거운 교차다.** 완료·병합된 SPEC이 소유한 **테스트 파일** 을 후속 SPEC이 고친다. 대안이 없다 — 지정자가 옮겨진 모듈을 가리키지 않으면 `typecheck`가 깨진다 |

`SPEC-ADMIN-001` spec.md는 손대지 않는다 — `admin/api` 출현 **0건**, 경로를 요구하는 REQ 없음(실측).

**테스트 봉투를 이 표에 올린 이유**: iteration 1 plan-audit이 `tests/`가 영향 집합에서 통째로 빠져 있음을 지적했다(D2·D4·D11·D12의 공통 뿌리). 네 파일을 개별 패치로 흩뿌리지 않고 **하나의 봉투** 로 묶어 spec.md §1 두 번째 표 · REQ-ADMIN-054/055 · AC-ADMIN-054/055 · M3에 동일한 경계로 올린다.

**따라서 이 SPEC이 끝나도 `grep -rc 'admin/api' .moai/specs/`는 0이 되지 않는다.** 기록물에 남은 13건이 정상 상태다. 이 사실을 미리 못 박아 두지 않으면 sync-audit이 잔여 출현을 미완료로 오독한다.

**승인이 필요한 이유**: 완료·병합된 SPEC의 아티팩트를 후속 SPEC이 수정하는 것은 이 저장소의 PRESERVE 관례에서 벗어난 행위다. 문서 쪽 범위는 최소로 좁혔지만(한 줄 + 승계 표시 두 줄), **`SPEC-ADMIN-001` 소유 테스트 파일 한 건(`order-status-route.test.ts`, 11건)의 본문 정정은 좁힐 수 없다** — 옮겨진 모듈을 가리키지 않는 import 지정자는 `typecheck`를 깨기 때문이다. 경계를 넘는다는 사실 자체가 사용자 확인 대상이다.

---

## §A. 착수 전 확인

- `git log origin/main`에서 `SPEC-ADMIN-002`가 아직 미병합인지 재확인한다. 이미 병합되었다면 결정 3의 첫 행이 `SPEC-ADMIN-001`과 같은 부류(승계 표시)로 바뀐다.
- `npm test`로 착수 baseline을 잡는다. 알려진 타이밍 flake(`t20`)는 baseline에서도 실패하므로 신규 실패와 구분한다.

## §B. 알려진 문제

- 저장소에 미들웨어를 통과하는 테스트가 0건이다(research.md §4). 이 SPEC이 닫는 대상이다.
- `t20` 타이밍 flake — 이 SPEC의 범위 밖이며, 단독 실행 시 통과한다.

## §C. 제약

- `src/middleware.ts` 바이트 단위 무변경 (REQ-ADMIN-052). `middleware-preserve.test.ts`도 **수정 없이** 계속 통과해야 한다.
- 인증·CSRF 로직 무변경. 파일이 옮겨질 뿐이다.
- 시간 추정 금지 — 우선순위와 순서로만 표현한다.

## §D. PRESERVE 목록 (diff 0줄이어야 하는 파일)

- `src/middleware.ts`
- `tests/unit/admin/middleware-preserve.test.ts`
- `src/lib/auth/csrf.ts`
- `src/features/admin/services/admin-session.ts`
- `src/features/admin/repositories/admin-product-repository.ts`
- `src/features/admin/repositories/admin-order-repository.ts`
- `.moai/specs/SPEC-ADMIN-001/spec.md`

---

## §F. 마일스톤

> 마일스톤 번호는 iteration 2에서 재배치되었다 — `tests/` 봉투 갱신이 **M3** 로 신설되면서 옛 M3~M7이 한 칸씩 밀렸다(M4 C층 / M5 A층 / M6 B층 / M7 이웃 SPEC / M8 최종 게이트).

### M1 — 경로 이전 (우선순위 High)

다섯 파일을 `git mv`로 옮기고, **`src/`와 `tests/` 양쪽의 `@/app/admin/api/**` import 지정자를 전부 갱신한다**(design.md §1). `shared.ts`를 빠뜨리면 `src/app/admin`이 비지 않는다.

**옮긴 파일 자신이 담은 문서 주석의 옛 URL 4건도 여기서 함께 갱신한다** — `products/route.ts:14`, `products/[productId]/route.ts:14`, `products/[productId]/active/route.ts:9`, `orders/[orderId]/status/route.ts:9`(plan-phase 실측, 줄 번호는 드리프트할 수 있으니 편집 전 파일을 다시 읽는다). M2의 "문서 주석 6곳" 열거는 이동 대상 **밖** 파일만 담으므로, 여기서 잡지 않으면 이 4건이 어느 마일스톤 열거에도 없다 — M2 종료 조건(`grep -rn 'admin/api' src/` 0건)과 AC-ADMIN-045가 기계적으로는 붙잡지만, 계획된 작업 없이 종료 조건에서 터지는 것이 iteration 1이 지적한 실패 모드다(plan-audit iteration 2 D7).

`tests/`를 M1에 포함하는 이유는 종료 조건 #1이 그것을 요구하기 때문이다 — `tsconfig.json`의 `include`가 `**/*.ts` / `**/*.tsx`이므로 테스트도 타입 검사 대상이고, `tests/unit/api/admin/order-status-route.test.ts`의 동적 import 지정자 9건과 `tests/unit/api/admin/product-routes.test.ts`의 3건(`:59`·`:60`·`:62`)이 옮겨진 모듈을 가리킨다. 이것들을 함께 갱신하지 않으면 **M1은 자기 종료 조건을 만족할 수 없다.**

**종료 조건 — 기계적 확인 세 가지**
1. `npm run typecheck` 종료 코드 0 (`src/` · `tests/` 양쪽의 import 지정자 갱신 누락 검출)
2. `find src/app/admin -type f | wc -l` → `0`
3. `npx next build` 성공 + 라우트 매니페스트(`.next/`)에 `/staff/api/**` 네 라우트가 등록됨 — research.md §5.3이 남긴 미검증 항목을 여기서 닫는다

### M2 — `src/` 호출부·주석 갱신 + 이동 후 라이브 재프로브 (High)

- 실제 `fetch` 호출부 3곳: `ProductForm.tsx:95`·`:137`, `CancelOrderButton.tsx:46`
- 문서 주석 6곳: `CancelOrderButton.tsx:10`, `staff/products/new/page.tsx:18`, `staff/products/page.tsx:21`, `staff/orders/page.tsx:26`, `features/admin/types/admin.ts:92`·`:179`, `features/admin/services/product-validation.ts:6~7`
  (`CancelOrderButton.tsx`는 `:10`의 주석과 `:46`의 `fetch` **두 곳** 을 담는다 — 앞 그룹에만 적으면 주석 한 건이 어느 열거에도 잡히지 않는다. 줄 번호는 plan-phase 실측값이며 드리프트할 수 있다 — 편집 전 파일을 다시 읽는다)
- **이동 후 라이브 프로브 1회성 재실행**: 프로브 1~3·6·7을 새 경로에 대해 다시 돌려 `307`이 아니라 실제 핸들러 응답(`403` 등)이 오는 것을 확인하고, 증거를 `.moai/state/verify/`에 남긴다. 상시 테스트로 승격하지는 않는다(design.md §3.4).

**종료 조건**: `grep -rn 'admin/api' src/`가 0건. 라이브 프로브 로그가 파일로 남아 있다.

### M3 — `tests/` 봉투 갱신 (High) — **iteration 2 신설**

spec.md §1 "소비하는 계약 — 테스트 파일 봉투" 표의 네 파일을 하나의 단위로 갱신한다(REQ-ADMIN-054·055). M1이 import 지정자를 이미 갱신했으므로 여기서 남는 것은 **문자열 리터럴**이다. 탐지 가능성은 리터럴의 쓰임에 따라 갈린다 — `staff-product-form.test.tsx`의 URL 단언 세 건은 정확 일치 단언이라 `npm test`가 잡지만, 문서 주석과 구조 가드의 경로 상수는 `typecheck`도 `npm test`도 잡지 못한다.

**(a) `tests/unit/admin/product-boundaries.test.ts` — 재작성 (이 마일스톤의 실질)**

이 파일은 `SPEC-ADMIN-002` M6의 구조 가드이며 **이 SPEC이 대체하는 `REQ-ADMIN-040`의 역명제** 를 단언한다. 단순 실패가 아니라 **ENOENT 예외** 로 터진다: `:198` `walk("src/app/admin")` → `:45` `readdirSync`, `:213` `read("src/app/admin/api/products/route.ts")` → `readFileSync`. 둘 다 REQ-ADMIN-044가 요구하는 대로 디렉터리가 사라지는 순간 예외다.

- `:186~219` `[AC-ADMIN-040]` describe 블록을 **새 배치 규약으로 다시 쓴다**: (i) 관리자 상품 화면이 `/staff` 하위라는 단언은 그대로 유지, (ii) `walk("src/app/admin")` → `walk("src/app/staff/api")`로 바꾸고 기대 배열을 새 네 경로로 교체하며 그 아래 `page.tsx`가 0건임을 계속 단언, (iii) `src/app/admin` 디렉터리가 **존재하지 않음** 을 단언하는 항목을 추가(REQ-ADMIN-044의 집행자를 이웃 SPEC 쪽에도 남긴다), (iv) `:213`의 read 경로를 `src/app/staff/api/products/route.ts`로 교체.
- 경로 상수 3곳 갱신: `:27~30`(`SPEC_SOURCE_FILES`), `:157~159`, `:171~173`.
- `:118~119` `WRITE_SURFACES` 필터의 `"src/app/admin/api/products"` → `"src/app/staff/api/products"`.
- 파일 헤더 주석(`:5~18`)에 승계 한 줄을 덧붙인다 — "`AC-ADMIN-040`의 `/admin/api` 절은 `SPEC-ADMIN-003` REQ-ADMIN-042가 대체했다".
- **나머지 블록은 판정력을 보존한다**(REQ-ADMIN-055 후단): `AC-ADMIN-020`(delete 경로 부재) · `028`(업로드·의존성 부재) · `036`(고객 projection) · `037`(관리자 신원 단일 출처) · `039`(reason-blind 응답) · `041`(PRESERVE 목록). 이 여섯은 이 SPEC이 대체하지 않는 살아 있는 가드이며, 경로 문자열 갱신 외에 손대지 않는다. **파일 전체를 폐기하지 않는 이유가 이것이다.**

**(b) 나머지 세 파일 — 문자열 리터럴 정정**

- `tests/unit/app/staff-product-form.test.tsx`: URL 리터럴 단언 3건 — `:107` `"/admin/api/products"` → `"/staff/api/products"`, `:164` `"/admin/api/products/p1"` → `"/staff/api/products/p1"`, `:294` `"/admin/api/products/p1/active"` → `"/staff/api/products/p1/active"`. describe 제목 1건(`:94`)도 함께.
- `tests/unit/api/admin/product-routes.test.ts`: 요청 URL 리터럴 3건(`:51`·`:53`·`:55`), describe 제목 2건(`:136`·`:158`).
- `tests/unit/api/admin/order-status-route.test.ts`: 문서 주석 1건(`:4`), 요청 URL 리터럴 1건(`:32`). **`SPEC-ADMIN-001` 소유 · 병합 완료 파일이므로 결정 3 승인 범위 안에서만 손댄다.**

**종료 조건 두 가지**
1. `grep -rn 'admin/api' src/ tests/` 출력 0건 (AC-ADMIN-054)
2. `npm test` 종료 코드 0 — `t20` 타이밍 flake 외 **신규 실패 0건**. 특히 `product-boundaries.test.ts`가 ENOENT 없이 통과한다 (AC-ADMIN-055)

### M4 — C층: 리다이렉트를 실패로 (High)

결정 2가 확정되었으므로 방식이 정해져 있다 — `response.redirected` 검사 + 전용 문구(plan.md §0 결정 2, design.md §3.3).

- 세 호출부에 분기를 **각각 하나씩** 추가한다: `ProductForm.tsx`의 저장(`:95` 부근)과 판매중단/복구(`:137` 부근), `CancelOrderButton.tsx`(`:46` 부근). `response.ok` 판정 **앞** 에 놓아 성공 분기가 리다이렉트 응답을 보지 못하게 한다.
- 문구는 세 곳이 공유하는 상수 하나로 둔다 — `요청이 처리되지 않았습니다. 변경 사항이 저장되지 않았습니다.` 세 곳에 따로 적으면 갈라진다.
- `tests/unit/app/staff-product-form.test.tsx`에 리다이렉트 응답(`redirected: true`, `ok: true`, `status: 200`)을 모킹한 케이스를 추가한다 — M3의 URL 리터럴 정정과 **같은 파일** 을 건드리므로 M3 뒤에 온다.
- `CancelOrderButton`의 같은 판정을 덮는 케이스도 추가한다(AC-ADMIN-046b).

### M5 — A층: 라우트 배치 인벤토리 가드 (High)

`tests/unit/admin/route-placement-guard.test.ts` 신규. 알고리즘은 design.md §3.1. 매처를 `src/middleware.ts`에서 읽고, `src/app` 하위의 `route.{ts,tsx,js,jsx}`를 재귀 열거하고, 매처 정규식에 걸리는 것이 있으면 실패한다. 허용 목록을 두지 않는다.

**under-match 방어 세 가지를 반드시 구현한다**(iteration 1 plan-audit D5·D6·D7 — 가드가 조용히 느슨해지는 것이 이 SPEC이 닫으려는 바로 그 실패 부류다):
1. 매처 추출 결과가 **빈 배열이면 그 자체로 FAIL**. `middleware-preserve.test.ts`의 `extractMatcher`를 그대로 쓰지 말고 빈 배열을 실패로 승격하는 래퍼를 둔다.
2. 열거 대상은 `route.ts` 하나가 아니라 **네 확장자 전부**.
3. `:param*`는 **0개 이상** 세그먼트이므로 접두사 자신(`/admin`)도 매치 대상이다.

**자기 검증 — 프로브 세 개**(`AC-ADMIN-048`과 동일): `src/app/admin/api/probe/route.ts`(깊은 경로) · `src/app/admin/route.ts`(0세그먼트) · `src/app/admin/api/probe/route.tsx`(비-`.ts` 확장자)를 **하나씩 따로** 임시로 만들어 이 테스트가 **세 경우 모두 실제로 실패하는지** 확인한 뒤 지운다. 실패시키지 못하는 가드는 가드가 아니다.

### M6 — B층: 미들웨어 동작 통과 테스트 (Medium)

`tests/unit/admin/middleware-traversal.test.ts` 신규. `middleware()`를 실제 `NextRequest`로 호출하고, 무헤더·잘못된 Bearer 두 경우 모두 **리다이렉트(3xx)** 가 돌아오며 4xx/5xx가 아님을 단언한다 — 그 성질이 `fetch`의 성공 오인을 만든다(design.md §3.2).

### M7 — 이웃 SPEC 아티팩트 정정 (Medium)

결정 3이 승인된 뒤 착수한다. `SPEC-ADMIN-002` 네 파일 본문 정정(25건), `SPEC-ADMIN-001` acceptance.md `:105` URL 토큰 교체 + design.md §1·plan.md `:46`에 승계 표시.

- **`AC-ADMIN-041` 각주 한 줄**(권고): `SPEC-ADMIN-002/acceptance.md:163`의 귀속 문장에 "이 PR에는 `SPEC-ADMIN-003`의 변경분이 함께 실린다"를 덧붙인다. AC-041 본문에는 `admin/api` 문자열이 없으므로 위 25건 문자열 정정 패스가 **이 AC에 도달하지 않는다** — 각주가 없으면 sync-audit이 PR 단위 diff를 AC-041 위반으로 오독할 여지가 남는다.

### M8 — 최종 게이트 (Low, 기계적)

`npm run lint` / `npm run typecheck` / `npm test` 종료 코드 0. `t20` flake 외 신규 실패 0건. `git diff` 상 §D PRESERVE 목록 전부 0줄.

**이 마일스톤은 작업이 아니라 확인이다.** iteration 1 plan-audit이 지적한 실패 모드 — `tests/`가 어느 마일스톤에도 없어 계획된 작업 없이 최종 게이트에서 터지는 것 — 은 M1(import 지정자)과 M3(문자열 리터럴 + 구조 가드 재작성)이 흡수했다. 여기서 새로 발견되는 테스트 파손이 있다면 그것은 계획의 공백이지 이 마일스톤의 작업이 아니다.

---

## §G. 안티패턴

- **`src/middleware.ts`를 "그냥 한 줄만" 고치기.** `SPEC-ADMIN-001` plan.md `:12`가 이미 기각했고, 이 SPEC의 성공 조건이 그 반대다.
- **A층 가드에 허용 목록을 만들기.** 예외 하나가 이 결함이 다시 들어올 문이 된다.
- **`shared.ts`를 남겨 두기.** `src/app/admin`이 비지 않아 REQ-ADMIN-044가 깨지고, 다음 사람에게 "여기가 관리자 API 자리"라는 신호를 남긴다.
- **라이브 프로브를 상시 테스트로 승격하기.** 사람이 프로브를 추가해야만 새 라우트를 덮으므로, 이번 결함이 살아남은 것과 **같은 실패 모드** 를 물려받는다(design.md §3.4).
- **`SPEC-ADMIN-001`의 설계 논거를 고쳐 쓰기.** 이 SPEC이 인용하는 1차 증거를 지운다.
- **`product-boundaries.test.ts`를 통째로 지우기.** 이 SPEC이 대체하는 것은 그 파일의 일곱 블록 중 `[AC-ADMIN-040]` **하나** 뿐이다. 파일을 폐기하면 이 SPEC이 대체한 적 없는 여섯 가드가 아무 승인 없이 함께 사라진다(design.md §4.2).
- **`tests/` 갱신을 "터지면 그때 고친다"로 미루기.** 문서 주석과 구조 가드의 경로 상수는 `typecheck`도 녹색 `npm test`도 잡아 주지 않는다(URL 정확 일치 단언은 `npm test`가 잡는다 — 미루면 위험한 것은 앞의 둘이다). 계획 없이 최종 게이트에서 터지는 것이 iteration 1이 지적한 실패 모드다.
- **A층 가드에서 빈 매처를 "검사할 것이 없음"으로 읽기.** 그것은 fail-open이고, 이 SPEC이 닫으려는 실패 부류(검증 계층이 조용히 아무것도 검사하지 않음)의 재생산이다(design.md §3.1 ①).
- **`/staff` 문자열 단언을 구조적 보장으로 파는 것.** 리터럴 일치라 캐치올 매처에 우회되며, 승인 게이트에 존재하지 않는 변별력을 근거로 올리는 일이다(§0 결정 1, design.md §1.2).

## §H. 교차 참조

- `spec.md` §1 — 두 개의 빗나간 예측
- `research.md` §1 — 라이브 프로브 7건, §4 — 근본 원인, §5 — 경로 후보 비교, §6 — 미검증 항목
- `design.md` §1.1~§1.2 — 경로 선택의 근거와 **철회된 (c) 근거**, §3.1 — A층 가드의 under-match 방어 ①②③, §3.3 — 결정 2의 확정 형태, §4 — 이웃 SPEC 비대칭, §4.2 — 테스트 봉투
- `.moai/reports/plan-audit/SPEC-ADMIN-003-2026-09-04.md` — iteration 1 감사 보고서(FAIL 0.79, MP-7). 결함별 조치는 `progress.md` §E.1의 이력 표
- `.moai/state/verify/sync-t11/audit-middleware-probe.log` (worktree `t11`)
