# Acceptance Criteria: SPEC-CATALOG-001 — 상품 카탈로그 도메인 모델 및 목록/상세 조회 API

> Given-When-Then 형식의 수락 기준(AC-CATALOG-NNN). spec.md의 REQ-CATALOG-NNN 요구사항을 검증 가능한 형태로 구체화한다 — GEARS 요구사항의 재진술이 아니라 각 요구사항의 이진(binary) 검증 시나리오다. 각 AC는 **Traces** 줄로 대상 REQ-CATALOG-NNN을 명시적으로 표기한다.

## §1. 상품 데이터 모델

**AC-CATALOG-001** — 상품 필드 완전성
- **Given** `Category`가 하나 이상 시드되어 있을 때
- **When** 해당 카테고리에 속한 `Product`를 생성하면
- **Then** 생성된 레코드는 `name`, `price`(정수), `description`, `images`(문자열 배열, 1개 이상), `categoryId`, `stock`(정수) 필드를 모두 갖는다.
- **Traces**: REQ-CATALOG-001

**AC-CATALOG-002** — 옵션/변형 필드 부재
- **Given** `prisma/schema.prisma`의 `Product` 모델 정의가 주어졌을 때
- **When** 스키마를 검사하면
- **Then** color/size 등 variant를 표현하는 필드나 별도 variant 테이블이 존재하지 않는다.
- **Traces**: REQ-CATALOG-002

## §2. 접근 제어

**AC-CATALOG-003** — 목록 API 공개 접근
- **Given** 인증 토큰(Authorization 헤더, 쿠키) 없이
- **When** `GET /api/products`를 요청하면
- **Then** 응답은 200이며 401/403이 반환되지 않는다.
- **Traces**: REQ-CATALOG-003

**AC-CATALOG-004** — 상세 API 공개 접근
- **Given** 인증 토큰 없이, 존재하는 상품 id로
- **When** `GET /api/products/:id`를 요청하면
- **Then** 응답은 200이며 401/403이 반환되지 않는다.
- **Traces**: REQ-CATALOG-003

## §3. 목록 API — 페이지네이션

**AC-CATALOG-005** — 기본 페이지네이션
- **Given** 21개 이상의 상품이 존재할 때
- **When** 쿼리 파라미터 없이 `GET /api/products`를 요청하면
- **Then** 응답의 `page`는 1, `pageSize`는 20이며 `items.length`는 최대 20이다.
- **Traces**: REQ-CATALOG-004

**AC-CATALOG-006** — 잘못된 페이지네이션 파라미터 거부 (page/pageSize)
- **Given** `page=0` 또는 `page=-1` 또는 `page=abc`, 또는 `pageSize=0` 또는 `pageSize=-5` 또는 `pageSize=xyz`
- **When** 해당 값으로 `GET /api/products`를 요청하면
- **Then** 두 경우 모두 응답은 400이며, 데이터베이스 조회가 수행되지 않는다(모킹된 repository 호출이 발생하지 않음을 단위 테스트로 확인).
- **Traces**: REQ-CATALOG-005

**AC-CATALOG-007** — pageSize 상한 클램프
- **Given** `pageSize=500`(최댓값 100 초과)
- **When** `GET /api/products`를 요청하면
- **Then** 응답은 400이 아닌 200이며, 실제 적용된 `pageSize`는 100이고 `items.length`는 최대 100이다.
- **Traces**: REQ-CATALOG-006

**AC-CATALOG-008** — 페이지네이션 메타데이터 포함
- **Given** 총 43개의 상품이 존재하고 `pageSize=20`일 때
- **When** `GET /api/products?page=1&pageSize=20`을 요청하면
- **Then** 응답 바디에 `totalCount=43`, `totalPages=3`, `page=1`, `pageSize=20`이 모두 포함된다.
- **Traces**: REQ-CATALOG-007

## §4. 목록 API — 정렬

**AC-CATALOG-009** — 정렬 동작 전체 (지원 값 적용 / 기본값 / 미지원 값 거부)
- **Given** 가격이 서로 다른 상품 3개 이상이 존재할 때, **When** `GET /api/products?sort=price_asc`를 요청하면, **Then** `items`는 `price` 오름차순으로 정렬되어 있다.
- **Given** 가격이 서로 다른 상품 3개 이상이 존재할 때, **When** `GET /api/products?sort=price_desc`를 요청하면, **Then** `items`는 `price` 내림차순으로 정렬되어 있다.
- **Given** 생성 시각이 서로 다른 상품 3개 이상이 존재할 때, **When** `sort` 파라미터 없이 `GET /api/products`를 요청하면, **Then** `items`는 `createdAt` 내림차순(최신순)으로 정렬되어 있다.
- **Given** `sort=popularity`(지원되지 않는 값)일 때, **When** `GET /api/products`를 요청하면, **Then** 응답은 400이다.
- **Traces**: REQ-CATALOG-008, REQ-CATALOG-009

## §5. 목록 API — 카테고리 필터

