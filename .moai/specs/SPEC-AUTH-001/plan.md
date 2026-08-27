---
id: SPEC-AUTH-001
status: completed
tier: L
---

# Plan: SPEC-AUTH-001 — 회원 가입·로그인 및 JWT 세션 관리

## §1. 개요 / 목표 (Overview / Goal)

### 1.1 무엇을, 왜

`our-shop`은 아직 코드가 없는 신규 B2C 패션 이커머스 프로젝트다. `product.md`의 목표는 "고객이 모바일 브라우저를 포함한 어떤 화면에서도 편하게 상품을 둘러보고, 장바구니에 담고, 결제까지 마칠 수 있는 반응형 웹 쇼핑몰"이며, 진입 장벽을 낮추기 위해 **게스트(비회원) 구매**를 우선 지원한다. 즉 회원 인증은 이 프로젝트의 "필수 관문"이 아니라 **선택적으로 더 나은 경험을 제공하는 계층**이다 — 회원가입 없이도 구매가 가능해야 한다는 제약은 이번 SPEC이 깨지 않는다.

그럼에도 회원 인증이 필요한 이유는 `product.md`의 다음 사용 사례·로드맵 후보에서 나온다:

- **사용 사례 2 (회원 재구매)**: "로그인 사용자가 이전 구매 이력을 참고해 재구매하고, 주문/배송 상태를 확인" — 로그인 상태 유지가 전제.
- **사용 사례 4/5 (운영자의 상품/주문 관리)**: 관리자 전용 화면은 회원(관리자 계정) 인증 및 권한 분리가 필요.
- **로드맵 후보 #4 (인증/인가 SPEC)**: "회원가입/로그인 방식, 관리자 권한 분리 방식 정의" — 이번 SPEC이 정확히 이 후보를 구체화한다.

### 1.2 핵심 제약과의 정합성

- **개인정보 최소 수집 원칙** (`product.md` 핵심 제약): JWT 클레임에는 내부 user id(`sub`)만 담고 이메일/이름/주소 등 PII는 담지 않는다(토큰은 base64url 인코딩일 뿐 암호화가 아니므로). Google 프로필 필드도 UI가 실제로 쓰는 것만 저장한다(연구 결과 §4).
- **결제 데이터 정합성 최우선** (`product.md` 핵심 제약): 이번 SPEC은 결제(PG) 로직을 다루지 않지만, 향후 결제 SPEC이 "누가 이 주문을 했는가"를 신뢰할 수 있으려면 이 SPEC의 세션 발급 경로가 정확하고 안전해야 한다 — 인증은 결제 정합성의 전제 조건 중 하나다.
- **범위 확정 (interview.md)**: 이메일/비밀번호 회원가입·로그인 + JWT 액세스/리프레시 토큰 발급·재발급·로그아웃 + Google OAuth 소셜 로그인. `jose`(JWT) + `bcrypt`(비밀번호 해싱)로 직접 구현하며 NextAuth/Auth.js 등 프레임워크는 사용하지 않는다. 비밀번호 찾기(이메일 재설정)는 범위 밖(별도 후속 SPEC).

### 1.3 이번 SPEC의 핵심 설계 원칙

> research.md §2의 핵심 발견: **이메일/비밀번호 로그인과 Google OAuth 로그인은 "하나의 공유된 세션 발급 함수"로 수렴하는 두 개의 서로 다른 정문(front door)일 뿐이다.** 어느 경로로 들어오든, 로그인이 확정된 `userId`에 대해 정확히 동일한 JWT 액세스+리프레시 토큰 쌍을 발급하며, 이후의 미들웨어/리프레시/로그아웃 로직은 완전히 동일하다. 이 원칙이 §3(기술 접근)의 구조를 결정한다.

---

## §2. 제안 GEARS 요구사항 (초안 — 최종본은 spec.md §2 참고)

