import Image from "next/image";
import Link from "next/link";

/**
 * SPEC-BRAND-001 M1 — the brand logo, wrapped in a home link.
 *
 * The rendered asset (`logo_mono_black.png`) was pixel-verified against the
 * live Claude Design source during a sync-phase correction cycle — see
 * design.md §2.3/§8.3 item 1 (CONFIRMED). No code change was needed.
 *
 * This component renders the asset via next/image and is wired into
 * SiteHeader (SPEC-BRAND-001 M3).
 */
export function BrandLogo() {
  return (
    <Link href="/">
      <Image
        src="/brand/logo_mono_black.png"
        alt="OUR"
        width={40}
        height={40}
      />
    </Link>
  );
}
