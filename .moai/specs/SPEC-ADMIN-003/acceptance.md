# Acceptance: SPEC-ADMIN-003 — 관리자 쓰기 API 경로 이전과 미들웨어 통과 검증 계층

14개 요구사항(REQ-ADMIN-042~055)에 대응하는 **16개** 판정 항목. `AC-ADMIN-046`(두 호출 부류)과 `AC-ADMIN-053`(계약 정정 / 기록물 보존)만 `a`/`b` 하위 ID로 나눈다.

---

## §D. AC 매트릭스

### AC-ADMIN-042 (REQ-ADMIN-042 — 매처 밖 배치)

- **Given** 이전이 끝난 트리에서
- **When** `src/middleware.ts`가 선언한 매처 패턴을 각 관리자 쓰기 라우트의 URL 경로에 대조하면
- **Then** 네 라우트(`POST /staff/api/products`, `PATCH /staff/api/products/[productId]`, `PATCH /staff/api/products/[productId]/active`, `PATCH /staff/api/orders/[orderId]/status`) 어느 것도 매처에 걸리지 않는다.

- **Given** 같은 트리에서
- **When** `npx next build`를 실행하고 생성된 라우트 매니페스트(`.next/`)를 확인하면
- **Then** 빌드가 성공하고 위 네 개의 `/staff/api/**` 라우트가 매니페스트에 등록되어 있다. (매처 밖 배치는 **목적지가 실제로 빌드·라우팅될 때만** 의미가 있다 — 이 절이 REQ-ADMIN-042의 전제를 기계적으로 확인하는 이 SPEC에서 가장 중요한 단일 검증이며, iteration 1까지 AC-ADMIN-045에 잘못 매달려 있었다.)

### AC-ADMIN-043 (REQ-ADMIN-043 — 동작 보존)

- **Given** 이전 전후의 각 라우트 핸들러 파일에 대해
- **When** `git diff -M`으로 이름 변경을 추적한 차분을 확인하면
- **Then** 각 파일의 변경은 `import` 지정자와 문서 주석 안의 URL 문자열뿐이며, 검사 순서(CSRF 선행 → 세션 재판정 → 본문 검증 → 쓰기)를 이루는 문장·상태 코드·응답 본문 모양에는 변경이 0줄이다.

### AC-ADMIN-044 (REQ-ADMIN-044 — 고아 디렉터리 0건)

- **Given** 이전이 끝난 트리에서
- **When** `find src/app/admin -type f | wc -l`을 실행하면
- **Then** 출력이 `0`이고, `src/app/admin` 디렉터리 자체가 존재하지 않는다.

### AC-ADMIN-045 (REQ-ADMIN-045 — `src/` 호출부·주석 전수 갱신)

- **Given** 이전이 끝난 트리에서
- **When** `grep -rn 'admin/api' src/`를 실행하면
- **Then** 출력이 0건이다. (`tests/` 범위는 AC-ADMIN-054가 별도로 판정한다 — REQ-ADMIN-045 본문이 `src/`로 한정되어 있으므로 이 AC의 검증 범위도 `src/`다. 빌드·매니페스트 확인 절은 그것이 실제로 검증하는 요구사항인 REQ-ADMIN-042 쪽으로 옮겼다.)

### AC-ADMIN-046a (REQ-ADMIN-046 — 상품 폼이 리다이렉트를 실패로 읽는다)

- **Given** `/staff/products`의 상품 등록·수정·판매중단/복구 폼에서, 쓰기 요청이 리다이렉트 응답을 받는 상황이 주어진 상태에서
- **When** 사용자가 저장 또는 판매중단/복구를 누르면
- **Then** 화면에 오류가 표시되고, 성공 분기(`router.push("/staff/products")` / `router.refresh()` / `isActive` 토글)가 **한 번도 실행되지 않는다**.
- **그리고** 실패 판정이 `response.redirected` 검사로 이루어지고, 표시된 문구가 세 호출부가 공유하는 전용 상수 `요청이 처리되지 않았습니다. 변경 사항이 저장되지 않았습니다.` 이며, 기존 일반 오류 문구("저장에 실패했습니다" 부류)가 **아니다**. (이 절이 없으면 명시적으로 기각된 `redirect: "manual"` 구현이 이 AC를 그대로 통과한다 — 그 방식은 `ok:false`/`status:0`을 만들어 기존 실패 분기로 흐르므로 오류는 표시되지만 원인을 지운 일반 문구가 표시된다. 문구가 곧 결정의 실질이다 — REQ-ADMIN-046, plan.md §0 결정 2.)