**AC-CATALOG-010** — 존재하는 카테고리로 필터링
- **Given** `Category` A(slug=`tops`)에 속한 상품 2개, `Category` B(slug=`bottoms`)에 속한 상품 3개가 존재할 때
- **When** `GET /api/products?category=tops`를 요청하면
- **Then** 응답의 모든 `items[].category.slug`는 `tops`이며 개수는 2개다.
- **Traces**: REQ-CATALOG-010

**AC-CATALOG-011** — 존재하지 않는 카테고리는 빈 결과 (오류 아님)
- **Given** slug `nonexistent-category`에 해당하는 `Category`가 존재하지 않을 때
- **When** `GET /api/products?category=nonexistent-category`를 요청하면
- **Then** 응답은 200이며 `items: []`, `totalCount: 0`이다(400/404가 아님).
- **Traces**: REQ-CATALOG-011

## §6. 목록 API — 검색 파라미터 부재

**AC-CATALOG-012** — 검색 파라미터 무시 또는 미지원 확인
- **Given** 상품이 존재할 때
- **When** `GET /api/products?q=검색어` 또는 `GET /api/products?search=검색어`를 요청하면
- **Then** 라우트 핸들러/서비스 코드에 `q`/`search` 파라미터를 처리하는 로직이 존재하지 않는다(정적 검사: 서비스 코드에서 해당 파라미터를 읽는 코드가 없음을 확인) — 즉 검색 파라미터는 조용히 무시되며 전체 목록에 영향을 주지 않는다.
- **Traces**: REQ-CATALOG-012

## §7. 상세 API

**AC-CATALOG-013** — 존재하는 상품 상세 조회
- **Given** id `prod_abc`인 상품이 존재할 때
- **When** `GET /api/products/prod_abc`를 요청하면
- **Then** 응답은 200이며 `name`/`price`/`description`(전체)/`images`/`category`/`stock`이 모두 포함된다.
- **Traces**: REQ-CATALOG-013

**AC-CATALOG-014** — 존재하지 않는 상품 404
- **Given** 존재하지 않는 id `prod_nonexistent`
- **When** `GET /api/products/prod_nonexistent`를 요청하면
- **Then** 응답은 404다.
- **Traces**: REQ-CATALOG-014

**AC-CATALOG-015** — 리뷰/관련상품 필드 부재
- **Given** id `prod_abc`인 상품이 존재할 때
- **When** `GET /api/products/prod_abc`를 요청하면
- **Then** 응답 바디에 `reviews` 또는 `relatedProducts` 키가 존재하지 않는다.
- **Traces**: REQ-CATALOG-015

## §8. 성능 (NFR)

**AC-CATALOG-016** — 목록/상세 API p95 300ms
- **Given** 로컬/CI 환경에서 시드된 상품 데이터(최소 50개 이상)가 준비되어 있을 때
- **When** `GET /api/products`와 `GET /api/products/:id`를 각각 N≥30회 반복 요청하고 응답 시간을 측정하면
- **Then** 두 엔드포인트 모두 p95 응답 시간이 300ms 이내다(SPEC-AUTH-001의 AC-AUTH-005 타이밍 테스트 패턴과 동일한 통계적 측정 방법론을 따른다 — 중앙값/허용오차가 아닌 p95 백분위수 산출).
- **Traces**: REQ-CATALOG-016

## §9. 엣지 케이스

- 상품이 0개인 상태에서 목록 조회 시: 200, `items: []`, `totalCount: 0` (오류가 아님).
- 존재하지 않는 페이지 번호(예: 총 3페이지인데 `page=99`) 요청 시: 200, `items: []` (400이 아님 — 범위를 벗어난 페이지는 빈 결과로 처리).
- `images` 배열이 비어 있는 상품(데이터 이관 초기 상태 등): 목록/상세 API는 오류 없이 빈 배열을 그대로 반환한다(최소 1개 이상은 쓰기 API 책임이며 이번 SPEC은 읽기 전용이므로 방어적으로 처리).
- `stock=0`인 상품: 목록/상세 API에서 제외하지 않고 그대로 노출한다(품절 표시는 프런트엔드 책임, 이번 SPEC 범위 밖).

## §10. 품질 게이트 기준 (Definition of Done)

- [ ] REQ-CATALOG-001~016 전체에 대응하는 AC가 존재하고 모두 PASS.
- [ ] `npx vitest run` — 신규 테스트 전부 통과, 카탈로그 도메인 커버리지 85% 이상(quality.yaml `test_coverage_target`).
- [ ] `npx tsc --noEmit` — exit 0.
- [ ] `npx eslint .` — exit 0.
- [ ] `npx prisma validate` — 스키마 유효성 통과.
- [ ] AC-CATALOG-016(p95 300ms) 측정 결과가 기록되고 임계값을 충족(또는 샌드박스 제약으로 미측정 시 progress.md에 명시적 gap으로 기록 — 조용히 생략하지 않음).
- [ ] `prisma/schema.prisma`의 기존 `User`/`OAuthAccount`/`RefreshToken` 모델에 diff 없음(git diff로 확인).
