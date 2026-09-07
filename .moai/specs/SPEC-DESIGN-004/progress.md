# SPEC-DESIGN-004 — 진행 기록

카드: t72 · 워크트리: `.claude/worktrees/t72` · 브랜치: `WT-design-token-docs-sync` · 분기점: `origin/main` = `cfbd320`

---

## §E.1 Plan-phase Audit-Ready Signal

**상태**: plan-phase 완료. 독립 plan-audit **PASS** (iter3, 0.93).

**감사 경로 (정직한 기록)**: 이 SPEC을 저작한 `manager-spec` 에이전트는 `Agent` 도구를 갖지 않아 `plan-auditor`를 스스로 스폰할 수 없다. **자기 감사로 대체하지 않았다.** 독립 감사는 오케스트레이터가 `plan-auditor`에 3회 위임했다 — iter1 0.845 FAIL(blocking D1·D2·D3) → 수정 후 iter2 0.91 FAIL(잔여 blocking N1 — spec.md §2.5 수치 교정이 progress.md §E.1로 전파되지 않음) → 수정 후 iter3 0.93 **PASS**(신규 결함 없음, 점수 단조 상승, STOP 신호 없음). 점수 추이 전체와 결함별 상세는 `.moai/reports/plan-audit/SPEC-DESIGN-004-review-{1,2,3}.md`에 원본 보존. 자매 SPEC-DESIGN-002·-003도 같은 오케스트레이터 위임 경로를 밟았다.

```yaml
plan_status: audit-ready
plan_complete_at: 2026-09-07
plan_audit_verdict: PASS          # iter3 — N1 해소 확인됨, 신규 결함 없음
plan_audit_score: 0.93            # iter1 0.845 → iter2 0.91 → iter3 0.93 (단조 상승, STOP 없음)
plan_audit_iterations: 3
plan_audit_report: ".moai/reports/plan-audit/SPEC-DESIGN-004-review-3.md"
plan_audit_threshold: 0.80        # Tier M
blocker: null
next_action: "Implementation Kickoff Approval 이후 run-phase 진입"
```

**산출물** (Tier M — 판정 근거는 `plan.md` §A):

| 파일 | 상태 |
|---|---|
| `spec.md` | 작성 완료 — GEARS 요구사항 **10건**(REQ-DESIGN4-001..010), Out of Scope **7개 항목**, §2 전수 측정 7개 절 |
| `plan.md` | 작성 완료 — Tier 판정(§A) · 소유권 경계 결정(§B) · 서술 결정 2건(§C) · 마일스톤 4개(§G) · 삽입 텍스트 부록(§I) |
| `acceptance.md` | 작성 완료 — AC-001..AC-010, 전부 명령 기반 이진 판정 |
| `progress.md` | 이 파일 |

### plan-phase에서 실제 실행한 검증

1. **SPEC ID 정규식 자기 검사**
   ```
   $ ID="SPEC-DESIGN-004"; [[ "$ID" =~ ^SPEC(-[A-Z][A-Z0-9]*)+-[0-9]{3}$ ]] && echo PASS || echo FAIL
   PASS
   ```

2. **SPEC ID 중복 검사**
   ```
   $ grep -rl "SPEC-DESIGN-004" .moai/
   exit=1   (기존 사용 0건)
   ```

3. **baseline 고정**
   ```
   $ git rev-parse HEAD
   cfbd320d1b1cb2f2c1400b088262539c75a77879
   $ git rev-parse origin/main
   cfbd320d1b1cb2f2c1400b088262539c75a77879
   ```
   → 워크트리 HEAD == `origin/main`. AC의 baseline 고정값으로 채택.

4. **`tokens.json` ↔ `globals.css` 토큰 전수 대조** (spec.md §2.1의 39행 표)

   두 파일을 전문 읽어 키별로 수동 대조했다. 결과: **39개 중 29개 불일치 · 10개 일치**(간격 6 · 반경 3 · `font-heading-weight` 1). 색상 24개는 **전부** 불일치.

   특히 기록해 둘 값:
   ```
   tokens.json  neutral-600: #7d7979     (Classical)
   globals.css  neutral-600: #6b6b6b     (SPEC-DESIGN-002 교정값 — BRAND-001 리터럴 #7a7a7a가 아님)
   ```
   → 재동기화 원천을 SPEC-BRAND-001 문서로 잡으면 이 한 값이 틀린다(plan.md §D.2).

5. **`globals.css` 헤더 주석의 허위 주장 행 단위 판정** (spec.md §2.3)

   헤더 주석은 3-44행 단일 블록(`@theme {`은 45행). 10개 문단 중 거짓 3개 · 참 7개로 판정했다. 사용자가 지목한 4-11행에 **국한되지 않고** 23-28행("Classical's WARM grays")까지 걸쳐 있다는 것이 이 조사의 신규 발견이다.