### AC-ADMIN-046b (REQ-ADMIN-046 — 주문 취소 버튼이 리다이렉트를 실패로 읽는다)

- **Given** `/staff/orders/[orderId]`의 취소 버튼에서, 쓰기 요청이 리다이렉트 응답을 받는 상황이 주어진 상태에서
- **When** 사용자가 취소를 누르면
- **Then** 화면에 오류 문구가 표시되고 `router.refresh()`가 호출되지 않는다.
- **그리고** 실패 판정이 `response.redirected` 검사로 이루어지고, 그 문구가 AC-ADMIN-046a와 **같은 전용 상수**(`요청이 처리되지 않았습니다. 변경 사항이 저장되지 않았습니다.`)이며, 기존 일반 오류 문구가 아니다 (REQ-ADMIN-046).

### AC-ADMIN-047 (REQ-ADMIN-047 — 추적 후 상태 코드만으로 판정하지 않는다)

- **Given** 리다이렉트를 따라간 결과가 `200`인 응답이 주어진 상태에서
- **When** 세 호출부 각각이 그 응답을 처리하면
- **Then** 어느 호출부도 성공으로 판정하지 않는다.

- **Given** 세 호출부(`ProductForm.tsx` 2곳, `CancelOrderButton.tsx` 1곳)의 소스에서
- **When** 각 `fetch` 응답 처리 블록의 문장 순서와 오류 문구 상수의 정의 위치를 확인하면
- **Then** 세 곳 **모두** `response.redirected` 검사 분기가 `response.ok` 판정보다 **앞에** 있고, 전용 문구 상수가 세 곳에 중복 정의되지 않고 **한 곳에서 정의되어 공유** 된다. (순서가 이 AC의 실질이다 — 검사 분기가 `response.ok` **뒤** 에 있으면 리다이렉트를 따라간 `200`이 먼저 성공 분기로 흘러 이 SPEC이 닫으려는 결함이 그대로 남는다. REQ-ADMIN-047, design.md §3.3의 코드 형태, plan.md M4.)

### AC-ADMIN-048 (REQ-ADMIN-048 — 배치 가드가 실재하고 실제로 실패시킬 수 있다)

- **Given** `tests/unit/admin/route-placement-guard.test.ts`가 통과하는 상태에서
- **When** 프로브 파일을 **하나씩 따로** 임시로 만들고 매번 그 테스트만 다시 실행하면 — (i) `src/app/admin/api/probe/route.ts`(깊은 경로), (ii) `src/app/admin/route.ts`(**0세그먼트** — `/admin/:path*`의 `*`는 zero-or-more이므로 접두사 자신도 매처에 걸린다), (iii) `src/app/admin/api/probe/route.tsx`(**비-`.ts` 확장자**)
- **Then** **세 경우 모두** 그 테스트가 실패하고, 실패 메시지에 문제의 파일 경로와 그것이 걸린 매처 패턴이 함께 나타난다. (각 파일을 지우면 다시 통과한다.)
- **그리고** 가드 소스에서 열거 대상 파일명 집합을 확인하면 `route.ts` · `route.tsx` · `route.js` · `route.jsx` 넷이 모두 포함되어 있다.

> (ii)와 (iii)이 없으면 자기 검증이 사각지대를 덮지 못한다 — 깊은 `.ts` 프로브 하나는 "최소 한 세그먼트"로 구현한 가드와 "`route.ts`만 세는" 가드를 **둘 다 통과시킨다**. plan-audit iteration 1 D6·D7.

### AC-ADMIN-049 (REQ-ADMIN-049 — 매처를 복제하지 않고 읽는다)

