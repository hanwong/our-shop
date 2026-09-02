/**
 * SPEC-PAYMENT-001 M4 — browser-side Toss Payments SDK loader/initializer.
 *
 * Traces: REQ-PAYMENT-005 (requestPayment() invocation shape, design.md §6),
 * REQ-PAYMENT-018 (NEXT_PUBLIC_PG_CLIENT_KEY is the only credential this
 * module reads — the two server-only secrets stay confined to
 * toss-server.ts, M2, and are never named or read here).
 *
 * design.md §9 leaves the exact Toss SDK npm package name unconfirmed at
 * plan-phase ("이 문서에서 확정하지 않음... M4에서 공식 문서를 재확인해
 * 확정한다") and states only the request-parameter interface is already
 * fixed. plan.md §4 separately forbids modifying package.json during M4 (the
 * dependency addition is M5's job — plan.md §3 M5). Rather than statically
 * importing a package that is not yet installed (which would break the
 * build), this module loads the SDK from Toss's own CDN script — the
 * officially documented alternative to an npm install for the v2 "standard"
 * integration. This sidesteps both constraints without touching
 * package.json.
 *
 * ASSUMPTION (not re-verified against live Toss docs in this session, per
 * the task's fallback instruction): the SDK script URL below and the
 * `customerKey: "ANONYMOUS"` sentinel for a guest (non-member) payer. Both
 * are internal adapter details only — REQ-PAYMENT-005's public parameter
 * names (orderId/amount/orderName/successUrl/failUrl) are unaffected by
 * either choice, matching design.md §9's "인터페이스는 이미 확정" note.
 */

const TOSS_SDK_SCRIPT_SRC = "https://js.tosspayments.com/v2/standard";

interface TossPaymentInstance {
  requestPayment(options: Record<string, unknown>): Promise<void>;
}

interface TossPaymentsSDK {
  payment(options: { customerKey: string }): TossPaymentInstance;
}

declare global {
  interface Window {
    TossPayments?: (clientKey: string) => TossPaymentsSDK;
  }
}

let scriptLoadPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("toss-client can only run in the browser"));
  }
  if (window.TossPayments) {
    return Promise.resolve();
  }
  if (scriptLoadPromise) {
    return scriptLoadPromise;
  }

  scriptLoadPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = TOSS_SDK_SCRIPT_SRC;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptLoadPromise = null;
      reject(new Error("Failed to load the Toss Payments SDK script"));
    };
    document.head.appendChild(script);
  });

  return scriptLoadPromise;
}

export interface RequestPaymentParams {
  orderId: string;
  amount: number;
  orderName: string;
  successUrl: string;
  failUrl: string;
}

export interface TossPaymentClient {
  requestPayment(params: RequestPaymentParams): Promise<void>;
}

/**
 * Loads (or reuses) the Toss SDK and returns a payment client scoped to a
 * single guest checkout. `customerKey: "ANONYMOUS"` is Toss's documented
 * sentinel for a payer with no member/customer id — this SPEC has no member
 * payment path at all (REQ-PAYMENT-020), so no real customer id ever exists
 * to pass here.
 */
export async function loadTossPaymentClient(): Promise<TossPaymentClient> {
  const clientKey = process.env.NEXT_PUBLIC_PG_CLIENT_KEY;
  if (!clientKey) {
    throw new Error("NEXT_PUBLIC_PG_CLIENT_KEY is not set");
  }

  await loadScript();

  if (!window.TossPayments) {
    throw new Error("Toss Payments SDK failed to initialize");
  }

  const payment = window.TossPayments(clientKey).payment({ customerKey: "ANONYMOUS" });

  return {
    requestPayment: (params) =>
      payment.requestPayment({
        method: "CARD",
        amount: { currency: "KRW", value: params.amount },
        orderId: params.orderId,
        orderName: params.orderName,
        successUrl: params.successUrl,
        failUrl: params.failUrl,
      }),
  };
}
