"use client";

import { useEffect, useRef } from "react";
import { useMap } from "react-map-gl/maplibre";
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
  zoom = 11,
  locationId,
}: MapCityControllerProps) {
  const { current: map } = useMap();
  const lastLocationRef = useRef<{ id?: string | null; lat: number | null; lng: number | null }>({
    id: null,
    lat: null,
    lng: null,
  });

  useEffect(() => {
    if (
      !map ||
      latitude === null ||
      longitude === null ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      return;
    }

    if (
      lastLocationRef.current.lat === latitude &&
      lastLocationRef.current.lng === longitude &&
      lastLocationRef.current.id === locationId
    ) {
      return;
    }

    lastLocationRef.current = { id: locationId, lat: latitude, lng: longitude };

    map.flyTo({
      center: [longitude, latitude], // MapLibre: [lng, lat]
      zoom: clampZoom(zoom),
      speed: 2.2,
      curve: 1.2,
      essential: true,
    });
  }, [map, latitude, longitude, zoom, locationId]);

  return null;
}
