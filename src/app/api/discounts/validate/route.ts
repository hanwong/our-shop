import { NextResponse } from "next/server";

import { validateCoupon } from "@/features/discounts/services/discount-service";
import { checkIpRateLimit } from "@/lib/auth/rate-limit";

/**
 * SPEC-DISCOUNT-001 M6a — POST /api/discounts/validate (design.md §5,
 * REQ-DISCOUNT-025).
 *
 * A stateless precheck: given a code and an `itemsSubtotal`, returns the
 * discount M3's `validateCoupon` computes, or the rejection reason. It calls
 * `validateCoupon` with NO transaction client (the 4th, optional parameter is
 * never passed), so `findCouponByCode` resolves to its singleton-read default
 * and the entire call graph never reaches `incrementRedeemedCountIfAvailable`
 * — this endpoint MUST NEVER touch `Coupon.redeemedCount` in any way
 * (REQ-DISCOUNT-025, safety-critical). It does not open a Prisma transaction,
 * does not create an `Order`, and does not resolve a guest identity: no cart
 * is touched and none is needed (design.md §5).
 *
 * The response this endpoint returns is a convenience, not an enforcement —
 * the real gate is the order transaction's conditional atomic update
 * (REQ-DISCOUNT-016). A code this endpoint approved may still be exhausted by
 * the time the shopper submits the order, and that later refusal is correct
 * (design.md §5).
 *
 * Rate limiting: design.md §5 / research.md §5 originally left this
 * enumeration-shaped endpoint's abuse risk deliberately undefended — an
 * honestly-disclosed gap, not a hidden one, but never confirmed with the
 * user as an accepted risk and never given a tracking card either. A
 * sync-phase security review flagged it (4 distinguishable failure codes +
 * no rate limiting = a scriptable coupon-code oracle) and the user chose to
 * close it now rather than defer it: this route reuses the SAME
 * `checkIpRateLimit` utility `/api/auth/login` already uses (REQ-AUTH-021),
 * keyed under its own `"discount-validate"` bucket so it does not share
 * budget with login attempts.
 *
 * Body validation mirrors orders/route.ts's shape (malformed JSON -> 400,
 * field-level errors -> 400 with `fieldErrors`), scaled down to this
 * endpoint's two fields.
 */

const MISSING = "필수 항목입니다";

type ParsedBody =
  | { ok: true; code: string; itemsSubtotal: number }
  | { ok: false; fieldErrors: Record<string, string> };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseBody(body: unknown): ParsedBody {
  if (!isRecord(body)) {
    return { ok: false, fieldErrors: { body: "요청 본문의 형식이 올바르지 않습니다" } };
  }

  const fieldErrors: Record<string, string> = {};

  const rawCode = body.code;
  const code = typeof rawCode === "string" ? rawCode.trim() : "";
  if (code === "") fieldErrors.code = MISSING;

  const itemsSubtotal = body.itemsSubtotal;
  if (typeof itemsSubtotal !== "number" || !Number.isSafeInteger(itemsSubtotal)) {
    fieldErrors.itemsSubtotal = "정수 금액이어야 합니다";
  }

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  return { ok: true, code, itemsSubtotal: itemsSubtotal as number };
}

export async function POST(request: Request): Promise<Response> {
  // Runs before any parsing or DB access — an unthrottled coupon-code oracle
  // is exactly what this check exists to close (see the module doc above).
  if (!checkIpRateLimit("discount-validate", request).allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = parseBody(body);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: "요청을 확인해 주세요", fieldErrors: parsed.fieldErrors },
      { status: 400 }
    );
  }

  // No 3rd-party `client` argument — see the module doc: this is the
  // caller-side half of the write-free guarantee.
  const result = await validateCoupon(parsed.code, parsed.itemsSubtotal, new Date());

  if (result.ok) {
    return NextResponse.json({ discountAmount: result.discountAmount }, { status: 200 });
  }

  const { ok, status, ...failure } = result;
  void ok;
  return NextResponse.json(failure, { status });
}
