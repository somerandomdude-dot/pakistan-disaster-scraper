import { cn } from "@/lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "critical" | "high" | "medium" | "low" | "healthy" | "unhealthy" | "outline";
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const variantStyles: Record<string, string> = {
    default: "bg-slate-100 text-slate-800 border-transparent",
    critical: "bg-red-50 text-red-700 border-red-200",
    high: "bg-orange-50 text-orange-700 border-orange-200",
    medium: "bg-amber-50 text-amber-700 border-amber-200",
    low: "bg-sky-50 text-sky-700 border-sky-200",
    healthy: "bg-emerald-50 text-emerald-700 border-emerald-200",
    unhealthy: "bg-rose-50 text-rose-700 border-rose-200",
    outline: "text-slate-600 border-slate-200",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold transition-colors border",
        variantStyles[variant] || variantStyles.default,
        className
      )}
      {...props}
    />
  );
}
