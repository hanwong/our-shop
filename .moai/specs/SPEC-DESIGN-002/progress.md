# SPEC-DESIGN-002 — 진행 기록

카드: t62 · 워크트리: `.claude/worktrees/t62` · 브랜치: `WT-neutral-600-contrast`

---

## §E.1 Plan-phase Audit-Ready Signal

**상태**: plan-phase 완료. plan-audit **PASS**.

**plan-audit 결과** (독립 감사 — plan-auditor):

| 항목 | 값 |
|---|---|
| 최종 판정 | **PASS** |
| 최종 점수 | **0.94** (Tier M 기준 0.80) |
| 점수 추이 | iteration 1 **0.79**(FAIL) → iteration 2 **0.94**(PASS) — 상승, STOP 신호 없음 |
| iteration 1 보고서 | `.moai/reports/plan-audit/SPEC-DESIGN-002-review-1.md` (원본 보존) |
| iteration 2 보고서 | `.moai/reports/plan-audit/SPEC-DESIGN-002-review-2.md` |

iteration 1은 0.79로 FAIL했으나 must-pass 7항목은 전부 통과했고 핵심 설계 결정(`--color-neutral-600` → `#6b6b6b`)은 감사자 독립 측정으로 전부 뒷받침되었다. FAIL은 서술 결함에서 나왔으며, blocking 결함 6건(D1~D6) + optional 1건(O8)을 iteration 2 이전에 교정했다 — 반증된 사실 주장 교체(D1), plan.md AC 실행 범위 `AC-001..AC-006` 정정(D2), `border-neutral-600` 미측정 주장 삭제(D3), `#7a7a7a` 리터럴 출처 재귀속(D4), AC-005(a) 축자 스크립트 추가(D5), REQ-BRAND-008 이탈 서술 격상(D6), AC-002(e) 직접 grep 추가(O8). 감사자는 각 결함을 파일 본문 재독 + 스크립트·grep·awk 직접 재실행으로 판정했다.

**Audit-Ready Signal**:

- plan_complete_at: 2026-09-07T10:26:15+0900
- plan_status: audit-ready

**산출물** (Tier M):

| 파일 | 상태 |
|---|---|
| `spec.md` | 작성 완료 — GEARS 요구사항 7건(REQ-DESIGN2-001..007), Out of Scope 6개 항목 |
| `plan.md` | 작성 완료 — 마일스톤 3개(M1 판단 지점, M2·M3 기계적) |
| `acceptance.md` | 작성 완료 — AC-001..006, 전부 명령 기반 이진 판정 |
| `progress.md` | 이 파일 |

**plan-phase에서 실제 실행한 검증**:

1. SPEC ID 정규식 자기 검사
   ```
   $ ID="SPEC-DESIGN-002"; [[ "$ID" =~ ^SPEC(-[A-Z][A-Z0-9]*)+-[0-9]{3}$ ]] && echo PASS || echo FAIL
   PASS
   ```

2. 명도 대비 + 램프 단조성 (Node 스크립트, 실행 후 삭제)
   ```
   #7a7a7a on bg      #f2f2f2 => 3.834:1  AA-normal(4.5) FAIL
   #6b6b6b on bg      #f2f2f2 => 4.760:1  AA-normal(4.5) PASS
   #6b6b6b on surface #e9e9e9 => 4.389:1  AA-normal(4.5) FAIL
   #5e5e5e on bg      #f2f2f2 => 5.792:1  AA-normal(4.5) PASS
   neutral-500 #989898 L=0.3140 / neutral-600 #6b6b6b L=0.1470 / neutral-700 #5e5e5e L=0.1119
   monotonic: true
   achromatic(#6b6b6b): true
   ```

3. SSOT 계보 확인
   ```
   $ git log -L 53,53:src/app/globals.css --oneline --no-patch
   b1c2862 feat(SPEC-BRAND-001): 우리샵 → OUR 브랜드 전환 (#32)
   e8c4ef3 feat(SPEC-DESIGN-001): 공통 디자인 토큰 체계 수립과 전체 사이트 반영 (#28)
   ```

4. 소비처 측정
   ```
   $ grep -rn "neutral-600" --include="*.tsx" --include="*.ts" --include="*.css" src/ | wc -l
   37      (1건은 globals.css:53 정의부, 36건이 사용처)
   $ grep -rln "neutral-600" --include="*.tsx" src/ | wc -l
   17
   ```

5. surface 도달 가능성 확인
   ```
   $ grep -rn "bg-surface" --include="*.tsx" src/
   src/components/layout/SiteHeader.tsx:66
   src/components/product/ProductCard.tsx:48
   $ grep -n "neutral-600" src/components/layout/SiteHeader.tsx src/components/product/ProductCard.tsx
   (출력 없음) exit=1
   ```
   → `#6b6b6b` × `#e9e9e9`의 4.389:1 미달 조합은 현재 코드에서 도달 불가능.

**미검증 (Gaps)**: 빌드·린트·테스트는 plan-phase에서 실행하지 않았다. run-phase 대상.

**잔여 위험**: 향후 `bg-surface` 영역에 `text-neutral-600` 본문이 도입되면 4.389:1 미달이 발생한다. AC-005 (c)가 이 회귀를 감시한다.

---

## §E.2 Run-phase Evidence

_<pending run-phase>_

---

## §E.3 Run-phase Audit-Ready Signal

_<pending run-phase>_

---

## §E.4 Sync-phase Audit-Ready Signal

_<pending sync-phase>_
