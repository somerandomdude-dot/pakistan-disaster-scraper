import { StructuredAdvisory } from "@/lib/api/schemas";

export default function RainfallForecastSection({
  forecast,
}: {
  forecast: StructuredAdvisory["rainfall_forecast"];
}) {
  const periods = [
    { label: "Next 24 hours", text: forecast.next_24_hours },
    { label: "Next 48 hours", text: forecast.next_48_hours },
  ].filter((period) => period.text);
  if (!periods.length) return null;
  return (
    <section aria-labelledby="rainfall-heading">
      <h2 id="rainfall-heading" className="section-heading">Rainfall forecast</h2>
      <div className="divide-y divide-slate-200 border border-slate-200 dark:border-slate-700">
        {periods.map((period) => (
          <div key={period.label} className="p-3">
            <h3 className="text-sm font-semibold text-text-primary">{period.label}</h3>
            <p className="mt-1 text-sm leading-6 text-text-secondary">{period.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