> **✅ 확정 (2026-08-26)**: Tier가 **L**로 확정되었고(§6), 아래 27개 후보 요구사항은 spec.md §2 작성 시 밀접하게 연관된 항목을 복합 절(`[Where][While][When] the <subject> shall <behavior>`)로 통합해 **REQ-AUTH-001 ~ REQ-AUTH-025**(Tier L 상한 25개 이내)로 재부여했다. 아래 후보 목록은 spec.md REQ 번호로의 매핑 근거를 보존하기 위한 **추적용 기록**으로 유지한다 — 요구사항의 최종 SSOT는 spec.md §2이다.
>
> 매핑 요약: A1+A4 → REQ-AUTH-001, A2 → REQ-AUTH-002, A3 → REQ-AUTH-003, B1 → REQ-AUTH-004, B2+B3 → REQ-AUTH-005, C1 → REQ-AUTH-006, C2 → REQ-AUTH-007, C3 → REQ-AUTH-008, C4 → REQ-AUTH-009, D1 → REQ-AUTH-010, D2 → REQ-AUTH-011, D3 → REQ-AUTH-012, E1 → REQ-AUTH-013, F1 → REQ-AUTH-014, F2 → REQ-AUTH-015, F3 → REQ-AUTH-016, F4 → REQ-AUTH-017, F5 → REQ-AUTH-018, **F6(auto-link 확정) → REQ-AUTH-019**, G1+G2 → REQ-AUTH-020, **G3+G4(2026-08-26 plan-audit 반영 통합, 수치 확정: 분당 5회/15분 락아웃) → REQ-AUTH-021**, G5 → REQ-AUTH-023, G6 → REQ-AUTH-024, G7 → REQ-AUTH-025.
>
> **REQ-AUTH-022(신규, 2026-08-26 plan-audit iteration 1 사용자 확정)**: 원본 27개 후보 목록(A~G)에는 없던 항목이다 — §5.5에서 확정된 관리자 라우트 RBAC 미들웨어(role 확인)를, G3+G4 통합으로 확보한 REQ 슬롯에 배정했다.

### A. 회원가입 (Signup)

- **A1 (Ubiquitous)**: 인증 서비스는 회원가입 요청의 이메일 형식과 비밀번호 길이를 **서버 사이드에서** 검증해야 한다(SHALL) — 클라이언트 검증만으로 신뢰하지 않는다.
- **A2 (When)**: 사용자가 유효한 이메일+비밀번호로 회원가입을 요청하면, 인증 서비스는 bcrypt(cost factor 12)로 비밀번호를 해싱해 `User` 레코드를 생성해야 한다.
- **A3 (When — 이벤트 탐지형)**: 이미 가입된 이메일로 회원가입이 시도되면, 인증 서비스는 중복 가입 오류를 반환해야 한다.
- **A4 (Where)**: 비밀번호 바이트 길이가 72바이트(bcrypt 절단 한계)를 초과하면, 인증 서비스는 요청을 거부하거나 SHA-256으로 사전 해시한 뒤 bcrypt를 적용해야 한다.

### B. 로그인 (이메일/비밀번호)

- **B1 (When)**: 사용자가 이메일+비밀번호로 로그인을 요청하고 자격 증명이 유효하면, 인증 서비스는 §C의 공유 세션 발급 함수를 통해 액세스+리프레시 토큰 쌍을 발급해야 한다.
- **B2 (When — 이벤트 탐지형, 타이밍 공격 완화)**: 존재하지 않는 이메일로 로그인이 시도되면, 인증 서비스는 더미 bcrypt 비교(또는 동등한 지연)를 수행해 응답 시간을 실제 비밀번호 불일치 케이스와 유사하게 유지해야 한다.
- **B3 (Unwanted, shall not)**: 인증 서비스는 로그인 실패 사유(이메일 미존재 vs 비밀번호 불일치)를 클라이언트가 구분할 수 있는 형태로 노출해서는 안 된다(SHALL NOT).

### C. JWT 발급 — 공유 세션 발급 경로

- **C1 (Ubiquitous)**: 공유 세션 발급 함수는 액세스 토큰에 `sub`(내부 user id) · `iat`/`exp` · `iss`/`aud` · `jti` · 최소 `role` 클레임만 포함해야 하며, 이메일·이름·주소 등 PII 또는 외부 제공자 시크릿을 포함해서는 안 된다.
- **C2 (Ubiquitous)**: 액세스 토큰의 기본 만료는 15분이며 환경변수로 조정 가능해야 한다.
- **C3 (Ubiquitous)**: 리프레시 토큰은 opaque random string으로 발급되어야 하며, DB에는 해시값만 저장(원문 미저장)하고, httpOnly + Secure + SameSite 쿠키로 클라이언트에 전달해야 한다. 기본 만료는 30일이며 환경변수로 조정 가능해야 한다.
- **C4 (Ubiquitous)**: 액세스 토큰은 클라이언트 메모리에만 보관되어야 하며, `localStorage`/`sessionStorage`에 저장되어서는 안 된다(Unwanted).

### D. 리프레시 + 로테이션

- **D1 (When)**: `/auth/refresh` 요청이 유효한 리프레시 토큰과 함께 도착하면, 인증 서비스는 새 리프레시 토큰을 발급하고 기존 토큰을 **동일 트랜잭션 내에서** 무효화해야 한다.
- **D2 (When — 이벤트 탐지형, 재사용 탐지)**: 이미 로테이션되어 무효화된 리프레시 토큰이 재사용되면, 인증 서비스는 해당 토큰이 속한 **전체 token family를 즉시 폐기**하고 재인증을 요구해야 한다.
- **D3 (When — 이벤트 탐지형)**: 만료된 리프레시 토큰으로 `/auth/refresh` 요청이 오면, 인증 서비스는 401을 반환하고 새 토큰을 발급해서는 안 된다.

