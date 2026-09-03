# Design: SPEC-STOREFRONT-002 — 장바구니 화면 레이아웃 및 체크아웃 스타일 정리안

> Conditional Design Route 산출물 (plan.md §G). `plan → design → run` 경로를 따라 Implementation
> Kickoff Approval 이후, run-phase M1 착수 이전에 manager-design이 작성했다.
> 이 SPEC은 Tier M(2~3개 산출물)이라 design.md가 필수 산출물은 아니지만, §G가 예고한 디자인 산출물을
> 담을 곳이 필요해 추가 산출물로 둔다 — plan.md의 §A~§K 결정을 뒤집지 않는다.

## §0. 연결 상태와 파이프라인 적용 범위 (D1 — 도구 가용성)

`.mcp.json`에 DesignSync MCP 서버가 등록되어 있지 않다 — `list_projects`/`create_project`/
`write_files`/`get_file` 등 11개 도구 전부가 이 세션에서 호출 불가능하다. `manager-design.md` §Tool
Availability의 graceful-degradation 경로를 따른다: D2(디자인 시스템 코드→Claude Design 동기화)와
D3(Claude Design 캔버스 스크린 산출물 생성)는 이번 세션에서 실행하지 않는다.

이 문서가 담는 것은 D4/D5에 해당하는 **핸드오프 산출물의 로컬 등가물**이다 — Claude Design 캔버스를
거치지 않고, 저장소에 이미 확립된 Tailwind 컨벤션(STOREFRONT-001/ORDER-001/DISCOUNT-001/PAYMENT-001이
`src/app/products`·`src/components/checkout`에 남긴 실제 클래스 사용례)을 1차 자료로 삼아 레이아웃
결정과 체크아웃 정리안을 직접 기술한다. `.moai/design/`(브랜드 토큰 디렉터리)는 아직 어떤
design-system 실행으로도 생성된 적이 없다 — H4의 "브랜드 토큰 디렉터리 부재 시 충돌 대상 없음" 규정에
따라 이 문서의 결정이 곧바로 적용된다.

**재동기화가 필요해지는 조건**: DesignSync가 이후 `.mcp.json`에 등록되면, D2를 실행해 이 SPEC이 새로
만드는 4개 컴포넌트(`CartView`/`EmptyCart`/`AddToCartButton`)를 Claude Design 프로젝트로 올리고,
그 컴포넌트를 기준으로 §1~§2의 레이아웃 결정을 캔버스 스크린으로 재현할 수 있다. 그 전까지는 아래
결정이 run-phase의 유일한 레이아웃 사양이다.

## §1. 참조한 기존 시각 언어 (drift 방지)

이 SPEC은 새 디자인 토큰 체계를 만들지 않는다(spec.md §3 Out of Scope — 디자인 시스템·재사용 컴포넌트
라이브러리 구축은 범위 밖). 아래는 `src/app/products`·`src/components/product`·
`src/components/checkout`에서 실측한 기존 값이며, `CartView`/`EmptyCart`/`AddToCartButton`은 이
값들만 재사용한다 — 새 색상 토큰이나 새 spacing 스케일을 발명하지 않는다.

| 범주 | 확립된 값 | 실측 근거 |
|---|---|---|
| 본문 컨테이너 폭 | `mx-auto max-w-3xl px-4 py-8`(단일 컬럼 화면), `mx-auto max-w-4xl px-4 py-8`(2단 레이아웃 화면) | `ProductDetailView.tsx`, `app/checkout/page.tsx` |
| 카드/섹션 컨테이너 | `rounded-lg border border-neutral-200 p-4` | `OrderSummary.tsx`, `CheckoutInteractive.tsx` 쿠폰 섹션 |
| 입력 필드 | `rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900` | `CheckoutForm.tsx`, `CheckoutInteractive.tsx` |
| 1차 버튼(검정 배경) | `rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60` | `CheckoutForm.tsx` 제출 버튼, `CheckoutInteractive.tsx` 적용 버튼 |
| 목록 구분선 | `divide-y divide-neutral-100` | `OrderSummary.tsx` 품목 목록 |
| 오류 문구 | `text-sm text-red-600`(단일 문구), `text-xs font-medium text-red-600`(줄 단위 보조 문구) | `CheckoutForm.tsx`, `OrderSummary.tsx` `stockNotice` |
| 상태(중립) 문구 | `text-sm text-neutral-700` | `CheckoutInteractive.tsx` `role="status"` 영역 |
| 안내 화면(빈 상태) | `mx-auto max-w-xl px-4 py-16 text-center`, h1 `text-xl font-semibold text-neutral-900`, 본문 `mt-4 text-sm leading-relaxed text-neutral-700` | `CheckoutUnavailable.tsx` |
| 표제(h1) | `text-2xl font-semibold text-neutral-900` | `app/checkout/page.tsx`, `ProductDetailView.tsx`(단, 상품명은 태그가 h1) |
| 표제(h2, 섹션) | `text-lg font-semibold text-neutral-900` | `OrderSummary.tsx`, `CheckoutForm.tsx` |
| 원화 포맷 | `${new Intl.NumberFormat("ko-KR").format(n)}원` (통화 기호·소수점 없음) | `ProductDetailView.tsx` `formatWon`, `OrderSummary.tsx` `formatWon` — **동일 로직이 이미 2곳에 중복 존재**, `CartView`가 3번째 사본을 만들지 않도록 §2에서 지시 |
| 2단 그리드 분기점 | `grid gap-8 md:grid-cols-2` | `CheckoutInteractive.tsx` (`CheckoutForm` + `OrderSummary` 배치) |

