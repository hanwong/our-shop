// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

/**
 * SPEC-DESIGN-001 M1 — src/components/ui/FormField.tsx.
 *
 * Traces: AC-DESIGN-004 (primitive exists — field input, field label, field
 * error text), AC-DESIGN-005(a)/(b) (token-only styling + Classical
 * focus-visible outline rule), AC-DESIGN-009 (8-consumer replacement target:
 * 7 exact-match files + 1 near-variant — `CheckoutInteractive.tsx:138`,
 * which lacks the leading `mt-1` the other 7 share, plan.md §D.2/§A — the
 * near-variant is absorbed as a spacing/className prop, not a special case
 * of this primitive).
 */

const { FormField, fieldInputClassName } = await import("@/components/ui/FormField");

afterEach(cleanup);

describe("FormField — label/input/error rendered as one set (plan.md §B.1)", () => {
  it("renders a label associated with the input via htmlFor/id", () => {
    render(<FormField id="email" label="이메일" />);
    const input = screen.getByLabelText("이메일");
    expect(input.tagName).toBe("INPUT");
  });

  it("renders a textarea when multiline is set (plan.md §D.3 — .field + label + textarea.input)", () => {
    render(<FormField id="body" label="리뷰 내용" multiline rows={3} />);
    const field = screen.getByLabelText("리뷰 내용");
    expect(field.tagName).toBe("TEXTAREA");
  });

  it("does not render an error paragraph when no error is given", () => {
    render(<FormField id="email" label="이메일" />);
    expect(screen.queryByText(/./, { selector: "p" })).toBeNull();
  });

  it("renders the error text and wires aria-invalid/aria-describedby when error is given", () => {
    render(<FormField id="email" label="이메일" error="이메일 형식이 올바르지 않습니다" />);
    const input = screen.getByLabelText("이메일") as HTMLInputElement;
    expect(input.getAttribute("aria-invalid")).toBe("true");
    const error = screen.getByText("이메일 형식이 올바르지 않습니다");
    expect(input.getAttribute("aria-describedby")).toBe(error.id);
  });
});

describe("FormField — token-only styling (AC-DESIGN-005(a))", () => {
  it("does not reference Tailwind's raw neutral-900/neutral-300 scale or a hex literal", () => {
    render(<FormField id="email" label="이메일" error="문제가 있습니다" />);
    const input = screen.getByLabelText("이메일");
    const forbidden = /neutral-900|neutral-300|#[0-9a-fA-F]{6}/;
    expect(input.className).not.toMatch(forbidden);
  });

  it("applies the Classical focus-visible outline rule to the input", () => {
    render(<FormField id="email" label="이메일" />);
    const input = screen.getByLabelText("이메일");
    const tokens = input.className.split(/\s+/);
    for (const cls of [
      "focus-visible:outline",
      "focus-visible:outline-2",
      "focus-visible:outline-offset-2",
      "focus-visible:outline-accent",
    ]) {
      expect(tokens).toContain(cls);
    }
  });
});

describe("FormField — passes through native attributes", () => {
  it("forwards value, onChange, type, and other input attributes", () => {
    const onChange = vi.fn();
    render(
      <FormField
        id="email"
        label="이메일"
        type="email"
        value="a@b.com"
        onChange={onChange}
        autoComplete="username"
      />
    );
    const input = screen.getByLabelText("이메일") as HTMLInputElement;
    expect(input.type).toBe("email");
    expect(input.value).toBe("a@b.com");
    expect(input.autocomplete).toBe("username");
  });

  it("forwards rows and other textarea attributes when multiline", () => {
    render(<FormField id="body" label="리뷰 내용" multiline rows={5} required />);
    const field = screen.getByLabelText("리뷰 내용") as HTMLTextAreaElement;
    expect(field.rows).toBe(5);
    expect(field.required).toBe(true);
  });
});

describe("fieldInputClassName — exported class-string builder", () => {
  it("does not include a raw neutral-900/neutral-300/hex literal", () => {
    const cls = fieldInputClassName();
    expect(cls).not.toMatch(/neutral-900|neutral-300|#[0-9a-fA-F]{6}/);
  });
});
