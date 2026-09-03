---
id: SPEC-ADMIN-001
title: "관리자 주문 목록·상태 변경 백오피스"
version: "0.1.0"
status: draft
created: 2026-09-03
updated: 2026-09-03
author: snake
priority: P1
phase: "v0.2.0 target"
module: "src/features/admin"
lifecycle: spec-anchored
tags: "admin, backoffice, order, rbac, session, cancellation, refresh-token"
tier: L
depends_on: [SPEC-AUTH-001, SPEC-ORDER-001, SPEC-PAYMENT-001]
related_specs: [SPEC-ORDER-002, SPEC-ORDER-003, SPEC-DISCOUNT-001]
---

## HISTORY

| 날짜 | 버전 | 상태 | 비고 |
|---|---|---|---|
| 2026-09-03 | 0.1.0 | draft | plan-phase 최초 작성. 백로그 카드 `t12`("관리자 주문 목록·상태 변경 백오피스")를 다룬다. **조사 결과 관리자 역할 필드와 RBAC 미들웨어(REQ-AUTH-022)는 이미 있지만, 그 미들웨어 자신이 "API 전용" 범위를 스스로 선언하며 관리자 페이지 서빙 방법을 이 SPEC에 명시적으로 미뤘다**(research.md §5). 이 SPEC은 새 인증 체계를 발명하지 않고, 이미 서버에서 읽을 수 있는 리프레시 토큰 쿠키를 읽기 전용으로 한 번 더 소비하는 최소 침습 해법을 채택한다(research.md §6). 관리자 주도 주문 취소는 `SPEC-PAYMENT-001` §3이 이미 이 SPEC(t12)에 명시적으로 위임한 책임이다(research.md §3). |

---

## §1. 개요

`our-shop`의 **첫 번째 관리자(백오피스) 화면**을 정의한다 — 관리자가 전체 주문 목록을 조회하고, 주문 하나를 열어 상세를 확인하고, 그 주문을 취소 상태로 전이시킬 수 있게 한다. `product.md` 핵심 기능 #6("관리자 상품·주문 관리")의 주문 관리 절반을 다루며, 상품 관리 절반(백로그 `t11`)은 별도 후속 SPEC의 몫이다.

> **이 SPEC은 새 인증 체계를 만들지 않는다.** `SPEC-AUTH-001`이 이미 관리자 역할 필드(`User.role`)와 `/admin` 경로 RBAC 미들웨어(REQ-AUTH-022)를 만들어 두었다. 조사 결과(research.md §5) 그 미들웨어는 액세스 토큰이 클라이언트 메모리에만 있다는 설계(REQ-AUTH-009) 때문에 **API 호출은 게이팅할 수 있지만 관리자 페이지의 최초 브라우저 내비게이션은 원리적으로 게이팅할 수 없다** — 이는 회원 체크아웃이 `SPEC-ORDER-001`에서 부딪힌 것과 같은 종류의 벽이다. 다만 이번에는 이미 서버가 읽을 수 있는 리프레시 토큰 쿠키(REQ-AUTH-008)를 읽기 전용으로 해석하는 우회로가 실제로 존재하며(research.md §6), 이 SPEC은 그 우회로를 채택해 `src/middleware.ts`를 단 한 줄도 건드리지 않고 관리자 페이지를 서버 렌더링한다.

### 이 SPEC이 인수하는, 선행 SPEC이 명시적으로 넘긴 책임

세 개의 선행 SPEC이 독립적으로 같은 결론에 도달해, 관리자 주문 관리의 소유자로 이 SPEC(백로그 `t12`)을 지목했다.

| 출처 | 문구 | 이 SPEC의 인수 |
|---|---|---|
| `SPEC-ORDER-001` §3 "Out of Scope — 관리자 주문 관리" | "관리자가 주문 목록을 조회하고 상태를 변경하는 화면과 API는 이번 범위 밖이다(`product.md` 핵심 기능 #6의 별도 SPEC 대상)" | REQ-ADMIN-007 ~ 011 |
| `SPEC-ORDER-003` §3 "Out of Scope — 관리자 주문 목록·상태 변경" | "관리자가 주문을 조회·변경하는 화면과 API는 범위 밖이다(`product.md` 핵심 기능 #6, 백로그 `t12`)" | 상동 |
| `SPEC-PAYMENT-001` §3 "Out of Scope — 관리자·사용자 주도 취소·환불" | "관리자 주도 취소·환불은 향후 백오피스 주문 관리 SPEC(칸반 카드 t12로 이미 백로그에 등재)의 몫이다" | REQ-ADMIN-013 ~ 017 (취소 시 감사 로그 계약과 재고 복원 부작용을 승계) |
| `src/middleware.ts` 문서 주석(REQ-AUTH-022) | "A real frontend serving protected admin pages would need a same-origin API-call pattern... outside this SPEC's API-only scope" | REQ-ADMIN-001 ~ 004 (관리자 세션 판정 + 진입 화면) |