## §2. `CartView` — 품목 줄 레이아웃 (모바일/데스크톱 분기점)

### 분기점 선택 — `md:` (프로젝트 유일 선례를 따름)

저장소에서 반응형 분기점이 쓰인 곳은 `CheckoutInteractive.tsx`의 `md:grid-cols-2` 한 곳뿐이다. 새
분기점(`sm:`, `lg:`)을 도입하는 대신 그 선례를 그대로 따른다 — `md:`(기본 768px) 미만은 모바일 배치,
`md:` 이상은 데스크톱 배치.

### 품목 줄 마크업 형태

```
<li className="flex flex-col gap-3 border-b border-neutral-100 py-4
               md:flex-row md:items-center md:gap-4 last:border-b-0">
  {/* 이미지 — 정사각 썸네일, 고정 크기 (모바일/데스크톱 공통) */}
  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-md bg-neutral-100">
    <img className="h-full w-full object-cover" ... />  {/* 대체 표시: 이미지 없을 때 배경만 남김 */}
  </div>

  {/* 이름 + 단가 — 모바일: 이미지 아래 전체 폭. 데스크톱: 이미지 옆, 나머지 폭을 가짐 */}
  <div className="min-w-0 flex-1">
    <p className="truncate text-sm font-medium text-neutral-900">{name}</p>
    <p className="mt-1 text-xs text-neutral-500">{formatWon(price)}</p>
  </div>

  {/* 수량 스테퍼 — §3 참조. 모바일: 이름 아래, 왼쪽 정렬. 데스크톱: 가운데 고정폭 컬럼 */}
  <div className="md:w-32 md:shrink-0">…스테퍼…</div>

  {/* 품목 합계 + 삭제 — 모바일: 스테퍼 옆(justify-between). 데스크톱: 오른쪽 고정폭 컬럼 */}
  <div className="flex items-center justify-between gap-3 md:w-40 md:shrink-0 md:justify-end">
    <p className="text-sm text-neutral-900">{formatWon(lineTotal)}</p>
    <button aria-label={`${name} 삭제`} className="text-xs text-neutral-500 hover:text-red-600">
      삭제
    </button>
  </div>

  {/* 오류(REQ-STOREFRONT-020) — role="alert", 항상 이 줄에만 표시. 존재할 때만 렌더 */}
  {error ? (
    <p role="alert" className="text-xs text-red-600 md:basis-full md:pl-24">{error}</p>
  ) : null}
</li>
```

근거:
- `border-b border-neutral-100` + `last:border-b-0`은 `OrderSummary`의 `divide-y divide-neutral-100`과
  동일한 시각 효과를 개별 `<li>` 오류 삽입이 있어도 깨지지 않는 형태로 재현한 것이다 — `divide-y`는
  형제 사이에만 선을 그리므로 조건부로 끼어드는 오류 `<p>`가 그 사이에 들어가면 구분선이 어긋난다.
- `h-20 w-20`은 이 프로젝트에 선례가 없는 새 크기 값이다 — `ProductGallery`가 갤러리용 큰 이미지만
  다루고, 목록형 썸네일 크기의 선례가 없기 때문에 도입이 불가피하다. `rounded-md`(기존 스케일)와
  `bg-neutral-100`(기존 팔레트)만 새로 조합했다.
