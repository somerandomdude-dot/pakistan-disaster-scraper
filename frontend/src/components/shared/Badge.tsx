import { cn } from "@/lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "critical" | "high" | "medium" | "low" | "healthy" | "unhealthy" | "outline";
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const variantStyles: Record<string, string> = {
    default: "bg-slate-100 text-slate-800 border-transparent",
    critical: "bg-red-100 text-red-800 border-red-200",
    high: "bg-orange-100 text-orange-800 border-orange-200",
    medium: "bg-amber-100 text-amber-800 border-amber-200",
    low: "bg-blue-100 text-blue-800 border-blue-200",
    healthy: "bg-green-100 text-green-800 border-green-200",
    unhealthy: "bg-rose-100 text-rose-800 border-rose-200",
    outline: "text-slate-600 border-slate-200",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium transition-colors border",
        variantStyles[variant] || variantStyles.default,
        className
      )}
      {...props}
    />
  );
}
