import L from "leaflet";

export const MIN_ZOOM = 5;
export const MAX_ZOOM = 15;
export const DEFAULT_ZOOM = 6;

export const PROVINCE_ZOOM = 7;
export const DISTRICT_ZOOM = 9;
export const CITY_ZOOM = 11;
export const ALERT_COORD_ZOOM = 12;

export const PAKISTAN_CENTER: [number, number] = [30.3753, 69.3451];

// Bounding box covering Pakistan and surrounding areas with padding
export const PAKISTAN_BOUNDS: L.LatLngBoundsExpression = [
  [23.5, 60.5], // South-West
  [37.5, 77.5], // North-East
];

/**
 * Clamps a requested zoom level between MIN_ZOOM (5) and MAX_ZOOM (15)
 */
export function clampZoom(requestedZoom: number): number {
  if (!Number.isFinite(requestedZoom)) return DEFAULT_ZOOM;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, requestedZoom));
}

/**
 * Determines target zoom level based on location classification
 */
export function getTargetZoomForType(type: "province" | "district" | "city" | "coord" | "default"): number {
  switch (type) {
    case "province":
      return clampZoom(PROVINCE_ZOOM);
    case "district":
      return clampZoom(DISTRICT_ZOOM);
    case "city":
      return clampZoom(CITY_ZOOM);
    case "coord":
      return clampZoom(ALERT_COORD_ZOOM);
    default:
      return clampZoom(DEFAULT_ZOOM);
  }
}

/**
 * Simple debouncer for map movement and event handling
 */
export function debounce<T extends (...args: any[]) => void>(func: T, wait: number): T {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return function (this: any, ...args: Parameters<T>) {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => {
      func.apply(this, args);
    }, wait);
  } as T;
}