### E. 로그아웃

- **E1 (When)**: 사용자가 로그아웃을 요청하면, 인증 서비스는 해당 리프레시 토큰을 DB에서 폐기(revoke)하고 쿠키를 만료시켜야 한다.
- (참고: "모든 기기에서 로그아웃"(전체 token family 폐기)은 interview.md에서 명시적으로 확정된 범위가 아니다 — §5 리스크 항목 참고.)

### F. Google OAuth 로그인 / 계정 연결

- **F1 (When)**: 사용자가 `/api/auth/google` 진입점을 호출하면, 인증 서비스는 CSRF 방지용 서명된 `state`와 함께 Google 동의 화면 URL(`scope: openid,email,profile`)을 생성해야 한다.
- **F2 (When — 이벤트 탐지형)**: Google 콜백이 유효하지 않거나 위조된 `state`와 함께 도착하면, 인증 서비스는 요청을 거부해야 한다.
- **F3 (When)**: Google 콜백에서 authorization code 교환이 성공하면, 인증 서비스는 Google ID 토큰을 검증해야 한다 — 서명(JWKS), `iss === https://accounts.google.com`, `aud`가 클라이언트 ID와 일치, `email_verified === true`를 모두 확인한다.
- **F4 (When)**: 검증된 Google 계정이 기존 `OAuthAccount(provider="google", providerAccountId=<google sub>)`와 매칭되면, 인증 서비스는 매칭된 `User`에 대해 §C의 공유 세션 발급 함수로 세션을 발급해야 한다.
- **F5 (Where)**: 매칭되는 `OAuthAccount`가 없고 해당 이메일의 기존 `User`도 없는 경우, 인증 서비스는 새 `User`(`passwordHash: null`) + `OAuthAccount`를 하나의 트랜잭션으로 생성한 뒤 세션을 발급해야 한다.
- **F6 (Where — ✅ 확정: auto-link)**: 매칭되는 `OAuthAccount`는 없지만 검증된 Google 로그인 이메일(`email_verified === true`)이 기존 이메일/비밀번호 `User`의 이메일과 일치하는 경우, 인증 서비스는 **별도 확인 단계 없이 자동으로** 해당 `User`에 `OAuthAccount(provider="google", providerAccountId=<google sub>)`를 연결(link)한 뒤 §C의 공유 세션 발급 함수로 세션을 발급해야 한다. 근거는 §5.1 참고.

### G. 보안 공통 (research.md §5 — 보안 함정 → 수락 기준 후보)

- **G1 (Ubiquitous)**: 인증 서비스는 JWT 검증 시 허용 알고리즘을 화이트리스트로 명시적으로 고정해야 하며(`jose`의 `algorithms` 옵션), 토큰 헤더의 `alg` 값을 신뢰해서는 안 된다(`"alg": "none"` 공격 방지).
- **G2 (Ubiquitous)**: 인증 서비스는 모든 토큰 발급 시 `exp`/`iss`/`aud`를 설정해야 하며, 모든 검증 시 이 세 값을 확인해야 한다.
- **G3 (While)**: 동일 IP 또는 동일 계정에서 로그인 요청이 분당 임계치(권장 3-5회)를 초과하는 동안, 인증 서비스는 후속 요청에 임시 소프트 락아웃(15-20분)을 적용해야 한다 — 영구 잠금은 그 자체로 DoS 벡터이므로 사용하지 않는다.
- **G4 (Where)**: `/auth/refresh` 및 Google OAuth 콜백 엔드포인트에도, 인증 서비스는 로그인과 동일한 rate limiting을 적용해야 한다.
- **G5 (Where)**: 쿠키 기반 `/auth/refresh` 또는 `/auth/logout` 요청이 도착하면, 인증 서비스는 `SameSite=Lax`(또는 `Strict`) 쿠키 속성에 더해 CSRF 방지 메커니즘(예: double-submit 토큰 또는 synchronizer 토큰)을 적용해야 한다.
- **G6 (Unwanted, shall not)**: JWT 서명 시크릿, Google client secret 등 어떤 시크릿도 `NEXT_PUBLIC_` 접두사가 붙은 환경변수로 노출되어서는 안 된다.
- **G7 (Ubiquitous)**: 인증 서비스는 원문 비밀번호 또는 해시값을 로그로 남겨서는 안 된다(Unwanted).

---

## §3. 기술 접근 (Technical Approach)

### 3.1 Prisma 스키마 형태 (research.md §4 기반, 개념 설계 — 최종 코드 아님)

