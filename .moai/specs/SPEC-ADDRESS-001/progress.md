# progress.md — SPEC-ADDRESS-001

## §E.1 Plan-phase Audit-Ready Signal

plan_status: audit-ready
plan_complete_at: 2026-09-07
plan_audit_verdict: PASS (iteration 2/3 — confirming re-audit, defect-delta scoped)
plan_audit_score: 0.99 (Tier M 임계값 0.80 초과. iteration 1은 0.92 PASS이나 blocking 결함 4건(D1-D4) 미해소로 재감사 필요)
plan_audit_report: .moai/reports/plan-audit/SPEC-ADDRESS-001-2026-09-07.md

plan-phase 산출물 4종(`spec.md`, `plan.md`, `acceptance.md`, `spec-compact.md`) 작성 완료. 착수 전 사용자가 AskUserQuestion 라운드로 두 가지 범위 결정을 이미 확정한 상태로 위임되어, 별도 명료화 라운드 없이 진행했다:

1. **CSRF 적용 여부** — 모든 상태 변경 주소록 엔드포인트에 적용(확정).
2. **체크아웃 통합 범위** — 마이페이지 관리 전용, 체크아웃 연동 제외(확정).

미해결 명료화 마커 없음. REQ-ADDRESS-001~015(15개), AC-ADDRESS-001~015(15개) — Tier M 예산 16/16 이내이며 각 1칸 여유.

### plan-auditor iteration 1 — PASS 0.92, 7건 조치 완료

독립 감사 결과 **PASS**(0.92 ≥ Tier M 임계값 0.80). must-pass 7개 전부 PASS. 지적된 7건(blocking 4 + optional 3)은 전부 **국소적 텍스트 수정**이었고 요구사항·AC·설계 결정을 하나도 바꾸지 않았다. 전건 조치 완료:

| ID | 등급 | 내용 | 조치 |
|---|---|---|---|
| D1 | major, blocking | `plan.md`·`acceptance.md`가 기본 배송지 안전 장치를 트랜잭션 "롤백"으로 잘못 귀속. 실제 코드는 `return false`이고 Prisma는 반환 시 커밋·throw 시에만 롤백 — 진짜 안전 장치는 **첫 `updateMany`가 0건 매치**라는 사실이다 | 두 위치를 `@MX:WARN`의 올바른 표현으로 통일하고, "롤백으로 읽고 대칭성 맞추려 `throw`를 넣으면 404가 500이 된다"는 위험을 명시 |
| D2 | minor, blocking | AC-ADDRESS-014의 `grep` 경로 `src/app/(shop)/mypage`가 인용되지 않아 셸 파싱 오류 — "0건 PASS"가 아니라 실행 실패 | 두 명령 전체를 따옴표 인용 형태의 코드 블록으로 재작성하고, 판정을 exit 코드가 아닌 출력 공백으로 명시 |
| D3 | minor, blocking | CSRF 적용 경로 수를 6으로 기재(실제 7) | `spec.md`·`progress.md` 두 곳을 7로 정정. 근거 명령을 `grep -rln … \| wc -l`로 교체. 결정(다수 선례 추종)은 불변이며 7 대 1로 오히려 강화 |
| D4 | minor, blocking | `plan.md` "수정 (2)"인데 열거는 1개, `spec-compact.md`는 "1 수정" — 상호 모순. "11 신규 구현"도 실제 열거는 10 | 3개 위치를 **수정 1 / 신규 구현 10 / 신규 테스트 3**으로 통일하고 항목별 개수를 병기 |
| D5 | optional | AC-ADDRESS-015에 상위 REQ 없음 | REQ를 새로 만들지 않고, **의도된 공통 회귀 게이트**임을 매핑 표에 명시적으로 공시(승격 시 SPEC마다 중복 선언되는 문제를 근거로) |
| D6 | optional | `spec.md`의 "`/mypage`를 회원 영역 루트로 열되"가 존재하지 않는 라우트를 암시 | "`/mypage`는 이름 공간으로 예약만 하고 라우트는 만들지 않는다 — 직접 열면 404"로 재서술 |
| D7 | optional | `plan.md`가 `:86-89`를 인용문 출처로 기재(실제 주석은 `:84`) | `:84-89`로 정정하고 주석(`:84`)과 게이트 코드(`:86-89`)를 분리 표기. 코드 span을 인용한 나머지 3개 위치는 정확하므로 미변경 |

**감사 지적의 실측 재확인** — 조치 전 7건을 전부 직접 검증했다: `grep -rln "verifyCsrfRequest" src/app | wc -l` → `7`(D3 확인), 괄호 미인용 경로는 셸이 파싱 자체를 거부(D2 확인), `sed -n '84,89p' src/app/staff/products/page.tsx` → 주석은 `:84`·코드는 `:86-89`(D7 확인, 부분 지적임이 드러나 plan.md만 수정), 파일 열거 재계수 → 신규 구현 10·수정 1(D4 확인).

