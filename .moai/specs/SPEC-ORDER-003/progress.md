---
id: SPEC-ORDER-003
status: draft
updated: 2026-09-03
tier: M
---

# Progress: SPEC-ORDER-003 — 게스트 주문 재방문 조회와 주문 상태 표시

## §E.1 Plan-phase Audit-Ready Signal

plan_complete_at: 2026-09-03
plan_status: audit-ready

plan-phase 산출물 3종(spec.md, plan.md, acceptance.md) 작성 완료. Tier M.

**SPEC ID 검사**: 정규식 검사를 Bash로 실행해 `PASS SPEC-ORDER-003`을 관측했다. 동일 ID 부재도 확인했다 — `.moai/specs/SPEC-ORDER-003` 디렉터리 없음, `.moai/specs/` 전체 grep에서 `SPEC-ORDER-003` 참조 0건.

**프론트매터**: 정본 12필드 전부 존재 + `tier: M` + `depends_on`. `phase: "v0.2.0 target"`(릴리스 대상), `status: draft`.

**REQ/AC 대응**: REQ 12건(REQ-ORDER-034 ~ 045) / AC 13건(AC-ORDER-037 ~ 049). 13:12인 사유는 acceptance.md §0 머리말에 명시했다(REQ-ORDER-036이 응답 동일성과 조회 호출 횟수라는 두 관측으로 나뉜다). Tier M 상한(REQ 16 / AC 16) 이내.

**번호 이어받기**: `ORDER` 도메인의 기존 번호를 잇는다 — SPEC-ORDER-001이 REQ 001~021, SPEC-ORDER-002가 REQ 022~033 / AC ~036을 사용했으므로 이 SPEC은 REQ 034, AC 037부터 시작한다. SPEC-ORDER-002가 SPEC-ORDER-001을 이어받은 선례를 따랐다.

**depends_on 근거**: `SPEC-ORDER-001`(`status: completed` — `Order` 모델·`orderNumber`·배송지 스냅샷·`OrderStatus`·`findOrderForGuest()` 제공, 그리고 §3에서 재방문 조회 수단을 이 SPEC 앞으로 명시적으로 넘김), `SPEC-PAYMENT-001`(`status: completed` — `pending_payment → paid | cancelled` 전이 제공. 이것이 없으면 모든 주문이 영원히 초기 상태여서 "상태 조회"가 성립하지 않음). 두 SPEC의 프론트매터를 직접 읽어 `status: completed`를 확인했다.

**범위 형태 결정**: 백로그 카드 `t8`이 묶은 세 능력 중 하나(게스트 재방문 조회)만 인수하고 둘(배송지 주소록, 배송 이행 상태 기계)은 spec.md §3에서 제외했다. 사유와 증거는 spec.md §2, 넘긴 곳과 선행 조건은 plan.md §0에 있다. 제외한 둘은 각각 백로그 카드 `t23`(배송지 주소록 관리)과 `t24`(배송 이행 상태 기계)로 분리되어 `t8`에서 떨어져 나왔다. SPEC ID는 `SPEC-SHIPPING-001` 대신 `SPEC-ORDER-003`으로 확정했다 — 결정 2가 이행 상태값을 범위 밖으로 확정했으므로 `SHIPPING` 이름을 되돌릴 조건은 현재 성립하지 않는다.

**plan-audit 판정: PASS · 종합 점수 0.94** (Tier M 임계값 0.80, 세 번째이자 마지막으로 가능했던 반복에서 관측). 이 SPEC의 plan-audit은 세 번 실행되었다 — 앞 두 번은 FAIL, 세 번째가 PASS다. 세 보고서 모두 `.moai/reports/plan-audit/` 아래에 실재하며, 오케스트레이터가 직접 열어 판정 문구를 대조했다.

- **1차 — FAIL, 점수 0.81** (Tier M 임계값 0.80). 점수는 임계값을 넘겼으나 결함 두 건에 막혔다 — **D1**(치명, 차단): REQ-ORDER-034/035가 REQ-ORDER-044의 쿠키 기반 조회와 모순되어 요구사항 쌍이 동시에 만족될 수 없었다. **D2**(중대, 차단): REQ-ORDER-036의 "응답 시간" 절이 AC-ORDER-040의 검증 범위와 맞춰지지 않은 채 남아 있었다. must-pass는 7/7 PASS였다. 보고서: `.moai/reports/plan-audit/SPEC-ORDER-003-review-1.md`.
- **2차 — FAIL, 점수 0.94** (임계값을 크게 상회). D1·D2가 모두 완전히 해소되었고 must-pass도 7/7 PASS였으나, 이 progress.md 자신이 감사 이력이 없다는 취지로 쓰여 있어 사실과 어긋난 결함(N1) 하나 때문에 FAIL로 닫혔다. 보고서: `.moai/reports/plan-audit/SPEC-ORDER-003-review-2.md`.
- **3차(최종) — PASS, 점수 0.94** (2차와 동일 점수 — 이번 반복은 결함 수정이 아니라 N1 정정 확인이었다). N1·N2 모두 RESOLVED로 재확인, must-pass 7/7, 회귀 결함 0건. 남은 항목은 전부 optional이며(O1~O4) 감사 자신이 "강제 FAIL 사유 아님, 마지막 반복에서 인위적으로 FAIL을 만들지 않는다"고 명시했다. 보고서: `.moai/reports/plan-audit/SPEC-ORDER-003-review-3.md`.

**run-phase 진입을 막는 항목은 이제 없다.** Implementation Kickoff Approval 게이트로 넘어갈 준비가 됐다.

**열린 항목 3건 모두 해소됨 (2026-09-03 사용자 결정)**. run-phase 진입 전 해소가 필요했던 세 항목 — 배송지 주소록 제외 여부 / "배송 상태"의 의미 / 재방문 조회의 대조 비밀값 — 은 셋 다 사용자 결정으로 닫혔고, 확정 내용·근거·받아들인 대가는 plan.md §0에 결정 1~3으로 기록되어 있다. 확정 요지: (1) 배송지 주소록은 이 SPEC에서 완전히 제외하고 백로그 카드 `t23`으로 분리, (2) 새 이행 상태값을 도입하지 않고 기존 `OrderStatus` 3종만 재방문 조회에서 표시하며 이행 상태 기계는 백로그 카드 `t24`로 분리, (3) 대조 비밀값은 주문 번호 + 수령인 연락처(`recipientPhone`). 셋 다 조사가 내놓았던 권고와 같은 선택이므로 Tier M과 `SPEC-ORDER-003` ID는 그대로 유지된다. **범위를 여는 열린 항목은 이제 없다.**

## §E.2 Run-phase Evidence

_&lt;pending run-phase&gt;_

## §E.3 Run-phase Audit-Ready Signal

_&lt;pending run-phase&gt;_

## §E.4 Sync-phase Audit-Ready Signal

_&lt;pending sync-phase&gt;_