- 데스크톱 3-컬럼 고정폭(`md:w-32`, `md:w-40`)은 스테퍼와 합계가 항목마다 서로 다른 위치에 있으면
  세로로 훑어 비교하기 어렵다는 점(§ tabular numbers/optical alignment 원칙)을 반영한 것 — 시각적
  스캔 정렬을 위한 최소 장치이며 새 색상·타이포그래피 토큰은 만들지 않는다.

### `formatWon` 중복 처리 (Enforce Simplicity)

`ProductDetailView.tsx`와 `OrderSummary.tsx`가 이미 동일한 `formatWon` 함수를 각자 파일에 갖고 있다.
plan.md §F는 `src/components/ui/` 같은 재사용 라이브러리 구축을 범위 밖으로 뒀으므로(spec.md §3), 이
SPEC도 공용 유틸 모듈을 새로 만들지 않는다 — `CartView`와 `AddToCartButton`도 각자 파일 내부에 동일한
1줄짜리 `formatWon`을 갖는 세 번째(·네 번째) 사본을 둔다. 세 번째 사본이 이미 확립된 패턴을 반복하는
것이므로 새로운 부채가 아니라 기존 결정(재사용 라이브러리 미구축)의 자연스러운 연장이다.

## §3. 수량 스테퍼의 시각적 형태

```
<div className="inline-flex items-center rounded-md border border-neutral-300">
  <button
    type="button"
    aria-label={`${name} 수량 감소`}
    disabled={quantity <= 1}
    className="flex h-8 w-8 items-center justify-center text-sm text-neutral-700
               disabled:opacity-40"
  >
    −
  </button>
  <span className="w-8 text-center text-sm tabular-nums text-neutral-900">{quantity}</span>
  <button
    type="button"
    aria-label={`${name} 수량 증가`}
    disabled={quantity >= stock}
    className="flex h-8 w-8 items-center justify-center text-sm text-neutral-700
               disabled:opacity-40"
  >
    +
  </button>
</div>
```

근거:
- 바깥 `rounded-md border border-neutral-300` 컨테이너는 기존 입력 필드 테두리 스타일(§1 표)을 그대로
  재사용한다 — 스테퍼를 "숫자를 입력/조작하는 컨트롤"로 같은 시각적 계열에 두기 위함이다. 안쪽 버튼은
  테두리를 갖지 않고(컨테이너가 이미 테두리를 그림), `h-8 w-8`(32px) 정사각 히트 영역만 갖는다 —
  concentric radius 원칙(바깥 반경 ≥ 안쪽 반경)을 지키기 위해 버튼 자체에는 `rounded` 클래스를 주지
  않는다(정사각 버튼이 사각 컨테이너 안에 있으므로 별도 라운딩이 필요 없다).
- `tabular-nums`는 이 저장소 다른 곳에 선례가 없는 새 유틸리티지만, Tailwind 코어 유틸리티(임의값이
  아님)이고 REQ-STOREFRONT-030의 접근성 요구와 무관하게 숫자가 바뀔 때 폭이 흔들리지 않게 하는 표준
  관행이다. 새 색상/spacing 토큰을 추가하지 않으므로 §E 경계 밖의 체크아웃 파일에는 영향이 없다(이
  스테퍼는 신규 컴포넌트 `CartView` 안에만 존재).
- `disabled:opacity-40`은 기존 버튼의 `disabled:opacity-60`(§1 표)과 다른 값이다 — 의도적 차이다.
  기존 `opacity-60`은 "제출 중" 같은 일시적 비활성 상태(다시 활성화될 것이 분명한 로딩 상태)에 쓰인
  반면, 스테퍼의 -/+ 버튼은 하한(1)·상한(재고)에 도달한 **구조적** 비활성 상태다. 더 흐리게
  처리해(opacity-40) "이 버튼은 지금 이 항목 조합에서 의미가 없다"는 신호를 로딩 상태와 구분한다.
  run-phase에서 이 구분이 과하다고 판단되면 `opacity-60`으로 통일해도 REQ 위반은 아니다 — 이 판단은
  design.md가 제안하는 것이지 acceptance.md가 고정한 것이 아니다.

## §4. `EmptyCart` 레이아웃

`CheckoutUnavailable.tsx`(§1 표의 "안내 화면" 행)을 그대로 재현한다 — 같은 부류의 화면(진행할 수
없는 이유를 설명하고 다음 행동을 제시)이므로 새 레이아웃을 발명하지 않는다.

