import { EmptyState } from "@/components/dashboard/ui/empty-state";
import { RecordsIcon } from "@/components/dashboard/icons";

export default function RecordsPage() {
  return (
    <div className="p-6">
      <h1 className="mb-6 text-xl font-extrabold text-[var(--ink)]">תיקים רפואיים</h1>
      <EmptyState
        icon={<RecordsIcon size={36} />}
        title="בקרוב"
        subtitle="ספרינט 5 — ביקורים, סיכומי AI, תרופות וחיסונים"
      />
    </div>
  );
}
