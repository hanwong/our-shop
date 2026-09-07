# SPEC-DESIGN-004 — 인수 조건

> 각 AC는 이진 판정 가능하다. 판정 근거는 **실제로 실행한 명령의 축자 출력**이며, 추론·요약·"통과함" 서술은 증적이 아니다.
> 증적 파일은 `.moai/state/verify/SPEC-DESIGN-004/` 아래에 남기되, **감사 시점에 해석되는 증적은 `progress.md` §E.2에 인라인으로 인용된 축자 출력**이다(`.moai/state/`는 `.gitignore` 대상이므로 커밋되지 않는다).
>
> **`git diff` 기준점 (plan-phase baseline)**: 이 문서의 모든 `git diff` / `git show`는 baseline 커밋 **`cfbd320`**(전체 SHA `cfbd320d1b1cb2f2c1400b088262539c75a77879` — 이 워크트리의 분기점 `origin/main`)에 **명시적으로 고정**한다. 기준점 없는 맨 `git diff`는 작업 트리와 인덱스만 비교하므로, run-phase가 마일스톤 단위로 커밋한 뒤(`plan.md` §G가 M1·M2·M3을 별도 커밋으로 분리한다) 실행하면 빈 출력이 되어 위양성 판정을 낸다.
>
> **«헤더 주석» 의 기계적 정의**: 이 문서에서 «헤더 주석»은 `src/app/globals.css`의 **`@theme` 선언 행보다 앞선 전 구간**을 뜻한다. 재작성으로 행 번호가 이동하므로 고정 행 범위(3-44) 대신 아래 추출식을 쓴다:
>
> ```bash
> awk '/^@theme/{exit} {print}' src/app/globals.css
> ```
>
> **npm 명령의 환경 격리**: 워크트리 안에서 npm을 호출할 때는 한 번의 복합 호출로 환경을 세척한다 —
> `unset MOAI_KANBAN MOAI_KANBAN_ID MOAI_KANBAN_LABEL MOAI_KANBAN_LEAD_ADDR MOAI_KANBAN_SETTINGS_INJECTED && npm test`

---

## §D. AC 매트릭스

| AC | 요약 | 대응 REQ | 마일스톤 | 심각도 |
|---|---|---|---|---|
| AC-001 | `tokens.json` 39개 토큰이 `@theme`과 문자 단위 일치 | REQ-DESIGN4-001 | M1 | blocking |
| AC-002 | `tokens.json` 서술 필드가 Classical을 현재 원천으로 지목하지 않음 | REQ-DESIGN4-002 | M1 | blocking |
| AC-003 | `tokens.json` 보존 대상 서술 2건 생존 + JSON 유효 | REQ-DESIGN4-003 | M1 | blocking |
| AC-004 | 헤더 주석에서 거짓 주장 3군 소멸 | REQ-DESIGN4-004 | M2 | blocking |
| AC-005 | 헤더 주석에 참인 서술 4건 + 실제 계보 생존 | REQ-DESIGN4-004 · REQ-DESIGN4-005 | M2 | blocking |
| AC-006 | `@theme` 선언 행부터 EOF까지 **바이트 단위 무변경** | REQ-DESIGN4-006 | M2 | blocking |
| AC-007 | 테스트 결합 3제약 충족 | REQ-DESIGN4-007 | M2 | blocking |
| AC-008 | SPEC-DESIGN-001 §D.1에 표기 존재 + 삽입 지점 정확 | REQ-DESIGN4-008 | M3 | blocking |
| AC-009 | SPEC-DESIGN-001이 **순수 삽입**(삭제 0행) + frontmatter 무변경 | REQ-DESIGN4-009 | M3 | blocking |
| AC-010 | 변경 파일 정확히 3개 + 린트·타입체크·테스트 신규 실패 0건 | REQ-DESIGN4-010 | M4 | blocking |

---

### AC-001 — `tokens.json` 39개 토큰이 `@theme`과 문자 단위 일치

