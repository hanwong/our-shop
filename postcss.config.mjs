/**
 * SPEC-STOREFRONT-001 M1 — the only Tailwind v4 configuration file.
 *
 * v4 is CSS-first: there is deliberately no `tailwind.config.js`, no
 * `npx tailwindcss init`, and no `@tailwind base/components/utilities`
 * directives. Content detection is automatic, so no purge config either
 * (plan.md §C-1).
 */
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
