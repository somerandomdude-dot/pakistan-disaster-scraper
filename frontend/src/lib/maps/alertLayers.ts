import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";

export const ALERT_SOURCE_ID = "alerts";
export const CLUSTERS_LAYER_ID = "alert-clusters";
export const CLUSTER_COUNT_LAYER_ID = "alert-cluster-count";
export const ALERT_POINTS_LAYER_ID = "alert-points";
export const SELECTED_ALERT_LAYER_ID = "selected-alert";

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

  if (!map.getLayer(CLUSTERS_LAYER_ID)) {
    map.addLayer({
      id: CLUSTERS_LAYER_ID,
      type: "circle",
      source: ALERT_SOURCE_ID,
      filter: ["has", "point_count"],
      paint: {
        "circle-color": [
          "step",
          ["get", "point_count"],
          "#1e3a8a",
          5,
          "#d97706",
          15,
          "#b91c1c",
        ],
        "circle-radius": ["step", ["get", "point_count"], 18, 5, 24, 15, 30],
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

  if (!map.getLayer(ALERT_POINTS_LAYER_ID)) {
    map.addLayer({
      id: ALERT_POINTS_LAYER_ID,
      type: "circle",
      source: ALERT_SOURCE_ID,
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-color": [
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
        ],
        "circle-radius": 8,
        "circle-stroke-width": 3,
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
