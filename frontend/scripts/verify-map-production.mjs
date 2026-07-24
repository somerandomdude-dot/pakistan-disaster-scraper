import assert from "node:assert/strict";
import { chromium, firefox } from "playwright-core";

const baseUrl = process.env.MAP_TEST_BASE_URL || "http://localhost:3000";
const chromePath =
  process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const screenshotPath =
  process.env.MAP_TEST_SCREENSHOT ||
  "D:\\Codex\\pakistan-disaster-scraper-runtime\\map-production.png";
const viewport = {
  width: Number(process.env.MAP_TEST_VIEWPORT_WIDTH || 1440),
  height: Number(process.env.MAP_TEST_VIEWPORT_HEIGHT || 1000),
};
const browserEngine = process.env.MAP_TEST_BROWSER_ENGINE || "chromium";
const forceOffline = process.env.MAP_TEST_FORCE_OFFLINE === "true";

const validAlert = {
  id: 999001,
  title: "Production map marker verification",
  description: "A deterministic browser-test advisory.",
  hazard_type: "flood",
  normalized_severity: "high",
  status: "active",
  source_url: "https://example.test/advisory",
  locations: [
    {
      id: 1,
      city: "Lahore",
      district: "Lahore District",
      province: "Punjab",
      latitude: 31.5204,
      longitude: 74.3587,
    },
  ],
};

async function openScenario(browser, alerts) {
  const page = await browser.newPage({ viewport });
  const consoleErrors = [];
  const failedRequests = [];
  const badResponses = [];
  const mapResponses = [];

  await page.route("**/api/v1/alerts/active**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(alerts),
      headers: { "Access-Control-Allow-Origin": "*" },
    }),
  );
  await page.route("**/api/v1/sources/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "[]",
      headers: { "Access-Control-Allow-Origin": "*" },
    }),
  );
  if (forceOffline) {
    await page.route("https://tiles.openfreemap.org/**", (route) =>
      route.fulfill({ status: 200, contentType: "text/plain", body: "offline test" }),
    );
  }

  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText || "";
    if (failure === "net::ERR_ABORTED" && request.url().includes("tiles.openfreemap.org")) {
      return;
    }
    failedRequests.push(`${request.resourceType()} ${request.url()} ${failure}`);
  });
  page.on("response", (response) => {
    const entry = {
      url: response.url(),
      status: response.status(),
      contentType: response.headers()["content-type"] || "",
    };
    if (response.status() >= 400 && !(forceOffline && entry.url.includes("tiles.openfreemap.org"))) {
      badResponses.push(entry);
    }
    if (
      entry.url.includes("openfreemap") ||
      entry.url.includes("maplibre-gl-worker") ||
      entry.url.includes("maplibre-gl-shared") ||
      entry.url.endsWith(".pbf")
    ) {
      mapResponses.push(entry);
    }
  });

  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
  const shell = page.locator(".map-shell");
  await shell.waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForFunction(
    () => document.querySelector(".map-shell")?.getAttribute("data-map-style-loaded") === "true",
    undefined,
    { timeout: 60_000 },
  );
  await page.waitForTimeout(2_000);

  return { page, shell, consoleErrors, failedRequests, badResponses, mapResponses };
}

const browserType = browserEngine === "firefox" ? firefox : chromium;
const browser = await browserType.launch({
  ...(browserEngine === "firefox"
    ? process.env.CHROME_PATH
      ? { executablePath: chromePath }
      : {}
    : { executablePath: chromePath }),
  headless: true,
  args:
    browserEngine === "firefox"
      ? []
      : ["--use-angle=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"],
});

