"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * SPEC-AUTH-002 M2 — the customer login screen (`/login`).
 *
 * Traces: REQ-AUTH-026~029. Submits the standard JSON body { email,
 * password } to the existing POST /api/auth/login route (SPEC-AUTH-001)
 * unchanged — no new endpoint, no new request shape.
 *
 * Reuses src/app/staff/login/page.tsx's visual conventions verbatim
 * (design-notes.md §2/§5) — only two differences: the success redirect
 * target ("/" instead of "/staff/orders") and an added login<->signup
 * cross-navigation link (design-notes.md §4, not covered by any AC).
 *
 * No redirect/next query-parameter handling (REQ-AUTH-029) — the success
 * target is always the literal "/".
 */

interface LoginFailureBody {
  error?: string;
}

export default function LoginPage() {
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
        router.push("/");
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

      <p className="text-sm text-neutral-600">
        계정이 없으신가요? <a href="/signup">회원가입</a>
      </p>
    </form>
  );
}
