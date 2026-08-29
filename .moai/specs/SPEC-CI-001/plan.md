---
id: SPEC-CI-001
status: draft
updated: 2026-08-29
tier: M
---

# Plan: SPEC-CI-001 — GitHub Actions CI 파이프라인

## §1. 개요 / 목표

`package.json`에 **이미 존재하는** 검증 스크립트(`lint`, `typecheck`, `prisma:validate`, `test:coverage`)를 GitHub Actions가 PR과 `main` 푸시에서 자동 실행하도록 만든다. 새 검증 도구를 도입하지 않고, 기존 스크립트의 정의나 임계값도 건드리지 않는다 — 실행 주체를 사람에서 CI로 옮기는 것이 전부다.

산출물은 워크플로 파일 1개와 Node 버전 단일 출처 파일 1개로 예상된다(§4).

### Tier 판정: M

LOC 축으로만 보면 Tier S(< 300 LOC, < 5 files)에 해당하지만, **REQ/AC 예산 축**에서 Tier S 상한(REQ 8 / AC 8)을 초과한다(현재 REQ 15, AC 14). CI 파이프라인은 코드량은 작아도 관찰 가능한 계약 표면(트리거 4종 × 검증 4종 × 실패 전파 × 환경 조건)이 넓다. 따라서 Tier M(3-artifact set: spec.md + plan.md + acceptance.md)으로 분류한다.

---

## §2. 결정 사항 (되돌리기 어려운 것부터)

### 2.1 [범위 결정] 배포 자동화는 이번 SPEC에서 제외하고 별도 SPEC으로 연기한다

**결정: 이 SPEC의 범위는 CI 전용이다. 배포(CD) 자동화는 포함하지 않으며, 호스팅 대상이 확정된 뒤 별도 SPEC으로 분리한다.**

이 결정은 이 SPEC의 plan-phase 범위 판단으로 내린 것이다. **이 결정을 확정한 별도의 사용자 결정 기록(일시·경로·질의 응답)은 존재하지 않는다** — 따라서 아래 근거가 이 범위 결정의 상시 정당화이며, 근거가 무너지면(예: 호스팅 대상이 확정되면) 결정도 다시 열린다.

**근거 — 호스팅 대상이 아직 선택되지 않았다.**

`tech.md`의 "빌드 및 배포 구성" 절은 다음 세 가지를 명시적으로 기록하고 있다:

1. 호스팅 대상 Vercel은 **"추천"**이지 확정이 아니다 — 같은 문서의 "요약: 확정 vs 추천" 표에서 배포 항목의 상태는 `추천 (잠정)`이다.
2. 대안으로 "자체 컨테이너 배포(Docker + 임의 클라우드)"가 열려 있다.
3. "**결정 보류 사항**: 구체적인 CI/CD YAML 워크플로 정의, 컨테이너화 여부, 무중단 배포 전략은 프레임워크 및 PG사 확정 이후 별도 문서/SPEC에서 구체화한다."

프레임워크(Next.js 15)는 SPEC-AUTH-001 구현으로 확정됐지만, **호스팅 대상과 PG사는 여전히 미확정**이다. 이 상태에서 배포 워크플로를 작성하면 다음 항목들을 전부 가정해야 한다 — 그리고 그 가정들은 어느 것도 검증되지 않았다:

| 배포 워크플로가 요구하는 것 | 현재 상태 |
|---|---|
| 배포 대상 플랫폼 | **미확정** (Vercel은 추천안일 뿐) |
| 배포 자격 증명의 형태 (`VERCEL_TOKEN`? 컨테이너 레지스트리 자격 증명? SSH 키?) | 대상 미확정이라 결정 불가 |
| 빌드 산출물 형태 (Vercel 자체 빌드 / `next build` standalone / Docker 이미지) | 대상 미확정이라 결정 불가 |
| 운영 `DATABASE_URL`이 가리킬 관리형 DB | 미확정 (SPEC-CATALOG-002 갭 G4가 이미 이 미확정을 기록) |
| 환경 프로파일(staging/production) 실체 | `tech.md`에 제안만 존재, 프로비저닝된 환경 없음 |

배포 대상을 지금 **발명**해서 파이프라인에 박아 넣는 것은, 되돌리기 비싼 결정을 근거 없이 내리는 일이다. 잘못 고른 배포 대상은 워크플로 파일 하나가 아니라 자격 증명 관리·환경 변수 구성·DB 프로비저닝까지 끌고 들어오며, 나중에 대상을 바꾸면 그 전부를 다시 만들어야 한다.

