---
id: SPEC-STOREFRONT-002
status: draft
updated: 2026-09-03
tier: M
---

# Progress: SPEC-STOREFRONT-002 — 장바구니 화면·담기 UI 및 체크아웃 스타일 정리

## §E.1 Plan-phase Audit-Ready Signal

plan_complete_at: 2026-09-03
plan_status: audit-ready

plan-phase 산출물 3종(spec.md, plan.md, acceptance.md) 작성 완료. Tier M.

**SPEC ID 검사**: 정규식 검사를 Bash로 실행해 관측했다.

```
$ ID="SPEC-STOREFRONT-002"; [[ "$ID" =~ ^SPEC(-[A-Z][A-Z0-9]*)+-[0-9]{3}$ ]] && echo PASS || echo FAIL
PASS
```

동일 ID 부재도 확인했다 — `.moai/specs/SPEC-STOREFRONT-002` 디렉터리는 이 plan-phase가 생성하기 전까지 없었고, 생성 직전 `ls .moai/specs/ | grep -c "^SPEC-STOREFRONT-002$"` → `0`, `grep -rl "SPEC-STOREFRONT-002" .moai/specs/` → `0`건(자기 자신 제외).

**프론트매터**: 정본 12필드 전부 존재(`id`/`title`/`version`/`status`/`created`/`updated`/`author`/`priority`/`phase`/`module`/`lifecycle`/`tags`) + 선택 필드 `tier: M`·`depends_on`·`related_specs`. `phase: "v0.2.0 target"`(SPEC-ORDER-003·SPEC-DISCOUNT-001과 동일한 최신 릴리스 타깃 표기를 따름), `status: draft`.

**REQ/AC 대응**: REQ 15건(REQ-STOREFRONT-016 ~ 030) / AC 15건(AC-STOREFRONT-016 ~ 030), 1:1 대응(REQ-STOREFRONT-030만 세 하위 관측 a/b/c로 묶임 — acceptance.md §1 참고). Tier M 상한(REQ 16 / AC 16) 이내, 각각 여유 1건.

**번호 이어받기**: `STOREFRONT` 도메인의 기존 번호를 잇는다 — SPEC-STOREFRONT-001이 REQ 001~015 / AC 001~015를 사용했음을 각 문서에서 직접 확인했다(`grep -oE "AC-STOREFRONT-[0-9]+" .moai/specs/SPEC-STOREFRONT-001/acceptance.md | sort -u | tail -5` → `AC-STOREFRONT-011~015`). 이 SPEC은 REQ 016 / AC 016부터 시작한다. SPEC-ORDER-002/003이 SPEC-ORDER-001을 이어받은 선례, SPEC-CATALOG-002가 SPEC-CATALOG-001을 이어받은 선례와 동일한 규칙을 따랐다.

**SPEC ID 선택 근거 (spec.md §1에 전문 기록)**: 세 후보(`SPEC-CART-002`, 신규 `SPEC-CHECKOUT-001`, `SPEC-STOREFRONT-002`) 중 `SPEC-STOREFRONT-002`를 채택했다.
- `SPEC-CART-002` 기각: `src/features/cart/**`(SPEC-CART-001의 module)를 이 SPEC이 한 줄도 수정하지 않는다 — 백엔드 도메인 확장이 아니라 UI 신설이므로 CART 번호를 이으면 소유권이 왜곡된다.
- `SPEC-CHECKOUT-001`(신규 도메인) 기각: 체크아웃 로직(폼·트랜잭션·쿠폰·결제)은 이미 SPEC-ORDER-001·SPEC-PAYMENT-001·SPEC-DISCOUNT-001에 걸쳐 완성되어 있고, 이 SPEC이 그 화면에서 하는 일은 스타일 정리뿐이다. 새 도메인을 여는 것은 "체크아웃이 여기서 처음 만들어진다"는 잘못된 인상을 남긴다.
- `SPEC-STOREFRONT-002` 채택: SPEC-STOREFRONT-001이 이미 "고객 대면 UI" 도메인(루트 셸·Tailwind v4·App Router 컨벤션)으로 확립되어 있고, 이 SPEC은 스키마·백엔드 변경 없이 그 컨벤션 위에 화면을 하나 더 추가하는 정확히 같은 성격의 작업이다. 이는 사용자가 제시한 "CATALOG=백엔드 / STOREFRONT=UI" 분리 선례와 정확히 대응한다.

