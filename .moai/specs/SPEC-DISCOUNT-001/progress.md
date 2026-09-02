---
id: SPEC-DISCOUNT-001
status: draft
updated: 2026-09-02
tier: L
---

# Progress: SPEC-DISCOUNT-001 — 쿠폰·할인 정책 계산 엔진

## §E.1 Plan-phase Audit-Ready Signal

plan_complete_at: 2026-09-02
plan_status: audit-ready

Tier L 산출물 5종(spec.md, plan.md, acceptance.md, design.md, research.md) 작성 완료.

**SPEC ID 검증**: 정규식 검사를 Bash로 실행해 출력 `PASS`를 관측했다.

```
$ ID="SPEC-DISCOUNT-001"; [[ "$ID" =~ ^SPEC(-[A-Z][A-Z0-9]*)+-[0-9]{3}$ ]] && echo PASS || echo FAIL
PASS
```

중복 부재도 확인했다 — `ls -d .moai/specs/SPEC-DISCOUNT-001` → `No such file or directory`(작성 전 시점), `grep -rl "SPEC-DISCOUNT" .moai/specs/` → 일치 없음.

**Tier 판정: L.** 근거는 파일 수와 되돌리기 어려움 둘 다이다. 새 Prisma 모델 + enum + `Order` 컬럼 2개 + 마이그레이션, 새 feature 디렉터리 4파일, `order-service.ts` / `order-repository.ts` / `order.ts` 통합, 결제 취소 경로, 체크아웃 화면 3파일, 시드, 테스트 6종 이상 — 15파일을 넘는다. 선례와도 일치한다: 비슷한 범위의 SPEC-ORDER-001·SPEC-PAYMENT-001이 Tier L이고, 기존 코드의 좁은 구멍 4개만 막은 SPEC-ORDER-002가 Tier M이었다. 또한 금액 산술과 정률 반올림 방향은 **저장된 주문 금액을 통해 영구화**되는 결정이므로 design.md·research.md를 갖는 Tier L 산출물 집합이 실제로 값을 한다.

**요구사항·인수 기준**: REQ 25건(REQ-DISCOUNT-001 ~ 025) / AC 25건(AC-DISCOUNT-001 ~ 025), 1:1 대응. Tier L 상한 25건 이내.

**프론트매터**: 정규 12필드 + `tier: L` + `depends_on` 확인.

**depends_on: [SPEC-CART-001, SPEC-ORDER-001, SPEC-PAYMENT-001]** — 세 SPEC 모두 각자의 `spec.md` 프론트매터에서 `status: completed`임을 직접 열어 확인했다. 각 의존의 근거: CART-001은 `CartDTO.subtotal` 계약이 할인의 입력이 되므로, ORDER-001은 이 SPEC이 그 주문 트랜잭션과 `PRICE_CHANGED` 계약을 확장하므로, PAYMENT-001은 할인이 `Order.totalAmount`를 바꾸어 `payment-service.ts:83`의 금액 대조 대상이 되고 취소 트랜잭션이 쿠폰 사용분 해제를 얹을 자리이므로.

**plan-audit는 세 차례 실행되었다. 세 번 다 형식상 FAIL이며, 재시도 상한(최대 3회)에 도달한 뒤 PASS-with-debt로 종결한다.** 기록된 사실만 남긴다.

- **반복 1 — FAIL, 점수 0.79** (Tier L 임계값 0.85 미달, 차단 결함 D1~D4). 보고서: `.moai/reports/plan-audit/SPEC-DISCOUNT-001-review-1.md`.
- **반복 2 — FAIL, 점수 0.90** (임계값은 넘겼으나 차단 결함으로 FAIL). D1·D2·D4는 완전히 해소됐고 D3는 부분 해소, 그리고 반복 1의 보수 과정에서 자기모순 결함 2건(N1·N2)이 새로 유입됐다. 보고서: `.moai/reports/plan-audit/SPEC-DISCOUNT-001-review-2.md`.
- **반복 3 (최종) — FAIL, 점수 0.95** (임계값을 0.10 여유로 초과, must-pass 7건 전부 PASS, 점수 회귀 없음 — 궤적 0.79 → 0.90 → 0.95). 형식상 FAIL 사유는 단 하나: N2가 지목한 두 자리(`progress.md`, `research.md`) 중 `research.md:138`이 여전히 "아직 plan-auditor를 거치지 않았다"는, 이 시점엔 이미 거짓인 문장을 담고 있었다. 보고서: `.moai/reports/plan-audit/SPEC-DISCOUNT-001-review-3.md`.

**재시도 상한 이후 처리 — PASS-with-debt.** 반복 3의 유일한 잔여 결함(research.md의 한 문장)을 수정했고(2026-09-02), `grep -rn "아직 plan-audit\|거치지 않았다\|판정이 없다" .moai/specs/SPEC-DISCOUNT-001/`로 동일 주장이 다른 파일에 없음을 직접 확인했다. 4번째 plan-auditor 재실행은 하지 않았다 — 이미 3회 상한에 도달했고, 잔여 결함이 설계·요구사항·run-phase 산출물에 영향이 없는 연구 문서 한 문장의 자기모순이었기 때문이다(plan-auditor 자신도 반복 3 보고서에서 "재범위축소는 근거가 약하다"고 명시했다). 이것은 관측된 PASS가 아니라 **PASS-with-debt** — 실제 마지막 자동 판정은 여전히 FAIL(0.95)이며, 이 문서가 그 사실을 지운다고 주장하지 않는다.

**열린 결정 4건은 2026-09-02 사용자 결정으로 전부 해소되었다.** plan.md §0에 명확화 대기 마커로 기록되어 있던 항목들이며, 네 건 모두 잠정 권고와 같은 (A)로 확정되었다:

1. **쿠폰 입력 UI의 소유 SPEC** → 이 SPEC이 최소한의 입력란 + 실패 문구까지 만든다. 스타일링·UX 다듬기는 카드 `t10`이 후속 재작업으로 가져간다(합의된 분업이며 중복 작업이 아님).
2. **게스트 전용 모델에서의 사용 제한 범위** → 전역 총량 상한(`maxRedemptions`)만 둔다. 인별·게스트별 제한은 제공하지 않으며, **없다는 사실을 명시**한다(REQ-DISCOUNT-022 / AC-DISCOUNT-022).
3. **할인 유형 범위와 정률 반올림 방향** → 정률·정액 두 유형 모두 지원, 정률은 원 단위 내림(`floor`)(REQ-DISCOUNT-007).
4. **미결제 이탈 주문의 쿠폰 사용분 해제 소유자** → 주문 생성 시점 증가, 결제 취소 웹훅에서 해제(REQ-DISCOUNT-021). 시간 기반 해제는 소유자 없는 공백으로 남으며 구조적으로 카드 `t21`과 같은 성격이다 — **다만 이 공백을 다룰 백로그 카드는 아직 만들어지지 않았다.**

결정 내용과 각 결정이 받아들인 트레이드오프는 **plan.md §0**에 옮겨 적었고, 명확화 대기 마커는 6개 산출물(spec.md, plan.md, acceptance.md, design.md, research.md, progress.md) 전체에서 제거되어 0건임을 grep으로 확인했다. run-phase 진입을 막는 열린 항목은 남아 있지 않다.

## §E.2 Run-phase Evidence

_<pending run-phase>_

## §E.3 Run-phase Audit-Ready Signal

_<pending run-phase>_

## §E.4 Sync-phase Audit-Ready Signal

_<pending sync-phase>_
