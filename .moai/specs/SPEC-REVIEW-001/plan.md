---
id: SPEC-REVIEW-001
title: "구현 계획 — 상품 리뷰 작성 및 평점/후기 표시"
---

# plan.md — SPEC-REVIEW-001

## §A. 컨텍스트

- 작업 위치: `.claude/worktrees/t36` (브랜치 `WT-review-rating-purchase`)
- 선행 조건: `SPEC-AUTH-002`(`status: completed`)가 main에 머지되어 `resolveSession()`이 이 워크트리에 존재해야 한다 — 착수 전 `src/lib/auth/session-resolver.ts` 존재를 재확인한다.
- Tier: **M** (300-1000 LOC 추정, 8개 구현 파일 + 5개 테스트 파일 = 13개 파일, REQ/AC 예산 16/16 이내로 12/16 사용).
- 이 SPEC은 `spec.md` §1에서 이미 상세히 근거를 밝힌 결정들을 전제로 한다 — 이 문서는 "무엇을, 어떤 순서로 구현하는가"에 집중한다.

## §B. 마일스톤 — 되돌리기 어려운 결정 순서로 정렬

되돌리기 어려운 결정(데이터 모델, 새 타입 인터페이스, 사용자 노출 흐름)을 앞에 배치하고, 기계적/보일러플레이트 작업을 뒤로 미룬다.

### M1 — 데이터 모델 확정 (가장 되돌리기 어려움)

- `prisma/schema.prisma`: `User`(29-45행)·`Product`(107-141행)에 `reviews Review[]` 역참조 추가, `Product` 모델 직후에 신규 `model Review { ... }` 블록 추가(spec.md §1의 스키마 그대로).
- `@@unique([userId, productId])` + `@@index([productId])`.
- 마이그레이션 생성 및 적용. 기존 데이터에 영향 없음(신규 테이블).
- **왜 먼저인가**: 스키마 필드명/관계 방향은 이후 모든 레이어(repository/service/route/컴포넌트)의 타입을 고정한다. 여기서 바뀌면 하위 전체가 다시 쓰인다.

### M2 — 서비스 계약 확정 (두 번째로 되돌리기 어려움)

- `src/features/reviews/types/review.ts`: `CreateReviewInput`, `Review`, `ReviewAggregate`(`{averageRating: number | null, count: number}`) 타입 정의.
- `src/features/reviews/repositories/review-repository.ts`: `create()`, `findByUserAndProduct()`, `listByProduct()`, `aggregateByProduct()`.
- `src/features/reviews/services/review-service.ts`: `createReview(userId, input)` — rating 1-5 검증, body 비어있음 검증, **body 길이 상한 검증(아래 명시)**, productId 존재 검증(카탈로그 리포지토리 또는 직접 Prisma 조회), 중복 검증(사전 조회) → 실패 시 구조화된 실패 객체(design.md 없이 이 문서가 계약을 겸함) 반환. `getProductReviewSummary(productId)` — 집계 + 목록을 함께 반환.
- **body 길이 상한 (명시적 결정)**: `body`는 trim 후 비어있지 않아야 하고, trim 후 **최대 2000자**를 넘으면 400으로 거부한다(`acceptance.md` §C 엣지 케이스가 예시로 든 "수만 자" 방지책을 이 값으로 확정한다). 이 상한은 DB 제약이 아니라 `review-service.ts`의 검증 로직에서 수행한다 — rating 범위 검증과 동일한 위치.
- **레이스-세이프 중복 방지 (명시적 구현 지시)**: 중복 검증은 `findByUserAndProduct()` 사전 조회 하나만으로 끝내지 않는다. `create()` 호출 자체를 try/catch로 감싸 Prisma 고유 제약 위반(`error.code === "P2002"`, `@@unique([userId, productId])`)을 감지하면, 사전 조회가 통과했더라도 이를 구조화된 409-매핑 가능 실패 객체로 변환해 반환한다 — 동시 요청 레이스에서는 사전 조회만으로 중복을 막을 수 없으므로(spec.md §1), 이 P2002 catch가 최종 방어선이다. `route.ts`(M4)는 이 실패 객체를 그대로 409로 매핑한다.
- **왜 두 번째인가**: 에러 코드/실패 셰이프(400/401/404/409의 판정 기준과 우선순위 — spec.md REQ-REVIEW-003~006)는 API 라우트와 페이지 양쪽이 그대로 소비하는 계약이다. 여기서 확정하지 않으면 라우트와 페이지가 서로 다른 판정을 내릴 위험이 있다.

### M3 — 상품 상세 페이지 흐름 변경 (사용자 노출 흐름)

