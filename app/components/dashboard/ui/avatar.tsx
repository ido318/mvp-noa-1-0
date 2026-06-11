import React from "react";
import { AnimalIcon, WaveIcon } from "@/components/dashboard/icons";

interface AnimalAvatarProps {
  species: string;
  color?: string;
  size?: number;
  className?: string;
}

export function AnimalAvatar({ species, color = "#E88858", size = 36, className = "" }: AnimalAvatarProps) {
  const bg = color + "1A"; // 10% opacity
  return (
    <span
      className={["inline-flex items-center justify-center rounded-full flex-shrink-0", className].join(" ")}
      style={{ width: size, height: size, backgroundColor: bg, color }}
    >
      <AnimalIcon species={species} size={Math.round(size * 0.55)} />
    </span>
  );
}

interface PersonAvatarProps {
  initials: string;
  size?: number;
  className?: string;
}

export function PersonAvatar({ initials, size = 36, className = "" }: PersonAvatarProps) {
  return (
    <span
      className={["inline-flex items-center justify-center rounded-full flex-shrink-0 font-bold text-white select-none", className].join(" ")}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.35),
        background: "linear-gradient(135deg, var(--brand-400), var(--brand-600))",
      }}
    >
      {initials}
    </span>
  );
}

interface TomerChipProps {
  showName?: boolean;
  size?: "sm" | "md";
  className?: string;
}

export function TomerChip({ showName = false, size = "sm", className = "" }: TomerChipProps) {
  const sz = size === "sm" ? 24 : 32;
  return (
    <span
      className={["inline-flex items-center gap-1.5 text-[var(--coral-700)]", className].join(" ")}
    >
      <span
        className="inline-flex items-center justify-center rounded-full flex-shrink-0"
        style={{
          width: sz,
          height: sz,
          background: "linear-gradient(145deg,#F0888B,#DE5A60)",
          color: "#fff",
        }}
      >
        <WaveIcon size={Math.round(sz * 0.55)} />
      </span>
      {showName && <span className="text-xs font-semibold">תומר</span>}
    </span>
  );
}
