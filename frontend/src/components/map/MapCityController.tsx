"use client";

import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";

interface MapCityControllerProps {
  latitude: number | null;
  longitude: number | null;
  zoom?: number;
}

export default function MapCityController({
  latitude,
  longitude,
  zoom = 12,
}: MapCityControllerProps) {
  const map = useMap();
  const prevCoordsRef = useRef<{ lat: number | null; lng: number | null }>({
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

    // Prevent re-triggering flyTo if coordinates haven't changed
    if (
      prevCoordsRef.current.lat === latitude &&
      prevCoordsRef.current.lng === longitude
    ) {
      return;
    }

    prevCoordsRef.current = { lat: latitude, lng: longitude };

    map.flyTo([latitude, longitude], zoom, {
      animate: true,
      duration: 1.2,
    });
  }, [map, latitude, longitude, zoom]);

  return null;
}
