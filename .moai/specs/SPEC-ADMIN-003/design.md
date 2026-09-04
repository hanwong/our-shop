# Design: SPEC-ADMIN-003 — 관리자 쓰기 API 경로 이전과 미들웨어 통과 검증 계층

## §1. 목적지 경로와 이동 대상

```
before                                              after
src/app/admin/api/products/route.ts              →  src/app/staff/api/products/route.ts
src/app/admin/api/products/shared.ts             →  src/app/staff/api/products/shared.ts
src/app/admin/api/products/[productId]/route.ts  →  src/app/staff/api/products/[productId]/route.ts
src/app/admin/api/products/[productId]/active/route.ts
                                                 →  src/app/staff/api/products/[productId]/active/route.ts
src/app/admin/api/orders/[orderId]/status/route.ts
                                                 →  src/app/staff/api/orders/[orderId]/status/route.ts
```

이동 후 `src/app/admin/`은 **디렉터리째 사라진다** (REQ-ADMIN-044).

**다섯 번째 파일 `shared.ts`를 잊지 말 것.** 라우트가 아니라 공유 모듈이지만 세 라우트가 `@/app/admin/api/products/shared`로 import 한다(`route.ts:11`, `[productId]/route.ts:11`, `[productId]/active/route.ts:6`). 같이 옮기지 않으면 `src/app/admin`이 비지 않고 REQ-ADMIN-044가 깨진다.

경로 선택 근거는 research.md §5에 있다. 요약하면 세 가지다: (a) `SPEC-ADMIN-001` REQ-ADMIN-004가 세운 `/staff` 관례가 원래 덮으려던 표면이 백오피스 전체다, (b) 유일한 소비자(`/staff/products`, `/staff/orders/[orderId]`)와 같은 곳에 있다, ~~(c) **반드시 통과해야 하는 기존 테스트** 가 `/staff`를 매처 밖에 묶어 둔다.~~ — **(c)는 §1.2에서 철회되었다**(plan-audit iteration 1 D8). 유효한 근거는 (a)와 (b) 둘뿐이며, 아래 §1.1은 철회 전 최초 서술을 원문 그대로 남긴 것이다.

### §1.1 (c)를 풀어서 — 최초 서술 (§1.2에서 철회됨, 원문 보존)

`tests/unit/admin/middleware-preserve.test.ts`는 세 가지를 단언한다:

1. `config.matcher`가 정확히 `["/admin/:path*"]`
2. 소스에 `/staff` 문자열이 **0건**
3. 바이트 길이 2485 + SHA-256 `8d82d3c1…`

이 SPEC은 이 파일을 수정하지 않은 채 계속 통과시켜야 한다(REQ-ADMIN-052). 그 결과 **`/staff/api/*`를 매처 안으로 끌어들이려면 이 테스트를 깨야만 한다.** 경로 선택이 테스트로 잠긴다.

### §1.2 (c)의 정정 — 이 보장은 변별 근거가 아니다 (plan-audit iteration 1, D8)

위 문단은 **과대 주장이었고 실측으로 반증되었다.** 두 갈래다:

1. **3번 단언은 두 후보를 동등하게 보호한다.** 바이트 길이 + SHA-256 스냅샷은 **파일에 대한 어떤 편집이든** 실패시키므로, 매처를 `/api/admin`까지 넓히는 변경도 반드시 이 테스트를 깬다. `/staff/api/*`가 받는 보호와 **정확히 같은 강도** 다. 같은 보호를 받는다면 그것은 두 후보를 가르는 근거가 될 수 없다.
2. **2번 단언은 우회 가능하다.** `expect(source).not.toMatch(/\/staff/)`는 **리터럴 문자열 일치** 이며, `/staff/api/*`에 도달하면서 `/staff`를 담지 않는 매처가 존재한다 — Next.js 문서가 표준 예시로 드는 부정 전방탐색 캐치올 `["/((?!_next|api).*)"]`가 `/staff/api/products`를 매치하면서 `/staff` 문자열을 포함하지 않는다. `["/:section(admin|staff)/:path*"]`도 마찬가지다. 구조적 보장이 아니라 문자열 일치에 기댄 **부분적 억지력** 이다.

