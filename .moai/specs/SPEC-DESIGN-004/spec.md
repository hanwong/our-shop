---
id: SPEC-DESIGN-004
title: "디자인 토큰 문서 드리프트 정리 — tokens.json 재동기화 · globals.css 헤더 주석 재작성 · SPEC-DESIGN-001 §D.1 초과 표기"
version: "0.1.0"
status: draft
created: 2026-09-07
updated: 2026-09-07
author: snake
priority: P2
phase: "v0.4.0 target"
module: ".moai/design, src/app/globals.css, .moai/specs/SPEC-DESIGN-001"
lifecycle: spec-anchored
tags: "design-tokens, documentation, drift, ssot, brand, cleanup"
tier: M
depends_on: [SPEC-BRAND-001, SPEC-DESIGN-002, SPEC-DESIGN-003]
related_specs: [SPEC-DESIGN-001]
---

## HISTORY

### v0.1.0 (2026-09-07)

- 최초 작성. 카드 t72. 워크트리 `.claude/worktrees/t72` · 브랜치 `WT-design-token-docs-sync` · 분기점 `origin/main` = `cfbd320`.
- **이 SPEC은 SPEC-DESIGN-002가 명시적으로 예약한 두 개의 후속 카드를 한 장으로 묶은 것이다.** SPEC-DESIGN-002 `spec.md` §3의 `### Out of Scope — .moai/design/tokens.json 갱신`과 `### Out of Scope — globals.css 상단 주석(4-11행)의 전면 교정`이 각각 전방 포인터를 남겼고, 후자는 "위 `tokens.json` 항목과 **한 카드로 묶는 것이 자연스럽다**"라고 못 박았다. 이 SPEC이 그 권고를 그대로 이행한다.
- SPEC-DESIGN-003 `progress.md` §E.4의 «미해소로 남는 후속 카드 3건» 중 1번·2번이 이 SPEC이다. 3번(SPEC-BRAND-001 amendment 검토)은 **이 카드가 아니라 별도 카드(t70)** 이며, 사용자가 명시적으로 범위에서 제외했다.
- **범위 축소가 사용자 지시로 확정되었다** (§3). SPEC-DESIGN-001을 `completed → in-progress (amendment)` 전이시키는 완전한 개정은 하지 않는다. §D.1에 **표기(marker)만** 추가한다.
- plan-phase 조사에서 **선행 SPEC이 기록하지 않았던 사실 3건**을 새로 측정했다: (a) `globals.css` 헤더 주석의 허위 주장이 4-11행에 국한되지 않고 23-28행까지 걸쳐 있다(§2.3), (b) `globals.css` **원문 텍스트를 읽는 테스트가 3개** 존재하며 그중 2개는 헤더 주석 재작성이 깨뜨릴 수 있는 정규식 결합을 갖는다(§2.4), (c) `@theme` 블록 **내부** 72행에도 동일한 허위 주장이 남지만 사용자가 지정한 «헤더 주석» 범위 밖이다(§3).

---

## §1. 배경과 문제

### 1.1 세 개의 문서가 출시 상태와 어긋나 있다

`our-shop`의 디자인 토큰 SSOT는 실행 파일 `src/app/globals.css`의 `@theme` 블록이다. 이 블록의 값은 세 차례 갱신되었다:

| 커밋 | SPEC | 변경 내용 |
|---|---|---|
| `e8c4ef3` | SPEC-DESIGN-001 | Classical 팔레트(따뜻한 회색 + 금빛 accent)를 `@theme`으로 최초 전사 |
| `b1c2862` | SPEC-BRAND-001 | **OUR 그레이스케일 팔레트로 전면 교체** — 색 24개 전부, 그림자 3개 |
| `5b2881e` | SPEC-DESIGN-002 | `--color-neutral-600`을 `#7a7a7a` → `#6b6b6b`로 교정 (WCAG AA) |

세 개의 **문서 산출물**은 이 갱신을 따라오지 못했다:

