import { 
  clampZoom, 
  getTargetZoomForType, 
  MIN_ZOOM, 
  MAX_ZOOM, 
  DEFAULT_ZOOM,
  PROVINCE_ZOOM,
  DISTRICT_ZOOM,
  CITY_ZOOM,
  ALERT_COORD_ZOOM
} from "../lib/utils/mapUtils";

describe("Map Zoom Limits & Utility Tests", () => {
  test("clampZoom should enforce MIN_ZOOM (5)", () => {
    expect(clampZoom(1)).toBe(MIN_ZOOM);
    expect(clampZoom(-10)).toBe(MIN_ZOOM);
    expect(clampZoom(4)).toBe(MIN_ZOOM);
  });

  test("clampZoom should enforce MAX_ZOOM (15)", () => {
    expect(clampZoom(16)).toBe(MAX_ZOOM);
    expect(clampZoom(25)).toBe(MAX_ZOOM);
    expect(clampZoom(100)).toBe(MAX_ZOOM);
  });

  test("clampZoom should return requested zoom when within bounds [5, 15]", () => {
    expect(clampZoom(5)).toBe(5);
    expect(clampZoom(7)).toBe(7);
    expect(clampZoom(11)).toBe(11);
    expect(clampZoom(15)).toBe(15);
  });

  test("clampZoom should handle invalid/NaN values gracefully", () => {
    expect(clampZoom(NaN)).toBe(DEFAULT_ZOOM);
    expect(clampZoom(Infinity)).toBe(MAX_ZOOM);
    expect(clampZoom(-Infinity)).toBe(MIN_ZOOM);
  });

  test("getTargetZoomForType returns correct clamped zoom for location classifications", () => {
    expect(getTargetZoomForType("province")).toBe(PROVINCE_ZOOM); // 7
    expect(getTargetZoomForType("district")).toBe(DISTRICT_ZOOM); // 9
    expect(getTargetZoomForType("city")).toBe(CITY_ZOOM);         // 11
    expect(getTargetZoomForType("coord")).toBe(ALERT_COORD_ZOOM);   // 12
    expect(getTargetZoomForType("default")).toBe(DEFAULT_ZOOM);   // 6
  });
});