```
User
  id             (PK)
  email          (unique)
  passwordHash   (nullable — OAuth 전용 사용자는 null)
  emailVerified  (boolean)
  role           (customer | admin)
  createdAt / updatedAt

OAuthAccount
  id
  userId              (FK → User, cascade delete)
  provider            (e.g. "google" — 확장 가능)
  providerAccountId   (Google의 sub)
  @@unique([provider, providerAccountId])   ← 계정 충돌/이중 연결 방지

RefreshToken
  id
  userId              (FK → User, cascade delete)
  tokenHash
  familyId
  expiresAt
  revokedAt           (nullable)
  replacedByTokenId   (nullable, self-FK)
  createdAt
  userAgent / ip       (선택 — 추후 "활성 세션" UI용)
  index: userId, tokenHash
```

- 이 3-테이블 구조가 §2.C의 공유 JWT 발급 경로를 뒷받침하며, `structure.md`가 제안한 `lib/auth/`·`lib/db/` 레이어링과 정확히 맞물린다.
- `User`에는 Google 프로필의 locale/picture 등 UI가 실제로 쓰지 않는 필드는 저장하지 않는다(개인정보 최소 수집 원칙).
- `OAuthAccount`에는 Google 자체의 access/refresh token은 저장하지 않는다(로그인 목적 이상으로 Google API를 호출하지 않는 한 불필요).

### 3.2 공유 세션 발급 함수 설계

이메일/비밀번호 로그인과 Google OAuth 콜백 양쪽 모두, 최종적으로 확정된 `userId` 하나를 가지고 **동일한 함수**를 호출해 세션을 만든다 (가칭 `issueSession(userId): { accessToken, refreshToken, refreshTokenExpiresAt }`):

1. `RefreshToken` 레코드 생성(opaque random string 생성 → 해시하여 저장, `familyId` 신규 발급).
2. `jose`로 액세스 토큰 서명(§2.C1 클레임 구성).
3. 리프레시 토큰은 httpOnly+Secure+SameSite 쿠키로 설정, 액세스 토큰은 응답 바디로 반환(클라이언트가 메모리에 보관).

리프레시(`/auth/refresh`)는 이 함수를 "재사용"하지 않고 별도의 로테이션 로직(§2.D)을 거치되, 최종적으로 동일한 클레임 구성 규칙(§2.C1)을 따르는 새 액세스 토큰을 발급한다 — 즉 클레임 구성 로직 자체는 공유되고, 발급 트리거(최초 로그인 vs 리프레시)만 다르다.

### 3.3 Google OAuth 플로우 형태 (research.md §2)

```
GET /api/auth/google
  → google-auth-library OAuth2Client로 동의 URL 생성 (state 서명 포함)
  → 302 리다이렉트

GET /api/auth/google/callback?code=...&state=...
  → state 검증
  → code를 토큰으로 교환
  → ID 토큰 검증 (iss, aud, email_verified)
  → OAuthAccount 조회 → User 확정 (§2.F4/F5/F6)
  → issueSession(userId) 호출 (§3.2)
  → 세션 쿠키 설정 후 클라이언트로 리다이렉트
```

`google-auth-library`의 `OAuth2Client`(Google 자체 저수준 클라이언트)를 사용한다 — "인증 프레임워크 미사용" 결정과 일관되며, 전체 `googleapis` 패키지보다 가볍다.

### 3.4 신규 환경변수 (research.md §6)

| 변수 | 용도 | 비고 |
|---|---|---|
| `JWT_ACCESS_SECRET` | 액세스 토큰 서명 키 | 비대칭 키(`JWT_ACCESS_PRIVATE_KEY`/`PUBLIC_KEY`)도 대안 |
| `JWT_ACCESS_TOKEN_EXPIRY` | 액세스 토큰 만료(기본 15분) | 하드코딩 금지, 설정 가능해야 함 |
| `JWT_REFRESH_TOKEN_EXPIRY` | 리프레시 토큰 만료(기본 30일) | 리프레시 토큰 자체는 서명된 JWT가 아니라 opaque 값이므로 `JWT_REFRESH_SECRET`는 불필요(설계 결정, §3.2) |
| `GOOGLE_CLIENT_ID` | Google OAuth 클라이언트 ID | |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 클라이언트 시크릿 | 서버 전용, `NEXT_PUBLIC_` 금지 |
| `GOOGLE_REDIRECT_URI` | OAuth 콜백 URI | 환경별로 다름 |
| `COOKIE_DOMAIN` | 쿠키 도메인 | `NODE_ENV`에 따라 `Secure` 파생 |

**⚠️ tech.md 정정 필요**: `tech.md`의 "필요 환경변수" 목록에 있는 `NEXTAUTH_SECRET`은 이번 SPEC에서 **stale**하다 — interview.md에서 NextAuth를 명시적으로 배제(직접 구현: `jose` + `bcrypt`)했으므로, 이 SPEC이 승인되면 `tech.md`의 해당 항목을 위 표의 변수명으로 교체해야 한다(sync 단계 또는 별도 문서 업데이트 작업).

