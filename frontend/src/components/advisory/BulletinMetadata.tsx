import { Alert, StructuredAdvisory } from "@/lib/api/schemas";
import { formatDate } from "@/lib/utils";

export default function BulletinMetadata({
  alert,
  advisory,
}: {
  alert: Alert;
  advisory: StructuredAdvisory;
}) {
  const bulletin = advisory.bulletin;
  const items = [
    ["Bulletin number", bulletin.number],
    ["Date", bulletin.issue_date],
    ["Time", bulletin.issue_time],
    ["Page", bulletin.page],
    ["Issued by", bulletin.issuing_department],
    ["Department", bulletin.department],
    ["Division", bulletin.division],
    ["Office address", bulletin.office_address],
    ["Email", bulletin.email],
    ["Telephone", bulletin.telephone],
    ["Retrieved", alert.created_at ? formatDate(alert.created_at) : null],
    ["Parser", advisory.parser_name],
    ["Validation", advisory.validation_status],
  ].filter((item): item is [string, string] => Boolean(item[1]));
  if (!items.length) return null;
  return (
    <section aria-labelledby="metadata-heading">
      <h2 id="metadata-heading" className="section-heading">Bulletin metadata</h2>
      <dl className="grid border border-slate-200 dark:border-slate-700 sm:grid-cols-2">
        {items.map(([label, value]) => (
          <div key={label} className="border-b border-slate-200 dark:border-slate-700 px-3 py-2 sm:border-r">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">{label}</dt>
            <dd className="mt-0.5 break-words text-sm text-text-primary">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