**Given** `tokens.json`의 `tokens` 객체가 5개 그룹 39개 토큰을 담고 `src/app/globals.css`의 `@theme` 블록이 같은 39개 커스텀 프로퍼티를 선언한 상태에서,
**When** 두 집합을 **키별로** 대조하면,
**Then** 검사 건수가 **39**이고 불일치가 **0**이어야 한다.

**검증 방법** — 아래 스크립트를 `.moai/state/verify/SPEC-DESIGN-004/ac001-token-diff.js`로 저장하고 실행한다(실행 후 삭제):

```js
const fs = require("fs");
const css = fs.readFileSync("src/app/globals.css", "utf8");
// @theme 블록 본문을 뽑고 주석을 먼저 제거한다 — SPEC-DESIGN-002 주석(53-58행)이
// 세미콜론을 포함하므로 주석을 남긴 채 ';' 로 쪼개면 파싱이 깨진다.
const theme = css.match(/@theme\s*\{([\s\S]*?)\n\}/)[1].replace(/\/\*[\s\S]*?\*\//g, "");
const shipped = {};
for (const decl of theme.split(";")) {
  const m = decl.match(/(--[a-z0-9-]+)\s*:\s*([\s\S]+)/i);
  if (m) shipped[m[1]] = m[2].trim().replace(/\s+/g, " ");
}
const groups = JSON.parse(fs.readFileSync(".moai/design/tokens.json", "utf8")).tokens;
const rows = [];
for (const [group, obj] of Object.entries(groups))
  for (const [k, v] of Object.entries(obj))
    rows.push([(group === "color" ? "--color-" : "--") + k, String(v).replace(/\s+/g, " ")]);
let bad = 0;
for (const [name, want] of rows) {
  const got = shipped[name];
  if (got !== want) {
    bad++;
    console.log(`MISMATCH ${name}\n  tokens.json: ${want}\n  globals.css: ${got}`);
  }
}
console.log(`shippedKeys=${Object.keys(shipped).length}`);
console.log(`checked=${rows.length} mismatch=${bad}`);
process.exit(bad === 0 && rows.length === 39 ? 0 : 1);
```

```bash
node .moai/state/verify/SPEC-DESIGN-004/ac001-token-diff.js
echo "exit=$?"
```

**PASS 조건**: 출력의 마지막 두 행이 정확히 `shippedKeys=39` 과 `checked=39 mismatch=0` 이고 `exit=0`. `MISMATCH` 행이 한 줄이라도 나오면 FAIL.

> **이 스크립트는 plan-phase에서 실제로 실행해 파서 동작을 검증했다** (`progress.md` §E.1 검증 12번). 교체 전 상태에서 `shippedKeys=39 / checked=39 / mismatch=29`를 출력해 `spec.md` §2.1의 수동 대조표(29건 불일치)와 **독립적으로 일치**했다. 따라서 M1에서 `mismatch=0`이 나오지 않으면 원인은 파서가 아니라 재동기화 누락이다.
>
> `shippedKeys=39` 어서션이 중요한 이유: `@theme` 추출 정규식이 조기 종료해 블록의 일부만 파싱하면 `shipped`에 키가 덜 담기고, 누락된 키는 `undefined`가 되어 `MISMATCH`로 보고된다. 이 행이 39가 아니면 «값이 틀렸다»가 아니라 «파싱이 깨졌다»는 신호다.

**독립 교차 검사 (b)** — 옛 Classical 색 리터럴이 파일에 남지 않았는지 (스크립트와 독립된 확인):

```bash
grep -oE "f3f2f2|eae9e9|201f1d|b68235|ac803e|f8f4f4|eae7e7|d7d3d3|bab6b6|9b9797|7d7979|605d5d|444141|2d2b2b|fff3e4|ffe3bf|facb8d|e1ad66|c28d41|a06f24|7d5411|5a3b0a|3a270d" .moai/design/tokens.json | wc -l
```

**PASS 조건 (b)**: 출력이 `0`.

