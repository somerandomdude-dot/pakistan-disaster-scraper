import type {
  ExpressionSpecification,
  GeoJSONSource,
  Map as MapLibreMap,
} from "maplibre-gl";
import type * as GeoJSON from "geojson";

export const ALERT_SOURCE_ID = "alerts";
export const CLUSTER_OUTER_PULSE_LAYER_ID = "alert-cluster-pulse-outer";
export const CLUSTER_INNER_PULSE_LAYER_ID = "alert-cluster-pulse-inner";
export const CLUSTERS_LAYER_ID = "alert-clusters";
export const CLUSTER_COUNT_LAYER_ID = "alert-cluster-count";
export const ALERT_OUTER_PULSE_LAYER_ID = "alert-point-pulse-outer";
export const ALERT_INNER_PULSE_LAYER_ID = "alert-point-pulse-inner";
export const ALERT_POINTS_LAYER_ID = "alert-points";
export const SELECTED_ALERT_LAYER_ID = "selected-alert";

const CLUSTER_COLOR: ExpressionSpecification = [
  "step",
  ["get", "point_count"],
  "#f97316",
  5,
  "#ea580c",
  15,
  "#b91c1c",
];

const ALERT_COLOR: ExpressionSpecification = [
  "match",
  ["downcase", ["coalesce", ["get", "severity"], "unknown"]],
  "critical",
  "#991b1b",
  "high",
  "#ea580c",
  "medium",
  "#d97706",
  "low",
  "#2563eb",
  "#64748b",
];

export function ensureAlertSourceAndLayers(
  map: MapLibreMap,
  data: GeoJSON.FeatureCollection<GeoJSON.Point>,
): void {
  if (!map.getSource(ALERT_SOURCE_ID)) {
    map.addSource(ALERT_SOURCE_ID, {
      type: "geojson",
      data,
      cluster: true,
      clusterRadius: 45,
      clusterMaxZoom: 10,
    });
  }

  if (!map.getLayer(CLUSTER_OUTER_PULSE_LAYER_ID)) {
    map.addLayer({
      id: CLUSTER_OUTER_PULSE_LAYER_ID,
      type: "circle",
      source: ALERT_SOURCE_ID,
      filter: ["has", "point_count"],
      paint: {
        "circle-color": CLUSTER_COLOR,
        "circle-radius": ["step", ["get", "point_count"], 25, 5, 32, 15, 39],
        "circle-opacity": 0.12,
        "circle-blur": 0.25,
      },
    });
  }

  if (!map.getLayer(CLUSTER_INNER_PULSE_LAYER_ID)) {
    map.addLayer({
      id: CLUSTER_INNER_PULSE_LAYER_ID,
      type: "circle",
      source: ALERT_SOURCE_ID,
      filter: ["has", "point_count"],
      paint: {
        "circle-color": CLUSTER_COLOR,
        "circle-radius": ["step", ["get", "point_count"], 17, 5, 22, 15, 28],
        "circle-opacity": 0.2,
        "circle-blur": 0.12,
      },
    });
  }

  if (!map.getLayer(CLUSTERS_LAYER_ID)) {
    map.addLayer({
      id: CLUSTERS_LAYER_ID,
      type: "circle",
      source: ALERT_SOURCE_ID,
      filter: ["has", "point_count"],
      paint: {
        "circle-color": CLUSTER_COLOR,
        "circle-radius": ["step", ["get", "point_count"], 10, 5, 12, 15, 15],
        "circle-stroke-width": 2,
        "circle-stroke-color": "#ffffff",
      },
    });
  }

  if (!map.getLayer(CLUSTER_COUNT_LAYER_ID)) {
    map.addLayer({
      id: CLUSTER_COUNT_LAYER_ID,
      type: "symbol",
      source: ALERT_SOURCE_ID,
      filter: ["has", "point_count"],
      layout: {
        "text-field": ["get", "point_count_abbreviated"],
        "text-font": ["Noto Sans Regular"],
        "text-size": 12,
      },
      paint: { "text-color": "#ffffff" },
    });
  }

  if (!map.getLayer(ALERT_OUTER_PULSE_LAYER_ID)) {
    map.addLayer({
      id: ALERT_OUTER_PULSE_LAYER_ID,
      type: "circle",
      source: ALERT_SOURCE_ID,
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-color": ALERT_COLOR,
        "circle-radius": 22,
        "circle-opacity": 0.12,
        "circle-blur": 0.25,
      },
    });
  }

  if (!map.getLayer(ALERT_INNER_PULSE_LAYER_ID)) {
    map.addLayer({
      id: ALERT_INNER_PULSE_LAYER_ID,
      type: "circle",
      source: ALERT_SOURCE_ID,
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-color": ALERT_COLOR,
        "circle-radius": 14,
        "circle-opacity": 0.2,
        "circle-blur": 0.12,
      },
    });
  }

  if (!map.getLayer(ALERT_POINTS_LAYER_ID)) {
    map.addLayer({
      id: ALERT_POINTS_LAYER_ID,
      type: "circle",
      source: ALERT_SOURCE_ID,
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-color": ALERT_COLOR,
        "circle-radius": 8,
        "circle-stroke-width": 2,
        "circle-stroke-color": "#ffffff",
      },
    });
  }

  if (!map.getLayer(SELECTED_ALERT_LAYER_ID)) {
    map.addLayer({
      id: SELECTED_ALERT_LAYER_ID,
      type: "circle",
      source: ALERT_SOURCE_ID,
      filter: ["==", ["get", "alert_id"], -1],
      paint: {
        "circle-color": "rgba(255,255,255,0)",
        "circle-radius": 14,
        "circle-stroke-width": 4,
        "circle-stroke-color": "#0f172a",
      },
    });
  }
}

export function setAlertPulsePhase(map: MapLibreMap, phase: number): void {
  const normalizedPhase = Math.max(0, Math.min(1, phase));
  const outerOpacity = 0.06 + (1 - normalizedPhase) * 0.12;
  const innerOpacity = 0.12 + normalizedPhase * 0.12;

  [CLUSTER_OUTER_PULSE_LAYER_ID, ALERT_OUTER_PULSE_LAYER_ID].forEach((layerId) => {
    if (map.getLayer(layerId)) {
      map.setPaintProperty(layerId, "circle-opacity", outerOpacity);
    }
  });
  [CLUSTER_INNER_PULSE_LAYER_ID, ALERT_INNER_PULSE_LAYER_ID].forEach((layerId) => {
    if (map.getLayer(layerId)) {
      map.setPaintProperty(layerId, "circle-opacity", innerOpacity);
    }
  });
}

export function setAlertData(
  map: MapLibreMap,
  data: GeoJSON.FeatureCollection<GeoJSON.Point>,
): boolean {
  const source = map.getSource(ALERT_SOURCE_ID) as GeoJSONSource | undefined;
  if (!source) return false;
  source.setData(data);
  return true;
}

export function selectAlertFeature(map: MapLibreMap, alertId: number | null): void {
  if (!map.getLayer(SELECTED_ALERT_LAYER_ID)) return;
  map.setFilter(
    SELECTED_ALERT_LAYER_ID,
    alertId === null
      ? ["==", ["get", "alert_id"], -1]
      : ["==", ["get", "alert_id"], alertId],
  );
}
