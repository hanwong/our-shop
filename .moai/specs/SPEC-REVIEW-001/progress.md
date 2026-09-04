# progress.md — SPEC-REVIEW-001

## §E.1 Plan-phase Audit-Ready Signal

plan_status: audit-ready
plan_complete_at: 2026-09-04
plan_audit_verdict: PASS (iteration 2/3)
plan_audit_score: 0.97 (threshold for Tier M: 0.80) — iteration 2 점수. iteration 1(0.75, FAIL) 대비 8개 결함 전부 해소 확인.
plan_audit_report: .moai/reports/plan-audit/SPEC-REVIEW-001-review-2.md (iteration 1 리포트: SPEC-REVIEW-001-review-1.md)

plan-phase 산출물(spec.md, plan.md, acceptance.md, spec-compact.md) 작성 완료. 착수 전 사용자가 Socratic AskUserQuestion 라운드로 모든 범위 결정(로그인 인증 기준, 구매 인증 배제, 1인 1리뷰 정책, 표시 위치, 편집/모더레이션 배제)을 이미 확정한 상태로 위임되어, 별도 명료화 라운드 없이 진행했다. `[NEEDS CLARIFICATION]` 마커 없음.

**plan-auditor iteration 1 verdict: FAIL** (독립 감사, `.moai/reports/plan-audit/SPEC-REVIEW-001-review-1.md`, score 0.75 < Tier M 임계값 0.80). 8개 결함(D1-D8) 중 4개 blocking(D1 critical, D2 major, D3/D8 minor-blocking-by-rubric)과 4개 optional(D4-D7)이 보고됨.

**plan-auditor iteration 2 verdict: PASS** (독립 재감사, `.moai/reports/plan-audit/SPEC-REVIEW-001-review-2.md`, score 0.97 ≥ Tier M 임계값 0.80). D1-D8 전부 실제 아티팩트 대조로 재검증되어 해소 확인(D5는 원래 조치불요로 올바르게 미변경 유지). MP-1/MP-3/MP-6/MP-7 회귀 없음 확인. AC-REVIEW-001~016(14→16) 시퀀스 gap/중복 없음 재확인. 신규 optional 관찰 2건(D9 HISTORY 미갱신, D10 body 길이 상한 formal AC 부재) 기록 — 둘 다 이번 검증 범위 밖이며 verdict를 막지 않음.

**결함 수정 완료 (iteration 2 재감사로 검증 완료)**:
- **D1 (critical, 수정됨)**: `tests/unit/components/product-detail-view.test.tsx`를 `plan.md` §F 파일 목록에 "수정" 대상으로 등재하고, M3에 구체적 조정 지침(정규식을 `/관련 상품|재고 변동/`로 좁히고 "리뷰" 토큰만 제거)을 명시. `spec.md` §1에 이 테스트 파일을 구체적으로 지목하는 새 소제목("이 대체가 건드리는 구체적 파일")을 추가.
- **D2 (major, 수정됨)**: `plan.md` M2에 body 길이 상한을 **최대 2000자(trim 후)**로 명시적으로 확정. `acceptance.md` §C의 "plan.md M2에서 명시적으로 정한다" 참조가 이제 실제로 존재하는 결정을 가리킴.
- **D3 (minor/blocking-by-rubric, 수정됨)**: `acceptance.md`에 AC-REVIEW-015(PATCH/DELETE 핸들러 부재 + 관리자 모더레이션 UI 부재)를 추가하고 REQ-REVIEW-011과 매핑.
- **D8 (minor/blocking-by-rubric, 수정됨)**: `plan.md` M2에 Prisma P2002 고유 제약 위반을 catch하여 409 실패 객체로 매핑하는 명시적 구현 지시를 추가. `acceptance.md`에 AC-REVIEW-016(서비스 레벨 mock 기반 P2002→409 테스트)을 추가.
- **D4 (optional, 수정됨)**: `acceptance.md` §A 매핑 표에 REQ-REVIEW-001을 AC-REVIEW-002 행에 추가.
- **D5 (optional, 조치 없음)**: `related_specs:` 필드는 그대로 유지 — 유효한 데이터이며 스키마를 깨지 않음.
- **D6 (optional, 수정됨)**: `plan.md` M3에 리뷰 body가 일반 JSX 텍스트로만 렌더링되고 `dangerouslySetInnerHTML`을 쓰지 않는다는 한 줄을 추가.
- **D7 (optional, 수정됨)**: `acceptance.md` AC-REVIEW-008의 "-류의" hedge 표현을 제거하고, 정확한 문구 대신 "평균 미표시 + 개수 0 표시"라는 이진 판정 조건으로 재작성.

