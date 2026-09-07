# SPEC-DESIGN-002 — 인수 조건

> 각 AC는 이진 판정 가능하다. 판정 근거는 **실제로 실행한 명령의 축자 출력**이며, 추론이나 요약은 증적이 아니다.

---

## §D. AC 매트릭스

| AC | 요약 | 대응 REQ | 심각도 |
|---|---|---|---|
| AC-001 | `#6b6b6b`의 `--color-bg` 대비가 4.5:1 이상 | REQ-DESIGN2-001, REQ-DESIGN2-002 | blocking |
| AC-002 | diff 범위가 `neutral-600` 한 값 + 주석으로 국한 + 교정 값 선언 직접 확인 | REQ-DESIGN2-005, REQ-DESIGN2-001 | blocking |
| AC-003 | 실행 코드에 `#7a7a7a` 잔존 0건 | REQ-DESIGN2-006 | blocking |
| AC-004 | 이탈 근거 주석 존재 | REQ-DESIGN2-004 | blocking |
| AC-005 | 램프 단조성 유지 + surface 회귀 감시 | REQ-DESIGN2-003 | blocking |
| AC-006 | 소비처 `.tsx` 파일 무수정 | REQ-DESIGN2-007 | blocking |

---

### AC-001 — 명도 대비 AA 충족

**Given** `--color-bg`가 `#f2f2f2`이고 `--color-neutral-600`이 `#6b6b6b`으로 교정된 상태에서,
**When** WCAG 2.1 상대 휘도 공식으로 두 색의 명도 대비를 실제로 계산하면,
**Then** 결과가 **4.5:1 이상**이어야 하고, 교정 전 값 `#7a7a7a`는 같은 계산에서 4.5:1 **미만**임이 함께 확인되어야 한다.

**검증 방법**: 아래 스크립트를 저장소 안 임시 경로에 작성해 `node`로 실행하고, 출력 전문을 `progress.md` §E.2에 인용한다. 실행 후 스크립트는 삭제한다(저장소에 남기지 않는다).

```js
function srgb(c) { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
function lum(hex) {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
}
function ratio(a, b) { const la = lum(a), lb = lum(b); const hi = Math.max(la, lb), lo = Math.min(la, lb); return (hi + 0.05) / (lo + 0.05); }
for (const fg of ['#7a7a7a', '#6b6b6b']) {
  const r = ratio(fg, '#f2f2f2');
  console.log(fg + ' on #f2f2f2 => ' + r.toFixed(3) + ':1 ' + (r >= 4.5 ? 'PASS' : 'FAIL'));
}
```

**기대 출력** (plan-phase 사전 측정치 — run-phase에서 재실행해 확인할 것):

```
#7a7a7a on #f2f2f2 => 3.834:1 FAIL
#6b6b6b on #f2f2f2 => 4.760:1 PASS
```

**PASS 조건**: `#6b6b6b` 행이 `PASS`이고 비율이 4.5 이상.

---

### AC-002 — diff 범위 가드 (명시된 회귀 위험)

**Given** 이 SPEC의 초안이 `neutral-400`/`neutral-500`까지 건드릴 뻔했고 세 토큰이 `globals.css` **같은 줄**에 선언되어 있는 상태에서,
**When** `git diff`로 실제 변경 내용을 검사하면,
**Then** `@theme` 블록 안에서 값이 바뀐 토큰은 `--color-neutral-600` **하나뿐**이어야 하고, `--color-neutral-400: #b7b7b7`과 `--color-neutral-500: #989898`은 변경 후에도 원래 값 그대로여야 하며, 변경 파일은 `src/app/globals.css` 단 하나여야 한다.

**검증 방법**:

```bash
# (a) 변경된 파일이 globals.css 하나뿐인지
git diff --name-only

# (b) 변경 후 400/500 값이 보존되었는지 (원래 값 그대로 출력되어야 함)
grep -n "color-neutral-400\|color-neutral-500" src/app/globals.css

# (c) @theme 블록에서 사라진(-) 값 리터럴이 #7a7a7a 하나뿐인지
git diff -U0 src/app/globals.css | grep "^-" | grep -o "#[0-9a-f]\{6\}"

# (d) 새로 추가된(+) 값 리터럴 확인
git diff -U0 src/app/globals.css | grep "^+" | grep -o "#[0-9a-f]\{6\}"

# (e) 교정 값이 실제로 선언되었는지 직접 확인 (REQ-DESIGN2-001 직접 커버)
grep -n "color-neutral-600: #6b6b6b" src/app/globals.css
```