### 소비하는 계약 (변경하지 않음)

| 출처 | 형태 | 이 SPEC에서의 쓰임 |
|---|---|---|
| `SPEC-AUTH-001` `Role` enum(`customer`/`admin`), `User.role` | DB 컬럼 | 관리자 판정 기준 |
| `SPEC-AUTH-001` `hashRefreshToken()`(`session.ts`, 이미 export됨) | 함수 | 쿠키 원문 → DB 조회 키로 변환. **재구현하지 않고 그대로 import** |
| `SPEC-AUTH-001` `POST /api/auth/login` | API | 관리자 로그인 화면이 그대로 호출(REQ-ADMIN-004). 로그인 로직 자체는 변경하지 않음 |
| `SPEC-AUTH-001` `src/middleware.ts`(REQ-AUTH-022) | 미들웨어 | **완전히 무변경(PRESERVE)** — 이 SPEC의 페이지·API는 `/admin` 매처와 충돌하지 않는 별도 경로에 둔다(design.md §1) |
| `SPEC-ORDER-001` `Order`/`OrderItem`(Prisma) | 모델 | 목록·상세 조회 대상 |
| `SPEC-PAYMENT-001` `markOrderCancelledAndRestoreStock()` 패턴 | 함수(재고 복원 로직) | `paid → cancelled` 소스 상태 처리 로직의 참조 구현. **재고 증가·쿠폰 해제 부작용을 동일하게 재현**하되, `pending_payment` 소스도 포함해야 하므로 관리자 전용 함수로 별도 작성(design.md §2 — payment-repository.ts는 PAYMENT-001 소유라 수정하지 않음) |
| `SPEC-PAYMENT-001` `PaymentAuditLog` / `PaymentEventSource` enum | 모델/enum | REQ-ADMIN-014가 이 enum에 관리자 트리거 값 1개를 추가(EXTEND, 기존 두 값은 무변경) |
| `SPEC-CATALOG-001/002` 페이지네이션 관례(`page`/`pageSize`) | 함수 시그니처 패턴 | 관리자 주문 목록 조회에 동일 패턴 적용 |
| `SPEC-AUTH-001` CSRF 방지(REQ-AUTH-023) | 패턴 | 상태 변경 API(쿠키 기반 인증 + 상태 변경)에 동일 방식 적용 |

---

## §2. 요구사항 (GEARS, REQ-ADMIN-001 ~ 018)

Tier L — 요구사항 상한 25개 이내(현재 18개). 신규 도메인이므로 001부터 시작한다.

### 관리자 세션 판정 (REQ-ADMIN-001 ~ 003)

- **REQ-ADMIN-001** (Ubiquitous): 관리자 세션 판정 로직은 요청이 제시한 기존 리프레시 토큰 쿠키를 서버에서 읽고, 그 값을 해시해 유효(폐기되지 않고 만료되지 않은) `RefreshToken` 행과 대조한 뒤, 그 행에 연결된 `User.role`이 `admin`일 때에만 그 요청을 관리자로 인정해야 한다.
- **REQ-ADMIN-002** (Unwanted, shall not): 관리자 세션 판정 로직은 새 쿠키를 발급하거나, 리프레시 토큰을 회전(재발급)시키거나, `src/middleware.ts`의 기존 동작을 변경해서는 안 된다 — 기존 리프레시 토큰을 읽기 전용으로만 조회한다.
- **REQ-ADMIN-003** (When — 이벤트 탐지형): 관리자 페이지나 관리자 API에 대한 요청이 유효한 관리자 세션을 제시하지 못하면(쿠키 없음, 만료, 폐기됨, 또는 `role`이 `admin`이 아님 중 어느 사유든), 요청은 거부되어야 하며 그 구체적 사유(쿠키 없음 vs 권한 없음 등)를 클라이언트가 구별할 수 있는 형태로 노출해서는 안 된다.

### 관리자 로그인 진입점 (REQ-ADMIN-004 ~ 006)

- **REQ-ADMIN-004** (Ubiquitous): 관리자 백오피스는 기존 `/admin` RBAC 미들웨어 매처와 겹치지 않는 별도 경로에 로그인 화면을 제공해야 하며, 그 화면은 이메일과 비밀번호를 기존 `/api/auth/login`으로 그대로 제출해야 한다(로그인 로직을 재구현하지 않음).
- **REQ-ADMIN-005** (When): 로그인이 성공하고 그 세션의 `role`이 `admin`이면, 관리자 로그인 화면은 관리자 주문 목록으로 이동시켜야 한다.
- **REQ-ADMIN-006** (When — 이벤트 탐지형): 로그인 자격 증명 자체는 유효했으나 그 세션의 `role`이 `admin`이 아니면, 관리자 백오피스는 관리자 목록·상세 어떤 데이터도 노출하지 않고 진입을 거부해야 한다.

