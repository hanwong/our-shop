---
id: SPEC-REVIEW-001
title: "인수 기준 — 상품 리뷰 작성 및 평점/후기 표시"
---

# acceptance.md — SPEC-REVIEW-001

Given-When-Then 형식. 각 AC는 이진(binary) 판정 가능해야 한다. GEARS 요구사항(REQ-REVIEW-*)의 재서술이 아니라 그 요구사항이 실제로 관찰 가능한지를 검증하는 시나리오다.

## §A. AC 매트릭스

| AC | REQ 대응 | 시나리오 |
|---|---|---|
| AC-REVIEW-001 | REQ-REVIEW-002 | 정상 작성 → 201 |
| AC-REVIEW-002 | REQ-REVIEW-004, REQ-REVIEW-001 | 중복 작성 → 409 (REQ-REVIEW-001의 "쌍당 최대 1개" 불변식을 행 개수 단언으로 검증) |
| AC-REVIEW-003 | REQ-REVIEW-003 | 세션 없음 → 401 |
| AC-REVIEW-004 | REQ-REVIEW-005 | rating 범위 밖 → 400 |
| AC-REVIEW-005 | REQ-REVIEW-005 | body 빈 문자열 → 400 |
| AC-REVIEW-006 | REQ-REVIEW-006 | 존재하지 않는 productId → 404 |
| AC-REVIEW-007 | REQ-REVIEW-007 | 평균/개수 표시 |
| AC-REVIEW-008 | REQ-REVIEW-007 | 리뷰 0개일 때 미표시 오류 없음 |
| AC-REVIEW-009 | REQ-REVIEW-008 | 비로그인 → 로그인 유도 |
| AC-REVIEW-010 | REQ-REVIEW-008 | 로그인 → 작성 폼 |
| AC-REVIEW-011 | REQ-REVIEW-009 | 리뷰 목록 최신순 |
| AC-REVIEW-012 | REQ-REVIEW-010 | 홈 그리드에 평점 배지 없음 |
| AC-REVIEW-013 | (품질 게이트) | 서버 렌더링 소스 스캔 유지 |
| AC-REVIEW-014 | REQ-REVIEW-012 | admin 계정도 구매 무관 작성 가능 |
| AC-REVIEW-015 | REQ-REVIEW-011 | 수정/삭제/모더레이션 API·UI 부재 |
| AC-REVIEW-016 | REQ-REVIEW-004 | 레이스 컨디션 P2002 → 409 매핑 (service-level mock) |

## §B. 시나리오

**AC-REVIEW-001**
Given 로그인한 고객이 상품 P를 아직 리뷰하지 않았다,
When `POST /api/reviews`에 `{productId: P, rating: 4, body: "..."}`를 보낸다,
Then 응답은 201이고, (userId, productId)=(그 고객, P)인 Review 행이 정확히 1개 생성된다.

**AC-REVIEW-002**
Given 로그인한 고객이 상품 P에 이미 리뷰를 작성했다,
When 같은 고객이 상품 P에 대해 다시 `POST /api/reviews`를 호출한다,
Then 응답은 409이고, 그 (userId, productId) 쌍의 Review 행 개수는 여전히 1이다.

**AC-REVIEW-003**
Given 유효한 세션 쿠키가 없다(비로그인),
When `POST /api/reviews`를 직접 호출한다,
Then 응답은 401이고, Review 행이 생성되지 않는다.

**AC-REVIEW-004**
Given 로그인한 고객,
When `POST /api/reviews`에 `rating: 6`(또는 `0`, `-1`, 소수)을 보낸다,
Then 응답은 400이고 본문이 "rating" 필드를 유효하지 않다고 명시하며, Review 행이 생성되지 않는다.

**AC-REVIEW-005**
Given 로그인한 고객,
When `POST /api/reviews`에 `body: ""`(또는 공백만)을 보낸다,
Then 응답은 400이고 본문이 "body" 필드를 유효하지 않다고 명시하며, Review 행이 생성되지 않는다.

**AC-REVIEW-006**
Given 존재하지 않는 productId,
When 로그인한 고객이 그 productId로 `POST /api/reviews`를 호출한다,
Then 응답은 404이고, Review 행이 생성되지 않는다.

**AC-REVIEW-007**
Given 상품 P에 평점 [5, 4, 3]인 리뷰 3개가 존재한다,
When 상품 P의 상세 페이지를 렌더링한다,
Then 평균 평점 4.0과 리뷰 개수 3이 표시된다.

**AC-REVIEW-008**
Given 상품 Q에 리뷰가 0개다,
When 상품 Q의 상세 페이지를 렌더링한다,
Then 렌더링이 예외 없이 완료된다. 빈 상태 메시지의 정확한 한국어 문구는 이 AC가 규정하지 않는다 — 어떤 한국어 문구든 다음 두 조건만 충족하면 통과로 판정한다: (1) 평균 평점 수치가 표시되지 않는다(내부적으로 `null`이거나 렌더링에서 생략됨), (2) 리뷰 개수는 명시적으로 0으로 표시된다.