AC 총 개수가 14개에서 16개로 증가(REQ/AC 예산 16/16 이내). `plan.md`/`acceptance.md`/`spec-compact.md`의 AC 범위 표기를 001~016으로 전체 갱신. 다음 단계: plan-auditor 재감사(iteration 2) — 이 델타 수정 범위로 스코프.

## §E.2 Run-phase Evidence

run_status: complete
run_complete_at: 2026-09-05

### Claim

M1-M5 전부 구현 완료. AC-REVIEW-001~016 전부 PASS. `git diff --stat main...HEAD`로 plan.md §D PRESERVE 목록(page.tsx/ProductGrid/ProductCard/AddToCartButton/ProductGallery/admin-session.ts/orders route.ts) 미변경 확인.

### AC PASS/FAIL 매트릭스

| AC | 판정 | 검증 근거 |
|---|---|---|
| AC-REVIEW-001 | PASS | `review-service.test.ts` "creates a review and returns 201-shaped success" + `route.test.ts` "returns 201 with the created review on success" |
| AC-REVIEW-002 | PASS | `review-service.test.ts` "returns 409 without calling create() when a review already exists" |
| AC-REVIEW-003 | PASS | `route.test.ts` "returns 401 without calling createReview when there is no session" |
| AC-REVIEW-004 | PASS | `review-service.test.ts` `it.each([0,6,-1,3.5,"4"])` rating rejection |
| AC-REVIEW-005 | PASS | `review-service.test.ts` `it.each(["", "   "])` + 2000자 상한 초과/경계 3건 |
| AC-REVIEW-006 | PASS | `review-service.test.ts` "returns 404 without calling create() for an unknown productId" |
| AC-REVIEW-007 | PASS | `review-service.test.ts` "rounds the average to one decimal place" + `product-detail-page.test.tsx` "shows the rounded average rating and the review count" (표시 "평균 평점 4.0 · 리뷰 3개") |
| AC-REVIEW-008 | PASS | `product-detail-page.test.tsx` "shows no average figure and an explicit zero count" |
| AC-REVIEW-009 | PASS | `product-detail-page.test.tsx` "shows a login-prompt link to /login instead of the write form for an anonymous visitor" |
| AC-REVIEW-010 | PASS | `product-detail-page.test.tsx` "shows the ReviewForm write control instead of the login prompt for a logged-in visitor" |
| AC-REVIEW-011 | PASS | `product-detail-page.test.tsx` "renders the review list in the order the service already returned" + repository 레벨 `review-repository.test.ts`(실제 PostgreSQL) "aggregateByProduct() and listByProduct() reflect real rows, newest first" |
| AC-REVIEW-012 | PASS | mechanical grep: `grep -rn "평점\|리뷰" src/components/product/ProductCard.tsx src/components/product/ProductGrid.tsx` → 매치 0건 (exit 1) |
| AC-REVIEW-013 | PASS | `product-detail-page.test.tsx`의 `firstRenderSources()`(ReviewForm.tsx/AddToCartButton.tsx 제외) 스캔 + ReviewForm.tsx 단독 스캔("keeps ReviewForm's fetch confined to its own submit handler") |
| AC-REVIEW-014 | PASS | `route.test.ts` "succeeds for an admin-role session exactly like a customer session" |
| AC-REVIEW-015 | PASS | mechanical grep: `grep -n "^export " src/app/api/reviews/route.ts` → `POST`만 존재; `grep -rln "review\|리뷰" src/app/staff` → 매치 0건 |
| AC-REVIEW-016 | PASS | `review-service.test.ts` "maps a create()-time unique-constraint violation to a structured 409" + `review-repository.test.ts`(실제 PostgreSQL) "rejects a concurrent duplicate at the DB level" (`P2002` 실측) |

