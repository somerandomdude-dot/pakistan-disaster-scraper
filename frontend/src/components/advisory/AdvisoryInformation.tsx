import { Alert } from "@/lib/api/schemas";
import AdvisoryHeader from "./AdvisoryHeader";
import AdvisorySummary from "./AdvisorySummary";
import RiverStatusTable from "./RiverStatusTable";
import RainfallForecastSection from "./RainfallForecastSection";
import HydrologicalSituation from "./HydrologicalSituation";
import WarningPanel from "./WarningPanel";
import AffectedLocationsSection from "./AffectedLocationsSection";
import BulletinMetadata from "./BulletinMetadata";
import OfficialSourcePanel from "./OfficialSourcePanel";
import RawTextDisclosure from "./RawTextDisclosure";
import MissingDataNotice from "./MissingDataNotice";

function fallbackSentences(description?: string | null) {
  if (!description) return [];
  return description
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 6);
}

export default function AdvisoryInformation({ alert }: { alert: Alert }) {
  const advisory = alert.structured_advisory;
  const fallback = fallbackSentences(alert.description);
  return (
    <article className="space-y-6">
      <AdvisoryHeader alert={alert} advisory={advisory} />
      <AdvisorySummary alert={alert} advisory={advisory} />
      {(!advisory || advisory.validation_status !== "structured") && (
        <MissingDataNotice sections={advisory?.missing_sections} />
      )}
      {!advisory && fallback.length > 0 && (
        <section aria-labelledby="available-summary-heading">
          <h2 id="available-summary-heading" className="section-heading">Available alert summary</h2>
          <ul className="space-y-2 text-sm leading-6 text-slate-700">
            {fallback.map((sentence, index) => <li key={`${sentence}-${index}`}>{sentence}</li>)}
          </ul>
        </section>
      )}
      {advisory && <RiverStatusTable rows={advisory.river_conditions} />}
      {advisory && <RainfallForecastSection forecast={advisory.rainfall_forecast} />}
      {advisory && <HydrologicalSituation items={advisory.hydrological_summary} />}
      {advisory && <WarningPanel warning={advisory.warning} />}
      <AffectedLocationsSection locations={alert.locations || []} />
      {advisory && <BulletinMetadata alert={alert} advisory={advisory} />}
      <OfficialSourcePanel alert={alert} advisory={advisory} />
      <RawTextDisclosure alertId={alert.id} rawText={alert.raw_text} />
    </article>
  );
}
