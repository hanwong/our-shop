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

**실행 환경 (기록)**: M4(이 절의 검증 실행과 증적 기록)를 위임받은 에이전트는 런타임에 의해 자기 전용 워크트리 `.claude/worktrees/agent-ae084f45b184d5cbe`로 격리되었다 — `t72`가 `WT-design-token-docs-sync`를 잠근 상태로 점유 중이기 때문이다. 격리된 워크트리의 초기 HEAD는 `cfbd320`(= baseline)이었고 M1·M2·M3의 작업 트리를 담고 있지 않았다. 따라서 M3 HEAD `eef14af`에서 로컬 브랜치 `design004-m4`를 분기해 **M1·M2·M3가 반영된 정확한 트리 위에서** 아래 검증을 전부 실행했다.

```
$ git rev-parse HEAD
eef14af48fe02f38105cd9386db49d448d27f8e4
$ git branch --show-current
design004-m4
$ git status --short
(출력 없음 — 클린)
```

baseline 고정값 `cfbd320`은 그대로 유효하다. `origin/WT-design-token-docs-sync`가 `eef14af`와 동일 SHA이므로 이 절의 커밋은 그 브랜치의 fast-forward 자손이다.

**마일스톤 커밋** (`plan.md` §B.5가 요구한 분리 — `git log --format="%H %s" cfbd320..eef14af` 축자 출력):

| 마일스톤 | 커밋 | 제목 |
|---|---|---|
| M1 | `af2f5fb52a13ed421f430d65fdd664183a8d7741` | `feat(SPEC-DESIGN-004): M1 — resync .moai/design/tokens.json to shipped @theme` |
| M2 | `baf048cb301c984ed718fe5e822079c12744495d` | `docs(SPEC-DESIGN-004): M2 — correct false claims in globals.css header comment` |
| M3 | `eef14af48fe02f38105cd9386db49d448d27f8e4` | `docs(SPEC-DESIGN-004): M3 — insert superseded marker into SPEC-DESIGN-001/plan.md §D.1` |

세 마일스톤이 **각각 독립 커밋**이다. M3은 `manager-spec`이 단독 수행했다(`plan.md` §B 소유권 경계).

---

### AC 판정 매트릭스

| AC | 판정 | 검증 명령 | 실제 출력 |
|---|---|---|---|
| AC-001 | **PASS** | `node .../ac001-token-diff.js` + Classical 리터럴 grep | `shippedKeys=39` · `checked=39 mismatch=0` · `exit=0` · 리터럴 `0` |
| AC-002 | **PASS** | `node -e` 메타필드 검사 + 계보 3 grep | `Classical_as_source= 0` · `D1_pointer= 0` · `4`/`1`/`5` |
| AC-003 | **PASS** | JSON 파싱 + 보존 서술 + 그룹/총계 | `JSON_OK` · `1`/`2`/`12` · `1`/`1` · `groups= color,typography,spacing,radius,shadow` `total= 39` |
| AC-004 | **PASS** | `header.txt` 대상 거짓 주장 3군 grep | `0` · `0` · `0` |
| AC-005 | **PASS** | `header.txt` 대상 보존 4 + 계보 2 grep | `1`/`2`/`1`/`2`/`3`/`1` — 전부 ≥1 |
| AC-006 | **PASS** | `@theme`~EOF 구간 baseline `diff` | `diff` 출력 없음 · `exit=0` · `98`행 |
| AC-007 | **PASS** | (a)(b)(c) 제약 + (d) 테스트 3파일 실행 | `@import "tailwindcss";` · `0` · `126:body {`(경계 `57`) · 3파일 17건 전원 통과 |
| AC-008 | **PASS** | 표제/표기/표제 행번호 + 지목 3 + 표제 무변경 | `H=204 < M=206 < B=251` · `1`/`1`/`10` · baseline `1` / current `1` |
| AC-009 | **PASS** | 변경파일 1개 + 삭제행 0 + frontmatter/status/amendment | `plan.md` 단일 · `0` · frontmatter 동일 · `status: completed` · `0`/`0` |
| AC-010 | **PASS** | 대상 3개 + 범위 밖 0 + lint/typecheck/test | 3줄 · `exit=1`(무출력) · lint `exit=0` · `src/` 신규 오류 `0` · 테스트 1665건 전원 통과 |

