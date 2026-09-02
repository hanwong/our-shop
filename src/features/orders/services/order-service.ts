import { randomBytes } from "node:crypto";

import { prisma } from "@/lib/db";
import { findCartByGuestId, deleteCart } from "@/features/cart/repositories/cart-repository";
import {
  createOrderWithItems,
  decrementStockIfAvailable,
  findOrderByIdempotencyKey,
  findOrderForGuest,
  findStockByProductIds,
  type OrderWithItems,
} from "@/features/orders/repositories/order-repository";
import type {
  CreateOrderInput,
  InsufficientStockProduct,
  OrderDTO,
  OrderFailure,
  OrderItemDTO,
  OrderResult,
  ShippingInfo,
} from "@/features/orders/types/order";

/**
 * SPEC-ORDER-001 M3 — order creation, and the guest-scoped read-back.
 *
 * Traces: REQ-ORDER-002 (snapshot), REQ-ORDER-003 (order number and frozen
 * amounts), REQ-ORDER-004 (nothing below quantity 1 is persisted),
 * REQ-ORDER-010 (validation persists nothing), REQ-ORDER-011/012 (four effects,
 * one transaction), REQ-ORDER-013 (stock), REQ-ORDER-014 (confirmed total),
 * REQ-ORDER-015 (empty cart), REQ-ORDER-016 (idempotency), REQ-ORDER-017
 * (pending_payment), REQ-ORDER-020 (read-back is guest-scoped).
 *
 * This module owns the TRANSACTION BOUNDARY. That is the whole reason it exists
 * as a layer: until this SPEC, the cart promised nothing — prices were read live
 * and stock was only ever checked, never held (SPEC-CART-001 REQ-CART-015). The
 * moment an order is created is the first time this shop makes a promise, so
 * the four effects that constitute it have to be indivisible (REQ-ORDER-012).
 *
 * Framework-independent, matching cart-service.ts: it takes a guest id and a
 * parsed body, and returns discriminated results. HTTP mapping belongs to the
 * route handler.
 *
 * The identity argument is a plain guest id STRING rather than a CartIdentity
 * union. That is not a simplification — it is the guest-only scope showing up
 * in the type: there is no member branch to dispatch on, because a member
 * cannot reach a server-rendered checkout at all (spec.md §3, research.md §6).
 * The route rejects member credentials before calling this function at all.
 *
 * @MX:ANCHOR fan-in target — POST /api/orders and the completion screen both
 * enter the order domain exclusively through this module.
 * @MX:REASON createOrder() is the only place stock is ever decremented, so a
 * regression here either oversells the shop or takes payment-pending stock that
 * nothing gives back.
 */

// ---------------------------------------------------------------------------
// Provisional policy — isolated on purpose
// ---------------------------------------------------------------------------

/**
 * The shipping fee (plan.md §0 #3 — a PROVISIONAL decision, open to revision).
 *
 * Returns 0 for every subtotal. Zero rather than an invented figure such as
 * 3,000: a made-up number would harden into a decision nobody actually made,
 * spreading through tests, fixtures and screens until it looked settled. When a
 * real policy arrives, this function's body is the only thing that changes —
 * the `shippingFee` column and every call site already exist.
 */
export function calculateShippingFee(itemsSubtotal: number): number {
  void itemsSubtotal;
  return 0;
}

// ---------------------------------------------------------------------------
// Identifier generation
// ---------------------------------------------------------------------------

/** Uppercase alphanumerics — unambiguous when a shopper reads a number aloud. */
const ORDER_NUMBER_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function randomSuffix(length: number): string {
  let out = "";
  for (const byte of randomBytes(length)) {
    out += ORDER_NUMBER_ALPHABET[byte % ORDER_NUMBER_ALPHABET.length];
  }
  return out;
}

