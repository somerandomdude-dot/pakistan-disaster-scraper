const levelStyles: Record<string, string> = {
  "below low": "border-slate-300 bg-slate-100 text-slate-700",
  low: "border-sky-200 bg-sky-50 text-sky-800",
  medium: "border-amber-300 bg-amber-50 text-amber-900",
  "low to medium": "border-amber-300 bg-amber-50 text-amber-900",
  high: "border-orange-300 bg-orange-50 text-orange-900",
  "medium to high": "border-orange-300 bg-orange-50 text-orange-900",
  "very high": "border-red-300 bg-red-50 text-red-800",
  "exceptionally high": "border-red-900 bg-red-100 text-red-950",
};

export default function FloodLevelBadge({ level }: { level?: string | null }) {
  if (!level) return <span className="text-slate-500">Not provided</span>;
  const style = levelStyles[level.toLowerCase()];
  if (!style) return <span className="text-slate-700">{level}</span>;
  return (
    <span className={`inline-flex rounded border px-2 py-0.5 text-xs font-semibold ${style}`}>
      {level}
    </span>
  );
}