> **범위 주의**: 옛 Classical 리터럴은 `.moai/specs/SPEC-DESIGN-001/`(§D.1 값 블록 포함)과 이 SPEC 자신의 `spec.md` §2.1 표에 **역사적 기록**으로 남는다. REQ-DESIGN4-001의 대상이 아니며 제거하지 않는다. 검사 범위를 `.moai/design/tokens.json` 단일 파일로 한정하는 이유다.

**스크립트 사후 처리**:

```bash
rm -f .moai/state/verify/SPEC-DESIGN-004/ac001-token-diff.js
test -e .moai/state/verify/SPEC-DESIGN-004/ac001-token-diff.js && echo PRESENT || echo REMOVED
```

---

### AC-002 — 서술 필드가 Classical을 현재 원천으로 지목하지 않는다

**Given** `tokens.json`의 `$schema_note` · `source.*` · `replacement_map_pointer` 가 SPEC-DESIGN-001 `plan.md` §D.1과 Classical 디자인 시스템을 값의 원천으로 서술하던 상태에서,
**When** 재동기화 후 그 필드들을 검사하면,
**Then** Classical / §D.1 지목이 **원천 서술로는** 0건이고, 실제 계보 3건이 명시되어야 한다.

**검증 방법**:

```bash
# (a) 원천 지목이 남아 있지 않은지 — 값 필드가 아닌 메타 필드 대상
node -e 'const t=JSON.parse(require("fs").readFileSync(".moai/design/tokens.json","utf8"));
const meta=JSON.stringify({s:t.$schema_note,src:t.source,rmp:t.replacement_map_pointer});
console.log("Classical_as_source=", /"design_system"\s*:\s*"Classical"/.test(JSON.stringify(t.source))?1:0);
console.log("D1_pointer=", (meta.match(/§D\.1/g)||[]).length);'

# (b) 실제 계보 3건이 명시되었는지 (파일 전체 대상)
grep -c "SPEC-BRAND-001" .moai/design/tokens.json
grep -c "SPEC-DESIGN-002" .moai/design/tokens.json
grep -c "globals.css" .moai/design/tokens.json
```

**PASS 조건**: (a) `Classical_as_source= 0` 이고 `D1_pointer= 0`. (b) 세 grep 모두 `1` 이상.

> **«Classical» 이라는 단어 자체는 금지하지 않는다.** 재동기화된 파일이 «값의 원천이 Classical에서 OUR 그레이스케일로 교체되었다»는 역사적 사실을 서술하는 것은 정당하며 오히려 바람직하다. 이 AC가 금지하는 것은 `source.design_system`이 여전히 `"Classical"`인 것과, 메타 필드가 §D.1을 **현재 원천으로** 가리키는 것뿐이다.

---

### AC-003 — 보존 대상 서술 2건 생존 + JSON 유효

**Given** `spec.md` §2.2가 `notes[1]`(단일 mono accent 체계)과 `notes[2]`(1.15배 비정수 간격 스케일)를 **여전히 참**으로 판정한 상태에서,
**When** 재동기화 후 `notes` 배열과 JSON 파싱 가능성을 검사하면,
**Then** 두 서술의 취지가 살아 있고 파일이 유효한 JSON이어야 한다.

**검증 방법**:

```bash
# (a) JSON 유효성
node -e 'JSON.parse(require("fs").readFileSync(".moai/design/tokens.json","utf8")); console.log("JSON_OK")'

# (b) 보존 대상 서술의 식별 키워드
grep -c "1.15" .moai/design/tokens.json          # 간격 스케일 서술
grep -c "4.6" .moai/design/tokens.json           # 간격 스케일의 실제 값 (반올림 금지 근거)
grep -ci "accent" .moai/design/tokens.json       # 단일 mono accent 서술 + accent 토큰

# (c) 폰트 렌더 계열 note 추가 확인 (plan.md §C.1 결정)
grep -c "Cormorant Garamond" .moai/design/tokens.json
grep -c "Lora" .moai/design/tokens.json

# (d) 토큰 그룹 5개와 총 39개가 유지되는지
node -e 'const t=JSON.parse(require("fs").readFileSync(".moai/design/tokens.json","utf8")).tokens;
const g=Object.keys(t); console.log("groups=",g.join(","));
console.log("total=", g.reduce((n,k)=>n+Object.keys(t[k]).length,0));'
```

