---
id: SPEC-CATALOG-002
title: "상품 목록 API 키워드 검색 (이름 기반 부분 일치)"
version: "0.1.0"
status: completed
created: 2026-08-28
updated: 2026-08-28
author: snake
priority: P1
phase: "v0.1.0 MVP"
module: "src/features/catalog"
lifecycle: spec-anchored
tags: "catalog, search, api, prisma"
tier: M
---

## HISTORY

| 날짜 | 버전 | 상태 | 비고 |
|---|---|---|---|
| 2026-08-28 | 0.1.0 | draft | plan-phase 최초 작성. SPEC-CATALOG-001(카테고리 필터/정렬, merged `dc0283b`)이 REQ-CATALOG-012로 명시적으로 범위 밖으로 남겨둔 키워드 검색을 이번 SPEC에서 구현한다. 사용자와 사전 확정된 요구사항(Drained Requirements)을 기반으로 하며, 별도 명료화 라운드 없이 진행. |

---

## §1. 개요

`GET /api/products` 목록 API에 **키워드 검색**(`search` 쿼리 파라미터)을 추가한다. SPEC-CATALOG-001이 이미 구현한 카테고리 필터(`category`)·정렬(`sort`)·페이지네이션(`page`/`pageSize`)과 **합성(compose)** 가능해야 한다 — 검색·카테고리·정렬·페이지네이션을 동시에 지정한 요청은 AND 의미론으로 결합된 결과를 반환한다.

이 SPEC은 `product.md` 핵심 기능 #1(상품 카탈로그 및 검색)의 나머지 절반이며, SPEC-CATALOG-001이 §3(Out of Scope) — 검색에서 명시적으로 제외했던 범위를 좁혀서 다룬다: **상품명(`name`) 대상의 대소문자 무관 부분 문자열(substring) 일치**만 지원하고, 전문 검색(full-text search, tsvector/GIN 텍스트 인덱스)이나 관련도(relevance) 기반 정렬은 다루지 않는다.

`src/app/api/products/route.ts`(Route Handler)는 이미 모든 결정을 `listProducts()`(`src/features/catalog/services/product-service.ts`)에 위임하고 있으므로, 이 SPEC의 실질적인 변경은 서비스·리포지토리·타입 레이어에 집중된다 — Route Handler 자체는 변경이 필요 없다(§4 참고).

## §2. 요구사항 (GEARS, REQ-CATALOG-017 ~ 026)

REQ 번호는 SPEC-CATALOG-001의 REQ-CATALOG-001~016에 이어서 부여한다(같은 `catalog` 도메인의 연속된 요구사항 집합).

### 검색 파라미터 형태

- **REQ-CATALOG-017** (Ubiquitous): 목록 API의 검색 쿼리 파라미터 이름은 `search`여야 한다.
- **REQ-CATALOG-018** (When): 목록 API가 공백만이 아닌 비어있지 않은 `search` 값을 수신하면, 카탈로그 서비스는 상품명(`name`) 필드에 대해 대소문자 구분 없는 부분 문자열(substring) 일치 검색을 수행해야 한다.
- **REQ-CATALOG-019** (Unwanted, shall not): 검색은 상품 설명(`description`) 필드를 대상으로 해서는 안 된다.

### 빈 검색어 처리

- **REQ-CATALOG-020** (When — 이벤트 탐지형): 목록 API가 빈 문자열이거나 공백으로만 이루어진 `search` 값을 수신하면, 카탈로그 서비스는 이를 파라미터가 전혀 없는 것처럼 처리해야 하며(필터링 미적용), 400 오류를 반환해서는 안 된다.

### 다른 파라미터와의 합성

- **REQ-CATALOG-021** (When): `search`가 `category`와 함께 제공되면, 카탈로그 서비스는 두 조건을 AND로 결합하여 두 조건을 모두 만족하는 상품만 반환해야 한다.
- **REQ-CATALOG-022** (While): `search`가 제공된 요청에서도, 정렬(`sort`)은 REQ-CATALOG-008이 정의한 기존 3종 값(`price_asc`, `price_desc`, `newest`)을 동일한 규칙(생략 시 `newest` 기본값)으로 적용해야 한다.
- **REQ-CATALOG-026** (While): `search`가 제공된 요청에서도, 페이지네이션(`page`/`pageSize`, 기본값·클램프·메타데이터 포함)은 REQ-CATALOG-004~007과 동일하게 동작해야 한다.

### 검색 결과 없음

- **REQ-CATALOG-025** (When — 이벤트 탐지형): `search`와 일치하는 상품이 없으면, 카탈로그 서비스는 오류가 아닌 빈 결과 집합(`items: []`, `totalCount: 0`)을 반환해야 한다.

### 이번 SPEC에서 다루지 않는 검색 방식 (제외)

- **REQ-CATALOG-023** (Unwanted, shall not): 이번 SPEC은 검색어와 결과의 관련도(relevance)에 기반한 정렬 옵션을 추가해서는 안 된다.
- **REQ-CATALOG-024** (Unwanted, shall not): 이번 SPEC은 전문 검색(full-text search, `tsvector`/GIN 텍스트 인덱스 기반 매칭)을 사용해서는 안 된다 — 부분 문자열(substring) 일치만 지원한다.

### 성능 (NFR)

- **REQ-CATALOG-016B** (While, REQ-CATALOG-016 확장): `search` 파라미터가 포함된 목록 API 요청도, `product.md`가 명시한 카탈로그 응답 속도 목표에 따라 정상 부하 조건에서 p95 300ms 이내로 응답해야 한다.

## §3. Out of Scope

### Out of Scope — 전문 검색 (Full-Text Search)
- `tsvector`/`tsquery`, GIN 텍스트 인덱스, 형태소 분석 기반 검색은 이번 SPEC 범위 밖이다. 부분 문자열(substring) 일치만 지원한다.

### Out of Scope — 관련도 기반 정렬 (Relevance Ranking)
- 검색어와 결과의 일치도에 따른 정렬(`ts_rank` 등)은 이번 SPEC 범위 밖이다. 검색 결과에도 기존 3종 정렬(`price_asc`/`price_desc`/`newest`)만 적용된다.

### Out of Scope — 설명(Description) 및 기타 필드 검색
- 상품 설명(`description`), 카테고리명, 기타 필드를 대상으로 한 검색은 이번 SPEC 범위 밖이다. 검색 대상은 상품명(`name`)으로 한정한다.

### Out of Scope — 자동완성 / 검색어 추천
- 타이핑 중 자동완성(autocomplete), 검색어 추천, 오타 교정(fuzzy/typo-tolerant search)은 이번 SPEC 범위 밖이다.

### Out of Scope — 상품 옵션/변형, 리뷰, 관리자 쓰기 API (SPEC-CATALOG-001에서 이월)
- 색상/사이즈 등 옵션(variant) 모델링, 상품 리뷰, 상품 생성/수정/삭제(CUD) API, `Category` 관리 API는 SPEC-CATALOG-001과 마찬가지로 이번 SPEC 범위 밖이다.

### Out of Scope — 인증 연계
- 목록 API는 SPEC-AUTH-001의 세션/토큰 검증과 결합하지 않는다 — SPEC-CATALOG-001과 동일하게 완전한 공개(public) 엔드포인트로 유지한다.
