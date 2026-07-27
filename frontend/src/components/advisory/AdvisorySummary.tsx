import { Alert, StructuredAdvisory } from "@/lib/api/schemas";
import { formatDate } from "@/lib/utils";
import FloodLevelBadge from "./FloodLevelBadge";

export default function AdvisorySummary({
  alert,
  advisory,
}: {
  alert: Alert;
  advisory?: StructuredAdvisory | null;
}) {
  const sourceIssued = [
    advisory?.bulletin.issue_date,
    advisory?.bulletin.issue_time,
  ].filter(Boolean).join(", ");
  const facts = [
    { label: "Issued", value: sourceIssued || formatDate(alert.issued_at) },
    { label: "Source", value: advisory?.source.name || alert.source?.name },
    { label: "Status", value: alert.status },
    {
      label: "Validity",
      value: alert.expires_at ? `${formatDate(alert.starts_at || alert.issued_at)} – ${formatDate(alert.expires_at)}` : null,
    },
    { label: "Last retrieved", value: alert.created_at ? formatDate(alert.created_at) : null },
  ].filter((fact) => fact.value);

  return (
    <section aria-labelledby="advisory-summary-heading">
      <h2 id="advisory-summary-heading" className="section-heading">Current alert summary</h2>
      <dl className="grid grid-cols-1 border border-slate-200 bg-slate-50 sm:grid-cols-2 lg:grid-cols-3">
        {facts.map((fact) => (
          <div key={fact.label} className="border-b border-slate-200 px-3 py-2.5 sm:border-r">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {fact.label}
            </dt>
            <dd className="mt-0.5 text-sm font-medium text-slate-900">{fact.value}</dd>
          </div>
        ))}
        {advisory?.highest_reported_level && (
          <div className="border-b border-slate-200 px-3 py-2.5">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Highest reported level
            </dt>
            <dd className="mt-1">
              <FloodLevelBadge level={advisory.highest_reported_level} />
            </dd>
          </div>
        )}
      </dl>
    </section>
  );
}