6. **`globals.css` 원문 텍스트를 읽는 테스트 전수 조사** — 이 카드의 최대 위험

   ```
   $ grep -rn "globals.css" tests/ e2e/
   tests/unit/app/shell.test.tsx:54,55
   tests/unit/app/typography-cascade.test.tsx:11,21,26,34
   tests/unit/app/design-tokens-grayscale.test.ts:5,14,17
   ```

   세 파일을 전문 읽어 정규식 결합을 개별 확인했다. 주석 산문에 걸리는 제약 3건을 특정하고 착수 전 상태를 실측했다:

   ```
   $ head -1 src/app/globals.css
   @import "tailwindcss";

   $ grep -c "accent-2-" src/app/globals.css
   0

   $ grep -n "body\s*{" src/app/globals.css
   114:body {
   ```

   → 세 제약 전부 현재 충족 상태. AC-007이 재작성 후 재검사한다.

7. **런타임 소비처 측정** (spec.md §2.5)

   ```
   $ grep -rn "tokens.json" src/
   exit=1

   $ grep -rn "\.moai/design" src/
   exit=1

   $ git grep -n "tokens.json" cfbd320 -- . ':(exclude).moai/specs/*' | wc -l
   15
   (15건 — 전부 문서 참조: CHANGELOG 2 · BRIEF 6 · sync-audit 보고서 2 · MoAI 하니스 예약경로 선언 5)

   $ grep -n '"scripts"' -A 12 package.json
   dev / build / start / lint / typecheck / test / test:coverage / test:e2e / prisma:generate / prisma:validate
   ```

   **측정 명령 교정 기록**: 최초 초안은 작업 트리 대상 `grep -rn ... --exclude-dir=specs`를 적고 결과를 «13건(BRIEF 5 · 하니스 4)»으로 기록했으나 그 수치는 재현되지 않는다. baseline 고정 명령으로 재측정해 **15건(BRIEF 6 · 하니스 5)**으로 교정했으며, 위에 적은 명령과 출력은 실제로 재실행해 관측한 값이다. 작업 트리 대상 명령을 버린 이유는 이후 생성되는 plan-audit 보고서가 자기 자신을 세어 수치가 흔들리기 때문이다(spec.md §2.5 L225의 baseline 고정 근거와 동일). 교정 후 수치는 spec.md §2.5 L225·L234-240과 정확히 일치한다.

   → 애플리케이션 런타임·빌드·테스트 어느 경로도 `tokens.json`을 읽지 않는다. **다만 «읽는 도구가 없다»는 아니다** — `.claude/rules/moai/design/constitution.md:90`이 이 경로를 MoAI design-phase의 **예약 경로**로 선언한다(spec.md §2.6).

8. **DesignSync 가용성 재측정** (인용이 아니라 직접 확인)

   ```
   $ cat .mcp.json     (mcpServers 키)
   context7 · moai · playwright        ← DesignSync 없음

   $ ls -d .moai/project/brand
   (존재하지 않음)
   ```
   → `tokens.json`의 `live_reverification` 블록이 기록한 관측이 지금도 유효하다. 라이브 대조는 이 카드에서도 불가능하며, 범위에서 제외했다.

9. **`globals.css` 커밋 계보 확인** (계보 서술의 근거)

   ```
   $ git log --oneline -- src/app/globals.css
   5b2881e fix(SPEC-DESIGN-002): correct --color-neutral-600 to #6b6b6b for WCAG AA (#33)
   b1c2862 feat(SPEC-BRAND-001): 우리샵 → OUR 브랜드 전환 (#32)
   6c8b00b chore: CodeRabbit follow-up cleanup batch (14 cards, 4 SPECs) (#29)
   e8c4ef3 feat(SPEC-DESIGN-001): 공통 디자인 토큰 체계 수립과 전체 사이트 반영 (#28)
   19bd29f feat(SPEC-STOREFRONT-001): product detail page UI + image gallery (#6)

   $ git log -L 3,44:src/app/globals.css --oneline --no-patch
   e8c4ef3 ...
   19bd29f ...
   ```

   → **핵심 확인**: `b1c2862`(SPEC-BRAND-001)가 `@theme` **값**을 전면 교체했으면서 헤더 주석(3-44행)은 **건드리지 않았다**. 그 커밋의 diff가 `@@ -43,18 +43,18 @@`에서 시작해 44행(주석 종료)을 문맥으로만 포함하는 것이 직접 증거다. 이것이 허위 주장이 발생한 정확한 메커니즘이다.

