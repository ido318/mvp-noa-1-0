"use client";
import React from "react";

type BtnVariant = "primary" | "ghost" | "soft" | "danger" | "dangerSoft";
type BtnSize = "sm" | "md" | "lg";

const variantStyles: Record<BtnVariant, string> = {
  primary:
    "bg-[var(--brand-600)] text-white shadow-[var(--sh-sm)] hover:brightness-110 active:brightness-95",
  ghost:
    "bg-transparent text-[var(--ink-2)] hover:bg-[var(--surface-2)] active:bg-[var(--line-2)]",
  soft:
    "bg-[var(--brand-50)] text-[var(--brand-700)] hover:bg-[var(--brand-100)] active:bg-[var(--brand-200)]",
  danger:
    "bg-[var(--red-600)] text-white shadow-[var(--sh-sm)] hover:brightness-110 active:brightness-95",
  dangerSoft:
    "bg-[var(--red-50)] text-[var(--red-700)] hover:bg-[var(--red-100)] active:bg-[var(--red-100)]",
};

const sizeStyles: Record<BtnSize, string> = {
  sm: "h-8 px-3 text-xs rounded-[11px] gap-1.5",
  md: "h-9 px-4 text-sm rounded-[11px] gap-2",
  lg: "h-11 px-5 text-sm rounded-[11px] gap-2",
};

interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant;
  size?: BtnSize;
  loading?: boolean;
}

export function Btn({
  variant = "primary",
  size = "md",
  loading = false,
  children,
  className = "",
  disabled,
  ...props
}: BtnProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={[
        "inline-flex items-center justify-center font-semibold transition-all duration-150 select-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-500)]",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        variantStyles[variant],
        sizeStyles[size],
        className,
      ].join(" ")}
    >
      {loading ? (
        <span className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
      ) : children}
    </button>
  );
}
