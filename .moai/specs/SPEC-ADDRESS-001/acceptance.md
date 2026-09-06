# SPEC-ADDRESS-001 — 인수 기준

## §A. REQ ↔ AC 매핑

| REQ | 내용 요약 | AC |
|---|---|---|
| REQ-ADDRESS-001 | User 귀속 + Cascade | AC-ADDRESS-001 |
| REQ-ADDRESS-002 | 4개 배송 필드, deliveryMemo 없음 | AC-ADDRESS-002 |
| REQ-ADDRESS-003 | 회원당 기본 배송지 최대 1개 | AC-ADDRESS-006, AC-ADDRESS-007 |
| REQ-ADDRESS-004 | 생성 → 201, 첫 주소는 기본 | AC-ADDRESS-003, AC-ADDRESS-008 |
| REQ-ADDRESS-005 | 수정 → 200 | AC-ADDRESS-004 |
| REQ-ADDRESS-006 | 삭제 | AC-ADDRESS-005 |
| REQ-ADDRESS-007 | 기본 지정 트랜잭션 | AC-ADDRESS-006, AC-ADDRESS-007 |
| REQ-ADDRESS-008 | 검증 실패 → 400, 쓰기 없음 | AC-ADDRESS-009 |
| REQ-ADDRESS-009 | CSRF 실패 → 403, 쓰기 전 | AC-ADDRESS-010 |
| REQ-ADDRESS-010 | 세션 없음 → 401 | AC-ADDRESS-011 |
| REQ-ADDRESS-011 | 타인 주소 → 404, 읽지도 않음 | AC-ADDRESS-012 |
| REQ-ADDRESS-012 | 미로그인 페이지 → 리다이렉트 | AC-ADDRESS-013 |
| REQ-ADDRESS-013 | 로그인 시 목록 + 조작 수단 | AC-ADDRESS-013 |
| REQ-ADDRESS-014 | 체크아웃 통합 없음 | AC-ADDRESS-014 |
| REQ-ADDRESS-015 | 로그인 복귀 파라미터 없음 | AC-ADDRESS-014 |
| — (상위 REQ 없음, 의도적) | 회귀 보호 게이트 | AC-ADDRESS-015 |

**AC-ADDRESS-015에 상위 REQ가 없는 것은 누락이 아니다.** 이 AC는 이 SPEC이 *만들 기능*을 서술하지 않는다 — 기존 스위트·타입 검사·린트가 이 SPEC 때문에 깨지지 않았음을 확인하는 **프로젝트 공통 회귀 게이트**이며, 최근 SPEC들이 같은 형태로 두어 온 것이다. 이를 REQ로 승격하면 "회귀하지 않아야 한다"는 요구사항이 SPEC마다 중복 선언된다. 따라서 상위 REQ를 새로 만들지 않고, 여기 명시적으로 공시한다. 나머지 14개 AC는 전부 REQ 매핑을 가진다.

---

## §B. 인수 기준 (Given-When-Then)

### 데이터 모델

**AC-ADDRESS-001** — Given `prisma/schema.prisma`에 `Address` 모델이 있을 때, When 스키마를 검사하면, Then `userId` 관계가 `onDelete: Cascade`로 선언되어 있고, `userId`에 `@unique`가 **없으며**, `@@index([userId])`가 존재한다.

**AC-ADDRESS-002** — Given `Address` 모델 정의를 볼 때, When 필드 목록을 확인하면, Then `recipientName`·`recipientPhone`·`postalCode`·`address`·`isDefault`가 존재하고 `deliveryMemo` 필드는 **존재하지 않는다**.

### CRUD 정상 경로

**AC-ADDRESS-003** — Given 로그인한 회원과 유효한 CSRF 토큰이 있을 때, When 유효한 네 개 필드로 `POST /api/addresses`를 호출하면, Then 응답은 201이고 생성된 행이 그 회원의 `userId`로 귀속된다.

**AC-ADDRESS-004** — Given 회원이 자신의 주소를 하나 보유할 때, When 유효한 CSRF 토큰과 함께 `PATCH /api/addresses/[addressId]`로 `recipientName`을 바꾸면, Then 응답은 200이고 해당 행의 `recipientName`이 새 값으로 조회된다.