---

## §4. 영향받는 파일/모듈 (Proposed — 아직 코드가 없으므로 전부 신규 생성 제안)

`structure.md`의 제안 레이어링(`app/` 라우팅, `lib/` 인프라)을 따른다. 아래는 **제안(proposed)** 목록이며 실제 구현 시 세부 파일 분할은 조정될 수 있다.

| 경로 | 역할 |
|---|---|
| `prisma/schema.prisma` | `User` / `OAuthAccount` / `RefreshToken` 모델 추가 (§3.1) |
| `src/lib/auth/password.ts` | bcrypt 해싱/비교, 72바이트 처리, 더미 비교(타이밍 완화) |
| `src/lib/auth/jwt.ts` | `jose` 기반 액세스 토큰 서명/검증, 알고리즘 화이트리스트(§2.G1) |
| `src/lib/auth/session.ts` | 공유 세션 발급 함수 `issueSession()` (§3.2), 리프레시 로테이션 로직 |
| `src/lib/auth/google-oauth.ts` | `OAuth2Client` 래퍼 — 동의 URL 생성, state 검증, ID 토큰 검증 |
| `src/lib/auth/rate-limit.ts` | 로그인/리프레시/OAuth 콜백 공통 rate limiting |
| `src/lib/auth/cookies.ts` | httpOnly/Secure/SameSite 쿠키 read/write 헬퍼 |
| `src/lib/db/` | Prisma client 초기화(기존 제안 경로 재사용) |
| `src/app/api/auth/signup/route.ts` | 회원가입 엔드포인트 |
| `src/app/api/auth/login/route.ts` | 로그인 엔드포인트 |
| `src/app/api/auth/refresh/route.ts` | 리프레시 엔드포인트 |
| `src/app/api/auth/logout/route.ts` | 로그아웃 엔드포인트 |
| `src/app/api/auth/google/route.ts` | Google OAuth 진입점 |
| `src/app/api/auth/google/callback/route.ts` | Google OAuth 콜백 |
| `src/middleware.ts` | 인증 필요 라우트 보호(액세스 토큰 검증) — `structure.md`가 이미 이 경로를 "접근 제어" 용도로 제안함 |
| `src/types/auth.ts` | 세션/토큰 관련 전역 타입 |
| `tests/unit/auth/*`, `tests/integration/auth/*` | TRUST 5 커버리지(85%+) 대응 유닛/통합 테스트 |

파일 수 추정: 신규 14-16개 소스 파일 + 테스트 파일. 이 추정치가 §6 Tier 판단의 근거 중 하나다.

---

## §5. 리스크 / 미해결 질문 (Risks / Open Questions)

### 5.1 ✅ 확정 — Google 계정 ↔ 기존 이메일/비밀번호 계정 매칭 정책: **auto-link**

research.md §2가 명시적으로 "실제 제품/보안 결정이며 수락 기준에 속한다"고 지목한 항목이며, 사용자가 **옵션 A — auto-link(자동 연결)**로 확정했다(2026-08-26).

검증된 Google 로그인 이메일이 **기존 이메일/비밀번호 `User`의 이메일과 일치하지만 `OAuthAccount`로는 연결되어 있지 않은 경우**, Google의 `email_verified === true`를 이메일 소유권 검증의 근거로 신뢰하고, 별도의 사용자 확인 단계 없이 기존 `User`에 자동으로 `OAuthAccount(provider="google", providerAccountId=<google sub>)`를 연결한 뒤 §C의 공유 세션 발급 함수로 세션을 발급한다(REQ-AUTH-019, spec.md §2 참고).

**기각된 대안 — 옵션 B (explicit-confirm)**: "이미 이 이메일로 가입된 계정이 있습니다 — 비밀번호로 로그인 후 연결하시겠습니까?" 같은 별도 확인 단계. 계정 탈취 벡터를 한 겹 더 줄이지만 UX 마찰이 추가되어 이번 SPEC에서는 채택하지 않았다.

**잔여 리스크(수용)**: Google 계정 이메일과 기존 계정 이메일이 우연히 같고 실제 소유자가 다른 경우(드묾) auto-link가 계정 탈취 벡터가 될 수 있다 — 이는 Google이 `email_verified === true`를 보장하는 한 발생 확률이 낮은 것으로 판단해 수용하며, acceptance.md의 보안 하드닝 기준(§ 보안 공통)에 이 트레이드오프를 명시한다.

### 5.2 (참고 — 정책 결정, 확정 상태) 리프레시 토큰 형태: opaque vs 서명 JWT