- `src/app/products/[productId]/page.tsx`: `resolveSession(cookies())` 호출 추가, 그 결과(로그인 여부)를 `ProductDetailView`에 전달. "Anonymous by design" 주석을 사실에 맞게 갱신.
- `src/components/product/ProductDetailView.tsx`: 설명 문단 다음에 리뷰 섹션 삽입 — 평균/개수(REQ-REVIEW-007), 리뷰 목록(REQ-REVIEW-009), 그리고 로그인 여부에 따라 `ReviewForm` 또는 로그인 유도 링크(REQ-REVIEW-008)를 분기 렌더링. 리뷰 `body`는 항상 일반 JSX 텍스트 자식으로 렌더링한다(`{review.body}`) — `dangerouslySetInnerHTML`이나 원시 HTML 삽입을 사용하지 않는다. React의 JSX 텍스트 자식은 기본적으로 이스케이프되므로 별도 sanitize 라이브러리 없이 저장형 XSS를 방지한다.
- **기존 회귀 테스트 조정(필수)**: `tests/unit/components/product-detail-view.test.tsx`의 `describe("ProductDetailView — AC-STOREFRONT-009", ...)` 블록은 `expect(text).not.toMatch(/리뷰|관련 상품|재고 변동/)`를 단언한다. 이 SPEC이 리뷰 섹션을 추가하면 "리뷰" 토큰 매치가 필연적으로 실패한다. 이 테스트를 다음과 같이 조정한다: 정규식에서 "리뷰" 토큰만 제거하고 `/관련 상품|재고 변동/`으로 좁힌다 — 그 두 항목(관련 상품, 재고 변동 이력)은 이 SPEC 범위 밖이며 여전히 부재해야 하므로 그 부재 단언은 그대로 유지한다. "리뷰" 부재 단언 삭제는 회귀가 아니라 REQ-REVIEW-007/008/009가 REQ-STOREFRONT-009를 의도적으로 승계한 결과임을 테스트 파일의 `describe`/주석에 한 줄로 남긴다(spec.md §1 참고).
- **왜 세 번째인가**: 이 컴포넌트가 세션 여부를 어떤 형태(prop? 별도 조회?)로 받을지가 M4의 `ReviewForm` 설계와 M5 테스트의 "서버 렌더링 유지" 검증 기준을 결정한다.

### M4 — 쓰기 경로: API 라우트 + 클라이언트 아일랜드

- `src/app/api/reviews/route.ts`: `POST` 전용. `resolveSession(cookies())` → 401 분기(REQ-REVIEW-003) → 본문 파싱 실패 400 → `createReview()` 호출 → 서비스 실패 셰이프를 status 코드로 매핑(400/404/409) → 성공 시 201.
- `src/components/product/ReviewForm.tsx`(`"use client"`): 별점 입력(1-5) + 텍스트 body + 제출 버튼. `useState`로 loading/error 관리(`AddToCartButton`/로그인 폼과 동일한 관용구). 성공 시 `router.refresh()`로 서버 렌더링된 리뷰 섹션을 다시 그린다(별도의 클라이언트 측 목록 상태를 만들지 않는다 — constitution Enforce Simplicity).
- **왜 네 번째인가**: API 계약(M2)과 페이지 분기(M3)가 고정된 뒤에야 폼이 무엇을 호출하고 성공 후 무엇을 갱신할지가 명확해진다.

### M5 — 테스트 배선

- `tests/unit/features/reviews/review-service.test.ts` — M2 서비스의 rating/body/중복/미존재 상품 판정.
- `tests/unit/api/reviews/route.test.ts` — 401/400/404/409/201, 리포지토리 seam에서 `vi.mock`(기존 `tests/unit/api/products/route.test.ts` 관례).
- `tests/unit/app/product-detail-page.test.tsx`(또는 신규 sibling 파일) — 로그인/비로그인 분기, 평균/개수 표시, "no client fetch/useEffect" 소스 스캔 통과(단 `ReviewForm.tsx`는 `AddToCartButton.tsx`와 동일하게 스캔 대상에서 제외).
- `ReviewForm.tsx` 프레젠테이션 레벨 테스트(loading/error 상태).
- **왜 다섯 번째인가**: 앞선 4개 마일스톤의 실제 시그니처가 고정된 뒤에야 목(mock) 대상과 단언(assert) 내용이 안정적으로 정해진다.

### M6 — 마무리 (가장 기계적)

- `@MX` 주석 부착(신규 export 함수, `Review` 모델 fan-in 여부 재확인).
- CHANGELOG는 sync-phase(manager-docs) 소관 — 여기서 작성하지 않는다.

## §C. 기술 접근

