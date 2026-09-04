# Design Notes: SPEC-AUTH-002 — 고객용 로그인·회원가입 화면

> Design-phase deliverable (Conditional Design Route, plan.md §E). 신규 시각 디자인이 아니라
> 기존 `src/app/staff/login/page.tsx`(SPEC-ADMIN-001)의 시각 관례를 그대로 재사용하는 결정을
> 기록한다 — plan.md §E가 명시적으로 이 판단을 design phase로 열어 두었다.

## 1. 근거 — 새 디자인 대신 기존 관례를 그대로 재사용

`src/app/staff/login/page.tsx`가 이미 이 저장소의 유일한 로그인 화면 선례이고, spec.md §1이
"새 고객용 로그인 화면은 이 모양을 그대로 따르되 두 가지만 다르다"고 명시했다. 새 시각 디자인을
만드는 것은 이 저장소가 두 번(SPEC-STOREFRONT-001/002) 반복한 "재사용 가능한 디자인 시스템을
만들지 않는다" 결정과 충돌한다 — 기존 화면과 최대한 통일하는 것이 Enforce Simplicity에도 부합한다.

## 2. `LoginPage` (`/login`) — `staff/login`과의 차이 2가지만

- 제출 성공 시 이동 대상: `/staff/orders` → `/`(REQ-AUTH-027)
- 페이지 하단에 `/signup`으로의 상호 이동 링크 추가(§3) — 그 외 폼 구조·레이블·Tailwind 클래스·
  `useId()` 패턴·`noValidate`·에러 표시(`role="alert"`, `text-sm text-red-600`)·버튼 스타일
  (`rounded-md bg-neutral-900 ... text-white`)은 `staff/login`과 **완전히 동일하게** 재사용한다.
- 한국어 UI 카피: "이메일"/"비밀번호"/"로그인"/"로그인 중…" — `staff/login`과 동일한 라벨을 그대로 쓴다.

## 3. `SignupPage` (`/signup`) — 신규 설계, `LoginPage`와 동일 구조

- 필드: 이메일/비밀번호(로그인과 동일한 입력 컴포넌트 스타일).
- 버튼 라벨: "회원가입" / 제출 중 "가입 중…".
- 제출 성공(201) → `router.push("/login")`(REQ-AUTH-031, 자동 로그인 없음).
- 실패 시 서버 `error` 문자열을 그대로 `role="alert"`에 표시(REQ-AUTH-032) — 클라이언트 측
  문구 재작성 없음(3종 정확한 문자열은 `signup/route.ts`가 반환하는 그대로 노출되어야 함).
- 페이지 하단에 `/login`으로의 상호 이동 링크 추가(대칭성).

## 4. 상호 이동 링크 — 요구사항엔 없지만 design phase가 판단해 추가

plan.md §E가 "요구사항으로 확정되지 않았으므로 UX 추가 여부는 design phase 판단"이라고 명시한
항목이다. 두 화면 다 "계정이 없으신가요? 회원가입" / "이미 계정이 있으신가요? 로그인" 형태의
텍스트 링크를 폼 아래에 추가한다 — 순수 `<a href="/login">`/`<a href="/signup">` (Next.js
`<Link>`를 새로 도입하지 않고, 이 SPEC이 소비하는 기존 화면들의 `<a>` 관례를 따른다). 이 링크는
AC로 검증되지 않는 순수 부가 UX이므로, 테스트는 이 링크의 존재를 요구하지 않는다(있어도 실패하지
않도록 텍스트 매칭에 `exact`를 남용하지 않는다).

## 5. 색상·타이포·간격 — `staff/login`과 100% 동일

새 토큰을 도입하지 않는다. `space-y-4` 폼 레이아웃, `text-sm font-medium text-neutral-800` 라벨,
`rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900` 입력, `text-sm
text-red-600` 에러, `rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white
disabled:opacity-60` 버튼 — 전부 `staff/login`에서 그대로 가져온다.

## 6. 이 문서가 다루지 않는 것

`resolveSession`(M1)은 UI가 아니므로 design phase 대상이 아니다 — plan.md §B의 알고리즘
명세가 구현의 전부다.
