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
 * the header directly). The LAST comma-separated entry is trusted — see
 * extractClientIp()'s doc comment for the single-trusted-hop assumption and
 * why the leftmost entry was a security bug (2026-08-27, F2/H1 fix).
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
 * Extracts the client IP from `x-forwarded-for` (LAST entry of the
 * comma-separated chain). Returns `"unknown"` when the header is absent —
 * this sandbox has no real reverse proxy, so production deployments behind
 * one MUST ensure this header is set and trusted only from the proxy hop.
 *
 * [AUTO] @MX:WARN 2026-08-27 security fix (sync-phase audit findings
 * sync-auditor F2 / Phase-8 H1) — this function previously trusted the
 * FIRST (leftmost) entry. Under the standard single-reverse-proxy
 * deployment, the proxy APPENDS the connecting IP to whatever
 * `x-forwarded-for` value the client sent, so the leftmost entry is
 * attacker-supplied and can be rotated per-request to defeat rate limiting
 * entirely. The LAST entry — appended by the proxy immediately in front of
 * this app — is the one the original client cannot forge in that topology.
 * [AUTO] @MX:REASON Named limitation, NOT closed here: this assumes exactly
 * ONE trusted reverse proxy hop that appends (never replaces) the header. A
 * multi-hop proxy chain would need a configurable trusted-hop-count to
 * correctly pick which entry is proxy-appended vs. attacker-supplied —
 * explicitly out of scope for this fix cycle (see progress.md residual-risk
 * entry for this SPEC's 2026-08-27 fix cycle).
 */
export function extractClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const parts = forwardedFor
      .split(",")
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
    const last = parts[parts.length - 1];
    if (last) {
      return last;
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
 * `endpoint`. When the IP cannot be determined, requests share ONE
 * `UNKNOWN_IP` bucket per endpoint rather than bypassing the check.
 *
 * [AUTO] @MX:ANCHOR fan-in target — called from login/refresh/google-callback
 * route handlers (fan_in 3); the sole IP-keyed rate-limit gate REQ-AUTH-021
 * relies on.
 * [AUTO] @MX:REASON changing the allowed/blocked contract here changes rate
 * limiting behavior on every one of its three call sites at once.
 * [AUTO] @MX:WARN 2026-08-27 security fix (sync-phase audit findings
 * sync-auditor F2 / Phase-8 H1) — this previously returned `{allowed: true}`
 * unconditionally when the IP was undeterminable, which let an attacker
 * disable rate limiting outright simply by omitting `x-forwarded-for`. A
 * shared `UNKNOWN_IP` bucket per endpoint is a deliberate
 * security-over-availability tradeoff for auth endpoints: legitimate callers
 * that never send the header on a proxyless deployment now pool together and
 * may rate-limit each other (a real, accepted residual risk — recorded in
 * this SPEC's 2026-08-27 fix-cycle progress.md entry), which is preferable
 * to the prior unconditional bypass.
 */
export function checkIpRateLimit(endpoint: string, request: Request): RateLimitResult {
  const ip = extractClientIp(request);
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