**결론**: 목적지 선택은 무효화되지 않는다 — 근거 (a)(`/staff` 관례 계승)와 (b)(유일한 소비자와 동일 위치)는 독립 확인되었고 유효하며, 그 둘로 충분하다. 무효화되는 것은 **(c)를 승인 게이트의 변별 근거로 제시하는 것** 이다. plan.md §0 결정 1에서 (c)를 근거 목록에서 내렸다.

**잔여 위험 — 그리고 그것이 A층으로 넘어가는 지점**: 위 2에서 본 우회(`/staff` 문자열 없이 `/staff/api/*`에 도달하는 매처)를 실제로 막는 층은 `middleware-preserve.test.ts`가 아니라 **A층 배치 가드(§3.1, REQ-ADMIN-048)** 뿐이다. 배치 가드는 매처를 파일에서 읽어 pathname과 대조하므로 매처가 어떤 형태로 쓰이든 따라간다 — **단, 그 가드가 조용히 느슨해지지 않는다는 조건 아래에서만.** §3.1의 세 under-match 방어가 이 절의 결론에 직접 매달려 있다.

---

## §2. 동작 보존 — 무엇이 바뀌고 무엇이 안 바뀌는가

| 항목 | 변경 |
|---|---|
| 파일 경로 | **변경** |
| `@/app/admin/api/products/shared` import 지정자 | **변경** (`@/app/staff/api/products/shared`) |
| 문서 주석 안의 URL | **변경** |
| 핸들러 함수 시그니처 (`POST`/`PATCH`, `context.params`) | 불변 |
| 검사 순서 (CSRF → 세션 → 본문 → 쓰기) | 불변 |
| 상태 코드·응답 본문 모양 | 불변 |
| `resolveAdminSession()` / `verifyCsrfRequest()` 자체 | 불변 |
| 동적 세그먼트 이름 (`[productId]`, `[orderId]`) | 불변 |

동적 세그먼트 이름이 그대로이므로 `RouteContext`/`params` 타입도 그대로다. 이동은 순수한 재배치다.

---

## §3. 검증 계층 — 세 겹, 그리고 라이브 하네스를 쓰지 않는 이유

경로만 옮기면 오늘의 네 라우트는 고쳐지지만 **탐지 공백은 그대로다**(research.md §4). 세 겹으로 닫는다.

### §3.1 A층 — 라우트 배치 인벤토리 가드 (재발을 잡는 층)

`tests/unit/admin/route-placement-guard.test.ts` (신규)

```
1. src/middleware.ts를 읽어 config.matcher 배열을 추출한다.
   (정규식 추출, eval 없음 — middleware-preserve.test.ts의 extractMatcher와 같은 계열)
   [FAIL 분기 ①] 추출 결과 패턴 배열이 비어 있으면 그 자체로 FAIL 한다.
2. 각 매처 패턴을 정규식으로 옮긴다.
   `:param*` → 0개 이상의 나머지 세그먼트, `:param` → 정확히 한 세그먼트.
   [FAIL 분기 ②] 패턴을 해석하지 못하면 통과가 아니라 FAIL 한다.
3. src/app 하위의 route.ts · route.tsx · route.js · route.jsx를 전부 열거한다
   (Next.js가 라우트 핸들러로 인식하는 파일명 집합 전체. 디렉터리 재귀 — glob 라이브러리 불필요)
4. 각 파일 경로를 URL pathname으로 환산한다:
   src/app/staff/api/products/[productId]/route.ts → /staff/api/products/[productId]
   (그룹 세그먼트 `(...)`는 제거, `[...slug]`/`[id]`는 임의 세그먼트로 취급)
5. 어떤 pathname도 어떤 매처 정규식에도 걸리지 않아야 한다.
   걸리면 파일 경로와 매처 패턴을 함께 보여 주며 실패한다.
```

**세 곳의 under-match 방어 — 각각이 닫는 구멍** (plan-audit iteration 1 D5·D6·D7). 이 세 가지는 장식이 아니다. 가드가 **조용히 아무것도 검사하지 않는 상태** 는 이 SPEC이 닫으려는 실패 부류 그 자체이며, 아래 셋은 그 상태로 가는 실제 경로다.