- **Given** `route-placement-guard.test.ts`의 소스에서
- **When** 매처 문자열 `/admin/:path*`가 리터럴로 등장하는지 확인하고, `src/middleware.ts`를 읽어 매처를 추출하는 코드가 있는지 확인하면
- **Then** 매처 리터럴의 복제가 0건이고, 매처는 `src/middleware.ts`에서 추출되며, 매처를 해석하지 못하는 경우 통과가 아니라 실패로 처리하는 분기가 **두 단계 모두에** 존재한다 — (①) **추출 결과 패턴 배열이 비어 있으면 그 자체로 실패** 하는 분기, (②) 추출된 패턴을 정규식으로 옮기지 못하면 실패하는 분기.
- **그리고** 판정은 소스 검사에 그치지 않는다 — **두 픽스처** 를 가드의 매처 추출 경로에 넘겨 행위로 판정한다: (i) `src/middleware.ts`의 사본에서 매처를 대괄호 없는 단일 문자열(`matcher: "/admin/:path*"`) 형태로 바꾼 픽스처는 design.md §3.1 ①의 단일 문자열 해석을 거쳐 **비지 않은 패턴 배열** 로 읽히고 가드가 정상 판정을 계속한다. (ii) 어떤 해석기로도 패턴을 읽어 낼 수 없는 형태(예: `matcher: MATCHER_CONST` 같은 식별자 참조)로 바꾼 픽스처를 넘기면 가드가 **반드시 FAIL 한다** — 조건부가 아니라 무조건이다.
- (ii)가 없으면 ①의 빈 배열 FAIL 분기는 **행위로 한 번도 실행되지 않는다**: 설계대로 구현하면 (i)이 비지 않은 배열을 돌려주므로 남는 판정이 소스 검사뿐이 된다. plan-audit iteration 2 D6.

> ①이 없으면 가드는 fail-open이다 — `middleware-preserve.test.ts:49~50`의 `extractMatcher`는 정규식이 매치되지 않을 때 `return []`으로 조용히 빈 배열을 돌려주고, Next.js는 대괄호 없는 단일 문자열 매처를 정식으로 허용한다. 빈 배열 → 대조할 정규식 0개 → 어떤 라우트도 걸리지 않는 **공허한 PASS**. plan-audit iteration 1 D5.

### AC-ADMIN-050 (REQ-ADMIN-050 — 미들웨어 동작 통과 테스트)

- **Given** `tests/unit/admin/middleware-traversal.test.ts`에서
- **When** `src/middleware.ts`가 내보낸 `middleware()`에 (a) `Authorization` 헤더가 없는 `NextRequest`와 (b) 잘못된 `Bearer` 토큰을 담은 `NextRequest`를 각각 넘겨 실행하면
- **Then** 두 경우 모두 응답 상태가 3xx이고 `location` 헤더가 존재하며, 응답이 4xx도 5xx도 **아니라는 것** 이 명시적으로 단언되어 있다.

### AC-ADMIN-051 (REQ-ADMIN-051 — 장래 라우트까지 덮는다)

- **Given** 두 신규 테스트 파일의 소스에서
- **When** 이 SPEC이 옮긴 네 라우트의 경로 문자열이 검사 대상을 **한정** 하는 용도로 하드코딩되어 있는지 확인하면
- **Then** 하드코딩이 0건이고, 배치 가드의 검사 대상은 `src/app` 하위 파일시스템 열거로 결정되므로 새 `route.ts`가 추가되면 테스트 수정 없이 자동으로 포함된다.

### AC-ADMIN-052 (REQ-ADMIN-052 — PRESERVE)

- **Given** 이 SPEC의 전체 변경분에서
- **When** plan.md §D PRESERVE 목록의 각 파일에 대해 `git diff`를 확인하고, `tests/unit/admin/middleware-preserve.test.ts`를 실행하면
- **Then** 목록의 모든 파일에서 diff가 0줄이고, `middleware-preserve.test.ts`의 세 단언(매처 정확 일치, `/staff` 문자열 0건, 바이트 길이 2485 + SHA-256 `8d82d3c1…`)이 **수정되지 않은 채로** 모두 통과한다.

### AC-ADMIN-053a (REQ-ADMIN-053 — 이웃 SPEC 계약 정정 범위)

