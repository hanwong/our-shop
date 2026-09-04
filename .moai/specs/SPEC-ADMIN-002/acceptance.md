# Acceptance: SPEC-ADMIN-002 — 관리자 상품 등록/수정 백오피스

REQ-ADMIN-019 ~ 041의 23개 요구사항에 대응하는 **24개 AC**(REQ-ADMIN-021만 AC-ADMIN-021a/021b로 분할되어 2건, 나머지 22개 REQ는 1:1). Tier L 상한(25) 이내. 각 AC는 Given-When-Then으로 쓰며, 판정은 이진(통과/실패)이다.

---

## §A. 스키마

### AC-ADMIN-019 (REQ-ADMIN-019)

- **Given** 상품 여러 행이 이미 들어 있는 데이터베이스에서
- **When** 이 SPEC의 마이그레이션을 적용하면
- **Then** `Product`에 판매 가능 여부 불리언 컬럼이 생기고, 마이그레이션 이전부터 존재하던 모든 행의 그 값이 `true`이며, 다른 어떤 컬럼의 값도 바뀌지 않는다.

### AC-ADMIN-020 (REQ-ADMIN-020)

- **Given** 이 SPEC이 추가한 전체 소스 트리에서
- **When** `prisma.product.delete` / `prisma.product.deleteMany` 호출을 검색하면
- **Then** 일치하는 호출이 0건이고, `prisma/schema.prisma`의 `CartItem.product`(`onDelete: Cascade`)와 `OrderItem.product`(`onDelete: Restrict`) 선언의 diff가 0줄이다.

## §B. 관리자 상품 목록

### AC-ADMIN-021a (REQ-ADMIN-021 — 중단 상품 포함)

- **Given** 판매 중인 상품 2개와 판매 중단된 상품 1개가 있고 유효한 관리자 세션이 주어진 상태에서
- **When** 관리자 상품 목록에 진입하면
- **Then** 응답에 3개 상품이 모두 포함되고, 각 행이 이름·가격·재고·카테고리·판매 가능 여부를 담고 있으며, 판매 중단된 상품이 화면상 구분 가능하게 표시된다.

### AC-ADMIN-021b (REQ-ADMIN-021 세션 게이팅 · REQ-ADMIN-037 실패 사유 은닉)

- **Given** 관리자 세션 쿠키가 없거나, 만료·폐기되었거나, `role`이 `admin`이 아닌 요청이 주어진 상태에서
- **When** 관리자 상품 목록에 진입하면
- **Then** 어떤 상품 데이터도 조회·렌더되지 않고 로그인 화면으로 리다이렉트되며, 네 가지 실패 사유가 응답상 서로 구별되지 않는다.

### AC-ADMIN-022 (REQ-ADMIN-022)

- **Given** 서로 다른 카테고리에 속한 상품들과 이름이 다른 상품들이 있는 상태에서
- **When** 관리자 상품 목록을 카테고리 값 또는 검색어와 함께 요청하면
- **Then** 그 조건에 일치하는 상품만 반환되고, 응답이 보고하는 전체 개수도 같은 조건으로 계산된 값이다.

### AC-ADMIN-023 (REQ-ADMIN-023)

- **Given** 관리자 상품 목록에서
- **When** 페이지 파라미터를 생략하거나, 정수가 아닌 값·1 미만·`MAX_PAGE_SIZE` 초과 값으로 요청하면
- **Then** `SPEC-ADMIN-001`이 쓰는 `DEFAULT_PAGE`/`DEFAULT_PAGE_SIZE`/`MAX_PAGE_SIZE` 상수와 동일한 기본값·클램프 규칙이 적용되고(거부가 아니라 보정), 그 상수는 `src/features/admin/types/admin.ts`에서 import된 것이지 새로 선언된 값이 아니다.

## §C. 상품 등록·수정

### AC-ADMIN-024 (REQ-ADMIN-024)

- **Given** 유효한 관리자 세션과 실존하는 카테고리가 주어진 상태에서
- **When** 이름·설명·가격·재고·카테고리·이미지 URL 목록을 담은 유효한 신규 상품 요청을 보내면
- **Then** 그 값들을 가진 새 상품 행이 정확히 1개 생성되고, 그 행의 판매 가능 여부가 `true`다.

### AC-ADMIN-025 (REQ-ADMIN-025)

- **Given** 기존 상품 1개와 유효한 관리자 세션이 주어진 상태에서
- **When** 이름·설명·가격·재고·카테고리·이미지 목록을 모두 다른 값으로 바꾼 유효한 수정 요청을 보내면
- **Then** 그 상품 행의 여섯 필드가 제출된 값으로 갱신되고, 상품 행 개수는 변하지 않으며, 판매 가능 여부는 요청 전과 동일하다.

### AC-ADMIN-026 (REQ-ADMIN-026)

- **Given** 유효한 관리자 세션이 주어진 상태에서
- **When** 가격을 `0`·음수·소수·숫자 아닌 값으로, 또는 재고를 음수·소수·숫자 아닌 값으로, 또는 이름이나 설명을 빈 문자열·공백만으로 채운 요청을 각각 보내면
- **Then** 모든 경우가 거부되고, 가격 `1`·재고 `0`은 각각 허용된다.

