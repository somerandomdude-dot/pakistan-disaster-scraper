import type { StyleSpecification } from "maplibre-gl";

export const DEFAULT_MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/bright";
export const MAP_WORKER_URL = "/maplibre-gl-worker.js";
export const MAP_WORKER_SHARED_URL = "/maplibre-gl-shared.mjs";

const pakistanRegions = {
  type: "FeatureCollection" as const,
  features: [
    { type: "Feature" as const, properties: { name: "Balochistan" }, geometry: { type: "Polygon" as const, coordinates: [[[61,25],[67,24.8],[70.3,28.4],[69.7,31.6],[66,32.1],[61,29.5],[61,25]]] } },
    { type: "Feature" as const, properties: { name: "Sindh" }, geometry: { type: "Polygon" as const, coordinates: [[[66.7,24],[71.1,24.4],[70.3,28.4],[68,28.2],[66.7,25],[66.7,24]]] } },
    { type: "Feature" as const, properties: { name: "Punjab" }, geometry: { type: "Polygon" as const, coordinates: [[[70.3,28.4],[74.7,28.4],[75,32.5],[71.4,33.1],[69.7,31.6],[70.3,28.4]]] } },
    { type: "Feature" as const, properties: { name: "Khyber Pakhtunkhwa" }, geometry: { type: "Polygon" as const, coordinates: [[[69.7,31.6],[71.4,33.1],[73.5,35.5],[71.4,36.4],[69.4,33.5],[69.7,31.6]]] } },
    { type: "Feature" as const, properties: { name: "Gilgit-Baltistan" }, geometry: { type: "Polygon" as const, coordinates: [[[73.3,34.8],[77.5,35],[76.5,37],[72.8,37],[71.4,36.4],[73.3,34.8]]] } },
    { type: "Feature" as const, properties: { name: "Azad Jammu & Kashmir" }, geometry: { type: "Polygon" as const, coordinates: [[[73.2,33],[75,32.5],[75.2,35],[73.5,35.5],[73.2,33]]] } },
  ],
};

export const OFFLINE_MAP_STYLE: StyleSpecification = {
  version: 8,
  name: "Pakistan offline basemap",
  sources: {
    "pakistan-regions": { type: "geojson", data: pakistanRegions },
  },
  layers: [
    { id: "offline-background", type: "background", paint: { "background-color": "#eef2f5" } },
    {
      id: "offline-regions-fill",
      type: "fill",
      source: "pakistan-regions",
      paint: { "fill-color": "#dce5e9", "fill-opacity": 0.88 },
    },
    {
      id: "offline-regions-outline",
      type: "line",
      source: "pakistan-regions",
      paint: { "line-color": "#91a4ae", "line-width": 1.2 },
    },
  ],
};

export type MapErrorCode =
  | "STYLE_URL_MISSING"
  | "STYLE_HTTP_ERROR"
  | "STYLE_INVALID_JSON"
  | "TILE_SOURCE_FAILED"
  | "GLYPH_SOURCE_FAILED"
  | "SPRITE_SOURCE_FAILED"
  | "PMTILES_SOURCE_FAILED"
  | "CORS_BLOCKED"
  | "API_KEY_MISSING"
  | "WEBGL_UNAVAILABLE"
  | "WORKER_SOURCE_FAILED"
  | "MAP_INITIALIZATION_FAILED";

export class MapConfigurationError extends Error {
  constructor(
    public readonly code: MapErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "MapConfigurationError";
  }
}

type FetchLike = typeof fetch;

function absoluteUrl(value: string, baseUrl: string): string {
  return new URL(value, baseUrl).toString();
}

