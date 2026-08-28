---
id: SPEC-CATALOG-001
title: "상품 카탈로그 도메인 모델 및 목록/상세 조회 API"
version: "0.1.0"
status: in-progress
created: 2026-08-27
updated: 2026-08-28
author: snake
priority: P1
phase: "v0.1.0 MVP"
module: "src/features/catalog"
lifecycle: spec-anchored
tags: "catalog, products, api, prisma"
tier: M
---

## HISTORY

| 날짜 | 버전 | 상태 | 비고 |
|---|---|---|---|
| 2026-08-27 | 0.1.0 | draft | plan-phase 최초 작성. Kanban 디스패치를 통해 사용자와 사전에 확정된 요구사항(상품 필드, 목록/상세 API 형태, 공개 접근, p95 300ms NFR)을 GEARS 형식으로 구체화. 별도 명료화 라운드 없이 진행. |

---

## §1. 개요

`our-shop`(모바일 우선 B2C 패션 이커머스)의 **상품 카탈로그 도메인**을 정의한다. 상품 데이터 모델(Prisma `Product`/`Category`)과, 비회원을 포함한 모든 방문자가 호출 가능한 **읽기 전용** 목록/상세 조회 API 두 개를 다룬다.

이 SPEC은 `product.md` 핵심 기능 #1(상품 카탈로그 및 검색, p95 300ms 목표)의 첫 단계이며, `structure.md`가 제안한 `src/features/catalog/{services,repositories,types}` + `src/app/api/products/` 레이어링을 이 저장소에서 최초로 실제 적용하는 도메인이다(SPEC-AUTH-001은 `features/` 계층을 사용하지 않았다).

상품 옵션(색상/사이즈 등 variant), 키워드/전문 검색, 리뷰, 관련 상품, 상품 쓰기(CUD) API는 모두 이번 SPEC 범위 밖이다 — §3(Out of Scope) 참고. 이 API들은 SPEC-AUTH-001의 세션/토큰 검증과 결합하지 않는 완전한 공개(public) 엔드포인트다.

## §2. 요구사항 (GEARS, REQ-CATALOG-001 ~ REQ-CATALOG-016)

### 상품 데이터 모델

- **REQ-CATALOG-001** (Ubiquitous): 카탈로그 도메인은 각 상품을 이름(name), 가격(price), 설명(description), 하나 이상의 이미지(images), 카테고리 분류(category), 재고 수량(stock)을 갖는 엔터티로 모델링해야 한다.
- **REQ-CATALOG-002** (Unwanted, shall not): 카탈로그 도메인은 이번 SPEC에서 상품 옵션/변형(색상, 사이즈 등 variant)을 모델링해서는 안 된다.

### 접근 제어

- **REQ-CATALOG-003** (Ubiquitous): 목록 API(`GET /api/products`)와 상세 API(`GET /api/products/:id`)는 인증 없이 익명/게스트 사용자를 포함한 모든 방문자가 호출 가능한 공개(public) 엔드포인트여야 한다.

### 목록 API — 페이지네이션

- **REQ-CATALOG-004** (When): 목록 API가 `page`/`pageSize` 쿼리 파라미터 없이 요청되면, 카탈로그 서비스는 `page=1`과 고정된 기본 `pageSize`(20)를 적용해야 한다.
- **REQ-CATALOG-005** (When — 이벤트 탐지형): 목록 API가 0 이하이거나 정수가 아닌 `page`/`pageSize` 값을 수신하면, 카탈로그 서비스는 400 응답을 반환해야 하며 데이터베이스를 조회해서는 안 된다.
- **REQ-CATALOG-006** (When — 이벤트 탐지형): 목록 API가 설정된 최대값(100)을 초과하는 `pageSize`를 수신하면, 카탈로그 서비스는 요청을 거부하는 대신 `pageSize`를 최댓값으로 클램프(clamp)해야 한다.
- **REQ-CATALOG-007** (Ubiquitous): 목록 API 응답은 상품 항목 배열과 함께 페이지네이션 메타데이터(현재 페이지, 페이지 크기, 총 항목 수, 총 페이지 수)를 포함해야 한다.

