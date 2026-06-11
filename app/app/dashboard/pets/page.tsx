import { EmptyState } from "@/components/dashboard/ui/empty-state";
import { PetsIcon } from "@/components/dashboard/icons";

export default function PetsPage() {
  return (
    <div className="p-6">
      <h1 className="mb-6 text-xl font-extrabold text-[var(--ink)]">חיות מחמד</h1>
      <EmptyState
        icon={<PetsIcon size={36} />}
        title="בקרוב"
        subtitle="ספרינט 5 — תצוגת כלל החיות עם פרופיל, חיסונים ותרופות"
      />
    </div>
  );
}
