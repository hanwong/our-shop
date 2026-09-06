// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { AVAILABLE_SIZES_MM, SizeSelector } from "@/components/product/SizeSelector";

/**
 * SPEC-BRAND-001 M7 — REQ-BRAND-022/023, AC-BRAND-023.
 */

afterEach(cleanup);

describe("SizeSelector — AC-BRAND-023", () => {
  it("disables every size option when stock is 0", () => {
    render(<SizeSelector stock={0} />);

    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(AVAILABLE_SIZES_MM.length);
    for (const button of buttons) {
      expect(button).toHaveProperty("disabled", true);
    }
  });

  it("makes every size option selectable when stock is greater than 0", () => {
    render(<SizeSelector stock={7} />);

    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(AVAILABLE_SIZES_MM.length);
    for (const button of buttons) {
      expect(button).toHaveProperty("disabled", false);
    }
  });

  it("never produces a mixed per-size disabled state, for any stock value", () => {
    for (const stock of [0, 1, 5, 100]) {
      const { unmount } = render(<SizeSelector stock={stock} />);
      const states = screen.getAllByRole("button").map((b) => (b as HTMLButtonElement).disabled);
      expect(new Set(states).size).toBe(1);
      unmount();
    }
  });
});
