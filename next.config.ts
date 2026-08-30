import type { NextConfig } from "next";

/**
 * SPEC-STOREFRONT-001 M1 — Next.js configuration.
 *
 * Carries the `next/image` remote host allow-list and nothing else (plan.md
 * §D-1).
 *
 * `picsum.photos` is a PLACEHOLDER host, not the real product image host. The
 * repository has no seed data and product image hosting is still undecided, so
 * this entry exists to let the screen run until that decision lands (plan.md
 * §D-2). When real hosting is chosen, this list is replaced or extended — and
 * that config change MUST land BEFORE real product image URLs enter the data,
 * because `next/image` throws at runtime on an unlisted host.
 *
 * Do not add hosts speculatively: the allow-list is an input-validation
 * boundary, and a guessed entry widens it for no delivered capability.
 */
const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "picsum.photos" }],
  },
};

export default nextConfig;