1. `.moai/design/tokens.json` — `e8c4ef3` 시점의 Classical 팔레트를 그대로 담고 있다. 색 24개 **전부**가 현재 값과 다르다.
2. `src/app/globals.css` 헤더 주석(3-44행) — `@theme` 블록이 "SPEC-DESIGN-001 `plan.md` §D.1과 바이트 단위로 동일"하다고 주장한다. `b1c2862` 이후 거짓이다.
3. `.moai/specs/SPEC-DESIGN-001/plan.md` §D.1 — 스스로를 "확정 값 (원문 인용, **SSOT**)"이라고 선언한다. 그 값은 더 이상 출시 상태가 아니다.

세 문서 모두 **자신이 현재의 진실이라고 주장한다.** 어긋남이 조용한 것이 아니라 적극적으로 오도한다는 점이 이 카드의 동기다.

### 1.2 이 문제는 이미 두 번 발견되어 두 번 이연되었다

SPEC-DESIGN-002가 `tokens.json`과 헤더 주석의 어긋남을 **측정으로 확인**하고도 고치지 않은 것은 누락이 아니라 범위 규율이었다(그 SPEC은 단일 토큰 1행 교정 카드였다). SPEC-DESIGN-003 역시 `progress.md` §E.4에서 두 건을 «미해소»로 명시 기록했다. 두 SPEC이 남긴 전방 포인터가 이 카드다.

### 1.3 SSOT의 계보가 단일 SPEC이 아니다 — 이것이 재작성의 핵심 어려움

헤더 주석을 "SPEC-BRAND-001 §D.1이 SSOT"라고 단순 치환하면 **또 다른 거짓**이 된다. 현재 `@theme` 블록의 값은 세 겹이다:

- **기반**: SPEC-BRAND-001이 저작한 OUR 그레이스케일 팔레트 (색 24개 · 그림자 3개)
- **1차 보정**: SPEC-DESIGN-002가 `--color-neutral-600`을 `#6b6b6b`로 교정 (WCAG AA — BRAND-001의 리터럴 위임과 의도적으로 이탈)
- **2차 보정**: t51 CodeRabbit 후속 카드가 폰트 토큰 2개를 `next/font` 변수 참조로 전환 (렌더 결과 불변, 값 조달 방식만 변경)
- SPEC-DESIGN-003은 `@theme`을 **건드리지 않았다**(그 SPEC의 AC-004가 무변경을 확인). 계보에는 등장하지만 값의 기여자는 아니다.

따라서 재작성된 주석은 «단일 SSOT 문서»를 지목할 수 없고, **계층을 서술**해야 한다. 그리고 그 계층의 최종 권위는 어떤 `plan.md`도 아닌 **이 파일 자신**(`globals.css` `@theme` 블록)이다.

### 1.4 런타임 영향은 0이다 — 문서 전용 카드다

§2.5가 측정한 대로 `tokens.json`은 실행 코드에서 읽히지 않고, 헤더 주석은 CSS 주석이므로 렌더에 관여하지 않는다. 이 카드는 `.tsx` 파일을 한 건도 건드리지 않고 CSS 커스텀 프로퍼티 **값**을 한 글자도 바꾸지 않는다. 위험은 시각 회귀가 아니라 **테스트 결합**(§2.4)에 있다.

---

## §2. 측정 (전수 · 실제로 실행한 명령)

> 모든 측정은 이 워크트리 HEAD `cfbd320`(`= origin/main`)에서 실행했다.

### 2.1 `tokens.json` ↔ `globals.css` 토큰별 대조 (39개 전수)

`tokens.json`의 `tokens` 객체는 5개 그룹 총 **39개** 토큰을 담는다. 각각을 `globals.css` `@theme`의 현재 값과 대조했다.

**색상 — 24개 전부 불일치**

