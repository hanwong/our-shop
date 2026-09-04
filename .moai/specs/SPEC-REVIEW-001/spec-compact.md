# SPEC-REVIEW-001 — 압축 요약

**한 줄 요약**: 로그인한 고객/admin이 상품마다 별점(1-5)+텍스트 후기 1개를 작성하고, 상품 상세 페이지에 평균 평점·개수·목록을 표시. 미로그인 방문자는 로그인 유도 문구를 본다.

## 핵심 결정
- 인증 기준: **로그인 여부만**(구매 인증 아님) — `resolveSession()`(SPEC-AUTH-002) 소비.
- 구매 인증 배지: **범위 밖** — 회원 체크아웃 자체가 `POST /api/orders`에서 409로 거부되어 구현 불가.
- 리뷰 1인 1상품: `@@unique([userId, productId])`, 재작성 시도는 409(수정 아님).
- 표시 위치: 상품 상세 페이지만(홈 그리드 제외).
- 편집/삭제/관리자 모더레이션: 없음.
- 평균/개수: 라이브 `prisma.review.aggregate()`(비정규화 컬럼 아님).

## 파일 (8 구현 + 5 테스트)
`prisma/schema.prisma`(수정) · `src/features/reviews/{repositories,services,types}/*`(신규) · `src/app/api/reviews/route.ts`(신규, POST만) · `src/components/product/ProductDetailView.tsx`(수정) · `src/components/product/ReviewForm.tsx`(신규) · `src/app/products/[productId]/page.tsx`(수정) + `tests/unit/components/product-detail-view.test.tsx`(수정, AC-STOREFRONT-009 조정) + 4개 신규 테스트 파일.

## REQ/AC
REQ-REVIEW-001~012 (GEARS, spec.md §2) · AC-REVIEW-001~016 (Given-When-Then, acceptance.md).

## 의존/관련
- `depends_on`: SPEC-AUTH-002 (`resolveSession()`)
- `related_specs`: SPEC-CATALOG-001(예고), SPEC-STOREFRONT-001(REQ-STOREFRONT-009 대체 대상), SPEC-STOREFRONT-003(그리드, 미변경), SPEC-ORDER-001(구매 인증 배제 근거)
- 미래: "회원 체크아웃" SPEC(미확정 ID) → 구매 인증 재검토의 전제.

## Tier
M (3파일: spec.md + plan.md + acceptance.md; spec-compact.md/progress.md는 Tier와 무관하게 이 SPEC에서 별도 요청됨).