research.md 권장에 따라 **opaque random string + DB 해시 조회** 방식으로 확정한다(§2.C3, §3.4). 서명된 리프레시 JWT 방식도 가능했으나, "암호학적으로는 유효하지만 폐기되어야 하는" 모호성이 없어 opaque 방식이 더 단순하고 안전하다 — 이 결정은 research.md가 제시한 권장안을 그대로 채택한 것으로, 재론의 없이 진행 가능.

### 5.3 (낮은 우선순위, 확정 상태) "모든 기기에서 로그아웃"

interview.md에서 명시적으로 요청된 범위가 아니다. 기본값은 **단일 토큰 폐기(현재 세션만 로그아웃)**로 확정하고, "모든 기기 로그아웃"(전체 token family 폐기)은 이번 SPEC 범위 밖 — 후속 개선으로 남긴다. `RefreshToken` 스키마의 `familyId`가 이미 이를 지원하므로 향후 추가는 스키마 변경 없이 가능하다.

### 5.4 (낮은 우선순위, 확정 상태) 이메일 인증(verification) 플로우

`User.emailVerified` 필드는 스키마에 존재하지만(§3.1), 이메일/비밀번호 회원가입 시 "인증 메일 발송 → 링크 클릭 확인" 플로우는 비밀번호 재설정과 마찬가지로 **이번 범위 밖**으로 간주한다(별도 SPEC 후보). 기본값: 이메일/비밀번호 가입 시 `emailVerified: false`로 생성, Google OAuth 가입 시에는 OAuth 단계에서 이미 `email_verified` 검증을 거쳤으므로 `emailVerified: true`로 생성.

### 5.5 ✅ 확정 (2026-08-26, plan-audit iteration 1 반영) — 관리자(admin) 권한 분리의 경계

`product.md`는 관리자 화면(상품·주문 관리)을 별도 페르소나로 명시한다. plan-audit iteration 1 리뷰(D12)에서 본 항목이 다른 §5 리스크 항목과 달리 확정 마커 없이 남아 있음을 지적받아, 사용자가 다음과 같이 확정했다: 이번 SPEC은 `User.role`(customer/admin) 클레임을 JWT에 포함하는 것에 더해, `/admin` 라우트에 대한 **경량 미들웨어 수준 role 기반 접근 제어**(세션의 `role` 클레임이 `admin`인지 확인하고, 아니면 리다이렉트 또는 403 처리)까지 이번 SPEC 범위에 포함한다 — spec.md §2 **REQ-AUTH-022**(신규)로 반영. 액션 단위로 세분화된(fine-grained) 관리자 권한 체계(예: 상품 편집 권한과 주문 취소 권한의 분리)는 여전히 범위 밖이며 별도 SPEC으로 남긴다(spec.md §3 Out of Scope 참고). REQ 번호 예산은 REQ-AUTH-021(로그인 rate limiting)이 구 REQ-AUTH-022(refresh/OAuth 콜백에 대한 동일 rate limiting 적용)를 하나의 복합 GEARS 절로 흡수해 확보했다.

### 5.6 Rate limiting 저장소

`tech.md`는 Redis를 "선택적 추천"으로만 제시한다. 솔로 개발 초기 단계에서는 단일 인스턴스 in-memory sliding-window 방식으로 시작하고, 다중 인스턴스 배포 시점에 Redis 기반으로 전환하는 것을 기본값으로 제안한다 — 멀티 인스턴스 배포가 확정되기 전까지는 낮은 리스크.

---

## §6. SPEC Tier — ✅ **확정: Tier L** (2026-08-26)

### 6.1 확정 근거

`spec-workflow.md § SPEC Complexity Tier` 기준(LOC / 파일 수 / "constitutional" 여부)에 비추어 사용자가 다음 근거로 **Tier L**을 확정했다:

1. **파일 수**: §4 추정 14-16개 신규 소스 파일(+테스트) — Tier M 상한(5-15 files)의 경계에 있고, 테스트 파일까지 포함하면 Tier L 기준(> 15 files)을 넘어설 가능성이 높다.
2. **LOC**: JWT/비밀번호/세션 발급/OAuth/rate-limiting 5개 `lib/auth/` 모듈 + 6개 API 라우트 + 미들웨어 + Prisma 스키마 확장을 합치면, 테스트 코드(TRUST 5, 85%+ 커버리지 목표)까지 포함해 1000 LOC를 넘길 가능성이 크다.
3. **"Constitutional" 성격**: 이 SPEC은 이메일 인증 + JWT 세션 + OAuth + rate limiting이라는 **4개의 보안 critical 관심사가 하나의 발급 경로로 수렴**하는 구조다(§1.3). 인증 계층은 이후 모든 회원 기반 기능(재구매, 리뷰, 관리자 화면, 그리고 향후 결제 SPEC의 신뢰 기반)이 의존하는 기반 계층이므로, `product.md`가 결제 SPEC에 부여한 "최우선" 수준에 준하는 설계 rigor가 정당화된다.
4. **research.md가 이미 존재**: Tier L의 5-파일 세트(spec.md + plan.md + acceptance.md + design.md + research.md) 중 research.md는 이미 이번 plan-phase에서 생성되어 있다 — 추가 비용은 사실상 design.md(JWT/OAuth 플로우 다이어그램, threat model 정리) 하나뿐이다.