| 토큰 | `tokens.json` (현재) | `globals.css` (현재) |
|---|---|---|
| `bg` | `#f3f2f2` | `#f2f2f2` |
| `surface` | `#eae9e9` | `#e9e9e9` |
| `text` | `#201f1d` | `#1f1f1f` |
| `accent` | `#b68235` | `#2b2b2b` |
| `accent-2` | `#ac803e` | `#2b2b2b` |
| `divider` | `color-mix(in srgb, #201f1d 16%, transparent)` | `color-mix(in srgb, #1f1f1f 16%, transparent)` |
| `neutral-100` | `#f8f4f4` | `#f5f5f5` |
| `neutral-200` | `#eae7e7` | `#e8e8e8` |
| `neutral-300` | `#d7d3d3` | `#d4d4d4` |
| `neutral-400` | `#bab6b6` | `#b7b7b7` |
| `neutral-500` | `#9b9797` | `#989898` |
| `neutral-600` | `#7d7979` | `#6b6b6b` |
| `neutral-700` | `#605d5d` | `#5e5e5e` |
| `neutral-800` | `#444141` | `#424242` |
| `neutral-900` | `#2d2b2b` | `#2b2b2b` |
| `accent-100` | `#fff3e4` | `#f5f5f5` |
| `accent-200` | `#ffe3bf` | `#e8e8e8` |
| `accent-300` | `#facb8d` | `#d4d4d4` |
| `accent-400` | `#e1ad66` | `#989898` |
| `accent-500` | `#c28d41` | `#6b6b6b` |
| `accent-600` | `#a06f24` | `#4a4a4a` |
| `accent-700` | `#7d5411` | `#343434` |
| `accent-800` | `#5a3b0a` | `#262626` |
| `accent-900` | `#3a270d` | `#1a1a1a` |

**타이포그래피 — 3개 중 2개 불일치**

| 토큰 | `tokens.json` | `globals.css` |
|---|---|---|
| `font-heading` | `"Cormorant Garamond", system-ui, sans-serif` | `var(--font-heading-nf), system-ui, sans-serif` |
| `font-heading-weight` | `600` | `600` — **일치** |
| `font-body` | `"Lora", system-ui, sans-serif` | `var(--font-body-nf), system-ui, sans-serif` |

**간격 — 6개 전부 일치** (`4.6px` / `9.2px` / `13.8px` / `18.4px` / `27.6px` / `36.8px`)

**반경 — 3개 전부 일치** (`2px` / `4px` / `7px`)

**그림자 — 3개 전부 불일치** (기준색 `#2d2b2b` → `#1f1f1f`; 기하 `0 1px 2px` / `0 3px 10px` / `0 12px 32px`와 백분율 `14%` / `16%` / `22%`는 불변)

**합계: 39개 중 29개 불일치 · 10개 일치.**

### 2.2 `tokens.json`의 메타데이터 블록도 어긋나 있다

값 외에 세 개의 서술 필드가 현재와 맞지 않는다:

- `$schema_note` / `source.design_system: "Classical"` / `source.ssot_document`·`ssot_section` — SPEC-DESIGN-001 `plan.md` §D.1을 SSOT로 지목한다(§1.3이 반박).
- `source.value_provenance` — "라이브 Classical 프로젝트에서 축자 전사"라고 주장한다. 현재 값의 출처는 SPEC-BRAND-001이다.
- `notes[0]` — "`--color-neutral-*`는 Tailwind 기본과 다른 **따뜻한 회색**"이라고 서술한다. 현재는 그레이스케일이다.
- `notes[1]` — "단일 mono accent 체계"는 **여전히 참**이다(위험/오류 색 역할 없음). 유지 대상.
- `notes[2]` — 간격 스케일 1.15배 비정수 서술은 **여전히 참**이다(§2.1 측정). 유지 대상.
- `live_reverification` 블록 — DesignSync 부재를 기록한 plan-phase 시점의 역사적 관측이다. §2.6이 그 관측이 **지금도 유효함**을 재측정으로 확인했다.

### 2.3 `globals.css` 헤더 주석의 허위 주장 — 행 단위 전수

헤더 주석은 **3-44행**의 단일 `/* ... */` 블록이다(`@theme {`은 45행). 허위 주장은 사용자가 지목한 4-11행에 **국한되지 않는다**:

