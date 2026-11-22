import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Spinner } from "./spinner";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const variantClasses: Record<Variant, string> = {
  primary: "bg-accent text-accent-foreground font-semibold hover:bg-accent-hover",
  secondary:
    "border border-border bg-surface-raised text-foreground hover:border-border-strong hover:bg-surface-hover",
  ghost: "text-foreground hover:bg-surface-raised",
  danger: "bg-danger text-accent-foreground font-semibold hover:opacity-90",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-9 px-3 text-xs gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-7 text-base gap-2",
};

type StyleProps = {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  className?: string;
};

/** Shared class names so links can look exactly like buttons. */
export function buttonClasses({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
}: StyleProps = {}) {
  return cn(
    "inline-flex shrink-0 items-center justify-center rounded-control font-medium transition-colors",
    "disabled:cursor-not-allowed disabled:opacity-60",
    variantClasses[variant],
    sizeClasses[size],
    fullWidth && "w-full",
    className,
  );
}

type ButtonProps = ComponentProps<"button"> &
  StyleProps & {
    /** Shows a spinner and disables the button while an action runs. */
    loading?: boolean;
    loadingText?: string;
  };

export function Button({
  variant,
  size,
  fullWidth,
  className,
  loading = false,
  loadingText,
  disabled,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses({ variant, size, fullWidth, className })}
      {...props}
    >
      {loading ? (
        <>
          <Spinner />
          <span>{loadingText ?? children}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}

type ButtonLinkProps = StyleProps & {
  href: ComponentProps<typeof Link>["href"];
  children: ReactNode;
} & Omit<ComponentProps<"a">, "href" | "className">;

/** A Next.js link styled as a button. */
export function ButtonLink({
  href,
  variant,
  size,
  fullWidth,
  className,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      href={href}
      className={buttonClasses({ variant, size, fullWidth, className })}
      {...props}
    >
      {children}
    </Link>
  );
}
