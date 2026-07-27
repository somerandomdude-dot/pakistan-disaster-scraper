"use client";

import { useMemo } from "react";
import { AlertLocation } from "@/lib/api/schemas";

const groupOrder = [
  "PROVINCE", "TERRITORY", "DISTRICT", "TEHSIL", "CITY", "TOWN",
  "VILLAGE", "LOCALITY", "REGION", "RIVER", "DAM", "BARRAGE", "COASTAL_AREA",
];

function evidenceLabel(location: AlertLocation) {
  if (location.match_method === "HIERARCHY_INFERRED") return "Resolved through location hierarchy";
  if (location.text_source === "STRUCTURED_FIELD") return "Source-provided";
  return "Inferred from advisory text";
}

export default function AffectedLocationsSection({ locations }: { locations: AlertLocation[] }) {
  const groups = useMemo(() => {
    const result = new Map<string, AlertLocation[]>();
    const seen = new Set<string>();
    for (const location of locations) {
      const type = location.entity_type || "UNKNOWN";
      const name = location.canonical_name || location.raw_location;
      if (!name) continue;
      const key = `${type}:${name}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      result.set(type, [...(result.get(type) || []), location]);
    }
    return [...result.entries()].sort(([a], [b]) => {
      const left = groupOrder.indexOf(a);
      const right = groupOrder.indexOf(b);
      return (left < 0 ? 99 : left) - (right < 0 ? 99 : right);
    });
  }, [locations]);

  if (!groups.length) return null;
  return (
    <section aria-labelledby="locations-heading">
      <h2 id="locations-heading" className="section-heading">Affected locations</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {groups.map(([type, items]) => (
          <div key={type} className="border-t border-slate-300 pt-2">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-600">
              {type.replaceAll("_", " ")}
            </h3>
            <ul className="mt-2 space-y-2">
              {items.slice(0, 8).map((location, index) => {
                const name = location.canonical_name || location.raw_location;
                const hasVerifiedCoordinates =
                  Boolean(location.location_id) &&
                  location.latitude != null &&
                  location.longitude != null;
                return (
                  <li key={`${name}-${index}`} className="text-sm text-slate-900">
                    <span className="font-medium">{name}</span>
                    <span className="block text-[11px] text-slate-500">{evidenceLabel(location)}</span>
                    {hasVerifiedCoordinates && (
                      <span className="block font-mono text-[10px] text-slate-500">
                        {location.latitude?.toFixed(4)}, {location.longitude?.toFixed(4)}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
            {items.length > 8 && (
              <details className="mt-2 text-xs">
                <summary className="cursor-pointer font-semibold text-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
                  Show {items.length - 8} more
                </summary>
                <ul className="mt-2 space-y-1 text-slate-700">
                  {items.slice(8).map((location, index) => (
                    <li key={`${location.location_id || location.raw_location}-${index}`}>
                      {location.canonical_name || location.raw_location}
                      <span className="text-slate-500"> — {evidenceLabel(location)}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