try {
  const zero = await openScenario(browser, []);
  const zeroState = await zero.shell.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    const canvas = node.querySelector(".maplibregl-canvas");
    const hasMapLibreCss = Array.from(document.styleSheets).some((sheet) => {
      try {
        return Array.from(sheet.cssRules).some((rule) => rule.cssText.includes(".maplibregl-map"));
      } catch {
        return false;
      }
    });
    return {
      width: rect.width,
      height: rect.height,
      canvasWidth: canvas?.getBoundingClientRect().width || 0,
      canvasHeight: canvas?.getBoundingClientRect().height || 0,
      featureCount: Number(node.getAttribute("data-map-feature-count")),
      sourceLoaded: node.getAttribute("data-map-alert-source-loaded"),
      mapCount: document.querySelectorAll(".maplibregl-map").length,
      hasMapLibreCss,
    };
  });

  assert.equal(zeroState.featureCount, 0, "zero-alert scenario must contain an empty GeoJSON source");
  assert.equal(zeroState.sourceLoaded, "true", "alert source must load even when it is empty");
  assert.equal(zeroState.mapCount, 1, "MapLibre must initialize exactly once");
  assert.ok(zeroState.width > 0 && zeroState.height >= 500, "map container must have a real size");
  assert.ok(zeroState.canvasWidth > 0 && zeroState.canvasHeight >= 500, "map canvas must have a real size");
  assert.equal(zeroState.hasMapLibreCss, true, "MapLibre CSS must be present in the production bundle");
  assert.equal(zero.consoleErrors.length, 0, `console errors: ${zero.consoleErrors.join("\n")}`);
  assert.equal(zero.failedRequests.length, 0, `failed requests: ${zero.failedRequests.join("\n")}`);
  assert.equal(zero.badResponses.length, 0, `HTTP errors: ${JSON.stringify(zero.badResponses)}`);
  assert.ok(
    zero.mapResponses.some((response) => response.url.includes("maplibre-gl-worker.js")),
    "same-origin MapLibre worker was not requested",
  );
  assert.ok(
    zero.mapResponses.some((response) => response.url.includes("maplibre-gl-shared.mjs")),
    "MapLibre worker shared module was not requested",
  );
  if (!forceOffline) {
    assert.ok(
      zero.mapResponses.some((response) => response.url.endsWith(".pbf")),
      "no vector tile or glyph PBF request completed",
    );
  } else {
    assert.match(
      await zero.page.locator(".map-warning").textContent(),
      /Offline basemap active/i,
      "offline fallback warning was not shown",
    );
  }
  await zero.page.close();

  const marker = await openScenario(browser, [validAlert]);
  await marker.page.waitForFunction(
    () => document.querySelector(".map-shell")?.getAttribute("data-map-feature-count") === "1",
    undefined,
    { timeout: 15_000 },
  );
  assert.equal(await marker.shell.getAttribute("data-map-alert-source-loaded"), "true");

  const search = marker.page.getByRole("combobox", { name: "City / Location Search" });
  await search.fill("Lahore");
  const lahoreOption = marker.page.getByRole("option", { name: /Lahore/ });
  await lahoreOption.waitFor({ state: "visible" });
  await lahoreOption.click();
  await marker.page.waitForFunction(
    () => {
      const value = document.querySelector(".map-shell")?.getAttribute("data-map-center");
      if (!value) return false;
      const [lng, lat] = value.split(",").map(Number);
      return Math.abs(lng - 74.3587) < 0.01 && Math.abs(lat - 31.5204) < 0.01;
    },
    undefined,
    { timeout: 15_000 },
  );

  await marker.page.getByRole("button", { name: "Reset map view to Pakistan center" }).click();
  await marker.page.waitForFunction(
    () => document.querySelector(".map-shell")?.getAttribute("data-map-center") === "69.3451,30.3753",
    undefined,
    { timeout: 10_000 },
  );

  const zoomIn = marker.page.locator(".maplibregl-ctrl-zoom-in");
  for (let index = 0; index < 16; index += 1) {
    if (!(await zoomIn.isEnabled())) break;
    await zoomIn.click({ force: true });
    await marker.page.waitForTimeout(100);
  }
  await marker.page.waitForTimeout(1_000);
  const finalZoom = Number(await marker.shell.getAttribute("data-map-zoom"));
  assert.ok(finalZoom <= 12, `maximum zoom was exceeded: ${finalZoom}`);
  assert.equal(await marker.shell.getAttribute("data-map-style-loaded"), "true");
  assert.equal(marker.consoleErrors.length, 0, `console errors: ${marker.consoleErrors.join("\n")}`);
  assert.equal(marker.failedRequests.length, 0, `failed requests: ${marker.failedRequests.join("\n")}`);
  assert.equal(marker.badResponses.length, 0, `HTTP errors: ${JSON.stringify(marker.badResponses)}`);

  await marker.page.screenshot({ path: screenshotPath, fullPage: true });
  const result = {
    zeroAlertMap: zeroState,
    markerFeatureCount: Number(await marker.shell.getAttribute("data-map-feature-count")),
    searchCenter: "74.3587,31.5204",
    resetCenter: "69.3451,30.3753",
    maximumObservedZoom: finalZoom,
    mapResponses: marker.mapResponses.length,
    screenshotPath,
  };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  await marker.page.close();
} finally {
  await browser.close();
}