async function fetchRequired(
  url: string,
  code: MapErrorCode,
  fetchImpl: FetchLike,
): Promise<Response> {
  try {
    const response = await fetchImpl(url, {
      cache: "no-store",
      mode: "cors",
    });
    if (!response.ok) {
      throw new MapConfigurationError(code, `${response.status} ${response.statusText}: ${url}`);
    }
    return response;
  } catch (error) {
    if (error instanceof MapConfigurationError) {
      throw error;
    }
    throw new MapConfigurationError(
      "CORS_BLOCKED",
      `The browser could not access ${url}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export function resolveMapStyleUrl(
  configuredStyleUrl = process.env.NEXT_PUBLIC_MAP_STYLE_URL,
  mapTilerKey = process.env.NEXT_PUBLIC_MAPTILER_KEY,
): string {
  const configured = configuredStyleUrl?.trim();
  const resolved = configured || DEFAULT_MAP_STYLE_URL;

  if (!resolved) {
    throw new MapConfigurationError("STYLE_URL_MISSING", "No MapLibre style URL is configured.");
  }

  const usesKeyTemplate = resolved.includes("{key}") || resolved.includes("${NEXT_PUBLIC_MAPTILER_KEY}");
  if (usesKeyTemplate && !mapTilerKey?.trim()) {
    throw new MapConfigurationError("API_KEY_MISSING", "The configured map style requires a provider key.");
  }

  return usesKeyTemplate
    ? resolved
        .replaceAll("{key}", mapTilerKey!.trim())
        .replaceAll("${NEXT_PUBLIC_MAPTILER_KEY}", mapTilerKey!.trim())
    : resolved;
}

export function redactMapStyleUrl(styleUrl: string): string {
  try {
    const url = new URL(styleUrl);
    for (const key of ["key", "api_key", "apikey", "access_token", "token"]) {
      if (url.searchParams.has(key)) {
        url.searchParams.set(key, "[redacted]");
      }
    }
    return url.toString();
  } catch {
    return "[invalid style URL]";
  }
}

export async function validateWorkerAsset(
  workerUrl = MAP_WORKER_URL,
  fetchImpl: FetchLike = fetch,
): Promise<void> {
  const response = await fetchRequired(workerUrl, "WORKER_SOURCE_FAILED", fetchImpl);
  const contentType = response.headers.get("content-type") || "";
  if (!/(java|ecma)script|text\/plain/i.test(contentType)) {
    throw new MapConfigurationError(
      "WORKER_SOURCE_FAILED",
      `The MapLibre worker returned an invalid content type: ${contentType || "unknown"}.`,
    );
  }
}

export async function validateMapStyle(
  styleUrl: string,
  fetchImpl: FetchLike = fetch,
): Promise<StyleSpecification> {
  if (!styleUrl.trim()) {
    throw new MapConfigurationError("STYLE_URL_MISSING", "No MapLibre style URL is configured.");
  }

  const styleResponse = await fetchRequired(styleUrl, "STYLE_HTTP_ERROR", fetchImpl);
  let style: StyleSpecification;
  try {
    style = (await styleResponse.json()) as StyleSpecification;
  } catch {
    throw new MapConfigurationError("STYLE_INVALID_JSON", "The map style response is not valid JSON.");
  }

  if (style.version !== 8 || !style.sources || !Array.isArray(style.layers)) {
    throw new MapConfigurationError(
      "STYLE_INVALID_JSON",
      "The map style is not a valid MapLibre style specification (version 8).",
    );
  }

  const sourceChecks = Object.values(style.sources)
    .filter((source): source is typeof source & { url: string } => "url" in source && typeof source.url === "string")
    .map((source) =>
      fetchRequired(absoluteUrl(source.url, styleUrl), "TILE_SOURCE_FAILED", fetchImpl),
    );
  await Promise.all(sourceChecks);

  if (typeof style.glyphs === "string") {
    const glyphUrl = absoluteUrl(
      style.glyphs
        .replace("{fontstack}", encodeURIComponent("Noto Sans Regular"))
        .replace("{range}", "0-255"),
      styleUrl,
    );
    await fetchRequired(glyphUrl, "GLYPH_SOURCE_FAILED", fetchImpl);
  }

  if (typeof style.sprite === "string") {
    const spriteBase = absoluteUrl(style.sprite, styleUrl);
    await Promise.all([
      fetchRequired(`${spriteBase}.json`, "SPRITE_SOURCE_FAILED", fetchImpl),
      fetchRequired(`${spriteBase}.png`, "SPRITE_SOURCE_FAILED", fetchImpl),
    ]);
  }

  return style;
}

export async function validateMapStyleWithRetry(
  styleUrl: string,
  fetchImpl: FetchLike = fetch,
): Promise<StyleSpecification> {
  try {
    return await validateMapStyle(styleUrl, fetchImpl);
  } catch (firstError) {
    await new Promise((resolve) => setTimeout(resolve, 300));
    try {
      return await validateMapStyle(styleUrl, fetchImpl);
    } catch {
      throw firstError;
    }
  }
}

export function classifyMapLibreError(error: unknown): MapErrorCode {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  if (normalized.includes("pmtiles")) return "PMTILES_SOURCE_FAILED";
  if (normalized.includes("glyph") || normalized.includes("font")) return "GLYPH_SOURCE_FAILED";
  if (normalized.includes("sprite") || normalized.includes("image")) return "SPRITE_SOURCE_FAILED";
  if (normalized.includes("worker") || normalized.includes("module script")) return "WORKER_SOURCE_FAILED";
  if (normalized.includes("cors") || normalized.includes("cross-origin")) return "CORS_BLOCKED";
  if (normalized.includes("401") || normalized.includes("403") || normalized.includes("api key")) {
    return "API_KEY_MISSING";
  }
  if (normalized.includes("tile") || normalized.includes("source")) return "TILE_SOURCE_FAILED";
  return "MAP_INITIALIZATION_FAILED";
}