10. **SPEC-DESIGN-001 §D.1 삽입 지점 확인**

    ```
    $ grep -n "^### §D.1" .moai/specs/SPEC-DESIGN-001/plan.md
    204:### §D.1 Classical 토큰 블록 — 확정 값 (원문 인용, SSOT)
    239:### §D.1b 현재 값 → Classical 매핑 (교체 표)

    $ grep -n "^status:" .moai/specs/SPEC-DESIGN-001/spec.md
    4:status: completed

    $ sed -n '1,6p' .moai/specs/SPEC-DESIGN-001/plan.md
    id: SPEC-DESIGN-001 / status: in-progress / updated: 2026-09-05 / tier: M
    ```

    → `spec.md`는 `completed`, `plan.md` frontmatter는 `in-progress`로 **어긋나 있다**. 관측했으나 이 카드의 범위가 아니다(plan.md §D.3이 «마침 열었으니 고치자»를 명시적으로 금지).

11. **AC-006 추출식의 실제 행 수 실측** (문서에 추정치를 적지 않기 위해)

    ```
    $ awk '/^@theme/{exit} {print}' src/app/globals.css | wc -l
    44                    ← 헤더 주석 구간 (1-44행)

    $ awk '/^@theme/{f=1} f' src/app/globals.css | wc -l
    98                    ← @theme 선언 행부터 EOF (45-142행)

    $ wc -l < src/app/globals.css
    142
    $ grep -n "^@theme" src/app/globals.css
    45:@theme {
    ```

    → AC-006의 기대 행 수를 **98**로 확정했다. 최초 초안에 «99행(45-143행)»으로 적었던 것은 계산 착오였으며(파일은 143행이 아니라 142행), 실측으로 교정했다.

12. **AC-001 스크립트를 plan-phase에서 실제 실행해 파서를 검증했다** — 이 카드에서 가장 중요한 사전 검증

    교체 **전** 상태에서 실행한 결과:

    ```
    $ node .moai/state/verify/SPEC-DESIGN-004/ac001-token-diff.js
    MISMATCH --color-bg
      tokens.json: #f3f2f2
      globals.css: #f2f2f2
    ... (29건)
    MISMATCH --shadow-lg
      tokens.json: 0 12px 32px color-mix(in srgb, #2d2b2b 22%, transparent)
      globals.css: 0 12px 32px color-mix(in srgb, #1f1f1f 22%, transparent)
    shippedKeys=39
    checked=39 mismatch=29
    exit=1
    ```

    세 가지가 동시에 확인되었다:
    - **파서가 동작한다.** `shippedKeys=39` — `@theme` 블록의 39개 선언이 전부 파싱되었다. 주석 제거가 선행되지 않으면 SPEC-DESIGN-002 주석(53-58행)의 세미콜론 때문에 깨지는데, 깨지지 않았다.
    - **키 매핑이 옳다.** `checked=39` 이고 `undefined`로 보고된 키가 0건 — `tokens.json`의 5개 그룹 키가 `--color-*` / `--*` 규칙으로 `@theme` 이름에 정확히 대응한다.
    - **`spec.md` §2.1의 수동 대조표가 독립적으로 확인되었다.** 기계 판정 `mismatch=29`가 손으로 만든 표의 29건(색 24 · 폰트 2 · 그림자 3)과 정확히 일치하고, 일치 10건(간격 6 · 반경 3 · `font-heading-weight` 1)도 그대로다.

    스크립트는 검증 후 삭제했다 — `acceptance.md` AC-001이 축자 원문을 담고 있으므로 run-phase가 거기서 재생성한다:

    ```
    $ test -e .moai/state/verify/SPEC-DESIGN-004/ac001-token-diff.js && echo PRESENT || echo REMOVED
    REMOVED
    ```

13. **선행 SPEC의 전방 포인터 확인** (이 카드가 실재하는 예약을 이행하는지)

    ```
    $ grep -n "Out of Scope" .moai/specs/SPEC-DESIGN-002/spec.md
    133:### Out of Scope — `.moai/design/tokens.json` 갱신
    139:### Out of Scope — `globals.css` 상단 주석(4-11행)의 전면 교정
    ```
    두 절 모두 «별도 카드를 권고한다»는 전방 포인터로 끝나며, 후자는 «위 `tokens.json` 항목과 **한 카드로 묶는 것이 자연스럽다**»고 명시한다. 이 SPEC이 그 권고 그대로다.

### 이 SPEC이 해결한 plan-phase 설계 결정

