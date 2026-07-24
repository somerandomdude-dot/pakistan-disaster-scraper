"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import { AlertCircle, Maximize2, Minimize2, RotateCcw } from "lucide-react";
import type { Alert } from "@/lib/api/schemas";
import {
  alertsToGeoJSON,
  clampZoom,
  DEFAULT_ZOOM,
  isValidPakistanCoordinate,
  isWebGLSupported,
  MAX_ZOOM,
  MIN_ZOOM,
  PAKISTAN_BOUNDS,
  PAKISTAN_CENTER,
} from "@/lib/utils/mapUtils";
import {
  ALERT_POINTS_LAYER_ID,
  ALERT_SOURCE_ID,
  CLUSTERS_LAYER_ID,
  ensureAlertSourceAndLayers,
  selectAlertFeature,
  setAlertData,
} from "@/lib/maps/alertLayers";
import {
  classifyMapLibreError,
  MAP_WORKER_SHARED_URL,
  MAP_WORKER_URL,
  MapConfigurationError,
  OFFLINE_MAP_STYLE,
  type MapErrorCode,
  redactMapStyleUrl,
  resolveMapStyleUrl,
  validateMapStyleWithRetry,
  validateWorkerAsset,
} from "@/lib/maps/mapConfig";

interface MapComponentProps {
  alerts: Alert[];
  selectedCityCoords?: { lat: number; lng: number } | null;
  selectedCityZoom?: number;
  onSelectAlert?: (alert: Alert) => void;
}

interface DiagnosticState {
  initialized: boolean;
  webglAvailable: boolean | null;
  styleLoaded: boolean;
  zoom: number;
  center: [number, number];
  styleUrl: string;
  tileSourceState: "pending" | "ready" | "degraded";
  alertSourceLoaded: boolean;
  alertFeatureCount: number;
  lastMapError: string;
  pmtilesRegistered: false;
}

interface VisibleMapError {
  code: MapErrorCode;
  message: string;
  fatal: boolean;
}

const SHOW_DIAGNOSTICS = process.env.NEXT_PUBLIC_MAP_DIAGNOSTICS === "true";

function createTextElement(tag: keyof HTMLElementTagNameMap, text: string, className: string): HTMLElement {
  const element = document.createElement(tag);
  element.textContent = text;
  element.className = className;
  return element;
}

function buildAlertPopup(
  properties: Record<string, unknown>,
  onViewDetails: (() => void) | null,
): HTMLDivElement {
  const wrapper = document.createElement("div");
  wrapper.className = "map-alert-popup";

  wrapper.appendChild(
    createTextElement("strong", String(properties.title || "Disaster advisory"), "map-alert-popup__title"),
  );
  wrapper.appendChild(
    createTextElement(
      "p",
      String(properties.description || "No description provided by the source."),
      "map-alert-popup__description",
    ),
  );

  const meta = document.createElement("div");
  meta.className = "map-alert-popup__meta";
  meta.appendChild(
    createTextElement("span", String(properties.severity || "unknown").toUpperCase(), "map-alert-popup__severity"),
  );
  meta.appendChild(
    createTextElement("span", String(properties.location_name || "Pakistan"), "map-alert-popup__location"),
  );
  wrapper.appendChild(meta);

  if (onViewDetails) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "map-alert-popup__button";
    button.textContent = "View Full Advisory Details";
    button.addEventListener("click", onViewDetails);
    wrapper.appendChild(button);
  }

  return wrapper;
}

