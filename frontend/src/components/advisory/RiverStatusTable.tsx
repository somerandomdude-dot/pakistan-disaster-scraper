import { RiverCondition } from "@/lib/api/schemas";
import FloodLevelBadge from "./FloodLevelBadge";

function FlowReading({ row }: { row: RiverCondition }) {
  if (row.current_inflow == null || row.current_outflow == null) {
    return <span className="text-slate-400">Not provided</span>;
  }
  return (
    <span className="font-mono text-xs text-text-secondary">
      {row.current_inflow} / {row.current_outflow}
    </span>
  );
}

function StationCell({ row }: { row: RiverCondition }) {
  return (
    <>
      <span>{row.station || "River-wide summary"}</span>
      {row.notes && (
        <span className="mt-1 block max-w-xs text-[11px] leading-4 text-text-secondary">
          {row.notes}
        </span>
      )}
    </>
  );
}

function DesktopTable({
  rows,
  includeCurrent,
}: {
  rows: RiverCondition[];
  includeCurrent: boolean;
}) {
  return (
    <div className="hidden overflow-x-auto border border-slate-200 dark:border-slate-700 sm:block">
      <table className="w-full min-w-[700px] text-left text-sm">
        <thead className="border-b border-slate-200 dark:border-slate-700 bg-background text-[11px] uppercase tracking-wide text-text-secondary">
          <tr>
            <th scope="col" className="w-[13%] px-3 py-2">River</th>
            <th scope="col" className="w-[23%] px-3 py-2">Station</th>
            {includeCurrent && <th scope="col" className="w-[15%] px-3 py-2">Current level</th>}
            <th scope="col" className="w-[16%] px-3 py-2">24-hour forecast</th>
            <th scope="col" className="w-[16%] px-3 py-2">Expected trend</th>
            <th scope="col" className="px-3 py-2">Inflow / outflow</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {rows.map((row, index) => (
            <tr
              key={`${row.river}-${row.station || index}`}
              className="align-top odd:bg-panel even:bg-background/50"
            >
              <th scope="row" className="px-3 py-3 font-semibold text-text-primary">{row.river}</th>
              <td className="px-3 py-3 text-text-secondary"><StationCell row={row} /></td>
              {includeCurrent && <td className="px-3 py-3"><FloodLevelBadge level={row.level} /></td>}
              <td className="px-3 py-3"><FloodLevelBadge level={row.forecast_level} /></td>
              <td className="px-3 py-3 text-text-secondary">{row.trend || "Not provided"}</td>
              <td className="px-3 py-3"><FlowReading row={row} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MobileCards({
  rows,
  includeCurrent,
  testId,
}: {
  rows: RiverCondition[];
  includeCurrent: boolean;
  testId?: string;
}) {
  return (
    <div className="space-y-2 sm:hidden" data-testid={testId}>
      {rows.map((row, index) => (
        <article key={`${row.river}-${row.station || index}`} className="border border-slate-200 dark:border-slate-700 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-text-primary">{row.river}</h3>
              <p className="text-sm text-text-secondary">{row.station || "River-wide summary"}</p>
            </div>
            {includeCurrent && <FloodLevelBadge level={row.level} />}
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-slate-100 dark:border-slate-800 pt-2 text-xs">
            {row.forecast_level && (
              <div>
                <dt className="text-text-secondary">24-hour forecast</dt>
                <dd className="mt-1"><FloodLevelBadge level={row.forecast_level} /></dd>
              </div>
            )}
            {row.trend && (
              <div>
                <dt className="text-text-secondary">Expected trend</dt>
                <dd className="mt-1 font-medium text-text-primary">{row.trend}</dd>
              </div>
            )}
            {row.current_inflow != null && row.current_outflow != null && (
              <div className="col-span-2">
                <dt className="text-text-secondary">Inflow / outflow</dt>
                <dd className="mt-1"><FlowReading row={row} /></dd>
              </div>
            )}
          </dl>
          {row.notes && <p className="mt-2 text-xs leading-5 text-text-secondary">{row.notes}</p>}
        </article>
      ))}
    </div>
  );
}

export default function RiverStatusTable({ rows }: { rows: RiverCondition[] }) {
  if (!rows.length) return null;
  const currentRows = rows.filter((row) => Boolean(row.level));
  const forecastOnlyRows = rows.filter((row) => !row.level && Boolean(row.forecast_level));

  return (
    <section aria-labelledby="river-status-heading">
      <div className="mb-2 border-b border-slate-200 dark:border-slate-700 pb-2">
        <h2 id="river-status-heading" className="text-sm font-bold text-slate-950">
          Affected rivers and flood levels
        </h2>
        <p className="mt-0.5 text-xs text-text-secondary">
          Current observations are shown first. Additional station forecasts are available below.
        </p>
      </div>

      <DesktopTable rows={currentRows} includeCurrent />
      <MobileCards rows={currentRows} includeCurrent testId="river-status-mobile" />

      {forecastOnlyRows.length > 0 && (
        <details className="mt-3 border border-slate-200 dark:border-slate-700 bg-background">
          <summary className="cursor-pointer px-3 py-2.5 text-sm font-semibold text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
            Additional 24-hour station forecasts ({forecastOnlyRows.length})
          </summary>
          <div className="border-t border-slate-200 dark:border-slate-700 bg-panel p-3">
            <DesktopTable rows={forecastOnlyRows} includeCurrent={false} />
            <MobileCards rows={forecastOnlyRows} includeCurrent={false} />
          </div>
        </details>
      )}

      {rows.some((row) => row.current_inflow != null) && (
        <p className="mt-2 text-[11px] text-text-secondary">
          Inflow and outflow figures are reported in thousands of cusecs.
        </p>
      )}
    </section>
  );
}
