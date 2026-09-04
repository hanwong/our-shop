# Research: SPEC-ADMIN-003 — 관리자 쓰기 API 경로 이전과 미들웨어 통과 검증 계층

이 문서는 plan-phase에서 **실제로 실행하거나 직접 읽어 확인한 것** 만 담는다. 추론은 추론이라고 표시한다.

---

## §1. 결함의 실측 증거 — 라이브 서버 7회 프로브

`SPEC-ADMIN-002` sync-audit이 `npx next dev -p 3987`(Next.js 15.5.24, worktree `t11`, HEAD `e22b4c0`)로 실행한 프로브. 원본: `.claude/worktrees/t11/.moai/state/verify/sync-t11/audit-middleware-probe.log` (이 worktree에는 없다 — `t11` worktree에서 읽었다).

| 프로브 | 요청 | 관측 결과 |
|---|---|---|
| 1 | `PATCH /admin/api/products/p1/active` (content-type, `X-CSRF-Token`, `csrf_token` 쿠키) | `307` → `http://localhost:3987/` |
| 2 | `POST /admin/api/products` (동일 헤더) | `307` → `http://localhost:3987/` |
| 3 | `PATCH /admin/api/orders/o1/status` (`SPEC-ADMIN-001` 선례 라우트) | `307` → `http://localhost:3987/` |
| 4 | `POST /admin/api/products` 응답 헤드 전문 | `HTTP/1.1 307 Temporary Redirect` / `location: /` |
| 5 | `GET /staff/products` (**대조군**, 매처 밖) | `307` → `/staff/login` — 세션 게이트가 정상 동작 |
| 6 | `POST /admin/api/products`, 리다이렉트 추적(브라우저 `fetch` 기본값) | `final_status=200`, `final_url=http://localhost:3987/`, `redirects=1` |
| 7 | `POST /admin/api/products` + `Authorization: Bearer notarealtoken` | `307` → `http://localhost:3987/` |

**프로브 5가 결정적이다**: `/staff/*`의 세션 게이트는 미들웨어가 아니라 페이지 자신의 `resolveAdminSession()` → `redirect("/staff/login")`이며 정상 작동한다. 즉 인증 자체는 멀쩡하고, 깨진 것은 오직 **쓰기 API의 도달 가능성** 이다.

**프로브 6이 "조용함"의 정체다**: 307은 메서드를 유지한 채 따라가지므로 최종 상태가 200이고, 호출부의 `if (response.ok)`가 참이 된다.

**프로브 7은 대안 하나를 배제한다**: 토큰을 얹어도 그 토큰이 유효한 관리자 액세스 토큰이 아니면 여전히 307이다. 따라서 "헤더만 얹으면 된다"는 우회는 성립하지 않는다.

---

## §2. 왜 헤더를 얹을 수 없는가 — 직접 읽어 확인

`src/middleware.ts` `:33~36`:

```ts
const authHeader = request.headers.get("authorization");
const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;
if (!token) {
  return NextResponse.redirect(new URL("/", request.url));
}
```

토큰이 없으면 **핸들러가 실행되기 전에** 리다이렉트한다. 그리고 `/staff/*` 화면은 토큰을 가질 수 없다:

- `src/middleware.ts` `:19~24`의 문서 주석이 `REQ-AUTH-009`를 인용해 액세스 토큰이 "client memory ONLY — never a cookie, never localStorage/sessionStorage"임을 명시한다.
- `src/app/staff/products/page.tsx` `:1~4`, `src/app/staff/orders/page.tsx`, `src/app/staff/orders/[orderId]/page.tsx`는 모두 `cookies()` → `resolveAdminSession(jar)` 경로로 인증한다. 액세스 토큰을 읽는 코드가 없다.
- 두 클라이언트 컴포넌트(`ProductForm.tsx`, `CancelOrderButton.tsx`)의 `fetch` 호출은 `content-type`과 `X-CSRF-Token`만 얹는다(`ProductForm.tsx` `:100~106`·`:137~143`, `CancelOrderButton.tsx` `:46~52`). 얹을 토큰이 없으니 얹지 않는다.