**AC-ADDRESS-005** — Given 회원이 자신의 주소를 하나 보유할 때, When 유효한 CSRF 토큰과 함께 `DELETE /api/addresses/[addressId]`를 호출하면, Then 성공 응답이 반환되고 이후 목록 조회에 그 행이 나타나지 않는다.

### 기본 배송지 (트랜잭션 안전성)

**AC-ADDRESS-006** — Given 회원이 주소 A(`isDefault: true`)와 주소 B(`isDefault: false`)를 보유할 때, When `PATCH /api/addresses/B/default`를 호출하면, Then B의 `isDefault`가 `true`가 되고 **같은 연산 안에서 A의 `isDefault`가 `false`로 뒤집힌다** — 연산 완료 후 그 회원의 `isDefault === true`인 행 수는 정확히 1이다.

**AC-ADDRESS-007** — Given 회원 X가 주소 A(기본)를 보유하고 회원 Y가 주소 B를 보유할 때, When X의 세션으로 `PATCH /api/addresses/B/default`를 호출하면, Then 응답은 404이고 **B의 `isDefault`는 변하지 않으며 A의 `isDefault`도 `true`로 유지된다** — 소유권이 없으면 첫 번째 `updateMany`가 0건을 매치해 **어떤 행도 변경되지 않은 채** 종료되므로 기존 기본값을 잃지 않는다(롤백이 아니라 무변경이다 — `plan.md` M3 참고). 이 AC는 404 응답만이 아니라 **A의 `isDefault`가 여전히 `true`임**을 함께 단언해야 한다.

**AC-ADDRESS-008** — Given 회원이 주소를 하나도 보유하지 않을 때, When 첫 주소를 생성하면, Then 생성된 행의 `isDefault`가 `true`다. 이어서 두 번째 주소를 생성하면 그 행의 `isDefault`는 `false`다.

### 검증 · 인증 · 인가

**AC-ADDRESS-009** — Given 로그인한 회원과 유효한 CSRF 토큰이 있을 때, When `recipientName`이 빈 문자열인 본문으로 `POST /api/addresses`를 호출하면, Then 응답은 400이고 저장소에 새 행이 생성되지 않는다(호출 전후 행 수가 같다).

**AC-ADDRESS-010** — Given 로그인한 회원의 세션 쿠키가 있으나 `x-csrf-token` 헤더가 없을 때, When 상태를 변경하는 네 개 엔드포인트(`POST`/`PATCH`/`DELETE`/`PATCH …/default`) 각각을 호출하면, Then 응답은 각각 403이고, **저장소 함수와 `resolveSession()`이 한 번도 호출되지 않는다**(mock 호출 횟수 0으로 단언). 이는 `AC-ORDER-069`가 세운 "CSRF 실패 시 상태 변경에 도달하지 않는다" 형태를 따르되, 게스트 분기가 없는 이 SPEC에서는 세션 조회조차 선행하지 않는다는 더 강한 형태다.

**AC-ADDRESS-011** — Given 세션 쿠키가 없거나 무효할 때, When 유효한 CSRF 토큰과 함께 네 개 상태 변경 엔드포인트와 `GET /api/addresses`를 호출하면, Then 응답은 각각 401이고 저장소 함수가 호출되지 않는다.

**AC-ADDRESS-012** — Given 회원 X의 세션과 회원 Y가 소유한 주소 B가 있을 때, When X가 `PATCH /api/addresses/B`, `DELETE /api/addresses/B`, `PATCH /api/addresses/B/default`를 각각 호출하면, Then 응답은 전부 404이며 B의 어떤 필드도 변경되지 않는다. 또한 `GET /api/addresses`의 응답에 B가 포함되지 않는다. (존재하지 않는 id에 대한 응답도 동일하게 404여서, 응답만으로 "남의 것"과 "없는 것"을 구별할 수 없다.)

### 화면

**AC-ADDRESS-013** — Given 세션이 없는 방문자일 때, When `/mypage/addresses`를 열면, Then `redirect("/login")`이 호출되고 **주소 조회 함수는 호출되지 않는다**(게이트가 데이터 읽기보다 먼저임을 mock 호출 횟수 0으로 단언). 그리고 Given 세션이 있는 회원일 때, When 같은 경로를 열면, Then 그 회원의 주소 목록과 기본 배송지 표시, 추가·수정·삭제·기본 지정 조작 수단이 렌더링된다. 이 페이지는 401 JSON을 반환하지 않는다.

