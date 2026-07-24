"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Alert } from "@/lib/api/schemas";
import { 
  clampZoom, MIN_ZOOM, MAX_ZOOM, DEFAULT_ZOOM, 
  PAKISTAN_CENTER, PAKISTAN_BOUNDS, alertsToGeoJSON, isWebGLSupported 
} from "@/lib/utils/mapUtils";
import { RotateCcw, Maximize2, AlertCircle } from "lucide-react";

// Default lightweight vector basemap style (OpenFreeMap Bright / MapLibre Demotiles)
const MAP_STYLE_URL = process.env.NEXT_PUBLIC_MAP_STYLE_URL || "https://tiles.openfreemap.org/styles/bright";

interface MapComponentProps {
  alerts: Alert[];
  selectedCityCoords?: { lat: number; lng: number } | null;
  selectedCityZoom?: number;
  onSelectAlert?: (alert: Alert) => void;
}

export default function MapComponent({
  alerts,
  selectedCityCoords,
  selectedCityZoom,
  onSelectAlert,
}: MapComponentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const lastFlyCoordsRef = useRef<string | null>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [webGlSupported, setWebGlSupported] = useState(true);
  const [isMapLoaded, setIsMapLoaded] = useState(false);

  // Convert alerts to GeoJSON FeatureCollection
  const geojsonData = useMemo(() => {
    return alertsToGeoJSON(alerts || []);
  }, [alerts]);

  // Check WebGL support on mount
  useEffect(() => {
    setWebGlSupported(isWebGLSupported());
  }, []);

  // Initialize MapLibre GL instance
  useEffect(() => {
    if (!containerRef.current || mapRef.current || !webGlSupported) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE_URL,
      center: PAKISTAN_CENTER, // [longitude, latitude]
      zoom: clampZoom(DEFAULT_ZOOM),
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
      maxBounds: PAKISTAN_BOUNDS,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    map.on("load", () => {
      setIsMapLoaded(true);

      // Add Alerts GeoJSON Source with Clustering enabled
      map.addSource("alerts-source", {
        type: "geojson",
        data: geojsonData,
        cluster: true,
        clusterMaxZoom: 10,
        clusterRadius: 45,
      });

      // Cluster Circle Layer
      map.addLayer({
        id: "clusters-layer",
        type: "circle",
        source: "alerts-source",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": [
            "step",
            ["get", "point_count"],
            "#1e3a8a", // 0-5 items
            5,
            "#d97706", // 5-15 items
            15,
            "#dc2626", // 15+ items
          ],
          "circle-radius": [
            "step",
            ["get", "point_count"],
            18,
            5,
            24,
            15,
            30,
          ],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });

      // Cluster Count Text Layer
      map.addLayer({
        id: "cluster-count-layer",
        type: "symbol",
        source: "alerts-source",
        filter: ["has", "point_count"],
        layout: {
          "text-field": "{point_count_abbreviated}",
          "text-font": ["Metropolis Regular", "Noto Sans Regular", "sans-serif"],
          "text-size": 12,
        },
        paint: {
          "text-color": "#ffffff",
        },
      });

      // Unclustered Hazard Point Markers
      map.addLayer({
        id: "unclustered-point-layer",
        type: "circle",
        source: "alerts-source",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": [
            "match",
            ["get", "severity"],
            "critical", "#dc2626",
            "high", "#ea580c",
            "medium", "#d97706",
            "low", "#2563eb",
            "#64748b",
          ],
          "circle-radius": 8,
          "circle-stroke-width": 3,
          "circle-stroke-color": "#ffffff",
        },
      });

      // Cursor styling on hover
      map.on("mouseenter", "clusters-layer", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "clusters-layer", () => {
        map.getCanvas().style.cursor = "";
      });
      map.on("mouseenter", "unclustered-point-layer", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "unclustered-point-layer", () => {
        map.getCanvas().style.cursor = "";
      });

      // Handle Cluster Click - Ease to Cluster Expansion Zoom (clamped to max 12)
      map.on("click", "clusters-layer", (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ["clusters-layer"] });
        const clusterId = features[0]?.properties?.cluster_id;
        const source = map.getSource("alerts-source") as maplibregl.GeoJSONSource;

        if (source && clusterId !== undefined) {
          source.getClusterExpansionZoom(clusterId).then((expansionZoom) => {
            if (expansionZoom === undefined) return;

            const targetZoom = clampZoom(expansionZoom);
            const geometry = features[0].geometry as GeoJSON.Point;

            map.easeTo({
              center: geometry.coordinates as [number, number],
              zoom: targetZoom,
              duration: 500,
            });
          }).catch(() => {});
        }
      });

      // Handle Unclustered Marker Click - Display Popup
      map.on("click", "unclustered-point-layer", (e) => {
        const feature = e.features?.[0];
        if (!feature || !feature.geometry) return;

        const coordinates = (feature.geometry as GeoJSON.Point).coordinates.slice() as [number, number];
        const props = feature.properties || {};

        if (popupRef.current) {
          popupRef.current.remove();
        }

        const popupDiv = document.createElement("div");
        popupDiv.className = "flex flex-col gap-2 p-1 font-sans text-slate-900";

        const color = props.severity === "critical" ? "#dc2626" : props.severity === "high" ? "#ea580c" : props.severity === "medium" ? "#d97706" : "#2563eb";

        popupDiv.innerHTML = `
          <div style="display: flex; align-items: center; gap: 8px; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px;">
            <strong style="font-weight: 600; color: #0f172a; font-size: 13px; line-height: 1.3;">
              ${props.title}
            </strong>
          </div>
          <div style="font-size: 12px; color: #475569; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; margin-top: 4px;">
            ${props.description}
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px; padding-top: 8px; border-top: 1px solid #f1f5f9;">
            <span style="background-color: ${color}20; color: ${color}; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; text-transform: uppercase;">
              ${props.severity}
            </span>
            <span style="font-size: 11px; color: #64748b; font-weight: 500;">
              ${props.location_name}
            </span>
          </div>
        `;

        if (onSelectAlert) {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "mt-2 w-full py-1.5 bg-blue-900 hover:bg-blue-800 text-white rounded text-xs font-medium transition-colors cursor-pointer";
          btn.innerText = "View Full Advisory Details";
          btn.onclick = () => {
            const matchedAlert = (alerts || []).find((a) => a.id === props.alert_id);
            if (matchedAlert) onSelectAlert(matchedAlert);
          };
          popupDiv.appendChild(btn);
        }

        popupRef.current = new maplibregl.Popup({ closeButton: true, offset: 12 })
          .setLngLat(coordinates)
          .setDOMContent(popupDiv)
          .addTo(map);
      });
    });

    mapRef.current = map;

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [webGlSupported]);

  // Update GeoJSON Source data dynamically without remounting the map
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoaded) return;

    const source = map.getSource("alerts-source") as maplibregl.GeoJSONSource;
    if (source) {
      source.setData(geojsonData);
    }
  }, [geojsonData, isMapLoaded]);

  // Handle instant City Fly-To single-flight execution (coordinates: [lng, lat])
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedCityCoords) return;

    const coordKey = `${selectedCityCoords.lng.toFixed(4)},${selectedCityCoords.lat.toFixed(4)}`;
    if (lastFlyCoordsRef.current === coordKey) return;
    lastFlyCoordsRef.current = coordKey;

    const targetZoom = clampZoom(selectedCityZoom ?? 11);

    map.flyTo({
      center: [selectedCityCoords.lng, selectedCityCoords.lat], // MapLibre: [longitude, latitude]
      zoom: targetZoom,
      speed: 2.2,
      curve: 1.2,
      essential: true,
    });
  }, [selectedCityCoords, selectedCityZoom]);

  // Immediate Reset Map control
  const handleResetView = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    lastFlyCoordsRef.current = null;
    if (popupRef.current) {
      popupRef.current.remove();
    }

    map.jumpTo({
      center: PAKISTAN_CENTER, // [longitude, latitude]
      zoom: clampZoom(DEFAULT_ZOOM),
    });
  }, []);

  // Render WebGL failure fallback if WebGL context is not supported
  if (!webGlSupported) {
    return (
      <div className="w-full h-full min-h-[450px] bg-slate-100 border border-slate-200 rounded-md p-6 flex flex-col items-center justify-center text-center">
        <AlertCircle className="h-10 w-10 text-amber-500 mb-2" />
        <h4 className="font-semibold text-slate-800 text-sm">WebGL Acceleration Unavailable</h4>
        <p className="text-xs text-slate-600 max-w-sm mt-1">
          Interactive map acceleration is unavailable on this device or browser. Alert information is still fully accessible in the advisory list.
        </p>
      </div>
    );
  }

  return (
    <div className={`w-full h-full relative rounded-md overflow-hidden border border-slate-200 bg-slate-100 ${isFullscreen ? "fixed inset-0 z-50 rounded-none border-none" : "min-h-[450px]"}`}>
      
      {/* Map Control Buttons */}
      <div className="absolute top-3 right-3 z-[10] flex flex-col gap-2 bg-white p-1 rounded-md shadow-md border border-slate-200">
        <button
          type="button"
          onClick={handleResetView}
          className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors cursor-pointer"
          title="Reset Map View"
          aria-label="Reset map view to Pakistan center"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => {
            setIsFullscreen(!isFullscreen);
            setTimeout(() => {
              mapRef.current?.resize();
            }, 100);
          }}
          className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors cursor-pointer"
          title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Map"}
          aria-label="Toggle map fullscreen mode"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>

      {/* Severity Legend */}
      <div className="absolute bottom-3 left-3 z-[10] bg-white/95 backdrop-blur-xs p-2.5 rounded-md shadow-md border border-slate-200 text-xs flex flex-wrap items-center gap-3">
        <span className="font-semibold text-slate-700">Severity:</span>
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-600 inline-block"></span><span className="text-slate-600">Critical</span></div>
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-orange-600 inline-block"></span><span className="text-slate-600">High</span></div>
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-600 inline-block"></span><span className="text-slate-600">Golden</span></div>
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block"></span><span className="text-slate-600">Low</span></div>
      </div>

      {/* MapLibre Container */}
      <div ref={containerRef} className="w-full h-full min-h-[450px] z-0" />
    </div>
  );
}
