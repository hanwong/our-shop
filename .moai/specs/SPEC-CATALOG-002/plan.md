---
id: SPEC-CATALOG-002
status: in-progress
updated: 2026-08-28
tier: M
---

# Plan: SPEC-CATALOG-002 — 상품 목록 API 키워드 검색 (이름 기반 부분 일치)

## §1. 개요 / 목표

SPEC-CATALOG-001이 `GET /api/products`에 이미 구현한 카테고리 필터·정렬·페이지네이션에 **키워드 검색**을 추가하고, 기존 파라미터들과 합성 가능하게 만든다. 새 Prisma 모델은 없다 — 기존 `Product.name` 필드에 대한 조회 방식만 확장한다.

## §2. 결정 사항 (가장 되돌리기 어려운 것부터)

### 2.1 쿼리 파라미터 이름: `search`

**결정: `search` (별칭 `q` 없음).**

디스패치가 지적한 대로, `product-service.ts`에는 이미 죽은 주석이 있다: *"`q` and `search` are never read: this SPEC supports category filtering and sorting only (REQ-CATALOG-012)"*. 이 주석은 두 이름을 동시에 언급하지만 **어느 쪽이 API 계약이 될지 확정하지 않았다** — 단지 둘 다 무시된다는 사실만 기록했을 뿐이다. 따라서 이 주석은 이름 결정을 위한 근거가 되지 못한다.

`search`를 선택한 이유:
- REST 공개 API에서 `search`가 `q`보다 자기 설명적(self-documenting)이다 — `q`는 검색엔진(구글 등)에서 굳어진 관용이지만, 이 프로젝트의 다른 쿼리 파라미터(`category`, `sort`, `page`, `pageSize`)가 모두 완전한 단어를 쓰는 기존 컨벤션과 일관된다.
- 별칭을 함께 지원(`q` OR `search` 허용)하지 않는다 — 파라미터 파싱 로직과 문서화 표면을 하나로 유지하는 편이 이번 SPEC의 범위(단순 부분 일치)에 맞다. 별칭이 필요해지면 후속 SPEC에서 명시적으로 추가한다(YAGNI).

이 결정은 공개 API 계약이므로 SPEC 중 가장 되돌리기 어렵다 — 클라이언트가 `search=`를 사용하기 시작하면 이름 변경은 breaking change가 된다.

### 2.2 매칭 방식: 대소문자 무관 부분 문자열(substring) 일치

**결정: Prisma `contains` + `mode: "insensitive"` (PostgreSQL 내부적으로 `ILIKE '%term%'`로 컴파일됨).**

전문 검색(`tsvector`)은 이번 SPEC 범위 밖(REQ-CATALOG-024)이므로, `contains`가 요구사항을 충족하는 가장 단순한 구현이다. `where: { name: { contains: term, mode: "insensitive" } }` 형태로 리포지토리 레이어에 추가한다.

### 2.3 성능/인덱스 트레이드오프 (§2.6과 함께 검토 — 두 번째로 되돌리기 어려운 결정)

**문제**: `ILIKE '%term%'`처럼 검색어 앞에 와일드카드가 오는 패턴은 표준 B-tree 인덱스(`@@index([...])`)를 사용할 수 없다 — B-tree는 접두사(prefix) 매칭만 가속할 수 있다. SPEC-CATALOG-001의 REQ-CATALOG-016(p95 300ms)이 이 SPEC에도 REQ-CATALOG-016B로 확장 적용되므로, 이 트레이드오프는 문서화만 하고 넘어갈 수 없는 진짜 결정이다.

**검토한 대안**:

| 대안 | 장점 | 단점 |
|---|---|---|
| A. `pg_trgm` 확장 + GIN 트라이그램 인덱스 (`name gin_trgm_ops`) | 앞뒤 와일드카드 `ILIKE`를 인덱스로 가속 — 이 정확한 사용 사례를 위해 설계된 PostgreSQL 표준 확장 | 스키마에 확장 활성화 필요(`postgresqlExtensions` preview feature), 마이그레이션에 `CREATE EXTENSION` 포함, 쓰기 시 인덱스 유지 비용 소폭 증가 |
| B. 현재 데이터 규모에서 위험 감수 (인덱스 없이 시퀀셜 스캔) | 구현 비용 0 | 상품 수가 증가하면 p95가 선형으로 악화 — SPEC-CATALOG-001도 이미 AC-CATALOG-016을 PARTIAL(DB 없는 환경이라 애플리케이션 계층만 측정)로 남겨 두었으므로, 이 SPEC까지 인덱스를 미루면 실제 DB 성능이 두 SPEC 모두에서 검증되지 않은 채 남는다 |
| C. 구현 전 벤치마크 후 결정 | 데이터 기반 결정 | 이 환경에는 PostgreSQL이 없어(SPEC-CATALOG-001 progress.md G2/G5/G6 참고) 벤치마크 자체가 불가능 — 결정을 무기한 보류하는 결과가 된다 |

