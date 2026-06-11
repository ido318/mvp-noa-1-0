import React from "react";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
  noPad?: boolean;
}

export function Card({ hover = false, noPad = false, children, className = "", ...props }: CardProps) {
  return (
    <div
      {...props}
      className={[
        "bg-[var(--surface)] border border-[var(--line)] rounded-[var(--r-lg)] shadow-[var(--sh-sm)]",
        noPad ? "" : "p-[18px]",
        hover ? "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--sh-md)] cursor-pointer" : "",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}