**① 빈 매처는 "검사할 것이 없음"이 아니라 "매처를 읽지 못함"이다 (1단계).** `middleware-preserve.test.ts:49~50`의 `extractMatcher`는 정규식 `/matcher:\s*\[([^\]]*)\]/`가 매치되지 않으면 **`return []`으로 조용히 빈 배열을 돌려준다.** 그런데 Next.js는 대괄호 없는 단일 문자열 매처 `export const config = { matcher: "/admin/:path*" }`를 정식으로 허용한다. 장래에 매처가 그 형태로 바뀌면 추출 결과가 `[]` → 대조할 정규식 0개 → **어떤 라우트도 걸리지 않아 가드가 공허하게 PASS** 한다. 따라서 `extractMatcher`를 그대로 재사용하지 않는다 — 빈 배열을 실패로 승격하는 래퍼를 두고, 배열형·단일 문자열형 **둘 다** 를 해석하되 어느 쪽으로도 읽히지 않으면 FAIL 한다. AC-ADMIN-049가 이 분기의 존재를 판정한다.

**② 라우트 핸들러 파일명은 넷이다 (3단계).** Next.js App Router는 `route.js` · `route.jsx` · `route.ts` · `route.tsx`를 모두 라우트 핸들러로 인식한다. 현재 저장소는 20개 전부 `.ts`이지만(`find src/app -name 'route.*'` 실측: 20건, 비-`.ts` 0건), 이 층의 값어치는 아래 §3.1 말미가 말하듯 "장래에 누가 이 SPEC을 몰라도 자동으로 실패한다"에 있다 — 그 '장래의 누구'가 `.tsx`로 쓰면 `route.ts`만 세는 가드는 조용히 통과한다. REQ-ADMIN-048 본문도 같은 집합을 명시한다.

**③ `:param*`는 zero-or-more이므로 접두사 자신도 매치 대상이다 (2단계).** Next.js가 쓰는 `path-to-regexp`에서 `*`는 **0개 이상** 이므로 `/admin/:path*`는 `/admin/a/b`뿐 아니라 **`/admin` 자기 자신도 매치한다.** "나머지 경로 전체"를 "최소 한 세그먼트"로 읽는 구현은 `src/app/admin/route.ts`(pathname `/admin`)를 통과시킨다 — 실제로는 미들웨어가 가로채는데도. 자기 검증 프로브를 깊은 경로 하나만 두면 이 사각지대가 **자기 검증으로도 드러나지 않으므로**, AC-ADMIN-048은 프로브를 세 개(깊은 경로 `src/app/admin/api/probe/route.ts` + 0세그먼트 `src/app/admin/route.ts` + 비-`.ts` 확장자 `src/app/admin/api/probe/route.tsx`)로 요구한다 — 뒤의 둘이 각각 ③과 ②의 구멍을 덮는다.

**이 층의 값어치는 "아무도 기억하지 않아도 된다"에 있다.** 장래에 누가 `src/app/admin/api/foo/route.ts`를 만들면, 그 사람이 이 SPEC을 몰라도, 테스트를 새로 쓰지 않아도 **자동으로** 실패한다(REQ-ADMIN-049·051). 매처를 파일에서 읽으므로 매처가 바뀌어도 따라간다.

허용 목록은 두지 않는다. 지금 이 저장소에서 매처에 걸려도 되는 라우트 핸들러는 하나도 없고, 미리 만들어 둔 예외는 정확히 이 결함이 다시 들어올 문이다.

### §3.2 B층 — 미들웨어 동작 통과 테스트 (왜 조용했는지를 고정하는 층)

`tests/unit/admin/middleware-traversal.test.ts` (신규)

`src/middleware.ts`가 내보낸 `middleware()`를 실제 `NextRequest`로 호출한다 — 저장소 최초로 미들웨어 **로직** 을 실행하는 테스트다.

고정할 성질 세 가지:

1. `Authorization` 헤더 없는 요청 → 리다이렉트 응답 (`status` 3xx, `location` 헤더 존재)
2. `Bearer <유효하지 않은 토큰>` → 동일하게 리다이렉트 (프로브 7의 재현)
3. **핵심** — 반환된 응답이 오류가 아니라 **리다이렉트** 라는 것. 이 성질이 `fetch`의 기본 추적과 만나 `response.ok === true`를 만든다. 테스트는 이 인과를 주석이 아니라 단언으로 남긴다: 응답 상태가 3xx이고 4xx/5xx가 **아님** 을 단언한다.

3번이 이 층의 존재 이유다. A층은 "라우트가 잘못 놓였다"를 잡지만, **왜 잘못 놓인 것이 조용했는지** 는 설명하지 않는다. 장래에 누가 A층 가드를 보고 "왜 이런 게 필요하지"라고 물을 때 답이 되는 것이 B층이다.

