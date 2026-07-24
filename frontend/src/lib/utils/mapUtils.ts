import { Alert } from "@/lib/api/schemas";

export const MIN_ZOOM = 5;
export const MAX_ZOOM = 12;
export const DEFAULT_ZOOM = 5.8;
export const CITY_ZOOM = 11;

// MapLibre uses [longitude, latitude] order!
export const PAKISTAN_CENTER: [number, number] = [69.3451, 30.3753];

// Pakistan geographic bounds in [longitude, latitude] format
export const PAKISTAN_BOUNDS: [[number, number], [number, number]] = [
  [60.5, 23.5], // South-West [lng, lat]
  [77.5, 37.5], // North-East [lng, lat]
];

/**
 * Clamps every programmatic zoom between 5 and 12
 */
export function clampZoom(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_ZOOM;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

/**
 * Returns target zoom level by location classification type
 */
export function getTargetZoomForType(type?: string): number {
  switch (type?.toLowerCase()) {
    case "province":
    case "territory":
      return clampZoom(7);
    case "division":
      return clampZoom(8);
    case "district":
      return clampZoom(9);
    case "tehsil":
      return clampZoom(10);
    case "city":
    case "town":
      return clampZoom(11);
    case "coord":
      return clampZoom(12);
    default:
      return clampZoom(10);
  }
}

/**
 * Converts backend Alerts into a GeoJSON FeatureCollection for MapLibre source
 */
export function alertsToGeoJSON(alerts: Alert[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  const features: GeoJSON.Feature<GeoJSON.Point>[] = [];
  const seenCoords = new Set<string>();

  (alerts || []).forEach((alert) => {
    (alert.locations || []).forEach((loc) => {
      if (
        loc.latitude && 
        loc.longitude && 
        Number.isFinite(loc.latitude) && 
        Number.isFinite(loc.longitude)
      ) {
        let lat = loc.latitude;
        let lng = loc.longitude;
        const coordKey = `${lng.toFixed(4)},${lat.toFixed(4)}`;

        // Slight jitter if multiple alerts share exact coordinates
        if (seenCoords.has(coordKey)) {
          lng += (Math.random() - 0.5) * 0.01;
          lat += (Math.random() - 0.5) * 0.01;
        }
        seenCoords.add(coordKey);

        features.push({
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [lng, lat], // MapLibre: [longitude, latitude]
          },
          properties: {
            alert_id: alert.id,
            title: alert.title,
            description: alert.description || "Not provided by source.",
            hazard_type: alert.hazard_type,
            severity: alert.normalized_severity,
            location_name: loc.city || loc.district || loc.province || loc.raw_location || "Advisory Location",
            source_url: alert.source_url || "",
          },
        });
      }
    });
  });

  return {
    type: "FeatureCollection",
    features,
  };
}

/**
 * Helper to check WebGL support safely on client environment
 */
export function isWebGLSupported(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const canvas = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
    );
  } catch (e) {
    return false;
  }
}