/**
 * `ORD-YYYYMMDD-XXXXXX` (design.md §1.3).
 *
 * The suffix is random rather than sequential for two reasons: a sequential
 * number publishes the day's order volume to anyone who places two orders, and
 * it invites guessing at other people's. Note the number is NOT an
 * authorization mechanism even so — reading an order back requires the owning
 * guest cookie (§6.3), which is why the modulo bias in randomSuffix is
 * acceptable here.
 *
 * The date part is UTC. With no configured shop timezone, a fixed reference is
 * the only choice that yields the same number on every machine that renders it.
 */
export function generateOrderNumber(): string {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `ORD-${today}-${randomSuffix(6)}`;
}

/**
 * The key that makes a re-submission harmless (design.md §5).
 *
 * Minted by the SERVER when it renders the form, then echoed back on submit. A
 * client-minted key would hand collision and reuse responsibility to the
 * client, where nothing can enforce it.
 */
export function generateIdempotencyKey(): string {
  return randomBytes(32).toString("base64url");
}

// ---------------------------------------------------------------------------
// Validation (REQ-ORDER-010)
// ---------------------------------------------------------------------------

const REQUIRED_SHIPPING_FIELDS = [
  "recipientName",
  "recipientPhone",
  "postalCode",
  "address",
] as const;

const MISSING = "필수 항목입니다";

type ValidationResult =
  | { ok: true; input: CreateOrderInput }
  | { ok: false; fieldErrors: Record<string, string> };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A non-blank string, or null. Whitespace-only counts as absent. */
function requiredText(raw: unknown): string | null {
  return typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : null;
}

/**
 * Narrows an untrusted body to CreateOrderInput, collecting EVERY problem
 * rather than stopping at the first.
 *
 * Reporting one field at a time would make a form with three blank inputs take
 * three round trips to fix, and REQ-ORDER-010 asks for an error that identifies
 * which items are wrong — plural.
 */
function validate(body: unknown): ValidationResult {
  const fieldErrors: Record<string, string> = {};

  if (!isRecord(body)) {
    return { ok: false, fieldErrors: { body: "요청 본문의 형식이 올바르지 않습니다" } };
  }

  const rawShipping = isRecord(body.shipping) ? body.shipping : {};
  const shipping: Partial<ShippingInfo> = {};
  for (const field of REQUIRED_SHIPPING_FIELDS) {
    const value = requiredText(rawShipping[field]);
    if (value === null) {
      fieldErrors[field] = MISSING;
    } else {
      shipping[field] = value;
    }
  }

  // Optional, and only optional: absent, null and blank all mean "no memo".
  // Anything that is neither a string nor absent is a malformed field.
  const rawMemo = rawShipping.deliveryMemo;
  let deliveryMemo: string | null = null;
  if (rawMemo !== undefined && rawMemo !== null) {
    if (typeof rawMemo !== "string") {
      fieldErrors.deliveryMemo = "문자열이어야 합니다";
    } else {
      deliveryMemo = rawMemo.trim() === "" ? null : rawMemo.trim();
    }
  }

  const idempotencyKey = requiredText(body.idempotencyKey);
  if (idempotencyKey === null) fieldErrors.idempotencyKey = MISSING;

  // Deliberately NOT defaulted when absent. The comparison against the server's
  // own figure is the whole of REQ-ORDER-014; skipping it for a request that
  // simply omitted the field would let the shopper be charged an amount they
  // never saw (acceptance.md §2).
  const confirmedTotal = body.confirmedTotal;
  if (typeof confirmedTotal !== "number" || !Number.isSafeInteger(confirmedTotal)) {
    fieldErrors.confirmedTotal = "정수 금액이어야 합니다";
  }

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  return {
    ok: true,
    input: {
      shipping: { ...(shipping as Omit<ShippingInfo, "deliveryMemo">), deliveryMemo },
      idempotencyKey: idempotencyKey!,
      confirmedTotal: confirmedTotal as number,
    },
  };
}

// ---------------------------------------------------------------------------
// Transaction abort
// ---------------------------------------------------------------------------

