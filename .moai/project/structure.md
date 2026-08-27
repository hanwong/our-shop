# structure.md — our-shop

> **⚠️ 안내**: 이 프로젝트는 아직 코드가 작성되지 않았습니다. 아래 구조는 기존 코드 분석 결과가 아니라, TypeScript/JavaScript 기반 B2C 이커머스 웹앱에 적합한 **제안(proposed) 시작 구조**입니다. 실제 프레임워크 선택(예: Next.js) 확정 후 조정될 수 있습니다.

## 제안 기술 스택 전제

- 언어: TypeScript
- 프레임워크(권장, 미확정): Next.js (App Router) + Node.js — 상세 근거는 `tech.md` 참고
- 테스트: Jest 또는 Vitest

## 제안 디렉터리 구조 (Proposed)

```
our-shop/
├── src/
│   ├── app/                        # Next.js App Router 라우트 (프레임워크 확정 시)
│   │   ├── (shop)/                 # 고객용 쇼핑몰 화면 그룹
│   │   │   ├── page.tsx            # 홈/메인
│   │   │   ├── products/
│   │   │   │   ├── page.tsx        # 상품 카탈로그/검색 목록
│   │   │   │   └── [productId]/
│   │   │   │       └── page.tsx    # 상품 상세 + 리뷰
│   │   │   ├── cart/
│   │   │   │   └── page.tsx        # 장바구니
│   │   │   ├── checkout/
│   │   │   │   ├── page.tsx        # 체크아웃 (회원/게스트 공통)
│   │   │   │   └── guest/
│   │   │   │       └── page.tsx    # 게스트 체크아웃 전용 플로우
│   │   │   └── orders/
│   │   │       ├── page.tsx        # 주문 내역
│   │   │       └── [orderId]/
│   │   │           └── page.tsx    # 주문/배송 상태 상세
│   │   ├── (admin)/                # 관리자 전용 화면 그룹
│   │   │   └── admin/
│   │   │       ├── products/       # 관리자 상품 관리
│   │   │       └── orders/         # 관리자 주문 관리
│   │   └── api/                    # API 라우트 (BFF 레이어)
│   │       ├── products/
│   │       ├── cart/
│   │       ├── checkout/
│   │       │   └── webhook/        # PG 결제 웹훅 수신
│   │       ├── orders/
│   │       ├── reviews/
│   │       └── admin/
│   │
│   ├── features/                   # 도메인별 비즈니스 로직 (프레임워크 비의존)
│   │   ├── catalog/                # 상품 카탈로그/검색 도메인
│   │   │   ├── services/
│   │   │   ├── repositories/
│   │   │   └── types/
│   │   ├── cart/                   # 장바구니 도메인
│   │   ├── checkout/               # 체크아웃/PG 연동 도메인
│   │   │   ├── payment-gateway/    # PG adapter (결제 정합성 핵심 경계)
│   │   │   └── services/
│   │   ├── orders/                 # 주문/배송 상태 도메인
│   │   ├── reviews/                # 상품 리뷰 도메인
│   │   └── admin/                  # 관리자 상품·주문 관리 도메인
│   │
│   ├── components/                 # 재사용 UI 컴포넌트 (반응형/모바일 우선)
│   │   ├── ui/                     # 버튼, 인풋 등 기본 컴포넌트
│   │   ├── layout/                 # 헤더, 푸터, 네비게이션
│   │   └── product/                # 상품 카드 등 도메인 UI
│   │
│   ├── lib/                        # 데이터/인프라 레이어
│   │   ├── db/                     # 데이터베이스 클라이언트 및 스키마
│   │   ├── payment/                # PG SDK/클라이언트 래퍼
│   │   ├── auth/                   # 인증(회원/게스트 세션)
│   │   └── config/                 # 환경설정
│   │
│   ├── middleware.ts               # 접근 제어, 관리자 라우트 보호 등
│   └── types/                      # 전역 타입 정의
│
├── tests/
│   ├── unit/                       # Jest/Vitest 유닛 테스트
│   ├── integration/                # 카탈로그/체크아웃 등 통합 테스트
│   └── e2e/                        # 주요 구매 플로우 E2E (선택)
│
├── public/                         # 정적 자산 (이미지 등)
├── .moai/                          # MoAI-ADK SPEC/문서 관리
├── package.json
├── tsconfig.json
└── README.md
```

## 레이어링 원칙 (제안)

- **`app/`**: 라우팅과 화면 조립만 담당 (프레임워크 의존 계층).
- **`features/`**: 실제 도메인 로직을 담아 프레임워크에서 분리 — 테스트 용이성과 향후 프레임워크 교체 유연성 확보.
- **`lib/`**: 외부 시스템(DB, PG) 접근을 캡슐화 — 특히 `checkout/payment-gateway`는 결제 정합성이 최우선 제약인 만큼 별도 경계로 명확히 분리해 감사(auditing)와 테스트를 집중한다.
- **`components/`**: 반응형/모바일 우선 UI 요구사항을 반영한 재사용 컴포넌트.

## Out-of-scope 관련 메모

- 외부 배송사 실시간 추적 API 연동 코드는 이번 구조에 포함하지 않는다 (`features/orders`는 자체 배송 상태 필드만 관리).
- 멀티 벤더/마켓플레이스 관련 디렉터리(예: `features/vendors`)는 이번 범위에서 제안하지 않는다.

---

**주의**: 위 구조는 실제 구현 전 제안 사항이며, 프레임워크 확정 및 개발 진행에 따라 변경될 수 있습니다.

## 실제 디렉터리 구조 (SPEC-AUTH-001, 2026-08-27 sync)

인증 기능은 위 제안 구조 중 `app/api`, `lib/auth`, `lib/db`, `middleware.ts` 부분을 그대로 따랐습니다. 다만 `features/` 도메인 계층은 이번 SPEC 범위(인증만)에서는 아직 만들지 않았습니다 — 카탈로그/장바구니/체크아웃 등 다른 도메인이 추가될 때 도입 여부를 재검토합니다.

```
our-shop/
├── src/
│   ├── app/
│   │   └── api/auth/
│   │       ├── signup/route.ts
│   │       ├── login/route.ts
│   │       ├── refresh/route.ts
│   │       ├── logout/route.ts
│   │       ├── google/route.ts
│   │       └── google/callback/route.ts
│   ├── lib/
│   │   ├── auth/            # password, jwt, session, cookies, csrf, rate-limit, google-oauth
│   │   └── db/               # Prisma client singleton
│   ├── middleware.ts          # /admin RBAC gate
│   └── types/auth.ts
├── prisma/
│   ├── schema.prisma          # User / OAuthAccount / RefreshToken
│   └── migrations/
├── tests/
│   ├── unit/                  # per-module unit tests
│   └── integration/           # AC-AUTH-005 timing test, refresh↔logout cross-handler test
└── (README.md / CHANGELOG.md at repo root — see there)
```

`features/`, `components/`, `public/` from the original proposal are not yet created — they belong to a future catalog/cart/checkout SPEC, not this one.