**PASS 조건**: (a) `JSON_OK`. (b) `1.15` ≥1, `4.6` ≥1, `accent` ≥1. (c) `Cormorant Garamond` ≥1 **그리고** `Lora` ≥1 — `tokens.typography` 값이 `var(--font-*-nf)` 리터럴로 바뀌었으므로 렌더 서체명은 `notes`에만 남는다. (d) `groups= color,typography,spacing,radius,shadow` 이고 `total= 39`.

---

### AC-004 — 헤더 주석에서 거짓 주장 3군 소멸

**Given** `spec.md` §2.3이 헤더 주석의 거짓 주장을 세 군집(4행 §D.1 SSOT 지목 · 6-11행 바이트 동일 주장과 재동기화 지시 · 23-28행 따뜻한 회색 주장)으로 특정한 상태에서,
**When** 재작성 후 헤더 주석 구간을 검사하면,
**Then** 세 군집의 식별 문자열이 각각 **0건**이어야 한다.

**검증 방법**:

```bash
awk '/^@theme/{exit} {print}' src/app/globals.css > .moai/state/verify/SPEC-DESIGN-004/header.txt

grep -c "§D.1"   .moai/state/verify/SPEC-DESIGN-004/header.txt   # 기대: 0
grep -ci "byte"  .moai/state/verify/SPEC-DESIGN-004/header.txt   # 기대: 0
grep -c "WARM"   .moai/state/verify/SPEC-DESIGN-004/header.txt   # 기대: 0
```

**PASS 조건**: 세 값이 전부 `0`.

**세 문자열을 고른 근거** (임의 선택이 아님):
- `§D.1` — 4행·8행·9행·24행의 SSOT 지목·바이트 동일 주장·재동기화 지시·주의 참조가 **전부** 이 앵커를 경유한다. 0건이면 네 곳이 동시에 해소된다. `plan.md` §C.2가 «재동기화 원천 지시 자체를 제거»하기로 결정한 것과 정합한다.
- `byte` — 6-8행의 "byte-identical" 주장. 원문이 `byte-` / `identical` 로 줄바꿈되어 있으므로(7-8행) 전체 문구가 아니라 `byte` 단독으로 검색한다. 대소문자 무시(`-i`).
- `WARM` — 23행의 "Classical's WARM grays". 대문자 강조가 원문 그대로이므로 대소문자 구분 검색으로 충분히 특정된다.

> **`Classical` 단어 자체는 금지하지 않는다** — AC-002와 같은 이유다. 재작성된 주석이 «최초에는 Classical에서 전사되었으나 SPEC-BRAND-001이 대체했다»는 계보를 서술하는 것은 REQ-DESIGN4-004가 요구하는 바다.

---

### AC-005 — 참인 서술 4건 + 실제 계보 생존

**Given** `spec.md` §2.3이 13-15행(STOREFRONT-001 대체 사실) · 18-22행(Tailwind `@theme` 네임스페이스 규약) · 31-34행(`--radius-md` 덮어쓰기) · 35-43행(`--space-*` 네임스페이스 회피 근거)을 **여전히 참**으로 판정한 상태에서,
**When** 재작성 후 헤더 주석 구간을 검사하면,
**Then** 네 서술의 식별 문자열이 각각 1건 이상 살아 있고, 실제 계보 2건이 새로 명시되어야 한다.

**검증 방법** (AC-004이 만든 `header.txt` 재사용):

```bash
# 보존 대상 4건
grep -c "STOREFRONT-001" .moai/state/verify/SPEC-DESIGN-004/header.txt
grep -c "@theme"         .moai/state/verify/SPEC-DESIGN-004/header.txt
grep -c "radius-md"      .moai/state/verify/SPEC-DESIGN-004/header.txt
grep -c "spacing-"       .moai/state/verify/SPEC-DESIGN-004/header.txt

# 새로 명시되어야 하는 실제 계보
grep -c "SPEC-BRAND-001"  .moai/state/verify/SPEC-DESIGN-004/header.txt
grep -c "SPEC-DESIGN-002" .moai/state/verify/SPEC-DESIGN-004/header.txt
```

