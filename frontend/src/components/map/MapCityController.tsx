"use client";

import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import { clampZoom, CITY_ZOOM } from "@/lib/utils/mapUtils";

interface MapCityControllerProps {
  latitude: number | null;
  longitude: number | null;
  zoom?: number;
  locationId?: string | null;
}

export default function MapCityController({
  latitude,
  longitude,
  zoom = CITY_ZOOM,
  locationId,
}: MapCityControllerProps) {
  const map = useMap();
  const lastLocationRef = useRef<{ id?: string | null; lat: number | null; lng: number | null }>({
    id: null,
    lat: null,
    lng: null,
  });

  useEffect(() => {
    if (
      latitude === null ||
      longitude === null ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      return;
    }

    // Ignore duplicate searches / movements if coordinates or location ID haven't changed
    if (
      lastLocationRef.current.lat === latitude &&
      lastLocationRef.current.lng === longitude &&
      lastLocationRef.current.id === locationId
    ) {
      return;
    }

    lastLocationRef.current = { id: locationId, lat: latitude, lng: longitude };

    const targetZoom = clampZoom(zoom);

    // Stop active map animations before starting new single-flight flyTo
    map.stop();

    map.flyTo([latitude, longitude], targetZoom, {
      animate: true,
      duration: 0.8,
    });
  }, [map, latitude, longitude, zoom, locationId]);

  return null;
}
