import type { ProductInput, ProductInputErrors } from "@/features/admin/types/admin";

/**
 * SPEC-ADMIN-002 M2 — product input validation (REQ-ADMIN-026/027/029/030).
 *
 * ONE parser, shared by `POST /staff/api/products` and
 * `PATCH /staff/api/products/[productId]`. Writing the rules once is the point:
 * two copies would drift, and the two routes would start disagreeing about the
 * same submission (design.md §4).
 *
 * Hand-written rather than schema-library-driven because `zod` is not a
 * dependency of this project and this SPEC adds none (AC-ADMIN-028). The same
 * hand-rolled style product-service.ts's parseListQuery and cart-service.ts's
 * parseQuantity already use.
 *
 * Framework-independent: no `next/*`, no `@prisma/client`.
 */

/** Every field is reported at once, so the admin fixes one form, not six (REQ-ADMIN-030). */
export type ParseProductInputResult =
  | { ok: true; data: ProductInput }
  | { ok: false; errors: ProductInputErrors };

const MESSAGES = {
  name: "이름을 입력해 주세요",
  description: "설명을 입력해 주세요",
  price: "가격은 1원 이상의 정수여야 합니다",
  stock: "재고는 0개 이상의 정수여야 합니다",
  categoryId: "카테고리를 선택해 주세요",
  images: "이미지는 http/https로 시작하는 절대 URL이어야 합니다",
} as const satisfies Record<keyof ProductInput, string>;

/** Non-empty once surrounding whitespace is discounted. */
function parseText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * The largest value a PostgreSQL `Int` column can hold. Product.price and
 * Product.stock are both `Int`, so this is the real ceiling on a submission —
 * not `Number.MAX_SAFE_INTEGER`, which is far above what the column accepts.
 */
const INT32_MAX = 2147483647;

/**
 * A whole number within `[min, INT32_MAX]`.
 *
 * `Number.isSafeInteger` rejects the three shapes a numeric form field can
 * arrive in badly — a decimal, a NaN, and an Infinity — in one test, and it
 * rejects numeric STRINGS too: the routes parse JSON bodies, so a quoted
 * "39000" is a client that did not send what it claimed, not a value to
 * coerce. Product.price and Product.stock are both `Int` columns, so a
 * non-integer could not be stored faithfully anyway.
 *
 * The upper bound is the same column constraint read from the other end.
 * `Number.isSafeInteger(2147483648)` is true — it is a perfectly ordinary
 * JavaScript integer — but the column cannot hold it, so without this check the
 * value passed validation, reached Prisma, and came back as an uncaught server
 * error: a 500 reachable from ordinary form input. Bounding it here turns that
 * into the same field-level rejection every other bad value already gets.
 */
function parseWholeNumber(value: unknown, min: number): number | null {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) return null;
  return value >= min && value <= INT32_MAX ? value : null;
}

/**
 * A list of absolute http/https URLs; an empty list is valid (REQ-ADMIN-027) —
 * a product may be registered before its photos exist.
 *
 * The protocol allowlist is the load-bearing part: `new URL()` alone happily
 * accepts `javascript:alert(1)`, which would then be rendered into an
 * <img src>. Restricting to http/https is what keeps an admin-supplied string
 * from becoming a script URL on the storefront.
 */
function parseImages(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;

  const urls: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") return null;
    let parsed: URL;
    try {
      parsed = new URL(entry);
    } catch {
      return null;
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    urls.push(entry);
  }
  // Order is preserved deliberately: Product.images' array order IS the
  // display order (schema.prisma's own comment on the column).
  return urls;
}

/**
 * Validates a submitted product body.
 *
 * `categoryId` is checked for PRESENCE only — existence is settled by the
 * foreign-key constraint at write time. An application-level pre-check would
 * still race with a category deleted between the check and the insert, so the
 * FK violation is the only race-free judgment available (design.md §4). The
 * form's <select> already lists real rows, so that path is a defence, not the
 * normal flow.
 *
 * `isActive` is never read from the body: sellability moves only through
 * PATCH .../active, so an edit submission cannot flip it (design.md §1).
 */
export function parseProductInput(body: unknown): ParseProductInputResult {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    // Every field is missing, so every field is reported — the caller gets a
    // usable form response rather than a bare "malformed body".
    return {
      ok: false,
      errors: { ...MESSAGES },
    };
  }

  const raw = body as Record<string, unknown>;

  const name = parseText(raw.name);
  const description = parseText(raw.description);
  const price = parseWholeNumber(raw.price, 1);
  const stock = parseWholeNumber(raw.stock, 0);
  const categoryId = parseText(raw.categoryId);
  const images = parseImages(raw.images);

  const errors: ProductInputErrors = {};
  if (name === null) errors.name = MESSAGES.name;
  if (description === null) errors.description = MESSAGES.description;
  if (price === null) errors.price = MESSAGES.price;
  if (stock === null) errors.stock = MESSAGES.stock;
  if (categoryId === null) errors.categoryId = MESSAGES.categoryId;
  if (images === null) errors.images = MESSAGES.images;

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    data: {
      name: name!,
      description: description!,
      price: price!,
      stock: stock!,
      categoryId: categoryId!,
      images: images!,
    },
  };
}
