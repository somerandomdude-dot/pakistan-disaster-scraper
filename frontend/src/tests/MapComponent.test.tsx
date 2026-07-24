import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import type { ReactElement } from "react";

const maplibreMock = vi.hoisted(() => {
  class Source {
    setData = vi.fn();
    getClusterExpansionZoom = vi.fn().mockResolvedValue(8);
  }

  class Map {
    static instances: Map[] = [];
    options: Record<string, unknown>;
    handlers = new globalThis.Map<string, Array<(...args: any[]) => void>>();
    sources = new globalThis.Map<string, Source>();
    layers = new Set<string>();
    styleLoaded = false;
    resize = vi.fn();
    remove = vi.fn();
    stop = vi.fn();
    jumpTo = vi.fn();
    flyTo = vi.fn();
    easeTo = vi.fn();
    addControl = vi.fn();
    setFilter = vi.fn();
    getCanvas = vi.fn(() => ({ style: { cursor: "" } }));
    getCenter = vi.fn(() => ({ lng: 69.3451, lat: 30.3753 }));
    getZoom = vi.fn(() => 5.8);
    queryRenderedFeatures = vi.fn(() => []);

    constructor(options: Record<string, unknown>) {
      this.options = options;
      Map.instances.push(this);
    }

    on(type: string, layerOrHandler: string | ((...args: any[]) => void), handler?: (...args: any[]) => void) {
      const key = typeof layerOrHandler === "string" ? `${type}:${layerOrHandler}` : type;
      const callback = typeof layerOrHandler === "function" ? layerOrHandler : handler!;
      this.handlers.set(key, [...(this.handlers.get(key) || []), callback]);
      return this;
    }

    emit(type: string, event: Record<string, unknown> = {}) {
      if (type === "load") this.styleLoaded = true;
      for (const handler of this.handlers.get(type) || []) handler(event);
    }

    addSource(id: string) {
      this.sources.set(id, new Source());
    }

    getSource(id: string) {
      return this.sources.get(id);
    }

    addLayer(layer: { id: string }) {
      this.layers.add(layer.id);
    }

    getLayer(id: string) {
      return this.layers.has(id) ? { id } : undefined;
    }

    isStyleLoaded() {
      return this.styleLoaded;
    }
  }

  class Popup {
    remove = vi.fn();
    setLngLat = vi.fn(() => this);
    setDOMContent = vi.fn(() => this);
    addTo = vi.fn(() => this);
  }

  return {
    Map,
    Popup,
    NavigationControl: class {},
    setWorkerUrl: vi.fn(),
  };
});

vi.mock("maplibre-gl", () => maplibreMock);

import MapComponent from "@/components/map/MapComponent";
import type { Alert } from "@/lib/api/schemas";

const emptyStyle = { version: 8, sources: {}, layers: [] };

function successfulFetch(input: RequestInfo | URL): Promise<Response> {
  const url = String(input);
  if (url.endsWith("maplibre-gl-worker.js") || url.endsWith("maplibre-gl-shared.mjs")) {
    return Promise.resolve(
      new Response("export {}", { headers: { "content-type": "application/javascript" } }),
    );
  }
  return Promise.resolve(
    new Response(JSON.stringify(emptyStyle), {
      headers: { "content-type": "application/json" },
    }),
  );
}

const validAlert: Alert = {
  id: 7,
  title: "Flood advisory",
  description: "River levels are rising.",
  hazard_type: "flood",
  normalized_severity: "high",
  status: "active",
  locations: [
    {
      latitude: 31.5204,
      longitude: 74.3587,
      city: "Lahore",
    },
  ],
};

async function loadMap(ui: ReactElement) {
  const rendered = render(ui);
  await waitFor(() => expect(maplibreMock.Map.instances.length).toBe(1));
  const map = maplibreMock.Map.instances[0];
  act(() => {
    map.emit("style.load");
    map.emit("load");
  });
  return { ...rendered, map };
}

describe("MapComponent lifecycle", () => {
  beforeEach(() => {
    maplibreMock.Map.instances.length = 0;
    maplibreMock.setWorkerUrl.mockClear();
    vi.stubGlobal("fetch", vi.fn(successfulFetch));
    vi.stubGlobal("WebGLRenderingContext", class WebGLRenderingContext {});
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({} as RenderingContext);
  });

  test("initializes once and renders the basemap with zero alerts", async () => {
    const { map, getByLabelText } = await loadMap(<MapComponent alerts={[]} />);
    expect(maplibreMock.setWorkerUrl).toHaveBeenCalledWith("/maplibre-gl-worker.js");
    expect(map.options).toMatchObject({ minZoom: 5, maxZoom: 12, center: [69.3451, 30.3753] });
    expect(map.sources.has("alerts")).toBe(true);
    expect(getByLabelText("Interactive disaster alert map").parentElement).toHaveAttribute(
      "data-map-feature-count",
      "0",
    );
  });

  test("alert and search updates do not recreate the map", async () => {
    const { map, rerender } = await loadMap(<MapComponent alerts={[]} />);
    const source = map.sources.get("alerts")!;

    rerender(
      <MapComponent
        alerts={[validAlert]}
        selectedCityCoords={{ lat: 31.5204, lng: 74.3587 }}
      />,
    );

    await waitFor(() => expect(source.setData).toHaveBeenCalled());
    expect(map.flyTo).toHaveBeenCalledTimes(1);
    expect(maplibreMock.Map.instances).toHaveLength(1);
  });

  test("an initial URL-backed city selection flies after asynchronous map load", async () => {
    const { map } = await loadMap(
      <MapComponent
        alerts={[]}
        selectedCityCoords={{ lat: 31.5204, lng: 74.3587 }}
      />,
    );
    await waitFor(() =>
      expect(map.flyTo).toHaveBeenCalledWith(
        expect.objectContaining({ center: [74.3587, 31.5204], zoom: 11 }),
      ),
    );
    expect(maplibreMock.Map.instances).toHaveLength(1);
  });

  test("ResizeObserver resizes the stable map", async () => {
    const { map } = await loadMap(<MapComponent alerts={[]} />);
    const observer = (ResizeObserver as unknown as { instances: Array<{ trigger(): void }> }).instances.at(-1);
    act(() => observer?.trigger());
    expect(map.resize).toHaveBeenCalled();
  });

  test("reset stops motion and restores the Pakistan view", async () => {
    const { map } = await loadMap(<MapComponent alerts={[]} />);
    fireEvent.click(screen.getByRole("button", { name: /reset map view/i }));
    expect(map.stop).toHaveBeenCalledOnce();
    expect(map.jumpTo).toHaveBeenCalledWith({ center: [69.3451, 30.3753], zoom: 5.8 });
  });

  test("requests browser fullscreen without recreating the map", async () => {
    const { map, container } = await loadMap(<MapComponent alerts={[]} />);
    const root = container.querySelector(".map-shell") as HTMLDivElement;
    root.requestFullscreen = vi.fn().mockResolvedValue(undefined);
    fireEvent.click(screen.getByRole("button", { name: /toggle map fullscreen/i }));
    await waitFor(() => expect(root.requestFullscreen).toHaveBeenCalledOnce());
    expect(maplibreMock.Map.instances).toHaveLength(1);
    expect(map.resize).toHaveBeenCalled();
  });
});