/**
 * Thrown inside the transaction callback to abort it.
 *
 * Returning a failure value from the callback would COMMIT the transaction —
 * Prisma rolls back on a thrown error, not on a returned one. So every refusal
 * that happens after the transaction opens has to travel as an exception, and
 * this class is what carries the intended HTTP shape out to the boundary below.
 */
class OrderAbort extends Error {
  constructor(readonly failure: OrderFailure) {
    super(failure.error);
    this.name = "OrderAbort";
  }
}

function fail<T>(failure: OrderFailure): OrderResult<T> {
  return { ok: false, ...failure } as OrderResult<T>;
}

/** Prisma's unique-constraint violation. */
function isUniqueViolation(error: unknown): boolean {
  return isRecord(error) && error.code === "P2002";
}

/**
 * The connector's SQLSTATE field for the two aborts REQ-ORDER-027 names:
 * `40P01` (deadlock detected) and `40001` (serialization failure).
 *
 * Anchored to the `code: "…"` field rather than the bare digits. `40001` is
 * five ordinary digits and can appear in an error as a total, a quantity or an
 * id; matching it loose would classify an unrelated permanent failure as
 * retryable and tell the shopper to try again forever — the same defect this
 * predicate fixes, pointed the other way.
 */
const CONFLICT_SQLSTATE = /code:\s*"(?:40P01|40001)"/;

/**
 * Whether the database aborted this transaction to break a deadlock or a
 * serialization conflict (SPEC-ORDER-002 REQ-ORDER-027).
 *
 * Either way the caller gets the same news: the database chose this transaction
 * as the victim, nothing it wrote survives, and the identical request may be
 * sent again. That is a different answer from every other refusal, where
 * retrying unchanged would fail identically.
 *
 * TWO CHECKS, because the plan's assumption turned out to be half the story:
 *
 *  - `P2034` is Prisma's documented write-conflict code. Retained for other
 *    paths that may already emit it, and as forward compatibility if a future
 *    client classifies what this one does not.
 *  - The SQLSTATE in the message is what a REAL abort actually delivers. The M4
 *    harness drove a genuine deadlock against PostgreSQL 16 through Prisma 6.1
 *    and observed a `PrismaClientUnknownRequestError` carrying NO `code` at
 *    all, with `40P01` readable only inside the message text. The original
 *    predicate tested `code === "P2034"` alone and therefore never matched a
 *    real deadlock — REQ-ORDER-027 was unsatisfied in production while its
 *    unit test passed against an invented shape (progress.md §E.2 M4, 2-bis).
 *
 * Matching prose is brittle, and knowingly so: the message is not an API
 * contract. The live-database assertion in
 * tests/integration/orders/concurrency.postgres.test.ts is what keeps that
 * brittleness honest — it calls THIS function against a real aborted
 * transaction, so a Prisma change that reshapes the message fails a test rather
 * than silently restoring the 500.
 *
 * Exported for that assertion: verifying the real predicate against a real
 * error is worth more than a copy of its logic in a test.
 */
export function isTransactionConflict(error: unknown): boolean {
  if (!isRecord(error)) return false;
  if (error.code === "P2034") return true;
  return typeof error.message === "string" && CONFLICT_SQLSTATE.test(error.message);
}

// ---------------------------------------------------------------------------
// Projection
// ---------------------------------------------------------------------------

function toOrderDTO(order: OrderWithItems): OrderDTO {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    items: order.items.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      lineTotal: item.lineTotal,
    })),
    itemsSubtotal: order.itemsSubtotal,
    shippingFee: order.shippingFee,
    totalAmount: order.totalAmount,
    shipping: {
      recipientName: order.recipientName,
      recipientPhone: order.recipientPhone,
      postalCode: order.postalCode,
      address: order.address,
      deliveryMemo: order.deliveryMemo,
    },
    createdAt: order.createdAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Locking order (SPEC-ORDER-002 REQ-ORDER-023)
// ---------------------------------------------------------------------------

