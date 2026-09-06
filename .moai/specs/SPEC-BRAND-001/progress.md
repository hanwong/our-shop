# SPEC-BRAND-001 — 진행 기록

## Phase 1 SKIP Rationale

Phase 1(별도 정찰 라운드)을 생략한다. 오케스트레이터 세션이 이미 정찰을 수행했고, manager-spec이 **그 주장들을 직접 재검증**했다. 재검증 결과는 `research.md` §5에 명령·관찰 결과와 함께 고정되어 있다.

**직접 재검증한 항목** (`research.md` §5 전문):

| 주장 | 결과 |
|---|---|
| `SPEC-BRAND-001` ID 충돌 없음 | 확인 — `.moai/specs/` 24개 중 BRAND 없음 |
| `SPEC-STOREFRONT-003` 재사용 금지 | 확인 — 이미 존재 (별개의 완료된 SPEC) |
| `public/` 부재 | 확인 |
| `SiteHeader`가 세션 분기만 렌더링 | 확인 |
| 헤더가 `(shop)/layout.tsx`에만 존재 | 확인 |
| `Product`/`Category` 도메인 중립 | 확인 — 마이그레이션 불필요 |
| `listProducts`가 category/sort 지원 | 확인 |
| 제품 시드 스크립트 부재 | 확인 |
| 브랜드 문자열 표면 4곳 | 확인 |
| JWT 상수 참조가 `jwt.ts` 내부뿐 | 확인 |
| `product.md` 낡음 | 확인 |

**브리핑 전제 대비 정정 2건** (`research.md` §5.1):

1. `next/image`는 **이미 사용 중**(`ProductCard.tsx:1`, `ProductGallery.tsx:3`) — 그린필드 아님.
2. `.plate` 클래스는 `globals.css`에 **존재하지 않음** — M2에서 수정이 아니라 신규 추가.

**SPEC ID 사전 검증** (실행된 Bash, 축자 출력):

```
$ ID="SPEC-BRAND-001"; [[ "$ID" =~ ^SPEC(-[A-Z][A-Z0-9]*)+-[0-9]{3}$ ]] && echo PASS || echo FAIL
PASS
```

---

## 라우팅 지시 — Conditional Design Route

⚠️ **이 SPEC은 UI 노출 SPEC이므로 `plan → design → run` 경로를 탄다.**

plan-audit PASS(임계값 0.85) + Implementation Kickoff Approval 이후, **run-phase로 직행하지 말고** design phase(`manager-design`, D1-D5)로 라우팅한다.

design phase는 라이브 Claude Design 프로젝트 **"OUR"**(`projectId: aa1263c0-57a7-4d65-8670-f5cb5e9daae7`)를 재조회하여 토큰·에셋 충실도를 확정한다. 지시서는 `design.md`이며, 차단 항목은 `research.md` §8의 미확보 5건이다.

**미확보 항목이 해소되지 않은 채 run-phase에 진입하면 M2(토큰 램프)와 M4(제품 시드)가 추정값으로 채워진다** — `design.md` §5의 종료 조건이 이를 막는다.

---

## plan-audit 이력

### iter1 — **FAIL 0.81** (Tier L 임계 0.85), 2026-09-07

보고서: `.moai/reports/plan-audit/SPEC-BRAND-001-2026-09-07.md`

**must-pass 7건 전부 PASS.** M1/M4/M6의 전방 포인터가 위장된 미해결-명료화 마커가 아니라 정당한 미확보 표시임이 확인되었다(마커 리터럴은 grep 게이트가 단순 부분문자열로 탐지하므로 이 문서에 적지 않는다). 지적 14건(major 8 / minor 2 / optional 4)은 전부 **결속·정합·귀속 층**에 몰려 있었다 — 요구사항이 없다가 아니라, 있는 요구사항이 변경분을 다 덮지 못하거나 참조가 어긋나 있었다.

