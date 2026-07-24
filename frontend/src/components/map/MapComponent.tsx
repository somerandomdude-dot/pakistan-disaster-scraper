"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import L from "leaflet";
import { Alert } from "@/lib/api/schemas";
import { Badge } from "../shared/Badge";
import { 
  clampZoom, MIN_ZOOM, MAX_ZOOM, DEFAULT_ZOOM, 
  PAKISTAN_CENTER, PAKISTAN_BOUNDS, debounce 
} from "@/lib/utils/mapUtils";
import { 
  AlertTriangle, Droplets, Wind, ThermometerSun, 
  Activity, Mountain, RotateCcw, Maximize2, AlertCircle 
} from "lucide-react";

// Cache icon objects by severity to prevent recreating DOM objects on every frame
const iconCache = new Map<string, L.DivIcon>();

function getSeverityColor(severity: string) {
  switch (severity?.toLowerCase()) {
    case "critical": return "#dc2626";
    case "high": return "#ea580c";
    case "medium": return "#d97706";
    case "low": return "#2563eb";
    default: return "#64748b";
  }
}

function getCachedCustomIcon(severity: string): L.DivIcon {
  const key = severity?.toLowerCase() || "default";
  if (iconCache.has(key)) {
    return iconCache.get(key)!;
  }

  const color = getSeverityColor(severity);
  const iconHtml = `
    <div style="background-color: white; border: 3px solid ${color}; width: 26px; height: 26px; border-radius: 50%; box-shadow: 0 2px 6px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;">
      <div style="background-color: ${color}; width: 10px; height: 10px; border-radius: 50%;"></div>
    </div>
  `;

  const divIcon = L.divIcon({
    html: iconHtml,
    className: "custom-leaflet-icon",
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });

  iconCache.set(key, divIcon);
  return divIcon;
}

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
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const geojsonLayerRef = useRef<L.GeoJSON | null>(null);
  const hasFitInitialBoundsRef = useRef(false);
  const lastFlyCoordsRef = useRef<string | null>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [tileError, setTileError] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(DEFAULT_ZOOM);

  // Extract and deduplicate valid alert markers
  const markersData = useMemo(() => {
    const validMarkers: { alert: Alert; position: [number, number]; locationName: string }[] = [];
    const seenCoords = new Set<string>();

    (alerts || []).forEach((alert) => {
      (alert.locations || []).forEach((loc) => {
        if (loc.latitude && loc.longitude && Number.isFinite(loc.latitude) && Number.isFinite(loc.longitude)) {
          // Offset slightly if duplicate coordinates exist to prevent marker stacking
          let lat = loc.latitude;
          let lng = loc.longitude;
          const coordKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;

          if (seenCoords.has(coordKey)) {
            lat += (Math.random() - 0.5) * 0.01;
            lng += (Math.random() - 0.5) * 0.01;
          }
          seenCoords.add(coordKey);

          validMarkers.push({
            alert,
            position: [lat, lng],
            locationName: loc.city || loc.district || loc.province || loc.raw_location || "Advisory Location",
          });
        }
      });
    });

    return validMarkers;
  }, [alerts]);

  // Safely initialize Leaflet Map instance with hard zoom limits & Pakistan bounds
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    if ((containerRef.current as any)._leaflet_id) {
      delete (containerRef.current as any)._leaflet_id;
    }

    const map = L.map(containerRef.current, {
      center: PAKISTAN_CENTER,
      zoom: clampZoom(DEFAULT_ZOOM),
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
      maxBounds: PAKISTAN_BOUNDS,
      maxBoundsViscosity: 0.8,
      scrollWheelZoom: true,
      zoomControl: true,
    });

    // Base OSM tiles with tile error handling & idle updates
    const tileLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
      maxNativeZoom: 18,
      updateWhenIdle: true,
      keepBuffer: 2,
    });

    tileLayer.on("tileerror", () => {
      setTileError(true);
    });

    tileLayer.addTo(map);

    const markersLayer = L.layerGroup().addTo(map);
    markersLayerRef.current = markersLayer;
    mapRef.current = map;

    // Debounced zoomend / moveend handler to prevent intermediate frame updates
    const handleMoveEnd = debounce(() => {
      if (mapRef.current) {
        setCurrentZoom(clampZoom(mapRef.current.getZoom()));
      }
    }, 200);

    map.on("zoomend", handleMoveEnd);
    map.on("moveend", handleMoveEnd);

    return () => {
      if (mapRef.current) {
        mapRef.current.off("zoomend", handleMoveEnd);
        mapRef.current.off("moveend", handleMoveEnd);
        mapRef.current.remove();
        mapRef.current = null;
      }
      if (containerRef.current) {
        delete (containerRef.current as any)._leaflet_id;
      }
    };
  }, []);

  // Handle selected city flyTo safely ONCE without infinite loops
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedCityCoords) return;

    const coordKey = `${selectedCityCoords.lat.toFixed(4)},${selectedCityCoords.lng.toFixed(4)}`;
    if (lastFlyCoordsRef.current === coordKey) return;
    lastFlyCoordsRef.current = coordKey;

    const targetZoom = clampZoom(selectedCityZoom ?? 11);

    map.stop();
    map.flyTo([selectedCityCoords.lat, selectedCityCoords.lng], targetZoom, {
      animate: true,
      duration: 0.8,
    });
  }, [selectedCityCoords, selectedCityZoom]);

  // Update Markers on layer without remounting the map
  useEffect(() => {
    const map = mapRef.current;
    const layerGroup = markersLayerRef.current;
    if (!map || !layerGroup) return;

    layerGroup.clearLayers();

    const boundsLatLngs: [number, number][] = [];

    markersData.forEach(({ alert, position, locationName }) => {
      boundsLatLngs.push(position);
      const icon = getCachedCustomIcon(alert.normalized_severity);

      const popupDiv = document.createElement("div");
      popupDiv.className = "flex flex-col gap-2 p-1 font-sans";

      const color = getSeverityColor(alert.normalized_severity);
      popupDiv.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px;">
          <strong style="font-weight: 600; color: #0f172a; font-size: 12px; line-height: 1.3;">
            ${alert.title}
          </strong>
        </div>
        <div style="font-size: 12px; color: #475569; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; margin-top: 4px;">
          ${alert.description || "Not provided by source."}
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px; padding-top: 8px; border-top: 1px solid #f1f5f9;">
          <span style="background-color: ${color}20; color: ${color}; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; text-transform: uppercase;">
            ${alert.normalized_severity}
          </span>
          <span style="font-size: 11px; color: #64748b; font-weight: 500;">
            ${locationName}
          </span>
        </div>
      `;

      if (onSelectAlert) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "mt-2 w-full py-1 bg-blue-900 hover:bg-blue-800 text-white rounded text-xs font-medium transition-colors cursor-pointer";
        btn.innerText = "View Full Advisory Details";
        btn.onclick = () => onSelectAlert(alert);
        popupDiv.appendChild(btn);
      }

      const marker = L.marker(position, { icon }).bindPopup(popupDiv, { minWidth: 260 });
      layerGroup.addLayer(marker);
    });

    // Fit initial bounds ONCE if markers exist and no city is explicitly selected
    if (boundsLatLngs.length > 0 && !selectedCityCoords && !hasFitInitialBoundsRef.current) {
      hasFitInitialBoundsRef.current = true;
      const bounds = L.latLngBounds(boundsLatLngs);
      map.fitBounds(bounds, {
        padding: [40, 40],
        maxZoom: clampZoom(8),
        animate: true,
        duration: 0.5,
      });
    }
  }, [markersData, onSelectAlert, selectedCityCoords]);

  // Lazy-load simplified boundary GeoJSON when zoomed in
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (geojsonLayerRef.current) {
      map.removeLayer(geojsonLayerRef.current);
      geojsonLayerRef.current = null;
    }

    if (currentZoom >= 7) {
      import("@/lib/data/maps/pakistanProvinces")
        .then(({ PAKISTAN_PROVINCES_GEOJSON }) => {
          if (!mapRef.current) return;
          const layer = L.geoJSON(PAKISTAN_PROVINCES_GEOJSON as any, {
            style: {
              color: "#2563eb",
              weight: 1,
              opacity: 0.4,
              fillOpacity: 0.05,
            },
          });
          geojsonLayerRef.current = layer;
          layer.addTo(mapRef.current);
        })
        .catch(() => {
          // Non-blocking boundary load error
        });
    }
  }, [currentZoom]);

  // Reset view to default Pakistan center and zoom 6
  const handleResetView = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    lastFlyCoordsRef.current = null;
    hasFitInitialBoundsRef.current = false;
    setTileError(false);

    map.stop();
    map.setView(PAKISTAN_CENTER, clampZoom(DEFAULT_ZOOM), {
      animate: true,
      duration: 0.6,
    });
  }, []);

  return (
    <div className={`w-full h-full relative rounded-md overflow-hidden border border-slate-200 bg-slate-100 ${isFullscreen ? "fixed inset-0 z-50 rounded-none border-none" : "min-h-[450px]"}`}>
      
      {/* Map Control Overlay Buttons */}
      <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-2 bg-white p-1 rounded-md shadow-md border border-slate-200">
        <button
          type="button"
          onClick={handleResetView}
          className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors cursor-pointer"
          title="Reset Map View"
          aria-label="Reset map view to Pakistan"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => {
            setIsFullscreen(!isFullscreen);
            setTimeout(() => {
              mapRef.current?.invalidateSize();
            }, 100);
          }}
          className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors cursor-pointer"
          title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Map"}
          aria-label="Toggle map fullscreen mode"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>

      {/* Non-blocking Tile Error Toast */}
      {tileError && (
        <div className="absolute top-3 left-3 z-[1000] bg-amber-50 border border-amber-200 text-amber-900 text-xs px-3 py-1.5 rounded shadow-sm flex items-center gap-2">
          <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
          <span>Some map tiles could not be loaded. Retrying...</span>
        </div>
      )}

      {/* Severity Legend */}
      <div className="absolute bottom-3 left-3 z-[1000] bg-white/95 backdrop-blur-xs p-2.5 rounded-md shadow-md border border-slate-200 text-xs flex flex-wrap items-center gap-3">
        <span className="font-semibold text-slate-700">Severity:</span>
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-600 inline-block"></span><span className="text-slate-600">Critical</span></div>
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-orange-600 inline-block"></span><span className="text-slate-600">High</span></div>
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-600 inline-block"></span><span className="text-slate-600">Medium</span></div>
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block"></span><span className="text-slate-600">Low</span></div>
      </div>

      {/* Map DOM Mount Container */}
      <div ref={containerRef} className="w-full h-full min-h-[450px] z-0" />
    </div>
  );
}
