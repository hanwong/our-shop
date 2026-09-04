"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import type {
  AdminCategoryOptionDTO,
  AdminProductDetailDTO,
  ProductInputErrors,
} from "@/features/admin/types/admin";

/**
 * SPEC-ADMIN-002 M4/M5 — the product form shared by create and edit
 * (REQ-ADMIN-024/025/027/029/030/031/032).
 *
 * This is the ONE place this SPEC departs from SPEC-ADMIN-001's self-contained
 * page style (design.md §5), and only just: it is a local component inside the
 * `staff/products` route segment, not a global shared widget — the same
 * placement SPEC-ADMIN-001 gave staff/orders/[orderId]/CancelOrderButton.tsx.
 * The reason to share is specific: if the create form and the edit form each
 * owned their own field set, the two would eventually validate the same product
 * differently, and the admin would meet rules that depend on which screen they
 * arrived from.
 *
 * No optimistic updates, matching CancelOrderButton's discipline: on success
 * the component asks the server what actually happened (router.refresh /
 * router.push) rather than assuming its own write landed.
 *
 * CSRF: the csrf_token cookie is deliberately not httpOnly (csrf.ts's
 * buildCsrfCookie doc comment) precisely so client JS can echo it back as
 * X-CSRF-Token — the double-submit half of the pattern the server already
 * implements.
 */

/** Reads the csrf_token cookie — the same inline parse CancelOrderButton uses. */
function readCsrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]!) : "";
}

interface ProductFormProps {
  mode: "create" | "edit";
  categories: AdminCategoryOptionDTO[];
  /** Present in edit mode only — the current values to pre-fill. */
  product?: AdminProductDetailDTO;
}

const GENERIC_ERROR = "저장하지 못했습니다. 잠시 후 다시 시도해 주세요";

