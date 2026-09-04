# Card t20 — AC-AUTH-005 로그인 타이밍 테스트 pre-commit 게이트 상시 차단

Class B (원인 미확정 결함) — `plan` 생략, `run`이 원인 규명 + 수정 둘 다 담당.
대상 파일: `tests/integration/auth/login.test.ts` (테스트 파일만 수정, 프로덕션 코드·보안 로직 무변경).

## 1. Claim (주장)

`AC-AUTH-005` 테스트가 전체 스위트/커버리지 실행 시 3가지 양상(타이밍 단언 실패, 30초 타임아웃, Postgres 데드락 동시 관측)으로 간헐 실패해 pre-commit 게이트를 상시 차단하던 문제를, 테스트 파일 내부의 두 가지 수정(측정 방식 인터리빙 + 타임아웃 상향)만으로 해결했다. `SAMPLE_SIZE`(N=30, acceptance.md AC-AUTH-005 요구사항)와 허용오차 공식은 변경하지 않았고, 로그인 핸들러·bcrypt cost factor 등 보안 관련 프로덕션 코드는 전혀 건드리지 않았다.

## 2. Evidence (증거)

### 원인 규명 — 고립 실행 (수정 전, 기준선)

```
$ npx vitest run tests/integration/auth/login.test.ts
[AC-AUTH-005] median(nonexistent-email)=366.78ms median(wrong-password)=369.48ms diff=2.71ms tolerance=55.42ms
 ✓ tests/integration/auth/login.test.ts (1 test) 24053ms
```

고립 실행 자체는 통과하지만, 30초 타임아웃 대비 24초 — 여유가 20%뿐이다(카드 노트의 "22~24초, 여유 26%"와 일치).

### 원인 규명 — 전체 스위트 실행 (수정 전, 실패 재현)

```
$ npm test
FAIL tests/integration/auth/login.test.ts
AssertionError: expected 847.630374999997 to be less than 184.21329690000002
FAIL tests/unit/api/auth/login.test.ts > ... AC-AUTH-021 ... (별개 카드 t33 — 무관)
Test Files  2 failed | 100 passed (102)
```

diff가 847.63ms까지 치솟아 허용오차(184.21ms)의 4.6배를 초과 — 순수 bcrypt cost-12 개별 호출 지터만으로는 설명할 수 없는 크기다.

### 근본 원인 판정

두 원인이 복합적으로 작용한다:

1. **여유 부족(margin)**: 60회 순차 실제 bcrypt(cost 12) 호출이 고립 상태에서도 22~24초 걸려, 30초 타임아웃 대비 여유가 거의 없다. 전체 스위트/커버리지 실행 시 다른 테스트 프로세스와의 CPU 경합이 각 bcrypt 호출을 느리고 불안정하게 만들어 타임아웃을 유발한다.
2. **블록 설계로 인한 시간축 교란(confound)** — 이것이 847ms 급등의 실질적 원인이다: 기존 코드는 "이메일 없음" 30회를 전부 먼저 측정한 뒤 "비밀번호 오류" 30회를 나중에 측정하는 **블록(block) 구조**였다. 전체 스위트 실행 중 배경 부하는 테스트 진행 시간(약 24초 이상) 동안 일정하지 않으므로, 두 블록이 서로 다른 부하 구간에 걸리면 로그인 핸들러의 실제 타이밍-안전성과 무관하게 그룹 간 중앙값 차이가 인위적으로 벌어진다. 이는 타이밍 사이드채널 측정에서 알려진 전형적 함정이며, 표준 대응은 두 조건을 **교차 측정(interleave)**하는 것이다.

**"증상이 아니라 원인인가?" 재검토(Rule 4)**: 인터리빙 수정만으로(허용오차·N·프로덕션 코드 무변경) 반복적인 고부하 전체 스위트 실행에서 통과함을 아래에서 직접 관측했다 — 원인 판정이 정확했음을 시사한다.

### 수정 (테스트 파일만)

- `tests/integration/auth/login.test.ts`: 두 개의 순차 블록 루프를 하나의 교차(interleaved) 루프로 교체 — 매 반복마다 "이메일 없음" 1회 → "비밀번호 오류" 1회를 연속 측정. `SAMPLE_SIZE=30`(N≥30, acceptance.md 요구사항) 유지, 허용오차 공식 무변경.
- 개별 테스트 타임아웃: `30000` → `90000`ms — 24초 고립 실행 기준 20% 여유는 여전히 타임아웃 취약점이라 판단, 전체 스위트 고부하 상태에서도 안전한 여유를 확보.