| 행 | 주장 | 판정 |
|---|---|---|
| 4 | "SPEC-DESIGN-001 M1 — Classical design-token system (plan.md §D.1, SSOT)" | **거짓** — SSOT가 아니고 Classical도 아니다 |
| 6-8 | "Classical `:root` 토큰 블록을 축자 전사 … 값은 plan.md §D.1과 **바이트 단위로 동일**" | **거짓** — 색 24개·그림자 3개·폰트 2개가 다르다 |
| 9-11 | "Classical 원본이 바뀌면 plan.md §D.1에서 재동기화하라" | **거짓 지시** — 재동기화 원천이 더 이상 §D.1이 아니다 |
| 13-15 | "이 주석이 SPEC-STOREFRONT-001 M1의 디자인 토큰 제외 선언을 대체한다" | **참** — 역사적 사실. 유지 대상 |
| 18-22 | Tailwind v4 `@theme` 네임스페이스 규약 설명 | **참** — 메커니즘 서술. 유지 대상 |
| 23-28 | "`--color-neutral-100..900`은 Classical의 **따뜻한 회색(WARM grays)**" | **거짓** — 현재는 그레이스케일 |
| 29-30 | "M1이 토큰 기반을 놓고 M2-M5가 소비처를 이전한다" | **역사적 참** — SPEC-DESIGN-001 시점 서술 |
| 31-34 | "`--radius-md`가 Tailwind 기본 `md`(약 6px)를 4px로 덮어쓴다" | **참** — 반경은 불변(§2.1). 유지 대상 |
| 35-43 | "`--space-1..8`이 Tailwind의 `--spacing-*` 네임스페이스를 의도적으로 회피한다" | **참** — 간격 불변(§2.1). 유지 대상 |

즉 재작성은 **전면 폐기가 아니라 선별 교정**이다. 10개 문단 중 거짓은 3개(4행 · 6-11행 · 23-28행)이고 나머지는 지금도 참인 메커니즘 서술이다.

### 2.4 `globals.css` **원문 텍스트를 읽는 테스트가 3개 있다** (이 카드의 유일한 실질 위험)

```
$ grep -rn "globals.css" tests/ e2e/
tests/unit/app/shell.test.tsx:54,55
tests/unit/app/typography-cascade.test.tsx:11,21,26,34
tests/unit/app/design-tokens-grayscale.test.ts:5,14,17
```

세 파일 모두 `readFileSync("src/app/globals.css", "utf8")`로 **소스 텍스트를 문자열 검사**한다. 헤더 주석을 재작성하면 주석 산문이 이 검사들의 입력에 그대로 들어간다. 각각의 결합을 개별 확인했다:

**(a) `shell.test.tsx:55` — 첫 줄 고정 결합**

```js
expect(readFileSync("src/app/globals.css", "utf8").trimStart()).toMatch(/^@import "tailwindcss";/);
```

`trimStart()` 후 파일이 `@import "tailwindcss";`로 시작해야 한다. 현재 1행이 그 값이다:

```
$ head -1 src/app/globals.css
@import "tailwindcss";
```

→ **제약**: 재작성된 헤더 주석은 반드시 1행 `@import` **아래**에 놓여야 한다. 주석을 파일 맨 앞으로 옮기면 이 테스트가 깨진다.

**(b) `design-tokens-grayscale.test.ts:50-55` — 파일 전역 부정 검사 (가장 위험)**

```js
const lampMatches = css.match(/accent-2-/g) ?? [];
expect(lampMatches).toHaveLength(0);
```

`@theme` 블록이 아니라 **파일 전체 텍스트**에서 `accent-2-` 부분문자열이 0건이어야 한다. 주석 산문도 검사 대상이다. 현재 상태:

```
$ grep -c "accent-2-" src/app/globals.css
0
```

→ **제약**: 재작성된 주석에 `accent-2-` 부분문자열이 들어가면 안 된다. `--color-accent-2-*` 같은 표기는 금지. `--color-accent-2`(하이픈 없이 끝) 또는 `--color-accent`의 `-2` 변형처럼 써야 한다. 현행 `tokens.json` `notes[1]`이 이미 이 회피 표기(«`--color-accent` (+ `-2`, + 100-900 ramp)»)를 쓰고 있어 선례가 있다.

**(c) `typography-cascade.test.tsx:37` — 첫 매치 규칙 추출 결합**

```js
const bodyRule = extractRule(css, /\bbody\s*\{[^}]*\}/);
```

파일 전체에서 **첫 번째** `body {` 를 규칙으로 간주한다. 현재 유일한 매치는 실제 규칙이다:

```
$ grep -n "body\s*{" src/app/globals.css
114:body {
```

→ **제약**: 재작성된 주석(3-44행, 114행보다 앞)에 `body {` 형태의 문자열이 들어가면 `extractRule`이 주석을 잡아 이 테스트가 깨진다.