**FAIL 0건 · PASS-WITH-DEBT 0건 · 10/10 PASS.**

---

#### AC-001 — `tokens.json` 39개 토큰이 `@theme`과 문자 단위 일치

```
$ node .moai/state/verify/SPEC-DESIGN-004/ac001-token-diff.js
shippedKeys=39
checked=39 mismatch=0
$ echo "exit=$?"
exit=0
```

`MISMATCH` 행 **0건**. plan-phase 검증 12번이 교체 전 상태에서 관측한 `mismatch=29`가 `mismatch=0`으로 해소되었고, `shippedKeys=39`가 유지되므로 「값이 맞았다」이지 「파싱이 깨져 비교가 생략됐다」가 아니다(`acceptance.md` AC-001 주석의 판별 기준). 스크립트의 성공 분기 `process.exit(0)`는 이번이 최초 실행이다(§E.1 Gaps에 예고된 대로).

**독립 교차 검사 (b)** — 옛 Classical 색 리터럴 23종 잔존:

```
$ grep -oE "f3f2f2|eae9e9|201f1d|...|3a270d" .moai/design/tokens.json | wc -l
       0
```

**스크립트 사후 처리**:

```
$ rm -f .moai/state/verify/SPEC-DESIGN-004/ac001-token-diff.js
$ test -e .moai/state/verify/SPEC-DESIGN-004/ac001-token-diff.js && echo PRESENT || echo REMOVED
REMOVED
```

#### AC-002 — 서술 필드가 Classical을 현재 원천으로 지목하지 않는다

```
$ node -e '... console.log("Classical_as_source=", ...); console.log("D1_pointer=", ...)'
Classical_as_source= 0
D1_pointer= 0

$ grep -c "SPEC-BRAND-001" .moai/design/tokens.json
4
$ grep -c "SPEC-DESIGN-002" .moai/design/tokens.json
1
$ grep -c "globals.css" .moai/design/tokens.json
5
```

`source.design_system`이 더 이상 `"Classical"`이 아니고, 메타 필드가 §D.1을 현재 원천으로 가리키지 않는다. 실제 계보 3건이 전부 명시되었다.

#### AC-003 — 보존 대상 서술 2건 생존 + JSON 유효

```
$ node -e 'JSON.parse(...); console.log("JSON_OK")'
JSON_OK

$ grep -c "1.15" .moai/design/tokens.json
1
$ grep -c "4.6" .moai/design/tokens.json
2
$ grep -ci "accent" .moai/design/tokens.json
12

$ grep -c "Cormorant Garamond" .moai/design/tokens.json
1
$ grep -c "Lora" .moai/design/tokens.json
1

$ node -e '... groups / total'
groups= color,typography,spacing,radius,shadow
total= 39
```

`tokens.typography` 값이 `var(--font-*-nf)` 리터럴로 바뀌었음에도 렌더 서체명 2건이 `notes`에 보존되었다(`plan.md` §C.1 결정 이행).

#### AC-004 — 헤더 주석에서 거짓 주장 3군 소멸

```
$ awk '/^@theme/{exit} {print}' src/app/globals.css > .moai/state/verify/SPEC-DESIGN-004/header.txt

$ grep -c "§D.1"   .moai/state/verify/SPEC-DESIGN-004/header.txt
0
$ grep -ci "byte"  .moai/state/verify/SPEC-DESIGN-004/header.txt
0
$ grep -c "WARM"   .moai/state/verify/SPEC-DESIGN-004/header.txt
0
```

세 값 전부 `0`. §D.1 앵커가 소멸하면서 4행 SSOT 지목·8-9행 재동기화 지시·24행 주의 참조가 동시에 해소된다(`acceptance.md` AC-004의 문자열 선정 근거).

#### AC-005 — 참인 서술 4건 + 실제 계보 생존

```
$ grep -c "STOREFRONT-001"  .../header.txt
1
$ grep -c "@theme"          .../header.txt
2
$ grep -c "radius-md"       .../header.txt
1
$ grep -c "spacing-"        .../header.txt
2
$ grep -c "SPEC-BRAND-001"  .../header.txt
3
$ grep -c "SPEC-DESIGN-002" .../header.txt
1
```