**분리했을 때의 비용은 거의 없다.** CI(검증)와 CD(배포)는 자연스러운 경계로 나뉜다 — CD 워크플로는 "CI가 통과한 커밋"을 입력으로 받으므로, CI를 먼저 세워두는 것이 오히려 CD의 선행 조건이다. 이번 SPEC이 만드는 검증 계층은 후속 CD SPEC이 그대로 재사용한다.

**후속 조건**: 호스팅 대상이 확정되면 별도 SPEC(예: `SPEC-CD-001`)에서 배포를 다룬다. 그 SPEC의 선행 조건은 (a) 호스팅 대상 확정, (b) 운영 DB 프로비저닝, (c) 이번 SPEC의 CI 통과다.

---

### 2.2 Job 구성: 단일 `verify` job (병렬 분리 job 아님)

**결정: 검증 4종을 하나의 `verify` job 안의 4개 step으로 실행한다.**

이 결정이 §2.1 다음으로 되돌리기 어려운 이유는 **job 이름이 브랜치 보호 규칙의 계약 표면**이기 때문이다(REQ-CI-015). 일단 `main`의 필수 상태 검사로 등록되면, job 이름·개수를 바꿀 때마다 저장소 설정을 함께 고쳐야 하고, 그 사이 열려 있던 PR들은 "존재하지 않는 검사를 기다리는" 상태로 멈춘다.

**검토한 대안**:

| 대안 | 장점 | 단점 |
|---|---|---|
| **A. 단일 job (채택)** | 셋업(`npm ci` + `prisma generate`) 1회, 러너 분 최소, 필수 검사 1개로 브랜치 보호 단순 | 검증이 순차 실행 → wall-clock 증가 |
| B. 검증별 병렬 job 4개 | wall-clock 최소, 실패 지점이 검사 이름으로 즉시 구분됨 | 셋업 4회 반복(러너 분 ~4배), 필수 검사 4개 관리 |
| C. 2 job (정적 검사 / 테스트) | 절충 | 셋업 2회, 이 규모에서 얻는 wall-clock 이득이 크지 않음 |

**A를 고른 이유**:

- 4개 검증이 **동일한 셋업을 공유한다** — `npm ci`와 `prisma generate`는 검증마다 다시 필요하다. 병렬화하면 셋업만 N배로 늘어난다.
- `package.json`이 `"private": true`이므로 **러너 분이 과금되는 저장소**일 가능성이 높다. 셋업 반복은 직접 비용이다.
- 규모가 작다 — 테스트 36개 파일, `src/` 전체가 API 라우트 + 3개 feature. 순차 실행의 wall-clock 손해가 크지 않다.
- 브랜치 보호에 등록할 필수 검사가 하나면 설정·문서화·유지가 단순하다.

**A의 유일한 실질적 단점(첫 실패에서 나머지 검증을 못 봄)은 §2.3으로 해소한다.** 그것이 해소되지 않으면 A는 B보다 확실히 나쁘다 — 한 번 push할 때마다 실패를 하나씩만 알게 되어 왕복이 늘어나기 때문이다.

**되돌리는 방법**: 향후 테스트가 무거워져 wall-clock이 문제가 되면 B로 전환한다. 전환 시 브랜치 보호의 필수 검사 목록을 **먼저** 갱신하고 워크플로를 바꾼다(순서를 뒤집으면 PR이 멈춘다).

---

### 2.3 실패해도 나머지 검증을 계속 실행한다 (step 조건부 실행)

**결정: 4개 검증 step에 `if: ${{ !cancelled() && steps.prisma_generate.conclusion == 'success' }}`를 건다.**

GitHub Actions의 기본 동작은 "이전 step이 실패하면 이후 step을 건너뛴다"이다. 그대로 두면 lint 실패 시 typecheck·prisma validate·test 결과를 전혀 알 수 없고, 개발자는 실패를 하나 고칠 때마다 push해서 다음 실패를 발견하는 왕복을 반복하게 된다(REQ-CI-007이 금지하는 동작).

