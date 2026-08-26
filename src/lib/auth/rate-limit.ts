/**
 * SPEC-AUTH-001 M6 — in-memory sliding-window rate limiter + soft lockout.
 * Traces: REQ-AUTH-021 (brute-force / credential-stuffing mitigation on
 * login/refresh/OAuth-callback), AC-AUTH-021.
 *
 * Keying strategy (design choice — REQ-AUTH-021's "동일 IP 또는 동일 계정"
 * / "same IP OR same account" wording): route handlers call checkRateLimit()
 * once per applicable identifier (IP always; account additionally when the
 * request carries an email) and treat a lockout on EITHER call as a block.
 * This directly matches the OR semantics of the requirement — a single
 * composite key (IP+account combined) would instead require BOTH signals to
 * co-occur before a lockout can trigger, which is a different (and wrong)
 * policy than what REQ-AUTH-021 specifies. Callers namespace their keys by
 * endpoint (e.g. "login:ip:203.0.113.4", "login:acct:user@example.com") so
 * AC-AUTH-021's "각 엔드포인트 독립적으로 검증" (each endpoint verified
 * independently) holds — a lockout on one endpoint's key never affects
 * another endpoint's key, even for the same IP/account.
 *
 * IP extraction: `x-forwarded-for` (the standard de-facto header a reverse
 * proxy sets; this sandbox has no real proxy in front of it, so tests inject
 * the header directly). The first comma-separated entry is treated as the
 * original client per the header's near-to-origin convention.
 *
 * Storage: single-instance in-memory Map (plan.md §5.6 — Redis is
 * explicitly Out of Scope for this SPEC; a multi-instance deployment would
 * need a shared store instead).
 *
 * @MX:WARN in-memory Map state does not survive a process restart and is
 * not shared across horizontally-scaled instances.
 * @MX:REASON single-instance in-memory rate-limit state silently resets on
 * every deploy/restart and provides no protection across multiple
 * instances; flagged so a future multi-instance migration (plan.md §5.6)
 * does not miss replacing this with a shared store.
 */

// @MX:NOTE rate-limit thresholds — REQ-AUTH-021 fixes these at "more than 5
// requests per rolling 60-second window" -> 429 + a 15-minute soft lockout
// starting from the moment the threshold was first exceeded (never a
// permanent lockout).
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 5;
const LOCKOUT_MS = 15 * 60_000;

interface KeyState {
  /** Request timestamps observed within the current/prior rolling window. */
  timestamps: number[];
  /** Epoch ms the current lockout ends at, or null when not locked out. */
  lockedUntil: number | null;
}

const store = new Map<string, KeyState>();

export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs?: number;
}

/**
 * Records one request attempt against `key` and reports whether it is
 * allowed. See the module doc comment above for the keying convention
 * callers are expected to follow.
 */
export function checkRateLimit(key: string): RateLimitResult {
  const now = Date.now();
  let state = store.get(key);
  if (!state) {
    state = { timestamps: [], lockedUntil: null };
    store.set(key, state);
  }

  if (state.lockedUntil !== null) {
    if (now < state.lockedUntil) {
      return { allowed: false, retryAfterMs: state.lockedUntil - now };
    }
    // AC-AUTH-021: "15분 경과 후 첫 요청은 다시 허용된다" — the lockout has
    // fully elapsed, so it is lifted and the window starts fresh.
    state.lockedUntil = null;
    state.timestamps = [];
  }

  state.timestamps = state.timestamps.filter((t) => now - t < WINDOW_MS);
  state.timestamps.push(now);

  if (state.timestamps.length > MAX_REQUESTS_PER_WINDOW) {
    state.lockedUntil = now + LOCKOUT_MS;
    return { allowed: false, retryAfterMs: LOCKOUT_MS };
  }

  return { allowed: true };
}

/**
 * Extracts the client IP from `x-forwarded-for` (first entry of the
 * comma-separated chain). Returns `"unknown"` when the header is absent —
 * this sandbox has no real reverse proxy, so production deployments behind
 * one MUST ensure this header is set and trusted only from the proxy hop.
 */
export function extractClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }
  return "unknown";
}

/** Test-only reset hook — clears all in-memory rate-limit state. */
export function __resetRateLimitStoreForTests(): void {
  store.clear();
}

/**
 * The sentinel value `extractClientIp()` returns when no `x-forwarded-for`
 * header is present. Route handlers use this to decide whether an IP-keyed
 * check is meaningful (see `checkIpRateLimit` below) — an "unknown" IP would
 * otherwise merge every caller lacking the header into one shared bucket,
 * which is a real hazard in an environment with no reverse proxy in front of
 * it (this sandbox has none; a production deployment behind a real proxy
 * always has this header set).
 */
export const UNKNOWN_IP = "unknown";

/**
 * Convenience wrapper for route handlers: checks the IP-keyed rate limit for
 * `endpoint`, but SKIPS the check entirely (always allowed) when the IP
 * could not be determined (`UNKNOWN_IP`) — an undeterminable IP must not
 * silently pool every such caller into one shared, easily-exhausted bucket.
 */
export function checkIpRateLimit(endpoint: string, request: Request): RateLimitResult {
  const ip = extractClientIp(request);
  if (ip === UNKNOWN_IP) {
    return { allowed: true };
  }
  return checkRateLimit(`${endpoint}:ip:${ip}`);
}

/**
 * Convenience wrapper for route handlers: checks the account-keyed rate
 * limit for `endpoint` when `identifier` (e.g. a normalized email) is
 * available; when it is not (e.g. `undefined`/empty), the check is skipped
 * (always allowed) — there is nothing to key on yet.
 */
export function checkAccountRateLimit(endpoint: string, identifier: string | undefined): RateLimitResult {
  if (!identifier) {
    return { allowed: true };
  }
  return checkRateLimit(`${endpoint}:acct:${identifier.toLowerCase()}`);
}