### AC-ADMIN-027 (REQ-ADMIN-027)

- **Given** 유효한 관리자 세션이 주어진 상태에서
- **When** 이미지 목록을 빈 배열로 보내면 요청이 허용되고, 목록에 URL이 아닌 문자열이나 문자열 아닌 항목이 하나라도 섞여 있으면
- **Then** 그 요청은 거부되며, 유효한 URL만으로 이루어진 목록은 배열 순서 그대로 저장된다.

### AC-ADMIN-028 (REQ-ADMIN-028)

- **Given** 이 SPEC이 추가한 전체 소스 트리에서
- **When** 멀티파트/파일 업로드 처리와 외부 스토리지 클라이언트 사용을 검색하고 `package.json`의 의존성 목록을 확인하면
- **Then** 업로드 처리 코드가 0건이고, 이 SPEC으로 추가된 의존성이 0건이며, 이미지 입력 경로가 텍스트 URL 입력 하나뿐이다.

### AC-ADMIN-029 (REQ-ADMIN-029)

- **Given** 상품 등록·수정 화면이 주어진 상태에서
- **When** 화면을 렌더하면 카테고리 입력이 실존하는 `Category` 행만 나열하는 선택 입력으로 표시되고, 존재하지 않는 카테고리 식별자를 담은 요청을 API로 직접 보내면
- **Then** 그 요청은 거부되며 어떤 상품 행도 생성·갱신되지 않는다.

### AC-ADMIN-030 (REQ-ADMIN-030)

- **Given** 상품 행 개수와 각 행의 내용을 기록해 둔 상태에서
- **When** AC-ADMIN-026·027·029가 거부하는 요청들을 순서대로 보내면
- **Then** 매 요청 후 상품 행 개수와 모든 행의 내용이 기록해 둔 것과 동일하고, 각 응답이 어느 입력이 문제인지 식별 가능한 정보를 담고 있다.

## §D. 판매 중단과 복구

### AC-ADMIN-031 (REQ-ADMIN-031)

- **Given** 판매 중이고 이름·가격·재고·이미지·카테고리 값이 기록된 상품 1개와 유효한 관리자 세션이 주어진 상태에서
- **When** 그 상품의 판매 중단을 요청하면
- **Then** 상품 행이 여전히 존재하고, 판매 가능 여부만 `false`로 바뀌었으며, 기록해 둔 다섯 값이 모두 변하지 않았다.

### AC-ADMIN-032 (REQ-ADMIN-032)

- **Given** 판매 중단된 상품 1개와 유효한 관리자 세션이 주어진 상태에서
- **When** 그 상품의 복구를 요청하면
- **Then** 판매 가능 여부가 `true`로 돌아오고, 그 이후 고객 대면 목록·상세에서 다시 조회된다.

### AC-ADMIN-033 (REQ-ADMIN-033)

- **Given** 어떤 상품이 장바구니 항목 1개 이상과 주문 항목 1개 이상에서 참조되고 있는 상태에서
- **When** 그 상품의 판매 중단을 요청하면
- **Then** 요청이 성공하고, 그 상품을 참조하던 `CartItem` 행과 `OrderItem` 행의 개수와 내용이 모두 변하지 않는다.

## §E. 고객 대면 카탈로그 확장

### AC-ADMIN-034 (REQ-ADMIN-034)

- **Given** 판매 중인 상품 3개와 판매 중단된 상품 2개가 있는 상태에서
- **When** 고객 대면 상품 목록을 조회하면
- **Then** 판매 중인 3개만 반환되고, 응답이 보고하는 전체 개수가 `3`이며(`5`가 아니며), 카테고리·검색 필터를 함께 걸었을 때도 목록과 개수가 같은 모집단을 센다.

### AC-ADMIN-035 (REQ-ADMIN-035)

- **Given** 판매 중단된 상품 1개가 있는 상태에서
- **When** 그 상품의 식별자로 고객 대면 상세를 조회하면
- **Then** "찾을 수 없음" 결과가 반환되고 그 상품의 어떤 필드도 응답에 담기지 않으며, 같은 식별자를 가진 주문 항목의 상품명·단가는 주문 이력 조회에서 여전히 정상적으로 표시된다.

### AC-ADMIN-036 (REQ-ADMIN-036)

- **Given** 확장 전후의 `src/features/catalog/repositories/product-repository.ts`에서
- **When** diff를 확인하면
- **Then** `findProductsPage`/`findProductById`의 시그니처, `LIST_SELECT`, `DETAIL_SELECT`, `SORT_ORDER_BY`, `skip`/`take` 산술의 diff가 0줄이고, 변경이 `where`에 `isActive: true`를 더한 것과 `findUnique`를 `findFirst`로 치환한 것으로 한정되며, `src/features/catalog/services/product-service.ts`의 diff가 0줄이고, 고객 대면 목록·상세 응답 본문에 판매 가능 여부 필드가 존재하지 않는다.