export default function MapComponent({
  alerts,
  selectedCityCoords,
  selectedCityZoom,
  onSelectAlert,
}: MapComponentProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const latestAlertsRef = useRef(alerts || []);
  const latestSelectAlertRef = useRef(onSelectAlert);
  const latestGeoJsonRef = useRef(alertsToGeoJSON(alerts || []));
  const lastFlyCoordsRef = useRef<string | null>(null);
  const interactionsBoundRef = useRef(false);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [offlineBasemapActive, setOfflineBasemapActive] = useState(false);
  const [mapError, setMapError] = useState<VisibleMapError | null>(null);
  const [diagnostics, setDiagnostics] = useState<DiagnosticState>({
    initialized: false,
    webglAvailable: null,
    styleLoaded: false,
    zoom: DEFAULT_ZOOM,
    center: PAKISTAN_CENTER,
    styleUrl: "",
    tileSourceState: "pending",
    alertSourceLoaded: false,
    alertFeatureCount: latestGeoJsonRef.current.features.length,
    lastMapError: "",
    pmtilesRegistered: false,
  });

  const geojsonData = useMemo(() => alertsToGeoJSON(alerts || []), [alerts]);
  latestAlertsRef.current = alerts || [];
  latestSelectAlertRef.current = onSelectAlert;
  latestGeoJsonRef.current = geojsonData;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;
    let map: maplibregl.Map | null = null;

    const updateCameraDiagnostics = () => {
      if (!map) return;
      const center = map.getCenter();
      const nextCenter: [number, number] = [
        Number(center.lng.toFixed(4)),
        Number(center.lat.toFixed(4)),
      ];
      setDiagnostics((current) => ({
        ...current,
        zoom: Number(map!.getZoom().toFixed(2)),
        center: nextCenter,
      }));
    };

    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === rootRef.current);
      requestAnimationFrame(() => map?.resize());
    };

    const bindLayerInteractions = () => {
      if (!map || interactionsBoundRef.current) return;
      interactionsBoundRef.current = true;

      map.on("mouseenter", CLUSTERS_LAYER_ID, () => {
        if (map) map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", CLUSTERS_LAYER_ID, () => {
        if (map) map.getCanvas().style.cursor = "";
      });
      map.on("mouseenter", ALERT_POINTS_LAYER_ID, () => {
        if (map) map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", ALERT_POINTS_LAYER_ID, () => {
        if (map) map.getCanvas().style.cursor = "";
      });

      map.on("click", CLUSTERS_LAYER_ID, async (event) => {
        if (!map) return;
        const feature = map.queryRenderedFeatures(event.point, { layers: [CLUSTERS_LAYER_ID] })[0];
        const clusterId = feature?.properties?.cluster_id;
        const source = map.getSource(ALERT_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
        if (!source || clusterId === undefined || feature.geometry.type !== "Point") return;

        try {
          const expansionZoom = await source.getClusterExpansionZoom(clusterId);
          map.easeTo({
            center: feature.geometry.coordinates as [number, number],
            zoom: clampZoom(expansionZoom),
            duration: 500,
          });
        } catch (error) {
          console.error("MapLibre cluster expansion error", error);
        }
      });

      map.on("click", ALERT_POINTS_LAYER_ID, (event) => {
        if (!map) return;
        const feature = event.features?.[0];
        if (!feature || feature.geometry.type !== "Point") return;

        const properties = (feature.properties || {}) as Record<string, unknown>;
        const alertId = Number(properties.alert_id);
        const matchedAlert = latestAlertsRef.current.find((alert) => alert.id === alertId);
        selectAlertFeature(map, Number.isFinite(alertId) ? alertId : null);
        popupRef.current?.remove();

        const popupContent = buildAlertPopup(
          properties,
          matchedAlert && latestSelectAlertRef.current
            ? () => latestSelectAlertRef.current?.(matchedAlert)
            : null,
        );
        popupRef.current = new maplibregl.Popup({ closeButton: true, offset: 12 })
          .setLngLat(feature.geometry.coordinates as [number, number])
          .setDOMContent(popupContent)
          .addTo(map);
      });
    };

    const restoreRequiredLayers = () => {
      if (!map) return;
      try {
        ensureAlertSourceAndLayers(map, latestGeoJsonRef.current);
        bindLayerInteractions();
        setDiagnostics((current) => ({
          ...current,
          alertSourceLoaded: Boolean(map?.getSource(ALERT_SOURCE_ID)),
          alertFeatureCount: latestGeoJsonRef.current.features.length,
        }));
      } catch (error) {
        const code = classifyMapLibreError(error);
        const message = error instanceof Error ? error.message : String(error);
        console.error("MapLibre alert layer error", error);
        setMapError({ code, message: "Some alert map layers could not be loaded.", fatal: false });
        setDiagnostics((current) => ({ ...current, lastMapError: `${code}: ${message}` }));
      }
    };

    const initializeMap = async () => {
      const webglAvailable = isWebGLSupported();
      setDiagnostics((current) => ({ ...current, webglAvailable }));
      if (!webglAvailable) {
        setMapError({
          code: "WEBGL_UNAVAILABLE",
          message: "Interactive map acceleration is unavailable on this device.",
          fatal: true,
        });
        return;
      }

      let styleUrl: string;
      let usingOfflineStyle = false;
      try {
        styleUrl = resolveMapStyleUrl();
        setDiagnostics((current) => ({
          ...current,
          styleUrl: redactMapStyleUrl(styleUrl),
        }));
        await Promise.all([
          validateWorkerAsset(MAP_WORKER_URL),
          validateWorkerAsset(MAP_WORKER_SHARED_URL),
        ]);
        let style;
        try {
          style = await validateMapStyleWithRetry(styleUrl);
        } catch (styleError) {
          usingOfflineStyle = true;
          setOfflineBasemapActive(true);
          style = OFFLINE_MAP_STYLE;
          const code = classifyMapLibreError(styleError);
          setMapError({
            code,
            message: "Offline basemap active — live map tiles are currently unavailable.",
            fatal: false,
          });
          setDiagnostics((current) => ({
            ...current,
            tileSourceState: "degraded",
            lastMapError: `${code}: external basemap unavailable`,
          }));
        }
        if (cancelled || !containerRef.current) return;

        maplibregl.setWorkerUrl(MAP_WORKER_URL);
        map = new maplibregl.Map({
          container: containerRef.current,
          style,
          center: PAKISTAN_CENTER,
          zoom: DEFAULT_ZOOM,
          minZoom: MIN_ZOOM,
          maxZoom: MAX_ZOOM,
          maxBounds: PAKISTAN_BOUNDS,
          attributionControl: { compact: true },
        });
        mapRef.current = map;
        setDiagnostics((current) => ({ ...current, initialized: true }));

        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");

        map.on("error", (event) => {
          const error = event.error;
          const code = classifyMapLibreError(error);
          const detail = error instanceof Error ? error.message : String(error);
          console.error("MapLibre error", error);
          setMapError({
            code,
            message:
              code === "TILE_SOURCE_FAILED"
                ? "Vector tiles are temporarily unavailable."
                : "Some map layers failed to load.",
            fatal: false,
          });
          setDiagnostics((current) => ({
            ...current,
            tileSourceState: "degraded",
            lastMapError: `${code}: ${detail}`,
          }));
        });

        map.on("style.load", restoreRequiredLayers);
        map.on("load", () => {
          restoreRequiredLayers();
          map?.resize();
          setMapError((current) => (usingOfflineStyle || current?.fatal ? current : null));
          setDiagnostics((current) => ({
            ...current,
            styleLoaded: true,
            tileSourceState: usingOfflineStyle ? "degraded" : "ready",
          }));
        });
        map.on("moveend", updateCameraDiagnostics);
        map.on("zoomend", updateCameraDiagnostics);

        if (typeof ResizeObserver !== "undefined") {
          resizeObserver = new ResizeObserver(() => map?.resize());
          resizeObserver.observe(containerRef.current);
        } else {
          window.addEventListener("resize", map.resize);
        }
        document.addEventListener("fullscreenchange", handleFullscreenChange);
      } catch (error) {
        if (cancelled) return;
        const configurationError =
          error instanceof MapConfigurationError
            ? error
            : new MapConfigurationError(
                classifyMapLibreError(error),
                error instanceof Error ? error.message : String(error),
              );
        console.error("MapLibre initialization error", configurationError);
        setMapError({
          code: configurationError.code,
          message:
            configurationError.code === "WORKER_SOURCE_FAILED"
              ? "The interactive map worker could not be loaded."
              : "The map style could not be loaded.",
          fatal: true,
        });
        setDiagnostics((current) => ({
          ...current,
          lastMapError: `${configurationError.code}: ${configurationError.message}`,
        }));
      }
    };

    void initializeMap();

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      if (map && typeof ResizeObserver === "undefined") {
        window.removeEventListener("resize", map.resize);
      }
      popupRef.current?.remove();
      popupRef.current = null;
      map?.remove();
      mapRef.current = null;
      interactionsBoundRef.current = false;
    };
  }, []);

  useEffect(() => {
    setDiagnostics((current) => ({
      ...current,
      alertFeatureCount: geojsonData.features.length,
    }));
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    if (!setAlertData(map, geojsonData)) {
      ensureAlertSourceAndLayers(map, geojsonData);
    }
  }, [geojsonData]);

  useEffect(() => {
    const map = mapRef.current;
    if (
      !map ||
      !diagnostics.styleLoaded ||
      !selectedCityCoords ||
      !isValidPakistanCoordinate(selectedCityCoords.lat, selectedCityCoords.lng)
    ) {
      return;
    }

    const zoom = clampZoom(selectedCityZoom ?? 11);
    const coordinateKey = `${selectedCityCoords.lng.toFixed(4)},${selectedCityCoords.lat.toFixed(4)},${zoom}`;
    if (lastFlyCoordsRef.current === coordinateKey) return;
    lastFlyCoordsRef.current = coordinateKey;

    map.flyTo({
      center: [selectedCityCoords.lng, selectedCityCoords.lat],
      zoom,
      speed: 2,
      curve: 1.2,
      essential: true,
    });
  }, [selectedCityCoords, selectedCityZoom, diagnostics.styleLoaded]);

  const handleResetView = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    map.stop();
    popupRef.current?.remove();
    selectAlertFeature(map, null);
    lastFlyCoordsRef.current = null;
    map.jumpTo({ center: PAKISTAN_CENTER, zoom: DEFAULT_ZOOM });
  }, []);

  const handleFullscreen = useCallback(async () => {
    if (!rootRef.current) return;
    try {
      if (document.fullscreenElement === rootRef.current) {
        await document.exitFullscreen();
      } else {
        await rootRef.current.requestFullscreen();
      }
    } catch (error) {
      console.error("Map fullscreen error", error);
      setMapError({
        code: "MAP_INITIALIZATION_FAILED",
        message: "Fullscreen mode is unavailable in this browser.",
        fatal: false,
      });
    } finally {
      requestAnimationFrame(() => mapRef.current?.resize());
    }
  }, []);

  return (
    <div
      ref={rootRef}
      className="map-shell"
      data-map-initialized={diagnostics.initialized}
      data-map-style-loaded={diagnostics.styleLoaded}
      data-map-alert-source-loaded={diagnostics.alertSourceLoaded}
      data-map-feature-count={diagnostics.alertFeatureCount}
      data-map-zoom={diagnostics.zoom}
      data-map-center={`${diagnostics.center[0]},${diagnostics.center[1]}`}
    >
      <div ref={containerRef} className="map-container" aria-label="Interactive disaster alert map" />
      {offlineBasemapActive && (
        <div className="offline-basemap" aria-hidden="true">
          <svg viewBox="60 23 18 15" role="presentation">
            <g className="offline-basemap__regions">
              <polygon points="61,25 67,24.8 70.3,28.4 69.7,31.6 66,32.1 61,29.5" />
              <polygon points="66.7,24 71.1,24.4 70.3,28.4 68,28.2 66.7,25" />
              <polygon points="70.3,28.4 74.7,28.4 75,32.5 71.4,33.1 69.7,31.6" />
              <polygon points="69.7,31.6 71.4,33.1 73.5,35.5 71.4,36.4 69.4,33.5" />
              <polygon points="73.3,34.8 77.5,35 76.5,37 72.8,37 71.4,36.4" />
              <polygon points="73.2,33 75,32.5 75.2,35 73.5,35.5" />
            </g>
          </svg>
          <span>Pakistan regional overview</span>
        </div>
      )}

      {!diagnostics.styleLoaded && !mapError?.fatal && (
        <div className="map-loading" role="status">
          Loading map…
        </div>
      )}

      {mapError?.fatal && (
        <div className="map-fallback" role="alert">
          <AlertCircle className="h-8 w-8 text-amber-500" />
          <strong>{mapError.message}</strong>
          <span>Alert information and search remain available.</span>
          <code>{mapError.code}</code>
        </div>
      )}

      {mapError && !mapError.fatal && (
        <div className="map-warning" role="status">
          {mapError.message}
          {SHOW_DIAGNOSTICS && <code>{mapError.code}</code>}
        </div>
      )}

      <div className="map-actions">
        <button
          type="button"
          onClick={handleResetView}
          title="Reset Map View"
          aria-label="Reset map view to Pakistan center"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={handleFullscreen}
          title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Map"}
          aria-label="Toggle map fullscreen mode"
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
      </div>

      <div className="map-legend" aria-label="Alert severity legend">
        <strong>Severity:</strong>
        <span><i className="bg-red-800" />Critical</span>
        <span><i className="bg-orange-600" />High</span>
        <span><i className="bg-amber-600" />Medium</span>
        <span><i className="bg-blue-600" />Low</span>
        <span><i className="bg-slate-500" />Unknown</span>
      </div>

      {SHOW_DIAGNOSTICS && (
        <details className="map-diagnostics">
          <summary>Map diagnostics</summary>
          <dl>
            <dt>Initialized</dt><dd>{String(diagnostics.initialized)}</dd>
            <dt>WebGL</dt><dd>{String(diagnostics.webglAvailable)}</dd>
            <dt>Style loaded</dt><dd>{String(diagnostics.styleLoaded)}</dd>
            <dt>Zoom</dt><dd>{diagnostics.zoom}</dd>
            <dt>Center</dt><dd>{diagnostics.center.join(", ")}</dd>
            <dt>Style URL</dt><dd>{diagnostics.styleUrl}</dd>
            <dt>Tile source</dt><dd>{diagnostics.tileSourceState}</dd>
            <dt>Alert source</dt><dd>{String(diagnostics.alertSourceLoaded)}</dd>
            <dt>Alert features</dt><dd>{diagnostics.alertFeatureCount}</dd>
            <dt>Last error</dt><dd>{diagnostics.lastMapError || "None"}</dd>
            <dt>PMTiles</dt><dd>{String(diagnostics.pmtilesRegistered)}</dd>
          </dl>
        </details>
      )}
    </div>
  );
}
