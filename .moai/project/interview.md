# Project Interview

## Stage A Round 1: Vision and Domain
Question: 'our-shop'이 어떤 종류의 프로젝트인가요? 누구를 위해, 어떤 문제를 해결하려고 만드는지 알려주세요.
Answer: 온라인 쇼핑몰 웹앱 (권장) — 상품을 둘러보고 장바구니에 담아 결제하는 온라인 쇼핑몰. B2C 패션 쇼핑몰, 게스트 구매 지원, 모바일 우선.
Domain: e-commerce-web (B2C 패션 온라인 쇼핑몰)
Goal: 고객이 상품을 검색·구경하고 장바구니에 담아 결제까지 마칠 수 있는 모바일 우선 온라인 패션 쇼핑몰을 만든다. 게스트(비회원) 구매도 지원한다.

## Stage A Round 2: Technology and Constraints
Question: 이 쇼핑몰을 만들 때 주로 어떤 기술(개발 언어/도구)을 쓸 가요?
Answer: TypeScript/JavaScript (권장)
Constraints:
- 결제 정합성(payment consistency) 최우선 — 결제 데이터는 절대 어긋나면 안 됨
- 카탈로그 응답 속도 p95 300ms 이하 (100번 요청 중 95번은 0.3초 안에 응답)
- 개인정보 최소 수집 원칙

## Stage A Round 3: Scope and Boundaries
Question: (제약 조건 답변에서 함께 volunteered — Round 2 자유 서술 답변에 범위가 포함되어 별도 재질문 없이 반영)
Answer: 핵심 기능 — 카탈로그/검색, 장바구니, 결제(PG 연동), 주문/배송조회, 리뷰, 관리자 상품·주문 관리. 게스트 구매, 모바일 우선.
Scope: In-scope — 상품 카탈로그·검색, 장바구니, PG 결제 연동, 주문/배송조회, 상품 리뷰, 관리자용 상품·주문 관리 화면. Out-of-scope (이번 단계에서는 다루지 않음) — 별도 배송조회 외부 API 연동, 멀티 벤더/마켓플레이스 기능.

## Stage B Round 4: Verification, Surfaces, and Sharing
Verification: 자동 테스트 (Jest/Vitest 등 — 새 기능을 추가할 때마다 자동으로 돌아가는 테스트)
UI surface: has-ui (모바일에서도 잘 보이는 반응형 웹앱)
External systems: 결제대행사(PG), 데이터베이스
Team sharing: solo (혼자 개발)
