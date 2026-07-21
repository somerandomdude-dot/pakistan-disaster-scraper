import { cn } from "@/lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "critical" | "high" | "medium" | "low" | "healthy" | "unhealthy" | "outline";
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium transition-colors border",
        {
          "bg-slate-100 text-slate-800 border-transparent": variant === "default",
          "bg-red-100 text-red-800 border-red-200": variant === "critical",
          "bg-orange-100 text-orange-800 border-orange-200": variant === "high",
          "bg-amber-100 text-amber-800 border-amber-200": variant === "medium",
          "bg-blue-100 text-blue-800 border-blue-200": variant === "low",
          "bg-green-100 text-green-800 border-green-200": variant === "healthy",
          "bg-red-100 text-red-800 border-red-200": variant === "unhealthy",
          "text-slate-600 border-slate-200": variant === "outline",
        },
        className
      )}
      {...props}
    />
  );
}
