# Acceptance Criteria: SPEC-CI-001 — GitHub Actions CI 파이프라인

Tier M — AC 상한 16개 이내(현재 14개). 검증 대상은 `.github/workflows/ci.yml`이 정의하는 워크플로의 **관찰 가능한 동작**이며, 정적 검사(파일 내용)와 동적 검사(실제 워크플로 실행)를 구분해 표기한다.

## §1. Given-When-Then 시나리오

**AC-CI-001** — PR이 워크플로를 실행시킨다 (REQ-CI-001, REQ-CI-002) *[동적]*
- Given: `.github/workflows/ci.yml`이 PR의 head 커밋(브랜치)에 존재한다 — 이 워크플로를 도입하는 PR 자체를 포함하며, 파일이 아직 `main`에 병합되지 않은 상태에서도 성립한다
- When: `main`을 대상으로 하는 PR을 연다
- Then: 해당 PR의 Checks 탭에 CI 워크플로 실행이 나타난다. `gh pr checks <PR>` 출력에 해당 검사 행이 존재한다.

**AC-CI-002** — PR에 새 커밋을 푸시하면 재실행된다 (REQ-CI-002) *[동적]*
- Given: 워크플로가 이미 1회 실행된 열린 PR이 존재한다
- When: 같은 PR 브랜치에 새 커밋을 푸시한다 (`synchronize`)
- Then: 새 워크플로 실행이 시작되고, 그 실행의 head SHA가 방금 푸시한 커밋과 일치한다.

**AC-CI-003** — `main` 푸시가 워크플로를 실행시킨다 (REQ-CI-003) *[동적]*
- Given: 워크플로가 `main`에 존재한다
- When: `main`에 커밋이 푸시된다 (PR 머지 포함)
- Then: `push` 이벤트로 트리거된 워크플로 실행이 나타난다.

**AC-CI-004** — PR의 진행 중 실행은 취소되고, `main` 푸시는 취소되지 않는다 (REQ-CI-004) *[동적]*
- Given: 어떤 PR에서 워크플로가 실행 중이다
- When: 같은 PR에 새 커밋을 즉시 푸시한다
- Then: 이전 실행의 결론(conclusion)이 `cancelled`가 된다. 반대로 `main`에 연속 2개 커밋을 푸시하면 두 실행 모두 취소되지 않고 각각 완료된다.

**AC-CI-005** — 4개 검증 명령이 모두 실행된다 (REQ-CI-005) *[동적]*
- Given: 검증을 통과하는 커밋
- When: 워크플로가 실행된다
- Then: 실행 로그에 `npm run lint`, `npm run typecheck`, `npm run prisma:validate`, `npm run test:coverage` 4개 step이 모두 `success`로 나타난다. 워크플로 결론은 `success`.

**AC-CI-006** — lint 실패가 워크플로를 실패시킨다 (REQ-CI-006) *[동적, 의도적 실패 주입]*
- Given: ESLint 규칙을 위반하는 코드를 담은 커밋
- When: 워크플로가 실행된다
- Then: Lint step이 `failure`가 되고 워크플로 결론이 `failure`가 된다. (검증 후 해당 커밋은 되돌린다.)

**AC-CI-007** — 타입 오류가 워크플로를 실패시킨다 (REQ-CI-006) *[동적, 의도적 실패 주입]*
- Given: `tsc --noEmit`이 오류를 내는 코드를 담은 커밋
- When: 워크플로가 실행된다
- Then: Typecheck step이 `failure`가 되고 워크플로 결론이 `failure`가 된다.

**AC-CI-008** — 테스트 실패가 워크플로를 실패시킨다 (REQ-CI-006) *[동적, 의도적 실패 주입]*
- Given: 최소 1개 테스트가 실패하도록 만든 커밋
- When: 워크플로가 실행된다
- Then: Test step이 `failure`가 되고 워크플로 결론이 `failure`가 된다.

**AC-CI-009** — 한 검증이 실패해도 나머지 검증이 계속 실행된다 (REQ-CI-007) *[동적, 의도적 실패 주입]*
- Given: **lint만** 실패하도록 만든 커밋 (타입·스키마·테스트는 정상)
- When: 워크플로가 실행된다
- Then: Lint step은 `failure`이지만 Typecheck / Validate Prisma schema / Test with coverage 3개 step은 `skipped`가 아니라 각각 실행되어 `success`로 보고된다.

**AC-CI-010** — 셋업이 실패하면 검증 step은 실행되지 않는다 (REQ-CI-009) *[동적, 의도적 실패 주입]*
- Given: `npm ci`가 실패하도록 만든 상태 (예: `package-lock.json`을 `package.json`과 불일치시킴)
- When: 워크플로가 실행된다
- Then: Install dependencies step이 `failure`이고, 4개 검증 step은 모두 `skipped` 상태이며, 워크플로 결론은 `failure`다. 검증 step에서 "모듈을 찾을 수 없음" 류의 2차 실패 로그가 발생하지 않는다.

**AC-CI-011** — Prisma Client 생성이 검증보다 먼저 수행된다 (REQ-CI-008) *[정적 + 동적]*
- Given: 워크플로 정의
- When: step 순서를 검사한다
- Then: `npm ci` → `npm run prisma:generate` → 4개 검증 step 순서로 배치되어 있다. 그리고 실제 실행에서 Typecheck step이 `@prisma/client` 타입 해석 오류 없이 통과한다(생성이 실제로 선행되었다는 동적 증거).

