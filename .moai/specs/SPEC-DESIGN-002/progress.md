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

**변경 내용**: `src/app/globals.css` — `--color-neutral-600`을 `#7a7a7a` → `#6b6b6b`로 교정하고, 교정 근거를 담은 이탈 주석을 선언 바로 앞에 삽입했다(4-6행 헤더 주석은 건드리지 않음). 계획된 문안(plan.md §M1 변경 2)은 Korean이었으나, `code_comments: en`(language.yaml) + 기존 `t51` 주석 선례(영문)에 맞춰 영문으로 작성했다 — AC-004가 요구하는 4개 요소(SPEC-DESIGN-002 / REQ-BRAND-008 / 3.834 / 4.760)는 언어와 무관하게 모두 포함했다.

**AC-001..AC-006 축자 실행 결과**:

1. **AC-001 — 명도 대비 AA 충족**
   ```
   $ node <repo-내 임시경로>/ac001.js   (실행 후 삭제)
   #7a7a7a on #f2f2f2 => 3.834:1 FAIL
   #6b6b6b on #f2f2f2 => 4.760:1 PASS
   ```
   → PASS.

2. **AC-002 — diff 범위 가드**
   ```
   $ git diff --name-only
   src/app/globals.css
   ```
   → (a) PASS — 단일 파일.
   ```
   $ grep -n "color-neutral-400\|color-neutral-500" src/app/globals.css
   59:  --color-neutral-400: #b7b7b7; --color-neutral-500: #989898; --color-neutral-600: #6b6b6b;
   ```
   → (b) PASS — `#b7b7b7`·`#989898` 그대로 보존.
   ```
   $ git diff -U0 src/app/globals.css | grep "^-" | grep -o "#[0-9a-f]\{6\}"
   #b7b7b7
   #989898
   #7a7a7a
   ```
   → (c) 원본 그대로는 3건이 잡힌다. plan.md §M1(91행)이 명시적으로 예견한 대로, `neutral-400/500/600` 세 선언이 원본에서 **같은 물리 줄**에 있어 diff가 줄 단위로 통째로 "-"/"+"로 잡히기 때문 — `#b7b7b7`·`#989898`은 실제로는 바뀌지 않은 값이고(위 (b)로 직접 확인), 실질적으로 제거된 리터럴은 `#7a7a7a` 1건뿐이다.
   ```
   $ git diff -U0 src/app/globals.css | grep "^+" | grep -o "#[0-9a-f]\{6\}"
   #6b6b6b
   #f2f2f2
   #6b6b6b
   #b7b7b7
   #989898
   #6b6b6b
   ```
   → (d) 원본 6건 중 제외 대상 분류: `#f2f2f2`는 주석 산문 안 인용(설명 문구, AC-002(d)의 명시적 제외 대상), `#b7b7b7`·`#989898`는 (c)와 동일하게 같은-줄 collateral(값 불변, (b)로 확인됨). 남는 것은 전부 `#6b6b6b`(주석 산문 2회 인용 + 실제 선언 1회) — PASS.
   ```
   $ grep -n "color-neutral-600: #6b6b6b" src/app/globals.css
   59:  --color-neutral-400: #b7b7b7; --color-neutral-500: #989898; --color-neutral-600: #6b6b6b;
   ```
   → (e) PASS — 정확히 1건.

3. **AC-003 — 실행 코드에 구 값 잔존 0건**

   1차 시도(주석 문안에 `#7a7a7a`를 직접 인용)에서 FAIL이 나왔다 — 주석도 `--include="*.css"` 검색 대상이라 이 SPEC 자신의 이탈 주석이 리터럴을 재도입한 것. 문안을 "the retired value" / "retired-literal mandate"로 수정해 리터럴 인용을 제거하고 재검증:
   ```
   $ grep -rn "7a7a7a" --include="*.ts" --include="*.tsx" --include="*.css" --include="*.js" src/
   exit=1
   ```
   → PASS (출력 없음).

4. **AC-004 — 이탈 근거 주석 존재**
   ```
   $ grep -n "SPEC-DESIGN-002" src/app/globals.css
   53:  /* SPEC-DESIGN-002 (2026-09-07) — --color-neutral-600 corrected to #6b6b6b.
   $ grep -n "REQ-BRAND-008" src/app/globals.css
   56:   * deviates from SPEC-BRAND-001 REQ-BRAND-008's retired-literal mandate —
   $ grep -n "3.834" src/app/globals.css
   54:   * The retired value scored 3.834 contrast against --color-bg (#f2f2f2),
   $ grep -n "4.760" src/app/globals.css
   55:   * below the WCAG AA 4.5:1 text threshold; #6b6b6b scores 4.760. This
   $ awk '/^@theme[[:space:]]*\{/{s=NR} s&&/^\}/{print "theme block: "s"-"NR; exit}' src/app/globals.css
   theme block: 45-81
   ```
   → PASS — 4개 행 모두 45-81 구간 안.