세 제약 모두 **주석 산문에만 걸리는 문자열 수준 제약**이며, `@theme` 값과 무관하다.

### 2.5 런타임 소비처 — 측정 결과 0건

**`tokens.json`**

```
$ grep -rn "tokens.json" src/
exit=1        (0건)

$ grep -rn "\.moai/design" src/
exit=1        (0건)
```

저장소 전역 검색은 **15건**을 반환했고 **전부 문서 참조**다. 측정 명령은 baseline 커밋에 고정했다 — 작업 트리를 대상으로 하면 이후 생성되는 plan-audit 보고서가 자기 자신을 세어 수치가 흔들린다:

```
$ git grep -n "tokens.json" cfbd320 -- . ':(exclude).moai/specs/*' | wc -l
15
```

제외 집합은 `.moai/specs/**` 하나뿐이다(SPEC 문서끼리의 상호 참조는 소비처 판정과 무관하다). `node_modules`·`.git`은 `git grep`이 추적 파일만 보므로 별도 제외가 필요 없다.

| 위치 | 건수 | 성격 |
|---|---|---|
| `CHANGELOG.md:17,28` | 2 | 후속 카드 권고 산문 |
| `.moai/design/brief/BRIEF-DESIGN-001.md:55,72,73,77,92,99` | 6 | design-phase 브리프 산문 |
| `.moai/reports/sync-audit/SPEC-DESIGN-001-2026-09-05.md:133,142` | 2 | 감사 보고서 산문 |
| `.claude/agents/moai/manager-design.md:87` · `.claude/rules/moai/design/constitution.md:90,132` · `.claude/rules/moai/core/zone-registry.md:601` · `.claude/skills/moai/workflows/design.md:115` | 5 | **MoAI 하니스의 예약 경로 선언** |
| **합계** | **15** | |

`package.json` `scripts`에도 이 파일을 읽는 항목이 없다:

```
"dev" / "build" / "start" / "lint" / "typecheck" / "test" / "test:coverage" / "test:e2e" / "prisma:generate" / "prisma:validate"
```

→ Next.js 런타임·빌드·테스트 어느 경로도 `tokens.json`을 읽지 않는다.

**`globals.css` 헤더 주석**: CSS 주석이므로 브라우저에 전달되지 않고 스타일 계산에 관여하지 않는다. 유일한 «소비처»는 §2.4의 세 테스트가 수행하는 **소스 텍스트 검사**다.

### 2.6 다만 «소비처 0건»은 «읽는 도구가 없다»가 아니다 — 정직한 단서

§2.5의 마지막 행이 중요하다. `.moai/design/tokens.json`은 **MoAI 하니스가 예약한 design-phase 산출물 경로**다(`design/constitution.md:90` «Reserved file paths (canonical list): `tokens.json`, `components.json`, …»). 즉 애플리케이션 런타임 소비처는 0건이지만, **장래의 design-phase 실행(`manager-design` 에이전트 / `/moai design` D1-D5 파이프라인)은 이 경로를 읽고 쓰는 것을 전제로 한다.**

이것은 «papering over»할 사실이 아니라 이 카드의 **가치 근거**다. 파일이 완전한 사문이라면 고칠 이유가 약하지만, 장래 design-phase가 참조할 예약 경로가 두 세대 뒤처진 팔레트를 담고 있다면 그것은 대기 중인 결함이다.

DesignSync에 대해서는 `tokens.json`의 `live_reverification` 블록이 기록한 관측이 **지금도 유효함**을 재측정했다:

```
$ cat .mcp.json      (mcpServers 키만 발췌)
context7 · moai · playwright        ← DesignSync 항목 없음

$ ls -d .moai/project/brand
(존재하지 않음)
```

→ DesignSync는 이 세션에서도 등록되어 있지 않다. 따라서 이 카드는 **라이브 디자인 원천과 대조하지 않는다.** 재동기화의 원천은 오직 출시된 `src/app/globals.css` `@theme` 블록이다(§4 REQ-DESIGN4-001).

### 2.7 SPEC-DESIGN-001 `plan.md` §D.1의 현재 상태