| ID | 등급 | 내용 | 처리 |
|---|---|---|---|
| D1 | major | `research.md` §4.2의 `accent-2` 증거 블록이 실제 grep 출력과 불일치 | ⚠️ **iter1에서 누락** → iter2가 적발 → **iter3에서 완료**(아래 iter2 절) |
| D8 | major | AC 25/25로 신규 AC 자리 없음 | ✅ 상보 쌍 2건 병합(§F) — 검증 손실 0 |
| D6 | major | shadow/divider 기준색 변경이 REQ/AC 미결속 | ✅ REQ-008 열거 완성 + AC-009 신설 |
| D7 | major | `Category` 파생 주장이 미검증 | ✅ REQ-014 열거 완성 + AC-016 신설(행 추가·제거 실검증) |
| D2 | major | PRESERVE 표 AC 참조 오류 | ✅ 전수 재대조 — **6행 중 4행 오류**(보고서 집계 3행보다 1건 많음), 표에 재검증 경고 추가 |
| D4 | major | `design.md` §3.3이 카테고리 3개로 자기모순 | ✅ 4개로 수정 + 개수 유연 배치 지시 |
| D9 | major | 증거 등급 오귀속 | ✅ `[전사 제공]` 신설, **9개 절 재분류**(보고서가 지목한 3개보다 많음 — 같은 오귀속이 다른 절에도 있었다) |
| D10 | major | 시로코→더비가 대립 가설 미검토 | ✅ 옥스퍼드 가설 명시, 잠정 표시, `design.md` §2.6 + §5 체크리스트 승격 |
| D3 | minor | §3의 `/staff` 참조 번호 오류 | ✅ REQ-013 / AC-013으로 정정 (보고서는 "AC-012"라 했으나 실제로는 **REQ** 참조였다) |
| D5 | minor | §6 완료 조건이 REQ-024 누락 | ✅ `001~024`로 수정 |
| D11 | optional | GEARS 라벨 부정확 | ✅ REQ-021을 `event-driven`으로 정정(재실행은 정상 트리거이지 이상 조건이 아니다) |
| D12 | optional | REQ 순서 | ✅ 이전 반복에서 이미 정정 |
| D13 | optional | M4 REQ 열거가 024 누락 | ✅ 추가 |
| D14 | optional | `product.md` 전방 포인터가 발화하지 않을 수 있음 | ✅ `git log` 직접 확인 — 커밋 1개(스캐폴드)뿐. 백로그 카드 생성으로 승격 |

**보고서보다 넓게 고친 3건** (같은 결함 유형이 지목되지 않은 곳에도 있었다): D2는 3→4행, D9는 3→9절, D3는 AC가 아니라 REQ 참조였다.

**그러나 1건은 아예 빠뜨렸다 — D1.** 위 표는 최초 작성 시 **13행뿐**이었다(14건 중 D1 행이 없었다). 지적을 표로 옮기는 단계에서 누락되었고, 그 결과 "14건 전량 반영"이라는 요약이 검증 없이 작성되었다. 표의 행 수를 지적 건수와 대조했다면 즉시 드러났을 불일치다.

### iter2 — **FAIL** (점수 0.94, 계약 위반), 2026-09-07

점수는 임계 0.85를 넘었으나 **D1 미수정**으로 계약 FAIL. 결함의 성격이 중요하다:

**v0.3.0에서 §4.2의 *결론 산문*은 고쳤지만, 바로 아래 *증거 블록*은 iter1과 바이트 동일하게 남겨 두었다.** 결론과 근거가 분리된 채 결론만 갱신된 상태 — SPEC-ORDER-004 iter2와 같은 유형이다.

낡은 블록의 실제 문제:

| | 낡은 블록 | 실제 |
|---|---|---|
| 명령 | `grep -n "accent-2" src/app/globals.css` | 동일 |
| 기록된 출력 | 1줄 (L50) | **2줄** — L50 평면 토큰 + **L55 `--color-accent-200` 내부의 부분 문자열** |

L55는 `accent` 램프의 일원이지 `accent-2` 램프가 아니다. 즉 이 명령은 "`accent-2` 램프가 없다"는 주장의 근거로 **부적합**했다 — 부분 문자열 잡음이 결론을 흐린다.

### iter3 — D1 수정 (단일 항목), 2026-09-07

- 명령을 **`grep -c 'accent-2-'`**(하이픈까지 포함한 램프 접두사)로 교체. 출력 `0` — 램프 부재의 직접 증명이며 부분 문자열 잡음이 없다.
- **이 세션에서 두 명령을 모두 재실행하여 출력을 직접 관찰**한 뒤 절 헤더를 `[확인됨 — manager-spec이 plan-audit iter3에서 재실행 후 관찰]`로 정정했다. 이전 헤더의 `(이 세션에서 직접 검증)`은 낡은 블록에 대해서는 사실이 아니었다.
- 왜 낡은 패턴이 부적합한지를 블록 안에 인용 주석으로 남겨, 미래에 누군가 `grep -n "accent-2"`로 되돌리지 않도록 했다.
- **같은 절의 폰트 증거 블록(L67/L69)도 함께 재실행 검증** — 정확했다(수정 불필요). 지적되지 않았지만 같은 결함 유형이 있을 수 있어 확인했다.
- `spec.md` HISTORY v0.3.0의 "14건 전량 반영" 주장을 **"14건 중 13건 반영, D1 미완"**으로 정정. 로그가 실제보다 과장되지 않도록 한다.