### §3.3 C층 — 호출부의 리다이렉트 실패 처리 (예상 못한 개입까지 덮는 층)

세 호출부(`ProductForm.tsx` 2곳, `CancelOrderButton.tsx` 1곳)가 리다이렉트 응답을 **성공으로 읽지 않도록** 한다(REQ-ADMIN-046·047).

A층과 B층은 **미들웨어라는 알려진 개입자** 를 겨냥한다. C층은 개입자가 무엇이든 상관없다 — 프록시, 새 미들웨어, `next.config`의 rewrite, 배포 환경의 리버스 프록시. 무엇이 끼어들든 리다이렉트로 나타나면 화면이 **실패를 표시** 한다. 이 결함의 진짜 피해는 "쓰이지 않았다"가 아니라 "쓰이지 않았는데 성공이라고 했다"이므로, 그 피해를 직접 겨냥하는 층이다.

**구현 방식 — 확정: `response.redirected` 검사 + 전용 문구.** 두 후보 중 `redirect: "manual"`은 기각했다(plan.md §0 결정 2, 사용자 결정).

```
세 호출부 공통 형태 (ProductForm.tsx 2곳, CancelOrderButton.tsx 1곳)

  const response = await fetch(<새 경로>, { ... });

  if (response.redirected) {          // ← response.ok 판정보다 먼저 온다
    setError(REQUEST_NOT_DELIVERED);  // 세 곳이 공유하는 상수 하나
    return;                           // 성공 분기에 진입하지 않는다
  }

  if (response.ok) { ... }            // 기존 분기 — 손대지 않는다

  REQUEST_NOT_DELIVERED = "요청이 처리되지 않았습니다. 변경 사항이 저장되지 않았습니다."
```

**문구가 이 결정의 실질이다.** 이 결함의 성격은 "쓰이지 않았다"가 아니라 **"쓰이지 않았는데 화면이 성공이라고 말했다"** — 화면이 거짓말을 한 것이다. 그러므로 고쳐진 화면은 실제로 일어난 일을 말해야 한다: 요청이 처리되지 않았고, 아무것도 저장되지 않았다. `redirect: "manual"`은 `ok: false`를 만들어 기존 분기가 **코드 변경 없이도** 실패로 흐르는 대신, 이어지는 `response.json()`이 빈 본문을 만나 **기존 일반 오류 문구** 로 떨어진다 — 원인을 지우고 뭉갠다. 분기 세 개를 추가하는 비용을 치르고 원인을 말할 수 있는 쪽을 택했다.

**판정 계층이 두 방식을 가른다** (plan-audit iteration 2 D2에서 정정). iteration 2까지 AC는 "관측 가능한 결과"(리다이렉트 응답 → 화면에 오류 표시, 성공 분기 진입 없음)로만 쓰여 있어 **두 방식 어느 쪽이든 동일하게 통과했다** — 기각된 `redirect: "manual"`이 16개 AC를 전부 만족한다는 뜻이고, 그렇다면 판정 계층은 이 결정의 이탈을 탐지할 수 없다. 결정의 실질은 문구이므로(위 문단), 판정도 문구에 걸려야 한다. iteration 3에서 REQ-ADMIN-046은 전용 상수 문구를, REQ-ADMIN-047은 `response.ok` **앞** 배치를 요구하고, AC-ADMIN-046a·046b가 문구 상수를, AC-ADMIN-047의 두 번째 Given-When-Then 블록이 세 호출부의 소스 순서와 상수 단일 정의를 판정한다. 위 코드 블록이 그 판정의 기준 형태다.

### §3.4 왜 라이브 서버 통합 하네스를 도입하지 않는가

`next dev`를 띄워 HTTP로 프로브하는 테스트가 네 번째 후보였다. 기각한다.

| 축 | 라이브 하네스 | A + B + C |
|---|---|---|
| 잡는 범위 | 라우팅 + 미들웨어 + 핸들러를 한 번에 | A가 배치, B가 미들웨어 동작, C가 개입 전반 |
| 새 라우트 자동 포함 | 아니오 — 프로브를 사람이 추가해야 한다 | **예 — A층이 파일시스템을 열거한다** |
| 비용 | 포트, 빌드, DB, 프로세스 정리 | 순수 in-process, 기존 vitest 설정 그대로 |
| 실패 모드 | 포트 충돌·타임아웃으로 인한 flake (이 저장소는 이미 타이밍 flake 카드 `t20`을 안고 있다) | 없음 |
| 배경 프로세스 | 필요 — 정리 실패 시 유령 프로세스가 남는다 | 없음 |

