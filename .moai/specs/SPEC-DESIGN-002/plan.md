# SPEC-DESIGN-002 — 구현 계획

> `spec.md`가 SSOT. 이 문서는 파생 산출물이며 요구사항을 재정의하지 않는다.

---

## §A. 맥락

카드 t62. 단일 CSS 커스텀 프로퍼티 값 하나를 교정하고, 그 이탈을 기록하는 주석 하나를 추가한다. 변경 파일 1개, 변경 라인 1줄 + 주석 블록.

이 카드의 초안은 `neutral-400/500/600` 3단계 warm 값 복원을 계획했으나, 선행 조사가 그 전제를 반증했다(§B.1). 아래 계획은 **반증 이후 축소된 범위**를 반영한다.

---

## §B. 알려진 이슈 / 반증된 전제

### B.1 반증된 최초 전제 (기록)

| 최초 주장 | 실제 |
|---|---|
| `neutral-400/500/600`이 실수로 achromatic하게 평탄화됨 | SPEC-BRAND-001 REQ-BRAND-008이 **의도적으로** 저작한 OUR 그레이스케일 팔레트 |
| `.moai/design/tokens.json`이 SSOT | `tokens.json`은 BRAND-001 이전 Classical 팔레트로 **전면 노후화**됨. 런타임 소비처 0건 |
| `globals.css` 헤더 주석의 "plan.md §D.1과 바이트 동일"이 참 | BRAND-001 이후 **거짓** |

**측정 근거**:

```
$ git log -L 53,53:src/app/globals.css --oneline --no-patch
b1c2862 feat(SPEC-BRAND-001): 우리샵 → OUR 브랜드 전환 (#32)
e8c4ef3 feat(SPEC-DESIGN-001): 공통 디자인 토큰 체계 수립과 전체 사이트 반영 (#28)
```

가장 최근 저작 커밋이 `b1c2862`(BRAND-001)이므로 현행 값의 소유 SPEC은 BRAND-001이다.

**결론**: 복원(restore)은 폐기. 교정(fix)만 수행한다.

### B.2 이 SPEC이 만드는 이탈

`#6b6b6b`은 REQ-BRAND-008이 규정하고 `SPEC-BRAND-001/acceptance.md:69`·`research.md:147`이 리터럴로 못 박은 `#7a7a7a`와 다르다. 이는 **완료된 SPEC의 현행 요구사항(REQ-BRAND-008)으로부터의 의도적 이탈**이며, `acceptance.md:69`가 거짓이 되는 것은 그 다운스트림 결과다(spec.md §4-3). REQ-DESIGN2-004가 요구하는 주석이 이탈 근거를 코드 옆에 남기지만 이는 완화책이며, BRAND-001 쪽 기록 부재는 후속 카드 권고 4번(BRAND-001 amendment 검토, spec.md §4.1)이 닫는다. 이 카드는 BRAND-001에 대해 `completed → in-progress (amendment)` 전이를 개시하지 않는다.

---

## §C. 사전 확인 (Pre-flight)

착수 전 아래를 실행하고 출력을 인용한다.

```bash
# 1. 현재 값 확인
grep -n "color-neutral-600" src/app/globals.css

# 2. bg-surface 소비처가 여전히 2곳이고 neutral-600을 쓰지 않는지 재확인
grep -rn "bg-surface" --include="*.tsx" src/
grep -n "neutral-600" src/components/layout/SiteHeader.tsx src/components/product/ProductCard.tsx

# 3. 소비처 총량 확인
grep -rn "neutral-600" --include="*.tsx" --include="*.ts" --include="*.css" src/ | wc -l
```

---

## §D. 제약

1. `@theme` 블록에서 `--color-neutral-600` **한 값**만 바뀐다. 다른 토큰은 불변(REQ-DESIGN2-005).
2. `.moai/design/tokens.json`, `.moai/specs/SPEC-DESIGN-001/plan.md`, `globals.css` 4-11행 헤더 주석은 **건드리지 않는다**(spec.md §3).
3. 소비처 `.tsx` 파일 0건 수정(REQ-DESIGN2-007).
4. 추가 주석은 파일 내 `t51` 주석(58-66행)의 형식·어조를 따른다.

---

## §E. 자기 검증

`acceptance.md` §D의 AC-001..AC-006을 실행하고 각 명령의 축자 출력을 `progress.md` §E.2에 기록한다.

---

## §F. 마일스톤

> **가변성 높은 결정을 먼저.** M1이 유일하게 판단이 개입하는 단계이고, M2·M3은 기계적이다.