### Phase 1 SKIP Rationale (research.md 미작성 근거)

Tier M이므로 `research.md`는 필수 산출물이 아니다. 대신 착수 전 정찰에서 확인한 사실을 **이 세션이 직접 재검증**한 뒤 `spec.md` §1.2/§1.3/§1.5와 `plan.md` §B에 근거와 함께 인라인으로 기록했다. 재검증 명령과 관측 결과:

| 주장 | 검증 방법 | 관측 결과 |
|---|---|---|
| SPEC ID 충돌 없음 | `ls -d .moai/specs/SPEC-ADDRESS-001` | `No such file or directory` — 충돌 없음 |
| SPEC ID 형식 적합 | Bash 정규식 `^SPEC(-[A-Z][A-Z0-9]*)+-[0-9]{3}$` | `PASS` |
| 후보 ID가 카드에 선기록됨 | `grep -rn "SPEC-ADDRESS-001" .moai/specs/` | `SPEC-ORDER-003/spec.md:96`, `SPEC-ORDER-003/plan.md:19` 2건 |
| SPEC-ORDER-004 병합됨 | `git log --oneline` | `f10155d feat(SPEC-ORDER-004) … (#30)` |
| ORDER-004가 선행 조건 해소를 명시 | `sed -n '185,195p' SPEC-ORDER-004/spec.md` | `:191` "이 SPEC이 그 선행 조건을 해소한다" 확인 |
| `resolveSession()` 호출부 | `grep -rn "resolveSession" src/` | 구현부 1 + 호출부 **6곳**(SiteHeader:30, products/[productId]:49, checkout:53, checkout/complete:88, api/orders:51, api/reviews:29). 위임 프롬프트는 7곳이라 했으나 실측은 6곳 — 리다이렉트하는 곳이 하나도 없다는 결론은 동일 |
| 고객용 리다이렉트 게이트 부재 | 위 6곳 개별 확인 | 전부 `null`을 익명으로 취급(UI 분기·게스트 폴백·401 JSON). 리다이렉트 0건 |
| staff 리다이렉트 선례 | `sed -n '70,110p' src/app/staff/products/page.tsx` | `:86-89` `resolveAdminSession` → `redirect("/staff/login")` 확인 |
| CSRF 선례 분포 | `grep -rln "verifyCsrfRequest" src/app \| wc -l` | **7개 파일** 적용(orders 회원분기 1 · staff 4 · auth refresh/logout 2 = 7), `api/reviews`에는 import 자체 없음 |
| ORDER-004 CSRF 순서 교훈 | `sed -n '1,80p' src/app/api/orders/route.ts` | `:26-35` 주석에 순환과 해법("CSRF before the STATE-CHANGING operation") 원문 확인 |
| `CheckoutForm`에 회원 통로 없음 | `sed -n '60,85p' src/components/checkout/CheckoutForm.tsx` | props가 `idempotencyKey`/`confirmedTotal`/`couponCode` 3개뿐 — `isLoggedIn`/`userId` 없음 |
| 로그인 복귀 파라미터 금지 | `grep -n "REQ-AUTH-029" SPEC-AUTH-002/spec.md` | `:75` Unwanted "…구현해서는 안 된다 — 성공 시 이동 대상은 항상 고정된 `/`" 확인. `login/page.tsx` 주석도 동일 |
| onDelete 분류 근거 | `cat prisma/schema.prisma` | Cascade(Review·Cart·RefreshToken·CartItem) vs Restrict(Order.user·OrderItem.product) 및 스키마 자체 주석의 사유 확인 |
| 마이그레이션 관행 | `ls prisma/migrations/` + 최신 헤더 | 11개, 전부 손 작성. 헤더에 사유 명시 확인 |
| 기본 지정 선례 부재 | 스키마 전수 확인 | `isDefault`/`isPrimary` 계열 컬럼 0건 — greenfield 확정 |
| 단일 boolean 전환 라우트 선례 | `grep -rn "verifyCsrfRequest" src/` | `staff/api/products/[productId]/active/route.ts` 존재 확인 |

**위임 프롬프트와 실측이 어긋난 지점 1건**: `resolveSession()` 호출부가 프롬프트에는 7곳으로 적혔으나 실측은 6곳이다(구현부 `session-resolver.ts:54`를 포함하면 7). 결론("어느 곳도 `null`에 리다이렉트하지 않는다")은 영향을 받지 않으며, `spec.md` §1.3은 실측치 6곳으로 기록했다.

## §E.2 Run-phase Evidence

_<pending run-phase>_

## §E.3 Run-phase Audit-Ready Signal

_<pending run-phase>_

## §E.4 Sync-phase Audit-Ready Signal

_<pending sync-phase>_