**결정: A (`pg_trgm` GIN 트라이그램 인덱스)를 run-phase에서 적용한다.**

근거: 이 정확한 문제(부분 문자열 검색의 인덱스 가속)를 위해 존재하는 PostgreSQL 표준 확장이며, 비용(마이그레이션 한 줄 + preview feature 플래그 하나)이 낮다 — "단순성 우선" 원칙에 위배되지 않는다(과설계가 아니라 정확히 필요한 도구 하나를 추가하는 것). 대안 B는 REQ-CATALOG-016B를 사실상 무시하는 결정이 되고, 대안 C는 이 환경의 제약(PostgreSQL 부재) 때문에 실행 불가능하다.

**run-phase 적용 방법(스키마 설계 — 이번 plan-phase는 `prisma/schema.prisma` 미변경)**:

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [pg_trgm]
}

model Product {
  // ...기존 필드 변경 없음...

  @@index([name(ops: raw("gin_trgm_ops"))], type: Gin, map: "product_name_trgm_idx")
}
```

- `previewFeatures = ["postgresqlExtensions"]`는 Prisma의 확장 관리 기능을 활성화한다(Prisma 4.5+ 표준 기능이며, 이 저장소의 Prisma 버전이 지원하는지는 run-phase M1에서 `npx prisma -v`로 확인).
- 기존 3개 인덱스(`categoryId`, `createdAt`, `price`)는 변경하지 않는다 — 새 GIN 인덱스만 추가.
- 마이그레이션에는 `CREATE EXTENSION IF NOT EXISTS pg_trgm;`가 Prisma에 의해 자동 포함된다.

### 2.4 빈/짧은 검색어 처리

**결정: 최소 길이 제한 없음. 빈 문자열/공백만 있는 값은 파라미터 부재로 취급.**

디스패치의 안내대로 단순성을 우선한다 — 인위적인 최소 길이 제한을 추가할 구체적인 근거가 없다:
- **보안**: Prisma는 파라미터화된 쿼리를 생성하므로 SQL 인젝션 위험이 없다. 최소 길이가 없어도 인젝션 표면이 늘지 않는다.
- **성능**: 1~2글자 검색어는 더 많은 행과 매치되어 `ILIKE` 스캔 비용이 커질 수 있으나, 이는 §2.3에서 이미 GIN 트라이그램 인덱스로 완화하기로 한 동일한 문제다 — 별도의 최소 길이 규칙으로 이중 방어할 근거가 약하다.
- **UX**: 사용자가 한 글자만 입력한 뒤 결과를 보고 싶어할 수 있다(예: "M"으로 시작하는 브랜드 찾기) — 인위적 제한은 이런 사용을 막는다.

`""`, `" "`, `"   "` 모두 트림 후 빈 문자열이면 REQ-CATALOG-020에 따라 파라미터 없음으로 처리한다(400 아님, 필터 미적용).

## §3. 타입/함수 시그니처 변경 (설계 — run-phase에서 적용)

`src/features/catalog/types/product.ts` — `ListProductsQuery`에 필드 추가:

```typescript
export interface ListProductsQuery {
  page: number;
  pageSize: number;
  sort: ProductSort;
  category?: string;
  search?: string;   // NEW — trimmed, non-empty; absent when omitted or blank
}
```

`src/features/catalog/services/product-service.ts` — `parseListQuery()`에 `search` 파싱 추가:
- `searchParams.get("search")`를 읽어 `.trim()` 후, 빈 문자열이면 `undefined`로 취급(REQ-CATALOG-020) — 400을 반환하지 않는다(다른 파라미터들과 달리 검증 실패가 아니라 정규화이므로).
- `listProducts()` 본문의 죽은 주석(*"`q` and `search` are never read..."*) 및 doc comment를 이 SPEC이 구현하는 실제 동작으로 갱신한다 — run-phase 작업 항목이며, 이번 plan-phase에서는 소스 파일을 직접 수정하지 않는다(태스크 지시사항 준수).

`src/features/catalog/repositories/product-repository.ts` — `FindProductsPageArgs`에 `search?: string` 추가, `where` 조합에 `AND` 결합:

```typescript
const where: Prisma.ProductWhereInput = {
  ...(categoryId ? { categoryId } : {}),
  ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
};
```

기존 `where: Prisma.ProductWhereInput = categoryId ? { categoryId } : {};` 한 줄을 이 형태로 확장한다 — Prisma의 객체 스프레드는 자연스럽게 AND 의미론이 된다(REQ-CATALOG-021).

`src/app/api/products/route.ts` — **변경 없음**. 이 핸들러는 이미 `searchParams`를 그대로 `listProducts()`에 전달하고 있으므로(§1 참고), `search` 파라미터는 서비스 레이어가 새로 읽기 시작하는 순간 자동으로 전달된다.

## §4. 레이어링 및 파일 목록

```
src/features/catalog/types/product.ts             # EXTEND — ListProductsQuery.search 필드 추가
src/features/catalog/services/product-service.ts   # EXTEND — parseListQuery()에 search 파싱, 죽은 주석 갱신
src/features/catalog/repositories/product-repository.ts  # EXTEND — FindProductsPageArgs.search, where 절 AND 결합
src/app/api/products/route.ts                      # 변경 없음 (참고용으로 명시)
prisma/schema.prisma                                # EXTEND (run-phase) — pg_trgm 확장 + GIN 인덱스 (§2.3)
prisma/migrations/<timestamp>_add_product_name_trgm_index/  # NEW (run-phase)
```

기존 SPEC-CATALOG-001/SPEC-AUTH-001 파일(`User`/`OAuthAccount`/`RefreshToken`/`Category` 모델, `src/lib/auth/**`, `src/lib/db/**`, `src/app/api/auth/**`, `src/middleware.ts`)은 PRESERVE — 손대지 않는다.

## §5. 마일스톤 (우선순위 기반, 시간 추정 없음)

- **M1 (Priority High)** — 스키마 확장: `pg_trgm` preview feature 활성화, `Product.name`에 GIN 트라이그램 인덱스 추가, 마이그레이션 생성.
- **M2 (Priority High)** — `features/catalog/types/product.ts` + `repositories/product-repository.ts`: `search` 필드/파라미터 추가, `where` AND 결합, 트라이그램 인덱스를 실제로 사용하는지 `EXPLAIN`으로 확인(가능한 환경에서).
- **M3 (Priority High)** — `features/catalog/services/product-service.ts`: `search` 파싱(트림 + 빈 값 정규화), 죽은 주석/doc comment 갱신, 응답 조립 경로에 반영.
- **M4 (Priority Medium)** — 단위/통합 테스트: 부분 일치, 대소문자 무관, 설명 미대상, 빈/공백 검색어, `category`+`search`+`sort`+페이지네이션 합성, 결과 없음(빈 배열), 기존 카테고리 전용/정렬 전용 요청 회귀 확인.
- **M5 (Priority Medium)** — 성능 NFR 검증(REQ-CATALOG-016B): SPEC-CATALOG-001의 p95 측정 패턴(N=50, 최근접 순위)을 재사용해 `search` 포함 요청의 애플리케이션 계층 p95 측정, DB가 있는 환경에서는 인덱스 사용 여부(`EXPLAIN`)도 함께 기록.

## §6. 리스크

- **`pg_trgm` 확장 활성화 권한**: 관리형 PostgreSQL(예: Neon, Supabase)에 따라 `CREATE EXTENSION`에 상위 권한이 필요할 수 있다 — 대부분의 관리형 서비스는 `pg_trgm`을 화이트리스트에 포함하지만, run-phase M1에서 실제 배포 대상 DB의 확장 지원 여부를 확인해야 한다. 지원되지 않으면 §2.3 대안 B(인덱스 없이 진행, 부채로 기록)로 폴백한다.
- **이 환경에 PostgreSQL 부재**: SPEC-CATALOG-001과 동일한 제약(progress.md G2/G5/G6) — 마이그레이션 SQL의 구조적 정확성은 검증 가능하지만, 실제 적용·인덱스 사용 여부(`EXPLAIN`)·p95 측정은 DB가 있는 환경(CI 또는 배포 환경)에서 재검증이 필요할 수 있다.
- **`search`와 `category` 동시 미스매치**: 카테고리 필터가 먼저 빈 결과를 반환하면(REQ-CATALOG-011) `search` 조건은 평가할 필요가 없다 — SPEC-CATALOG-001의 기존 단락 반환(early return) 로직과 어떻게 합성할지 M2에서 결정한다(이중 DB 조회 방지가 목표).

## §7. plan-audit 대상 확인 사항

**Clarification status**: 미해결 항목 없음 — 이번 SPEC은 사용자와 사전 확정된 요구사항(검색 필드, 매칭 방식, 정렬 재사용, 합성 의미론, 파라미터 이름, 빈 검색어 처리)을 기반으로 하며, 인덱스/성능 트레이드오프(§2.3)는 이번 plan-phase에서 대안을 검토해 명시적으로 결정했다. plan-phase에서 추가로 열린 질문은 발생하지 않았다.
