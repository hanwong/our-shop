---
id: SPEC-ORDER-001
status: in-progress
updated: 2026-08-31
tier: L
---

# Progress: SPEC-ORDER-001

## §E.1 Plan-phase Audit-Ready Signal

- Tier: **L** (5 artifact set) — 근거: 신규 도메인 1개(모델 2 + enum 1 + 마이그레이션), 도메인/API/UI 3개 층에 걸친 산출물 15개 이상, 그리고 `product.md`의 최우선 제약(결제 데이터 정합성)을 직접 다루는 constitutional 성격.
- **범위: 게스트 체크아웃 전용**(v0.2.0). 회원 체크아웃은 SPEC-AUTH-001과의 구조적 충돌로 제외 — 사유 전문은 spec.md §3 첫 항목, 결정 기록은 plan.md §0 #5, 증거 조사는 research.md §6.
- 산출물: `spec.md`(REQ-ORDER-001~021, **21개**) / `plan.md`(M1~M7) / `acceptance.md`(**AC 20개** — `001~008`·`010~016`·`018~022`, REQ 21개 전부 매핑) / `design.md` / `research.md` / 이 파일.
  - AC 번호에 `009`·`017`이 없는 것은 누락이 아니라 흡수 매핑이다(acceptance.md §1.5). Tier L 상한(REQ 25 / AC 25) 이내.
- SPEC ID 사전 검사: `SPEC-ORDER-001` — 정규식 검사 **PASS**(기존 6개 SPEC ID와 충돌 없음).
- 결정 상태: plan.md §0의 5건 **전부 확정**(미해결 0건).
  - #1 결제 SPEC 경계 — **사용자 확인 완료(2026-08-31)**: 주문 먼저 생성(`pending_payment`), 주문 생성 시점 재고 차감, 결제 상태 전이는 후속 SPEC. plan-phase 권고안을 사용자가 승인.
  - #2 미결제 주문 재고 해제 정책 — **잠정 결정(재검토 가능)**: 이 SPEC에서는 미구현, 타임아웃 후 해제를 향후 방향으로 기록.
  - #3 배송비 — **잠정 결정(재검토 가능)**: `calculateShippingFee()` 단일 함수로 격리하고 0원 반환. 결정값처럼 굳는 위험은 plan.md §5에 유지.
  - #4 게스트 이메일 수집 — **잠정 결정(재검토 가능)**: 수집하지 않음(REQ-ORDER-008).
  - #5 회원 체크아웃 — **사용자 확인 완료(2026-08-31)**: 이 SPEC의 범위에서 **제외**. 게스트 체크아웃만 만든다.
  - #2~#4는 사용자 지시("잠정값으로 진행")에 따라 이 plan-phase의 확정값으로 채택되었다. run-phase는 이 값을 전제로 진행하며, 재검토가 필요해지면 후속 SPEC 또는 개정으로 처리한다. #1·#5는 잠정이 아니라 사용자가 확인한 확정 결정이다.
- 검증 하네스 한계 사전 고지: 실 PostgreSQL 부재로 트랜잭션 원자성·동시성·unique 제약 실동작은 자동 검증 대상에서 제외(acceptance.md §0). 제외 항목은 `AC-012-EXCL-ROLLBACK` / `AC-013-EXCL-CONCURRENCY` / `AC-016-EXCL-UNIQUE-RACE` 세 이름으로 고정되어 있으며, run-phase는 §E.2에 이 이름 그대로 미검증을 기록한다.

### 반영 — plan-audit iteration 1 지적사항 (2026-08-31)

`.moai/reports/plan-audit/SPEC-ORDER-001-review-1.md`(FAIL 0.81 / Tier L 임계 0.85)의 D1~D8 처리 결과.