```
$ grep -n "§D.1" .moai/specs/SPEC-DESIGN-001/plan.md   (표제 행만)
204:### §D.1 Classical 토큰 블록 — 확정 값 (원문 인용, SSOT)
```

- 표제는 **204행**, 값 코드블록은 207-231행, 주의 3항목은 233-237행, 다음 표제 `### §D.1b`는 **239행**이다.
- SPEC-DESIGN-001 `spec.md` frontmatter는 `status: completed`.
- **관측하되 건드리지 않는 사실**: 같은 SPEC의 `plan.md` frontmatter는 `status: in-progress`로 남아 있어 `spec.md`와 어긋난다. 이 카드의 범위가 아니다(§3).

---

## §3. 범위 제외 (Out of Scope)

### Out of Scope — SPEC-DESIGN-001의 `completed → in-progress (amendment)` 전이

- SPEC-DESIGN-001의 frontmatter `status`를 바꾸지 않는다. `amendment_of:` 필드를 추가하지 않는다. HISTORY에 `## Amendments` 하위 절을 만들지 않는다. `version`을 올리지 않는다.
- **근거**: 사용자가 이 카드의 범위를 명시적으로 축소했다. 완전한 개정은 별도 카드(**t70**)의 몫이다.
- 이 축소는 스키마 전이 매트릭스와 충돌하지 않는다. §D.1 표기 추가는 SPEC-DESIGN-001의 `status:`를 바꾸지 않으므로 `.claude/rules/moai/development/spec-frontmatter-schema.md` § Status Transition Ownership Matrix의 **어떤 행도 발화하지 않고**(`completed → in-progress (amendment)` 행 포함), 따라서 개정 절차(`amendment_of:` · HISTORY `## Amendments`)를 요구하지 않는다. 쓰기 주체는 같은 문서의 § Forbidden ownership crossings가 `manager-develop`의 본문 수정을 금지하며 재위임 대상으로 지목한 **manager-spec**이다.
- **다만 이 경우를 직접 허가하는 규칙 문장은 없다.** «완료된 자매 SPEC의 본문에 표기만 삽입하는 행위»는 규칙 집합이 다루지 않는 공백이며 — 특히 § Non-transition frontmatter corrections는 그 범위 문장이 «Body content … stay untouched»라고 본문을 명시적으로 배제하므로 이 삽입의 근거가 **될 수 없다** — 이 카드는 그 공백을 보수적으로 항행한다(순수 삽입 · frontmatter 무변경 · 표제 행 무변경 · 삽입 텍스트의 plan-phase 축자 확정 · 별도 커밋). 판단의 전문과 근거는 `plan.md` §B.4 · §B.6 · §B.7에 기록했다.
- **전방 포인터**: 카드 t70이 SPEC-DESIGN-001 본문 전반(§D.1b 교체 표, §D.3 매핑, REQ-DESIGN-008의 축자 전사 위임 등)을 BRAND-001 이후 상태로 재조정할지 판단한다.

### Out of Scope — `@theme` 블록 내부 72행의 잔존 허위 주장

- `globals.css` 72행(t51 주석 말미)은 "every other token in this `@theme` block remains the verbatim plan.md §D.1 transcription"이라고 서술한다. §2.1이 보인 대로 **거짓**이다.
- 그럼에도 이 카드에서 고치지 않는다. 사용자가 지정한 Part 2의 대상은 «헤더 주석»이며, 72행은 `@theme` 블록 **안쪽**(45-81행)에 있어 헤더 주석이 아니다. 53-58행의 SPEC-DESIGN-002 주석도 같은 이유로 대상이 아니다.
- **측정으로 확인한 사실이지 누락이 아니다.** 이 카드가 헤더 주석만 고치면 파일 안에 같은 성격의 주장이 한 곳 남는다는 점을 명시적으로 기록한다.
- **전방 포인터**: `@theme` 블록 내부 주석(53-58행 · 64-72행)의 계보 정합성 점검을 별도 카드로 권고한다. t70과 묶는 것이 자연스럽다.

### Out of Scope — CSS 커스텀 프로퍼티 값 변경

