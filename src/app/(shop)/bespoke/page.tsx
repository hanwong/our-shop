import type { Metadata } from "next";

/**
 * SPEC-BRAND-001 M6 — `/bespoke`, a purely static ordering-guide page
 * (REQ-BRAND-017/019, design.md §3.4).
 *
 * Layout follows design.md §3.4's confirmed decision: the UI Kit's "주문
 * 제작 안내" callout skeleton — heading + a spec list (사이즈 범위 / 제작
 * 방식 / 제작 기간 / 가격대) + a short brand paragraph. No form, no submit
 * button, no cart control (REQ-BRAND-019 / AC-BRAND-020) — this route has
 * exactly one interactive-element class available to it, and this page uses
 * none of them; there is not even a nav `<a>` in the body (SiteHeader's nav
 * lives one level up in the shared layout).
 *
 * All four landmark facts are copied verbatim from confirmed brand copy —
 * NOT PROVISIONAL: research.md §2 (사이즈 범위 / 제작 방식 / 가격대) and
 * plan.md §B.3 (제작 기간 "약 4주", the majority-consistency judgment; design
 * phase left this specific re-confirmation PROVISIONAL per design.md §2.4,
 * but the VALUE ITSELF plan.md §B.3 already settled and design.md kept
 * unchanged — only its live-source re-confirmation is outstanding).
 */
export const metadata: Metadata = {
  title: "BESPOKE | OUR",
  description: "OUR 주문 제작 안내 — 사이즈 범위, 제작 방식, 제작 기간, 가격대.",
};

export default function BespokePage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-semibold text-text">주문 제작 안내</h1>

      <dl className="mt-8 space-y-6 text-sm">
        <div>
          <dt className="font-medium text-text">사이즈 범위</dt>
          <dd className="mt-1 text-neutral-700">285mm부터 330mm까지</dd>
        </div>
        <div>
          <dt className="font-medium text-text">제작 방식</dt>
          <dd className="mt-1 text-neutral-700">주문을 받은 뒤 한 켤레씩 손으로 꿰맵니다</dd>
        </div>
        <div>
          <dt className="font-medium text-text">제작 기간</dt>
          <dd className="mt-1 text-neutral-700">약 4주</dd>
        </div>
        <div>
          <dt className="font-medium text-text">가격대</dt>
          <dd className="mt-1 text-neutral-700">15만원에서 30만원 사이</dd>
        </div>
      </dl>

      <p className="mt-10 leading-relaxed text-neutral-800">
        OUR은 기성 사이즈가 맞지 않는 큰 발을 위한 수제화 브랜드입니다. 치수를 미리 입력받거나
        상담을 예약하는 절차 없이, 이 페이지는 주문 제작이 어떻게 이루어지는지만 안내합니다.
      </p>
    </main>
  );
}
