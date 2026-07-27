import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const baseUrl = process.env.ADVISORY_TEST_BASE_URL || "http://localhost:3000";
const chromePath =
  process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const screenshotPath =
  process.env.ADVISORY_TEST_SCREENSHOT ||
  "D:\\Codex\\pakistan-disaster-scraper-runtime\\advisory-information.png";
const mobileScreenshotPath = screenshotPath.replace(/\.png$/i, "-mobile.png");
const bulletinIndex = Number(process.env.ADVISORY_TEST_BULLETIN_INDEX || 0);

const browser = await chromium.launch({
  executablePath: chromePath,
  headless: true,
});

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  const failedRequests = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("requestfailed", (request) =>
    failedRequests.push(`${request.url()} ${request.failure()?.errorText || ""}`),
  );

  await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 60_000 });
  const bulletin = page
    .getByText("Flood Forecasting Division Bulletin", { exact: true })
    .nth(bulletinIndex);
  try {
    await bulletin.waitFor({ state: "visible", timeout: 30_000 });
  } catch (error) {
    process.stderr.write(
      `${JSON.stringify(
        {
          body: (await page.locator("body").innerText()).slice(0, 3000),
          errors,
          failedRequests,
        },
        null,
        2,
      )}\n`,
    );
    throw error;
  }
  const openStarted = Date.now();
  await bulletin.click();

  const dialog = page.getByRole("dialog", { name: /Advisory details/ });
  await dialog.waitFor({ state: "visible", timeout: 10_000 });
  const openMilliseconds = Date.now() - openStarted;
  await assert.doesNotReject(() =>
    dialog.getByRole("heading", { name: "Daily Flood Bulletin" }).waitFor(),
  );
  assert.ok(await dialog.getByRole("table").isVisible(), "river table is not visible");
  assert.ok(
    await dialog.getByRole("heading", { name: "Rainfall forecast" }).isVisible(),
    "rainfall forecast is not visible",
  );
  assert.ok(
    await dialog.getByRole("heading", { name: "Warning and expected impact" }).isVisible(),
    "warning panel is not visible",
  );
  assert.equal(
    await dialog.getByText(/GOVERNMENT OF PAKISTAN/).count(),
    0,
    "administrative footer leaked into the formatted view",
  );
  assert.equal(
    await dialog.getByText(/ORIGINAL SOURCE CONTENT/).count(),
    0,
    "raw text should remain lazy and collapsed",
  );
  assert.equal(errors.length, 0, `browser errors: ${errors.join("\n")}`);

  await dialog.screenshot({ path: screenshotPath });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(
    await dialog.locator('[data-testid="river-status-mobile"]').isVisible(),
    "mobile river cards are not visible",
  );
  assert.equal(
    await dialog.getByRole("table").isVisible(),
    false,
    "desktop river table should be hidden on mobile",
  );
  await dialog.screenshot({ path: mobileScreenshotPath });
  process.stdout.write(
    `${JSON.stringify(
      {
        title: await dialog.getByRole("heading", { name: "Daily Flood Bulletin" }).textContent(),
        bulletin: await dialog.getByText(/^Bulletin\s+\d/).first().textContent(),
        riverRows: await dialog.locator("tbody tr").count(),
        openMilliseconds,
        screenshotPath,
        mobileScreenshotPath,
      },
      null,
      2,
    )}\n`,
  );
} finally {
  await browser.close();
}
