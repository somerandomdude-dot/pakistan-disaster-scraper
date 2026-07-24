import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const assets = [
  {
    source: resolve(projectRoot, "node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs"),
    destination: resolve(projectRoot, "public/maplibre-gl-worker.js"),
  },
  {
    source: resolve(projectRoot, "node_modules/maplibre-gl/dist/maplibre-gl-shared.mjs"),
    destination: resolve(projectRoot, "public/maplibre-gl-shared.mjs"),
  },
];

for (const asset of assets) {
  await mkdir(dirname(asset.destination), { recursive: true });
  await copyFile(asset.source, asset.destination);
  console.log(`Prepared MapLibre worker asset: ${asset.destination}`);
}
