import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";

/**
 * SPEC-DESIGN-001 M1 — Classical form-field primitive: label + input (or
 * textarea) + error text rendered as one set (plan.md §B.1/§D.2/§D.3).
 *
 * plan.md §B.1 rejected splitting this into three independent components:
 * the 8-file survey (7 exact matches + `CheckoutInteractive.tsx:138`'s
 * near-variant, spec.md §1.3/acceptance.md AC-DESIGN-009) always repeats
 * label + input + error TOGETHER, so the component boundary follows that
 * repeated set rather than the individual elements.
 *
 * @MX:ANCHOR fan-in target — plan.md §H projected 8+ call sites once M3/M4
 * replaced every form-field consumer (login/signup ×2, staff/login,
 * ProductForm, CheckoutForm, CheckoutInteractive, OrderLookupForm,
 * ReviewForm — the latter via `multiline`, plan.md §D.3's
 * `.field` + `label` + `textarea.input` mapping). M5 final measurement:
 * fan-in is **9** (`grep -rl 'from "@/components/ui/FormField"' src/` —
 * login/signup ×2, staff/login, ProductForm, CheckoutForm,
 * CheckoutInteractive, OrderLookupForm, AddToCartButton, ReviewForm;
 * CheckoutInteractive/AddToCartButton consume the exported class-builder
 * functions rather than the `<FormField>` component itself, plan.md §D
 * near-variant handling — the import still counts as a fan-in consumer of
 * this module), confirming the ANCHOR classification (fan_in >= 3,
 * CLAUDE.md § MX Tag Quality Gates).
 * @MX:REASON this is the site's single definition point for form fields
 * (REQ-DESIGN-003/004/005) — a regression here changes every form field on
 * the site once consumers are migrated.
 */

type SharedFieldProps = {
  /** Associates the label and the input/textarea. Must be unique per field. */
  id: string;
  label: ReactNode;
  /**
   * Field-level validation message. When set, renders a linked `<p>` and
   * wires `aria-invalid`/`aria-describedby` on the input so the error stays
   * discoverable to assistive tech (REQ-DESIGN-007 — no accessible-name or
   * behavior regression from the primitive swap).
   */
  error?: string;
  /** Wrapper `<div>` className passthrough — parity with Button's className prop. */
  wrapperClassName?: string;
};

export type FormFieldProps =
  | (SharedFieldProps & { multiline?: false } & Omit<InputHTMLAttributes<HTMLInputElement>, "id">)
  | (SharedFieldProps & { multiline: true } & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id">);

const FOCUS_VISIBLE_CLASSES =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export function fieldLabelClassName(className = ""): string {
  return ["block text-sm font-medium text-text", className].filter(Boolean).join(" ");
}

/**
 * Border uses `--color-divider` (plan.md §D.1b maps the old form input's
 * bordered-gray-300 literal to the Classical hairline token) rather than a
 * Tailwind gray-scale literal (AC-DESIGN-005(a)).
 */
export function fieldInputClassName({ className = "" }: { className?: string } = {}): string {
  return [
    "mt-[var(--space-1)] w-full rounded-md border border-divider px-[var(--space-3)] py-[var(--space-2)] text-sm text-text",
    FOCUS_VISIBLE_CLASSES,
    className,
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * Classical has no error/danger color role — a single-accent (mono) system
 * (plan.md §D.1 note 2; `text-red-600`/`bg-red-600` map to "no corresponding
 * token" in plan.md §D.1b and are out of scope, spec.md §3). This keeps the
 * existing Tailwind `text-red-600` literal already used by every consumer
 * rather than inventing a new color role Classical does not define
 * (§1.5 — "이 SPEC이 값을 발명하지 않는다").
 */
export function fieldErrorClassName(className = ""): string {
  return ["mt-[var(--space-1)] text-sm text-red-600", className].filter(Boolean).join(" ");
}

export function FormField(props: FormFieldProps) {
  const { id, label, error, wrapperClassName, multiline, className, ...rest } = props;
  const errorId = error ? `${id}-error` : undefined;

  const sharedProps = {
    id,
    className: fieldInputClassName({ className }),
    "aria-invalid": error ? true : undefined,
    "aria-describedby": errorId,
  };

  return (
    <div className={wrapperClassName}>
      <label htmlFor={id} className={fieldLabelClassName()}>
        {label}
      </label>
      {multiline ? (
        <textarea {...sharedProps} {...(rest as Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id">)} />
      ) : (
        <input {...sharedProps} {...(rest as Omit<InputHTMLAttributes<HTMLInputElement>, "id">)} />
      )}
      {error ? (
        <p id={errorId} className={fieldErrorClassName()}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