### Evidence (verbatim)

```
$ npx vitest run
 Test Files  110 passed (110)
      Tests  1478 passed (1478)
```

```
$ npx vitest run --coverage
All files          |   97.02 |    93.47 |   98.97 |   97.02 |
 ...pp/api/reviews |     100 |       90 |     100 |     100 |
 ...s/repositories (reviews) | 100 | 100 | 100 | 100 |
 ...views/services |     100 |    96.96 |     100 |     100 |
 ...onents/product (ReviewForm.tsx incl.) | 100 | 84.61-100 | 100 | 100 |
```
(프로젝트 전역 기준 lines/functions/statements 85%, branches 80% — 이 SPEC이 추가한 모든 파일 개별 충족: review-repository.ts 100/100/100/100, review-service.ts 100/96.96/100/100, route.ts 100/90/100/100, ReviewForm.tsx 100/84.61/100/100. review.ts는 타입 전용 파일로 실행 가능 코드가 없어 0/0/0/0 — 프로젝트의 다른 모든 타입 전용 파일(product.ts, cart.ts, order.ts, payment.ts, discount.ts)과 동일한 패턴.)

```
$ npx tsc --noEmit
(no output — exit 0)

$ npx eslint .
(no output — exit 0)

$ npm run build
✓ Generating static pages (29/29)
├ ƒ /api/reviews                              176 B         102 kB
├ ƒ /products/[productId]                   2.31 kB         110 kB
```

```
$ grep -rn "AskUserQuestion\|mcp__askuser" src/features/reviews src/app/api/reviews src/components/product/ReviewForm.tsx src/app/products
(no output — 0 matches)
```

```
$ git diff --stat main...HEAD -- src/app/page.tsx src/components/product/ProductGrid.tsx src/components/product/ProductCard.tsx src/app/api/orders/route.ts src/features/admin/services/admin-session.ts src/components/product/AddToCartButton.tsx src/components/product/ProductGallery.tsx
(no output — PRESERVE 목록 전부 미변경)
```

### Baseline-attribution

이 워크트리(`.claude/worktrees/t36`, 브랜치 `WT-review-rating` — run-phase 완료 시점에 `WT-review-rating-purchase`에서 개명) HEAD, M1~M5 커밋 전체 반영 후 실측. `npx prisma migrate dev --name add_review_model` 실측 적용(로컬 Postgres `our-shop-demo-pg`, 포트 5433) — `review-repository.test.ts`는 이 실제 DB에 대해 실행됨(capability gate로 도달 불가 시 이름 있는 이유와 함께 skip).

### Gaps (미검증)

- CI 환경(GitHub Actions)에서의 `review-repository.test.ts` 실행 여부 — 로컬 실측만 확인, CI의 `DATABASE_URL`이 실제 Postgres에 도달 가능한지는 이 세션에서 확인하지 않음(다른 `*.postgres.test.ts`/`coupon-model.test.ts`와 동일한 기존 리스크 패턴).
- D9(HISTORY 행 미갱신)·D10(길이 상한 formal AC 부재)는 plan-audit iteration 2에서 optional로 기록되었고 이번 run-phase에서 착수하지 않음(선택 사항, 지시대로).
- 동시 두 요청이 실제로 동시에(in-process race) 도달하는 시나리오는 검증하지 않음 — `review-repository.test.ts`는 순차적으로 첫 create 성공 후 두 번째 create가 P2002로 거부됨을 확인했을 뿐, `Promise.all` 기반 실제 동시성 테스트(`concurrency.postgres.test.ts`류)는 작성하지 않음. DB 제약 자체가 최종 방어선이므로 순서와 무관하게 유일성은 보장되나, "정확히 동시"의 관측적 증거는 이 리포트의 잔여 위험으로 남긴다.

### Residual-risk (잔여 위험)

