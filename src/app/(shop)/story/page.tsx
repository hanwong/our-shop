import type { Metadata } from "next";

/**
 * SPEC-BRAND-001 M6 — `/story`, a purely static brand-story page
 * (REQ-BRAND-018/019, design.md §3.4).
 *
 * CONFIRMED COPY (design.md §2.5, 2026-09-07 correction cycle). The body
 * text below is the live Claude Design source's actual "한 켤레에 나흘"
 * copy block, re-confirmed by the sync-phase session's live DesignSync
 * re-query — it replaces the earlier PROVISIONAL carefully-authored
 * substitute copy (design.md §8.3 item 4, now resolved).
 *
 * Note: this source states the size range as "240–330mm", which conflicts
 * with /bespoke's REQ-BRAND-017/AC-BRAND-018-locked "285mm부터 330mm까지"
 * wording — see design.md §2.5 for the reconciliation note (unresolved,
 * left to a SPEC-body-owning follow-up; /bespoke intentionally NOT changed
 * here, see this SPEC's progress.md correction-cycle entry).
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
          가죽을 재단하고, 갑피를 꿰매고, 라스트에 씌워 사흘을 두었다가 겉창을 붙입니다. 굽을
          쌓고 마감하는 데 다시 하루. 공정을 줄이지 않는 대신 한 번에 여러 켤레를 만들지
          않습니다.
        </p>
        <p>사이즈 240–330mm · 가격대 ₩150,000–300,000 · 제작 기간 약 4주</p>
      </div>
    </main>
  );
}