### 관리자 주문 목록 (REQ-ADMIN-007 ~ 009)

- **REQ-ADMIN-007** (When): 유효한 관리자 세션으로 관리자 주문 목록에 진입하면, 백오피스는 특정 게스트 귀속에 한정되지 않은 전체 주문을 페이지 단위로(주문번호·상태·수령인 이름·총액·주문일시를 항목마다) 표시해야 한다.
- **REQ-ADMIN-008** (When): 상태 필터 값이 요청에 포함되어 있으면, 관리자 주문 목록은 그 `OrderStatus`와 일치하는 주문만 반환해야 한다.
- **REQ-ADMIN-009** (Ubiquitous): 관리자 주문 목록의 페이지네이션은 기존 카탈로그 조회가 쓰는 `page`/`pageSize` 방식을 따라야 하며, 새로운 페이지네이션 방식을 도입해서는 안 된다.

### 관리자 주문 상세 및 상태 변경 (REQ-ADMIN-010 ~ 015)

- **REQ-ADMIN-010** (When): 유효한 관리자 세션으로 관리자 주문 상세에 진입하면, 백오피스는 그 주문의 배송지 스냅샷, 항목별 상품명·단가·수량, 금액 내역, 현재 상태를 표시해야 한다.
- **REQ-ADMIN-011** (Unwanted, shall not): 관리자 주문 상세는 결제 수단 정보나 PG `paymentKey`를 화면이나 응답 본문에 노출해서는 안 된다.
- **REQ-ADMIN-012** (Ubiquitous): 관리자 백오피스가 수행할 수 있는 상태 전이는 `pending_payment → cancelled`와 `paid → cancelled` 두 가지뿐이어야 하며, 어떤 소스 상태에서도 관리자가 `paid`로 전이시키는 경로를 가져서는 안 된다 — 결제 완료 전이는 오직 `SPEC-PAYMENT-001`의 승인(confirm)·웹훅 경로만의 권한이다.
- **REQ-ADMIN-013** (When — 이벤트 탐지형): 관리자가 REQ-ADMIN-012가 정하지 않은 상태 전이를 요청하면(예: 이미 `cancelled`인 주문의 재전이, 또는 `paid`로의 전이 요청), 상태 변경 서비스는 요청을 거부해야 하며 주문·재고·감사 로그 어느 것도 변경해서는 안 된다.
- **REQ-ADMIN-014** (When): 관리자가 유효한 취소 전이를 요청하면, 상태 변경 서비스는 하나의 트랜잭션 안에서 — 주문을 `cancelled`로 전이시키고, 주문 항목마다 그 수량만큼 상품 재고를 복원하고, 그 주문에 적용된 쿠폰이 있으면 그 사용분을 해제해야 한다(`SPEC-PAYMENT-001` `REQ-PAYMENT-014`가 `paid` 소스에 대해 수행하는 것과 동일한 부작용을, `pending_payment` 소스에도 동일하게 적용).
- **REQ-ADMIN-015** (Ubiquitous): 관리자가 트리거한 모든 취소 전이는 정확히 하나의 `PaymentAuditLog` 행을 남겨야 하며, 그 행의 트리거 출처는 승인 API 응답이나 웹훅과 구별되는 관리자 전용 값으로 기록되어야 한다(`SPEC-PAYMENT-001` `REQ-PAYMENT-001`의 감사 추적 불변식을 그대로 승계).

### 경계 (REQ-ADMIN-016 ~ 018)

- **REQ-ADMIN-016** (Ubiquitous): 상태 변경 API는 쿠키 기반 세션으로 인증되는 상태 변경 요청이므로, `SPEC-AUTH-001`의 `REQ-AUTH-023`이 요구하는 것과 동일한 CSRF 방지 메커니즘을 적용해야 한다.
- **REQ-ADMIN-017** (Unwanted, shall not): 관리자 API는 페이지 진입 시점에 판정된 관리자 여부를 재사용해서는 안 되며, 상태 변경을 포함한 모든 쓰기 요청마다 관리자 세션을 다시 판정해야 한다.
- **REQ-ADMIN-018** (Unwanted, shall not): 이 SPEC은 `src/middleware.ts`, `SPEC-AUTH-001`의 토큰 발급·회전·로그아웃 로직, `SPEC-PAYMENT-001`의 승인·웹훅 처리 로직을 변경해서는 안 된다.