**착수 전 조사로 확인한 범위 정정 (사용자 원 지시와의 차이, spec.md §1에 근거 전문)**: 사용자가 제시한 카드 `t10` 설명과 범위 가이드는 체크아웃 화면이 아직 없다고 전제했으나, 실제로는 `src/app/checkout/page.tsx` + 5개 하위 컴포넌트(`CheckoutForm`/`OrderSummary`/`CheckoutInteractive`/`CheckoutUnavailable`/`PayButton`)가 이미 완성되어 동작 중임을 직접 파일을 읽어 확인했다. 반대로 `/cart` 라우트와 상품 상세의 담기 버튼은 `find`/`grep`으로 각각 부재를 확인했다. SPEC-DISCOUNT-001의 spec.md §4(REQ-DISCOUNT-023/024 주석) + plan.md §0 확정 #1을 직접 읽어, 체크아웃 화면의 "스타일링/레이아웃 정리"가 이미 이 카드(t10)로 소유권이 명시적으로 넘어와 있음을 확인했다. 이에 따라 이 SPEC의 체크아웃 관련 요구사항(REQ-STOREFRONT-028/029)은 재구현이 아니라 스타일 정리로 범위를 좁혔다.

**회원 신원 부재 재확인 (신규 조사)**: `grep -rn "accessToken\|AuthProvider\|useAuth\b" src`와 `grep -rn "localStorage\|sessionStorage\|AuthContext" src`를 직접 실행해, 클라이언트 측에 액세스 토큰을 보관하는 컨텍스트/스토어/훅이 저장소 전체에 아직 구현되어 있지 않음을 확인했다(매치는 서버 측 라우트 핸들러와 미보관을 설명하는 주석뿐). SPEC-AUTH-001의 "액세스 토큰은 클라이언트 메모리에" 설계는 있으나 그 메모리 저장소 자체를 구현한 SPEC이 없다는 뜻이다. 그 결과 이 SPEC이 만드는 `/cart`·담기 버튼도 SPEC-ORDER-001과 동일하게 게스트 전용으로 범위를 좁혔다(spec.md §3).

**depends_on 근거**: 5개 SPEC 모두 `status: completed`를 각 SPEC의 `spec.md` 프론트매터를 직접 grep해 확인했다.

```
$ for s in CART-001 STOREFRONT-001 ORDER-001 PAYMENT-001 DISCOUNT-001; do echo -n "$s: "; grep "^status:" .moai/specs/SPEC-$s/spec.md; done
CART-001: status: completed
STOREFRONT-001: status: completed
ORDER-001: status: completed
PAYMENT-001: status: completed
DISCOUNT-001: status: completed
```

- `SPEC-CART-001` — 이 SPEC이 소비하는 카트 API 4종(`GET`/`POST /items`/`PATCH /items/:id`/`DELETE /items/:id`)의 출처.
- `SPEC-STOREFRONT-001` — 이 SPEC이 잇는 UI 도메인의 루트 셸·Tailwind v4·App Router 컨벤션·컴포넌트 배치 원칙의 출처.
- `SPEC-ORDER-001` — 이 SPEC이 스타일만 정리하는 `/checkout` 화면과 그 하위 컴포넌트 5개 중 4개(`CheckoutForm`/`OrderSummary`/`CheckoutUnavailable`, 그리고 `page.tsx` 자체)의 출처, 회원 체크아웃 제외 판단의 선례.
- `SPEC-PAYMENT-001` — 체크아웃 스타일 정리 대상 중 `PayButton.tsx`의 출처.
- `SPEC-DISCOUNT-001` — 체크아웃 스타일 정리 대상 중 `CheckoutInteractive.tsx`의 출처이자, 그 스타일링 소유권을 이 SPEC(카드 t10)으로 명시적으로 넘긴 문서(plan.md §0 확정 #1).

**Tier 판정**: M. 파일 수(약 13~14, plan.md §G) · LOC(약 300~600) · REQ/AC(각 15건) 모두 Tier M 가이드 이내이며, 스키마·백엔드 변경이 전혀 없다는 점이 Tier L을 요구하지 않는 근거다(plan.md §G).

**Conditional Design Route**: 적용됨(`plan → design → run`) — `acceptance.md`가 화면(`/cart`)과 프런트엔드 컴포넌트(`CartView`/`EmptyCart`/`AddToCartButton`)를 명시적 산출물로 검증하므로 두 갈래 판정 기준의 첫 번째가 만족된다(plan.md §G).

**range 형태 결정**: 백로그 카드 `t10`이 원래 서술한 범위("장바구니·체크아웃 화면 UI")를 그대로 인수하되, 조사로 밝혀진 실제 저장소 상태에 맞춰 체크아웃 부분을 "재구현"에서 "스타일 정리"로 재정의했다. 사유와 증거는 spec.md §1에 전문이 있다.

**run-phase 진입을 막는 항목은 아직 판정되지 않았다.** plan-audit 게이트와 Implementation Kickoff Approval이 이 SPEC의 다음 단계다.

## §E.2 Run-phase Evidence

_&lt;pending run-phase&gt;_

## §E.3 Run-phase Audit-Ready Signal

_&lt;pending run-phase&gt;_

## §E.4 Sync-phase Audit-Ready Signal

_&lt;pending sync-phase&gt;_
