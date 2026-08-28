# Acceptance Criteria: SPEC-CATALOG-002 — 상품 목록 API 키워드 검색

Tier M — AC 상한 16개 이내(현재 14개). 모든 항목은 `GET /api/products` 목록 API를 대상으로 한다(상세 API는 검색과 무관 — AC-CATALOG-028 참고).

## §1. Given-When-Then 시나리오

**AC-CATALOG-017** — 부분 문자열, 대소문자 무관 일치 (REQ-CATALOG-017, REQ-CATALOG-018)
- Given: 상품명이 `"Classic Denim Jacket"`인 상품이 카탈로그에 존재한다
- When: `GET /api/products?search=denim` 요청 (소문자)
- Then: 응답 200, 해당 상품이 `items`에 포함된다. `search=DENIM`(대문자), `search=Denim`(혼합)도 동일하게 매치되어야 한다.

**AC-CATALOG-018** — 설명(description) 필드는 검색 대상이 아님 (REQ-CATALOG-019)
- Given: 상품명에는 없지만 `description`에만 등장하는 고유 단어(예: `"limited-edition-tag-xyz"`)를 가진 상품이 존재한다
- When: `GET /api/products?search=limited-edition-tag-xyz`
- Then: 응답 200, `items: []` — 설명에만 있는 단어로는 매치되지 않는다.

**AC-CATALOG-019** — 빈 문자열 검색어는 파라미터 부재로 처리 (REQ-CATALOG-020)
- Given: 카탈로그에 N개의 상품이 존재한다
- When: `GET /api/products?search=`
- Then: 응답 200(400 아님), 결과는 `search` 파라미터 없이 요청했을 때와 동일하다(페이지네이션/정렬 기본값 적용, 필터 없음).

**AC-CATALOG-020** — 공백만 있는 검색어도 파라미터 부재로 처리 (REQ-CATALOG-020)
- Given: 카탈로그에 N개의 상품이 존재한다
- When: `GET /api/products?search=%20%20%20` (공백 3개, URL 인코딩)
- Then: 응답 200(400 아님), `search` 없는 요청과 동일한 결과.

**AC-CATALOG-021** — `search` + `category` 합성 (AND) (REQ-CATALOG-021)
- Given: `"tops"` 카테고리에 `"Denim Shirt"`가, `"bottoms"` 카테고리에 `"Denim Jeans"`가 존재한다
- When: `GET /api/products?search=denim&category=tops`
- Then: 응답 200, `items`에는 `"Denim Shirt"`만 포함되고 `"Denim Jeans"`는 제외된다(두 조건 모두 만족해야 함).

**AC-CATALOG-022** — `search` + `sort=price_asc` 합성 (REQ-CATALOG-022)
- Given: `search` 조건에 매치되는 상품이 서로 다른 가격으로 3개 이상 존재한다
- When: `GET /api/products?search=<term>&sort=price_asc`
- Then: 응답 200, `items`가 가격 오름차순으로 정렬되어 있다(REQ-CATALOG-008과 동일한 정렬 규칙).

**AC-CATALOG-023** — `search` + `sort` 생략 시 `newest` 기본값 (REQ-CATALOG-022)
- Given: `search` 조건에 매치되는 상품이 서로 다른 생성 시각으로 존재한다
- When: `GET /api/products?search=<term>` (`sort` 생략)
- Then: 응답 200, `items`가 `createdAt` 내림차순(최신순)으로 정렬되어 있다.

**AC-CATALOG-024** — `search` + 페이지네이션 메타데이터 정확성 (REQ-CATALOG-026)
- Given: `search` 조건에 매치되는 상품이 총 43개 존재한다
- When: `GET /api/products?search=<term>&page=2&pageSize=20`
- Then: 응답 200, `totalCount: 43`, `totalPages: 3`, `page: 2`, `items.length` ≤ 20 — 메타데이터가 **검색으로 필터링된 집합**을 기준으로 계산된다(전체 카탈로그 기준이 아님).

**AC-CATALOG-025** — 검색어와 일치하는 상품 없음 → 빈 결과 (REQ-CATALOG-025)
- Given: 카탈로그의 어떤 상품명에도 등장하지 않는 검색어(예: `"zzz-no-match-zzz"`)
- When: `GET /api/products?search=zzz-no-match-zzz`
- Then: 응답 200(404/400 아님), `items: []`, `totalCount: 0`, `totalPages: 0`.