## §F. 경계와 보안

### AC-ADMIN-037 (REQ-ADMIN-037)

- **Given** 이 SPEC이 추가한 전체 소스 트리에서
- **When** 관리자 판정 로직을 검색하면
- **Then** 모든 관리자 상품 화면·API가 `resolveAdminSession`을 import해 사용하고 있고, 리프레시 토큰 쿠키를 직접 읽거나 `User.role`을 직접 조회하는 새 코드가 0건이며, `src/features/admin/services/admin-session.ts`의 diff가 0줄이다.

### AC-ADMIN-038 (REQ-ADMIN-038)

- **Given** 관리자 화면을 정상적으로 연 뒤 관리자 세션이 무효화된(폐기 또는 만료) 상태에서
- **When** 생성·수정·판매 중단·복구 요청을 각각 보내면
- **Then** 네 요청 모두 거부되고 어떤 상품 행도 생성·갱신되지 않으며, 각 라우트 핸들러가 요청마다 `resolveAdminSession`을 새로 호출한다.

### AC-ADMIN-039 (REQ-ADMIN-039 — CSRF 선행 검증 + 실패 응답 모양 동일)

- **Given** 유효한 관리자 세션 쿠키는 가졌으나 CSRF 헤더가 없거나 쿠키 값과 다른 요청이 주어진 상태에서
- **When** 생성·수정·판매 중단·복구 요청을 각각 보내면
- **Then** 네 요청 모두 거부되고, 거부 시점에 데이터베이스 접근이 한 번도 일어나지 않았으며, CSRF 실패 응답이 세션 실패 응답과 상태 코드·본문 모양에서 구별되지 않는다.

### AC-ADMIN-040 (REQ-ADMIN-040)

- **Given** 이 SPEC이 추가한 라우트 파일 전체에서
- **When** 경로를 확인하면
- **Then** 모든 관리자 화면이 `/staff` 하위에, 모든 관리자 쓰기 API가 `/admin/api` 하위에 있고, `/admin` 하위에 페이지 파일이 0건이다.

### AC-ADMIN-041 (REQ-ADMIN-041)

- **Given** 이 SPEC의 전체 변경분에서
- **When** PRESERVE 목록(plan.md §3)의 파일들에 대해 diff를 확인하고, 완료된 SPEC이 소유한 파일 중 변경된 것을 전부 열거하면
- **Then** PRESERVE 목록의 모든 파일에서 diff가 0줄이고, 완료된 SPEC 소유 파일 중 변경된 것이 **spec.md §1 "확장하는 계약" 표의 6개 파일**(`prisma/schema.prisma`, `src/features/catalog/repositories/product-repository.ts`, `src/features/admin/types/admin.ts`, `tests/unit/catalog/product-repository.test.ts`, `tests/unit/catalog/query-surface.test.ts`, `tests/integration/catalog/search.test.ts`) 뿐이며, 그 6개가 plan.md §3 EXTEND 표의 6개 항목과 정확히 일치한다(REQ-ADMIN-041의 예외 조항이 가리키는 것과 같은 경계·같은 단위).

---

## §G. 품질 게이트 / Definition of Done

- 위 24개 AC가 모두 통과한다.
- `npm run typecheck` 종료 코드 0.
- `npm run lint` 종료 코드 0.
- `npm test` 종료 코드 0 — **특히 카탈로그·장바구니·주문·결제 스위트에 신규 실패가 0건**이어야 한다(고객 대면 확장의 회귀 여부를 이 조건이 판정한다).
- `tests/unit/catalog/product-repository.test.ts`의 갱신된 기댓값 **9건**(`findProductsPage`의 `where` `toEqual` 6건 + `findUnique`→`findFirst` 치환에 묶인 상세 테스트 3건 — design.md §3의 두 표가 개별로 열거한다)이 각각 이 SPEC의 REQ 번호를 주석으로 달고 있다.
- 신규 코드에 `@MX` 태그가 적용되어 있다 — 최소한 `admin-product-repository.ts`에 자기 완결 원칙의 WET 트레이드오프(design.md §4)와 `isActive` 인덱스 미추가 판단(design.md §7)을 `@MX:NOTE`로 남긴다.
- spec.md §3이 넘긴 신규 백로그 카드(장바구니에 담긴 판매 중단 상품의 결제 통과 공백)가 sync-phase에서 실제로 등재되어 있다.

## §H. 간접 검증 항목

다음은 이 SPEC이 직접 만들지 않지만 위 AC들이 성립하기 위해 참이어야 하는 조건이며, run-phase에서 확인만 한다.

- 테스트 seed 헬퍼가 `role: admin` User와 최소 1개의 `Category` 행을 만들 수 있다(관리자 계정 프로비저닝은 spec.md §3의 제외 대상이므로 애플리케이션 경로가 아니라 테스트 헬퍼로 확보한다).
- `POST /api/auth/login`이 `csrf_token` 쿠키를 계속 발급한다(AC-ADMIN-039의 전제).