| 결정 | 위치 | 요지 |
|---|---|---|
| Tier 판정 | `plan.md` §A | 수치 신호 둘 다 S를 가리키나 **M으로 상향**. 근거: AC 구조가 인라인에 안 담김 · 자매 카드 선례(DESIGN-002는 1파일 1행인데 M) · 감사 임계를 낮출 이유 없음 |
| Part 3 소유권 경계 | `plan.md` §B | **manager-spec 전용 M3으로 분리.** 「미리 승인된 텍스트 복사는 집필이 아니므로 manager-develop이 해도 된다」는 대안은 기각 — 규칙이 명명하는 것은 파일 표면이지 지적 행위가 아니다 |
| `tokens.json` 폰트 토큰 표기 | `plan.md` §C.1 | 출시 리터럴(`var(--font-*-nf)`)을 `tokens`에 기록하고 렌더 서체(Cormorant Garamond / Lora)는 `notes[]`에 별도 보존 |
| 헤더 주석 재작성 원칙 | `plan.md` §C.2 | 단일 SSOT 지목이 아니라 **계층 서술 + `@theme` 자신이 최종 권위**. 「재동기화 원천」 지시 자체를 제거 |

### 미검증 (Gaps)

- **독립 plan-audit은 2회 수행됐다(iter1 0.845 FAIL → iter2 0.91 FAIL → iter3 0.93 PASS)** — 이 절 최상단 참고. 미검증으로 남는 것은 iter3 이후의 항목뿐이다.
- **빌드·린트·타입체크·테스트를 plan-phase에서 실행하지 않았다** — run-phase AC-010의 대상이다. §E.1 검증 6번의 세 grep은 파일 텍스트 검사이지 테스트 실행이 아니다.
- ~~AC-001 스크립트를 plan-phase에서 실행하지 않았다.~~ **해소됨** — 검증 12번이 교체 전 상태에서 실제 실행해 파서 동작(`shippedKeys=39` · `checked=39`)과 `spec.md` §2.1 수동 대조표(`mismatch=29`)를 독립 확인했다. 다만 **`mismatch=0` 경로는 아직 실행된 적이 없다** — 스크립트의 성공 분기(`process.exit(0)`)는 run-phase M1에서 처음 밟힌다.
- **AC-002 · AC-003의 `node -e` 검사식은 실행하지 않았다.** 재동기화 후의 파일 형태를 전제하므로 현재 트리에서는 의미 있는 판정이 나오지 않는다. AC-001 스크립트와 달리 사전 검증하지 못했다.
- **`tokens.json`을 소비할 장래 design-phase 파이프라인을 실행해 보지 않았다.** 예약 경로라는 사실은 하니스 규칙 문서로 확인했으나(§2.6), `manager-design` / `/moai design`을 실제로 돌려 이 파일이 읽히는지는 관측하지 않았다.
- **`components.json`과 `brief/BRIEF-DESIGN-001.md`의 어긋남 정도를 정량화하지 않았다.** 범위 밖으로 판정했으므로 존재만 기록했고 전수 대조는 하지 않았다.

### 잔여 위험

1. **주석 산문이 테스트 정규식을 깨는 형태**(`plan.md` §D.1). 특히 `accent-2-`는 accent 램프를 설명하는 자연스러운 문장에서 실수로 들어가기 쉽고, 실패했을 때 원인이 「주석 텍스트」라는 점이 진단을 어렵게 한다. AC-007과 M2 게이트가 감시하지만, 감시는 커밋 전 실행에 의존한다.
2. **AC-001 스크립트의 `@theme` 추출 정규식이 `/@theme\s*\{([\s\S]*?)\n\}/`** 로, 블록 안에 자체 행으로 놓인 `}`가 생기면 조기 종료한다. 현재 트리에는 없으나(`typography-cascade.test.tsx`가 같은 정규식을 쓰고 통과 중), 장래 `@theme` 안에 중첩 블록이 도입되면 조용히 부분 대조가 된다. `checked=39` 어서션이 이 실패를 잡도록 설계했다.
3. **`globals.css` 72행의 잔존 허위 주장**(spec.md §3). 이 카드가 헤더를 고쳐도 파일 안에 같은 성격의 주장이 한 곳 남는다. 사용자 지정 범위를 지킨 결과이며, 후속 카드 권고 대상이다.
4. **`tokens.json`은 런타임 소비처가 0건이므로 이 카드의 정확성을 검증하는 실행 경로가 없다.** AC-001의 기계적 대조가 유일한 안전망이며, 그 대조가 통과해도 값이 「디자인 의도로서 옳은지」는 판정하지 않는다 — 이 카드는 «출시 상태를 그대로 반영했는가»만 보증한다.

---

## §E.2 Run-phase Evidence

_<pending run-phase>_

---

## §E.3 Run-phase Audit-Ready Signal

_<pending run-phase>_

---

## §E.4 Sync-phase Audit-Ready Signal

_<pending sync-phase>_