`!cancelled()`만으로는 부족하다 — `npm ci`가 실패한 경우에도 검증 step들이 실행되어 "모듈을 찾을 수 없음"이라는 **무의미한 2차 실패**를 4번 더 쏟아낸다. 그래서 조건에 `steps.prisma_generate.conclusion == 'success'`를 함께 건다. 셋업이 무너지면 검증은 실행되지 않고(REQ-CI-009), 셋업이 성공하면 검증 4개가 서로의 실패와 무관하게 전부 실행된다(REQ-CI-007).

`prisma_generate`를 기준점으로 삼는 이유: 그것이 셋업 체인의 **마지막** step이므로, 그 step이 success라는 것은 checkout·setup-node·`npm ci`가 모두 성공했다는 뜻이다. 단일 조건으로 셋업 전체를 대표할 수 있다.

---

### 2.4 `test`와 `test:coverage` 중 `test:coverage`만 실행한다

**결정: CI는 `npm run test:coverage`만 실행한다. `npm test`는 별도로 실행하지 않는다.**

두 스크립트는 같은 스위트를 돈다 — `vitest run` 대 `vitest run --coverage`. 둘 다 실행하면 36개 테스트 파일을 두 번 돌리면서 얻는 추가 신호가 없다. `test:coverage`는 테스트 통과 여부와 커버리지 임계값(`vitest.config.ts`: lines/statements/functions 85%, branches 80%)을 **함께** 강제하므로 `test`의 상위 집합이다.

**감수하는 위험 (R3, §6)**: 커버리지 계측(v8 provider) 하에서만 테스트가 돌게 되므로, 계측 오버헤드가 성능 테스트에 영향을 줄 수 있다. `tests/integration/catalog/search-response-time.test.ts`와 `response-time.test.ts`는 p95 응답 시간을 측정한다. SPEC-CATALOG-002 progress.md에 기록된 실측값은 0.35~0.50ms이고 예산은 300ms이므로 여유가 약 600배다 — 계측 오버헤드가 이 여유를 삼킬 가능성은 낮다고 판단한다. 다만 GitHub 러너는 공유 환경이라 로컬보다 변동이 크므로, **실제로 flaky해지면** 성능 테스트만 비계측 step으로 분리하는 것을 대안으로 남긴다.

**되돌리는 방법**: `npm test`를 별도 step으로 추가한다(비용: 테스트 1회분 추가 실행 시간).

---

### 2.5 Node 버전 단일 출처: `.nvmrc` 신설

**결정: 저장소 루트에 `.nvmrc`를 추가하고, 워크플로는 `actions/setup-node`의 `node-version-file: .nvmrc`로 읽는다.**

`package.json`의 `engines.node`는 `">=20.0.0"` — **범위**이지 특정 버전이 아니므로 CI가 실행할 버전을 결정하지 못한다. 선택지는 셋 중 하나였다:

| 대안 | 평가 |
|---|---|
| 워크플로에 `node-version: 22` 하드코딩 | 버전이 워크플로 파일에만 존재 → 로컬 개발 환경과 CI가 다른 버전을 쓰는 것을 아무도 알아채지 못함 |
| **`.nvmrc` 신설 + `node-version-file` (채택)** | 로컬(`nvm use`)과 CI가 같은 파일을 읽음. `tech.md`가 이미 `.nvmrc` 또는 `engines` 명시를 권고 |
| Node 버전 매트릭스 (20 + 22) | `engines.node >= 20`의 하한을 실제로 검증하지만 러너 분 2배. 이 프로젝트는 단일 배포 대상을 향하므로(대상 미확정이더라도 여러 Node 버전을 동시에 지원할 계획은 없음) 이식성 검증의 가치가 낮음 |

**값**: Node 22 (LTS). `tech.md`가 "Node.js 22.x LTS"를 권고하며, `engines.node >= 20`을 만족한다.

**드리프트 위험 (R5, §6)**: `.nvmrc`와 `package.json`의 `engines.node`가 이중 출처가 된다. 둘이 어긋나도 아무도 알려주지 않는다. 이번 SPEC은 `engines`를 변경하지 않되(범위 밖), `.nvmrc` 값이 `engines` 범위를 만족하는지는 M4 검증 항목에 포함한다.

---

### 2.6 `prisma generate`를 검증 전에 실행한다

**결정: `npm ci` 직후, 검증 4종 이전에 `npm run prisma:generate`를 실행한다.**

근거는 추정이 아니라 소스 확인이다. 다음 파일들이 `@prisma/client`의 타입을 import한다:

```
src/lib/db/index.ts                              : import { PrismaClient, type Prisma }
src/features/catalog/repositories/product-repository.ts : import type { Prisma }
src/features/cart/repositories/cart-repository.ts       : import type { Prisma }
tests/unit/catalog/query-surface.test.ts                : import type { Category, Product }
```

`@prisma/client`의 실제 타입은 `prisma generate`가 스키마로부터 생성한다. 생성 전에는 `tsc --noEmit`과 Vitest의 타입 해석이 `Product`/`Category` 같은 모델 타입을 찾지 못한다. 따라서 `prisma generate`는 선택이 아니라 **선행 조건**이다(REQ-CI-008).

---

### 2.7 `DATABASE_URL` 자리표시자 주입

**결정: job 레벨 `env`에 실제 DB를 가리키지 않는 자리표시자 `DATABASE_URL`을 선언한다.**

`.env`는 `.gitignore`에 의해 커밋되지 않으므로(`.env`, `.env.*`, `!.env.example`) **CI 체크아웃에는 `DATABASE_URL`이 존재하지 않는다.** Prisma CLI는 `schema.prisma`의 `datasource db { url = env("DATABASE_URL") }`를 해석하므로 이 변수가 없으면 `prisma generate`/`prisma validate`가 실패할 수 있다.

**중요 — 이 값은 시크릿이 아니다.** CI의 어떤 것도 데이터베이스에 접속하지 않는다: 테스트 스위트는 Prisma seam(`@/lib/db`)을 모킹하고, 인증 관련 테스트는 필요한 환경 변수를 **테스트가 스스로 설정한다**(11개 테스트 파일이 `process.env.JWT_ACCESS_SECRET = ...` 형태로 직접 대입). 따라서 CI에는 JWT/OAuth 시크릿을 주입할 필요가 전혀 없으며, `DATABASE_URL`도 형식만 유효하면 된다.

값 예시: `postgresql://ci:ci@127.0.0.1:5432/our_shop_ci?schema=public` — 접속 시도가 일어나지 않는 루프백 주소. 주석으로 "자리표시자이며 실제 자격 증명이 아님"을 워크플로 파일에 명시한다(REQ-CI-012).

**미검증 (R1, §6)**: 이 워크트리에는 `node_modules`가 설치되어 있지 않아 `prisma validate`가 `DATABASE_URL` 부재 시 실제로 실패하는지 **plan 단계에서 확인하지 못했다.** 자리표시자 주입은 두 경우(요구함 / 요구하지 않음) 모두에서 안전하므로 설계는 이 미검증에 의존하지 않는다 — 요구하지 않는다면 이 env는 무해하게 무시된다. 실제 동작은 run 단계에서 확인한다.

---

### 2.8 트리거와 동시성