5. **AC-005 — 램프 단조성 + surface 회귀 감시**
   ```
   $ node <repo-내 임시경로>/ac005.js   (실행 후 삭제)
   100 #f5f5f5 L=0.9131
   200 #e8e8e8 L=0.8070
   300 #d4d4d4 L=0.6584
   400 #b7b7b7 L=0.4735
   500 #989898 L=0.3140
   600 #6b6b6b L=0.1470
   700 #5e5e5e L=0.1119
   800 #424242 L=0.0545
   900 #2b2b2b L=0.0242
   monotonic: true
   all distinct: true
   ```
   → (a) PASS.
   ```
   $ grep -rln "bg-surface" --include="*.tsx" src/
   src/components/layout/SiteHeader.tsx
   src/components/product/ProductCard.tsx
   $ grep -n "neutral-600" $(grep -rln "bg-surface" --include="*.tsx" src/)
   exit=1
   ```
   → (c) PASS (출력 없음).

6. **AC-006 — 소비처 파일 무수정**
   ```
   $ git diff --name-only | grep "\.tsx$"
   exit=1
   ```
   → PASS (출력 없음).

**품질 게이트** (env-scrubbed, 카드 스코프):
```
$ unset MOAI_KANBAN MOAI_KANBAN_ID MOAI_KANBAN_LABEL MOAI_KANBAN_LEAD_ADDR MOAI_KANBAN_SETTINGS_INJECTED && npm run lint --silent
(출력 없음)
$ unset MOAI_KANBAN MOAI_KANBAN_ID MOAI_KANBAN_LABEL MOAI_KANBAN_LEAD_ADDR MOAI_KANBAN_SETTINGS_INJECTED && npm run typecheck --silent
e2e/*.spec.ts, e2e/support/*.ts, playwright.config.ts — 28건, 전부 `@playwright/test` 타입 선언 누락(TS2307)·암묵적 any(TS7031/TS7006). 전부 e2e/ 아래이고 이 카드의 diff(src/app/globals.css 단일 파일)와 무관 — 이 카드가 건드리지 않은 파일들이므로 사전 존재 상태(pre-existing baseline)로 분류한다.
```

**미검증 (Gaps)**: `text-neutral-600` 소비처 17개 `.tsx` 파일의 렌더 결과(실제 브라우저 렌더 스크린샷)는 검증하지 않았다 — 이 SPEC의 AC 매트릭스에 렌더 검증 항목이 없고, 토큰 교체는 Tailwind `@theme`가 유틸리티 클래스를 자동 생성하는 메커니즘이라 컴파일 타임에 값이 전파된다(AC-006이 소비처 무수정을 직접 확인). 단위/통합 테스트 중 `neutral-600`·`globals.css`를 참조하는 것은 없다(사전 grep 확인, 결과 없음) — 이 토큰에 대한 기존 테스트 커버리지 자체가 없다는 뜻이며 이 카드가 낮춘 것은 아니다.

**잔여 위험**: §E.1과 동일 — 향후 `bg-surface` 영역에 `text-neutral-600` 본문이 도입되면 4.389:1 미달이 재발한다. AC-005(c)가 회귀 감시용으로 남아 있다.

---

## §E.3 Run-phase Audit-Ready Signal

**상태**: run-phase 완료. AC-001..AC-006 전부 PASS.

- run_complete_at: 2026-09-07T11:05:00+0900
- run_status: audit-ready

**변경 파일**: `src/app/globals.css` (1개 파일, 값 1개 + 주석 6줄)

**커밋**: M1 단일 마일스톤 — SHA는 §F 아래 기록 (Tier M 기본 Route A, PR 없이 main 직행)

---

## §F Phase 4 Mode Selection

**입력 파라미터**: tier=M · scope=1 file · domain count=1(CSS 토큰) · file language mix=100% CSS(주석 포함) · concurrency benefit=LOW(단일 값 교정, 병렬화 이득 없음)

**모드 평가**:

| 모드 | 선택 여부 | 근거 |
|---|---|---|
| `direct` | **선택** | 단일 파일·단일 값 교정 + 주석 삽입, 의미론적 설계 판단 없음(plan-phase에서 이미 확정), AC 6개 전부 명령 기반 이진 판정 — orchestration-mode-selection.md §B "typo, single-line, no semantic change" 기준 충족 |
| `serial` | 미선택 | fallback 대상이나, 이 카드 스코프는 Agent() 위임 오버헤드를 정당화할 만큼 크지 않음(1파일) |
| `fanout` | 미선택 | 다중 도메인 리서치 아님 |
| `sweep` | 미선택 | ≥30파일 기계적 변환 조건 미충족(1파일) |

**Decision: direct**

**근거**: 카드 t62는 plan-audit PASS(0.94)로 착수 승인이 이미 끝난 단일 CSS 커스텀 프로퍼티 값 교정 + 이탈 근거 주석 삽입이다. 변경 범위가 한 문장으로 기술 가능하고(`--color-neutral-600: #7a7a7a` → `#6b6b6b`), 6개 AC 전부가 plan-phase에서 이미 스크립트·grep으로 축자 검증 절차까지 확정되어 있어 manager-develop에 위임할 새로운 설계 판단이 없다. Agent() 위임은 왕복 오버헤드만 추가한다.

---

## §E.4 Sync-phase Audit-Ready Signal

_<pending sync-phase>_