| 지적 | 처리 | 반영 위치 |
|---|---|---|
| D1 신원이 서버 컴포넌트에서 도달 불가 | `next/headers` 기반 **얇은 전송 어댑터**를 orders 도메인 신규 코드로 도입. 판정 규칙은 재사용, 전송만 신규로 구분해 기술. `issuedGuestId`는 서버 컴포넌트에서 폐기(쿠키 설정 불가는 공식 문서로 확인) — `src/lib/auth/**` 불변 조건 **완화 0건** | design.md §6/§6.1/§6.2, plan.md §2·M2·M5·M6·§4, spec.md 계약표 |
| D2 트랜잭션 인지 카트 접근 부재 | 질의 복제를 기각하고 **카트 리포지토리 3개 함수에 선택적 tx 인자 추가**를 채택. PRESERVE 목록에 경계를 명시한 §4.1 예외로 기록 — "금지이자 필수" 모순 해소 | design.md §2.1, plan.md §4.1·M2, acceptance.md §4 |
| D3 AC 하위 라벨 미해석 | `(c)` 약칭을 폐기하고 `AC-012-EXCL-ROLLBACK`·`AC-013-EXCL-CONCURRENCY`·`AC-016-EXCL-UNIQUE-RACE`로 명명. 각 제외가 조건 짓는 Then 항목을 명시(013·016은 "없음(별도 주장)"). design.md의 research §3 라벨은 `R3(x)`로 네임스페이스 분리 | acceptance.md §0·AC-012/013/016·§4, design.md §2 |
| D4 AC 개수 불일치(20 vs 18) | 실제 개수 재확인 후 **19개**(AC-021 신설 포함)로 세 문서 정합 | acceptance.md 머리말·§1.5, 이 파일 |
| D5 fake 롤백 전제 미기재 | AC-011·012에 `전제 (fake 롤백)` 줄 추가 + §0에 원칙 기술 + DoD 기록 항목 추가 | acceptance.md §0·AC-011·AC-012·§4 |
| D6 인용 출처 오기 | `cart-service.ts:108` 주석 + `:113-114` 구현으로 재지정 | design.md §2 |
| D7 반환 타입 부정확 | `ResolvedCartIdentity` 실제 형태로 정정(D1과 같은 함수라 함께 처리) | spec.md 계약표 |
| D8 structure.md 이탈 미기재 | 도메인 디렉터리·라우트 그룹 두 이탈의 근거를 표로 기록 | plan.md §2 |

신설: **AC-ORDER-021** — D1이 도입한 어댑터가 판정을 자체 구현하지 않고 `resolveCartIdentity()`를 재사용하는지 정적으로 고정한다(새 설계 표면이 검증 없이 남지 않도록).

### 반영 — plan-audit iteration 2 지적사항 (2026-08-31, v0.2.0)

`.moai/reports/plan-audit/SPEC-ORDER-001-review-2.md` — **FAIL 0.74 / Tier L 임계 0.85, 점수 회귀(0.81 → 0.74)로 STOP 권고**. 감사의 판정은 "문서를 더 고쳐서 될 문제가 아니라 범위 결정이 필요하다"였다. 3회차를 그대로 돌리지 않고, 사용자 확인 아래 **범위를 축소**했다.

**iteration 1 → 2에서 해소된 것(감사가 독립 검증)**: D2(트랜잭션 카트 접근), D4(AC 개수), D5(fake 롤백 전제), D6(인용 출처), D7(반환 타입), D8(structure.md 이탈). 이번 판은 이것들을 **유지**한다 — 특히 D2의 선택적 tx 인자 설계와 D3의 이름 붙은 제외 3건은 그대로다.

