import { StructuredAdvisory } from "@/lib/api/schemas";

type Warning = NonNullable<StructuredAdvisory["warning"]>;

export default function WarningPanel({ warning }: { warning?: Warning | null }) {
  if (!warning) return null;
  const details = [
    { label: "Expected timing", values: warning.expected_timing },
    { label: "Rivers named", values: warning.rivers },
    { label: "Expected flood range", values: warning.expected_flood_ranges },
  ].filter((item) => item.values.length);
  return (
    <section aria-labelledby="warning-heading" className="border border-amber-300 bg-amber-50 p-4">
      <h2 id="warning-heading" className="text-xs font-bold uppercase tracking-wider text-amber-950">
        Warning and expected impact
      </h2>
      <p className="mt-2 text-sm leading-6 text-slate-900">{warning.text}</p>
      {details.length > 0 && (
        <dl className="mt-3 grid gap-2 border-t border-amber-200 pt-3 sm:grid-cols-3">
          {details.map((detail) => (
            <div key={detail.label}>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-amber-900">{detail.label}</dt>
              <dd className="mt-0.5 text-xs leading-5 text-slate-800">{detail.values.join(", ")}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