**AC-CI-012** — 커버리지 임계값 미달이 워크플로를 실패시킨다 (REQ-CI-010) *[동적, 의도적 실패 주입]*
- Given: 커버리지가 `vitest.config.ts`의 임계값(lines/statements/functions 85%, branches 80%) 아래로 떨어지도록 만든 상태 (예: 테스트되지 않는 새 코드 경로 추가)
- When: 워크플로가 실행된다
- Then: Test with coverage step이 `failure`가 되고, 로그에 커버리지 임계값 미달 메시지가 나타나며, 워크플로 결론은 `failure`다.

**AC-CI-013** — 워크플로 파일에 실제 자격 증명이 없다 (REQ-CI-011, REQ-CI-012) *[정적]*
- Given: `.github/workflows/ci.yml`
- When: 파일 내용을 검사한다
- Then: `DATABASE_URL`이 선언되어 있고 그 값은 루프백 주소를 가리키는 자리표시자이며, 자리표시자임을 밝히는 주석이 함께 있다. JWT 서명 시크릿, OAuth 클라이언트 시크릿, 실제 DB 호스트명/비밀번호는 파일에 등장하지 않는다.

**AC-CI-014** — 최소 권한, 타임아웃, Node 버전 단일 출처, 안정적 검사 이름 (REQ-CI-013, REQ-CI-014, REQ-CI-015) *[정적]*
- Given: `.github/workflows/ci.yml`과 `.nvmrc`
- When: 파일 내용을 검사한다
- Then: 네 조건이 모두 성립한다 — (a) `permissions:`가 `contents: read`만 부여한다, (b) job에 `timeout-minutes`가 선언되어 있다, (c) Node 버전이 워크플로에 하드코딩되지 않고 `node-version-file: .nvmrc`로 참조되며 `.nvmrc` 값이 `package.json`의 `engines.node` 범위(`>=20.0.0`)를 만족한다, (d) job이 고정된 `name:`을 가지며 그 이름이 `gh pr checks` 출력의 검사 이름과 일치한다.

---

## §2. 엣지 케이스

| 케이스 | 기대 동작 |
|---|---|
| `.env`가 없는 깨끗한 체크아웃 | `prisma generate` / `prisma validate`가 job 레벨 `DATABASE_URL` 자리표시자로 성공한다 |
| `next-env.d.ts`가 없는 체크아웃 (`.gitignore` 대상) | `typecheck`가 이 파일 부재로 실패하지 않는다 (plan.md R2) |
| 커버리지 계측 하의 p95 성능 테스트 | `search-response-time.test.ts` / `response-time.test.ts`가 300ms 예산 안에서 통과한다. 3회 연속 실행에서 flaky하지 않다 (plan.md R3) |
| `workflow_dispatch` 수동 실행 | Actions 탭에서 수동 실행이 가능하고 PR 실행과 동일한 검증을 수행한다 |
| 워크플로 파일 자체만 변경한 PR | 워크플로가 실행되어 4개 검증을 모두 수행한다 (경로 필터로 건너뛰지 않는다) |
| 문서만 변경한 PR (`.moai/**`, `*.md`) | 워크플로가 실행된다. 이번 SPEC은 경로 기반 skip을 도입하지 않는다 |

---

## §3. 품질 게이트

| 게이트 | 기준 |
|---|---|
| 워크플로 YAML 문법 | GitHub이 워크플로를 파싱 오류 없이 인식한다 (Actions 탭에 등록됨) |
| 통과 커밋의 실행 결론 | `success` |
| 실패 주입 커밋의 실행 결론 | `failure` — AC-CI-006/007/008/009/010/012 각각에 대해 개별 확인 (AC-CI-009도 lint 실패를 주입하므로 실행 결론은 `failure`다) |
| 기존 워크플로 무영향 | `label-sync.yml`이 변경되지 않았고 정상 동작한다 |
| 소스 무변경 | `src/**`, `tests/**`, `package.json`, `vitest.config.ts`, `tsconfig.json`, `prisma/**`에 변경이 없다 |

---

## §4. Definition of Done

- [ ] AC-CI-001 ~ AC-CI-014가 전부 PASS이거나, PASS가 아닌 항목이 근거와 함께 갭으로 기록되어 있다 (조용한 생략 없음)
- [ ] 각 AC의 판정이 실제로 관찰한 명령 출력 또는 워크플로 실행 결과에 귀속되어 있다 (`gh run view` / `gh pr checks` 출력 인용)
- [ ] 의도적 실패 주입(AC-CI-006/007/008/009/010/012)에 사용한 커밋이 전부 되돌려졌고, `main`에 남아 있지 않다
- [ ] `progress.md` §E.2 / §E.3가 실측 증거로 채워져 있다
- [ ] 브랜치 보호 규칙이 범위 밖임이 README 또는 sync 산출물에 명시되어, "CI가 머지를 막는다"는 검증되지 않은 인식이 남지 않는다
- [ ] **plan.md M3(커버리지 아티팩트 업로드)는 대응하는 REQ도 AC도 없는 편의 기능이며, 위 AC-CI-001~014 어느 항목도 그 정상 동작을 검증하지 않는다.** 즉 M3의 정상 동작은 이 DoD의 자동 검증 범위 밖이다 — DoD 통과가 M3 정상 동작의 증거가 아니라는 점을 여기에 명시해 조용한 미검증을 남기지 않는다. 업로드가 깨져 있어도 다른 AC는 영향받지 않으므로 이 갭은 의도적으로 감수한다
