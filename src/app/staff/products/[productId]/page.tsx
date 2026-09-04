import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { resolveAdminSession } from "@/features/admin/services/admin-session";
import {
  findProductByIdForAdmin,
  listCategoriesForAdmin,
} from "@/features/admin/repositories/admin-product-repository";
import { ProductForm } from "@/app/staff/products/ProductForm";
import type { AdminProductDetailDTO } from "@/features/admin/types/admin";

/**
 * SPEC-ADMIN-002 M4/M5 — `/staff/products/[productId]`
 * (REQ-ADMIN-025/029/031/032/037/040).
 *
 * Reads through `findProductByIdForAdmin`, which carries NO sellability
 * condition — the deliberate opposite of the customer-facing findProductById
 * (REQ-ADMIN-035). A suspended product must remain reachable here, or there
 * would be no screen from which to restore it.
 *
 * The session check gates the screen only; the three write routes re-verify
 * independently on every request (REQ-ADMIN-038).
 */
export default async function EditStaffProductPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const jar = await cookies();
  const session = await resolveAdminSession(jar);
  if (session === null) {
    redirect("/staff/login");
  }

  const { productId } = await params;

  const [row, categories] = await Promise.all([
    findProductByIdForAdmin(productId),
    listCategoriesForAdmin(),
  ]);

  if (row === null) {
    notFound();
  }

  const product: AdminProductDetailDTO = {
    id: row.id,
    name: row.name,
    description: row.description,
    price: row.price,
    stock: row.stock,
    images: row.images,
    categoryId: row.categoryId,
    isActive: row.isActive,
  };

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-semibold text-neutral-900">상품 수정</h1>
      <p className="mt-2 text-sm text-neutral-600">
        <a href="/staff/products">상품 목록으로 돌아가기</a>
      </p>

      <ProductForm mode="edit" categories={categories} product={product} />
    </main>
  );
}
