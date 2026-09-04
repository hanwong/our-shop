# Progress: SPEC-ADMIN-003 — 관리자 쓰기 API 경로 이전과 미들웨어 통과 검증 계층

## §E.1 Plan-phase Audit-Ready Signal

```yaml
spec_id: SPEC-ADMIN-003
tier: L
card: t28
plan_complete_at: 2026-09-04
plan_status: audit-ready   # iteration 3 감사 완료(0.925) + N1·N2 정정 반영. retry loop 상한 도달
artifacts:
  - .moai/specs/SPEC-ADMIN-003/spec.md
  - .moai/specs/SPEC-ADMIN-003/plan.md
  - .moai/specs/SPEC-ADMIN-003/acceptance.md
  - .moai/specs/SPEC-ADMIN-003/design.md
  - .moai/specs/SPEC-ADMIN-003/research.md
requirements: 14   # REQ-ADMIN-042 ~ 055 (Tier L 상한 25 이내)
acceptance_criteria: 16   # AC-ADMIN-042 ~ 055, 046과 053이 a/b 하위 ID로 분할 → 항목 16개
needs_clarification: 0   # iteration 1의 1건은 사용자 결정으로 해소됨 (plan.md §0 결정 2)
```

**Tier 판정 근거 (L)**: 영향 파일이 소스·테스트만 18건(이전 5 + 호출부 2 + 문서 주석 5 + **기존 테스트 4 — iteration 2에서 명시적 봉투로 승격, `admin/api` 실측 41건** + 신규 테스트 2)으로 Tier M 상한 15건을 넘고, SPEC 아티팩트 7건을 더하면 25건이다. 여기에 **완료·병합된 SPEC(`SPEC-ADMIN-001`)과 미병합 진행 중 SPEC(`SPEC-ADMIN-002`) 양쪽의 아티팩트를 건드리는 소유권 교차** 가 더해진다 — 이웃 두 SPEC이 모두 Tier L이고 이 SPEC이 그중 하나의 요구사항(REQ-ADMIN-040)을 대체한다. LOC 자체는 1000줄에 미치지 않으나 파일 수와 교차 범위가 L을 가리킨다.

**plan-phase 요약**: 백로그 카드 `t28`을 다룬다. `src/middleware.ts`의 매처 `/admin/:path*`가 관리자 쓰기 API 4개를 핸들러 실행 **전에** 307로 가로채고, 브라우저 `fetch`가 그 307을 따라가 200을 받으므로 폼이 성공을 보고한다. 라이브 서버 7회 프로브로 실측된 결함이다(research.md §1).

