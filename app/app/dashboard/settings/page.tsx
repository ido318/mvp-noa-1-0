import { EmptyState } from "@/components/dashboard/ui/empty-state";
import { SettingsIcon } from "@/components/dashboard/icons";

export default function SettingsPage() {
  return (
    <div className="p-6">
      <h1 className="mb-6 text-xl font-extrabold text-[var(--ink)]">הגדרות</h1>
      <EmptyState
        icon={<SettingsIcon size={36} />}
        title="בקרוב"
        subtitle="הגדרות קליניקה, ניהול משתמשים, שעות פעילות וחסימות יומן"
      />
    </div>
  );
}
