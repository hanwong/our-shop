---
id: SPEC-CI-001
title: "GitHub Actions CI 파이프라인 — PR/main 푸시 자동 품질 검증"
version: "0.1.0"
status: completed
created: 2026-08-29
updated: 2026-08-30
author: snake
priority: P1
phase: "v0.1.0 MVP"
module: ".github/workflows"
lifecycle: spec-anchored
tags: "ci, github-actions, devops, quality-gate, automation"
tier: M
---

## HISTORY

| 날짜 | 버전 | 상태 | 비고 |
|---|---|---|---|
| 2026-08-29 | 0.1.0 | draft | plan-phase 최초 작성. SPEC-AUTH-001(#1), SPEC-CATALOG-001(#2), SPEC-CATALOG-002(#3), SPEC-CART-001(#4)이 모두 **로컬 검증만으로** 머지된 상태에서, 저장소에 CI가 전혀 없다는 사실을 해소한다. 범위는 이 SPEC의 plan-phase 범위 판단으로 정했다 — 별도의 사용자 결정 기록은 존재하지 않으며, §3과 `plan.md` §2.1의 근거가 이 범위의 정당화다: **CI 전용**이며 배포 자동화는 제외한다. `tech.md`가 "구체적인 CI/CD YAML 워크플로 정의는 별도 문서/SPEC에서 구체화한다"로 남긴 결정 보류 사항 중 CI 절반을 이번 SPEC이 담당한다. |

---

## §1. 개요

저장소에 커밋된 코드가 `main`에 들어가기 전에 **자동으로** 검증되도록 GitHub Actions 워크플로를 도입한다. 현재 `.github/workflows/`에는 `label-sync.yml`(라벨 동기화) 하나뿐이며, 코드 품질을 검증하는 워크플로는 존재하지 않는다 — PR #1~#4는 모두 개발자의 로컬 실행 결과에만 의존해 머지됐다.

이 SPEC이 자동화하는 대상은 `package.json`에 **이미 정의되어 있는** 검증 스크립트다: `lint`(ESLint), `typecheck`(`tsc --noEmit`), `test` / `test:coverage`(Vitest), `prisma:validate`(Prisma 스키마 유효성). 새로운 검증 도구를 도입하거나 기존 스크립트의 동작을 바꾸지 않는다 — **동일한 명령을 사람이 아닌 CI가 실행하게 만드는 것**이 이 SPEC의 전부다.

검증 명령들은 실행 전 두 가지 선행 조건을 요구한다. 첫째, `npm ci`로 의존성을 설치해야 한다. 둘째, `src/`와 `tests/`가 `@prisma/client`의 타입(`Prisma`, `PrismaClient`, `Product`, `Category`)을 import하므로 `prisma generate`가 선행되지 않으면 `typecheck`와 `test`가 타입 해석에 실패한다. 이 두 선행 조건은 요구사항으로 명시한다(REQ-CI-008, REQ-CI-009).

### 범위 경계 — 배포는 포함하지 않는다

이 SPEC은 **CI(지속적 통합)만** 다루며 **CD(지속적 배포)는 다루지 않는다.** 이 프로젝트는 아직 호스팅 대상을 확정하지 않았다 — `tech.md`는 Vercel을 *추천안(미확정)*으로만 기록하고 있고, 어떤 배포 대상도 사용자가 선택한 바 없다. 배포 대상이 정해지지 않은 상태에서 배포 자동화를 설계하는 것은 검증되지 않은 가정 위에 파이프라인을 세우는 일이므로, 배포는 호스팅 대상 확정 이후 **별도 SPEC**으로 분리한다(§3 참고).

## §2. 요구사항 (GEARS, REQ-CI-001 ~ 015)

### 워크플로 실행 조건 (트리거)

- **REQ-CI-001** (Ubiquitous): 저장소는 GitHub Actions가 인식하는 CI 워크플로 정의를 포함해야 한다.
- **REQ-CI-002** (When): `main`을 대상 브랜치로 하는 풀 리퀘스트가 열리거나(opened), 새 커밋으로 갱신되거나(synchronize), 재오픈되면(reopened), CI 워크플로가 실행되어야 한다.
- **REQ-CI-003** (When): `main` 브랜치로 커밋이 푸시되면, CI 워크플로가 실행되어야 한다.
- **REQ-CI-004** (When): 동일한 풀 리퀘스트에서 새 실행이 시작되면, 같은 참조(ref)에 대해 진행 중이던 이전 실행은 취소되어야 한다.

### 검증 명령 실행

- **REQ-CI-005** (Ubiquitous): CI 워크플로는 `package.json`에 정의된 검증 스크립트 `lint`, `typecheck`, `prisma:validate`, `test:coverage`를 실행해야 한다.
- **REQ-CI-006** (When): 검증 스크립트 중 하나라도 0이 아닌 종료 코드로 끝나면, 워크플로 실행은 실패(failure) 상태로 종료되어야 한다.
- **REQ-CI-007** (When): 한 검증 스크립트가 실패하더라도, 같은 실행 안의 나머지 검증 스크립트는 계속 수행되어 결과가 함께 보고되어야 한다 — 첫 실패에서 나머지 검증을 건너뛰어서는 안 된다.
- **REQ-CI-008** (Ubiquitous): 검증 스크립트 실행에 앞서 의존성 설치(`npm ci`)와 Prisma Client 생성(`prisma generate`)이 수행되어야 한다.
- **REQ-CI-009** (When — 이벤트 탐지형): 의존성 설치 또는 Prisma Client 생성이 실패하면, 검증 스크립트는 실행되지 않아야 하며 워크플로는 실패해야 한다.

### 커버리지

- **REQ-CI-010** (When): 테스트 커버리지가 `vitest.config.ts`에 선언된 임계값(lines/statements/functions 85%, branches 80%) 미만이면, 워크플로는 실패해야 한다.

### 실행 환경

- **REQ-CI-011** (Ubiquitous): 워크플로는 Prisma CLI가 datasource를 해석하는 데 필요한 `DATABASE_URL`을, 실제 데이터베이스에 연결되지 않는 자리표시자(placeholder) 값으로 제공해야 한다.
- **REQ-CI-012** (Unwanted, shall not): 워크플로 파일은 실제 자격 증명(데이터베이스 비밀번호, JWT 서명 시크릿, OAuth 클라이언트 시크릿)을 평문으로 포함해서는 안 된다.
- **REQ-CI-013** (Ubiquitous): 워크플로가 사용하는 Node.js 버전은 저장소에 커밋된 단일 출처에서 읽어야 하며, 워크플로 파일에 버전 문자열을 중복해서 적어서는 안 된다.

### 워크플로 위생

- **REQ-CI-014** (Ubiquitous): 워크플로의 `GITHUB_TOKEN` 권한은 최소 권한 원칙에 따라 읽기 전용(`contents: read`)으로 선언되어야 하며, 각 job은 `timeout-minutes` 상한을 선언해야 한다.
- **REQ-CI-015** (Ubiquitous): 워크플로는 브랜치 보호 규칙이 필수 상태 검사(required status check)로 참조할 수 있도록, 안정적이고 변경되지 않는 검사 이름을 노출해야 한다.

> **REQ-CI-015 주석**: 이 SPEC은 브랜치 보호 규칙을 *설정*하지 않는다(§3 참고 — 저장소 설정이지 저장소 산출물이 아님). 이 요구사항이 보장하는 것은 "설정할 수 있는 안정적인 이름이 존재한다"는 것까지다.

## §3. Out of Scope

### Out of Scope — 배포 자동화 (CD) 및 호스팅 대상 선택
- 프로덕션/스테이징 배포, 배포 워크플로, 배포 자격 증명 관리, 롤백 전략은 이번 SPEC 범위 밖이다.
- 근거: 이 프로젝트는 호스팅 대상을 **아직 선택하지 않았다**. `tech.md`는 Vercel을 "추천 (미확정)"으로만 기록하며, 같은 문서가 CI/CD 세부 구성을 "결정 보류 사항"으로 남겼다. 배포 대상이 없는 상태에서 배포 파이프라인을 작성하면 검증되지 않은 가정(어디에 배포하는가, 어떤 자격 증명이 필요한가, 빌드 산출물 형태는 무엇인가)을 코드로 굳히게 된다.
- 처리: 호스팅 대상이 확정된 뒤 **별도 SPEC**(예: `SPEC-CD-001`)으로 다룬다. 이번 SPEC은 그 후속 SPEC이 재사용할 수 있는 검증 계층만 제공한다.

### Out of Scope — 프로덕션 빌드 검증 (`next build`)
- `npm run build`(= `next build`)를 CI에서 실행하는 것은 이번 SPEC 범위 밖이다.
- **`tech.md` 권고와의 관계 (의도적 이탈)**: `tech.md:78-82`는 GitHub Actions CI를 `lint` → `test` → `build` → `deploy` 4단계로 구성할 것을 권고한다. 이번 SPEC은 1·2단계(`lint`, `test` — 여기에 `typecheck`와 `prisma:validate`를 더한다)를 채택하고 4단계(`deploy`)는 위 CD 항목대로 연기하며, **3단계(`build`)도 이번 범위에서 제외한다.** 이 제외는 같은 문서의 권고로부터의 의도적 이탈이므로 근거를 여기에 명시한다.
- 이탈 근거: `next build`는 배포 산출물을 만드는 단계이고, 산출물의 형태는 호스팅 대상에 따라 달라진다(standalone / serverless / static). 배포 대상이 미확정인 상태에서는 무엇을 빌드해 무엇을 검증할지 정할 수 없으며, 지금 빌드 형태를 임의로 고르면 위 CD 항목이 피하려는 "검증되지 않은 가정을 파이프라인에 굳히기"를 `build` 단계에서 그대로 반복하게 된다.
- **이 이탈로 잃는 검증 신호 (명시)**: `tsc --noEmit`은 타입 오류만 잡는다. `next build`만 드러내는 오류 계열 — 라우트 핸들러의 export 형식 위반, 서버/클라이언트 컴포넌트 경계 위반, 정적 생성(SSG/ISR) 단계 실패, 빌드 타임 설정 오류 — 은 이번 CI가 **잡지 못한다.** 이것은 알려진 갭이며, 이 SPEC은 이를 메우지 않는다. "타입 오류는 `typecheck`가 잡으므로 `build`가 불필요하다"는 주장은 성립하지 않는다 — `typecheck`는 잃는 신호의 일부만 대체한다.
- 신호 회복 시점: 호스팅 대상이 확정되어 산출물 형태가 정해지면 위 CD 항목의 별도 SPEC(예: `SPEC-CD-001`)에서 `build` 단계를 파이프라인에 추가한다. 그보다 먼저 이 신호가 필요해지면 `build` 검증만 다루는 별도 후속 SPEC으로 분리한다.

### Out of Scope — 브랜치 보호 규칙 설정
- `main` 브랜치에 필수 상태 검사를 강제하는 설정 자체는 이번 SPEC 범위 밖이다.
- 근거: 브랜치 보호는 저장소 **설정**이지 저장소에 커밋되는 **산출물**이 아니다. 저장소 관리자 권한으로 GitHub UI 또는 API를 통해 적용해야 하며, 이 SPEC의 커밋으로는 적용되지 않는다. 이 SPEC은 그 설정이 참조할 안정적인 검사 이름을 제공하는 데까지만 책임진다(REQ-CI-015).

### Out of Scope — 라이브 데이터베이스 연동 및 마이그레이션
- CI에서 PostgreSQL 서비스 컨테이너를 띄우거나, `prisma migrate deploy`를 실행하거나, 실제 DB에 연결되는 통합 테스트를 수행하는 것은 이번 SPEC 범위 밖이다.
- 근거: 현재 테스트 스위트는 Prisma seam(`@/lib/db`)을 모킹하므로 DB 없이 전부 통과한다. SPEC-CATALOG-002가 남긴 미검증 항목(트라이그램 인덱스 선택 여부 `EXPLAIN` 확인 등)은 라이브 DB가 필요하지만, 그것은 이 SPEC이 아니라 해당 성능 항목을 다루는 후속 작업의 몫이다.

### Out of Scope — 보안 스캐닝 및 의존성 감사
- CodeQL, `npm audit`, Dependabot, 시크릿 스캐닝, SBOM 생성은 이번 SPEC 범위 밖이다.
- 근거: 별개의 도구 체인과 별개의 실패 정책(취약점 심각도 임계값 등)을 요구하며, 기존 `package.json` 스크립트를 자동화한다는 이번 SPEC의 범위와 성격이 다르다.

### Out of Scope — E2E / 브라우저 테스트
- Playwright 등 브라우저 기반 E2E 테스트를 CI에 추가하는 것은 이번 SPEC 범위 밖이다. 현재 저장소에는 E2E 테스트가 존재하지 않으며, 이를 작성하는 것 또한 이 SPEC의 범위가 아니다.

### Out of Scope — 릴리스 자동화
- 버전 태깅, CHANGELOG 자동 생성, GitHub Release 발행, 패키지 발행은 이번 SPEC 범위 밖이다.

### Out of Scope — 기존 검증 스크립트의 동작 변경
- `lint`, `typecheck`, `test`, `test:coverage`, `prisma:validate` 스크립트의 정의, ESLint 규칙 집합, 커버리지 임계값(85/85/80/85)은 이번 SPEC에서 변경하지 않는다. 이 SPEC은 **실행 주체**만 바꾼다(사람 → CI).

### Out of Scope — `label-sync.yml` 변경
- 기존 라벨 동기화 워크플로는 이번 SPEC에서 수정하지 않는다. 새 워크플로는 별도 파일로 추가된다.
