---
id: SPEC-DESIGN-004
status: draft
updated: 2026-09-07
tier: M
---

# Implementation Plan: SPEC-DESIGN-004

> 이 문서는 **되돌리기 어려운 결정 순서**로 배치했다. §A~§C가 검토 가치가 가장 큰 판단이고, §G 이후는 기계적 반영이다.
>
> **`git diff` 기준점**: 이 문서와 `acceptance.md`의 모든 `git diff`는 plan-phase baseline `cfbd320`(전체 SHA `cfbd320d1b1cb2f2c1400b088262539c75a77879` — 이 워크트리의 분기점 `origin/main`)에 명시적으로 고정한다. 기준점 없는 맨 `git diff`는 마일스톤 커밋 이후 빈 출력이 되어 위양성 판정을 낸다.

---

## §A. Tier 판정 — **M** (수치 신호를 판단으로 상향)

### A.1 측정된 신호

| 신호 | 측정값 | Tier S 기준 | Tier M 기준 | 가리키는 Tier |
|---|---|---|---|---|
| 변경 파일 수 | **3개** | < 5 | 5–15 | **S** |
| 변경 LOC (추정) | **약 60행** (tokens.json 값 29 + 메타 서술 ~10 · globals.css 주석 ~15 · DESIGN-001 표기 ~6) | < 300 | 300–1000 | **S** |

**두 수치 신호가 모두 S를 가리킨다.** SPEC-DESIGN-003과 달리 신호 간 충돌이 아니다 — 정직하게 기록한다.

### A.2 그럼에도 Tier M으로 판정한다 — 근거 셋

수치 임계값은 «guidance, not enforcement»이며 «the implementer's judgment supplements the question»이다(`spec-workflow.md` § SPEC Complexity Tier). 판단 근거:

1. **AC 구조가 Tier S의 인라인 형식에 담기지 않는다.** 검증 대상이 39개 토큰 대조 + 서술 필드 보존/교정 판정 + 3건의 부정 grep 가드 + 교차 SPEC 표기 확인이다. AC를 이진 판정 가능하게 쓰면 10건이 되어 Tier S 상한(8)에 걸린다. 더 결정적으로 이 저장소의 자매 SPEC들은 `spec.md` §3을 **이미 다른 절에 배정하고 있다**. 절 배치는 하나로 통일되어 있지 않다 — SPEC-DESIGN-002는 §3이 «범위 제외»(`spec.md:106`)이고, SPEC-DESIGN-003은 §3이 «요구사항 (GEARS)»(`:162`)이며 «범위 제외»는 §4다(`:180`). 배치는 둘이지만 결과는 같다: **어느 쪽에서도 §3이 AC를 위해 비어 있지 않다.** 이 SPEC 자신도 §3이 범위 제외다. 따라서 Tier S가 요구하는 «AC는 spec.md §3 인라인» 형식은 저장소의 실제 절 배치와 충돌하며, 독립 `acceptance.md`가 필요하다.

2. **자매 카드 선례와의 정합.** SPEC-DESIGN-002는 **1파일 1행** 변경이면서 Tier M이었다. 3파일·2개 SPEC 디렉터리·소유권 경계 결정 1건·측정된 테스트 결합 3건을 가진 이 카드를 그보다 낮은 Tier로 분류하는 것은 저장소 안에서 일관되지 않는다. SPEC-DESIGN-003이 같은 근거(§A.1 근거 3)로 상향한 선례가 있다.

3. **plan-audit 임계가 낮아지면 안 되는 카드다.** 이 카드의 실질 위험은 분량이 아니라 **주석 산문이 테스트 정규식과 충돌**하는 형태(§D.1)이며, 이것은 감사자가 반드시 붙잡아야 할 종류의 결함이다. 임계를 0.75로 낮출 이유가 없다.

`tier: M` → 산출물 3종(`spec.md` · `plan.md` · `acceptance.md`) + `progress.md`, plan-auditor PASS 임계 **0.80**, REQ 상한 16 / AC 상한 16(실제: REQ **10**건 · AC **10**건).

---

## §B. [핵심 결정] Part 3의 소유권 경계 — **manager-spec 전용 마일스톤(M3)** 으로 분리한다

이 카드는 **자기 자신이 아닌 다른 SPEC의 `plan.md` 본문**을 수정한다(SPEC-DESIGN-001 §D.1). 누가 그 쓰기를 수행하는가는 run-phase가 발견할 문제가 아니라 plan-phase가 결정할 문제다. 결정과 근거를 여기서 확정한다.

