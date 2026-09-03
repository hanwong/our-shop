"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * SPEC-ADMIN-001 M2 — the admin login screen (`/staff/login`).
 *
 * Traces: REQ-ADMIN-004~006. Submits the standard JSON body { email,
 * password } to the existing POST /api/auth/login route (SPEC-AUTH-001)
 * unchanged — no new endpoint, no new request shape (design.md §1,
 * research.md §7 confirms no prior login form exists in this repo to copy).
 *
 * On ANY 200 response this form navigates to /staff/orders — full stop. The
 * response body is `{ accessToken }` ONLY; it carries no `role` field, and
 * this form deliberately never decodes the JWT to inspect one. The actual
 * admin/non-admin gate lives in /staff/orders's own Server Component (M3),
 * which re-verifies the session server-side via resolveAdminSession()
 * reading the just-issued refresh-token cookie (REQ-ADMIN-017). Client-side
 * role branching here would contradict that design — this SPEC's whole
 * point is that every admin decision is re-verified server-side — so this
 * form makes NONE.
 *
 * No CSRF token on submit: login is the CSRF-cookie ISSUANCE point, not a
 * cookie-authenticated mutation (see the doc comment atop
 * src/app/api/auth/login/route.ts).
 */

interface LoginFailureBody {
  error?: string;
}

export default function StaffLoginPage() {
  const router = useRouter();
  const formId = useId();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setFormError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        router.push("/staff/orders");
        return;
      }

      const failure: LoginFailureBody = await response.json();
      setFormError(failure.error ?? "로그인하지 못했습니다");
    } catch {
      setFormError("로그인하지 못했습니다. 잠시 후 다시 시도해 주세요");
    } finally {
      setSubmitting(false);
    }
  }

  const emailId = `${formId}-email`;
  const passwordId = `${formId}-password`;

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div>
        <label htmlFor={emailId} className="block text-sm font-medium text-neutral-800">
          이메일
        </label>
        <input
          id={emailId}
          name="email"
          type="email"
          value={email}
          autoComplete="username"
          onChange={(event) => setEmail(event.target.value)}
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900"
        />
      </div>

      <div>
        <label htmlFor={passwordId} className="block text-sm font-medium text-neutral-800">
          비밀번호
        </label>
        <input
          id={passwordId}
          name="password"
          type="password"
          value={password}
          autoComplete="current-password"
          onChange={(event) => setPassword(event.target.value)}
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900"
        />
      </div>

      {formError ? (
        <p role="alert" className="text-sm text-red-600">
          {formError}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {submitting ? "로그인 중…" : "로그인"}
      </button>
    </form>
  );
}