**AC-CATALOG-026** — 관련도 정렬 옵션이 존재하지 않음 (REQ-CATALOG-023 — 정적 검사)
- Given: 정렬 값 화이트리스트를 정의하는 소스(`PRODUCT_SORTS`)
- When: 소스를 검사한다
- Then: `PRODUCT_SORTS`는 정확히 `["newest", "price_asc", "price_desc"]` 3개 값만 포함하며, `relevance`/`rank`/`score` 등 관련도 기반 값이 추가되지 않았다.

**AC-CATALOG-027** — 전문 검색(full-text) 미사용 정적 검사 (REQ-CATALOG-024)
- Given: 리포지토리/서비스 소스 코드
- When: 소스를 검사한다
- Then: `$queryRaw`/`$executeRaw`/`tsvector`/`to_tsquery`/`plainto_tsquery` 등 전문 검색 관련 호출이나 타입이 등장하지 않는다 — Prisma의 `contains`/`mode: "insensitive"`만 사용한다.

**AC-CATALOG-028** — 상세 API는 검색과 무관 (회귀 확인)
- Given: 존재하는 상품 id
- When: `GET /api/products/:id?search=anything` (상세 API에 `search`를 실수로 붙여도)
- Then: 응답 200, 상세 API는 `search` 파라미터를 읽거나 처리하지 않는다 — 기존 REQ-CATALOG-013/014 동작이 그대로 유지된다(상세 API는 이 SPEC의 변경 대상이 아님).

**AC-CATALOG-029** — 기존 카테고리 전용/정렬 전용 요청 회귀 없음 (REQ-CATALOG-010/011 회귀)
- Given: SPEC-CATALOG-001의 기존 통합 테스트가 검증한 요청 형태(`?category=tops`, `?sort=price_desc`, 파라미터 없는 기본 요청)
- When: `search` 필드 추가 이후 동일 요청을 재실행한다
- Then: 모든 기존 AC-CATALOG-001~016 시나리오가 이전과 동일한 결과를 반환한다 — `search` 부재는 이전 동작에 어떤 영향도 주지 않는다.

**AC-CATALOG-030** — 검색 포함 요청의 p95 성능 (REQ-CATALOG-016B)
- Given: 50개 이상의 상품이 시드된 카탈로그(가능한 환경에서) 또는 애플리케이션 계층 타이밍 하니스(DB 부재 환경)
- When: `search` 파라미터를 포함한 목록 API 요청을 반복 수행하고 p95를 측정한다(N=50, 최근접 순위 방식 — SPEC-CATALOG-001 AC-CATALOG-016과 동일한 방법론)
- Then: 측정된 p95가 300ms 이내다. DB가 없는 환경에서 측정이 애플리케이션 계층으로 제한되는 경우, 그 한계를 테스트 이름·주석·`progress.md`에 명시적으로 기록한다(조용한 생략 금지 — SPEC-CATALOG-001의 G2 선례를 따른다).

## §2. 엣지 케이스

| 케이스 | 기대 동작 |
|---|---|
| `search`가 상품명 전체와 정확히 일치 | 정상 매치(부분 일치는 완전 일치도 포함) |
| `search`에 SQL 메타문자 포함 (예: `%`, `_`, `'`) | Prisma 파라미터화 쿼리이므로 인젝션 없이 리터럴 문자로 처리됨(단, `%`/`_`는 Prisma의 `contains` 자체 이스케이프 규칙을 따름 — 오류를 일으키지 않아야 함) |
| `search`와 존재하지 않는 `category` 동시 지정 | REQ-CATALOG-011(빈 결과) 우선 적용 — `search` 평가와 무관하게 `items: []` |
| `search` 값이 매우 긴 문자열(예: 5000자) | 400 없이 처리(빈 결과 가능성 높음) — 서버 오류를 일으키지 않아야 함 |

## §3. 품질 게이트

- 전체 테스트 통과 (`npx vitest run --coverage`), 회귀 0건.
- `src/features/catalog/**` 변경 파일 커버리지 ≥85% (SPEC-CATALOG-001 기준과 동일).
- 타입 검사(`npx tsc --noEmit`) exit 0.
- 린트(`npx eslint .`) exit 0, 신규 이슈 0건.
- 스키마 유효성(`npx prisma validate`) exit 0.
- Definition of Done: REQ-CATALOG-017~026 및 REQ-CATALOG-016B 전체가 위 AC로 커버되고, PASS 또는 (DB 부재 등 환경 제약에 한해) 명시적으로 기록된 PARTIAL 상태로 종결된다 — 조용한 생략 없음.