### M1 — 토큰 값 교정 + 이탈 주석 (유일한 판단 지점)

**대상**: `src/app/globals.css`

**변경 1 — 값 교정 (53행)**

```diff
-  --color-neutral-400: #b7b7b7; --color-neutral-500: #989898; --color-neutral-600: #7a7a7a;
+  --color-neutral-400: #b7b7b7; --color-neutral-500: #989898; --color-neutral-600: #6b6b6b;
```

같은 줄의 `neutral-400`·`neutral-500`은 **글자 하나 바뀌지 않는다**. 한 줄에 세 선언이 모여 있으므로 diff 한 줄이 곧 세 토큰을 포함한다 — 이것이 acceptance AC-002가 diff 범위를 별도로 검사하는 이유다.

**변경 2 — 이탈 주석 (53행 바로 앞에 삽입)**

`t51` 주석과 같은 형식. 삽입 문안:

```css
  /* SPEC-DESIGN-002 (카드 t62, 2026-09-07) — `--color-neutral-600`은 이 한 값
   * 만 SPEC-BRAND-001 REQ-BRAND-008에서 의도적으로 이탈한다. REQ-BRAND-008은
   * 램프 전체가 OUR 팔레트와 일치할 것을 참조로 규정하며, 이 단계의 리터럴
   * `#7a7a7a`는 그 SPEC의 acceptance.md:69 / research.md:147에 못 박혀 있다.
   * 사유: `#7a7a7a`는 `--color-bg`(#f2f2f2) 위에서 명도 대비 3.834:1로 WCAG
   * 2.1 AA 일반 텍스트 기준(4.5:1)에 미달하며, 이 토큰은 `text-neutral-600`
   * 으로 본문 보조 텍스트에 광범위하게 쓰인다. `#6b6b6b`은 4.760:1로 AA를
   * 충족하고, 완전 achromatic이며(R=G=B), neutral-500(#989898)과
   * neutral-700(#5e5e5e) 사이에서 램프 휘도 단조성을 유지하고, 같은 블록의
   * `--color-accent-500`으로 이미 존재하므로 새 색을 도입하지 않는다.
   * 나머지 `--color-neutral-*` / `--color-accent-*` 단계는 REQ-BRAND-008의
   * 값 그대로다. */
```

**판단이 개입하는 지점**: 이탈 주석의 존재 자체와 그 문안. 값(`#6b6b6b`)은 §1.3의 3가지 제약(achromatic·단조성·기존 색 재사용)이 사실상 유일하게 지정한다.

### M2 — 검증 (기계적)

`acceptance.md` §D의 AC-001..AC-006을 순서대로 실행하고 축자 출력을 수집한다. AC-006(소비처 `.tsx` 무수정)은 REQ-DESIGN2-007의 유일한 커버 AC이므로 생략할 수 없다.

### M3 — 증적 기록 (기계적)

`progress.md` §E.2에 M2 출력을 기록하고 §E.3 audit-ready 신호를 작성한다.

---

## §G. 안티패턴 (하지 말 것)

| 안티패턴 | 왜 금지인가 |
|---|---|
| `neutral-400`/`neutral-500`도 "겸사겸사" 손보기 | 토큰 값 변경은 REQ-BRAND-008 되돌림이며, 이 카드의 원래 오진이 정확히 이것이었다. `neutral-500`에 실재하는 AA 미달(17건/10파일, 2.577:1 — spec.md §3)이 확인되어 있으나 그 해소는 **소비처 교체** 성격의 별도 카드 몫이다(spec.md §4.1 권고 3번). 여기서 손대면 diff 범위 가드(AC-002)가 무의미해진다 |
| `tokens.json`을 이 값 하나만 고쳐서 "동기화" | 나머지 팔레트 전체가 여전히 노후화 상태 — 부분 동기화는 더 헷갈리는 상태를 만든다 |
| 4-11행 헤더 주석 전면 재작성 | 범위 초과(spec.md §3). 국소 주석 추가로 충분 |
| surface 대비 4.389:1을 위해 값을 더 어둡게 | 도달 불가능한 조합. `neutral-700`과의 간격만 좁아진다 |
| 소비처 `.tsx`에 명시적 색상 하드코딩 | 토큰 체계의 존재 이유를 무효화한다 |

---

## §H. 상호 참조

- `spec.md` — 요구사항 SSOT
- `acceptance.md` — AC 및 검증 명령
- `.moai/specs/SPEC-BRAND-001/spec.md` REQ-BRAND-008
- `src/app/globals.css:58-66` — `t51` 주석(형식 선례)