- **Given** 이 SPEC의 전체 변경분에서
- **When** `.moai/specs/` 하위에서 **이 SPEC 자신의 디렉터리(`SPEC-ADMIN-003/`)를 제외한** 변경된 파일을 전부 열거하고 각각의 변경 성격을 확인하면 (제외하지 않으면 이 SPEC의 아티팩트 6건이 같은 PR에서 새로 들어오므로 열거 결과가 13건이 되어 이 AC는 문자 그대로는 통과할 수 없다)
- **Then** 변경된 파일이 정확히 다음 일곱 개다 — `SPEC-ADMIN-002`의 spec.md·plan.md·acceptance.md·design.md(본문 정정, `grep -c 'admin/api'`가 **이 네 파일에 한해** 0), `SPEC-ADMIN-001`의 acceptance.md(`:105`의 URL 토큰 한 개만 교체)·design.md·plan.md(각각 승계 표시 한 줄 추가, 기존 논거 문장은 0줄 변경) — 이고, `SPEC-ADMIN-001/spec.md`는 변경되지 않았다.

### AC-ADMIN-053b (REQ-ADMIN-053 — 기록물은 보존된다)

- **Given** 이 SPEC의 전체 변경분에서
- **When** 두 이웃 SPEC의 `research.md`와 `progress.md` 네 파일에 대해 `git diff`를 확인하면
- **Then** 네 파일 모두 diff가 0줄이고, 그 안의 `admin/api` 출현(`SPEC-ADMIN-001` research 1건·progress 7건, `SPEC-ADMIN-002` research 3건·progress 2건 — 실측값)이 **그대로 남아 있다**. 이 파일들은 계약이 아니라 그 시점의 조사·실행 기록이므로 정정 대상이 아니다.


### AC-ADMIN-054 (REQ-ADMIN-054 — 테스트 봉투가 새 경로를 가리킨다)

- **Given** 이전과 테스트 봉투 갱신이 끝난 트리에서
- **When** `grep -rn 'admin/api' src/ tests/`를 실행하고, spec.md §1 "테스트 파일 봉투" 표의 네 파일 각각에 대해 `git diff`를 확인하면
- **Then** grep 출력이 **0건** 이고, 네 파일 모두 변경되어 있다 — `tests/unit/admin/product-boundaries.test.ts`, `tests/unit/api/admin/order-status-route.test.ts`, `tests/unit/api/admin/product-routes.test.ts`, `tests/unit/app/staff-product-form.test.tsx`.
- **그리고** `tests/unit/app/staff-product-form.test.tsx`의 URL 리터럴 단언 세 건이 각각 `"/staff/api/products"`, `"/staff/api/products/p1"`, `"/staff/api/products/p1/active"`를 기대한다 (옛 줄 번호 `:107`·`:164`·`:294` — 문자열 리터럴이므로 `npm run typecheck`도 `npm test` 통과도 이 세 건을 잡아 주지 않는다. 갱신되지 않으면 세 단언이 그대로 실패한다).

### AC-ADMIN-055 (REQ-ADMIN-055 — 구조 가드는 재작성되고, 나머지 판정력은 보존된다)

- **Given** 이전과 테스트 봉투 갱신이 끝난 트리에서
- **When** `npx vitest run tests/unit/admin/product-boundaries.test.ts`를 실행하면
- **Then** 종료 코드가 0이고, `ENOENT` 예외가 **한 건도 발생하지 않는다** (이전 직후 이 파일은 실패가 아니라 `readdirSync`/`readFileSync` 예외로 터진다 — 예외 부재가 재작성 완료의 판정이다).

- **Given** 같은 파일의 소스에서
- **When** `describe` 블록을 전부 열거하고 각각의 단언 대상을 확인하면
- **Then** `[AC-ADMIN-040]` 블록이 새 규약을 단언한다 — (i) 관리자 상품 화면이 `/staff` 하위, (ii) 관리자 쓰기 API가 `/staff/api` 하위이고 그 아래 `page.tsx`가 0건, (iii) `src/app/admin`이 **존재하지 않음** — 이고, 나머지 여섯 블록(`[AC-ADMIN-020]` · `[AC-ADMIN-028]` · `[AC-ADMIN-036]` · `[AC-ADMIN-037]` · `[AC-ADMIN-039]` · `[AC-ADMIN-041]`)이 **전부 그대로 존재하며**, 그 여섯의 변경은 경로 문자열 갱신뿐이다(단언의 개수·대상·강도 불변).