/**
 * Ascending by product id, compared as code units.
 *
 * NOT `localeCompare`: its result depends on the runtime's active collation, so
 * two application instances could order the same two ids differently and
 * reintroduce the very cycle this ordering removes. A deadlock-avoidance order
 * has to be the same everywhere or it is not an order at all.
 */
function byProductId(a: OrderItemDTO, b: OrderItemDTO): number {
  if (a.productId < b.productId) return -1;
  if (a.productId > b.productId) return 1;
  return 0;
}

// ---------------------------------------------------------------------------
// Insufficient-stock reporting (SPEC-ORDER-002 REQ-ORDER-025/026)
// ---------------------------------------------------------------------------

/**
 * The short lines a refused decrement can honestly name, given the stock read
 * back at the moment of the refusal.
 *
 * `pending` is the lines this transaction has NOT yet taken — the one that was
 * just refused, and every line after it. Lines already decremented are excluded
 * deliberately: their stock WAS sufficient, and the row now reads lower only
 * because this transaction — about to roll back — took it. Naming them would
 * report a product that is not the shopper's problem, which is the same
 * self-contradicting answer the stale snapshot used to give (spec.md §2 G2).
 *
 * A line whose re-read stock now covers its quantity is dropped, so the list can
 * legitimately come back EMPTY when the product was restocked in between. The
 * order is refused all the same — the transaction has made a judgement it
 * cannot take back — but an empty list says "cannot name which", which is true,
 * rather than naming one anyway (acceptance.md §2).
 *
 * Pure on purpose: the read happens at the call site where the transaction
 * client is in scope, so this function is the decision alone.
 */
function shortLines(
  pending: OrderItemDTO[],
  currentStock: Array<{ id: string; stock: number }>
): InsufficientStockProduct[] {
  const stockById = new Map(currentStock.map((row) => [row.id, row.stock]));

  return pending.flatMap((item) => {
    // A product that no longer has a row cannot be bought at all, which is
    // "none available" rather than a reason to omit the line.
    const available = stockById.get(item.productId) ?? 0;
    if (available >= item.quantity) return [];
    return [{ productId: item.productId, name: item.productName, available }];
  });
}

// ---------------------------------------------------------------------------
// Order creation (REQ-ORDER-011/012)
// ---------------------------------------------------------------------------

/**
 * Creates a guest order, or explains why it cannot.
 *
 * The step order below is design.md §2's, and two parts of it are load-bearing:
 *
 *  - The cart is re-read INSIDE the transaction. Reading price and stock
 *    outside it and writing inside opens a window in which both can change,
 *    which is precisely what the transaction is for.
 *  - The cart is emptied LAST. It is the input to the order, so removing it
 *    before the order is known to exist would destroy the only record of what
 *    was being bought if a later step failed.
 *
 * Everything that can be decided without touching the database — validation and
 * the idempotency fast path — happens before the transaction opens, so a
 * rejected request never costs a transaction at all.
 */
