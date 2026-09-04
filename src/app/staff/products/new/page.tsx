import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { resolveAdminSession } from "@/features/admin/services/admin-session";
import { listCategoriesForAdmin } from "@/features/admin/repositories/admin-product-repository";
import { ProductForm } from "@/app/staff/products/ProductForm";

/**
 * SPEC-ADMIN-002 M4 — `/staff/products/new` (REQ-ADMIN-024/029/037/040).
 *
 * A Server Component whose only job is to gate on the admin session and load
 * the category options, then hand both to the shared client form. The
 * categories are read on the SERVER precisely so the <select> can only ever
 * offer rows that exist (REQ-ADMIN-029) — there is no client-side category
 * fetch to race or spoof.
 *
 * The session check here gates the SCREEN. It is not what protects the write:
 * `POST /staff/api/products` re-verifies the session itself on every request
 * (REQ-ADMIN-038), because this page's check says nothing about the state of
 * the session at submit time.
 */
export default async function NewStaffProductPage() {
  const jar = await cookies();
  const session = await resolveAdminSession(jar);
  if (session === null) {
    redirect("/staff/login");
  }

  const categories = await listCategoriesForAdmin();

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-semibold text-neutral-900">새 상품 등록</h1>
      <p className="mt-2 text-sm text-neutral-600">
        <a href="/staff/products">상품 목록으로 돌아가기</a>
      </p>

      {categories.length === 0 ? (
        // The form cannot produce a valid submission without at least one
        // category, and this SPEC deliberately does not build category
        // management (spec.md §3) — so say so rather than rendering a select
        // with nothing in it.
        <p role="alert" className="mt-6 text-sm text-red-600">
          등록된 카테고리가 없어 상품을 만들 수 없습니다. 카테고리를 먼저 추가해 주세요.
        </p>
      ) : (
        <ProductForm mode="create" categories={categories} />
      )}
    </main>
  );
}
