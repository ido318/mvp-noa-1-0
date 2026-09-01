import { Badge } from "@/components/dashboard/ui/badge";

export function AiSafetyNotice() {
  return (
    <div className="rounded-[var(--r-md)] border border-[var(--amber-200)] bg-[var(--amber-50)] px-3 py-2 text-sm text-[var(--ink-2)]">
      <Badge color="amber">AI Draft</Badge>
      <span className="ms-2">טיוטת AI אינה רשומה רשמית עד אישור וטרינר או מנהל.</span>
    </div>
  );
}