export async function createOrder(guestId: string, body: unknown): Promise<OrderResult<OrderDTO>> {
  const validated = validate(body);
  if (!validated.ok) {
    return fail({
      status: 400,
      error: "배송 정보를 다시 확인해 주세요",
      fieldErrors: validated.fieldErrors,
    });
  }
  const input = validated.input;

  // First line of defence for REQ-ORDER-016: a key that already produced an
  // order returns that order, unchanged, having touched nothing.
  //
  // The owner check is REQ-ORDER-020 (AC-ORDER-023). The key alone names an
  // order but proves nothing about who is asking for it, so a replay is only a
  // replay for the guest that minted the key; for anyone else the key is simply
  // not theirs and this branch must not fire. Without this the endpoint hands a
  // stranger the whole order, shipping PII included — the audit's F1.
  const replayed = await findOrderByIdempotencyKey(input.idempotencyKey);
  if (replayed !== null && replayed.guestId === guestId) {
    return { ok: true, data: toOrderDTO(replayed) };
  }

  const orderNumber = generateOrderNumber();

  try {
    const order = await prisma.$transaction(async (tx) => {
      // 1. Re-read the cart, its lines, and each line's CURRENT price and stock.
      const cart = await findCartByGuestId(guestId, tx);
      if (cart === null || cart.items.length === 0) {
        throw new OrderAbort({
          status: 409,
          error: "장바구니가 비어 있어 주문할 수 없습니다",
          code: "CART_EMPTY",
        });
      }

      // 2. REQ-ORDER-004. The schema permits CartItem.quantity <= 0 (no CHECK
      //    constraint; the >= 1 rule lives in the cart API's parseQuantity), so
      //    unlike a deleted product this state IS representable and has to be
      //    defended against rather than assumed away (design.md §1.5). It is a
      //    data anomaly, not something the shopper can correct, so it takes
      //    design.md §8's unexpected-error row: 500, no code.
      if (cart.items.some((item) => !Number.isSafeInteger(item.quantity) || item.quantity < 1)) {
        throw new OrderAbort({ status: 500, error: "주문을 처리할 수 없습니다" });
      }

      // 3. Recompute every figure from the prices just read, then compare
      //    against what the shopper actually saw.
      const items: OrderItemDTO[] = cart.items.map((item) => ({
        productId: item.productId,
        productName: item.product.name,
        unitPrice: item.product.price,
        quantity: item.quantity,
        lineTotal: item.product.price * item.quantity,
      }));
      const itemsSubtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
      const shippingFee = calculateShippingFee(itemsSubtotal);
      const totalAmount = itemsSubtotal + shippingFee;

      if (input.confirmedTotal !== totalAmount) {
        // The client's figure is a CROSS-CHECK, never an instruction: the
        // server stores its own arithmetic and asks the shopper to re-confirm
        // (design.md §4).
        throw new OrderAbort({
          status: 409,
          error: "가격이 변경되었습니다. 금액을 다시 확인해 주세요",
          code: "PRICE_CHANGED",
          totalAmount,
        });
      }

      // 4. Conditional decrement per line. Ordered before the order insert
      //    because insufficient stock is the commonest failure, so filtering it
      //    first keeps the failure path cheap. The loop stops at the first
      //    refusal — the rollback would undo any further decrement anyway.
      //
      //    SPEC-ORDER-002 REQ-ORDER-023: taken in ascending product-id order,
      //    NOT cart order. Cart order is per-cart (CartItem.createdAt), so two
      //    shoppers holding the same two products in opposite orders would
      //    request the same row locks in opposite orders and deadlock — and
      //    PostgreSQL would abort one of them with an error that used to reach
      //    the shopper as an unexplained 500 (spec.md §2 G1).
      //
      //    A COPY is sorted. `items` itself stays in cart order because it is
      //    what gets stored and displayed, and the completion screen must list
      //    the lines the way the order summary did (plan.md §5 PRESERVE).
      const lockingOrder = [...items].sort(byProductId);
      for (const [index, item] of lockingOrder.entries()) {
        const changed = await decrementStockIfAvailable(tx, item.productId, item.quantity);
        if (changed !== 1) {
          // SPEC-ORDER-002 REQ-ORDER-025: read the stock AGAIN, here, inside the
          // transaction that just lost. Step 1's snapshot is what the winner
          // invalidated by committing, so answering from it says "not enough
          // stock" and "5 available" in the same breath. One findMany, on the
          // failure path only — the happy path's query count is unchanged.
          const currentStock = await findStockByProductIds(
            tx,
            items.map((line) => line.productId)
          );
          throw new OrderAbort({
            status: 409,
            error: "재고가 부족한 상품이 있습니다",
            code: "INSUFFICIENT_STOCK",
            // From the refused line onward IN LOCKING ORDER: the earlier ones
            // were taken successfully, so their stock was never the problem.
            products: shortLines(lockingOrder.slice(index), currentStock),
          });
        }
      }

      // 5. Write the order and its lines, with the prices and names as of now.
      const created = await createOrderWithItems(tx, {
        orderNumber,
        guestId,
        idempotencyKey: input.idempotencyKey,
        ...input.shipping,
        itemsSubtotal,
        shippingFee,
        totalAmount,
        items,
      });

      // 6. Empty the cart. Deleting the row (rather than only its lines) is the
      //    shape SPEC-CART-001 already treats as normal: cart-service.ts:108
      //    calls "no cart yet" an ordinary state, and toCartDTO(null) answers
      //    with the empty cart.
      await deleteCart(cart.id, tx);

      return {
        id: created.id,
        orderNumber,
        // The row's own status comes from the schema default; this is the same
        // value, stated for the DTO the caller gets back (REQ-ORDER-017).
        status: "pending_payment" as const,
        items,
        itemsSubtotal,
        shippingFee,
        totalAmount,
        shipping: input.shipping,
        // The service's clock rather than the row's DEFAULT now(): the create
        // selects only the id, and the two differ by less than the round trip.
        createdAt: new Date().toISOString(),
      };
    });

    return { ok: true, data: order };
  } catch (error) {
    if (error instanceof OrderAbort) {
      return fail(error.failure);
    }

    // SPEC-ORDER-002 REQ-ORDER-027. The database aborted this transaction to
    // break a deadlock or a serialization conflict. Nothing it wrote survives,
    // and — unlike every other refusal here — the identical submission may
    // simply be sent again, so saying so is the whole point: the previous
    // behaviour rethrew this into an unclassified 500, which tells a shopper
    // whose order would succeed on the next attempt to give up.
    //
    // Sits at the transaction boundary rather than beside the decrement: the
    // order insert takes locks too, so the conflict can surface from either.
    if (isTransactionConflict(error)) {
      return fail({
        status: 409,
        error: "주문이 몰려 처리하지 못했습니다. 잠시 후 다시 시도해 주세요",
        code: "CONCURRENCY_RETRY",
      });
    }

    // Second line of defence for REQ-ORDER-016 (design.md §5): two requests
    // raced past the fast path above and the loser's INSERT hit
    // Order.idempotencyKey's unique constraint. Its whole transaction rolled
    // back — so no stock was double-decremented — and the winner's order is now
    // visible under the same key.
    //
    // The same owner check as the fast path above, and for the same reason
    // (AC-ORDER-023): this lookup is also by key alone, so a winner belonging to
    // another guest must not be handed back here either. Losing the race is not
    // a licence to read a stranger's order.
    if (isUniqueViolation(error)) {
      const winner = await findOrderByIdempotencyKey(input.idempotencyKey);
      if (winner !== null && winner.guestId === guestId) {
        return { ok: true, data: toOrderDTO(winner) };
      }

      // The key is taken by an order that is not this guest's. Answering with
      // design.md §8's unexpected-transaction row — 500, no code — is
      // deliberate: it is the same answer any other unnamed unique collision
      // gets, so it tells the caller nothing about whether the key exists,
      // following the non-disclosure precedent findOrderForGuest() sets for the
      // read path (design.md §6.3). The rolled-back transaction means nothing
      // was written, and the order that owns the key is untouched.
      return fail({ status: 500, error: "주문을 처리할 수 없습니다" });
    }

    // Anything else is genuinely unexpected. It is rethrown rather than
    // flattened into a failure code, so it cannot be mistaken for one of the
    // four refusals the shopper can act on.
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Read-back (REQ-ORDER-020)
// ---------------------------------------------------------------------------

/**
 * The order, but only for the guest that owns it.
 *
 * Answers null — never a distinct "not yours" — so the caller can render
 * notFound() and a stranger holding an order id cannot learn from the response
 * whether that id is real. This follows the precedent SPEC-CART-001 set with
 * findOwnedItem() (design.md §6.3).
 */
export async function getOrderForGuest(orderId: string, guestId: string): Promise<OrderDTO | null> {
  const order = await findOrderForGuest(orderId, guestId);
  return order === null ? null : toOrderDTO(order);
}
