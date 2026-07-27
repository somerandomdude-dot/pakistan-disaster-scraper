import { Alert, StructuredAdvisory } from "@/lib/api/schemas";

export default function OfficialSourcePanel({
  alert,
  advisory,
}: {
  alert: Alert;
  advisory?: StructuredAdvisory | null;
}) {
  const url = advisory?.source.url || alert.source_url;
  const sourceName = advisory?.source.name || alert.source?.name;
  return (
    <section aria-labelledby="source-heading" className="border border-slate-200 bg-slate-50 p-4">
      <h2 id="source-heading" className="text-sm font-semibold text-slate-950">Official source information</h2>
      <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-3">
        {sourceName && <div><dt className="text-xs text-slate-500">Source</dt><dd>{sourceName}</dd></div>}
        {advisory?.source.department && <div><dt className="text-xs text-slate-500">Department</dt><dd>{advisory.source.department}</dd></div>}
        {advisory?.source.document_type && <div><dt className="text-xs text-slate-500">Document type</dt><dd>{advisory.source.document_type}</dd></div>}
      </dl>
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex w-full items-center justify-center border border-blue-900 bg-blue-900 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 sm:w-auto"
        >
          View Official Source
        </a>
      )}
      <p className="mt-2 text-xs text-slate-500">This dashboard is an unofficial presentation of public advisory information.</p>
    </section>
  );
}