결정적인 것은 두 번째 줄이다. 라이브 하네스는 **사람이 프로브를 추가해야만** 새 라우트를 덮는다 — 그런데 이번 결함이 살아남은 이유가 정확히 "아무도 그 검사를 추가하지 않았다"이다. 같은 실패 모드를 그대로 물려받는 검증 계층은 이 결함을 두 번째로도 놓친다.

싼 인벤토리 가드 하나와 진짜 통과 테스트 하나가, 무거운 하네스 하나보다 **이 실패 부류에 대해** 더 넓게 덮으면서 flake를 만들지 않는다.

이 판단은 라이브 프로브 자체를 부정하지 않는다 — §1의 실측 증거가 라이브 프로브로 얻어졌다. 부정하는 것은 그것을 **상시 테스트 스위트로 승격** 하는 것이다. run-phase는 이동 후 라이브 프로브를 **1회성 검증** 으로 다시 실행해 증거로 남긴다(plan.md §F M2).

---

## §4. 두 이웃 SPEC 아티팩트의 취급 — 왜 대칭이 아닌가

| | `SPEC-ADMIN-002` | `SPEC-ADMIN-001` |
|---|---|---|
| status | `implemented` | `completed` |
| main 병합 | **미병합** (이 worktree에 병합되어 함께 나갈 예정) | 병합됨 (`e241acc`, PR #15) |
| spec.md의 `admin/api` 출현 | 3 | **0** |
| 경로를 요구하는 REQ | **REQ-ADMIN-040 있음** | 없음 (REQ-ADMIN-004는 "매처와 안 겹치는 경로"만 요구) |
| 처리 | **본문 정정** | **원문 보존 + 승계 표시** |

**`SPEC-ADMIN-002`를 정정하는 이유**: `AC-ADMIN-040`이 "모든 관리자 쓰기 API가 `/admin/api` 하위에 있다"를 단언한다. 이 SPEC과 같은 PR에서 함께 나가므로, 정정하지 않으면 **자기가 실려 나가는 트리에 대해 거짓인 AC** 가 병합된다. 미병합 진행 중 SPEC은 역사 기록이 아니라 살아 있는 계약이다.

**`SPEC-ADMIN-001`을 정정하지 않는 이유**: 이미 병합된 완료 SPEC이고, spec.md에 경로를 요구하는 REQ가 **하나도 없다**(실측: `grep -c 'admin/api' spec.md` = 0). `/admin/api` 선택은 plan.md·design.md의 **설계 논거** 로만 존재하며, 그 논거의 원문이 이 SPEC 근본 원인 분석의 1차 증거다(spec.md §1이 직접 인용한다). 다시 쓰면 이 SPEC이 서 있는 증거를 지운다.

예외 한 곳: `acceptance.md:105`의 `When` 절이 URL을 직접 부른다. `lifecycle: spec-anchored`이므로 그 한 줄의 **URL 토큰만** 새 경로로 바꾸고, 논거는 건드리지 않는다. design.md §1과 plan.md `:46`에는 승계 표시 한 줄씩만 덧붙인다.

### §4.1 계약과 기록을 가르는 선

위 표는 파일 이름으로 대상을 열거하지 않고 **문서의 성격** 으로 가른다. 두 SPEC의 `research.md`와 `progress.md`도 `admin/api`를 담고 있지만(실측: `SPEC-ADMIN-001` research 1 · progress 7, `SPEC-ADMIN-002` research 3 · progress 2) **정정 대상이 아니다.**

| 성격 | 파일 | 처리 |
|---|---|---|
| **계약** — 앞으로 지켜져야 할 약속 | spec.md, plan.md, acceptance.md, design.md | 트리와 어긋나면 정정 |
| **기록** — 그 시점에 무엇을 조사·실행했는지 | research.md, progress.md | 그대로 둔다 |

`research.md`를 고치면 "그때 이렇게 조사했다"가 거짓이 되고, `progress.md`를 고치면 실행 이력이 거짓이 된다. 둘 다 사후 정정이 **정보를 파괴하는** 종류의 문서다. 반대로 acceptance.md의 `When` 절은 앞으로 실행될 판정이므로, 존재하지 않는 경로를 부르게 두면 그 판정이 무의미해진다.

이 구분 때문에 `grep -rc 'admin/api' .moai/specs/`는 이 SPEC이 끝난 뒤에도 **0이 되지 않는다** — 기록물에 남은 13건이 그대로다. 그것이 정상 상태이며, AC-ADMIN-053a가 0을 요구하는 범위를 계약 네 파일로 한정하고 AC-ADMIN-053b가 기록물의 무변경을 별도로 단언하는 이유다.


### §4.2 테스트 봉투 — 계약을 집행하는 파일은 계약과 함께 움직인다

§4·§4.1이 **문서** 계약을 다뤘다면, 같은 계약을 코드로 집행하는 파일이 `tests/`에 넷 있다(spec.md §1 두 번째 표, `admin/api` 실측 합계 41건). iteration 1 plan-audit의 지적은 이 넷이 영향 집합에서 통째로 빠졌다는 것이었고, 그 누락이 **하나의 뿌리에서 네 개의 결함(D2·D4·D11·D12)** 으로 갈라졌다. 그래서 개별 패치가 아니라 봉투 하나로 다룬다.

| 파일 | 옛 경로가 담긴 형태 | 무엇이 그것을 잡는가 |
|---|---|---|
| `product-boundaries.test.ts` | 구조 단언 — `walk()`/`read()`의 경로 인자, 하드코딩 기대 배열 | **아무것도 잡지 못한다.** 이동 직후 `readdirSync`/`readFileSync`가 **ENOENT 예외** 를 던진다 |
| `order-status-route.test.ts` · `product-routes.test.ts` | `await import("@/app/admin/api/…")` 지정자 12건 | `npm run typecheck` (M1 종료 조건 #1) |
| 위 두 파일 + `staff-product-form.test.tsx` | 요청 URL 리터럴 · 문서 주석 · describe 제목 | **아무것도 잡지 못한다.** 문자열 리터럴이며, 핸들러를 직접 호출하는 테스트에서 URL은 라우팅에 쓰이지 않으므로 `npm test`도 녹색으로 통과한다 |

**두 부류를 가르는 축은 "기계가 잡는가"** 다. `typecheck`가 잡는 12건은 M1이 흡수한다 — 잡히지 않으면 M1이 자기 종료 조건을 만족하지 못하므로 선택의 여지가 없다. 나머지는 어떤 게이트도 잡지 못하므로 **명시적 작업으로 올려야만** 갱신된다. 그것이 M3이다.

**`product-boundaries.test.ts`를 폐기하지 않고 재작성하는 이유.** 이 파일의 헤더는 자신을 `AC-ADMIN-020/028/036/037/040`의 가드라고 밝히고, 본문은 `039`·`041`까지 일곱 개 describe 블록을 담는다. 이 SPEC이 대체하는 것은 그중 **하나**(`AC-ADMIN-040`의 `/admin/api` 절)뿐이다. 파일을 통째로 폐기하면 이 SPEC이 대체한 적 없는 여섯 개 가드 — 물리 삭제 경로 부재, 업로드 파이프라인·신규 의존성 부재, 고객 projection의 `isActive` 부재, 관리자 신원 단일 출처, reason-blind 응답, PRESERVE 목록 — 가 **아무 요구사항의 승인도 없이 함께 사라진다.** 대체된 한 블록만 새 규약으로 다시 쓰고 나머지는 경로 문자열 갱신에 그친다(REQ-ADMIN-055).

`SPEC-ADMIN-002`의 `AC-ADMIN-040`은 M7에서 문서 쪽이 정정되고, 이 파일이 그 정정된 계약의 집행자로 남는다 — 문서와 집행자가 같은 PR에서 같은 방향으로 움직인다.

---

## §5. `src/app/admin` 하위 파일 0건을 왜 요구사항으로 두는가

빈 껍데기가 남으면 다음 사람이 "여기가 관리자 API 자리구나" 하고 새 라우트를 그 안에 넣는다 — 매처 안으로 되돌아가는 가장 자연스러운 경로다. A층 가드가 그 실수를 잡아 주지만, **애초에 유혹을 남기지 않는 편이 싸다.** REQ-ADMIN-044는 A층의 중복이 아니라 A층이 발동할 상황 자체를 줄이는 조치다.
