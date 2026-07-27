import { Alert, StructuredAdvisory } from "@/lib/api/schemas";
import { Badge } from "@/components/shared/Badge";

export default function AdvisoryHeader({
  alert,
  advisory,
}: {
  alert: Alert;
  advisory?: StructuredAdvisory | null;
}) {
  return (
    <header className="border-b border-slate-200 pb-5">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Badge variant={alert.normalized_severity as "critical" | "high" | "medium" | "low"}>
          {alert.normalized_severity.replaceAll("_", " ")}
        </Badge>
        <Badge variant="outline" className="capitalize">{alert.status}</Badge>
        {advisory?.advisory_type && (
          <span className="text-xs font-medium text-slate-500">{advisory.advisory_type}</span>
        )}
      </div>
      <h1 className="text-xl font-semibold leading-7 text-slate-950">
        {advisory?.title || alert.title}
      </h1>
      {advisory?.bulletin.number && (
        <p className="mt-1 text-sm text-slate-600">
          Bulletin {advisory.bulletin.number}
        </p>
      )}
    </header>
  );
}
