import type { Metadata } from "next";

/**
 * SPEC-BRAND-001 M6 — `/story`, a purely static brand-story page
 * (REQ-BRAND-018/019, design.md §3.4).
 *
 * ⚠️ PROVISIONAL COPY (design.md §2.5 / §8.3 item 4). The body text below is
 * NOT a verbatim transcription of the live Claude Design source — DesignSync
 * was unavailable during design phase (user-approved code-based fallback).
 * It was carefully authored from confirmed facts only (research.md §2:
 * 285-330mm, hand-sewn, ~4 weeks) and spec.md §1's craftsmanship framing.
 * Replace with the actual source copy once DesignSync access is restored
 * (design.md §8.3's PROVISIONAL handoff list, item 4).
 *
 * Single-flow prose layout, no callout block (design.md §3.4) — distinct
 * from /bespoke's structured spec list. No form, no submit button, no cart
 * control (REQ-BRAND-019 / AC-BRAND-020).
 */
export const metadata: Metadata = {
  title: "STORY | OUR",
  description: "OUR의 브랜드 스토리 — 한 켤레에 나흘.",
};

export default function StoryPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-semibold text-text">한 켤레에 나흘</h1>

      <div className="mt-6 space-y-4 leading-relaxed text-neutral-800">
        <p>
          OUR의 신발은 주문을 받은 뒤 한 켤레씩 손으로 꿰맵니다. 재단부터 마무리까지, 한 켤레를
          완성하는 데 꼬박 나흘이 걸립니다.
        </p>
        <p>
          기계가 대신할 수 없는 공정을 고집하는 이유는 단순합니다 — 285mm부터 330mm까지, 큰
          사이즈일수록 손으로 다듬는 균형이 더 중요해지기 때문입니다.
        </p>
        <p>
          주문 후 완성까지는 약 4주가 걸립니다. 그 시간 동안 신발장 속 신발이 아니라, 발에 맞춰
          만들어지는 한 켤레를 기다려 주십시오.
        </p>
      </div>
    </main>
  );
}