- `@theme` 블록의 어떤 토큰 값도 바꾸지 않는다. 색·폰트·간격·반경·그림자 전부 현재 값 그대로 유지한다.
- 이 카드의 방향은 **코드를 문서에 맞추는 것이 아니라 문서를 코드에 맞추는 것**이다. `globals.css` `@theme`이 출시된 진실이고 `tokens.json`이 따라간다.

### Out of Scope — `.tsx` 파일 및 소비처 수정

- `.tsx` 파일을 한 건도 수정하지 않는다. 컴포넌트·페이지·레이아웃·테스트 전부 무변경.
- 근거: 값이 바뀌지 않으므로 소비처가 볼 결과가 바뀌지 않는다.

### Out of Scope — `.moai/design/components.json` 및 나머지 design 산출물

- `tokens.json`과 같은 디렉터리의 `components.json`, `brief/BRIEF-DESIGN-001.md`도 SPEC-DESIGN-001 시점 상태로 남아 있다. 이 카드는 **`tokens.json`만** 다룬다.
- **근거**: `components.json`의 어긋남은 성격이 다르다(토큰 값이 아니라 컴포넌트 인벤토리·소비처 카운트이며, SPEC-BRAND-001이 `SiteHeader` 내비게이션을 4링크로 확장하고 `/shop`·`/bespoke`·`/story` 페이지를 신설했으므로 재동기화하려면 컴포넌트 전수 재측정이 필요하다). 토큰 값 재동기화 카드에 컴포넌트 인벤토리 재측정을 끼워 넣으면 이 카드의 diff 범위 가드(AC-010 — 변경 파일 정확히 3개)가 무의미해진다.
- **전방 포인터**: `components.json` 재동기화를 별도 카드로 권고한다.

### Out of Scope — DesignSync 라이브 대조

- §2.6이 측정한 대로 DesignSync는 등록되어 있지 않다. 라이브 디자인 원천과의 대조를 시도하지 않는다.
- `tokens.json`의 `live_reverification` 블록은 **삭제하지 않고 갱신**한다 — 관측 시점을 이 카드로 갱신하되, DesignSync 부재라는 사실 자체는 여전히 참이므로 기록을 보존한다.

### Out of Scope — CHANGELOG의 역사적 기록 수정

- `CHANGELOG.md:17,28`이 `tokens.json` 재동기화를 «미해소 후속 카드»로 기재한 것은 **그 시점의 참**이다. 소급 수정하지 않는다.
- sync-phase가 이 SPEC의 신규 항목을 추가하며 해소 사실을 기록한다.

---

## §4. 요구사항 (GEARS)

- **REQ-DESIGN4-001** (Ubiquitous): `.moai/design/tokens.json`의 `tokens` 객체가 담는 39개 토큰 값은 출시된 `src/app/globals.css` `@theme` 블록의 대응 값과 **문자 단위로 일치해야 한다**(shall). 재동기화의 유일한 원천은 그 `@theme` 블록이며, 어떤 `plan.md`도, 어떤 라이브 디자인 도구도 아니다(§2.6).

- **REQ-DESIGN4-002** (Ubiquitous): `tokens.json`의 서술 필드(`$schema_note` · `source.*` · `notes[]`)는 현재 값의 실제 계보 — SPEC-BRAND-001 기반 + SPEC-DESIGN-002의 `neutral-600` 보정 + t51의 폰트 조달 방식 전환 — 를 서술해야 한다(shall). "Classical" 디자인 시스템을 현재 원천으로 지목해서는 안 된다(shall not).

- **REQ-DESIGN4-003** (Ubiquitous): §2.2가 **여전히 참**으로 판정한 서술(`notes[1]` 단일 mono accent 체계 · `notes[2]` 1.15배 비정수 간격 스케일)은 삭제되어서는 안 된다(shall not). 이 카드는 거짓 서술만 교정한다.

- **REQ-DESIGN4-004** (Ubiquitous): `src/app/globals.css`의 헤더 주석(3-44행)은 `@theme` 블록의 SSOT 계보를 §1.3의 계층대로 서술해야 하며(shall), 값의 최종 권위가 `@theme` 블록 자신임을 명시해야 한다(shall). "plan.md §D.1과 바이트 단위로 동일"하다는 취지의 주장을 담아서는 안 된다(shall not).

