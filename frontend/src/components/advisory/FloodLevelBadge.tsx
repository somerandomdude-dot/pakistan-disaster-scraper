const levelStyles: Record<string, string> = {
  "below low": "border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 text-text-secondary",
  low: "border-sky-200 dark:border-sky-500/30 bg-sky-50 dark:bg-sky-500/10 text-sky-800 dark:text-sky-400",
  medium: "border-amber-300 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 text-amber-900 dark:text-amber-500",
  "low to medium": "border-amber-300 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 text-amber-900 dark:text-amber-500",
  high: "border-orange-300 dark:border-orange-500/30 bg-orange-50 dark:bg-orange-500/10 text-orange-900 dark:text-orange-500",
  "medium to high": "border-orange-300 dark:border-orange-500/30 bg-orange-50 dark:bg-orange-500/10 text-orange-900 dark:text-orange-500",
  "very high": "border-red-300 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 text-red-800 dark:text-red-500",
  "exceptionally high": "border-red-900 dark:border-red-600/40 bg-red-100 dark:bg-red-600/20 text-red-950 dark:text-red-400",
};

export default function FloodLevelBadge({ level }: { level?: string | null }) {
  if (!level) return <span className="text-text-secondary">Not provided</span>;
  const style = levelStyles[level.toLowerCase()];
  if (!style) return <span className="text-text-secondary">{level}</span>;
  return (
    <span className={`inline-flex rounded border px-2 py-0.5 text-xs font-semibold ${style}`}>
      {level}
    </span>
  );
}