**PASS 조건**: 여섯 값이 **전부 1 이상**.

**식별 문자열의 근거**:
- `STOREFRONT-001` — 13-15행이 «이 주석이 SPEC-STOREFRONT-001 M1의 디자인 토큰 제외 선언을 대체한다»는 역사적 사실을 담는 유일한 지점이다.
- `@theme` — 18-22행의 Tailwind v4 네임스페이스 규약 서술.
- `radius-md` — 31-34행의 Tailwind 기본 `md` 반경 덮어쓰기 경고. 반경 토큰은 불변이므로(§2.1) 이 서술은 지금도 참이다.
- `spacing-` — 35-43행의 핵심. `--space-*`를 Tailwind 예약 `--spacing-*`로 개명하지 **않은** 비자명한 결정의 근거이며, 잃으면 장래에 누군가 «이름을 통일하자»며 사이트 전역 간격을 깨뜨릴 수 있다.
- `SPEC-BRAND-001` / `SPEC-DESIGN-002` — REQ-DESIGN4-004가 요구하는 계층 서술. 둘 다 값의 실제 기여자다(`plan.md` §C.2).

---

### AC-006 — `@theme` 선언 행부터 EOF까지 바이트 단위 무변경

**Given** 이 SPEC이 `globals.css`에서 **주석 산문만** 바꾸기로 한 상태에서,
**When** baseline `cfbd320`의 파일과 현재 파일에서 각각 `@theme` 선언 행부터 끝까지를 추출해 비교하면,
**Then** 두 구간이 **바이트 단위로 동일**해야 한다.

**검증 방법**:

```bash
git show cfbd320:src/app/globals.css | awk '/^@theme/{f=1} f' > .moai/state/verify/SPEC-DESIGN-004/theme-base.txt
awk '/^@theme/{f=1} f' src/app/globals.css                    > .moai/state/verify/SPEC-DESIGN-004/theme-head.txt

diff .moai/state/verify/SPEC-DESIGN-004/theme-base.txt .moai/state/verify/SPEC-DESIGN-004/theme-head.txt
echo "exit=$?"

wc -l < .moai/state/verify/SPEC-DESIGN-004/theme-head.txt
```

**PASS 조건**: `diff` 출력 없음 + `exit=0`. 행 수는 baseline과 동일한 **98**행(45-142행 — plan-phase에 `awk … | wc -l` 로 실측).

이 단일 검사가 다음을 **한꺼번에** 보증한다 — 토큰 값 39개 무변경 · 53-58행 SPEC-DESIGN-002 주석 무변경 · 64-72행 t51 주석 무변경 · `.plate` 규칙 무변경 · `body` 규칙 무변경 · 제목 규칙 무변경. `plan.md` §F PRESERVE 목록의 `globals.css` 항목 전부가 여기에 포섭된다.

---

### AC-007 — 테스트 결합 3제약 충족

**Given** `spec.md` §2.4가 `globals.css` **원문 텍스트**를 읽는 테스트 3개와 그 정규식이 주석 산문에 거는 제약 3건을 측정한 상태에서,
**When** 재작성 후 세 제약을 각각 검사하고 해당 테스트를 실행하면,
**Then** 세 검사가 전부 기대값과 일치하고 세 테스트가 통과해야 한다.

**검증 방법**:

```bash
# (a) shell.test.tsx:55 — 첫 줄 고정
head -1 src/app/globals.css
# 기대 출력: @import "tailwindcss";

# (b) design-tokens-grayscale.test.ts:53 — 파일 전역 accent-2- 부정 검사
grep -c "accent-2-" src/app/globals.css
# 기대 출력: 0

# (c) typography-cascade.test.tsx:37 — 첫 `body {` 매치가 실제 규칙인지
grep -n "body\s*{" src/app/globals.css
# 기대 출력: 정확히 1행이며, 그 행이 실제 body 규칙 (baseline 114행 — 주석 재작성으로
#            행 번호는 이동할 수 있으나 매치 건수는 1이어야 한다)

# (d) 세 테스트 실제 실행
unset MOAI_KANBAN MOAI_KANBAN_ID MOAI_KANBAN_LABEL MOAI_KANBAN_LEAD_ADDR MOAI_KANBAN_SETTINGS_INJECTED && npx vitest run tests/unit/app/shell.test.tsx tests/unit/app/typography-cascade.test.tsx tests/unit/app/design-tokens-grayscale.test.ts
```

**PASS 조건**: (a) 정확히 `@import "tailwindcss";`. (b) 정확히 `0`. (c) 매치가 **정확히 1건**이고 그 행이 주석이 아닌 실제 규칙. (d) 세 파일 전원 통과, 실패 0건.

**(c)의 판정 방법**: 매치 행이 주석 안인지 실제 규칙인지는 행 번호를 `@theme` 종료 행과 비교해 판별한다 — 헤더 주석은 `@theme` 선언 행보다 **앞**에 있고 실제 `body` 규칙은 `@theme` 블록 **뒤**에 있다.

```bash
grep -n "^@theme" src/app/globals.css      # 헤더 주석 / 본문 경계
grep -n "body\s*{" src/app/globals.css     # 이 행 번호가 위보다 커야 한다
```

**이 AC가 blocking인 이유**: 세 제약 중 어느 하나라도 위반하면 **주석 산문 때문에 무관한 테스트가 깨진다**. 원인이 값이 아니라 주석 텍스트라는 점이 진단을 어렵게 하므로, 커밋 전에 잡아야 한다(`plan.md` §G M2 게이트).

---

### AC-008 — SPEC-DESIGN-001 §D.1에 표기 존재 + 삽입 지점 정확

**Given** SPEC-DESIGN-001 `plan.md`의 `### §D.1` 표제가 baseline에서 204행, `### §D.1b`가 239행인 상태에서,
**When** M3이 `plan.md` §I 부록 텍스트를 삽입한 뒤 위치를 검사하면,
**Then** 표기가 §D.1 표제 **뒤**, §D.1b 표제 **앞**에 있고, 현재 값이 사는 곳 3곳을 지목해야 한다.

**검증 방법**:

```bash
# (a) 표제 행 번호와 표기 행 번호
grep -n "^### §D.1 Classical" .moai/specs/SPEC-DESIGN-001/plan.md
grep -n "초과 — SUPERSEDED"    .moai/specs/SPEC-DESIGN-001/plan.md
grep -n "^### §D.1b"           .moai/specs/SPEC-DESIGN-001/plan.md

# (b) 표기가 지목해야 하는 3곳
grep -c "SPEC-BRAND-001"  .moai/specs/SPEC-DESIGN-001/plan.md
grep -c "SPEC-DESIGN-002" .moai/specs/SPEC-DESIGN-001/plan.md
grep -c "globals.css"     .moai/specs/SPEC-DESIGN-001/plan.md

# (c) 표제 행 자체가 변경되지 않았는지
git show cfbd320:.moai/specs/SPEC-DESIGN-001/plan.md | grep -c "^### §D.1 Classical 토큰 블록 — 확정 값 (원문 인용, SSOT)$"
grep -c "^### §D.1 Classical 토큰 블록 — 확정 값 (원문 인용, SSOT)$" .moai/specs/SPEC-DESIGN-001/plan.md
```

**PASS 조건**:
- (a) 세 행 번호를 `H`(§D.1 표제) · `M`(표기) · `B`(§D.1b 표제)라 할 때 `H < M < B`. 표기는 정확히 1건.
- (b) 세 grep 모두 `1` 이상.
- (c) 두 값이 **둘 다 `1`** — 표제 행이 baseline과 동일하게 남아 있다. 표제를 바꾸면 이 절을 «§D.1»로 참조하는 다른 문서(`tokens.json` · SPEC-DESIGN-002 §3 · 이 SPEC 자신)의 앵커가 끊긴다.

---

### AC-009 — SPEC-DESIGN-001이 순수 삽입 + frontmatter 무변경

**Given** 이 카드가 SPEC-DESIGN-001에 대해 **표기 추가만** 하기로 사용자 지시로 확정된 상태에서,
**When** baseline `cfbd320` 대비 그 SPEC 디렉터리의 diff를 검사하면,
**Then** 변경 파일이 `plan.md` 하나뿐이고 **삭제된 행이 0**이며 frontmatter가 그대로여야 한다.

**검증 방법**:

```bash
# (a) 변경 파일이 plan.md 하나뿐
git diff --name-only cfbd320 -- .moai/specs/SPEC-DESIGN-001/

# (b) 순수 삽입 — 삭제/수정된 행이 0
git diff cfbd320 -- .moai/specs/SPEC-DESIGN-001/plan.md | grep -c "^-[^-]"

# (c) frontmatter 무변경 (SPEC-DESIGN-001의 status는 그대로 in-progress로 남는다 —
#     spec.md와의 불일치는 이 카드의 범위 밖, plan.md §D.3)
sed -n '1,6p' .moai/specs/SPEC-DESIGN-001/plan.md
git show cfbd320:.moai/specs/SPEC-DESIGN-001/plan.md | sed -n '1,6p'

# (d) spec.md의 status가 completed 그대로인지
grep -n "^status:" .moai/specs/SPEC-DESIGN-001/spec.md

# (e) amendment 흔적이 없는지
grep -c "amendment_of" .moai/specs/SPEC-DESIGN-001/spec.md
grep -c "## Amendments" .moai/specs/SPEC-DESIGN-001/spec.md
```

**PASS 조건**:
- (a) 출력이 정확히 `.moai/specs/SPEC-DESIGN-001/plan.md` 한 줄.
- (b) 정확히 `0`. **이 값이 이 AC의 핵심**이다 — 삭제 행 0건은 기존 값 코드블록·주의 3항목·HISTORY·frontmatter 중 어느 것도 제거되거나 제자리 수정되지 않았음을 한 번에 보증한다(REQ-DESIGN4-009).
- (c) 두 출력이 동일.
- (d) `status: completed`.
- (e) 두 값 모두 `0`.

---

### AC-010 — 변경 파일 정확히 3개 + 품질 게이트 신규 실패 0건

**Given** 이 SPEC이 자신의 산출물 외에 정확히 3개 파일만 건드리기로 한 상태에서,
**When** baseline 대비 변경 파일을 집계하고 품질 게이트를 실행하면,
**Then** 대상 3개 외 변경이 0이고 신규 실패가 0이어야 한다.

**검증 방법**:

```bash
# (a) 대상 3개가 전부 변경되었는지
git diff --name-only cfbd320 -- .moai/design/tokens.json src/app/globals.css .moai/specs/SPEC-DESIGN-001/plan.md
# 기대: 정확히 3줄

# (b) 대상 3개 + 이 SPEC 자신의 산출물 외에 변경이 없는지
git diff --name-only cfbd320 | grep -v "^.moai/specs/SPEC-DESIGN-004/" | grep -v "^.moai/design/tokens.json$" | grep -v "^src/app/globals.css$" | grep -v "^.moai/specs/SPEC-DESIGN-001/plan.md$"
echo "exit=$?"
# 기대: 출력 없음 + exit=1

# (c) src/ 아래에서 globals.css 외에는 아무것도 바뀌지 않았는지 (.tsx 무변경 포함)
#     glob pathspec 대신 디렉터리 pathspec + 필터를 쓴다 — git pathspec의 와일드카드
#     의미(`/` 를 넘어 매치)가 셸 glob과 달라 오독하기 쉽기 때문이다.
git diff --name-only cfbd320 -- src/ | grep -v "^src/app/globals.css$"
echo "exit=$?"
# 기대: 출력 없음 + exit=1

# (c-2) 참고 — src/ 전체 변경 목록이 정확히 globals.css 한 줄인지
git diff --name-only cfbd320 -- src/
# 기대: src/app/globals.css 한 줄만

# (d) 린트
unset MOAI_KANBAN MOAI_KANBAN_ID MOAI_KANBAN_LABEL MOAI_KANBAN_LEAD_ADDR MOAI_KANBAN_SETTINGS_INJECTED && npm run lint

# (e) 타입체크 — 절대 건수가 아니라 src/ 신규 오류 0건으로 판정한다
unset MOAI_KANBAN MOAI_KANBAN_ID MOAI_KANBAN_LABEL MOAI_KANBAN_LEAD_ADDR MOAI_KANBAN_SETTINGS_INJECTED && npm run typecheck 2>&1 | grep -c "^src/"

# (f) 테스트 전량
unset MOAI_KANBAN MOAI_KANBAN_ID MOAI_KANBAN_LABEL MOAI_KANBAN_LEAD_ADDR MOAI_KANBAN_SETTINGS_INJECTED && npm test 2>&1 | tail -6
```

**PASS 조건**:
- (a) 정확히 3줄, 순서 무관.
- (b) 출력 없음 + `exit=1`.
- (c) 출력 없음 + `exit=1`. (c-2) 정확히 `src/app/globals.css` 한 줄.
- (d) 오류 출력 없음.
- (e) 정확히 `0`. `e2e/**`·`playwright.config.ts`의 기존 오류는 이 카드 이전부터 존재하는 baseline이며(SPEC-DESIGN-003 `progress.md` §E.2가 41건으로 실측), 판정 기준은 절대 건수가 아니라 **`src/` 신규 오류 0건**이다.
- (f) 실패 0건. 이 카드는 `.tsx`와 토큰 값을 건드리지 않으므로 baseline 대비 테스트 결과가 달라질 이유가 없다.

---

## §D.1 완료 보고 필수 항목

`progress.md` §E.3 발행 전에 아래를 명시해야 한다:

1. **AC-001 스크립트의 축자 마지막 행** (`checked=39 mismatch=0`) — 요약이 아니라 실제 출력.
2. **AC-006 `diff`의 exit code와 행 수** — `@theme` 이후 무변경의 유일한 증적.
3. **AC-007 (a)(b)(c) 세 값의 축자 출력** — 주석 산문이 테스트를 깨지 않았다는 증적.
4. **AC-009 (b)의 값이 `0`임** — SPEC-DESIGN-001이 순수 삽입이라는 증적.
5. **M3 커밋이 M1·M2와 분리되었음** (`plan.md` §B.5) — 커밋 SHA 3개를 마일스톤별로 열거.
6. **미해소로 남는 후속 카드 3건**: (a) `globals.css` 72행 `@theme` 내부 잔존 주장(`spec.md` §3), (b) `.moai/design/components.json` 재동기화(`spec.md` §3), (c) SPEC-DESIGN-001 본문 전반 재조정 — 카드 t70.

## §D.2 미검증으로 남는 것 (사전 선언)

- **브라우저 렌더 확인을 하지 않는다.** 이 카드는 CSS 커스텀 프로퍼티 값을 한 글자도 바꾸지 않으므로(AC-006) 렌더 결과가 달라질 경로가 없다. 스크린샷 대조는 요구하지 않는다.
- **E2E(Playwright)를 실행하지 않는다.** AC-010은 lint · typecheck · vitest 세 가지만 요구한다. 이 워크트리에 `@playwright/test`가 설치되어 있지 않을 수 있다(SPEC-DESIGN-003 `progress.md` §E.2 기록).
- **`build`를 실행하지 않는다.**
- **DesignSync 라이브 대조를 하지 않는다** (`spec.md` §3 · §2.6).
- **`tokens.json`을 읽는 장래 design-phase 실행을 검증하지 않는다.** `spec.md` §2.6이 기록한 대로 이 파일은 MoAI 하니스의 예약 경로이지만, 이 카드는 파일 내용의 정확성만 보증하고 그것을 소비하는 파이프라인을 실행해 보지는 않는다.