### 6.2 (참고, 확정 전 검토했던 대안) Tier M

파일 수·LOC가 실제 구현 시 Tier M 상한(300-1000 LOC, 5-15 files) 안에 들어올 가능성도 검토했으나, 4개의 보안 critical 관심사(이메일 인증, JWT 세션, OAuth, rate limiting)가 하나의 발급 경로로 수렴하는 "constitutional" 성격과, 인증 계층이 이후 모든 회원 기반 기능(재구매, 관리자 화면, 결제 SPEC의 신뢰 기반)이 의존하는 기반 계층이라는 점을 근거로 Tier L을 최종 채택했다.

### 6.3 확정된 아티팩트 세트 (Tier L, 5-파일)

- `spec.md` — 캐노니컬 SSOT (12필드 frontmatter + REQ-AUTH-001~025 + Out of Scope)
- `plan.md` — 본 문서(구현 계획 + Milestone 분해)
- `acceptance.md` — Given-When-Then 수락 기준
- `design.md` — JWT/OAuth 아키텍처, Prisma 스키마, threat model 요약
- `research.md` — plan-phase에서 이미 생성됨 (재사용, 수정 없음)

`progress.md`는 별도로 생성되며 Tier 아티팩트 개수에 포함되지 않는다.

---

## §7. Milestone 분해 (Run-phase 구현 계획)

`.claude/rules/moai/development/sprint-round-naming.md`의 Milestone 정의에 따라, run-phase(`/moai run SPEC-AUTH-001`)는 아래 6개 Milestone(M1~M6) 순서로 진행한다. 각 Milestone은 manager-develop의 표준 위임 단위이며, TDD 모드(RED-GREEN-REFACTOR)로 진행한다(신규 프로젝트, 기존 코드 없음 → Greenfield → TDD 기본값).

### M1 — Prisma 스키마 확장

- `prisma/schema.prisma`에 `User` / `OAuthAccount` / `RefreshToken` 3개 모델 추가(§3.1 스키마 형태).
- 마이그레이션 생성 및 적용(`prisma migrate dev`).
- 대상 REQ: REQ-AUTH-006, REQ-AUTH-008, REQ-AUTH-011, REQ-AUTH-018, REQ-AUTH-019가 의존하는 데이터 모델의 기반.

### M2 — 비밀번호 해싱 + JWT 발급/검증 + 공유 세션 발급 함수

- `src/lib/auth/password.ts` — bcrypt 해싱/비교(cost 12), 72바이트 처리, 더미 비교(타이밍 완화).
- `src/lib/auth/jwt.ts` — `jose` 기반 액세스 토큰 서명/검증, 알고리즘 화이트리스트 고정.
- `src/lib/auth/session.ts` — 공유 세션 발급 함수 `issueSession(userId)`(§3.2), 리프레시 토큰 opaque 발급 + 해시 저장.
- `src/lib/auth/cookies.ts` — httpOnly/Secure/SameSite 쿠키 read/write 헬퍼.
- 대상 REQ: REQ-AUTH-001, REQ-AUTH-002, REQ-AUTH-006, REQ-AUTH-007, REQ-AUTH-008, REQ-AUTH-009, REQ-AUTH-020, REQ-AUTH-025.

### M3 — 이메일 회원가입 + 로그인 엔드포인트

- `src/app/api/auth/signup/route.ts`, `src/app/api/auth/login/route.ts`.
- M2의 함수를 조합해 회원가입/로그인 플로우 완성.
- 대상 REQ: REQ-AUTH-002, REQ-AUTH-003, REQ-AUTH-004, REQ-AUTH-005.

### M4 — 리프레시 로테이션 + 재사용 탐지 + 로그아웃

- `src/app/api/auth/refresh/route.ts`, `src/app/api/auth/logout/route.ts`.
- 로테이션-온-리프레시(동일 트랜잭션 내 신규 발급 + 기존 무효화), 재사용 탐지 시 token family 전체 폐기.
- 대상 REQ: REQ-AUTH-010, REQ-AUTH-011, REQ-AUTH-012, REQ-AUTH-013.

### M5 — Google OAuth 플로우