---

## §3. Out of Scope

이 SPEC이 **만들지 않는 것들**이다.

### Out of Scope — 배송(이행) 상태 기계 및 새 상태값 (기반 부재로 인한 제외)

- `preparing`/`shipped`/`delivered` 같은 이행 상태값 추가, 운송장 번호, 배송 상태 전이 UI는 범위 밖이다.
- 근거: `SPEC-ORDER-003` §3이 이미 이 제외를 확정했고(`OrderStatus` 3종 외 신규 상태값 미도입), 백로그 카드 `t24`가 그 후속을 추적한다. `t24`는 이 SPEC(관리자 백오피스)을 **미래의** 전이 주체로 지목했을 뿐, 이 SPEC이 `t24`를 흡수한다는 뜻이 아니다(research.md §1). 이 SPEC은 `t24`의 선행조건("전이 주체 확정") 하나만 채운다.
- 넘긴 곳: 백로그 카드 `t24`(`SPEC-SHIPPING-001` 후보).

### Out of Scope — 상품/카탈로그 관리자 화면 (별도 백로그 카드)

- 상품 등록·수정·재고 조정 관리자 화면과 API는 범위 밖이다(`product.md` 핵심 기능 #6의 다른 절반).
- 넘긴 곳: 백로그 카드 `t11`("관리자 상품 등록/수정 백오피스"). 이 SPEC이 만드는 관리자 세션 판정 로직(REQ-ADMIN-001~003)은 `t11`이 그대로 재사용할 수 있게 설계한다(design.md §1).

### Out of Scope — 관리자 계정 프로비저닝

- 관리자 역할(`role: admin`)을 가진 `User`를 생성하는 화면·API·가입 플로우는 범위 밖이다.
- 근거: `POST /api/auth/signup`(REQ-AUTH-002)은 항상 `customer` 기본값으로 생성하며, 저장소 어디에도 관리자 계정을 만드는 경로가 없다(research.md §8). 관리자 계정은 Prisma seed나 수동 DB 갱신으로 확보하는 운영 절차로 취급하며, 이 SPEC의 산출물이 아니다.

### Out of Scope — 세분화된(fine-grained) 관리자 권한

- 상품 편집 권한과 주문 취소 권한을 별도로 구분하는 세밀한 RBAC, 역할 계층, 커스텀 퍼미션은 범위 밖이다.
- 근거: `SPEC-AUTH-001` §3 "Out of Scope — 관리자 세분화(per-action) 권한"이 이미 이 제외를 확정했다. 이 SPEC은 단일 `admin` 역할만 다룬다.

### Out of Scope — 환불·부분 취소·부분 환불

- 결제대행사(PG)를 통한 실제 환불 처리, 부분 취소, 부분 환불 UI·API는 범위 밖이다.
- 근거: `SPEC-PAYMENT-001` §3 "Out of Scope — 관리자·사용자 주도 취소·환불"이 명시한 그대로다. 이 SPEC은 주문 상태를 `cancelled`로 전이시키고 재고를 복원할 뿐, PG 환불 API를 호출하지 않는다.

### Out of Scope — 주문 내용 수정

- 관리자가 배송지·수령인·수량·항목 등 주문 내용 자체를 편집하는 기능은 범위 밖이다. 이 SPEC은 **상태 전이만** 다룬다.

### Out of Scope — 관리자 상태 변경 알림 (이메일/SMS)

- 주문 취소 시 고객에게 이메일·SMS로 알리는 것은 범위 밖이다. 근거는 `SPEC-ORDER-001`/`SPEC-ORDER-003`과 동일 — 외부 발송 채널 미확정 + 개인정보 최소 수집.

### Out of Scope — 일괄(bulk) 상태 변경

- 여러 주문을 한 번에 선택해 일괄 취소하는 기능은 범위 밖이다. 이 SPEC은 주문 하나씩의 전이만 다룬다.

### Out of Scope — 감사 로그 열람 UI

- `PaymentAuditLog`를 관리자 화면에서 직접 조회하는 기능은 범위 밖이다. 이 SPEC은 REQ-ADMIN-015에 따라 로그를 **기록**만 하며, 그 열람 화면은 만들지 않는다.

### Out of Scope — 검색(주문번호/수령인 등)

- 주문번호나 수령인 이름으로 검색하는 기능은 범위 밖이다. 이 SPEC의 필터는 상태(REQ-ADMIN-008) 하나로 한정한다.

### Out of Scope — 고객 대면 화면 변경

- `/checkout`, `/orders/lookup`, `/cart` 등 고객 대면 화면과 API는 이 SPEC이 건드리지 않는다.