**PASS 조건**:
- (a) `src/app/globals.css` 단일 행
- (b) `#b7b7b7`과 `#989898`이 그대로 존재
- (c) 제거된 리터럴이 `#7a7a7a` **하나뿐**
- (d) 추가된 리터럴이 `#6b6b6b`뿐 (주석 안에 인용된 `#f2f2f2`·`#989898`·`#5e5e5e`·`#7a7a7a`는 설명 문구이므로 별도 식별해 제외 처리하고, 제외한 근거를 §E.2에 명시)
- (e) `@theme` 블록 안의 행 번호를 정확히 1건 반환 (REQ-DESIGN2-001을 판단 단계 없이 직접 판정)

---

### AC-003 — 실행 코드에 구 값 잔존 0건

**Given** 교정이 완료된 상태에서,
**When** 실행 코드 트리 전체에서 리터럴 `#7a7a7a`를 검색하면,
**Then** 일치 건수가 **0**이어야 한다.

**검증 방법**:

```bash
grep -rn "7a7a7a" --include="*.ts" --include="*.tsx" --include="*.css" --include="*.js" src/
echo "exit=$?"
```

**PASS 조건**: 출력 없음 + `exit=1`.

**범위 주의**: `.moai/specs/SPEC-BRAND-001/research.md:147`과 `acceptance.md:69`, 그리고 에이전트 메모리 파일에는 `#7a7a7a`가 **역사적 기록**으로 남는다. 이는 REQ-DESIGN2-006의 대상이 **아니며** 제거하지 않는다. 검색 범위를 `src/`로 한정하는 이유다.

---

### AC-004 — 이탈 근거 주석 존재

**Given** `#6b6b6b`이 SPEC-BRAND-001 REQ-BRAND-008(리터럴 출처는 그 SPEC의 `acceptance.md:69` / `research.md:147`)에서 이탈한 값인 상태에서,
**When** `--color-neutral-600` 선언 주변을 읽으면,
**Then** `t51` 주석과 같은 형식의 주석 블록이 존재하고, 그 안에 (1) `SPEC-DESIGN-002`, (2) `REQ-BRAND-008`, (3) 교정 전 대비 `3.834`, (4) 교정 후 대비 `4.760` 네 요소가 모두 포함되어야 한다.

**검증 방법**:

```bash
grep -n "SPEC-DESIGN-002" src/app/globals.css
grep -n "REQ-BRAND-008" src/app/globals.css
grep -n "3.834" src/app/globals.css
grep -n "4.760" src/app/globals.css
```

**PASS 조건**: 네 명령 모두 최소 1건의 행 번호를 반환하고, 그 행이 모두 `@theme` 블록 안에 있을 것. 블록 경계는 하드코딩하지 말고 실행 시점에 확인한다 — 주석 삽입으로 블록 종료 행이 밀리므로 고정 상수는 취약하다:

```bash
# @theme 블록의 실제 시작/종료 행을 먼저 확인한 뒤 위 네 grep 결과와 대조.
# `@theme`는 상단 헤더 주석에도 등장하므로(7·19행) 반드시 행 시작에 앵커한다.
awk '/^@theme[[:space:]]*\{/{s=NR} s&&/^\}/{print "theme block: "s"-"NR; exit}' src/app/globals.css
```

---

### AC-005 — 램프 단조성 + surface 회귀 감시 (전방 검사)

**Given** `--color-neutral-600`이 `#6b6b6b`으로 바뀐 상태에서,
**When** `neutral-100`부터 `neutral-900`까지 상대 휘도를 계산하고, 동시에 `bg-surface` 영역에 `text-neutral-600` 소비처가 새로 생겼는지 검사하면,
**Then** 휘도가 100→900 방향으로 **엄격히 단조 감소**해야 하고, `bg-surface`를 쓰는 컴포넌트 중 `neutral-600`을 사용하는 파일은 **0건**이어야 한다.

**검증 방법**:

**(a) 램프 단조성** — 아래 스크립트를 저장소 안 임시 경로에 작성해 `node`로 실행하고, 출력 전문을 `progress.md` §E.2에 인용한다. 실행 후 스크립트는 삭제한다(저장소에 남기지 않는다). AC-001의 스크립트는 2색(`#7a7a7a`, `#6b6b6b`)만 순회하므로 단조성 판정을 낼 수 없다 — 이것은 9단계 전 구간을 독립적으로 계산하는 별도 스크립트다.

```js
function srgb(c) { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
function lum(hex) {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
}
const ramp = [
  ['100', '#f5f5f5'], ['200', '#e8e8e8'], ['300', '#d4d4d4'],
  ['400', '#b7b7b7'], ['500', '#989898'], ['600', '#6b6b6b'],
  ['700', '#5e5e5e'], ['800', '#424242'], ['900', '#2b2b2b'],
];
const ls = ramp.map(function (e) { const L = lum(e[1]); console.log(e[0] + ' ' + e[1] + ' L=' + L.toFixed(4)); return L; });
let mono = true;
for (let i = 1; i < ls.length; i++) { if (!(ls[i] < ls[i - 1])) mono = false; }
console.log('monotonic: ' + mono);
console.log('all distinct: ' + (new Set(ls).size === ls.length));
```