여섯 값 전부 ≥1. 특히 `spacing-` 2건 — `--space-*`를 Tailwind 예약 `--spacing-*`로 개명하지 **않은** 비자명한 결정의 근거가 살아 있다.

#### AC-006 — `@theme` 선언 행부터 EOF까지 바이트 단위 무변경

```
$ git show cfbd320:src/app/globals.css | awk '/^@theme/{f=1} f' > .../theme-base.txt
$ awk '/^@theme/{f=1} f' src/app/globals.css                    > .../theme-head.txt

$ diff .../theme-base.txt .../theme-head.txt
(출력 없음)
$ echo "exit=$?"
exit=0

$ wc -l < .../theme-head.txt
      98
```

**이 카드에서 가장 중요한 단일 증적.** `diff` 무출력 + `exit=0` + `98`행(plan-phase 실측치와 일치)이 동시에 성립하므로, 토큰 값 39개·SPEC-DESIGN-002 주석·t51 주석·`.plate`/`body`/제목 규칙이 **전부** 무변경이다. `plan.md` §F PRESERVE 목록의 `globals.css` 항목이 여기에 포섭된다. 브라우저 렌더 확인을 생략한 근거이기도 하다(`acceptance.md` §D.2).

#### AC-007 — 테스트 결합 3제약 충족

```
$ head -1 src/app/globals.css
@import "tailwindcss";

$ grep -c "accent-2-" src/app/globals.css
0

$ grep -n "body\s*{" src/app/globals.css
126:body {

$ grep -n "^@theme" src/app/globals.css
57:@theme {
```

(c) 매치가 **정확히 1건**이고 행번호 `126 > 57`이므로 주석 안이 아니라 `@theme` 블록 뒤의 실제 `body` 규칙이다(`acceptance.md` AC-007(c) 판정 방법). baseline 114행 → 현재 126행으로 이동한 것은 헤더 주석 재작성에 따른 것이며 매치 건수 1은 유지되었다.

**(d) 세 테스트 실제 실행**:

```
$ npx vitest run tests/unit/app/shell.test.tsx tests/unit/app/typography-cascade.test.tsx tests/unit/app/design-tokens-grayscale.test.ts
 ✓ tests/unit/app/typography-cascade.test.tsx (2 tests) 1ms
 ✓ tests/unit/app/design-tokens-grayscale.test.ts (6 tests) 2ms
 ✓ tests/unit/app/shell.test.tsx (9 tests) 115ms

 Test Files  3 passed (3)
      Tests  17 passed (17)
exit=0
```

`plan.md` §D.1이 지목한 최대 위험 — 주석 산문이 무관한 테스트를 깨뜨리는 형태 — 이 실현되지 않았음이 실행으로 확인되었다.

#### AC-008 — SPEC-DESIGN-001 §D.1에 표기 존재 + 삽입 지점 정확

```
$ grep -n "^### §D.1 Classical" .moai/specs/SPEC-DESIGN-001/plan.md
204:### §D.1 Classical 토큰 블록 — 확정 값 (원문 인용, SSOT)
$ grep -n "초과 — SUPERSEDED"    .moai/specs/SPEC-DESIGN-001/plan.md
206:> **[초과 — SUPERSEDED] 이 절의 값은 더 이상 출시 상태가 아니다.** (표기 추가: 2026-09-07, SPEC-DESIGN-004 / 카드 t72)
$ grep -n "^### §D.1b"           .moai/specs/SPEC-DESIGN-001/plan.md
251:### §D.1b 현재 값 → Classical 매핑 (교체 표)
```

`H=204 < M=206 < B=251` — 표기가 §D.1 표제 뒤·§D.1b 표제 앞에 위치한다. 표기는 정확히 1건.