- **레이어링**: `src/features/reviews/{repositories,services,types}` 관례를 그대로 따른다(catalog/cart/orders/admin과 동일 — structure.md가 이미 이 경로를 예약).
- **읽기는 직접 호출, 쓰기만 HTTP**: 상세 페이지는 `getProductReviewSummary()`를 직접 호출하고, 클라이언트 폼만 `POST /api/reviews`를 호출한다(spec.md §1).
- **집계는 라이브 쿼리**: `prisma.review.aggregate()`를 상세 페이지 렌더링마다 호출한다 — 비정규화 컬럼 없음(spec.md §1의 명시적 결정).
- **검증은 서비스 레이어**: rating 범위, body 비어있음 검사는 DB 제약이 아니라 `review-service.ts`에서 수행(기존 `Product.stock`/`price` 관례와 동일).

## §D. 제약 (PRESERVE)

- `resolveAdminSession`(`src/features/admin/services/admin-session.ts`)은 수정하지 않는다.
- `POST /api/orders`(`src/app/api/orders/route.ts`)의 회원 체크아웃 거부 로직은 수정하지 않는다.
- `src/app/page.tsx` / `ProductGrid` / `ProductCard`(SPEC-STOREFRONT-003)는 수정하지 않는다(REQ-REVIEW-010).
- `AddToCartButton.tsx`, `ProductGallery.tsx`는 수정하지 않는다 — `ProductDetailView.tsx`에서 이들의 렌더 순서(갤러리 → 이름 → 카테고리 → 가격 → 재고 → 장바구니버튼 → 설명)는 그대로 두고, 그 뒤에만 추가한다.
- Prisma 스키마의 기존 모델/필드/관계 방향은 변경하지 않는다 — `reviews Review[]` 역참조 2곳 추가와 `Review` 모델 신설만 한다.

## §E. 자기검증 체크리스트 (run-phase에서 채움)

- [ ] AC-REVIEW-001~016 전부 PASS/FAIL 매트릭스로 보고
- [ ] `go`/`npm` 빌드 아님 — `npm run build` + `npx tsc --noEmit` 통과
- [ ] 커버리지 85%/80%(branch) 프로젝트 기준 충족
- [ ] subagent boundary grep(AskUserQuestion 미사용) 통과
- [ ] product-detail-page 소스 스캔(서버 렌더링 유지, `ReviewForm.tsx` 제외) 통과
- [ ] `tests/unit/components/product-detail-view.test.tsx`의 AC-STOREFRONT-009 단언이 `/관련 상품|재고 변동/`으로 조정되어 여전히 PASS함을 확인 (M3 참고)

## §F. 이 SPEC이 건드리는 파일 목록

| 파일 | 상태 |
|---|---|
| `prisma/schema.prisma` | 수정 |
| `src/features/reviews/repositories/review-repository.ts` | 신규 |
| `src/features/reviews/services/review-service.ts` | 신규 |
| `src/features/reviews/types/review.ts` | 신규 |
| `src/app/api/reviews/route.ts` | 신규 (POST만) |
| `src/components/product/ProductDetailView.tsx` | 수정 |
| `src/components/product/ReviewForm.tsx` | 신규 |
| `src/app/products/[productId]/page.tsx` | 수정 |
| `tests/unit/components/product-detail-view.test.tsx` | 수정 (AC-STOREFRONT-009 "리뷰" 부재 단언을 `/관련 상품|재고 변동/`으로 조정 — M3 참고) |
| `tests/unit/features/reviews/review-service.test.ts` | 신규 |
| `tests/unit/api/reviews/route.test.ts` | 신규 |
| `tests/unit/app/product-detail-page.test.tsx` (또는 sibling) | 수정/신규 |
| `tests/unit/components/product/review-form.test.tsx` | 신규 |

## §G. 안티패턴 회피

- `GET /api/reviews`를 만들지 않는다 — 서버 컴포넌트가 서비스로 직접 읽는다(spec.md §1).
- `averageRating`/`reviewCount` 비정규화 컬럼을 추가하지 않는다.
- 리뷰 편집/삭제/모더레이션 UI를 "나중에 필요할 것 같아서" 미리 만들지 않는다(constitution Scope Discipline).
- rating 범위를 DB CHECK 제약으로 만들지 않는다 — 이 스키마의 기존 관례(app-layer 검증만)를 따른다.

## §H. 교차 참조

- spec.md §1(설계 근거), §3(범위 제외), §4(교차 SPEC)
- acceptance.md(AC-REVIEW-001~016)
- `.claude/rules/moai/development/manager-develop-prompt-template.md` § Applicability — Tier M이므로 run-phase 위임 시 Section A-E 템플릿 적용 권장