### 범위 경계 (기계적 확인)

**AC-ADDRESS-014** — Given run-phase 종료 시점의 브랜치일 때, When 아래 명령을 실행하면, Then 첫 명령의 출력이 비어 있고(체크아웃 파일 3개 · `POST /api/orders` · 로그인 페이지 · `SiteHeader` · `session-resolver.ts` · `csrf.ts` 전부 미변경) 둘째 명령이 0건이다(REQ-ADDRESS-015 — 로그인 복귀 파라미터를 만들지 않았음).

```bash
# 경로에 괄호가 있으므로 반드시 따옴표로 감싼다 — `(shop)`의 괄호는 셸
# 메타문자여서 인용하지 않으면 "0건 PASS"가 아니라 파싱 오류가 난다.
git diff --stat main...HEAD -- \
  "src/components/checkout/CheckoutForm.tsx" \
  "src/app/(shop)/checkout/page.tsx" \
  "src/app/(shop)/checkout/complete/[orderId]/page.tsx" \
  "src/app/api/orders/route.ts" \
  "src/app/(shop)/login/page.tsx" \
  "src/components/layout/SiteHeader.tsx" \
  "src/lib/auth/session-resolver.ts" \
  "src/lib/auth/csrf.ts"

grep -rn "next=\|redirect=\|returnUrl" \
  "src/app/(shop)/mypage" "src/features/addresses"
```

두 명령 모두 **경로 인자를 따옴표로 감싼 형태로 실행해야 결과가 유효하다.** `grep`은 매치 0건일 때 exit 1로 끝나므로, 판정은 exit 코드가 아니라 **출력이 비어 있음**으로 한다.

**AC-ADDRESS-015** — Given 착수 전 기록한 테스트 기준선(`npx vitest run`의 파일 수/테스트 수)이 있을 때, When 구현 완료 후 같은 명령을 실행하면, Then 기존 테스트가 하나도 실패하지 않고 총 테스트 수는 이 SPEC이 추가한 만큼만 증가한다. 아울러 `npx tsc --noEmit`과 `npx eslint .`가 각각 exit 0이다.

---

## §C. 품질 게이트

- 이 SPEC이 추가하는 모든 파일: lines/functions/statements 85% 이상, branches 80% 이상 — 프로젝트 전역 기준과 동일. 타입 전용 파일(`types/address.ts`)은 실행 가능 코드가 없어 예외(기존 `product.ts`·`cart.ts`·`order.ts` 등과 동일 패턴).
- `npm run build` 성공, 새 라우트 4개가 빌드 산출물에 나타남.
- 마이그레이션 SQL은 순수 추가만 포함 — `DROP`·`ALTER ... DROP`·`UPDATE`·`DELETE` 문이 0건임을 `grep`으로 확인.

## §D. Definition of Done

- [ ] AC-ADDRESS-001~015 전부 PASS, 근거를 테스트 이름 또는 명령 출력으로 명시
- [ ] `plan.md` §D PRESERVE 목록 `git diff --stat` 결과 공란
- [ ] `plan.md` §H의 @MX 태그가 지정된 대상에 실제로 부착됨
- [ ] `progress.md` §E.2/§E.3 증거 기록 완료
- [ ] 미해결 명료화 마커 잔존 0건

## §E. 검증하지 않는 것 (잔여 위험으로 기록)

- **동시 첫-주소 생성 경합**: 두 요청이 동시에 회원의 첫 주소를 만들면 둘 다 `isDefault: true`가 될 수 있다. 완전한 방어는 부분 유니크 인덱스를 요구하며 `plan.md` M3가 기각했다. 결과는 "기본 배송지가 두 개로 보인다"이고 데이터 손상이나 권한 이탈이 아니므로 AC를 두지 않는다.
- **실제 PostgreSQL에 대한 Cascade 동작**: 도달 가능한 DB가 없어 `User` 삭제 시 `Address`가 실제로 함께 지워지는지는 스키마 선언 확인(AC-ADDRESS-001)까지만 검증한다.
