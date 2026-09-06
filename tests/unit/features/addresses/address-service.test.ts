import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * SPEC-ADDRESS-001 M3 — address-service.ts.
 *
 * Traces: AC-ADDRESS-003 (create), AC-ADDRESS-004 (update), AC-ADDRESS-005
 * (delete), AC-ADDRESS-006/007 (default-address transaction, ownership
 * failure leaves the existing default untouched), AC-ADDRESS-008 (first
 * address auto-default), AC-ADDRESS-009 (validation), AC-ADDRESS-012
 * (not-owned collapses to 404, same as not-found).
 *
 * The repository is mocked here so this suite asserts the SERVICE's own
 * decisions — validation order/field, and 404 mapping — the same boundary
 * review-service.test.ts draws against review-repository.
 */

const repo = {
  listByUser: vi.fn(),
  findOwned: vi.fn(),
  createForUser: vi.fn(),
  updateOwned: vi.fn(),
  deleteOwned: vi.fn(),
  setDefault: vi.fn(),
};
vi.mock("@/features/addresses/repositories/address-repository", () => repo);

const { listAddresses, createAddress, updateAddress, removeAddress, setDefaultAddress } = await import(
  "@/features/addresses/services/address-service"
);

beforeEach(() => {
  repo.listByUser.mockReset().mockResolvedValue([]);
  repo.findOwned.mockReset();
  repo.createForUser.mockReset();
  repo.updateOwned.mockReset();
  repo.deleteOwned.mockReset();
  repo.setDefault.mockReset();
});

const USER_ID = "user-1";
const ADDRESS_ID = "addr-1";

function row(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: ADDRESS_ID,
    userId: USER_ID,
    recipientName: "홍길동",
    recipientPhone: "010-1234-5678",
    postalCode: "06236",
    address: "서울시 강남구 테헤란로 1",
    isDefault: false,
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
    updatedAt: new Date("2026-09-01T00:00:00.000Z"),
    ...over,
  };
}

const VALID_INPUT = {
  recipientName: "홍길동",
  recipientPhone: "010-1234-5678",
  postalCode: "06236",
  address: "서울시 강남구 테헤란로 1",
};

describe("listAddresses", () => {
  it("projects repository rows onto the wire DTO, ISO-stringifying dates", async () => {
    repo.listByUser.mockResolvedValue([row()]);

    const result = await listAddresses(USER_ID);

    expect(result).toEqual([
      {
        id: ADDRESS_ID,
        userId: USER_ID,
        recipientName: "홍길동",
        recipientPhone: "010-1234-5678",
        postalCode: "06236",
        address: "서울시 강남구 테헤란로 1",
        isDefault: false,
        createdAt: "2026-09-01T00:00:00.000Z",
        updatedAt: "2026-09-01T00:00:00.000Z",
      },
    ]);
    expect(repo.listByUser).toHaveBeenCalledWith(USER_ID);
  });
});

describe("createAddress — AC-ADDRESS-003", () => {
  it("creates and returns 201-shaped success on valid input", async () => {
    repo.createForUser.mockResolvedValue(row({ isDefault: true }));

    const result = await createAddress(USER_ID, VALID_INPUT);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.isDefault).toBe(true);
    }
    expect(repo.createForUser).toHaveBeenCalledWith(USER_ID, VALID_INPUT);
  });
});

describe("createAddress — AC-ADDRESS-009 (validation, no write on failure)", () => {
  it.each([
    ["recipientName", { ...VALID_INPUT, recipientName: "" }],
    ["recipientPhone", { ...VALID_INPUT, recipientPhone: "" }],
    ["postalCode", { ...VALID_INPUT, postalCode: "" }],
    ["address", { ...VALID_INPUT, address: "" }],
  ])("rejects an empty '%s' with 400 and never calls the repository", async (_field, input) => {
    const result = await createAddress(USER_ID, input);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
    }
    expect(repo.createForUser).not.toHaveBeenCalled();
  });

  it("rejects a non-string field the same way", async () => {
    const result = await createAddress(USER_ID, { ...VALID_INPUT, recipientName: 123 });

    expect(result.ok).toBe(false);
    expect(repo.createForUser).not.toHaveBeenCalled();
  });

  it("trims whitespace-only text the same as empty", async () => {
    const result = await createAddress(USER_ID, { ...VALID_INPUT, address: "   " });

    expect(result.ok).toBe(false);
    expect(repo.createForUser).not.toHaveBeenCalled();
  });
});

describe("updateAddress — AC-ADDRESS-004", () => {
  it("updates and returns the current row on success", async () => {
    repo.updateOwned.mockResolvedValue({ count: 1 });
    repo.findOwned.mockResolvedValue(row({ recipientName: "김철수" }));

    const result = await updateAddress(USER_ID, ADDRESS_ID, VALID_INPUT);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.recipientName).toBe("김철수");
    }
    expect(repo.updateOwned).toHaveBeenCalledWith(USER_ID, ADDRESS_ID, VALID_INPUT);
  });
});

describe("updateAddress — AC-ADDRESS-009 (validation before ownership)", () => {
  it("returns 400 for an invalid body without ever calling updateOwned", async () => {
    const result = await updateAddress(USER_ID, ADDRESS_ID, { ...VALID_INPUT, recipientName: "" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
    }
    expect(repo.updateOwned).not.toHaveBeenCalled();
  });
});

describe("updateAddress / removeAddress / setDefaultAddress — AC-ADDRESS-012 (not-owned collapses to 404)", () => {
  it("updateAddress returns 404 when updateOwned matches zero rows", async () => {
    repo.updateOwned.mockResolvedValue({ count: 0 });

    const result = await updateAddress(USER_ID, ADDRESS_ID, VALID_INPUT);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(404);
    }
  });

  it("updateAddress returns 404 (not a thrown error) when a concurrent delete removes the row between updateOwned and the re-read", async () => {
    repo.updateOwned.mockResolvedValue({ count: 1 });
    repo.findOwned.mockResolvedValue(null);

    const result = await updateAddress(USER_ID, ADDRESS_ID, VALID_INPUT);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(404);
      expect(result.error).toBe("존재하지 않는 배송지입니다");
    }
  });

  it("removeAddress returns 404 when deleteOwned matches zero rows", async () => {
    repo.deleteOwned.mockResolvedValue({ count: 0 });

    const result = await removeAddress(USER_ID, ADDRESS_ID);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(404);
    }
  });

  it("removeAddress — AC-ADDRESS-005 succeeds when deleteOwned matches one row", async () => {
    repo.deleteOwned.mockResolvedValue({ count: 1 });

    const result = await removeAddress(USER_ID, ADDRESS_ID);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({ id: ADDRESS_ID });
    }
  });

  it("setDefaultAddress — AC-ADDRESS-007 returns 404 without touching anything else when setDefault resolves false", async () => {
    repo.setDefault.mockResolvedValue(false);

    const result = await setDefaultAddress(USER_ID, ADDRESS_ID);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(404);
    }
  });

  it("setDefaultAddress — AC-ADDRESS-006 succeeds when setDefault resolves true", async () => {
    repo.setDefault.mockResolvedValue(true);

    const result = await setDefaultAddress(USER_ID, ADDRESS_ID);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({ id: ADDRESS_ID });
    }
  });
});