### 목록 API — 정렬

- **REQ-CATALOG-008** (When): 목록 API가 지원되는 `sort` 값(`price_asc`, `price_desc`, `newest`) 중 하나를 수신하면 해당 기준으로 결과를 정렬해야 하며, `sort`가 생략되면 `newest`(최신순)를 기본값으로 적용해야 한다.
- **REQ-CATALOG-009** (When — 이벤트 탐지형): 목록 API가 지원되지 않는 `sort` 값을 수신하면, 카탈로그 서비스는 400 응답을 반환해야 한다.

### 목록 API — 카테고리 필터

- **REQ-CATALOG-010** (When): 목록 API가 존재하는 카테고리 식별자(slug)와 일치하는 `category` 파라미터를 수신하면, 카탈로그 서비스는 해당 카테고리에 속한 상품만 반환해야 한다.
- **REQ-CATALOG-011** (When — 이벤트 탐지형): 목록 API가 어떤 카테고리와도 일치하지 않는 `category` 파라미터를 수신하면, 카탈로그 서비스는 오류가 아닌 빈 결과 집합(items: [])을 반환해야 한다.

### 목록 API — 검색 제외

- **REQ-CATALOG-012** (Unwanted, shall not): 목록 API는 이번 SPEC에서 키워드/전문 검색(full-text search) 파라미터를 지원해서는 안 된다.

### 상세 API

- **REQ-CATALOG-013** (When): 상세 API가 존재하는 상품 id로 요청되면, 카탈로그 서비스는 이름·가격·설명·이미지·카테고리·재고를 포함한 전체 상품 표현을 반환해야 한다.
- **REQ-CATALOG-014** (When — 이벤트 탐지형): 상세 API가 존재하지 않는 상품 id로 요청되면, 카탈로그 서비스는 404 응답을 반환해야 한다.
- **REQ-CATALOG-015** (Unwanted, shall not): 상세 API 응답은 리뷰 또는 관련 상품 데이터를 포함해서는 안 된다(별도 도메인으로 이연).

### 성능 (NFR)

- **REQ-CATALOG-016** (Ubiquitous): 목록 API와 상세 API는 `product.md`가 명시한 카탈로그 응답 속도 목표에 따라, 정상 부하 조건에서 p95 300ms 이내로 응답해야 한다.

## §3. Out of Scope

### Out of Scope — 상품 옵션/변형 (Variants)
- 색상/사이즈 등 옵션(variant) 모델링 및 관련 API는 이번 SPEC 범위 밖이며, 별도 후속 SPEC에서 다룬다.

### Out of Scope — 검색 (Search)
- 키워드/전문 검색(full-text search)은 이번 SPEC 범위 밖이다. 카테고리 필터와 정렬만 지원한다.

### Out of Scope — 리뷰 및 관련 상품
- 상품 리뷰 작성/조회, 관련 상품 추천은 `structure.md`가 별도로 제안한 `features/reviews` 도메인에서 다룬다.

### Out of Scope — 상품 쓰기 API (Write APIs)
- 상품 생성/수정/삭제(관리자용 CUD API)는 이번 SPEC 범위 밖이다 — 이 SPEC은 읽기 전용(list/detail) API만 다룬다. 관리자 상품 관리는 `product.md` 로드맵 후보의 별도 SPEC 대상이다.

### Out of Scope — 카테고리 관리 API
- `Category` 생성/수정/삭제 API는 이번 SPEC 범위 밖이다. `Category` 테이블은 존재하지만 값을 채우는 시드 스크립트 또는 후속 관리자 SPEC은 별도 범위다.

### Out of Scope — 인증 연계
- 목록/상세 API는 SPEC-AUTH-001의 세션/토큰 검증과 결합하지 않는다 — 완전한 공개(public) 엔드포인트로 유지한다.
