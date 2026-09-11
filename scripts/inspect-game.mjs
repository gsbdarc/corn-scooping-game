import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";

await mkdir("references", { recursive: true });

const liveUrl = process.argv.find((arg) => arg.startsWith("--url="))?.slice(6);

if (process.argv.includes("--production") || liveUrl) {
  const { preview } = await import("vite");
  const server = liveUrl
    ? null
    : await preview({
        mode: process.argv.includes("--pages") ? "pages" : "production",
        preview: { host: "127.0.0.1", port: 4173, strictPort: true },
      });
  const gameUrl =
    liveUrl || new URL(server.config.base, "http://127.0.0.1:4173").href;
  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 960 },
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("requestfailed", (request) => errors.push(request.url()));
    page.on("response", (response) => {
      if (response.status() >= 400)
        errors.push(`${response.status()} ${response.url()}`);
      // A preview server may return index.html with status 200 for missing assets.
      if (
        /\.(webp|jpg|png|ttf|fbx)$/i.test(new URL(response.url()).pathname) &&
        response.headers()["content-type"]?.includes("text/html")
      ) {
        errors.push(`Asset returned HTML: ${response.url()}`);
      }
    });
    await page.goto(gameUrl);
    await page.waitForFunction(
      () => document.querySelector("#start")?.disabled === false,
      null,
      { timeout: 45000 },
    );
    await page.locator("#start").click();
    await page.keyboard.down("w");
    await page.waitForTimeout(1000);
    await page.keyboard.up("w");
    await page.keyboard.press("Escape");
    await page.locator("#quality").waitFor({ state: "visible" });
    const creditsUrl = await page
      .getByRole("link", { name: "References & credits" })
      .getAttribute("href");
    assert.equal(
      new URL(creditsUrl, gameUrl).href,
      new URL("credits.html", gameUrl).href,
    );
    const credits = await page.request.get(new URL(creditsUrl, gameUrl).href);
    assert.equal(credits.status(), 200);
    assert.match(
      await credits.text(),
      /References &amp; credits|References & credits/,
    );
    await page.evaluate(() => document.fonts.ready);
    assert.equal(
      await page.evaluate(
        () =>
          document.fonts.check('16px "DM Sans"') &&
          document.fonts.check('48px "Libre Caslon Display"'),
      ),
      true,
    );
    await page.locator('[data-action="resume"]').first().click();
    await page.screenshot({ path: "references/production-render.png" });
    assert.equal(
      await page.evaluate(() => typeof window.__arbuckle),
      "undefined",
    );
    assert.deepEqual(errors, []);
    console.log(
      `Production smoke passed at ${gameUrl}: assets, fonts, credits, start/walk/pause/resume work, no debug interface or browser errors.`,
    );
  } finally {
    await browser.close();
    if (server)
      await new Promise((resolve, reject) =>
        server.httpServer.close((error) => (error ? reject(error) : resolve())),
      );
  }
  process.exit(0);
}

const browser = await chromium.launch({ headless: true, channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
page.on("console", (message) => {
  if (["error", "warning"].includes(message.type()))
    console.log(message.type(), message.text().slice(0, 300));
});
page.on("pageerror", (error) => console.log("PAGEERROR", error.message));
await page.goto("http://localhost:5173");
await page.waitForFunction(() => window.__arbuckle?.people, null, {
  timeout: 45000,
});
await page.waitForTimeout(1200);
console.log("START", await page.locator("#start").textContent());
console.log("STATE", await page.evaluate(() => window.__arbuckle?.state()));
const people = await page.evaluate(() =>
  window.__arbuckle?.inspectPeople()?.slice(0, 1),
);
await writeFile(
  "references/people-inspection.json",
  JSON.stringify(people, null, 2),
);
await page.screenshot({ path: "references/first-render.png" });
if (await page.locator("#start").isEnabled()) {
  await page.locator("#start").click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "references/walking-render.png" });
  await page.evaluate(() => {
    const camera = window.__arbuckle.camera;
    camera.position.set(0.4, 1.66, 6);
    camera.lookAt(7, 1.7, 6);
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: "references/dining-render.png" });
  const fps = await page.evaluate(
    () =>
      new Promise((resolve) => {
        let frames = 0;
        const start = performance.now();
        function sample(t) {
          frames++;
          if (t - start > 2000)
            resolve(Math.round((frames * 1000) / (t - start)));
          else requestAnimationFrame(sample);
        }
        requestAnimationFrame(sample);
      }),
  );
  console.log("OBSERVED_FPS", fps);
  await page.evaluate(() => window.__arbuckle.teleport("corn"));
  await page.keyboard.press("e");
  await page.waitForTimeout(1000);
  await page.screenshot({ path: "references/corn-render.png" });
}
await browser.close();
