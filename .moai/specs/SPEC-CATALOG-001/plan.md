---
id: SPEC-CATALOG-001
status: completed
updated: 2026-08-28
tier: M
---

# Plan: SPEC-CATALOG-001 — 상품 카탈로그 도메인 모델 및 목록/상세 조회 API

## §1. 개요 / 목표

`product.md` 핵심 기능 #1(상품 카탈로그 및 검색, p95 300ms 목표)의 첫 단계로, 상품 데이터 모델과 읽기 전용 목록/상세 API를 구축한다. SPEC-AUTH-001 이후 이 저장소의 **두 번째 도메인**이며, `structure.md`가 제안한 `features/` 계층을 처음으로 실제 적용한다.

## §2. 데이터 모델 결정 (가장 되돌리기 어려운 결정 — 최우선 검토)

### 2.1 Category: 테이블 vs enum

**결정: 별도 `Category` 테이블로 모델링한다 (enum 아님).**

트레이드오프:

| 항목 | `Category` 테이블 | Postgres/Prisma enum |
|---|---|---|
| 카테고리 추가/이름 변경 | 데이터 변경만으로 가능 (마이그레이션 불필요) | 스키마 마이그레이션 필요 (enum 값 변경은 배포를 동반) |
| 관리자 카테고리 관리 API(로드맵 후보) | 자연스럽게 확장 가능 (이번 SPEC 범위 밖이지만 스키마가 막지 않음) | enum이므로 런타임 CRUD 불가 — 향후 SPEC에서 테이블로 재작업 필요 |
| 필터 쿼리(`category=<slug>`) | `Category.slug` 조인/lookup 한 번 추가 | enum 값 자체를 파라미터로 직접 매칭 (조인 없음, 약간 더 빠름) |
| 구현 복잡도 (이번 SPEC) | 약간 높음 (테이블 1개, FK 1개 추가) | 약간 낮음 |

`product.md` 로드맵 후보 #6("관리자 상품·주문 관리")이 명시적으로 예정되어 있고, `structure.md`가 관리자 도메인을 별도로 제안하고 있어 카테고리를 관리자가 동적으로 추가/수정할 가능성이 높다고 판단했다. enum을 택하면 카테고리 추가마다 스키마 마이그레이션 + 배포가 필요해 향후 SPEC에서 결국 테이블로 재작업(마이그레이션)하게 될 가능성이 크므로, 처음부터 테이블로 시작하는 편이 총비용이 낮다. 이번 SPEC은 Category CUD API를 만들지 않으므로 초기 데이터는 시드 스크립트 또는 수동 INSERT로 채운다(§8 Out of Scope 참고).

### 2.2 가격(price) 표현: Int(원 단위) vs Decimal

**결정: `Int` (원화 최소 단위, 소수점 없음).**

원화(KRW)는 최소 통화 단위가 정수이므로 부동소수점/Decimal의 반올림 복잡도 없이 `Int`로 충분하다. 향후 다중 통화 지원이 필요해지면 별도 SPEC에서 `Decimal` + 통화 코드로 마이그레이션한다 — 이번 SPEC에서 선제적으로 다국어/다통화를 설계하지 않는다(YAGNI).

### 2.3 이미지(images) 표현: Postgres 배열 vs 별도 테이블

**결정: `Product.images String[]` (Postgres 네이티브 배열 컬럼).**

이번 SPEC은 이미지에 순서 외의 메타데이터(alt 텍스트, 대표 이미지 플래그 등)를 요구하지 않으므로, 별도 `ProductImage` 테이블은 과설계(over-engineering)다. 배열 컬럼으로 시작하고, 이미지별 메타데이터가 필요해지면 후속 SPEC에서 테이블로 승격한다.

## §3. Prisma 스키마 확장 (설계 — run-phase에서 적용, 이번 plan-phase는 `prisma/schema.prisma` 미변경)

기존 SPEC-AUTH-001의 `User`/`OAuthAccount`/`RefreshToken` 모델은 건드리지 않는다. 아래는 run-phase에서 추가될 모델의 설계안이다:

```prisma
model Category {
  id        String    @id @default(cuid())
  name      String    @unique
  slug      String    @unique
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  products  Product[]
}

model Product {
  id          String   @id @default(cuid())
  name        String
  price       Int // KRW 최소 단위 (원), 소수점 없음 — §2.2
  description String
  images      String[] // 이미지 URL 배열, 순서 = 노출 순서 — §2.3
  stock       Int      @default(0)
  categoryId  String
  category    Category @relation(fields: [categoryId], references: [id], onDelete: Restrict)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([categoryId])
  @@index([createdAt])
  @@index([price])
}
```

- `onDelete: Restrict` — 상품이 존재하는 카테고리는 삭제할 수 없다. 이번 SPEC은 Category 삭제 API를 만들지 않으므로 즉시 발동하지는 않지만, 향후 관리자 SPEC이 실수로 참조 무결성을 깨지 않도록 스키마 레벨에서 선제 방어한다.
- `@@index([categoryId])` — REQ-CATALOG-010(카테고리 필터) 지원.
- `@@index([createdAt])` — REQ-CATALOG-008 `newest` 정렬 지원.
- `@@index([price])` — REQ-CATALOG-008 `price_asc`/`price_desc` 정렬 지원.

## §4. API 계약 (Route Handlers)

### 4.1 `GET /api/products` — 목록