**최종 예산**: REQ **24**/25 (1칸 여유) · AC **25**/25 (**여유 0**). AC 상한 도달 상태이며, 추가 완충이 필요하면 M7 분리가 설계된 방출 밸브다(`acceptance.md` §F).

---

## §E.1 Plan-phase Audit-Ready Signal

```yaml
spec_id: SPEC-BRAND-001
phase: plan
tier: L
status: audit-ready
artifacts:
  - .moai/specs/SPEC-BRAND-001/spec.md
  - .moai/specs/SPEC-BRAND-001/plan.md
  - .moai/specs/SPEC-BRAND-001/acceptance.md
  - .moai/specs/SPEC-BRAND-001/design.md
  - .moai/specs/SPEC-BRAND-001/research.md
  - .moai/specs/SPEC-BRAND-001/progress.md
counts:
  requirements: 24   # ceiling 25 — 1칸 여유
  acceptance_criteria: 25   # ceiling 25 — 여유 0 (완충 밸브: M7 분리, acceptance.md §F)
  milestones: 9      # M0-M8
traceability: complete   # REQ-BRAND-001..024 전부 최소 1개 AC(또는 특정 절) 대응 (acceptance.md §D)
unresolved_clarifications: 0
notation: GEARS
route: conditional-design   # plan → design → run
audit_history:
  - iter: 1
    verdict: FAIL
    score: 0.81      # Tier L 임계 0.85
    findings: 14     # major 8 / minor 2 / optional 4
    disposition: 13-of-14-addressed   # D1 누락 — iter2가 적발
  - iter: 2
    verdict: FAIL    # 점수는 임계 초과, 계약 위반으로 FAIL
    score: 0.94
    findings: 1      # D1 미수정 (research.md §4.2 증거 블록이 iter1과 바이트 동일)
    disposition: addressed-in-iter3
  - iter: 3
    verdict: PASS
    score: 0.94      # Tier L 임계 0.85 초과
    scope: D1-only
    disposition: addressed   # 명령 교체 + 재실행 관찰 + 헤더 정정 + HISTORY 과장 정정
next_gate: Implementation Kickoff Approval → design phase(D1-D5, design.md §5 차단 항목 4건)
```

**감사자를 위한 주의 사항**:

- **2026-09-07 갱신**: 오케스트레이터의 추가 축자 전사로 미확보 2건(제품 부제·가격, 팔레트 램프)이 해소되었다. **M2(토큰) 차단 해제**, M1·M4·M6는 여전히 차단(`research.md` §8).
- 남은 `[미확보]` 표시는 **결함이 아니라 의도적 공백**이다: 제품 이미지 경로, 카테고리 slug, 로고 픽셀 팔레트, `/story` 카피. 추정하지 않고 design phase 차단 항목으로 넘겼다(`design.md` §2·§5).
- **전사 함정 2건을 검증했다**(`research.md` §4.2). 원천 `styles.css`를 통째로 복사하면 ① `--color-accent-2-*` 램프 9개가 추가되어 REQ-BRAND-007을 위반하고, ② 폰트 리터럴이 t51 승인 수정(`var(--font-*-nf)`)을 무효화한다. 둘 다 `grep`으로 코드베이스 현황을 직접 확인했다. AC-BRAND-007이 양쪽을 이진 단언한다.
- **합성 데이터 판정**: 목업의 사이즈 범위 문자열은 `i % 3` 인덱스 파생 채움값이다. 시드 금지를 REQ-BRAND-024로 명문화했다(`research.md` §3.3). 브랜드 카피("285mm부터")와도 모순되며, 이 모순 자체가 합성 판정의 정황이다.
- `plan.md` §B.1(사이즈 UI 마일스톤 M7)은 위임 지시의 마일스톤 열거에 없었고 **추론하여 추가**했다 — 오케스트레이터가 2026-09-07에 이 추론이 옳다고 확인했다. 유지.
- `plan.md` §B.7(카테고리 모호 2건)은 **비대칭 판단**이다: 시로코→더비(토 스타일은 카테고리와 직교), 하야마→몽크 신설(잠금 방식은 더비와 상호 배타). 4번째 카테고리는 목업의 3-버튼 필터와 어긋나므로 design phase 확인 대상(`design.md` §3.5).
- **AC 25건은 Tier L 상한과 정확히 일치한다.** REQ-BRAND-024는 새 AC를 만들지 않고 AC-BRAND-020에 2번째 절로 접었다. 추가 AC가 필요하면 기존 항목 병합이 선행되어야 한다.

---

## §E.2 Run-phase Evidence

_<pending run-phase>_

---

## §E.3 Run-phase Audit-Ready Signal

_<pending run-phase>_

---

## §E.4 Sync-phase Audit-Ready Signal

_<pending sync-phase>_