`SPEC-ADMIN-001` design.md §1의 "원한다면 `Authorization` 헤더도 얹을 수 있어 미들웨어의 검사를 통과할 여지가 있다"는 문장은 이 지점에서 반증된다.

## §3. 라우트 핸들러는 미들웨어를 필요로 하지 않는다 — 직접 읽어 확인

네 라우트 모두 **CSRF 먼저, 그 다음 새 세션 판정** 을 스스로 수행한다.

> **경로 표기 안내** — 아래 표의 경로는 **이 SPEC이 라우트를 옮긴 뒤의 최종 경로(`/staff/api/**`)**다. 조사 시점에는 네 파일 모두 `src/app/admin/api/**` 아래에 있었고, 그 위치가 바로 이 SPEC이 제거한 결함의 원인이다. 조사 결론(핸들러가 스스로 CSRF·세션을 검사한다)은 이동 전후로 동일하며, 줄 번호는 이동 후 실측값이다.

| 파일 | CSRF | 세션 재판정 |
|---|---|---|
| `src/app/staff/api/products/route.ts` | `:38` `verifyCsrfRequest(request)` | `:43~44` `cookies()` → `resolveAdminSession(jar)` |
| `src/app/staff/api/products/[productId]/route.ts` | `:32` `verifyCsrfRequest(request)` | `:37~38` `cookies()` → `resolveAdminSession(jar)` |
| `src/app/staff/api/products/[productId]/active/route.ts` | `:36` `verifyCsrfRequest(request)` | `:41~42` `cookies()` → `resolveAdminSession(jar)` |
| `src/app/staff/api/orders/[orderId]/status/route.ts` | `:44` `verifyCsrfRequest(request)` | `:50~51` `cookies()` → `resolveAdminSession(jar)` |

`products/route.ts` `:20~30`의 문서 주석이 이 순서를 "각 단계가 다음을 게이팅하며 재배치 불가"로 명시한다. 두 실패 응답은 상태 코드와 본문이 동일해(reason-blind) 어느 검사가 거부했는지 노출하지 않는다.

**결론**: 미들웨어는 이 네 라우트에 보안을 **추가하지 않으며**, 도달 가능성만 없앤다. 라우트를 매처 밖으로 옮겨도 잃는 방어선이 없다.

---

## §4. 근본 원인 — 미들웨어를 통과하는 테스트가 0건

`grep`으로 확인: `tests/` 전체에서 `src/middleware.ts`를 다루는 파일은 `tests/unit/admin/middleware-preserve.test.ts` 단 하나이며, 그 파일은 `readFileSync`로 **소스 텍스트만** 읽는다(`:44~46`). `middleware()` 함수를 호출하지 않고, `NextRequest`를 만들지 않는다.

옛 경로를 담은 테스트 네 건은 **한 부류가 아니다.** 최초 서술은 넷을 "모두 핸들러를 직접 import 해서 호출한다"로 묶었으나 그것은 사실과 다르며, 그 오분류가 `tests/`를 영향 집합에서 통째로 빠뜨린 기전이었다(plan-audit iteration 1 D3). 실측대로 갈라 적는다:

