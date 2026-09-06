import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * SPEC-ADDRESS-001 M3 — address-repository.ts.
 *
 * Traces: AC-ADDRESS-006 (default transaction success), AC-ADDRESS-007
 * (ownership failure leaves the existing default untouched — the
 * set-first/unset-second order is what this file directly exercises),
 * AC-ADDRESS-008 (first-address auto-default via createForUser), plus direct
 * coverage of the plain (non-transactional) query functions
 * (listByUser/findOwned/updateOwned/deleteOwned) that the ownership `where`
 * clause lives in.
 *
 * `prisma.$transaction` is mocked to invoke its callback against a stub `tx`
 * whose `address.updateMany` / `address.count` / `address.create` calls are
 * recorded in order — the same shape admin-order-status's transactionMock
 * uses, but here the CALL ORDER itself is the thing under test. Direct
 * (non-transactional) calls are recorded on SEPARATE mocks so the two
 * surfaces (transactional vs plain) never share call counts.
 */

const txUpdateMany = vi.fn();
const txCount = vi.fn();
const txCreate = vi.fn();

const tx = {
  address: {
    updateMany: txUpdateMany,
    count: txCount,
    create: txCreate,
  },
};

const transactionMock = vi.fn(async (callback: (tx: unknown) => unknown) => callback(tx));

const findMany = vi.fn();
const findFirst = vi.fn();
const updateMany = vi.fn();
const deleteMany = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: transactionMock,
    address: {
      findMany,
      findFirst,
      updateMany,
      deleteMany,
    },
  },
}));

const { setDefault, createForUser, listByUser, findOwned, updateOwned, deleteOwned } = await import(
  "@/features/addresses/repositories/address-repository"
);

beforeEach(() => {
  txUpdateMany.mockReset();
  txCount.mockReset();
  txCreate.mockReset();
  transactionMock.mockClear();
  findMany.mockReset();
  findFirst.mockReset();
  updateMany.mockReset();
  deleteMany.mockReset();
});

const USER_ID = "user-1";
const ADDRESS_ID = "addr-target";

describe("listByUser", () => {
  it("queries by userId, newest first", async () => {
    findMany.mockResolvedValue([{ id: "a1" }]);

    const result = await listByUser(USER_ID);

    expect(result).toEqual([{ id: "a1" }]);
    expect(findMany).toHaveBeenCalledWith({ where: { userId: USER_ID }, orderBy: { createdAt: "desc" } });
  });
});

describe("findOwned", () => {
  it("scopes the lookup by BOTH id and userId", async () => {
    findFirst.mockResolvedValue({ id: ADDRESS_ID, userId: USER_ID });

    const result = await findOwned(USER_ID, ADDRESS_ID);

    expect(result).toEqual({ id: ADDRESS_ID, userId: USER_ID });
    expect(findFirst).toHaveBeenCalledWith({ where: { id: ADDRESS_ID, userId: USER_ID } });
  });

  it("returns null when the row is not owned or does not exist", async () => {
    findFirst.mockResolvedValue(null);

    const result = await findOwned(USER_ID, "not-mine");

    expect(result).toBeNull();
  });
});

describe("updateOwned", () => {
  it("puts userId in the where clause, alongside the target id", async () => {
    updateMany.mockResolvedValue({ count: 1 });
    const fields = {
      recipientName: "홍길동",
      recipientPhone: "010-1234-5678",
      postalCode: "06236",
      address: "서울시 강남구",
    };

    const result = await updateOwned(USER_ID, ADDRESS_ID, fields);

    expect(result).toEqual({ count: 1 });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: ADDRESS_ID, userId: USER_ID },
      data: fields,
    });
  });
});

describe("deleteOwned", () => {
  it("puts userId in the where clause, alongside the target id", async () => {
    deleteMany.mockResolvedValue({ count: 1 });

    const result = await deleteOwned(USER_ID, ADDRESS_ID);

    expect(result).toEqual({ count: 1 });
    expect(deleteMany).toHaveBeenCalledWith({ where: { id: ADDRESS_ID, userId: USER_ID } });
  });

  it("returns count: 0 when nothing matched (not owned or does not exist)", async () => {
    deleteMany.mockResolvedValue({ count: 0 });

    const result = await deleteOwned(USER_ID, "not-mine");

    expect(result).toEqual({ count: 0 });
  });
});

describe("setDefault — AC-ADDRESS-006 (success path)", () => {
  it("sets the target THEN unsets the member's other defaults, in that order", async () => {
    txUpdateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 1 });

    const result = await setDefault(USER_ID, ADDRESS_ID);

    expect(result).toBe(true);
    expect(txUpdateMany).toHaveBeenCalledTimes(2);
    // Call 1: the target, SET to true.
    expect(txUpdateMany.mock.calls[0]![0]).toMatchObject({
      where: { id: ADDRESS_ID, userId: USER_ID },
      data: { isDefault: true },
    });
    // Call 2: everyone else, UNSET — happens strictly after call 1.
    expect(txUpdateMany.mock.calls[1]![0]).toMatchObject({
      where: { userId: USER_ID, isDefault: true, id: { not: ADDRESS_ID } },
      data: { isDefault: false },
    });
  });
});

describe("setDefault — AC-ADDRESS-007 (ownership failure leaves the existing default untouched)", () => {
  it("returns false and calls updateMany EXACTLY ONCE when the target is not owned", async () => {
    txUpdateMany.mockResolvedValueOnce({ count: 0 });

    const result = await setDefault(USER_ID, ADDRESS_ID);

    expect(result).toBe(false);
    // The load-bearing assertion: the second updateMany (which would unset
    // the member's real default) must NEVER be reached when the first call
    // matched zero rows — plan.md M3's "set first" invariant.
    expect(txUpdateMany).toHaveBeenCalledTimes(1);
  });
});

describe("createForUser — AC-ADDRESS-008 (first address auto-default)", () => {
  it("creates with isDefault: true when the member has zero existing addresses", async () => {
    txCount.mockResolvedValue(0);
    txCreate.mockResolvedValue({ id: "a1", isDefault: true });

    await createForUser(USER_ID, {
      recipientName: "홍길동",
      recipientPhone: "010-1234-5678",
      postalCode: "06236",
      address: "서울시 강남구",
    });

    expect(txCreate).toHaveBeenCalledWith({
      data: {
        userId: USER_ID,
        recipientName: "홍길동",
        recipientPhone: "010-1234-5678",
        postalCode: "06236",
        address: "서울시 강남구",
        isDefault: true,
      },
    });
  });

  it("creates with isDefault: false when the member already has an address", async () => {
    txCount.mockResolvedValue(1);
    txCreate.mockResolvedValue({ id: "a2", isDefault: false });

    await createForUser(USER_ID, {
      recipientName: "홍길동",
      recipientPhone: "010-1234-5678",
      postalCode: "06236",
      address: "서울시 강남구",
    });

    expect(txCreate.mock.calls[0]![0].data.isDefault).toBe(false);
  });
});