| 지적 | 처리 | 반영 위치 |
|---|---|---|
| **D1** 서버 컴포넌트가 회원 신원을 볼 수 없음 (2회 연속 미해소, 구조적 충돌) | **감사가 제시한 (a) 범위 축소를 채택(사용자 확인).** 회원 체크아웃을 이 SPEC에서 제외하고 게스트 전용으로 좁혔다. 함께: `Order.userId` 삭제(경계를 스키마로 강제), 회원 제출 거부 REQ 신설, **`next/headers` 신원 어댑터 설계 전면 삭제**(회원 신원 해석용 장치였으므로 존재 이유 소멸), 서버 렌더는 `cookies()`로 게스트 쿠키만 읽는 형태로 단순화 | spec.md §3 첫 항목·§1·REQ 전면, plan.md §0 #5·§2·M1~M6·§4·§4.1·§5·§6, design.md §1.4·§6 전면·§7.1, acceptance.md AC-021/022, research.md §6 |
| **D1 파생** `issuedGuestId` 동치 주장이 회원에 대해 거짓 | 그 주장을 **삭제**했다. 서버 렌더 경로는 이제 쿠키가 없으면 조회할 id 자체가 없어 안내 화면으로 가며, 이는 추론이 아니라 항진명제다. 회원을 게스트로 오인해 "장바구니가 비었다"고 **단정하던 문제**는 문구 계약(design.md §7.1)으로 대체 — 서버가 관측한 사실만 말하고 회원 체크아웃 부재를 고지한다 | design.md §6.1·§7.1, acceptance.md AC-006 |
| **D1 파생** AC-ORDER-021(a)가 도달 불가 컨텍스트를 단언 | 회원 렌더 컨텍스트 케이스를 **삭제**하고 게스트/무쿠키 두 경우로 재작성. 감사가 건전하다고 판정한 (c) 정적 검사는 유지·강화(금지 토큰 확대 + 어댑터 파일 부재 확인) | acceptance.md AC-021 |
| **D9** `spec.md`의 `REQ-ORDER-009(c)` 오참조 | 재고 확정/차감의 실제 인수처인 `REQ-ORDER-011 / REQ-ORDER-013`으로 정정하고, 판정 근거는 `R3(c)` 네임스페이스로 명시 | spec.md §1 인수 표 |
| **D10** `PRODUCT_GONE`이 도달 불가능한 상태 | 감사의 (a) **삭제**를 채택. `CartItem.product`가 `onDelete: Cascade`이고 `Product`에 소프트 삭제 컬럼이 없음을 스키마에서 직접 확인했다. REQ-ORDER-015의 해당 절, 실패 코드, §2 2단계의 상품 분기, AC-015(ii)를 전부 제거. 실제로 도달 가능한 인접 상황(트랜잭션 중 상품 동시 삭제)은 잔여 위험으로 기록 | spec.md §3·REQ-ORDER-015, design.md §1.5·§2·§8·§9, acceptance.md AC-015·§2 |
| **D11** 금지 토큰 목록에 `readGuestCartId` 누락 | 목록을 확대해 반영(`readGuestCartId`·`getCookieValue`·`resolveCartIdentity`·`new Request(` + `"guest_cart_id"` 리터럴 금지) | acceptance.md AC-021 (c)(d) |
| **D12** `R3` 네임스페이스 미적용 1건 | design.md의 모든 research 참조를 `R3(x)`로 통일하고, 규칙 문구를 "예외 없이"로 강화 | design.md §2 라벨 주석·§9 |

**범위 축소가 만든 부수 변경 2건(기록)**:

1. **카트 리포지토리 완화가 3개 함수 → 2개로 좁아졌다.** `findCartByUserId`는 회원 경로 전용이었으므로 이 SPEC이 호출하지 않는다. 채택한 설계(선택적 tx 인자 추가)는 그대로이며, 불변 조건의 구멍만 작아졌다(design.md §2.1, plan.md §4.1).
2. **`src/features/orders/lib/server-identity.ts`가 산출물에서 사라졌다.** M2가 만들던 어댑터이며, 되살아나지 않도록 AC-ORDER-021 (e)가 파일 부재를 확인한다.

신설: **AC-ORDER-022 / REQ-ORDER-021** — 회원 자격 증명을 제시한 주문 제출을 409 `MEMBER_CHECKOUT_UNSUPPORTED`로 거부한다. 범위 경계를 문서가 아니라 코드로 강제하는 지점이며, 공개 엔드포인트이므로 실제로 도달 가능한 가드다.

## §E.2 Run-phase Evidence

_<pending run-phase>_

## §E.3 Run-phase Audit-Ready Signal

_<pending run-phase>_

## §E.4 Sync-phase Audit-Ready Signal

_<pending sync-phase>_