- **(i) 런타임 테스트 3건** — `tests/unit/api/admin/product-routes.test.ts`, `tests/unit/api/admin/order-status-route.test.ts`, `tests/unit/app/staff-product-form.test.tsx`. 내보낸 핸들러를 `await import`로 직접 불러 호출하거나(앞 둘), 컴포넌트를 렌더링하고 `fetch`를 스텁한다(마지막). 요청이 **라우팅 계층을 지나지 않으므로** 매처가 개입할 여지가 없다 — 이것이 이 SPEC이 닫는 탐지 공백의 절반이다. 이동에 대해서는 import 지정자(`typecheck`가 잡는다)와 URL 문자열 리터럴(**아무것도 잡지 못한다**)만 영향을 받는다.
- **(ii) 소스 트리 구조 가드 1건** — `tests/unit/admin/product-boundaries.test.ts`. 핸들러를 import하지도 호출하지도 **않는다**. `:1`이 `import { readFileSync, readdirSync, statSync } from "node:fs"`이고, 헤더 `:9~11`이 스스로 "assert on properties of the SOURCE TREE rather than on runtime behaviour"라고 선언한다. **이 파일은 이 SPEC의 이동에 직접 파손된다** — `:198` `walk("src/app/admin")`이 `:45`의 `readdirSync`를 타고, `:213`이 `read("src/app/admin/api/products/route.ts")`를 부른다. `src/app/admin`이 사라지는 순간 둘 다 실패가 아니라 **ENOENT 예외** 다. 게다가 `:197`의 단언("모든 관리자 쓰기 API는 `/admin/api` 하위")은 REQ-ADMIN-042의 **의미적 역명제** 다.

넷을 한 부류로 묶는 순간 (ii)가 시야에서 사라진다 — 소스 트리 경로를 리터럴로 고정한 유일한 파일이면서, 이동에 파손되는 유일한 파일이다. 이 관찰이 spec.md §1의 "테스트 파일 봉투" 표와 REQ-ADMIN-054·055의 근거다.

그래서 268개 테스트가 전부 통과하고, 24개 AC가 전부 PASS 증거를 갖고, plan-audit이 집계 1.00으로 PASS한 상태에서도 **화면에서는 아무것도 저장되지 않았다.** 검증 계층이 라우팅을 건너뛰고 있었다는 것이 이 결함이 살아남은 이유다.

이 관찰이 이 SPEC의 REQ-ADMIN-048~051을 정당화한다. 경로만 옮기면 오늘의 네 라우트는 고쳐지지만 **탐지 공백은 그대로 남는다.**

---

## §5. 목적지 후보 검토

### §5.1 `/staff/api/*` — 채택

**Next.js App Router 안전성.** 공식 `route.js` 레퍼런스(`nextjs.org/docs/app/api-reference/file-conventions/route`, 2026-04-30 갱신)가 `app/items/route.ts`, `app/posts/route.ts`, `app/dashboard/[team]/route.ts`, `app/rss.xml/route.ts`를 예시로 든다 — 라우트 핸들러는 `app/api/` 하위로 **제한되지 않는다**. 그리고 `page.js` 레퍼런스의 "Good to know"는 `page`가 "always the **leaf** of the route subtree"이며 "required to make a route segment **publicly accessible**"이라고 명시한다. 즉 `page`와 `route`의 충돌은 **같은 pathname** 에서만 발생한다.

**이 저장소에서의 충돌 여부 — 파일 트리 실측.** `find src/app/staff -type f` 결과 `/staff` 바로 아래 자식은 `login/`, `orders/`, `products/` 세 개의 **정적** 세그먼트뿐이다. 동적 세그먼트는 한 단계 더 깊은 `orders/[orderId]`, `products/[productId]`에만 있다. 따라서:

- `api`는 그 셋과 겹치지 않는 새 정적 형제 세그먼트다.
- `/staff/api/**` 어느 pathname에도 `page.tsx`가 놓이지 않으므로 page/route 충돌 규칙에 걸리지 않는다.
- `/staff` 바로 아래에 동적 세그먼트가 없으므로 `api`가 동적 세그먼트에 흡수될 여지도 없다.

**~~매처 밖임이 기존 통과 테스트로 이미 보장된다~~ — 이 근거는 철회한다(plan-audit iteration 1 D8).** 최초 서술은 `middleware-preserve.test.ts`의 (a) 매처 정확 일치와 (b) `/staff` 문자열 0건 단언(`:62~70`)을 근거로 "`/staff/api/*`를 매처 안으로 끌어들이려면 반드시 통과해야 하는 테스트를 깨야 하며, 이 성질은 다른 후보에는 없다"고 적었다. **뒷문장이 거짓이다.** 같은 파일 `:69~75`의 세 번째 단언(바이트 길이 2485 + SHA-256 스냅샷)은 **어떤 편집이든** 실패시키므로, 매처를 `/api/admin`까지 넓히는 변경도 반드시 이 테스트를 깬다 — 두 후보가 **동일한 강도** 로 보호된다. 그리고 (b)의 단언은 `not.toMatch(/\/staff/)`, 즉 **리터럴 문자열 일치** 이므로 `/staff` 문자열 없이 `/staff/api/*`에 도달하는 매처(부정 전방탐색 캐치올 `["/((?!_next|api).*)"]`, `["/:section(admin|staff)/:path*"]` 등)에는 걸리지 않는다.