```
<section className="mx-auto max-w-xl px-4 py-16 text-center">
  <h1 className="text-xl font-semibold text-neutral-900">장바구니가 비어 있습니다</h1>
  <p className="mt-4 text-sm leading-relaxed text-neutral-700">
    아직 담은 상품이 없습니다. 상품을 둘러보고 장바구니에 담아 보세요.
  </p>
  <a href="/products" className="mt-6 inline-block rounded-md bg-neutral-900 px-4 py-2
                                   text-sm font-medium text-white">
    상품 목록으로 이동
  </a>
</section>
```

`CheckoutUnavailable`과의 유일한 구조적 차이는 마지막 줄의 링크다 — REQ-STOREFRONT-017이 "상품 목록
으로 이동할 수 있는 링크"를 명시적으로 요구하기 때문이고, `CheckoutUnavailable`에는 그런 요구가 없다.
버튼 스타일은 §1의 1차 버튼 값을 `<a>`에 그대로 옮긴 것(새 값 없음).

## §5. `AddToCartButton` 레이아웃 (상품 상세 조립)

```
<div className="mt-6 flex items-end gap-3">
  <div>
    <label htmlFor={qtyId} className="block text-sm font-medium text-neutral-800">수량</label>
    <input
      id={qtyId}
      type="number"
      min={1}
      defaultValue={1}
      className="mt-1 w-20 rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900"
    />
  </div>
  <button
    type="button"
    disabled={stock === 0}
    className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white
               disabled:opacity-60"
  >
    장바구니에 담기
  </button>
</div>
{/* 성공/실패 — 동일 role="status" 영역을 상호 배타적으로 렌더 (§D, CheckoutInteractive와 동형) */}
<div role="status" aria-live="polite" className="mt-2 text-sm text-neutral-700">
  {/* 성공: "장바구니에 담았습니다 · " + /cart 링크. 실패: role="alert"로 교체, text-red-600 */}
</div>
```

배치 지점: `ProductDetailView.tsx`의 재고 표시 문단(`재고 {stock}개 남음`, 현재 42-50행) 바로 아래,
설명 문단 위. `mt-6`은 그 파일이 이미 문단 사이에 쓰는 간격(`mt-6 whitespace-pre-line ...`, 54행)과
동일한 값이라 새 간격 스케일을 추가하지 않는다.

수량 입력은 `type="number" min={1}`을 쓴다 — `CheckoutForm.tsx`의 다섯 필드는 전부 `type="text"`이지만
그것은 우편번호·전화번호처럼 브라우저의 숫자 스피너 UI가 부적절한 필드들이기 때문이고, 여기서는 정수
수량이라 네이티브 `number` 입력이 REQ-STOREFRONT-024의 "하한 1" 요구를 `min` 속성으로 무료로 얻는다 —
이 선택은 §1의 "입력 필드" 시각 스타일(테두리·라운딩·패딩·폰트 크기)은 그대로 재사용하고 `type` 속성만
문맥에 맞게 바꾼 것이다.

## §6. 체크아웃 6개 파일 — Tailwind 클래스 정리안 (§E 경계 안)

plan.md §E의 규칙을 그대로 적용한다: 아래에 나열되지 않은 모든 것 — `useState`/`useEffect`/`fetch`/
이벤트 핸들러·import 목록 — 은 diff 0줄이어야 한다. 다음은 실제 저장소를 읽고 확인한 **구체적** 발견
2건이며, 둘 다 `className` 문자열 리터럴 내부의 한 토큰만 바꾼다(로직 변경 없음).