**기대 출력** (plan-phase 사전 측정치 — run-phase에서 재실행해 확인할 것):

```
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

**(b)-(c) surface 회귀 감시**:

```bash
# (b) bg-surface 소비처 열거
grep -rln "bg-surface" --include="*.tsx" src/

# (c) 열거된 각 파일이 neutral-600을 쓰지 않는지
grep -n "neutral-600" $(grep -rln "bg-surface" --include="*.tsx" src/)
echo "exit=$?"
```

**PASS 조건**:
- (a) `monotonic: true` 및 `all distinct: true`, 그리고 `neutral-600`(L=0.1470)이 `neutral-500`(L=0.3140)과 `neutral-700`(L=0.1119) 사이
- (c) 출력 없음 + `exit=1`

**이 검사가 존재하는 이유**: `#6b6b6b`은 `--color-surface`(`#e9e9e9`) 위에서 4.389:1로 AA에 미달한다(spec.md §3). 현재는 해당 조합이 도달 불가능하지만, 나중에 누군가 `bg-surface` 카드 안에 `text-neutral-600` 본문을 넣으면 조용히 미달 상태가 생긴다. (c)는 그 순간을 잡는 회귀 검사다.

---

### AC-006 — 소비처 파일 무수정

**Given** `text-neutral-600` 소비처가 17개 `.tsx` 파일에 걸쳐 있는 상태에서,
**When** 변경 목록을 확인하면,
**Then** `src/**/*.tsx` 파일이 **한 건도** 변경되지 않아야 한다.

**검증 방법**:

```bash
git diff --name-only | grep "\.tsx$"
echo "exit=$?"
```

**PASS 조건**: 출력 없음 + `exit=1`.

---

## §D.1 엣지 케이스

| 케이스 | 처리 |
|---|---|
| `#6b6b6b`이 `--color-accent-500`과 값이 같음 | **의도된 것**. 새 색을 도입하지 않기 위한 선택(spec.md §1.3). 두 토큰은 이름이 다르므로 용도 분리는 유지된다 |
| 주석 안에 인용된 색 리터럴이 AC-002 (d) 검사에 잡힘 | 주석/선언을 구분해 판정하고 근거를 §E.2에 명시 |
| `neutral-600`이 테두리(`border-neutral-600`)에 쓰인 경우 | **현재 0건** — 소비처 36건은 전부 `text-neutral-600`이다(spec.md §2.1 측정). 장래 `border-neutral-600`이 도입될 경우에만 적용되며, 그때도 AA 4.5:1은 텍스트 기준이므로 미적용이고 교정은 대비를 개선시키므로 회귀 없음 |
| REQ-BRAND-008로부터 이탈하고 `SPEC-BRAND-001/acceptance.md:69`가 거짓이 됨 | 인지된 결과(spec.md §4-3). 이탈 대상은 완료된 SPEC의 현행 요구사항이며 `acceptance.md:69`는 그 다운스트림 결과다. BRAND-001은 `completed`이고 이 카드는 `completed → in-progress (amendment)` 전이를 개시하지 않으므로 소급 수정하지 않는다. BRAND-001 쪽 기록은 후속 카드 권고 4번이 담당한다 |

---

## §D.2 품질 게이트

- 빌드 통과 (`npm run build` 또는 프로젝트 표준 빌드 명령)
- 린트 통과
- 기존 테스트 스위트 회귀 0건

CSS 커스텀 프로퍼티 값 변경이므로 신규 테스트는 추가하지 않는다. 검증은 AC-001..AC-006의 명령 기반 판정이 담당한다.

---

## §D.3 Definition of Done

- [ ] AC-001 ~ AC-006 전부 PASS, 각 판정의 축자 명령 출력이 `progress.md` §E.2에 인용됨
- [ ] `src/app/globals.css` 단일 파일 변경
- [ ] `.moai/design/tokens.json` 무변경 (범위 제외 준수 확인)
- [ ] `globals.css` 4-11행 헤더 주석 무변경 (범위 제외 준수 확인)
- [ ] 빌드·린트·테스트 통과
- [ ] 후속 카드 권고 4건(`tokens.json` 재동기화 · 헤더 주석 재작성 · `text-neutral-500` 소비처 17개 지점 교체 · SPEC-BRAND-001 amendment 검토 — spec.md §4.1)이 완료 보고에 명시됨
