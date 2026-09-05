// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

/**
 * SPEC-DESIGN-001 M1 — src/components/ui/Button.tsx.
 *
 * Traces: AC-DESIGN-004 (primitive exists), AC-DESIGN-005(a)/(b) (token-only
 * styling + Classical focus-visible outline rule), AC-DESIGN-008(b)/(c)
 * (Classical outline rendering — transparent background + accent border and
 * text — and no solid accent/surface/bg/text/neutral fill in any of the
 * three forms acceptance.md names: an auto-generated Tailwind utility, an
 * arbitrary CSS-variable value, or a direct `background` declaration).
 */

const { Button, buttonClassName } = await import("@/components/ui/Button");

afterEach(cleanup);

/** Asserts every given class token is present in the element's className list. */
function expectClasses(element: HTMLElement, ...classes: string[]) {
  const tokens = element.className.split(/\s+/);
  for (const cls of classes) {
    expect(tokens).toContain(cls);
  }
}

describe("Button — Classical outline style (AC-DESIGN-008(b))", () => {
  it("renders a transparent background with an accent border and accent text", () => {
    render(<Button>결제하기</Button>);
    const button = screen.getByRole("button", { name: "결제하기" });
    expectClasses(button, "bg-transparent", "border-accent", "text-accent");
  });

  it("never renders a solid accent/surface/bg/text/neutral background fill (AC-DESIGN-008(c))", () => {
    render(<Button>결제하기</Button>);
    const button = screen.getByRole("button", { name: "결제하기" });
    const forbidden = /bg-(accent|surface|bg|text|neutral)(-[0-9]{3})?\b|bg-\[var\(--color-|background(-color)?:/;
    expect(button.className).not.toMatch(forbidden);
  });
});

describe("Button — variants absorbed as props (plan.md §D.2 — w-full/disabled:opacity-60/inline-block)", () => {
  it("defaults to inline-block", () => {
    render(<Button>보기</Button>);
    expectClasses(screen.getByRole("button"), "inline-block");
  });

  it("renders w-full instead of inline-block when fullWidth is set", () => {
    render(<Button fullWidth>제출</Button>);
    const button = screen.getByRole("button");
    expectClasses(button, "w-full");
    expect(button.className.split(/\s+/)).not.toContain("inline-block");
  });

  it("carries disabled:opacity-60 for the disabled state", () => {
    render(<Button disabled>제출 중</Button>);
    expectClasses(screen.getByRole("button"), "disabled:opacity-60");
  });
});

describe("Button — focus-visible outline (AC-DESIGN-005(b), plan.md §D.4-4)", () => {
  it("applies the Classical outline + outline-offset focus-visible rule", () => {
    render(<Button>포커스</Button>);
    const button = screen.getByRole("button");
    expectClasses(
      button,
      "focus-visible:outline",
      "focus-visible:outline-2",
      "focus-visible:outline-offset-2",
      "focus-visible:outline-accent"
    );
  });
});

describe("Button — passes through native button behavior", () => {
  it("forwards onClick, type, and disabled", () => {
    const onClick = vi.fn();
    render(
      <Button type="submit" onClick={onClick}>
        전송
      </Button>
    );
    const button = screen.getByRole("button", { name: "전송" }) as HTMLButtonElement;
    expect(button.type).toBe("submit");
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("renders children", () => {
    render(<Button>장바구니에 담기</Button>);
    expect(screen.getByText("장바구니에 담기")).toBeDefined();
  });

  it("appends a caller-provided className rather than replacing the token classes", () => {
    render(<Button className="shrink-0">적용</Button>);
    const button = screen.getByRole("button");
    expectClasses(button, "shrink-0", "bg-transparent", "border-accent");
  });
});

describe("buttonClassName — exported class-string builder for non-<button> consumers (e.g. <a> styled as a button)", () => {
  it("returns the same outline token classes as the Button component", () => {
    const cls = buttonClassName();
    expect(cls).toMatch(/bg-transparent/);
    expect(cls).toMatch(/border-accent/);
    expect(cls).toMatch(/text-accent/);
    expect(cls).toMatch(/inline-block/);
  });

  it("returns w-full when fullWidth is requested", () => {
    const cls = buttonClassName({ fullWidth: true });
    expect(cls).toMatch(/\bw-full\b/);
    expect(cls).not.toMatch(/\binline-block\b/);
  });
});