따라서 목적지 선택은 위 두 문단(공식 문서가 보장하는 배치 자유 + 이 저장소에서의 충돌 부재)과 아래 선례 정합만으로 선다 — 그 셋으로 충분하다. 이 우회를 실제로 막는 층은 A층 배치 가드(REQ-ADMIN-048)뿐이며, 그 사실이 design.md §3.1의 under-match 방어를 이 SPEC의 무게 중심으로 만든다.

**선례와의 정합.** `SPEC-ADMIN-001` REQ-ADMIN-004가 이미 "매처와 겹치지 않는 별도 경로"를 요구했고 `/staff`가 그 답이었다. 이 SPEC은 새 관례를 만드는 것이 아니라 **그 관례가 원래 덮으려던 표면(백오피스 전체)으로 API를 끌어온다.** `src/app/staff/products/page.tsx` `:28~31`의 주석이 그 의도를 이미 문장으로 남겨 두었다.

### §5.2 `/api/admin/*` — 검토 후 기각

충돌은 없다(`find src/app/api -type f` 실측: `auth/`, `cart/`, `discounts/`, `orders/`, `payments/`, `products/` — `admin` 없음, `/api` 바로 아래 동적 세그먼트 없음). 저장소의 기존 관례(라우트 핸들러 17건이 전부 `src/app/api/**`)와도 맞는다.

기각 이유 두 가지:

1. **관리자 표면이 다시 두 네임스페이스로 쪼개진다** — 화면은 `/staff`, 쓰기는 `/api/admin`. 바로 그 분리가 이번 결함을 만든 구조다. 두 곳을 따로 옮기다 한쪽을 잊는 실패 모드가 그대로 남는다.
2. **`/admin` 매처와의 이름 근접성** — `admin`이라는 토큰이 매처 이름과 같아, 장래에 매처를 `/api/admin`까지 넓히거나 라우트를 되돌리는 혼동을 부른다. (최초 서술은 여기에 §5.1의 "기존 통과 테스트가 구조적으로 막아 준다"는 보장을 대비 근거로 덧붙였으나, 그 보장 자체를 위에서 철회했으므로 함께 내린다 — 이름 근접성은 사람이 헷갈릴 여지에 대한 관찰이지 기계적 보장의 비대칭이 아니다.)

### §5.3 남은 검증 부담 (plan-phase에서 기계적으로 확인하지 않음)

`/staff/api/*`가 실제로 빌드되고 라우팅되는지는 **문서 + 파일 트리 분석** 으로만 확인했다. `next build`의 라우트 매니페스트로 기계 확인하는 것은 run-phase M1의 종료 조건으로 넘긴다(plan.md §F M1). 이 문서는 그것을 아직 실행하지 않았음을 명시한다.

---

## §6. 미검증 항목 (Gaps)

