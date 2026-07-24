import { 
  clampZoom, 
  getTargetZoomForType, 
  alertsToGeoJSON,
  MIN_ZOOM, 
  MAX_ZOOM, 
  DEFAULT_ZOOM,
  PAKISTAN_CENTER
} from "../lib/utils/mapUtils";
import { Alert } from "../lib/api/schemas";

describe("MapLibre GL Map Utility & Rule Tests", () => {
  test("Hard MAX_ZOOM is strictly set to 12", () => {
    expect(MAX_ZOOM).toBe(12);
  });

  test("Hard MIN_ZOOM is set to 5", () => {
    expect(MIN_ZOOM).toBe(5);
  });

  test("Pakistan center coordinates use MapLibre [longitude, latitude] format", () => {
    expect(PAKISTAN_CENTER[0]).toBe(69.3451); // Longitude
    expect(PAKISTAN_CENTER[1]).toBe(30.3753); // Latitude
  });

  test("clampZoom enforces upper limit of 12 and lower limit of 5", () => {
    expect(clampZoom(1)).toBe(5);
    expect(clampZoom(4)).toBe(5);
    expect(clampZoom(12)).toBe(12);
    expect(clampZoom(13)).toBe(12);
    expect(clampZoom(100)).toBe(12);
  });

  test("clampZoom handles NaN and Infinity gracefully", () => {
    expect(clampZoom(NaN)).toBe(DEFAULT_ZOOM);
    expect(clampZoom(Infinity)).toBe(12);
    expect(clampZoom(-Infinity)).toBe(5);
  });

  test("getTargetZoomForType returns correct clamped zoom for location classifications", () => {
    expect(getTargetZoomForType("province")).toBe(7);
    expect(getTargetZoomForType("territory")).toBe(7);
    expect(getTargetZoomForType("division")).toBe(8);
    expect(getTargetZoomForType("district")).toBe(9);
    expect(getTargetZoomForType("tehsil")).toBe(10);
    expect(getTargetZoomForType("city")).toBe(11);
    expect(getTargetZoomForType("town")).toBe(11);
    expect(getTargetZoomForType("coord")).toBe(12);
  });

  test("alertsToGeoJSON converts backend Alert model into valid MapLibre GeoJSON with [lng, lat]", () => {
    const dummyAlert: Alert = {
      id: 1,
      title: "Heavy Flood Advisory",
      description: "Severe flooding reported in Sialkot district",
      hazard_type: "flood",
      normalized_severity: "high",
      source_id: 1,
      source_name: "PMD Weather",
      source_url: "https://www.pmd.gov.pk",
      status: "active",
      issued_at: "2026-07-24T12:00:00Z",
      locations: [
        {
          id: 10,
          raw_location: "Sialkot",
          city: "Sialkot",
          district: "Sialkot District",
          province: "Punjab",
          latitude: 32.4945,
          longitude: 74.5229,
        },
      ],
    };

    const geojson = alertsToGeoJSON([dummyAlert]);
    expect(geojson.type).toBe("FeatureCollection");
    expect(geojson.features.length).toBe(1);

    const feature = geojson.features[0];
    expect(feature.geometry.type).toBe("Point");
    // Verify [longitude, latitude] ordering
    expect(feature.geometry.coordinates[0]).toBeCloseTo(74.5229);
    expect(feature.geometry.coordinates[1]).toBeCloseTo(32.4945);
    expect(feature.properties.severity).toBe("high");
    expect(feature.properties.hazard_type).toBe("flood");
  });
});