**AC-REVIEW-009**
Given 세션 쿠키가 없는 방문자,
When 상품 상세 페이지를 렌더링한다,
Then 리뷰 작성 폼 대신 `/login`으로 연결되는 "로그인하고 리뷰 남기기" 문구가 표시된다.

**AC-REVIEW-010**
Given 로그인한 고객,
When 상품 상세 페이지를 렌더링한다,
Then 로그인 유도 문구 대신 `ReviewForm` 클라이언트 아일랜드가 표시된다.

**AC-REVIEW-011**
Given 상품 P에 서로 다른 시각에 작성된 리뷰 여러 개가 존재한다,
When 상품 P의 상세 페이지가 리뷰 목록을 렌더링한다,
Then 목록은 `createdAt` 내림차순(최신 작성 먼저)으로 정렬되어 있다.

**AC-REVIEW-012**
Given 홈 라우트(`/`)의 상품 그리드,
When 임의의 상품에 대해 `ProductCard`가 렌더링된다,
Then 렌더링된 마크업 어디에도 평점 배지나 리뷰 개수 텍스트가 없다.

**AC-REVIEW-013**
Given `tests/unit/app/product-detail-page.test.tsx`의 기존 "no client fetch/useEffect on first render" 소스 스캔 단언,
When 이 SPEC이 추가한 상품 상세 페이지/`ProductDetailView.tsx` 콘텐츠에 대해 그 스캔을 다시 실행한다,
Then `ReviewForm.tsx`(별도 클라이언트 아일랜드로 명시적으로 예외 처리됨)를 제외한 서버 렌더링 경로에서 클라이언트 전용 fetch/useEffect가 발견되지 않는다.

**AC-REVIEW-014**
Given 로그인한 admin 역할 계정,
When 그 계정이 상품 P에 대해 `POST /api/reviews`를 호출한다(P를 아직 리뷰하지 않은 상태),
Then 고객 계정과 동일하게 201로 성공한다 — 역할에 따른 추가 게이트나 구매 여부 검증이 없다.

**AC-REVIEW-015**
Given `src/app/api/reviews/route.ts`와 관리자 백오피스 코드(`SPEC-ADMIN-002`/`SPEC-ADMIN-003` 범위, `src/app/admin/**`),
When 그 라우트 파일이 export하는 HTTP 메서드 핸들러 목록과 관리자 백오피스의 화면 목록을 확인한다,
Then `route.ts`는 `POST` 핸들러만 export하고 `PATCH`/`DELETE`/`PUT` 핸들러는 존재하지 않으며, 관리자 백오피스 어디에도 리뷰 수정·삭제·모더레이션 UI가 추가되지 않는다.

**AC-REVIEW-016**
Given `review-repository.ts`의 `create()`가 Prisma 고유 제약 위반(`P2002`) 에러를 던지도록 모킹된 상태(사전 중복 조회 `findByUserAndProduct()`는 통과하도록 설정),
When `review-service.ts`의 `createReview()`를 호출한다,
Then 그 `P2002` 에러가 처리되지 않은 예외로 그대로 전파되지 않고, 구조화된 409-매핑 가능 실패 객체로 반환된다.

## §C. 엣지 케이스

- 동시에 같은 (user, product) 쌍으로 두 요청이 경합하면, `@@unique([userId, productId])` DB 제약이 최종 방어선이 되어 하나는 409(또는 그에 준하는 제약 위반 매핑)로 귀결되어야 한다 — 애플리케이션 레벨 사전 조회만으로는 레이스를 막을 수 없다는 점을 서비스 구현 시 반드시 반영한다. 이 요구사항은 edge-case 서술에 그치지 않고 `plan.md` M2의 명시적 구현 지시("P2002 catch → 구조화된 409 실패 객체")와 AC-REVIEW-016(§B)의 formal한 이진 테스트로 뒷받침된다.
- `body`에 매우 긴 텍스트(수만 자)가 들어오는 경우: 서비스 레이어에서 상한을 두고 초과 시 400으로 거부한다. 이 상한값은 `plan.md` M2에서 **최대 2000자(trim 후)**로 명시적으로 확정했다 — 이 문서는 그 결정을 인용만 하며, 값 자체의 SSOT는 `plan.md` M2다.

## §D. 품질 게이트 / 완료 정의 (Definition of Done)

- AC-REVIEW-001~016 전부 PASS.
- `npx tsc --noEmit` 통과, `npm run build` 통과.
- 커버리지: 프로젝트 전역 기준(lines/functions/statements 85%, branches 80%) 이 SPEC이 추가한 파일에도 동일하게 적용.
- `git diff`가 plan.md §D(PRESERVE)에 명시된 파일을 건드리지 않았음을 확인.
- CHANGELOG 항목은 sync-phase(manager-docs)에서 작성 — 이 SPEC의 run-phase 완료 정의에는 포함되지 않는다.
