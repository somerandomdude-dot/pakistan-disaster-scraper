import {
  classifyMapLibreError,
  DEFAULT_MAP_STYLE_URL,
  MapConfigurationError,
  redactMapStyleUrl,
  resolveMapStyleUrl,
  validateMapStyle,
  validateWorkerAsset,
} from "@/lib/maps/mapConfig";

function response(body: BodyInit, init?: ResponseInit): Response {
  return new Response(body, { status: 200, ...init });
}

describe("MapLibre configuration validation", () => {
  test("uses the verified no-key vector style by default", () => {
    expect(resolveMapStyleUrl(undefined, undefined)).toBe(DEFAULT_MAP_STYLE_URL);
  });

  test("reports a missing style URL clearly", async () => {
    await expect(validateMapStyle("", vi.fn())).rejects.toMatchObject({
      code: "STYLE_URL_MISSING",
    });
  });

  test("requires a provider key only for keyed style templates", () => {
    expect(() => resolveMapStyleUrl("https://example.test/style.json?key={key}", "")).toThrowError(
      expect.objectContaining({ code: "API_KEY_MISSING" }),
    );
    expect(resolveMapStyleUrl("https://example.test/style.json?key={key}", "secret")).toContain(
      "key=secret",
    );
  });

  test("redacts provider credentials in diagnostics", () => {
    expect(redactMapStyleUrl("https://example.test/style.json?key=secret&theme=bright")).toBe(
      "https://example.test/style.json?key=%5Bredacted%5D&theme=bright",
    );
  });

  test("rejects non-JSON and non-v8 styles", async () => {
    const invalidJsonFetch = vi.fn<typeof fetch>().mockResolvedValue(response("not json"));
    await expect(validateMapStyle("https://example.test/style", invalidJsonFetch)).rejects.toMatchObject({
      code: "STYLE_INVALID_JSON",
    });

    const invalidVersionFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValue(response(JSON.stringify({ version: 7, sources: {}, layers: [] })));
    await expect(validateMapStyle("https://example.test/style", invalidVersionFetch)).rejects.toMatchObject({
      code: "STYLE_INVALID_JSON",
    });
  });

  test("validates TileJSON, glyph, and sprite resources", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.endsWith("/style")) {
        return response(
          JSON.stringify({
            version: 8,
            sources: { basemap: { type: "vector", url: "/tilejson" } },
            glyphs: "/fonts/{fontstack}/{range}.pbf",
            sprite: "/sprites/main",
            layers: [],
          }),
          { headers: { "content-type": "application/json" } },
        );
      }
      return response("ok");
    });

    await expect(validateMapStyle("https://example.test/style", fetchMock)).resolves.toMatchObject({
      version: 8,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.test/tilejson",
      expect.objectContaining({ mode: "cors" }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.test/sprites/main.png",
      expect.any(Object),
    );
  });

  test("rejects a worker endpoint that returns HTML", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(response("<html></html>", { headers: { "content-type": "text/html" } }));
    await expect(validateWorkerAsset("/maplibre-gl-worker.js", fetchMock)).rejects.toMatchObject({
      code: "WORKER_SOURCE_FAILED",
    });
  });

  test("classifies asynchronous MapLibre resource failures", () => {
    expect(classifyMapLibreError(new Error("tile source failed"))).toBe("TILE_SOURCE_FAILED");
    expect(classifyMapLibreError(new Error("worker module script failed"))).toBe("WORKER_SOURCE_FAILED");
    expect(classifyMapLibreError(new Error("glyph request failed"))).toBe("GLYPH_SOURCE_FAILED");
    expect(classifyMapLibreError(new Error("PMTiles range request failed"))).toBe("PMTILES_SOURCE_FAILED");
  });

  test("preserves typed configuration errors", () => {
    const error = new MapConfigurationError("STYLE_HTTP_ERROR", "503");
    expect(error.code).toBe("STYLE_HTTP_ERROR");
  });
});