export function ProductForm({ mode, categories, product }: ProductFormProps) {
  const router = useRouter();

  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  // Held as strings because that is what an <input> yields; converted to
  // numbers exactly once, at submit, so a partially-typed value never has to
  // round-trip through NaN.
  const [price, setPrice] = useState(product ? String(product.price) : "");
  const [stock, setStock] = useState(product ? String(product.stock) : "");
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? categories[0]?.id ?? "");
  const [images, setImages] = useState<string[]>(product?.images ?? []);
  const [isActive, setIsActive] = useState(product?.isActive ?? true);

  const [errors, setErrors] = useState<ProductInputErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function setImageAt(index: number, value: string) {
    setImages((current) => current.map((url, i) => (i === index ? value : url)));
  }

  function removeImageAt(index: number) {
    setImages((current) => current.filter((_, i) => i !== index));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setErrors({});
    setFormError(null);

    // `isActive` is deliberately NOT part of this payload — sellability moves
    // only through the separate /active route, so saving an edit can never
    // revive or suspend a product as a side effect (design.md §1).
    const payload = {
      name,
      description,
      price: Number(price),
      stock: Number(stock),
      categoryId,
      images,
    };

    const url = mode === "create" ? "/staff/api/products" : `/staff/api/products/${product!.id}`;

    try {
      const response = await fetch(url, {
        method: mode === "create" ? "POST" : "PATCH",
        headers: {
          "content-type": "application/json",
          "X-CSRF-Token": readCsrfToken(),
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        if (mode === "create") {
          router.push("/staff/products");
        } else {
          router.refresh();
        }
        return;
      }

      const failure: { errors?: ProductInputErrors; error?: string } = await response
        .json()
        .catch(() => ({}));
      if (failure.errors) {
        setErrors(failure.errors);
      } else {
        setFormError(failure.error ?? GENERIC_ERROR);
      }
    } catch {
      setFormError(GENERIC_ERROR);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleActive() {
    if (submitting || !product) return;
    setSubmitting(true);
    setFormError(null);

    try {
      const response = await fetch(`/staff/api/products/${product.id}/active`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "X-CSRF-Token": readCsrfToken(),
        },
        body: JSON.stringify({ isActive: !isActive }),
      });

      if (response.ok) {
        setIsActive((current) => !current);
        router.refresh();
        return;
      }

      const failure: { error?: string } = await response.json().catch(() => ({}));
      setFormError(failure.error ?? "판매 상태를 변경하지 못했습니다");
    } catch {
      setFormError("판매 상태를 변경하지 못했습니다");
    } finally {
      setSubmitting(false);
    }
  }

  /** Renders a field error as an alert, wired to its input by id. */
  function fieldError(field: keyof ProductInputErrors) {
    const message = errors[field];
    if (!message) return null;
    return (
      <p id={`${field}-error`} role="alert" className="mt-1 text-sm text-red-600">
        {message}
      </p>
    );
  }

  const describedBy = (field: keyof ProductInputErrors, extra?: string) =>
    [extra, errors[field] ? `${field}-error` : undefined].filter(Boolean).join(" ") || undefined;

  return (
    <div>
      <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-5">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-neutral-700">
            상품명
          </label>
          <input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-describedby={describedBy("name")}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
          {fieldError("name")}
        </div>

        <div>
          <label htmlFor="categoryId" className="block text-sm font-medium text-neutral-700">
            카테고리
          </label>
          <select
            id="categoryId"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            aria-describedby={describedBy("categoryId")}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {fieldError("categoryId")}
        </div>

        <div>
          <label htmlFor="price" className="block text-sm font-medium text-neutral-700">
            가격 (원)
          </label>
          <input
            id="price"
            type="number"
            min={1}
            step={1}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            aria-describedby={describedBy("price")}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
          {fieldError("price")}
        </div>

        <div>
          <label htmlFor="stock" className="block text-sm font-medium text-neutral-700">
            재고
          </label>
          <input
            id="stock"
            type="number"
            min={0}
            step={1}
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            aria-describedby={describedBy("stock", "stock-hint")}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
          {/*
            spec.md §4's accepted residual risk, surfaced where it can actually
            be acted on: an admin saving this form writes an ABSOLUTE stock
            value, while an order cancellation restores stock with a relative
            increment. A cancellation landing while this form is open is
            therefore overwritten on save. The SPEC declines to add locking
            here (that would split the concurrency model across the two write
            paths), so telling the admin is the whole mitigation.
          */}
          <p id="stock-hint" className="mt-1 text-xs text-neutral-500">
            저장 시 이 값으로 덮어씁니다. 그 사이 주문 취소로 복원된 재고가 있다면 함께 덮어써집니다.
          </p>
          {fieldError("stock")}
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-neutral-700">
            설명
          </label>
          <textarea
            id="description"
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            aria-describedby={describedBy("description")}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
          {fieldError("description")}
        </div>

        <fieldset>
          <legend className="text-sm font-medium text-neutral-700">이미지 URL</legend>
          {/*
            URLs only, never a file input (REQ-ADMIN-028) — this SPEC adds no
            upload pipeline and no storage dependency. Array order is display
            order, so add/remove is enough and reordering is out of scope.
          */}
          <p className="mt-1 text-xs text-neutral-500">
            이미 업로드된 이미지의 절대 URL을 붙여 넣으세요. 입력 순서가 표시 순서입니다.
          </p>
          {images.map((url, index) => (
            <div key={index} className="mt-2 flex gap-2">
              <label htmlFor={`image-${index}`} className="sr-only">
                이미지 URL {index + 1}
              </label>
              <input
                id={`image-${index}`}
                value={url}
                onChange={(e) => setImageAt(index, e.target.value)}
                className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => removeImageAt(index)}
                className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
              >
                이미지 {index + 1} 제거
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setImages((current) => [...current, ""])}
            className="mt-2 rounded-md border border-neutral-300 px-3 py-2 text-sm"
          >
            이미지 추가
          </button>
          {fieldError("images")}
        </fieldset>

        {formError ? (
          <p role="alert" className="text-sm text-red-600">
            {formError}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          저장
        </button>
      </form>

      {/*
        Suspend/restore sits OUTSIDE the form element and is visually separated,
        so it cannot be reached by submitting the form and is hard to press by
        accident (design.md §1/§6). It is absent in create mode: a product that
        does not exist yet cannot be suspended.
      */}
      {mode === "edit" && product ? (
        <section className="mt-12 border-t border-neutral-200 pt-6">
          <h2 className="text-sm font-medium text-neutral-700">판매 상태</h2>
          <p className="mt-1 text-xs text-neutral-500">
            {isActive
              ? "판매를 중단하면 고객 목록과 상세 화면에서 사라집니다. 상품과 주문 내역은 삭제되지 않습니다."
              : "판매를 재개하면 고객 목록과 상세 화면에 다시 표시됩니다."}
          </p>
          <button
            type="button"
            onClick={handleToggleActive}
            disabled={submitting}
            className={
              isActive
                ? "mt-3 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                : "mt-3 rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            }
          >
            {isActive ? "판매 중단" : "판매 재개"}
          </button>
        </section>
      ) : null}
    </div>
  );
}
