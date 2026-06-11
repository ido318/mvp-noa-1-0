import React from "react";

interface BadgeProps {
  children: React.ReactNode;
  color?: "brand" | "coral" | "amber" | "red" | "green" | "muted";
  dot?: boolean;
  pulse?: boolean;
  className?: string;
}

const colorStyles: Record<NonNullable<BadgeProps["color"]>, string> = {
  brand:  "bg-[var(--brand-50)]  text-[var(--brand-700)]",
  coral:  "bg-[var(--coral-50)]  text-[var(--coral-700)]",
  amber:  "bg-[var(--amber-50)]  text-[var(--amber-600)]",
  red:    "bg-[var(--red-50)]    text-[var(--red-700)]",
  green:  "bg-[#E9F5EF]          text-[#2F7D5B]",
  muted:  "bg-[var(--line-2)]    text-[var(--muted)]",
};

const dotColors: Record<NonNullable<BadgeProps["color"]>, string> = {
  brand:  "bg-[var(--brand-500)]",
  coral:  "bg-[var(--coral-500)]",
  amber:  "bg-[var(--amber-500)]",
  red:    "bg-[var(--red-500)]",
  green:  "bg-[#3E9C86]",
  muted:  "bg-[var(--faint)]",
};

export function Badge({ children, color = "brand", dot = false, pulse = false, className = "" }: BadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold",
        colorStyles[color],
        className,
      ].join(" ")}
    >
      {dot && (
        <span
          className={[
            "w-1.5 h-1.5 rounded-full flex-shrink-0",
            dotColors[color],
            pulse ? "animate-[pulseRing_2s_ease-in-out_infinite]" : "",
          ].join(" ")}
        />
      )}
      {children}
    </span>
  );
}
