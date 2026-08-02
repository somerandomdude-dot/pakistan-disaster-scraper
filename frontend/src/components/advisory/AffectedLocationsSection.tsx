"use client";

import { useMemo } from "react";
import { AlertLocation, PrimaryLocation } from "@/lib/api/schemas";
import { MapPin, Navigation, CheckCircle2, AlertCircle, Sparkles, HelpCircle } from "lucide-react";

const groupOrder = [
  "PROVINCE", "TERRITORY", "DISTRICT", "TEHSIL", "CITY", "TOWN",
  "VILLAGE", "LOCALITY", "REGION", "RIVER", "DAM", "BARRAGE", "COASTAL_AREA",
];

function evidenceLabel(location: AlertLocation) {
  if (location.match_method === "HIERARCHY_INFERRED") return "Resolved through location hierarchy";
  if (location.text_source === "STRUCTURED_FIELD" || location.text_source === "STRUCTURED_SCRAPER_FIELD") return "Source-provided";
  return "Inferred from advisory text";
}

interface AffectedLocationsSectionProps {
  locations: AlertLocation[];
  primaryLocation?: PrimaryLocation | null;
  resolvedDistrict?: string | null;
  resolvedCity?: string | null;
  resolvedProvince?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  resolutionSource?: string | null;
  resolutionConfidence?: string | null;
  isInferred?: boolean | null;
}

export default function AffectedLocationsSection({
  locations,
  primaryLocation,
  resolvedDistrict,
  resolvedCity,
  resolvedProvince,
  latitude,
  longitude,
  resolutionSource,
  resolutionConfidence,
  isInferred,
}: AffectedLocationsSectionProps) {
  // Derive active primary location values with robust fallbacks
  const district = primaryLocation?.district || resolvedDistrict;
  const city = primaryLocation?.city || resolvedCity;
  const province = primaryLocation?.province || resolvedProvince;
  const lat = primaryLocation?.latitude ?? latitude;
  const lng = primaryLocation?.longitude ?? longitude;
  const source = primaryLocation?.source || resolutionSource || (district ? "INFERRED" : "UNRESOLVED");
  const isDirectSource = primaryLocation ? !primaryLocation.is_inferred : isInferred === false;
  const badgeLabel = primaryLocation?.label || (isDirectSource ? "Source-provided" : (district ? "Inferred from advisory text" : "Unresolved location"));

  const hasCoordinates = lat != null && lng != null;
  const isUnresolved = !district && !city && !hasCoordinates;

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

  return (
    <section aria-labelledby="locations-heading" className="space-y-4">
      <h2 id="locations-heading" className="section-heading">Affected location details</h2>

      {/* Primary Location Card */}
      <div className={`p-4 rounded-lg border ${
        isUnresolved
          ? "bg-slate-50 dark:bg-slate-900/50 border-slate-300 dark:border-slate-700"
          : isDirectSource
          ? "bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700/60"
          : "bg-blue-50/60 dark:bg-blue-950/30 border-blue-300 dark:border-blue-700/60"
      }`}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3 border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <MapPin className={`h-5 w-5 ${
              isUnresolved ? "text-slate-500" : isDirectSource ? "text-emerald-600 dark:text-emerald-400" : "text-blue-600 dark:text-blue-400"
            }`} />
            <span className="text-sm font-bold text-text-primary">
              {isUnresolved
                ? "Location Unresolved"
                : city && district && city.toLowerCase() !== district.toLowerCase()
                ? `${city}, ${district} District`
                : district
                ? `${district} District`
                : city || "Identified Location"}
            </span>
          </div>

          {/* Clarity indicator badge */}
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
            isUnresolved
              ? "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
              : isDirectSource
              ? "bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700"
              : "bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-700"
          }`}>
            {isDirectSource ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : isUnresolved ? (
              <HelpCircle className="h-3.5 w-3.5" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            {badgeLabel}
          </span>
        </div>

        {/* Structured metadata grid */}
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="text-text-secondary block text-[11px] font-medium">District</span>
            <span className="font-semibold text-text-primary">{district || "—"}</span>
          </div>
          <div>
            <span className="text-text-secondary block text-[11px] font-medium">City / Locality</span>
            <span className="font-semibold text-text-primary">{city || (district ? "(District top city)" : "—")}</span>
          </div>
          <div>
            <span className="text-text-secondary block text-[11px] font-medium">Province</span>
            <span className="font-semibold text-text-primary">{province || "—"}</span>
          </div>
          <div>
            <span className="text-text-secondary block text-[11px] font-medium">Coordinates</span>
            <span className="font-mono text-text-primary font-medium">
              {hasCoordinates ? `${lat?.toFixed(4)}°, ${lng?.toFixed(4)}°` : "Not verified"}
            </span>
          </div>
        </div>

        <div className="mt-3 pt-2 border-t border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between text-[11px] text-text-secondary">
          <span>
            {isDirectSource
              ? "Extracted directly from official scraper structure."
              : isUnresolved
              ? "Advisory cannot be reliably linked to a genuine Pakistan district or coordinates."
              : `Resolved deterministically from text via ${primaryLocation?.method || source}.`}
          </span>
          {primaryLocation?.confidence && (
            <span className="uppercase font-semibold tracking-wider text-[10px]">
              Confidence: {primaryLocation.confidence}
            </span>
          )}
        </div>
      </div>

      {/* Breakdown of all extracted / matched locations */}
      {groups.length > 0 && (
        <div className="mt-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary mb-3">
            All mentioned locations in advisory
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {groups.map(([type, items]) => (
              <div key={type} className="border-t border-slate-300 dark:border-slate-600 pt-2">
                <h4 className="text-xs font-bold uppercase tracking-wide text-text-secondary">
                  {type.replaceAll("_", " ")}
                </h4>
                <ul className="mt-2 space-y-2">
                  {items.slice(0, 8).map((location, index) => {
                    const name = location.canonical_name || location.raw_location;
                    const hasVerifiedCoordinates =
                      Boolean(location.location_id) &&
                      location.latitude != null &&
                      location.longitude != null;
                    return (
                      <li key={`${name}-${index}`} className="text-sm text-text-primary">
                        <span className="font-medium">{name}</span>
                        <span className="block text-[11px] text-text-secondary">{evidenceLabel(location)}</span>
                        {hasVerifiedCoordinates && (
                          <span className="block font-mono text-[10px] text-text-secondary">
                            {location.latitude?.toFixed(4)}°, {location.longitude?.toFixed(4)}°
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
                {items.length > 8 && (
                  <details className="mt-2 text-xs">
                    <summary className="cursor-pointer font-semibold text-blue-800 dark:text-blue-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
                      Show {items.length - 8} more
                    </summary>
                    <ul className="mt-2 space-y-1 text-text-secondary">
                      {items.slice(8).map((location, index) => (
                        <li key={`${location.location_id || location.raw_location}-${index}`}>
                          {location.canonical_name || location.raw_location}
                          <span className="text-text-secondary"> — {evidenceLabel(location)}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
