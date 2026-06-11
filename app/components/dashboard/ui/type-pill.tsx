import React from "react";
import { HomeIcon } from "@/components/dashboard/icons";

export type VisitType =
  | "checkup"
  | "vaccine"
  | "surgery"
  | "neutering"
  | "home_visit"
  | "phone_consultation"
  | "followup"
  | "consultation"
  | "vaccination"
  | "urgent"
  | "follow_up"
  | "other";

const VISIT_LABELS: Record<VisitType, string> = {
  checkup:            "בדיקה",
  vaccine:            "חיסון",
  vaccination:        "חיסון",
  surgery:            "ניתוח",
  neutering:          "עיקור/סירוס",
  home_visit:         "ביקור בית",
  phone_consultation: "ייעוץ טלפוני",
  followup:           "מעקב",
  follow_up:          "מעקב",
  consultation:       "ייעוץ",
  urgent:             "דחוף",
  other:              "אחר",
};

const VISIT_COLORS: Record<VisitType, { fg: string; bg: string }> = {
  checkup:            { fg: "#3E9C86", bg: "#E7F4F0" },
  vaccine:            { fg: "#5B7CFA", bg: "#EEF1FE" },
  vaccination:        { fg: "#5B7CFA", bg: "#EEF1FE" },
  surgery:            { fg: "#E0696D", bg: "#FBEAEB" },
  neutering:          { fg: "#E0696D", bg: "#FBEAEB" },
  home_visit:         { fg: "#D06B33", bg: "#FDF3EB" },
  phone_consultation: { fg: "#5B7CFA", bg: "#EEF1FE" },
  followup:           { fg: "#C2891E", bg: "#FBF2DD" },
  follow_up:          { fg: "#C2891E", bg: "#FBF2DD" },
  consultation:       { fg: "#3E9C86", bg: "#E7F4F0" },
  urgent:             { fg: "#B91C1C", bg: "#FEF2F2" },
  other:              { fg: "#867667", bg: "#F4EDE6" },
};

interface TypePillProps {
  type: string;
  showHomeIcon?: boolean;
  className?: string;
}

export function TypePill({ type, showHomeIcon, className = "" }: TypePillProps) {
  const t = type as VisitType;
  const { fg, bg } = VISIT_COLORS[t] ?? { fg: "#867667", bg: "#F4EDE6" };
  const label = VISIT_LABELS[t] ?? type;
  const isHome = type === "home_visit" || showHomeIcon;

  return (
    <span
      className={["inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold", className].join(" ")}
      style={{ color: fg, backgroundColor: bg }}
    >
      {isHome && <HomeIcon size={10} />}
      {label}
    </span>
  );
}