- `next build`를 실행하지 않았다. `/staff/api/**` 라우트가 매니페스트에 등록되는지 기계적으로 확인되지 않았다(§5.3).
- 이동 후의 라이브 프로브를 실행하지 않았다. 프로브 1~7은 **이동 전** 상태의 측정이다.
- ~~`tests/` 네 파일의 출현 위치·개수를 세지 않았다~~ — **iteration 2에서 닫았다.** 네 파일을 직접 읽고 줄 번호까지 실측했다: `product-boundaries.test.ts` 18건(`:27~30`·`:118~119`·`:157~159`·`:171~173`·`:197`·`:198`·`:205~208`·`:212`·`:213`), `order-status-route.test.ts` 11건(문서 주석 `:4` + 요청 URL `:32` + `await import` 지정자 9건), `product-routes.test.ts` 8건(요청 URL `:51`·`:53`·`:55`, 지정자 `:59`·`:60`·`:62`, describe 제목 `:136`·`:158`), `staff-product-form.test.tsx` 4건(제목 `:94`, URL 리터럴 단언 `:107`·`:164`·`:294`). 합계 **41건** — `grep -rn 'admin/api' tests/ | wc -l` 실측과 일치한다. 이 실측이 spec.md §1 "테스트 파일 봉투" 표와 plan.md M3의 근거다.
- 이 저장소가 리다이렉트를 오류로 처리하도록 `fetch`를 감싸는 공용 헬퍼를 이미 갖고 있는지 전수 조사하지 않았다. 두 호출부의 코드만 읽었다.

## §7. 잔여 위험 (Residual risk)

- 배치 가드가 매처 패턴을 정규식으로 옮기는 과정에서 Next.js의 `path-to-regexp` 의미(`:path*`)와 미세하게 어긋날 수 있다. 이번 매처는 단일 접두사 형태라 위험이 낮지만, 장래에 매처가 복잡해지면 가드가 **조용히 느슨해질** 수 있다 — 가드 자신에 "매처를 해석하지 못하면 실패한다"는 분기를 두어 완화한다(design.md §3.1).
- `SPEC-ADMIN-002`가 미병합 상태라는 전제 위에서 그 아티팩트를 같은 PR에서 정정한다. 이 SPEC 착수 전에 `SPEC-ADMIN-002`가 먼저 병합되면 §1 "소비하는 계약" 표의 취급이 `SPEC-ADMIN-001`과 같은 부류(승계 표시)로 바뀌어야 한다 — run-phase 진입 시 `git log origin/main`으로 재확인한다.
- **리다이렉트 실패 처리 방식은 확정되었다** — `response.redirected` 검사 + 전용 문구(plan.md §0 결정 2, design.md §3.3). iteration 1 시점에는 열린 선택지였으나 사용자가 결정했으므로 더 이상 잔여 위험이 아니다. 기각된 대안 `redirect: "manual"`은 응답을 `type: "opaqueredirect"` / `status: 0` / `ok: false`로 만들어 기존 `if (response.ok)` 분기가 코드 변경 없이 실패로 흐르지만, 이어지는 `response.json()`이 빈 본문을 만나 **기존 일반 오류 문구** 로 떨어진다 — 원인을 지운다. 이 결함의 성격이 "화면이 성공이라고 거짓말했다"이므로 고쳐진 화면은 무슨 일이 일어났는지 말해야 하고, 그것이 채택 근거다. 남는 비용은 세 호출부에 분기가 하나씩 늘어나는 것(M4)이다. AC는 이 확정에 맞춰 갱신되었다 — `AC-ADMIN-046a`·`046b`가 전용 문구 상수를, `AC-ADMIN-047`의 둘째 블록이 `response.ok` **앞** 배치와 상수 단일 정의를 판정한다. 따라서 기각된 `redirect: "manual"`은 이제 판정을 통과하지 못한다(plan-audit iteration 2 D2).
- **A층 가드의 under-match 위험 3종은 설계에서 닫았다** — 빈 매처 FAIL 승격, `route.{ts,tsx,js,jsx}` 전체 열거, `:param*`의 0세그먼트 포함(design.md §3.1 ①②③). 위 첫 항목이 말한 "매처가 복잡해지면 조용히 느슨해질 수 있다"는 위험은 이 셋으로 좁혀졌으나 **완전히 사라지지는 않는다** — `path-to-regexp`의 전체 문법(선택 그룹, 커스텀 정규식 세그먼트, 명명 와일드카드)을 가드가 전부 재현하지는 않기 때문이다. 해석하지 못하는 패턴이 오면 통과가 아니라 FAIL 분기 ②로 떨어지는 것이 이 잔여 위험에 대한 설계상의 답이다.
