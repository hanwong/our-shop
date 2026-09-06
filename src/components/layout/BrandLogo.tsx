import Image from "next/image";
import Link from "next/link";

/**
 * SPEC-BRAND-001 M1 — the brand logo, wrapped in a home link.
 *
 * The rendered asset is a code-based-fallback placeholder, not a design-
 * confirmed asset: design.md §8.3 lists `logo_mono_black.png` as PROVISIONAL
 * (pixel content unverified — the filename choice rests on naming-safety
 * inference, not on an actual review of the live Claude Design source). A
 * future re-confirmation pass replaces this file once DesignSync access is
 * restored; see design.md §2.3 for the full rationale.
 *
 * This component only renders the asset via next/image; it is not yet wired
 * into SiteHeader (that wiring is SPEC-BRAND-001 M3's job).
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