쿼리 파라미터: `page` (기본 1), `pageSize` (기본 20, 최대 100 — 초과 시 클램프), `sort` (`newest` 기본 | `price_asc` | `price_desc`), `category` (Category.slug, 선택).

응답 200:
```json
{
  "items": [
    { "id": "...", "name": "...", "price": 39000, "images": ["..."], "stock": 12,
      "category": { "id": "...", "name": "...", "slug": "..." }, "createdAt": "..." }
  ],
  "page": 1, "pageSize": 20, "totalCount": 143, "totalPages": 8
}
```

`items[].description`은 목록 응답에서 생략한다(카드형 목록 UI에 불필요한 페이로드 절감 — p95 300ms 목표와 직결). 상세 응답에서만 전체 `description`을 반환한다.

응답 400: `page`/`pageSize`가 0 이하이거나 정수가 아닌 경우, 또는 `sort`가 지원되지 않는 값인 경우.

### 4.2 `GET /api/products/:id` — 상세

응답 200: 목록 항목의 모든 필드 + 전체 `description` + `updatedAt`.
응답 404: id가 존재하지 않는 상품일 경우.

두 엔드포인트 모두 인증 미들웨어를 거치지 않는다(REQ-CATALOG-003) — `src/middleware.ts`의 `/admin/:path*` matcher는 이 경로에 적용되지 않으므로 추가 변경이 필요 없다(확인만 필요, run-phase M-검증 항목).

## §5. 레이어링 및 파일 목록

`structure.md`의 제안을 따라 `features/` 계층을 최초 도입한다:

```
src/features/catalog/
├── types/
│   └── product.ts          # Product, Category, PaginatedProducts DTO 타입
├── repositories/
│   ├── product-repository.ts   # Prisma 쿼리: findMany(paginated/sorted/filtered), findById
│   └── category-repository.ts  # findBySlug (카테고리 필터 검증용)
└── services/
    └── product-service.ts  # 쿼리 파라미터 검증/기본값/클램프 + repository 호출 + 응답 조립

src/app/api/products/
├── route.ts                 # GET 목록 — product-service 호출
└── [productId]/
    └── route.ts             # GET 상세 — product-service 호출
```

`app/`은 라우팅/파라미터 파싱만 담당하고, 검증·기본값·정렬 매핑 등 실제 로직은 `features/catalog/services`에 둔다(SPEC-AUTH-001과 달리 프레임워크 비의존 계층을 분리 — structure.md 레이어링 원칙 준수).

## §6. 마일스톤 (우선순위 기반, 시간 추정 없음)

- **M1 (Priority High)** — Prisma 스키마 확장: `Category`/`Product` 모델 추가, 마이그레이션 생성·적용, 시드 스크립트(최소 1개 카테고리 + 몇 개 샘플 상품)로 로컬 검증.
- **M2 (Priority High)** — `features/catalog/types` + `repositories`: Prisma 쿼리 레이어(페이지네이션/정렬/필터), 존재하지 않는 category slug → 빈 결과 처리.
- **M3 (Priority High)** — `features/catalog/services/product-service.ts`: 쿼리 파라미터 검증(REQ-CATALOG-005/006/009), 기본값 적용(REQ-CATALOG-004/008), 응답 DTO 조립(REQ-CATALOG-007).
- **M4 (Priority High)** — Route Handlers(`app/api/products/route.ts`, `[productId]/route.ts`) 연결 + 404 처리(REQ-CATALOG-014).
- **M5 (Priority Medium)** — 단위/통합 테스트: 페이지네이션 경계값, 정렬 3종, 카테고리 필터(존재/미존재), 404, 응답 필드 화이트리스트(리뷰/관련상품 미노출 확인 — REQ-CATALOG-015).
- **M6 (Priority Medium)** — 성능 NFR 검증(REQ-CATALOG-016): p95 300ms 측정용 타이밍 기반 통합 테스트 작성(SPEC-AUTH-001의 AC-AUTH-005 타이밍 테스트 패턴 참고) 또는 측정 방법론 문서화.

## §7. 리스크

- **p95 300ms 측정 환경 의존성**: 샌드박스/CI 환경의 부하 특성이 실제 프로덕션과 다를 수 있어, 절대 수치보다는 측정 방법론(반복 요청 수, 통계 처리)의 재현성을 우선한다 — SPEC-AUTH-001의 AC-AUTH-005가 이미 이 패턴(중앙값/허용오차 기반 타이밍 검증)을 확립했다.
- **Category 시드 데이터 부재**: 이번 SPEC은 Category 생성 API를 만들지 않으므로, 통합 테스트와 로컬 개발은 시드 스크립트에 의존한다 — 시드 스크립트 자체는 run-phase M1 산출물이며 프로덕션 배포 전략은 별도 관리자 SPEC 범위.
- **`Restrict` FK가 향후 관리자 SPEC에 미치는 영향**: 상품이 하나라도 남은 카테고리는 삭제 불가 — 향후 관리자 카테고리 관리 SPEC이 이 정책을 재검토할 수 있음을 기록해 둔다.

## §8. plan-audit 대상 확인 사항

- **Clarification status**: 미해결 항목 없음 — 이번 SPEC은 사용자와 사전 확정된 요구사항(Drained Requirements)을 기반으로 하며, plan-phase에서 추가로 열린 질문이 발생하지 않았다.