### B.1 규칙이 무엇을 금지하는가 — 원문 확인

`.claude/rules/moai/development/spec-frontmatter-schema.md` § Forbidden ownership crossings:

> `manager-develop` MUST NOT modify `spec.md` / `plan.md` / `acceptance.md` **body content** (frontmatter `status:` + `updated:` updates on the `draft → in-progress` transition are allowed; **ALL other body modifications are forbidden**).

두 가지를 확인해야 한다.

**(a) 이 금지는 «자기 SPEC»으로 한정되지 않는다.** 규칙은 파일명 세 개(`spec.md` / `plan.md` / `acceptance.md`)를 지목할 뿐 소유 SPEC을 한정하는 수식어가 없다. 오히려 같은 문서의 § Non-transition frontmatter corrections가 «`manager-docs`와 `manager-develop`은 둘 다 `status:` + `updated:`로 제한되므로 **어느 쪽도 이 수정을 수행할 수 없다**»라고 못 박으며 «어느 한쪽의 제한을 넓히는 것은 예외를 허용하지 않는 데에 가치의 전부가 있는 경계를 흐리는 일»이라고 덧붙인다. 다른 SPEC이라는 이유로 완화되지 않는다.

**(b) 금지의 대상은 «집필 행위»가 아니라 «그 파일에 대한 쓰기»다.** PostToolUse 훅 `status-transition-ownership.sh`는 `.moai/specs/SPEC-*/{spec,plan,acceptance}.md` 본문에 대한 **Write/Edit 호출**을 관측해 `.moai/logs/status-transition-audit.log`에 기록한다. 훅은 그 문자열을 누가 지었는지 알지 못한다.

### B.2 대안 (a)의 기각 — «미리 승인된 텍스트를 복사하는 것은 집필이 아니다»

이 논리는 매력적이지만 규칙의 문면이 지지하지 않는다. 규칙이 명명하는 것은 **파일 표면**이지 지적 행위가 아니며, 훅이 관측하는 것도 파일 표면이다. manager-develop이 텍스트의 출처와 무관하게 `SPEC-DESIGN-001/plan.md`에 `Edit`을 호출하는 순간 경계를 넘는다. «복사는 집필이 아니다»는 규칙 문면이 아니라 규칙의 *의도*에 대한 해석이며, 예외를 허용하지 않는 데 가치가 있는 경계에 첫 예외를 뚫는 형태다.

### B.3 채택: 대안 (b) + (a)의 이점을 부록으로 흡수

**M3을 `manager-spec` 소유 마일스톤으로 분리한다.** 동시에 삽입할 **정확한 텍스트를 plan-phase 산출물로 확정한다**(§I 부록). 이렇게 하면 (a)가 노렸던 이점 — 삽입될 문구를 plan-auditor가 plan-phase에 검토할 수 있고 run-phase 재량이 0이 되는 것 — 을 경계를 넘지 않고 그대로 얻는다. run-phase의 manager-spec 위임은 «§I 부록의 텍스트를 204행 직후에 삽입하라»는 기계적 지시가 된다.

### B.4 D-NEW-1의 *발단*은 취하지 않되 그 *형태*를 취한다 — 사전 승인이 plan-phase에 이미 충족된다

`manager-spec.md` § Mid-run authority가 정의하는 D-NEW-1은, **`manager-spec`이 run-phase에 `spec.md`/`plan.md`/`acceptance.md` 본문을 편집할 수 있는 유일하게 선언된 경로**다(그 에이전트의 다른 본문 권한은 plan-phase 저작뿐이다). 따라서 «M3은 D-NEW-1이 아니다»라고 단순히 부인해 버리면 M3의 쓰기를 뒷받침하는 선언된 경로가 하나도 남지 않는다. 부인이 아니라 **구분**이 필요하다.

**발단은 다르다.** D-NEW-1의 전형은 «run-phase 중 발견된 AC 부적합»이다. M3은 그 발단을 공유하지 않는다 — plan-phase에 미리 계획된 마일스톤이며 run-phase가 발견한 것이 아니다.

**그러나 그 절이 요구하는 세 조건은 그대로 충족된다.** 특히 승인 조건은 두 갈래를 허용한다:

> - ONLY upon explicit orchestrator re-delegation (never as a side-effect of another agent's turn)
> - The orchestrator MUST surface the AC inadequacy to the user … before re-delegating, **OR the user MUST have pre-approved the inline-fix pattern in the run-phase delegation prompt**
> - The mid-run edit is committed in a separate commit attributed to this agent

| D-NEW-1 조건 | M3의 충족 방식 |
|---|---|
| 명시적 오케스트레이터 재위임 | M3은 §G 마일스톤 표가 `manager-spec` 소유로 지정한 **별도 위임**이다. 다른 에이전트 턴의 부수 효과가 아니다. |
| 사용자 사전 승인 (두 번째 갈래) | 삽입될 **정확한 텍스트가 §I에 축자로 고정**되어 있다. plan-audit이 그 문구를 검토하고 Implementation Kickoff Approval이 run-phase 착수 **전에** 승인한다. 즉 «run-phase 위임 프롬프트에 사전 승인된» 상태가 mid-run이 아니라 plan-phase에 **미리** 성립한다. |
| 별도 커밋 귀속 | §B.5가 M3을 별도 커밋으로 분리한다. |

**결론: M3은 D-NEW-1의 *형태*를 취하되 그 *발단*(mid-run 발견)을 취하지 않는다.** 승인 요건을 시점만 앞당겨 충족시키는 것이므로 mid-run 경로보다 **약한** 권한이 아니다 — 오히려 검토 기회가 한 단계 이르고, run-phase 재량이 0이라는 점에서 더 좁다.

### B.5 커밋 귀속

M3은 별도 커밋으로 분리한다. manager-develop 커밋(M1·M2)과 manager-spec 커밋(M3)이 한 커밋에 섞이면 `OwnershipTransitionRule`의 커밋 주체 추적이 흐려진다.

### B.6 상태 전이는 발생하지 않는다 — 재확인

M3은 SPEC-DESIGN-001의 `status`를 바꾸지 않는다(`completed` 유지). 따라서 Status Transition Ownership Matrix의 **어떤 행도 발화하지 않는다** — `completed → in-progress (amendment)` 행을 포함해 어느 행도 해당하지 않으므로 개정 절차(`amendment_of:` · HISTORY `## Amendments` · plan-audit 캐시 무효화)는 요구되지 않는다.

**소유자 지정의 근거는 §B.1의 § Forbidden ownership crossings이지 § Non-transition frontmatter corrections가 아니다.** 후자를 근거로 삼는 것은 오류다 — 그 절은 **frontmatter 필드 하나의 오기 수정**만을 다루며, 그 범위 문장이 다음과 같이 본문 수정을 명시적으로 **배제**한다:

> Scope: the correction touches the mis-authored field and `updated:`. **Body content**, HISTORY, and every other frontmatter field **stay untouched**.

M3은 §D.1 **본문 삽입**이므로 그 절의 대상이 아니다. 인용하면 자기 논박이 된다.

실제 근거는 § Forbidden ownership crossings다. 그 절은 `manager-develop`의 본문 수정을 금지하면서 그 구제책으로 «the orchestrator re-delegates to **manager-spec** for the scope-doc update»를 명시한다 — 소유자를 manager-spec으로 지정하는 것은 이 문장이다. 그 위임이 run-phase에 행사될 수 있는 권한 근거는 §B.4가 확인한 D-NEW-1 형태(사전 승인이 plan-phase에 충족됨)다.

### B.7 명시적 Gap — 규칙 집합은 이 정확한 경우를 다루지 않는다

정직하게 기록한다. **«완료된 자매 SPEC의 본문에 표기만 삽입하는 행위»를 직접 허가하는 규칙 문장은 존재하지 않는다.**

- § Forbidden ownership crossings는 `manager-develop`을 **배제**하고 재위임 대상으로 `manager-spec`을 지목하지만, 자매 SPEC 본문 쓰기를 **적극적으로 허가**하는 문장은 아니다.
- § Non-transition frontmatter corrections는 범위 문장이 본문을 배제하므로 근거가 될 수 없다(§B.6).
- `manager-spec.md` § Artifacts owned는 `.moai/specs/SPEC-{ID}/plan.md`를 지목하지만, `{ID}`가 **자기 SPEC**인지 임의 SPEC인지 문면이 한정하지 않는다. 문맥상 자기 SPEC의 plan-phase 저작을 뜻한다고 읽는 것이 자연스럽다.
- D-NEW-1은 발단이 다르되 세 조건이 전부 충족된다(§B.4). 이것이 이 카드가 딛고 서는 가장 가까운 선언된 근거다.

**침묵은 허가가 아니다.** 그래서 이 카드는 그 침묵을 **보수적으로 항행**한다. 다음 다섯 가지가 그 보수성의 구체적 내용이며, 각각 AC가 기계적으로 감시한다:

| 보수 조치 | 감시하는 AC |
|---|---|
| **순수 삽입** — 삭제·수정된 행 0건 | AC-009 (b) |
| **frontmatter 무변경** — `status` · `version` · `amendment_of` 전부 | AC-009 (c)(d)(e) |
| **표제 행 무변경** — §D.1 앵커 보존 | AC-008 (c) |
| **텍스트의 plan-phase 축자 확정** — run-phase 재량 0, 문구 검토는 plan-audit에서 | §I 부록 |
| **커밋 분리** — `OwnershipTransitionRule`의 주체 추적 보존 | §B.5 |

이 다섯이 충족되는 한 M3은 규칙이 방지하려는 어떤 해악 — 경계 침식 · 소유권 추적 상실 · 완료 SPEC의 무단 개정 — 도 일으키지 않는다. 규칙 문면이 이 경우를 명시적으로 다루도록 확장할지는 **이 카드의 범위가 아니며** 하니스 쪽 별도 카드의 몫이다.

---

## §C. 재작성 원칙 — 두 개의 서술 결정

### C.1 `tokens.json`의 폰트 토큰: 출시 리터럴을 기록하고 렌더 결과를 주석으로 남긴다

`globals.css`의 폰트 토큰은 t51 카드가 `next/font` 변수 참조로 전환했다:

```
--font-heading: var(--font-heading-nf), system-ui, sans-serif;
--font-body:    var(--font-body-nf),    system-ui, sans-serif;
```

`tokens.json`이 무엇을 기록해야 하는가에는 두 독법이 있다:

| 독법 | 기록할 값 | 논거 | 약점 |
|---|---|---|---|
| «출시 상태 재동기화» | `var(--font-heading-nf), system-ui, sans-serif` | 이 카드의 지시는 «`@theme`과 일치시켜라»이며 REQ-DESIGN4-001이 문자 단위 일치를 요구한다 | 이 파일만 읽는 사람은 어떤 서체가 렌더되는지 알 수 없다 |
| «디자인 체계 서술» | `"Cormorant Garamond", system-ui, sans-serif` | `tokens.json`은 디자인 산출물이므로 조달 방식이 아니라 디자인 의도를 담아야 한다 | `@theme`과 불일치가 남아 이 카드의 목적을 훼손한다 |

**결정: 출시 리터럴을 `tokens` 객체에 기록하고, 렌더되는 서체 계열을 `notes[]`에 별도 항목으로 남긴다.** 두 독법이 요구하는 정보를 모두 보존하면서 «`tokens` 객체는 `@theme`의 거울»이라는 단일 규칙을 지킨다. t51 주석이 «RENDERED font family is UNCHANGED (still Cormorant Garamond / Lora); only the value-sourcing mechanism changes»라고 기록한 사실이 이 note의 근거다.

### C.2 헤더 주석: «단일 SSOT 지목»이 아니라 «계층 서술 + 최종 권위 명시»

현행 주석의 구조적 결함은 값이 낡았다는 것이 아니라 **`plan.md`를 SSOT로 지목하는 방향 자체**다. 그 구조를 유지한 채 지목 대상만 SPEC-BRAND-001로 바꾸면 같은 결함이 재생산된다 — BRAND-001의 리터럴도 이미 DESIGN-002에 의해 한 곳이 이탈했기 때문이다.

**결정: 재작성된 주석은 (1) 계보를 계층으로 서술하고, (2) 값의 최종 권위가 `@theme` 블록 자신임을 명시하고, (3) «재동기화 원천»이라는 지시 자체를 제거한다.** 어떤 문서도 이 블록의 상위 원본이 아니다.

§2.3이 **참**으로 판정한 문단은 그대로 살린다(REQ-DESIGN4-005). 재작성은 선별 교정이다.

---

## §D. 알려진 이슈

### D.1 헤더 주석 산문이 세 개의 테스트 정규식과 같은 입력을 공유한다 — 이 카드의 유일한 실질 위험

`spec.md` §2.4가 전수 측정했다. 요약:

| 테스트 | 검사 | 주석에 걸리는 제약 |
|---|---|---|
| `shell.test.tsx:55` | `css.trimStart()` 가 `/^@import "tailwindcss";/` 에 매치 | 주석이 1행 `@import` 위로 올라가면 안 된다 |
| `design-tokens-grayscale.test.ts:53` | 파일 전역 `/accent-2-/g` 매치가 0건 | 주석에 `accent-2-` 부분문자열 금지 |
| `typography-cascade.test.tsx:37` | 파일 전역 첫 `/\bbody\s*\{[^}]*\}/` 매치가 실제 `body` 규칙 | 주석에 `body {` 문자열 금지 |
| *(테스트가 아닌 추출 앵커)* `acceptance.md` §서두 · AC-004 · AC-006 | `awk '/^@theme/{exit}'` 로 헤더 주석을 분할 | 주석의 어떤 행도 **0열에서 `@theme`으로 시작 금지** |

네 제약 모두 **주석을 쓰는 손에 걸리는 문자열 제약**이며, 값과 무관하다. AC-005·AC-006·AC-007이 개별 이진 검사로 감시한다.

**네 번째 제약이 비자명한 이유**: AC-005는 `@theme`이라는 문자열이 주석 안에 **살아 있을 것**을 요구한다(18-22행 Tailwind 네임스페이스 규약 서술). 동시에 AC-004·AC-006은 `^@theme`을 헤더/본문 경계 앵커로 쓴다. `/* … */` 블록 안에서 연속 행이 0열에서 시작하는 것은 합법이므로, 예컨대 주석을 줄바꿈하다 `@theme` 이 행 머리에 오면 추출이 조기 종료해 **잘못된 구간**을 대상으로 삼는다. 요구와 앵커가 같은 토큰을 공유하는 지점이다. 다행히 조용히 통과하지 않는다 — AC-006의 98행 어서션과 바이트 `diff`가 소리 내어 실패하고 AC-007 (c)의 `grep -n "^@theme"` 가 2건을 반환한다. 그래도 **쓰는 시점에 알고 있어야** 진단 비용을 치르지 않는다(REQ-DESIGN4-007 (d)).

**함정의 형태**: 세 검사 모두 «어떤 값이 맞는가»가 아니라 «파일 텍스트 전체에 이 패턴이 있는가»를 본다. 주석은 검사 대상이 아닐 것이라는 직관이 정확히 틀린 지점이다. 특히 `accent-2-`는 accent 램프를 설명하려는 자연스러운 문장(«`--color-accent-2-*` 램프는 존재하지 않는다»)에서 실수로 들어가기 쉽다.

### D.2 `tokens.json`의 `neutral-600`은 BRAND-001 리터럴이 아니다

재동기화 대상 값은 `#6b6b6b`(SPEC-DESIGN-002 교정값)이지 `#7a7a7a`(SPEC-BRAND-001 원 리터럴)가 아니다. «SPEC-BRAND-001에서 가져오면 된다»고 생각하고 그 SPEC의 문서를 원천으로 삼으면 **한 개 값이 틀린다.**

이것이 REQ-DESIGN4-001이 «유일한 원천은 `@theme` 블록»이라고 못 박은 이유다. 어떤 SPEC 문서도 원천이 아니다.

### D.3 SPEC-DESIGN-001 `plan.md`의 frontmatter가 `spec.md`와 어긋나 있다 — 건드리지 않는다

```
spec.md  frontmatter: status: completed
plan.md  frontmatter: status: in-progress
```

`spec.md` §2.7이 기록한 관측이다. **이 카드에서 고치지 않는다.** M3은 §D.1 본문에 표기를 추가할 뿐 frontmatter를 건드리지 않는다(REQ-DESIGN4-009, AC-009). run-phase가 «마침 열었으니 고치자»는 판단을 하지 않도록 여기에 명시적으로 못 박는다.

### D.4 `moai spec drift`의 기존 저장소 전역 상태

SPEC-DESIGN-003 `progress.md` §E.1이 기록한 대로, `moai spec drift`는 이 카드 이전부터 25개 SPEC에 DRIFT 행을 낸다(frontmatter 파서가 본문 표의 «비고» 셀을 읽는 형태). 이 카드가 만든 것이 아니며 이 카드의 범위도 아니다. AC 판정은 **SPEC-DESIGN-004 행**만 본다.

### D.5 병렬 세션 경합

이 워크트리(`.claude/worktrees/t72`)는 `WT-design-token-docs-sync` 브랜치를 점유한다. `src/app/globals.css`는 최근 세 카드가 연속으로 건드린 파일이므로, run-phase 착수 전 §E 사전 확인 1·2번으로 baseline 일치를 재확인한다.

---

## §E. 사전 확인 (run-phase 착수 전 실행)

착수 직전에 실행하고 출력을 `progress.md` §E.2에 축자 기록한다. plan-phase 측정치와 불일치하면 **진행하지 않고 blocker 보고**한다.

```bash
# 1. baseline 고정 확인
git rev-parse HEAD                       # 기대: cfbd320d1b1cb2f2c1400b088262539c75a77879
git rev-parse origin/main                # 기대: 동일

# 2. 세 대상 파일이 baseline 이후 무변경인지
git diff --name-only cfbd320 -- .moai/design/tokens.json src/app/globals.css .moai/specs/SPEC-DESIGN-001/plan.md
# 기대: 출력 없음

# 3. 테스트 결합 가드의 착수 전 상태 (M2 이후 재실행해 대조)
head -1 src/app/globals.css              # 기대: @import "tailwindcss";
grep -c "accent-2-" src/app/globals.css  # 기대: 0
grep -n "body\s*{" src/app/globals.css   # 기대: 114행 1건만

# 4. tokens.json 불일치 총량 재측정 (spec.md §2.1의 29건이 여전한지)
grep -n "color-bg\|color-surface\|color-text\|color-accent:\|color-divider" src/app/globals.css

# 5. SPEC-DESIGN-001 §D.1 표제 행 번호 재확인 (M3 삽입 지점)
grep -n "^### §D.1" .moai/specs/SPEC-DESIGN-001/plan.md
# 기대: 204(§D.1) · 239(§D.1b)

# 6. 기존 테스트 baseline
npm test 2>&1 | tail -5
```

---

## §F. 제약 (위반 금지)

**PRESERVE — 절대 건드리지 않는다**

- `src/app/globals.css`의 `@theme` 블록(45-81행) 내부: 토큰 값 39개 전부, 53-58행 SPEC-DESIGN-002 주석, 64-72행 t51 주석
- `src/app/globals.css`의 `.plate` 규칙(83-90행) · `body` 규칙(92-128행) · 제목 규칙(130-142행)
- `src/app/globals.css` 1행 `@import "tailwindcss";`
- `.tsx` 파일 전부 (`src/**`)
- `tests/**` · `e2e/**` 전부
- `.moai/specs/SPEC-DESIGN-001/` 의 `spec.md` · `acceptance.md` · `progress.md` 전부
- `.moai/specs/SPEC-DESIGN-001/plan.md` 의 frontmatter · HISTORY · §D.1 기존 값 코드블록(207-231행) · §D.1 주의 3항목(233-237행) · §D.1b 이후 전 구간
- `.moai/design/components.json` · `.moai/design/brief/**`
- `.moai/specs/SPEC-DESIGN-002/` · `SPEC-DESIGN-003/` · `SPEC-BRAND-001/` 전부
- `CHANGELOG.md` (sync-phase의 몫)

**금지 명령**

- `--no-verify` · `--amend` · `main`으로의 force-push
- `git add -A` · `git add .` · `git commit -a` — 명시적 pathspec으로만 스테이징
- 기준점 없는 맨 `git diff` — 전부 `cfbd320`에 고정

**소유권 경계**

- manager-develop은 `.moai/specs/**/{spec,plan,acceptance}.md` 를 **어느 SPEC의 것이든** 수정하지 않는다(§B). 이 SPEC 자신의 `spec.md` frontmatter `draft → in-progress` 전이만 허용된다.
- M3의 쓰기는 manager-spec이 수행한다.

**사용자 상호작용**

- 서브에이전트는 `AskUserQuestion`을 호출하지 않는다. 막히면 구조화된 blocker 보고를 반환한다.

---

## §G. 마일스톤

| M | 소유 에이전트 | 내용 | 대응 AC |
|---|---|---|---|
| **M1** | manager-develop | `.moai/design/tokens.json` 재동기화 (값 29 + 서술 필드) | AC-001 · AC-002 · AC-003 |
| **M2** | manager-develop | `src/app/globals.css` 헤더 주석(3-44행) 재작성 | AC-004 · AC-005 · AC-006 · AC-007 |
| **M3** | **manager-spec** | `SPEC-DESIGN-001/plan.md` §D.1 초과 표기 삽입 (§I 부록 텍스트 축자) | AC-008 · AC-009 |
| **M4** | manager-develop | 검증 증적 기록 (`progress.md` §E.2/§E.3) | AC-010 |

### M1 — `tokens.json` 재동기화

1. `spec.md` §2.1 표의 «`globals.css` (현재)» 열을 `tokens` 객체에 반영. 간격 6개·반경 3개·`font-heading-weight`는 이미 일치하므로 손대지 않는다.
2. 서술 필드 교정 (§C.1 결정 반영):
   - `$schema_note` — 현재 계보 서술로 교체
   - `source.design_system` — `"Classical"` → OUR 그레이스케일
   - `source.ssot_document` / `ssot_section` → `src/app/globals.css` `@theme` 블록을 최종 권위로 지목
   - `source.acquisition_method` / `value_provenance` → 실제 출처(SPEC-BRAND-001 + DESIGN-002 보정 + t51 폰트 전환)로 교체
   - `notes[0]` (따뜻한 회색 서술) → 그레이스케일 서술로 교체
   - `notes[1]` (단일 mono accent) · `notes[2]` (1.15배 간격) → **보존** (REQ-DESIGN4-003)
   - 폰트 렌더 계열 note **추가** (§C.1)
   - `live_reverification` → 관측 시점 갱신, DesignSync 부재 사실 보존
   - `replacement_map_pointer` → SPEC-DESIGN-001 §D.1b 지목이 낡았으므로 계보 서술로 교체
3. **JSON 유효성 확인**: `node -e 'JSON.parse(require("fs").readFileSync(".moai/design/tokens.json","utf8"))'`

**게이트**: M1 커밋 전 AC-001을 실행해 39개 대조가 전부 통과하는지 확인한다.

### M2 — `globals.css` 헤더 주석 재작성

1. **3-44행만** 교체한다. 1행 `@import`과 45행 이후는 손대지 않는다.
2. §C.2 원칙: 계층 서술 + `@theme` 자신이 최종 권위 + «재동기화 원천» 지시 제거.
3. §2.3 보존 대상(13-15 · 18-22 · 31-34 · 35-43행 취지)을 살린다.
4. **작성 직후 §D.1 네 제약을 즉시 검사**한다 — 커밋 전에:
   ```bash
   head -1 src/app/globals.css               # 기대: @import "tailwindcss";
   grep -c "accent-2-" src/app/globals.css   # 기대: 0
   grep -n "body\s*{" src/app/globals.css    # 기대: 1건
   grep -c "^@theme" src/app/globals.css     # 기대: 1 — 2 이상이면 주석 행이 0열 @theme
   ```
5. **게이트**: 위 넷 통과 + `npm test -- tests/unit/app/` 통과 후에만 커밋한다.

### M3 — SPEC-DESIGN-001 §D.1 초과 표기 (**manager-spec 위임**)

1. §I 부록의 텍스트를 **축자로** 삽입한다. 삽입 지점: `### §D.1 Classical 토큰 블록 — 확정 값 (원문 인용, SSOT)` 표제 행 **직후**, 기존 본문 문단 **앞**.
2. 표제 행 자체는 변경하지 않는다 — 다른 문서(`globals.css` 옛 주석 · `tokens.json` · SPEC-DESIGN-002 §3)가 «§D.1»이라는 앵커로 이 절을 참조하므로 표제를 바꾸면 그 참조들이 끊긴다.
3. frontmatter · HISTORY · 기존 값 블록 · 주의 3항목 · §D.1b 이후는 무변경.
4. 별도 커밋: `docs(SPEC-DESIGN-004): M3 — SPEC-DESIGN-001 §D.1 초과 표기 삽입`

### M4 — 검증 증적

`acceptance.md` AC-001~AC-010을 전부 실행하고 **축자 출력**을 `progress.md` §E.2에 기록한다. 요약이나 «통과함» 서술은 증적이 아니다.

---

## §H. 안티패턴 (이 카드에서 특히 하기 쉬운 실수)

1. **SPEC-BRAND-001 문서에서 값을 가져오기.** `neutral-600`이 틀린다(§D.2). 원천은 `globals.css` `@theme`뿐이다.
2. **주석에 `accent-2-`를 쓰기.** accent 램프를 설명하려다 실수하기 쉽다(§D.1). `--color-accent-2`(하이픈 없이 끝) 또는 `--color-accent`의 `-2` 변형으로 쓴다.
3. **주석에 `body {` 를 쓰기.** «`body` 규칙은 아래에 있다»를 설명하려다 들어가기 쉽다(§D.1).
4. **헤더 주석을 전면 폐기하기.** §2.3이 참으로 판정한 4개 문단은 지금도 유효한 메커니즘 서술이다. 지우면 `--space-*` 네임스페이스 회피 같은 비자명한 결정의 근거가 사라진다.
5. **manager-develop이 `SPEC-DESIGN-001/plan.md`를 수정하기.** §B가 금지한다. M3은 manager-spec의 몫이다.
6. **SPEC-DESIGN-001의 frontmatter 불일치를 «마침 열었으니» 고치기.** §D.3이 금지한다.
7. **`tokens.json`의 `notes[1]`·`notes[2]`를 «낡았을 것»이라 추정해 지우기.** §2.2가 둘 다 **여전히 참**임을 측정으로 확정했다.
8. **간격·반경 토큰을 «어차피 재동기화하니까» 다시 쓰기.** 9개는 이미 일치한다. 다시 쓰면 diff가 불필요하게 커져 «29개 값만 바꿨다»는 이 카드의 서술과 실제 diff가 어긋난다. 범위 가드 AC-010은 **파일 단위**(변경 파일 정확히 3개)로만 걸리고 `tokens.json`에 대한 행 단위 최소성 AC는 두지 않았으므로, 행 단위 최소성은 이 안티패턴이 대신 지킨다.

---

## §I. 부록 — M3이 삽입할 정확한 텍스트 (축자)

> 이 블록은 **plan-phase 산출물**이다. run-phase의 manager-spec은 아래 텍스트를 그대로 삽입할 뿐 문구를 재작성하지 않는다. 문구에 대한 검토는 plan-audit에서 이루어진다.

삽입 지점: `.moai/specs/SPEC-DESIGN-001/plan.md` 의 `### §D.1 Classical 토큰 블록 — 확정 값 (원문 인용, SSOT)` 표제 행 직후(현재 204행 다음), 빈 줄 하나를 두고.

```markdown
> **[초과 — SUPERSEDED] 이 절의 값은 더 이상 출시 상태가 아니다.** (표기 추가: 2026-09-07, SPEC-DESIGN-004 / 카드 t72)
>
> 아래 Classical 토큰 블록은 SPEC-DESIGN-001 시점(`e8c4ef3`)의 확정 값이며 **그 시점의 역사적 기록으로 보존**된다. 이후 두 차례 갱신으로 현재 출시 값과 달라졌다:
>
> - `b1c2862` (SPEC-BRAND-001) — OUR 그레이스케일 팔레트로 전면 교체. 색 24개와 그림자 3개 전부.
> - `5b2881e` (SPEC-DESIGN-002) — `--color-neutral-600`을 `#6b6b6b`로 교정 (WCAG AA).
> - 그 밖에 카드 t51이 폰트 토큰 2개를 `next/font` 변수 참조로 전환했다 (렌더 서체는 불변).
>
> **현재 값의 최종 권위는 `src/app/globals.css`의 `@theme` 블록 자신이다.** 어떤 `plan.md`도 그 블록의 상위 원본이 아니다 — 계보가 여러 SPEC에 걸쳐 있기 때문이다. 값을 확인하거나 재동기화할 때는 그 파일을 직접 읽어야 하며, 이 절을 원천으로 삼아서는 안 된다.
>
> 이 표기는 **표기일 뿐 개정이 아니다.** SPEC-DESIGN-001의 `status`는 `completed`로 유지되며, 아래 값 블록과 주의 3항목은 원문 그대로 보존된다. 본문 전반의 재조정 여부는 별도 카드(t70)가 판단한다.
```

**이 텍스트가 §D.1 세 제약과 무관함을 확인**: 이 블록은 `globals.css`가 아니라 `plan.md`에 들어가므로 `accent-2-` · `body {` · `@import` 제약의 대상이 아니다. (그럼에도 위 텍스트에는 세 문자열 중 어느 것도 들어 있지 않다.)

---

## §J. 교차 참조

- `.claude/rules/moai/development/spec-frontmatter-schema.md` § Forbidden ownership crossings — §B의 **소유자 지정 근거**(§B.1 · §B.6)
- `.claude/rules/moai/development/spec-frontmatter-schema.md` § Status Transition Ownership Matrix — 어떤 행도 발화하지 않음을 확인하는 근거(§B.6)
- `.claude/rules/moai/development/spec-frontmatter-schema.md` § Non-transition frontmatter corrections — **근거가 아니라 배제 확인용**. 그 절의 범위 문장이 본문 수정을 제외하므로 M3의 근거로 인용해서는 안 된다(§B.6 · §B.7)
- `.claude/agents/moai/manager-spec.md` § Mid-run authority — D-NEW-1의 세 조건과 그 사전 승인 갈래(§B.4)
- `.claude/rules/moai/workflow/spec-workflow.md` § SPEC Complexity Tier — §A의 근거
- `.moai/specs/SPEC-DESIGN-002/spec.md` §3 — 이 카드를 예약한 두 개의 전방 포인터
- `.moai/specs/SPEC-DESIGN-003/progress.md` §E.4 — 미해소 후속 카드 3건 기록
- `.moai/specs/SPEC-DESIGN-001/plan.md` §D.1 — M3의 대상
- `src/app/globals.css` `@theme` (45-81행) — 이 카드가 인정하는 유일한 값 원천