- 평균 평점 반올림(소수 1자리)의 경계값(예: x.x5) 반올림 방향은 JS `Math.round` 표준 동작(0.5는 올림)에 의존 — 별도 단위 테스트로 경계값을 명시적으로 확인하지 않음.
- `ReviewForm.tsx`의 미검증 브랜치(84.61% branch, 2줄 미검증)는 `catch` 블록의 극히 예외적인 하위 경로로 추정 — 기능적으로 AddToCartButton.tsx와 동일 관용구이므로 위험은 낮음.

## §E.3 Run-phase Audit-Ready Signal

run_audit_ready: true
run_audit_ready_at: 2026-09-05

AC-REVIEW-001~016 전부 PASS(§E.2 매트릭스). `npx tsc --noEmit`/`npm run build`/`npx eslint .` 전부 통과. 커버리지 전역 97.02/93.47/98.97/97.02(85%/80% 기준 상회), 이 SPEC이 추가한 개별 파일도 전부 기준 충족(§E.2 Evidence 참고). subagent boundary grep 0건. plan.md §D PRESERVE 목록 `git diff --stat` 확인 결과 미변경. `tests/unit/components/product-detail-view.test.tsx`의 AC-STOREFRONT-009 단언은 plan.md M3 지시대로 "리뷰" 토큰만 제거하고 `/관련 상품|재고 변동/`로 좁혔으며 여전히 PASS(전체 스위트 110 files / 1478 tests 확인). Tier M plan-audit(§E.1, 0.97 PASS)의 optional 관찰 D9/D10은 지시대로 착수하지 않음. run-audit 준비 완료.

## §E.4 Sync-phase Audit-Ready Signal

sync_status: complete
sync_complete_at: 2026-09-05
sync_commit_sha: pending-backfill-sync-review-001

### Claim

CHANGELOG.md·README.md에 SPEC-REVIEW-001 항목 반영 완료. spec.md frontmatter `status: in-progress → completed`(단일 sync 커밋으로 전이 — Status Transition Ownership Matrix의 `in-progress → implemented → completed`가 이 커밋 하나에 병합됨). 별도 sync-auditor 서브에이전트 실행은 수행하지 않았다(Gaps 참고) — 대신 이 세션이 직접 AC 매트릭스·PRESERVE diff·전체 스위트를 재확인하는 방식으로 독립 검증을 대체했다.

### Evidence (verbatim)

```
$ grep -c "SPEC-REVIEW-001" CHANGELOG.md
2   (헤더 1회 + "알려진 한계" 소제목 1회 — 중복 "추가" 항목 없음)

$ npx vitest run
 Test Files  110 passed (110)
      Tests  1478 passed (1478)

$ npx tsc --noEmit
(no output — exit 0)

$ npx eslint .
(no output — exit 0)
```

### Baseline-attribution

`.claude/worktrees/t36`, 브랜치 `WT-review-rating`, M6 커밋(`7c027a9`) 위에 CHANGELOG.md/README.md/progress.md/spec.md 문서 변경을 얹은 상태에서 실측. 회귀 없음 확인.

### Gaps (미검증)

- **sync-auditor 서브에이전트를 실행하지 않았다.** 이 세션이 이미 워크트리에 anchor된 상태에서 `Agent()`를 spawn하면 별도 worktree로 자동 격리되는 플랫폼 결함(이전 카드 t34에서 관찰·SendFeedback으로 보고됨)이 재현될 위험이 있어, 독립적 skeptical 재검토를 이 세션 스스로 수행하는 것으로 대체했다. 완전히 독립적인(제3자) 감사는 아니다 — 이 점을 lead/sync 검토 시 감안해야 한다.
- `sync_commit_sha`는 이 커밋 자체가 자신의 SHA를 알 수 없어 `pending-backfill-*` 플레이스홀더로 남기고, 다음 커밋에서 실제 SHA로 백필한다(schema 문서의 자기참조 예외 패턴).

### Residual-risk (잔여 위험)

- README/CHANGELOG의 한국어 서술은 이 세션이 직접 작성했다 — 별도 감수자(manager-docs 서브에이전트 등)의 교차검증을 거치지 않았다.