| # | 파일:줄 | 현재 | 제안 | 근거 |
|---|---|---|---|---|
| C1 | `src/components/checkout/PayButton.tsx:59` | `className="mt-2 text-sm text-red-700"` | `className="mt-2 text-sm text-red-700 text-red-600"` (실질: `text-red-700` → `text-red-600`) | 체크아웃 6개 파일 전체에서 오류 문구 색상이 `text-red-600`으로 통일돼 있다(§1 표 근거: `CheckoutForm.tsx` 3곳, `CheckoutInteractive.tsx` 1곳, `OrderSummary.tsx` 1곳). `PayButton.tsx`만 `red-700`을 쓰는 유일한 예외이며, 텍스트 성격(제출 실패 안내)도 동일하다. |
| C2 | `src/components/checkout/PayButton.tsx:54` | `className="w-full rounded-md bg-neutral-900 px-4 py-3 text-sm font-medium text-white disabled:opacity-60"` | `py-3` → `py-2` | 같은 "전체 폭 1차 검정 버튼" 역할의 다른 두 버튼(`CheckoutForm.tsx` 제출 버튼, `CheckoutInteractive.tsx` 적용 버튼)이 전부 `py-2`를 쓴다. `py-3`는 체크아웃 6개 파일 안에서 버튼에 쓰인 유일한 사례다(다른 `py-3` 용례는 `OrderSummary.tsx`의 목록 항목 수직 패딩으로, 버튼이 아니라 무관). REQ-STOREFRONT-028이 요구하는 "타이포그래피·색상뿐 아니라 여백의 일관성"에 정확히 해당하는 항목. |

검토했으나 **정리 대상에서 제외**한 항목(근거를 남겨 재검토 낭비를 막는다):

- **h1 크기 차이** (`app/checkout/page.tsx` `text-2xl` vs `CheckoutUnavailable.tsx` `text-xl`) — 서로
  다른 화면 성격(진행 중인 주요 화면 vs 안내/오류 화면)에 대응하는 기존 스케일 구분으로 보인다.
  `ProductDetailView`가 상품명(핵심 데이터)에 `text-2xl`을 쓰는 것과 대칭적이라 의도된 차이로 판단,
  변경 제안하지 않는다.
- **배지/색상 계열 다양성** (`checkout/complete/[orderId]/page.tsx`의 `red-50`/`amber-50`/
  `emerald-50` 알림 박스) — 이 파일은 §E가 정의한 체크아웃 6개 파일 목록(`page.tsx`,
  `CheckoutForm.tsx`, `OrderSummary.tsx`, `CheckoutInteractive.tsx`, `CheckoutUnavailable.tsx`,
  `PayButton.tsx`)에 포함되지 않는다 — spec.md §3이 명시적으로 PRESERVE 대상으로 지정한 주문 완료
  화면이므로 이 정리안의 범위 밖이다.

## §7. H6 검증 체크리스트 (run-phase 착수 전 재확인용)

design.md 자체는 라이브 렌더 산출물이 없으므로 `report_validate`의 bad/thin/variantsIdentical 지표는
적용되지 않는다(D3 미실행, §0). 대신 아래를 run-phase 착수 시 재확인한다:

- [ ] §2~§5가 인용한 모든 클래스 조합(`rounded-lg border border-neutral-200 p-4` 등)이 실제 구현
      시점에도 §1 표의 실측 값과 일치하는지 — 표 작성 이후 체크아웃 파일이 바뀌었다면 재동기화 필요.
- [ ] §6의 diff가 실제로 `className` 리터럴 토큰 교체 2건으로 끝나는지 — `git diff --stat`으로
      6개 파일 각각의 변경 줄 수를 확인하고, non-className 줄 diff 0건을 사람이 검토
      (acceptance.md AC-STOREFRONT-029).
- [ ] 새로 도입한 유일한 미선례 유틸리티(`h-20 w-20` 썸네일 크기, `tabular-nums`)가 다른 화면에
      의도치 않게 새어나가지 않았는지 — 둘 다 `CartView` 내부로 스코프 확인.

## §8. run-phase 인계 메모 (H8 요약 — 실제 위임은 오케스트레이터가 수행)

- **핸드오프 파일 경로**: 이 문서 자체(`.moai/specs/SPEC-STOREFRONT-002/design.md`) 하나. Claude
  Design 캔버스 산출물 없음(§0).
- **보존 목록(PRESERVE)**: `src/app/checkout/complete/[orderId]/page.tsx`(§6에서 범위 밖으로 확인),
  체크아웃 6개 파일의 로직·상태·이벤트 핸들러·import 전부, `src/features/cart/**`(spec.md §1 재확인).
- **주석-검증 명령**: `git diff --stat -- src/app/checkout src/components/checkout`,
  기존 체크아웃 테스트 스위트 무회귀(AC-STOREFRONT-028).
- **주해→요구사항 매핑**: 이 세션은 Claude Design 캔버스 주해를 받지 않았으므로(D3 미실행) H5의
  주해→요구사항 매핑 표는 해당 없음 — 대신 §6의 표(발견 2건 + 제외 항목 근거)가 그 역할을 한다.