- **`pull_request`** (`branches: [main]`, `types: [opened, synchronize, reopened]`) — REQ-CI-002. PR 검증이 이 SPEC의 1차 목적이다.
- **`push`** (`branches: [main]`) — REQ-CI-003. `main`의 상태를 항상 알 수 있게 한다. 현재 프로젝트는 PR 경로(#1~#4)를 쓰지만, 직접 푸시가 발생하더라도 검증이 비는 구간이 없어야 한다.
- **`workflow_dispatch`** — 수동 재실행. 기존 `label-sync.yml`도 같은 관례를 따른다.
- **동시성**: `cancel-in-progress`를 **PR에서만** 켠다(`github.event_name == 'pull_request'`). PR은 최신 커밋의 결과만 의미가 있으므로 취소가 옳지만, `main` 푸시는 커밋마다 검증 이력이 남아야 하므로 취소하면 안 된다.

---

### 2.9 부수 사항 (기계적 — 되돌리기 쉬움)

- **권한**: `permissions: contents: read` — 워크플로는 체크아웃만 필요하다. `label-sync.yml`이 `issues: write`를 요구하는 것과 달리 CI는 아무것도 쓰지 않는다(REQ-CI-014).
- **타임아웃**: `timeout-minutes: 15`. 정상 실행은 이보다 훨씬 짧을 것으로 예상하며, 이 값은 멈춘 실행이 러너를 점유하는 것을 막는 상한이다(REQ-CI-014).
- **캐시**: `actions/setup-node`의 `cache: npm`. `package-lock.json`이 존재하므로 `npm ci`가 사용 가능하고 캐시 키도 자동으로 잡힌다.
- **커버리지 아티팩트**: `coverage/`(`lcov` + `text` reporter 설정됨, `.gitignore`에 등재)를 아티팩트로 업로드해 실패 원인 확인을 돕는다. 실패한 실행에서도 업로드되도록 `!cancelled()` 조건을 건다.
- **스타일**: `label-sync.yml`의 관례를 따른다 — 파일 상단 목적/트리거 주석 블록, 명시적 `permissions`, `timeout-minutes`, 모든 job/step에 `name`.

---

## §3. 워크플로 설계 (run 단계에서 작성할 파일의 설계 — 이 plan에서는 구현하지 않음)

`.github/workflows/ci.yml` 설계 스케치:

```yaml
name: CI

on:
  pull_request:
    branches: [main]
    types: [opened, synchronize, reopened]
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: ci-${{ github.workflow }}-${{ github.ref }}
  # PR은 최신 커밋 결과만 의미가 있으므로 취소한다.
  # main 푸시는 커밋별 검증 이력이 남아야 하므로 취소하지 않는다.
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}

jobs:
  verify:
    # 이 이름이 브랜치 보호의 필수 상태 검사가 참조하는 계약 표면이다 (REQ-CI-015).
    name: verify
    runs-on: ubuntu-latest
    timeout-minutes: 15
    env:
      # 자리표시자 — 실제 자격 증명이 아니다 (REQ-CI-011, REQ-CI-012).
      # Prisma CLI가 datasource의 env("DATABASE_URL")를 해석하는 데만 쓰이며,
      # CI의 어떤 것도 DB에 접속하지 않는다 (테스트는 Prisma seam을 모킹).
      DATABASE_URL: "postgresql://ci:ci@127.0.0.1:5432/our_shop_ci?schema=public"
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc   # 단일 출처 (§2.5)
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Generate Prisma Client
        # src/tests가 @prisma/client 타입을 import하므로 검증의 선행 조건 (§2.6)
        id: prisma_generate
        run: npm run prisma:generate

      # 아래 4개 검증은 서로의 실패와 무관하게 모두 실행된다 (REQ-CI-007, §2.3).
      # 셋업이 실패하면 실행되지 않는다 (REQ-CI-009).
      - name: Lint
        if: ${{ !cancelled() && steps.prisma_generate.conclusion == 'success' }}
        run: npm run lint

      - name: Typecheck
        if: ${{ !cancelled() && steps.prisma_generate.conclusion == 'success' }}
        run: npm run typecheck

      - name: Validate Prisma schema
        if: ${{ !cancelled() && steps.prisma_generate.conclusion == 'success' }}
        run: npm run prisma:validate

      - name: Test with coverage
        # 커버리지 임계값 미달 시 vitest가 0이 아닌 코드로 종료 → job 실패 (REQ-CI-010)
        if: ${{ !cancelled() && steps.prisma_generate.conclusion == 'success' }}
        run: npm run test:coverage

      - name: Upload coverage report
        if: ${{ !cancelled() && steps.prisma_generate.conclusion == 'success' }}
        uses: actions/upload-artifact@v4
        with:
          name: coverage-${{ github.run_id }}
          path: coverage/
          retention-days: 7
          if-no-files-found: warn
```

`.nvmrc` 설계: `22` 한 줄.

> 위 YAML은 **설계 스케치**이며, 이 plan 단계에서 `.github/workflows/ci.yml`을 실제로 생성하지 않는다. 액션 버전(`@v4`)은 run 단계에서 최신 major를 재확인한다.

---

## §4. 파일 목록 (run 단계 예상 변경)

| 파일 | 변경 | 비고 |
|---|---|---|
| `.github/workflows/ci.yml` | 신규 | 워크플로 정의 (§3) |
| `.nvmrc` | 신규 | Node 버전 단일 출처 (§2.5) |
| `README.md` | 수정 (P2) | CI 배지 + 브랜치 보호 수동 설정 안내 |

`package.json`, `vitest.config.ts`, `tsconfig.json`, `prisma/schema.prisma`, `src/**`, `tests/**`는 **변경하지 않는다** — 이 SPEC은 실행 주체만 바꾼다(spec.md §3 참고).

---

## §5. 마일스톤 (우선순위 기반, 시간 추정 없음)

| ID | 우선순위 | 내용 |
|---|---|---|
| M1 | P0 | `.nvmrc` 추가 + `.github/workflows/ci.yml` 골격(트리거·권한·동시성·job 이름·셋업 step). 여기서 정해지는 job 이름과 트리거가 브랜치 보호의 계약 표면이다 (§2.2) |
| M2 | P0 | 검증 4종 step 추가 + 조건부 실행(§2.3) + `DATABASE_URL` 자리표시자(§2.7) |
| M3 | P1 | 커버리지 아티팩트 업로드 step |
| M4 | P1 | **실제 실행 검증** — PR을 열어 워크플로가 실행되는지, 그리고 의도적으로 각 검사를 깨뜨렸을 때 실제로 실패를 잡는지 확인한다. 실패 주입 대상 AC는 **AC-CI-006 / 007 / 008 / 009 / 010 / 012** 6건 전부이며(acceptance.md §1), 이 집합은 acceptance.md §3 품질 게이트 및 §4 DoD와 동일하다 — 부분 집합만 이행하고 M4를 닫지 않는다. 통과만 확인하는 것은 검사가 구속력을 갖는다는 증거가 아니다 |
| M5 | P2 | `README.md`에 CI 배지 + 브랜치 보호 수동 설정 절차 문서화 (설정 자체는 범위 밖 — spec.md §3) |

---

## §6. 리스크

| ID | 리스크 | 완화 |
|---|---|---|
| R1 | `prisma validate`/`generate`가 `DATABASE_URL`을 실제로 요구하는지 **plan 단계에서 미검증** — 이 워크트리에 `node_modules`가 없어 명령을 실행할 수 없었다 | 자리표시자 주입은 요구 여부와 무관하게 안전(§2.7). run 단계 M4에서 실제 실행으로 확인 |
| R2 | `next-env.d.ts`가 `.gitignore`에 있어 CI 체크아웃에 없다. `tsconfig.json`의 `include`가 이 파일과 `.next/types/**/*.ts`를 참조한다 | `src/`에 `.tsx` 파일이 없고 next 관련 import는 `next/server`(패키지 자체 타입) 12건뿐이므로 영향이 없을 것으로 판단. TS는 `include`의 매칭 실패를 오류로 보지 않음. M4에서 실제 확인 |
| R3 | 커버리지 계측 하에서만 테스트가 돌아 p95 성능 테스트가 flaky해질 수 있음 (§2.4) | 예산 300ms 대비 실측 0.35~0.50ms로 여유 약 600배. flaky 발생 시 성능 테스트를 비계측 step으로 분리 |
| R4 | 브랜치 보호는 이 SPEC의 커밋으로 적용되지 않는다 — 저장소 관리자의 수동 설정이 필요하며, 설정 전까지 CI는 **실패해도 머지를 막지 못한다** | spec.md §3에 범위 밖으로 명시. M5에서 수동 절차를 README에 문서화. 이 한계를 조용히 넘기지 않는다 |
| R5 | `.nvmrc`(22)와 `package.json` `engines.node`(`>=20.0.0`)가 이중 출처가 되어 어긋날 수 있음 | `engines`는 하한, `.nvmrc`는 실행 버전으로 역할이 다름. M4에서 `.nvmrc` 값이 `engines` 범위를 만족하는지 확인 |
| R6 | 첫 CI 실행이 기존 코드에서 실패할 가능성 — PR #1~#4는 로컬 환경(`.env` 존재, `node_modules` 설치됨)에서만 검증됐고 깨끗한 체크아웃에서 검증된 적이 없다 | 이것은 리스크가 아니라 **이 SPEC의 목적**이다. 실패가 나오면 그것이 CI가 잡아낸 첫 성과다. 단, 실패 원인이 코드가 아니라 워크플로 설계일 수 있으므로 M4에서 구분한다 |

---

## §7. plan-audit 확인 요청 사항

- §2.2(단일 job)와 §2.4(`test:coverage`만 실행)는 단순성을 위해 신호를 일부 포기한 결정이다. 이 절충이 이 프로젝트 규모에 적절한지 확인 요청.
- §2.5에서 `.nvmrc`를 **신설**하는 것은 "기존 스크립트만 자동화한다"는 범위를 한 파일만큼 넘어선다. 대안(워크플로에 버전 하드코딩)보다 나은지 확인 요청.
- R1/R2는 plan 단계에서 도구 부재로 검증하지 못한 항목이다. run 단계 진입 전 이 미검증을 감수할지 확인 요청.