```
$ grep -c "SPEC-BRAND-001"  .moai/specs/SPEC-DESIGN-001/plan.md
1
$ grep -c "SPEC-DESIGN-002" .moai/specs/SPEC-DESIGN-001/plan.md
1
$ grep -c "globals.css"     .moai/specs/SPEC-DESIGN-001/plan.md
10

$ git show cfbd320:.moai/specs/SPEC-DESIGN-001/plan.md | grep -c "^### §D.1 Classical 토큰 블록 — 확정 값 (원문 인용, SSOT)$"
1
$ grep -c "^### §D.1 Classical 토큰 블록 — 확정 값 (원문 인용, SSOT)$" .moai/specs/SPEC-DESIGN-001/plan.md
1
```

표제 행이 baseline과 동일하게 남아 있다 — `tokens.json`·SPEC-DESIGN-002 §3·이 SPEC 자신이 「§D.1」로 참조하는 앵커가 끊기지 않았다.

#### AC-009 — SPEC-DESIGN-001이 순수 삽입 + frontmatter 무변경

```
$ git diff --name-only cfbd320 -- .moai/specs/SPEC-DESIGN-001/
.moai/specs/SPEC-DESIGN-001/plan.md

$ git diff cfbd320 -- .moai/specs/SPEC-DESIGN-001/plan.md | grep -c "^-[^-]"
0

$ sed -n '1,6p' .moai/specs/SPEC-DESIGN-001/plan.md
---
id: SPEC-DESIGN-001
status: in-progress
updated: 2026-09-05
tier: M
---
$ git show cfbd320:.moai/specs/SPEC-DESIGN-001/plan.md | sed -n '1,6p'
---
id: SPEC-DESIGN-001
status: in-progress
updated: 2026-09-05
tier: M
---

$ grep -n "^status:" .moai/specs/SPEC-DESIGN-001/spec.md
5:status: completed

$ grep -c "amendment_of" .moai/specs/SPEC-DESIGN-001/spec.md
0
$ grep -c "## Amendments" .moai/specs/SPEC-DESIGN-001/spec.md
0
```

**삭제행 `0`이 이 AC의 핵심**이다 — 기존 값 코드블록·주의 3항목·HISTORY·frontmatter 중 어느 것도 제거되거나 제자리 수정되지 않았음을 한 번에 보증한다(REQ-DESIGN4-009). `plan.md` frontmatter가 `in-progress`로, `spec.md`의 `completed`와 어긋난 상태는 **의도적으로 그대로 두었다**(§E.1 검증 10번 · `plan.md` §D.3이 범위 밖으로 명시).

#### AC-010 — 변경 파일 정확히 3개 + 품질 게이트 신규 실패 0건

```
$ git diff --name-only cfbd320 -- .moai/design/tokens.json src/app/globals.css .moai/specs/SPEC-DESIGN-001/plan.md
.moai/design/tokens.json
.moai/specs/SPEC-DESIGN-001/plan.md
src/app/globals.css
                                        ← 정확히 3줄

$ git diff --name-only cfbd320 | grep -v "^.moai/specs/SPEC-DESIGN-004/" | grep -v "^.moai/design/tokens.json$" | grep -v "^src/app/globals.css$" | grep -v "^.moai/specs/SPEC-DESIGN-001/plan.md$"
(출력 없음)
$ echo "exit=$?"
exit=1

$ git diff --name-only cfbd320 -- src/ | grep -v "^src/app/globals.css$"
(출력 없음)
$ echo "exit=$?"
exit=1

$ git diff --name-only cfbd320 -- src/
src/app/globals.css
```

참고 — baseline 대비 전체 변경 목록(이 SPEC 자신의 산출물 4개 포함):

```
$ git diff --name-only cfbd320
.moai/design/tokens.json
.moai/specs/SPEC-DESIGN-001/plan.md
.moai/specs/SPEC-DESIGN-004/acceptance.md
.moai/specs/SPEC-DESIGN-004/plan.md
.moai/specs/SPEC-DESIGN-004/progress.md
.moai/specs/SPEC-DESIGN-004/spec.md
src/app/globals.css
```

**(d) 린트**:

```
$ npm run lint
> our@0.1.0 lint
> eslint .

exit=0
```

오류 출력 없음.

**(e) 타입체크** — 판정 기준은 절대 건수가 아니라 `src/` 신규 오류 0건:

```
$ npm run typecheck 2>&1 | grep -c "^src/"
0

$ grep -cE "error TS" typecheck.txt
41
$ grep -oE "^[a-zA-Z0-9_.-]+/" typecheck.txt | sort | uniq -c
  40 e2e/
$ grep -E "error TS" typecheck.txt | grep -v "^e2e/"
playwright.config.ts(2,39): error TS2307: Cannot find module '@playwright/test' or its corresponding type declarations.
```

총 41건 = `e2e/**` 40건 + `playwright.config.ts` 1건. **`src/` 오류 0건**. 41이라는 총계는 SPEC-DESIGN-003 `progress.md` §E.2가 실측한 baseline 41건과 정확히 일치하므로, 이 카드가 새 오류를 들이지 않았음이 두 방향으로 확인된다. 원인은 이 워크트리에 `@playwright/test`가 설치되어 있지 않은 것이며(`acceptance.md` §D.2가 예고), 이 카드의 변경과 무관하다.

**(f) 테스트 전량**:

```
$ npm test
 Test Files  130 passed (130)
      Tests  1665 passed (1665)
   Duration  20.94s
exit=0
```

**실패 0건 — 재실행 불필요.** 이 프로젝트에 알려진 타이밍 민감 테스트(`tests/integration/auth/login.test.ts` AC-AUTH-005 응답시간 유사도)가 존재하나 **1회차에서 통과**했으므로 flaky 여부를 가르기 위한 격리 재실행이 필요하지 않았다. 해당 테스트의 실측 마진도 기록해 둔다:

```
[AC-AUTH-005] median(nonexistent-email)=278.11ms median(wrong-password)=276.48ms diff=1.63ms tolerance=41.72ms
```

diff 1.63ms 대 허용치 41.72ms — 임계에서 멀다. 통과 1665건은 SPEC-DESIGN-003이 기록한 1665건과 동일하다(테스트 수 증감 없음 — 이 카드가 `.tsx`와 테스트를 건드리지 않았다는 AC-010(c)와 정합).

---

### §D.1 완료 보고 필수 항목

1. **AC-001 스크립트의 축자 마지막 행**: `checked=39 mismatch=0` (직전 행 `shippedKeys=39`, `exit=0`).
2. **AC-006 `diff`의 exit code와 행 수**: `exit=0`(출력 없음) · `98`행.
3. **AC-007 (a)(b)(c) 세 값의 축자 출력**: (a) `@import "tailwindcss";` · (b) `0` · (c) `126:body {` (경계 `57:@theme {` 보다 뒤 = 실제 규칙).
4. **AC-009 (b)의 값이 `0`**: `git diff cfbd320 -- .moai/specs/SPEC-DESIGN-001/plan.md | grep -c "^-[^-]"` → `0`. 순수 삽입 확정.
5. **M3 커밋이 M1·M2와 분리되었음**: M1 `af2f5fb` · M2 `baf048c` · M3 `eef14af` — 세 개의 독립 커밋(위 마일스톤 표).
6. **미해소로 남는 후속 카드 3건**:
   - (a) `globals.css` `@theme` 내부(baseline 72행 상당)에 잔존하는 같은 성격의 주장 — `spec.md` §3. 사용자 지정 범위를 지킨 결과이며 AC-006이 그 구간의 무변경을 보증하므로 이 카드에서는 손대지 않았다.
   - (b) `.moai/design/components.json` 재동기화 — `spec.md` §3. 어긋남 정도는 정량화하지 않았다(§E.1 Gaps).
   - (c) SPEC-DESIGN-001 본문 전반 재조정 — **카드 t70**. `plan.md` frontmatter `in-progress` ↔ `spec.md` `completed` 불일치(§E.1 검증 10번)를 포함한다.

### 미검증으로 남는 것 (Gaps — `acceptance.md` §D.2 사전 선언대로)