> 여섯 블록이 살아 있어야 하는 이유: 이 SPEC이 대체하는 것은 `AC-ADMIN-040`의 `/admin/api` 절 **하나** 뿐이다. 파일을 통째로 폐기하면 물리 삭제 경로 부재·업로드 파이프라인 부재·고객 projection의 `isActive` 부재·관리자 신원 단일 출처·reason-blind 응답·PRESERVE 목록 여섯 가드가 아무 요구사항의 승인 없이 함께 사라진다(design.md §4.2).

---

## §E. 엣지 케이스

- **동적 세그먼트 이름 충돌**: `[productId]`·`[orderId]` 이름이 그대로이므로 `params` 타입이 변하지 않는다. M1의 `typecheck`가 이를 판정한다.
- **`shared.ts` 누락**: 라우트 셋만 옮기고 공유 모듈을 남기면 `typecheck`가 통과할 수도 있으나(경로가 유효하므로) `AC-ADMIN-044`가 실패한다.
- **매처 해석 실패 / 빈 매처**: 장래에 매처가 정규식형·다중 패턴으로 바뀌면 배치 가드가 해석하지 못할 수 있고, 대괄호 없는 단일 문자열 형태(`matcher: "/admin/:path*"`)로 바뀌면 추출 결과가 **빈 배열** 이 된다. 두 경우 모두 통과가 아니라 실패해야 한다 — `AC-ADMIN-049`가 두 분기의 존재를 요구한다. 빈 배열을 "검사할 것이 없음"으로 읽는 구현이 이 SPEC이 닫으려는 실패 부류의 재생산이다.
- **`src/app/admin` 부재를 이웃 SPEC 테스트가 다시 단언함**: `product-boundaries.test.ts`의 재작성된 `[AC-ADMIN-040]` 블록이 `src/app/admin` 부재를 단언하므로 `AC-ADMIN-044`와 판정이 겹친다. 중복이 아니라 이중 집행이며, 이웃 SPEC 쪽 계약이 새 규약을 스스로 지키게 하는 것이 목적이다.
- **`SPEC-ADMIN-002`가 먼저 병합된 경우**: `AC-ADMIN-053`의 기대 파일 목록이 달라진다. plan.md §A가 착수 전 재확인을 요구한다.

## §F. 품질 게이트 / Definition of Done

- 위 **16개** AC가 모두 통과한다 (`grep -c '^### AC-ADMIN-' acceptance.md` 실측과 일치해야 한다 — 문서 첫 줄의 자기 신고 개수와 이 줄이 어긋나면 어느 AC 하나가 DoD 밖이라는 독법이 생긴다).
- `npm run lint` 종료 코드 0.
- `npm run typecheck` 종료 코드 0.
- `npm test` 종료 코드 0 — 알려진 타이밍 flake(`t20`) 외 **신규 실패 0건**.
- `grep -rn 'admin/api' src/ tests/` 출력 0건 — 테스트 봉투 네 파일까지 포함한 범위다.
- `npx next build` 성공, 라우트 매니페스트에 `/staff/api/**` 네 라우트 등록.
- 이동 후 라이브 프로브 재실행 결과가 `.moai/state/verify/` 아래 파일로 남아 있고, 새 경로에서 `307`이 아닌 실제 핸들러 응답이 관측된다.
- 신규 코드에 `@MX` 태그가 적용되어 있다 — 최소한 배치 가드에 "허용 목록을 만들지 말 것"을 `@MX:WARN`으로, 두 신규 테스트가 닫는 탐지 공백을 `@MX:NOTE`로 남긴다.

## §G. 간접 검증 항목

- **"조용한 실패"가 실제로 소리를 내는가**는 AC-ADMIN-046a/046b가 모킹으로 판정한다. 실제 브라우저에서의 재현은 M2의 라이브 프로브가 대신하되, 그 프로브는 상시 테스트가 아니므로 회귀 방어는 A·B·C 세 층이 맡는다.
- **배치 가드가 실제로 재발을 잡는가**는 AC-ADMIN-048의 임시 파일 주입으로 판정한다. 이 주입 없이 "가드를 추가했다"만으로는 판정하지 않는다.
