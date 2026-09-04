"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * SPEC-AUTH-002 M3 — the customer signup screen (`/signup`).
 *
 * Traces: REQ-AUTH-030~032. Submits the standard JSON body { email,
 * password } to the existing POST /api/auth/signup route (SPEC-AUTH-001)
 * unchanged — no new endpoint, no new request shape.
 *
 * Structurally identical to LoginPage (design-notes.md §3/§5) — same
 * "use client" shape, useState/useId pattern, noValidate, alert/button
 * styling. No prior signup UI exists in this repo to copy (spec.md §1).
 *
 * On 201, does NOT attempt auto-login — the signup API issues no session
 * (REQ-AUTH-031) — it navigates to /login instead. On failure, the
 * server's exact `error` message is shown verbatim (REQ-AUTH-032); no
 * client-side message rewriting.
 */

interface SignupFailureBody {
  error?: string;
}

export default function SignupPage() {
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
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        router.push("/login");
        return;
      }

      const failure: SignupFailureBody = await response.json();
      setFormError(failure.error ?? "회원가입하지 못했습니다");
    } catch {
      setFormError("회원가입하지 못했습니다. 잠시 후 다시 시도해 주세요");
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
          autoComplete="new-password"
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
        {submitting ? "가입 중…" : "회원가입"}
      </button>

      <p className="text-sm text-neutral-600">
        이미 계정이 있으신가요? <a href="/login">로그인</a>
      </p>
    </form>
  );
}