- **REQ-DESIGN4-005** (Ubiquitous): §2.3이 **여전히 참**으로 판정한 문단(13-15행 STOREFRONT-001 대체 사실 · 18-22행 Tailwind `@theme` 네임스페이스 규약 · 31-34행 `--radius-md` 덮어쓰기 · 35-43행 `--space-*` 네임스페이스 회피 근거)의 내용은 보존되어야 한다(shall). 재작성은 선별 교정이며 전면 폐기가 아니다.

- **REQ-DESIGN4-006** (Ubiquitous): `src/app/globals.css`의 변경은 **주석 산문에만** 국한되어야 한다(shall). `@theme` 블록의 토큰 값, `.plate` 규칙, `body` 규칙, 제목 규칙을 변경해서는 안 된다(shall not).

- **REQ-DESIGN4-007** (While — state-driven): 재작성된 헤더 주석이 `src/app/globals.css`에 존재하는 동안, 그 주석 텍스트는 §2.4가 측정한 세 가지 테스트 결합 제약을 위반해서는 안 된다(shall not): (a) 1행 `@import "tailwindcss";`보다 앞서지 않을 것, (b) 부분문자열 `accent-2-`를 포함하지 않을 것, (c) `body {` 형태의 문자열을 포함하지 않을 것. 여기에 추출 앵커에서 파생되는 제약 하나를 더한다: (d) 주석의 어떤 행도 **0열에서 `@theme`으로 시작해서는 안 된다**(shall not). `acceptance.md`가 «헤더 주석»을 `^@theme` 앵커로 기계적으로 분할하는데, AC-005는 동시에 `@theme`이라는 문자열이 주석 안에 **살아 있을 것**을 요구한다(18-22행 네임스페이스 규약 서술). `/* … */` 블록 안에서 연속 행이 0열에서 시작하는 것은 문법적으로 합법이므로, 그런 행이 생기면 AC-004·AC-006의 추출이 조기 종료해 잘못된 구간을 대상으로 삼는다. 관측 지점: AC-006의 98행 어서션과 바이트 `diff`가 소리 내어 실패하고, AC-007 (c)의 `grep -n "^@theme"` 경계 판정이 2건을 반환한다 — 이 제약은 별도 검사를 추가하지 않고 기존 두 AC가 이미 감시한다.

- **REQ-DESIGN4-008** (Ubiquitous): `.moai/specs/SPEC-DESIGN-001/plan.md` §D.1에는 그 절의 값이 더 이상 출시 상태가 아님을 알리는 표기가 추가되어야 하며(shall), 그 표기는 현재 값이 사는 곳(SPEC-BRAND-001 · SPEC-DESIGN-002 · 그리고 최종 권위인 `src/app/globals.css` `@theme`)을 지목해야 한다(shall).

- **REQ-DESIGN4-009** (Ubiquitous): SPEC-DESIGN-001의 frontmatter(`status` · `version` · `amendment_of`)와 HISTORY는 변경되어서는 안 된다(shall not). §D.1의 기존 값 코드블록과 주의 3항목도 삭제·수정되어서는 안 된다(shall not) — 표기는 **추가**이지 대체가 아니다.

- **REQ-DESIGN4-010** (Ubiquitous): 이 SPEC의 변경으로 기존 테스트 스위트·린트·타입체크에 신규 실패가 발생해서는 안 된다(shall not).

---

## §5. 성공 기준

`acceptance.md`의 AC-001 ~ AC-010이 이진 판정으로 정의한다. 요지:

1. `tokens.json` 39개 토큰이 `@theme`과 전부 일치 (기계적 대조).
2. `tokens.json` 서술 필드에 "Classical"이 원천으로 남지 않고, 보존 대상 서술 2건이 살아 있다.
3. `globals.css` 헤더 주석에서 §2.3의 거짓 주장 3건이 사라지고 보존 대상 4건이 남아 있다.
4. `globals.css` `@theme` 값 39개가 **무변경**이다.
5. §2.4의 세 테스트 결합 제약이 전부 충족된다.
6. SPEC-DESIGN-001 §D.1에 표기가 존재하고, frontmatter·기존 값 블록은 무변경이다.
7. 변경 파일이 정확히 3개다.
8. 테스트·린트·타입체크 신규 실패 0건.