- **브라우저 렌더 확인 미실시.** AC-006이 CSS 커스텀 프로퍼티 값 무변경을 바이트 단위로 보증하므로 렌더 결과가 달라질 경로가 없다. 스크린샷 대조 없음.
- **E2E(Playwright) 미실행.** 이 워크트리에 `@playwright/test`가 설치되어 있지 않다(타입체크 41건 중 1건이 그 증거). AC-010은 lint·typecheck·vitest 세 가지만 요구한다.
- **`npm run build` 미실행.** AC가 요구하지 않는다.
- **DesignSync 라이브 대조 미실시** (`spec.md` §3 · §2.6 — MCP 서버 부재).
- **`tokens.json`을 읽는 장래 design-phase 파이프라인 미검증.** 이 카드는 파일 내용의 정확성만 보증하며, 그것을 소비하는 파이프라인(`manager-design` / `/moai design`)을 실행해 보지 않았다.
- **타입체크 baseline 41건을 `cfbd320`에서 직접 재실행해 대조하지는 않았다.** SPEC-DESIGN-003 `progress.md` §E.2의 실측 기록(41건)과의 일치 및 `src/` 0건이라는 판정 기준으로 갈음했다.

### 잔여 위험

1. **`tokens.json`은 런타임 소비처가 0건이므로 이 카드의 정확성을 검증하는 실행 경로가 없다.** AC-001의 기계적 대조가 유일한 안전망이며, 그 대조가 통과해도 값이 「디자인 의도로서 옳은지」는 판정하지 않는다 — 이 카드는 «출시 상태를 그대로 반영했는가»만 보증한다(§E.1 잔여 위험 4의 존속).
2. **AC-001 스크립트의 `@theme` 추출 정규식**은 블록 안에 자체 행 `}`가 생기면 조기 종료한다. 현재 트리에는 없고 `shippedKeys=39` 어서션이 감시하지만, 장래 `@theme`에 중첩 블록이 도입되면 조용히 부분 대조가 된다.
3. **주석 산문 ↔ 테스트 정규식 결합은 구조적으로 남는다.** 이 카드는 AC-007로 현 시점의 안전을 확인했을 뿐, 결합 자체를 끊지 않았다. 장래 헤더 주석을 다시 손대는 카드는 같은 검사를 반복해야 한다.
4. **`e2e/**` 타입 오류 41건이 baseline으로 존속한다.** 이 카드의 책임은 아니나, 이 상태가 지속되면 「신규 오류 0건」 판정이 `src/` 한정 필터에 계속 의존하게 된다.

---

## §E.3 Run-phase Audit-Ready Signal

```yaml
run_status: audit-ready
run_complete_at: 2026-09-07
run_branch: WT-design-token-docs-sync
run_baseline_sha: cfbd320d1b1cb2f2c1400b088262539c75a77879
run_commits:
  m1: af2f5fb52a13ed421f430d65fdd664183a8d7741
  m2: baf048cb301c984ed718fe5e822079c12744495d
  m3: eef14af48fe02f38105cd9386db49d448d27f8e4
  m4: self                                   # 이 §E.2/§E.3를 담는 증적 커밋 — 커밋은 자기 해시를 알 수 없다.
                                             # 자리표시자를 남기는 대신 실제 SHA는 완료 보고로 전달한다.
ac_total: 10
ac_pass_count: 10
ac_fail_count: 0
ac_pass_with_debt_count: 0
preserve_list_post_run_count: 0              # plan.md §F PRESERVE 목록 위반 0건 (AC-006 · AC-009 · AC-010(b)(c))
total_run_phase_files: 3                     # tokens.json · globals.css · SPEC-DESIGN-001/plan.md
m1_to_mN_commit_strategy: "마일스톤별 분리 커밋 (M1·M2·M3 각각 독립) + M4 증적 커밋"
new_warnings_or_lints_introduced: 0
lint_status: clean                           # npm run lint → exit 0, 출력 없음
typecheck_src_new_errors: 0                  # baseline 41건(e2e/ 40 + playwright.config.ts 1) 전량 존속, src/ 0건
test_suite: "130 files / 1665 tests — 전원 통과, 실패 0건 (1회차 통과, 격리 재실행 불필요)"
cross_platform_build:
  applicable: false                          # Next.js/TypeScript 단일 타깃 — 크로스 플랫폼 빌드 태그 해당 없음
  build_executed: false                      # npm run build는 AC 요구 밖 (acceptance.md §D.2)
e2e_executed: false                          # @playwright/test 미설치 (acceptance.md §D.2 사전 선언)
blocker: null
next_action: "sync-phase 진입 — manager-docs가 in-progress → implemented → completed 전이 수행"
```