- `src/lib/auth/google-oauth.ts` — `OAuth2Client` 래퍼(동의 URL 생성, state 검증, ID 토큰 검증).
- `src/app/api/auth/google/route.ts`, `src/app/api/auth/google/callback/route.ts`.
- 계정 매칭 로직: 기존 `OAuthAccount` 매칭 → 매칭 없고 기존 `User`도 없음(신규 생성) → 매칭 없지만 기존 이메일/비밀번호 `User` 있음(**auto-link**, §5.1 확정).
- 대상 REQ: REQ-AUTH-014, REQ-AUTH-015, REQ-AUTH-016, REQ-AUTH-017, REQ-AUTH-018, REQ-AUTH-019.

### M6 — Rate limiting + 보안 하드닝 + 테스트 커버리지 검증 (TRUST 5 게이트)

- `src/lib/auth/rate-limit.ts` — 로그인/리프레시/OAuth 콜백 공통 in-memory sliding-window rate limiting(분당 5회, 15분 소프트 락아웃 — REQ-AUTH-021 확정 수치).
- `src/middleware.ts` — 인증 필요 라우트 보호(액세스 토큰 검증) + `/admin` 라우트 RBAC 게이트(`role === "admin"` 확인, 실패 시 리다이렉트 또는 403 — REQ-AUTH-022, 2026-08-26 사용자 확정 §5.5).
- 보안 하드닝 최종 점검: 알고리즘 화이트리스트, exp/iss/aud 검증, CSRF(SameSite + double-submit), `NEXT_PUBLIC_` 시크릿 노출 금지 스캔.
- `tests/unit/auth/*`, `tests/integration/auth/*` 전체 작성 완료 및 TRUST 5 커버리지 85%+ 검증.
- 대상 REQ: REQ-AUTH-021(로그인+refresh+OAuth 콜백 rate limiting 통합), REQ-AUTH-022(관리자 라우트 RBAC 미들웨어, 신규), REQ-AUTH-023, REQ-AUTH-024 + 전체 REQ의 회귀 테스트.

각 Milestone은 완료 시 Conventional Commits 형식(`feat(SPEC-AUTH-001): M{N} <subject>`)으로 커밋한다(`.claude/rules/moai/development/manager-develop-prompt-template.md` §B9).

---

## §8. MX 태그 계획 (Plan Phase 14 — 신규 기능, 경량 스캔)

아직 코드가 없는 신규 기능이므로 "경량 스캔"(공개 API 표면만) 대상이다. run-phase 구현 시 아래 지점에 @MX 태그를 붙이는 것을 권장한다.

- **@MX:ANCHOR 후보** (fan-in ≥3 예상 — 여러 엔드포인트가 공유 호출): `issueSession()`(§3.2 공유 세션 발급 함수, M2), JWT 검증 함수(`verifyAccessToken`, M2/M3/M4가 모두 의존), `/admin` RBAC 미들웨어 게이트(M6, `middleware.ts` 전역 적용).
- **@MX:WARN 후보** (위험 패턴): 리프레시 토큰 로테이션의 DB 트랜잭션(M4 — 동시성/레이스 컨디션 가능), rate limiting의 in-memory sliding-window 상태(M6 — 다중 인스턴스 배포 시 일관성 깨짐 가능, §5.6 참고).
- **@MX:NOTE 후보** (매직 상수/비즈니스 규칙): bcrypt cost factor(12), 액세스 토큰 만료(15분)/리프레시 토큰 만료(30일), rate limit 임계치(분당 5회/15분 락아웃) — 모두 REQ-AUTH-002/007/008/021에 근거.
- **@MX:TODO 후보**: M1(Prisma 스키마)만 완료되고 M2 이전 단계에서 커밋이 발생할 경우, 아직 테스트되지 않은 스키마 마이그레이션에 표시.

이 계획은 run-phase manager-develop 위임 프롬프트의 컨텍스트로 전달된다(`.claude/rules/moai/workflow/mx-tag-protocol.md`).

---

## HISTORY

| 날짜 | 상태 | 비고 |
|---|---|---|
| 2026-08-26 | draft | Decision Point 1(사람 검토 게이트) 통과 — interview.md + research.md 기반 초안 작성 |
| 2026-08-26 | draft | 사용자 확정: (1) Google 계정 연결 정책 = auto-link (§5.1), (2) SPEC Tier = L (§6). §2 요구사항을 REQ-AUTH-001~025로 spec.md에 확정 이전, §7 Milestone(M1~M6) 분해 추가 |
| 2026-08-26 | draft | plan-audit iteration 1 리뷰(D1-D13) 반영. §5.5 확정 마커 추가(D12) — 관리자 라우트 RBAC 미들웨어를 REQ-AUTH-022(신규)로 스코프에 포함. G3+G4를 REQ-AUTH-021로 통합해 REQ 슬롯 확보(수치 확정: 분당 5회, 15분 락아웃). §2 매핑 요약 및 M6 Milestone 갱신 |