두 겹으로 닫는다. (1) 네 라우트 + 공유 모듈을 매처 밖 `/staff/api`로 옮긴다 — 이 목적지를 떠받치는 근거는 **두 가지뿐** 이다: `SPEC-ADMIN-001` REQ-ADMIN-004가 세운 `/staff` 관례가 원래 덮으려던 범위로 API를 끌어오는 것이고(Next.js App Router는 `/api` 밖의 라우트 핸들러를 정식으로 허용하므로 배치 자체에 제약이 없다 — research.md §5.1, `next build` 매니페스트 확인이 M1 종료 조건 #3), 유일한 소비자(`/staff/products`, `/staff/orders/[orderId]`)와 같은 곳에 놓이면서 `/staff` 하위 기존 페이지 경로와 충돌하지 않는다. **셋째 근거로 쓰였던 주장 — 기존 통과 테스트(`middleware-preserve.test.ts`의 `/staff` 문자열 단언)가 이 목적지의 매처 밖 위치를 보장해 준다는 것 — 은 plan-audit iteration 1 D8에서 철회되었다** — 바이트 길이 + SHA-256 스냅샷 단언은 그 파일에 대한 **어떤 편집이든** 깨므로 두 후보를 동일한 강도로 보호하고, `/staff` 단언은 리터럴 문자열 일치라 `/staff` 문자열을 담지 않은 채 `/staff/api/*`에 도달하는 캐치올 매처(`["/((?!_next|api).*)"]` 등)에 우회된다. 따라서 **이 경로를 매처 밖에 붙들어 두는 구조적 잠금은 존재하지 않고, 그 우회를 실제로 막는 층은 A층 배치 가드(REQ-ADMIN-048) 하나뿐이다** — 승인 게이트에는 위 두 근거만 올린다(plan.md §0 결정 1 · design.md §1.2 · plan.md §G 안티패턴 목록의 마지막 항목). (2) 저장소에 미들웨어를 통과하는 테스트가 **0건** 이었다는 근본 원인(research.md §4)을 A층(라우트 배치 인벤토리 가드) · B층(미들웨어 동작 통과 테스트) · C층(호출부의 리다이렉트 실패 처리) 세 겹으로 닫는다. 라이브 서버 상시 하네스는 "사람이 프로브를 추가해야만 새 라우트를 덮는다"는 이유로 기각했다 — 이번 결함이 살아남은 것과 같은 실패 모드다(design.md §3.4).

**Implementation Kickoff Approval에 올릴 항목 3건** (plan.md §0):

1. **결정 1 — 목적지 경로 `/staff/api/*`**: 근거 **두 가지**(`/staff` 관례 계승 · 유일한 소비자와 동일 위치)와 대안 비교(`/api/admin/*` 기각)가 확보된 결정이며, 확인 대상이다. 승인 시 함께 확인할 것 — 이 목적지에는 **구조적 잠금이 없다**(셋째 근거는 iteration 1 D8에서 철회). 매처가 캐치올로 넓어져 `/staff/api/*`를 다시 삼키는 것을 막는 층은 A층 배치 가드(REQ-ADMIN-048) 하나뿐이므로, 결정 1의 승인은 A층 가드가 조용히 느슨해지지 않는다는 조건과 묶여 있다(design.md §3.1 ①②③).
2. **결정 2 — 리다이렉트 실패 처리 방식**: **확정됨**(`response.redirected` 검사 + 전용 문구). 더 이상 열린 질문이 아니며, 게이트에서는 확정 내용의 확인 대상이다.
3. **결정 3 — 이웃 SPEC 아티팩트 소유권 교차**: 완료·병합된 `SPEC-ADMIN-001`의 아티팩트를 후속 SPEC이 수정하는 것은 이 저장소의 PRESERVE 관례를 벗어난다. 문서 쪽은 최소(URL 토큰 1개 + 승계 표시 2줄)로 좁혔으나, iteration 2에서 **`SPEC-ADMIN-001` 소유 테스트 파일 1건**(`tests/unit/api/admin/order-status-route.test.ts`, `admin/api` 11건)의 본문 정정이 추가되었다 — 옮겨진 모듈을 가리키지 않는 import 지정자는 `typecheck`를 깨므로 좁힐 수 없다. 경계를 넘는다는 사실 자체가 승인 대상이다.

**plan-phase 중 자기 정정 1건**: 최초 열거는 두 이웃 SPEC의 계약 문서(spec/plan/acceptance/design)만 세고 `research.md`·`progress.md`를 빠뜨렸다. 재측정 결과 그 네 파일에도 `admin/api`가 13건 있었다(`SPEC-ADMIN-001` research 1·progress 7, `SPEC-ADMIN-002` research 3·progress 2). **계약은 정정하고 기록은 보존한다** 는 규칙으로 정리해 REQ-ADMIN-053 본문·design.md §4.1·plan.md §0 결정 3에 명시하고, AC-ADMIN-053을 a(계약 정정, `grep`가 0인 범위를 계약 네 파일로 한정)와 b(기록물 diff 0줄)로 분할했다. 이 정정이 없었다면 sync-audit이 기록물의 잔여 출현 13건을 미완료로 오독했을 것이다.

**명확화 항목 — 0건 (해소 완료)**: iteration 1 시점의 미해결 1건(리다이렉트 실패 처리 방식)은 사용자 결정으로 닫혔다 — `response.redirected` 검사 + 전용 문구 `요청이 처리되지 않았습니다. 변경 사항이 저장되지 않았습니다.`. 결정 근거는 이 결함의 성격이 "화면이 성공이라고 거짓말했다"는 것이므로 고쳐진 화면은 실제로 일어난 일을 말해야 한다는 것이다. 확정 내용은 plan.md §0 결정 2 · design.md §3.3 · research.md §7에 기록했고, 두 파일에 있던 마커 리터럴은 **제거** 했다(`plan.md:29`, `research.md:118` — 게이트가 단순 부분문자열 grep이므로 해소 서술 안에 리터럴을 다시 인용하지 않았다). 네 아티팩트 전체에 마커 0건임을 grep으로 재확인했다.

**plan-audit 이력**

| iteration | 결과 | 내용 |
|---|---|---|
| 1 (2026-09-04) | **FAIL** | 집계 **0.79** (Tier L 임계값 0.85 미달) + **MP-7 clarification gate 실패**(두 실패 근거는 서로 독립). Clarity 0.75 / Completeness 0.85 / Testability 0.70 / Traceability 0.85. blocking 결함 12건(D1~D12) + optional 2건(D13·D14). 보고서: `.moai/reports/plan-audit/SPEC-ADMIN-003-2026-09-04.md` |
| 2 (2026-09-04) | **FAIL** | 집계 **0.87** (Tier L 임계값 0.85 **충족**, iteration 1 대비 +0.08) · must-pass 7건 **전부 PASS/N-A**(MP-7 clarification gate 포함). Clarity 0.85 / Completeness 0.90 / Testability 0.78 / Traceability 0.95. 판정을 가른 것은 점수도 must-pass도 아닌 **미해소 blocking 2건** — (D1) 철회된 근거가 `progress.md`의 승인 게이트 요약에 정정 없이 살아 있음, (D2) 사용자 결정 2의 변별 요소가 REQ·AC 계층에 없어 기각된 `redirect: "manual"`이 16개 AC를 전부 통과함. optional 5건(D3~D7) 동반. iteration 1 결함 14건 중 12건 완전 해소·2건(D1·D8) 부분 해소. 보고서: `.moai/reports/plan-audit/SPEC-ADMIN-003-2026-09-04-iter2.md` |
| 3 (2026-09-04) | **FAIL — 집계 0.925** (Tier L 기준 0.85 충족, blocking 1건이 판정을 가름). 보고서 `.moai/reports/plan-audit/SPEC-ADMIN-003-2026-09-04-iter3.md` | blocking 2건 + optional 5건 전건 해소 확인. 잔여 **N1**(major/blocking — D2 수정이 거짓으로 만든 진술의 셋째 인스턴스가 `research.md`에 생존 + 이 표의 완료 보고 개수 오류) · **N2**(minor/optional — M5 자기 검증 프로브를 2개로 열거, `AC-ADMIN-048`은 3개 요구). 감사자 권고: **PASS-with-debt** (어떤 REQ·AC·마일스톤·종료 조건도 바뀌지 않고, run-phase를 실제로 게이트하는 AC 계층은 이미 옳다). 점수 추이 0.79 → 0.87 → 0.925, 회귀 없음 |
| 3-post (2026-09-04) | **N1·N2 반영 — 오케스트레이터 직접 정정** (신규 감사 라운드 아님) | 감사자가 문장 단위로 지정한 3개 편집을 그대로 적용: `research.md` §7의 거짓 진술 교체 · 이 표 D2 행의 "두 진술"→"세 진술" + `research.md` 위치 등재 · `plan.md` M5 프로브 2개→3개(`.tsx` 프로브 추가, `AC-ADMIN-048`과 일치). 실측 검증: 거짓 진술 잔존 0건, REQ 14 / AC 16 불변, 명확화 마커 0건. 감사자 판정문 기준 "이 세 편집을 적용하면 검사한 모든 기준이 충족된다" |

**iteration 2 — 결함별 조치**

| ID | 심각도 | 조치 | 변경 파일 |
|---|---|---|---|
| D1 | critical (MP-7) | 결정 2를 `response.redirected` + 전용 문구로 확정. 마커 리터럴 2건 제거 | plan.md §0 결정 2 · research.md §7 · design.md §3.3 · progress.md |
| D2 | critical | `tests/` 봉투를 소유권 교차에 편입 — spec.md §1 두 번째 표(4파일), REQ-ADMIN-054·055 신설, AC-ADMIN-054·055 신설, **M3 신설**(구조 가드 재작성), 결정 3 표에 2행 추가 | spec.md · plan.md · acceptance.md · design.md §4.2 |
| D3 | major | §4의 "네 테스트 모두 핸들러를 직접 호출한다" 서술을 런타임 3건 / 소스 트리 구조 가드 1건으로 갈라 정정 | research.md §4 |
| D4 | major | `staff-product-form.test.tsx`의 URL 리터럴 단언 3건 갱신을 M3 (b)의 명시 작업으로 올리고 AC-ADMIN-054가 판정 | plan.md M3 · acceptance.md AC-054 |
| D5 | major | A층 가드 1단계 — 추출 결과 **빈 배열을 FAIL로 승격**. `extractMatcher` 직접 재사용 금지, 래퍼 지시. REQ-049 본문·AC-049 Then 절 보강 | design.md §3.1 ① · spec.md REQ-049 · acceptance.md AC-049 |
| D6 | major | 열거 대상을 `route.{ts,tsx,js,jsx}`로 확장. REQ-048 본문도 같은 집합 명시(REQ↔design 불일치 해소). AC-048에 `.tsx` 프로브 추가 | design.md §3.1 ② · spec.md REQ-048 · acceptance.md AC-048 |
| D7 | major | `:param*`가 **0개 이상** 세그먼트임을 명시. AC-048 자기 검증 프로브를 `src/app/admin/route.ts`(0세그먼트) 포함 3개로 확대 | design.md §3.1 ③ · acceptance.md AC-048 |
| D8 | major | 결정 1 근거 3 **철회**. SHA-256 스냅샷이 두 후보를 동등 보호하고 `/staff` 단언은 리터럴 일치라 캐치올 매처에 우회됨을 명기. 근거 (a)·(b)만 게이트에 올림 | plan.md §0 결정 1 · design.md §1.2 · research.md §5.1·§5.2 |
| D9 | minor | DoD의 AC 개수 13 → **16**(신설 2건 반영). 문서 첫 줄도 16으로 정합 | acceptance.md `:3`·§F |
| D10 | minor | `next build` + 라우트 매니페스트 확인 절을 AC-045에서 **AC-042**로 이동 | acceptance.md AC-042·AC-045 |
| D11 | minor | REQ-045를 `src/`로 한정하고 `tests/`는 REQ-054가 덮도록 분담. AC-045의 grep 범위도 `src/`로 정합 | spec.md REQ-045 · acceptance.md AC-045 |
| D12 | minor | M1 작업 서술에 `src/` · `tests/` 양쪽 import 지정자 갱신을 포함 — 종료 조건 `typecheck`를 만족 가능하게 재범위 | plan.md M1 |
| D13 | optional | M7에 `AC-ADMIN-041` 각주 한 줄 추가(공동 배송 귀속 흐림 방지) | plan.md M7 |
| D14 | optional | M2 열거를 `CancelOrderButton.tsx:10`(주석)·`:46`(fetch) 두 곳으로 표기해 열거와 종료 조건 일치 | plan.md M2 |

**iteration 3 — 결함별 조치** (iteration 2 보고서 기준 번호. blocking 2건 + optional 5건)

| ID | 심각도 | 조치 | 변경 파일 |
|---|---|---|---|
| D1 | major (blocking) | 승인 게이트 요약 문단에 정정 없이 살아 있던 **결정 1의 철회된 셋째 근거**(기존 통과 테스트가 목적지 경로의 매처 밖 위치를 보장해 준다는 주장 — iteration 1 D8)를 **제거**하고, 목적지를 살아남은 근거 두 가지 위에만 세웠다. 구조적 잠금이 없다는 사실과 **A층 배치 가드가 유일한 방어층** 이라는 귀결을 명시. Kickoff 항목 1도 같은 조건으로 정정 | progress.md `:26` · progress.md Kickoff 항목 1 |
| D2 | major (blocking) | 사용자 결정 2의 **변별 요소를 요구사항·판정 계층에 앵커**했다. REQ-ADMIN-046에 전용 상수 문구를, REQ-ADMIN-047에 `response.ok` **앞** 배치를 올리고, AC-ADMIN-046a·046b가 문구 상수를, AC-ADMIN-047의 두 번째 블록이 소스 순서 + 상수 단일 정의를 판정한다. 기각된 `redirect: "manual"`은 이제 AC-046a·046b·047을 통과하지 못한다. 이 수정으로 거짓이 된 **세 진술**("AC는 이 확정으로 바뀌지 않는다")도 함께 정정 — `plan.md`·`design.md` 둘은 iteration 3에서, `research.md`의 셋째 인스턴스는 plan-audit iteration 3 N1 지적으로 뒤늦게 정정 | spec.md REQ-046·047 · acceptance.md AC-046a·046b·047 · plan.md §0 결정 2 · design.md §3.3 · research.md §7 |
| D3 | minor (optional) | `design.md:20` 요약의 (c)에 **취소선 + 철회 표기** 추가, §1.1 제목을 "최초 서술(§1.2에서 철회됨, 원문 보존)"으로 조정 — 이 절만 인용될 때 철회된 근거가 전파되지 않게 | design.md §1·§1.1 |
| D4 | minor (optional) | AC-ADMIN-053a의 When 절을 "**이 SPEC 자신의 디렉터리를 제외한**"으로 한정 — 문자 그대로 실행하면 자기 아티팩트 6건이 섞여 13건이 되어 통과 불가였다 | acceptance.md AC-053a |
| D5 | minor (optional) | `spec.md:81`의 "범위가 겹치지 않게"를 실제와 맞게 정정 — REQ-054의 grep이 `src/`를 포함하므로 **이중 집행**이며, 한정의 목적은 범위 분리가 아니라 책임 대상 명시임을 밝혔다 | spec.md REQ-045 |
| D6 | minor (optional) | AC-ADMIN-049의 픽스처 절을 **두 픽스처·무조건형**으로 교체 — (ii) 어떤 해석기로도 읽히지 않는 형태를 넘기면 가드가 반드시 FAIL. 이전 조건부 서술로는 빈 배열 FAIL 분기가 행위로 한 번도 실행되지 않았다 | acceptance.md AC-049 |
| D7 | minor (optional) | 이동 대상 라우트 파일 **자신의 문서 주석 4건**(실측: `products/route.ts:14` · `[productId]/route.ts:14` · `[productId]/active/route.ts:9` · `orders/[orderId]/status/route.ts:9`)을 M1 작업 서술에 등재 — 종료 조건만 붙잡고 어느 마일스톤 열거에도 없던 상태를 닫았다 | plan.md M1 |

**iteration 3에서 손대지 않은 것**: iteration 2 보고서가 확정한 나머지 12건의 해소 상태(D2·D3·D4·D5·D6·D7·D9~D14 계열), 마일스톤 번호 체계, AC/REQ **개수**(14 REQ / 16 AC 불변 — D2는 기존 REQ·AC 본문에 판정을 추가했을 뿐 신설하지 않았다), 소유권 교차 범위, PRESERVE 목록.

## §F Phase 4 Mode Selection

> 기록 시점: run-phase 첫 `Agent()` 스폰 **이전**(로깅 계약). t28 워크트리에서 에이전트 브랜치를 ff-merge 하는 과정에 미커밋 상태였던 이 절이 되돌려졌고, 병합 후 동일 내용으로 재기록했다.

- **입력값**: tier L · 소스/테스트 18파일 · 도메인 1개(Next.js 라우팅/관리자 백오피스) · TypeScript 단일 · 병렬 이득 LOW(코딩 중심)
- **모드 평가**

| 모드 | 선택 | 사유 |
|---|---|---|
| direct | 아니오 | 오타/한 줄이 아니다. 라우트 이동 + 신규 테스트 + 호출부 분기 |
| serial | **선택** | 코딩 중심. Anthropic coding-task 병렬성 caveat + 마일스톤 M1~M8이 선형 의존(이동 → 참조 갱신 → 가드 신설) |
| fanout | 아니오 | 다중 도메인 조사가 아니라 단일 도메인 구현. 병렬 이득 LOW |
| sweep | 아니오 | ~30파일 단일 규칙 기계 변환이 아니다. 이동·갱신·신설이 섞이고 파일 간 의존이 있다 |

- **Decision: serial**
- **근거**: 파일을 옮기기 전에 참조를 갱신할 수 없고, A층 배치 가드는 이동이 끝난 뒤라야 의미 있는 판정을 낸다. 병렬화하면 typecheck가 깨진 중간 상태에서 두 에이전트가 같은 파일을 만진다. Tier L이므로 위임 프롬프트는 Section A-E 5절 템플릿 전체를 적용했다.

## §E.2 Run-phase Evidence

모든 명령은 이 트리에서 실제로 실행한 결과이며, 로그 원본은
`.moai/state/verify/run-t28/` 아래에 있다. 비교 기준(baseline)은
`WT-admin-write-routes` 의 tip `4a4f31c` 다.

**착수 baseline (프로젝트 상태 `4a4f31c`)**

| 항목 | 명령 | 관측 |
|---|---|---|
| typecheck | `npx tsc --noEmit` | exit 0 |
| 전체 스위트 | `npx vitest run` | exit 1 — **1 failed / 1321 passed (95 files)**. 실패는 `tests/integration/auth/login.test.ts` AC-AUTH-005 단 하나 (백로그 카드 `t20` 타이밍 flake) |
| 라우트 파일 | `find src/app/admin -type f` | 5건 |
| 옛 경로 문자열 | `grep -rn 'admin/api' src/ tests/` | 59건 (src 18 · tests 41) |

### AC 판정 매트릭스 (16건)

| AC | 판정 | 판정 명령 | 관측 |
|---|---|---|---|
| AC-ADMIN-042 | PASS | `npx next build` + `.next/routes-manifest.json` grep | exit 0. 매니페스트에 `/staff/api/products` · `/staff/api/products/[productId]` · `/staff/api/products/[productId]/active` · `/staff/api/orders/[orderId]/status` 4건 등록. `/admin` 접두사 라우트 0건. 배치 가드가 네 pathname 중 어느 것도 매처에 걸리지 않음을 판정 |
| AC-ADMIN-043 | PASS | `git diff -M 4a4f31c -- src/app/staff/api src/app/admin` | 5 files / 7 insertions / 7 deletions. 변경 줄은 **전부** import 지정자(3건) + 문서 주석 URL(4건)이고 `shared.ts` 는 0줄. 검사 순서·상태 코드·응답 본문 문장에 변경 0줄 |
| AC-ADMIN-044 | PASS | `find src/app/admin -type f` | `No such file or directory`, count 0 — 디렉터리 자체가 없다 |
| AC-ADMIN-045 | PASS | `grep -rn 'admin/api' src/` | 0건 (착수 시 18건) |
| AC-ADMIN-046a | PASS | `npx vitest run tests/unit/app/staff-product-form.test.tsx` | `[AC-ADMIN-046a]` 4건 통과. 저장(create)·저장(edit)·판매중단 세 경로 모두 전용 상수 문구를 표시하고, 성공 분기(`router.push` / `router.refresh` / `isActive` 토글)가 한 번도 실행되지 않는다. 기존 일반 문구가 아님을 별도 단언 |
| AC-ADMIN-046b | PASS | `npx vitest run tests/unit/app/staff-cancel-order-button.test.tsx` | 신규 파일 7건 통과. `[AC-ADMIN-046b]` 3건이 리다이렉트 응답에 대해 같은 전용 상수를 표시하고 `router.refresh()` 가 호출되지 않음을 판정 |
| AC-ADMIN-047 | PASS | `npx vitest run tests/unit/admin/redirect-failure-guard.test.ts` | 8건 통과. 두 호출부 파일 각각에서 `response.redirected` 출현 수 = `await fetch(` 수이고 쌍별로 `response.ok` 보다 **앞** 에 있다. 상수는 `src/features/admin/write-failure.ts` 한 곳에서만 선언되고 두 파일 모두 import 한다. **변이 검증**: 가드를 `ok` 뒤로 옮기면 이 테스트가 실제로 실패한다 (`m4-mutation-order.log` — `expected 2490 to be less than 2414`) |
| AC-ADMIN-048 | PASS | 프로브 3개를 **하나씩 따로** 넣고 매번 `npx vitest run tests/unit/admin/route-placement-guard.test.ts` (`m5-probes.log`) | (i) 깊은 `.ts` `src/app/admin/api/probe/route.ts` → FAIL, 메시지에 `(pathname /admin/api/probe) matches matcher /admin/:path*`; 지우면 22 passed. (ii) 0세그먼트 `src/app/admin/route.ts` → FAIL, `(pathname /admin)`; 지우면 22 passed. (iii) 비-`.ts` `src/app/admin/api/probe/route.tsx` → FAIL; 지우면 22 passed. 가드의 `ROUTE_FILENAMES` 가 네 확장자 전부를 담는다는 것도 별도 단언 |
| AC-ADMIN-049 | PASS | 같은 파일 | 매처 리터럴을 담은 상수 바인딩 0건이고 판정 값은 `extractMatcherStrict(readMiddleware())` 로만 얻는다. **행위 판정 두 픽스처는 `src/middleware.ts` 의 실제 사본에서 매처 줄만 바꿔 만든다**: (i) 대괄호 없는 단일 문자열형 → 비지 않은 패턴 배열로 읽히고 정상 판정 계속, (ii) `matcher: MATCHER_CONST` → **무조건 throw** (`could not read config.matcher`). 빈 배열 픽스처도 별도로 throw (`EMPTY`) |
| AC-ADMIN-050 | PASS | `npx vitest run tests/unit/admin/middleware-traversal.test.ts` | 9건 통과. 무헤더·잘못된 Bearer 두 경우 모두 3xx + `location` 존재이고, 4xx 도 5xx 도 아님을 **별도 단언** 으로 남겼다. 실측: 두 경우 모두 `status=307 location=http://localhost/` |
| AC-ADMIN-051 | PASS | 두 신규 가드 파일 | 배치 가드의 열거 함수 본문(주석 제외)에 URL 문자열 0건이고 필터는 `ROUTE_FILENAMES.includes(entry)` 하나뿐이며, 독립 재계수와 파일 수가 일치한다. C층 가드도 호출부를 경로 목록이 아니라 "`fetch` 를 호출하고 공유 상수를 import 하는 파일" 로 찾는다 |
| AC-ADMIN-052 | PASS | PRESERVE 7파일 numstat + `npx vitest run tests/unit/admin/middleware-preserve.test.ts` | numstat 출력 **없음** = 7개 파일 전부 0줄. `middleware-preserve.test.ts` 는 **수정되지 않은 채로** 3 tests 전건 통과 (매처 정확 일치 · `/staff` 문자열 0건 · 바이트 길이 2485 + SHA-256) |
| AC-ADMIN-053a | PASS | `.moai/specs/` 변경 파일 열거 (자기 디렉터리 제외) | 정확히 7개 — `SPEC-ADMIN-002` 의 spec/plan/acceptance/design (네 파일 모두 `grep -c 'admin/api'` = 0), `SPEC-ADMIN-001` 의 acceptance(1줄 교체)·design(+2/-0)·plan(+2/-0). `SPEC-ADMIN-001/spec.md` 무변경 |
| AC-ADMIN-053b | PASS | 기록물 4파일 numstat | numstat 출력 **없음** = 4개 파일 전부 0줄. `admin/api` 출현이 그대로 남아 있다 — ADMIN-001 research 1 · progress 7, ADMIN-002 research 3 · progress 2 (합계 13, 실측값과 일치) |
| AC-ADMIN-054 | PASS | `grep -rn 'admin/api' src/ tests/` | 0건 (착수 시 59건). 봉투 네 파일 전부 변경됨. `staff-product-form.test.tsx` 의 URL 리터럴 세 건이 각각 `/staff/api/products` · `/staff/api/products/p1` · `/staff/api/products/p1/active` 를 기대한다 |
| AC-ADMIN-055 | PASS | `npx vitest run tests/unit/admin/product-boundaries.test.ts` | exit 0, 67 passed, `ENOENT` 0건 (M3 착수 전 같은 파일이 `readdirSync`/`readFileSync` ENOENT 로 터졌다 — `m3-red-product-boundaries.log`). `[AC-ADMIN-040]` 블록이 새 규약 3항목(화면 `/staff` 하위, 쓰기 API `/staff/api` 하위 + `page.tsx` 0건, `src/app/admin` 부재)을 단언하고, 나머지 여섯 블록(020·028·036·037·039·041)이 전부 그대로 존재하며 변경은 경로 문자열뿐이다 |

### 불변식

| 불변식 | 판정 | 관측 |
|---|---|---|
| `src/middleware.ts` 바이트 무변경 | PASS | numstat 0줄 + SHA-256 스냅샷 단언 통과 |
| `middleware-preserve.test.ts` 수정 없이 통과 | PASS | 파일 diff 0줄, 3 tests 통과 |
| 신규 실패 0건 | PASS | 전체 스위트 1 failed / 1372 passed. 유일한 실패가 baseline 과 **동일한** `t20` flake (같은 파일·같은 테스트·같은 단언). 단독 실행 시 통과 — `median diff=0.18ms tolerance=54.05ms`, exit 0 |
| lint 무회귀 | PASS | `npm run lint` exit 0 |

## §E.3 Run-phase Audit-Ready Signal

```yaml
spec_id: SPEC-ADMIN-003
card: t28
run_complete_at: 2026-09-04
run_commit_sha: pending-backfill-run   # M1~M8 8개 커밋. tip 은 이 파일을 담은 M8 커밋
run_status: audit-ready
ac_pass_count: 16
ac_fail_count: 0
preserve_list_post_run_count: 7        # plan.md §D 7개 파일 전부 diff 0줄
new_warnings_or_lints_introduced: 0
cross_platform_build:
  next_build: pass                     # npx next build exit 0
  typecheck: pass                      # npx tsc --noEmit exit 0
  lint: pass                           # npm run lint exit 0
test_suite:
  baseline: "1 failed / 1321 passed (95 files)"
  post_run: "1 failed / 1372 passed (99 files)"
  new_failures: 0
  known_flake: "tests/integration/auth/login.test.ts AC-AUTH-005 (backlog card t20) — passes in isolation, exit 0"
total_run_phase_files: 22              # 구현·테스트 15 + 이웃 SPEC 7
m1_to_mN_commit_strategy: "마일스톤당 1커밋 (M1 만 2커밋 — 첫 커밋이 rename 만 담고 내용 편집을 놓쳐 M1 (cont.) 로 분리). --amend 미사용"
evidence_dir: .moai/state/verify/run-t28/
```

**환경 이탈 두 건 (감사에 그대로 올린다)**

1. **작업 트리** — 이 run-phase 는 배정된 `.claude/worktrees/t28` 이 아니라
   `.claude/worktrees/agent-ab388604bc80266f3` 에서 수행되었다. 실행
   에이전트가 후자에 고정되어 있어 전자를 대상으로 하는 모든 git 조작이
   격리 가드에 거부되었다. 대신 이 트리를 `WT-admin-write-routes`
   tip(`4a4f31c`)으로 fast-forward 한 뒤 그 위에 커밋을 쌓았다 —
   fast-forward 직후 두 트리의 차분이 비어 있음을 확인했으므로 착수
   시점의 내용은 동일하다. 커밋들은 `4a4f31c` 를 조상으로 갖는 선형
   이력이므로, `WT-admin-write-routes` 를 이 브랜치 tip 으로
   fast-forward 하면 그대로 편입된다.
2. **pre-commit 게이트** — 여덟 커밋 모두 `SKIP_MOAI_PRECOMMIT=1` 로
   올렸다. 훅이 `moai gate`(전체 스위트)를 돌리는데 그 게이트가 `t20`
   flake 하나 때문에 항상 실패하므로, flake 가 남아 있는 한 어떤 커밋도
   통과할 수 없다. 금지된 `--no-verify` 는 사용하지 않았다 — 훅 자신이
   문서화한 override 다. 게이트가 판정하는 세 항목(lint · typecheck ·
   전체 스위트)은 위 표에 개별 명령의 실행 결과로 남겼다.

## §E.4 Sync-phase Audit-Ready Signal

```yaml
spec_id: SPEC-ADMIN-003
card: t28
sync_complete_at: 2026-09-04
sync_commit_sha: 2d663e1c78b718f4059ffd132f294c731f040dbc
sync_status: complete
b12_self_test_a: pass    # grep -c 'SPEC-ADMIN-003' CHANGELOG.md -> 0 (중복 없음)
b12_self_test_b: pass    # acceptance.md AC 표제 16건 == CHANGELOG 기재 16건
b12_self_test_c: pass    # 기재된 모든 파일 경로를 실제 트리에서 확인
changelog_entry_position: "[Unreleased] 최상단 — SPEC-ADMIN-002 항목 앞"
frontmatter_status_transitions:
  spec_md: "in-progress -> implemented -> completed (단일 sync 커밋)"
  plan_md: "n/a — YAML frontmatter 없음"
  acceptance_md: "n/a — YAML frontmatter 없음"
  progress_md: "n/a — YAML frontmatter 없음"
docs_synced:
  - CHANGELOG.md
  - README.md            # 272행 라우트 경로, 274행 핸들러 위치 정정
precommit_gate: overridden   # SKIP_MOAI_PRECOMMIT=1 — 저장소 전역 t20 플레이크. 게이트 통과 아님
neighbor_spec_status_untouched: SPEC-ADMIN-002   # 종결 판단은 오케스트레이터 소관
```

### F1 / F2 판정 근거 (SPEC-ADMIN-002 sync-audit 대응)

- **F1 (Critical) — 닫힘.** 네 라우트가 전부 `src/app/staff/api/**`로 이동해 `/admin/:path*` 매처 밖에 있고, `src/app/admin`은 존재하지 않는다. `grep -rn 'admin/api' src/ tests/` 0건. 세 호출부가 `response.redirected`를 `response.ok`보다 앞에서 검사한다. 재발 방지는 A/B/C 세 검증 계층이 맡는다.
- **F2 (Medium) — 존치.** `/staff/products/new`와 `/staff/products/[productId]` 두 화면의 세션 게이트 `null` 경로를 실행하는 동작 테스트는 여전히 없다. 이 SPEC은 `product-boundaries.test.ts`의 경로 문자열만 갱신했을 뿐 판정력을 더하지 않았다.