### 수정 후 검증 — 고립 실행

```
$ npx vitest run tests/integration/auth/login.test.ts
[AC-AUTH-005] median(nonexistent-email)=363.87ms median(wrong-password)=364.34ms diff=0.47ms tolerance=54.65ms
 ✓ (1 test) 22678ms
```

### 수정 후 검증 — 전체 스위트 (고부하 상태, 2회 연속)

```
$ npm test   (1회차)
[AC-AUTH-005] median(nonexistent-email)=768.59ms median(wrong-password)=833.39ms diff=64.79ms tolerance=125.01ms
 ✓ tests/integration/auth/login.test.ts (1 test) 48418ms
 Test Files  1 failed | 101 passed (102)   ← 실패 1건은 AC-AUTH-021(t33), 이 카드와 무관

$ npm test   (2회차)
[AC-AUTH-005] median(nonexistent-email)=838.84ms median(wrong-password)=829.51ms diff=9.33ms tolerance=125.83ms
 ✓ tests/integration/auth/login.test.ts (1 test) 52804ms
 Test Files  1 failed | 101 passed (102)   ← 실패 1건은 AC-AUTH-021(t33), 이 카드와 무관
```

두 실행 모두 개별 호출 시간이 기준선(~366ms) 대비 2배 이상(768~838ms)으로 치솟을 만큼 시스템이 실제로 고부하 상태였음에도(AC-AUTH-021이 두 번 다 타임아웃한 것이 방증), AC-AUTH-005는 두 번 다 여유 있게 통과했다(diff가 tolerance의 절반 이하).

### 정적 검증

```
$ npx tsc --noEmit   → exit 0
$ npm run lint       → exit 0, 신규 이슈 0건
```

## 3. Baseline-attribution (baseline 귀속)

- 커맨드: 위 각 블록에 명시된 정확한 커맨드
- 관측 시점/트리: `.claude/worktrees/t20` (브랜치 `WT-auth-timing-flake`), 이 세션에서 직접 실행·관측 — 과거 실행의 수치를 재사용하지 않았다.
- 카드 노트에 인용된 과거 수치(54ms→91.68ms, 5회+ 재현)는 이 세션이 관측한 것이 아니라 카드 자체의 이력 서술이며, 이 보고서의 Evidence 섹션은 전부 이 세션에서 새로 측정한 값이다.

## 4. Gaps (미검증)

- **Postgres 데드락 증상(카드 노트 증상 3)**: 이 세션에서는 재현하지 못했다(이 테스트 자체는 `@/lib/db`를 모킹해 실제 Postgres를 건드리지 않는다 — 데드락은 `concurrency.postgres.test.ts` 등 별도 파일이 같은 고부하 전체 스위트 실행 중 겪는 별개 증상으로 추정되며, 이 세션에서 직접 관측·검증하지 않았다).
- 전체 스위트를 2회만 반복했다 — 과거 이력이 "5회+ 독립 재현"이라 밝힌 만큼, 이 수정이 확률을 0으로 만든다는 보장은 아니다(아래 잔여 위험 참고).
- CI 환경(로컬 머신과 다른 CPU 코어 수·부하 패턴)에서의 거동은 관측하지 않았다.

## 5. Residual-risk (잔여 위험)

- 이 테스트는 여전히 실제 벽시계 시간(bcrypt cost 12, N=30×2 real crypto)에 의존하는 확률적 테스트다 — 인터리빙과 타임아웃 상향으로 관측된 두 실패 양상(타임아웃, 블록-교란으로 인한 허용오차 초과)의 발생 확률을 크게 낮췄다고 판단하지만, 극단적인 시스템 부하(예: 동시 실행 프로세스가 매우 많은 CI 러너)에서는 여전히 실패할 가능성이 이론적으로 남아 있다.
- 근본적인 구조적 해결책(예: 이 통합 테스트를 전체 스위트의 병렬 워커 경합에서 격리하는 Vitest 풀/워크스페이스 설정)은 스위트 전체의 실행 시간·구성에 영향을 주는 아키텍처 결정이라 이번 원샷 수정 범위에서 제외했다 — 필요 시 별도 백로그 카드로 제안한다.
- AC-AUTH-021(백로그 t33)의 간헐 타임아웃은 이 세션의 두 전체 스위트 실행 모두에서 재현되었다 — 이 카드(t20)의 범위 밖이라 손대지 않았으나, 같은 고부하 조건에서 계속 관측되므로 t33 처리 시 참고할 만하다.