**상태 전이 기록**: 이 M4 커밋은 `progress.md` §E.2/§E.3만 기록한다. `draft → in-progress` 전이는 M1에서 이미 수행되었고, `in-progress → implemented → completed`는 sync-phase에서 `manager-docs`가 단일 sync 커밋으로 수행한다(`spec-frontmatter-schema.md` § Status Transition Ownership Matrix). 따라서 M4는 **어떤 status도 변경하지 않는다**.

---

## §E.4 Sync-phase Audit-Ready Signal

```yaml
sync_status: audit-ready
sync_complete_at: 2026-09-07
sync_commit_sha: pending-backfill-commit-cannot-reference-own-sha
sync_branch: WT-design-token-docs-sync
b12_self_test_a: "grep -c 'SPEC-DESIGN-004' CHANGELOG.md → 0 (중복 없음, 신규 항목 추가 진행)"
b12_self_test_b: "AC 식별자 distinct 수 10 (acceptance.md SSOT) == CHANGELOG 기재 «AC-001~010 10개 전부 PASS» — 일치"
b12_self_test_c: "CHANGELOG가 지목한 경로 3개 전부 실재 확인 (.moai/design/tokens.json · src/app/globals.css · .moai/specs/SPEC-DESIGN-001/plan.md)"
changelog_entry_position: "[Unreleased] 최상단 — 자매 카드 SPEC-DESIGN-003 · -002 항목 바로 위"
docs_site_sweep: "none-found"                # docs/ · docs-site/ · website/ · mkdocs.yml · docusaurus.config.* · astro.config.* 전부 부재 — SPEC-DESIGN-002/-003 sync 결과와 동일함을 재측정으로 확인(가정 아님)
readme_updated: false                        # README.md §「공통 디자인 토큰 체계」에 동종 허위 주장이 있으나 AC-010 변경파일 3개 가드 밖 — 후속 카드로 권고(CHANGELOG 기재)
frontmatter_status_transitions:
  spec_md: "in-progress → completed"         # updated: 2026-09-07
  plan_md: "draft (무변경)"                   # 이 SPEC의 plan.md/acceptance.md는 status 필드를 lifecycle 전이 대상으로 쓰지 않음
  acceptance_md: "(status 필드 없음)"
canary_compliance_check:
  applicable: false                          # 이 SPEC은 자기 자신이 sync에서 검증할 전방 정책을 정의하지 않는다
pr_policy: "PR 필수 — 브랜치 보호(enforce_admins:true + required_status_checks) 적용. sync 커밋 이후 manager-git이 push + PR 생성."
blocker: null
next_action: "manager-git이 이 브랜치를 push하고 PR 생성 → sync-auditor 독립 감사"
```

**상태 전이 기록**: 이 sync 커밋이 `spec.md` frontmatter의 `in-progress → implemented → completed` 전이를 단일 커밋으로 수행한다(`spec-frontmatter-schema.md` § Status Transition Ownership Matrix — `completed` 전이는 별도 Mx 커밋이 아니라 sync 커밋에 병합된다). 본문(§1~§5)은 한 글자도 수정하지 않았다.

**범위 준수 기록**: `.moai/specs/SPEC-DESIGN-001/`은 이 sync-phase에서 한 건도 건드리지 않았다 — 그 SPEC의 §D.1 표기는 run-phase M3에서 완료되었고 `status: completed`는 그대로 유지된다. `tokens.json` · `globals.css` · `.tsx` 파일도 무변경이다.

**미검증으로 남는 것 (Gaps)**: (a) `sync_commit_sha`는 이 커밋 자신의 해시라 커밋 시점에 알 수 없어 자리표시자를 남겼고 후속 커밋에서 backfill한다. (b) 이 sync-phase는 lint·typecheck·test를 재실행하지 않았다 — §E.2가 M3 트리(`eef14af`)에서 실측한 결과를 근거로 삼으며, 이 sync 커밋은 `CHANGELOG.md`와 SPEC 산출물만 건드리므로 코드 경로에 영향이 없다. (c) sync-auditor 독립 감사는 아직 수행되지 않았다.
