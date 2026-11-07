import crypto from "node:crypto";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_EXECUTABLE,
  headless: true,
  args: ["--no-sandbox"],
});
const root = "docs/econ-sim/round4-3-1",
  url =
    process.env.REPORT_URL || "http://127.0.0.1:5174/" + root + "/report.html",
  expected = JSON.parse(await fs.readFile(root + "/summary.json")),
  errors = [],
  results = [];
async function ready(p) {
  await p.waitForFunction(
    () => document.body.dataset.ready === "true" || window.report431Error,
    undefined,
    { timeout: 120000 },
  );
  assert.equal(await p.evaluate(() => window.report431Error ?? null), null);
}
async function check(p) {
  assert.equal(await p.locator("#charts svg").count(), 8);
  assert.equal(await p.locator("#grid button").count(), 18);
  assert.equal(await p.locator("#annual tbody tr").count(), 20);
  assert.equal(await p.locator("#tax-table tbody tr").count(), 6);
  assert.ok(
    await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  );
  assert.equal(
    await p
      .locator("#charts path")
      .evaluateAll((es) =>
        es.some((e) => /NaN|undefined|Infinity/.test(e.getAttribute("d"))),
      ),
    false,
  );
  assert.ok(
    await p.locator("#charts svg text").evaluateAll((es) =>
      es.every((e) => {
        const b = e.getBBox();
        return b.x >= -0.5 && b.x + b.width <= 600.5;
      }),
    ),
    "SVG labels within bounds",
  );
  assert.ok(
    await p.locator("select,button,summary").evaluateAll((es) =>
      es
        .map((e) => e.getBoundingClientRect().height)
        .filter((h) => h > 0)
        .every((h) => h >= 43.9),
    ),
  );
}
try {
  await fs.mkdir(root + "/screenshots", { recursive: true });
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 844, height: 390 },
    { width: 667, height: 375 },
    { width: 390, height: 844 },
  ]) {
    const context = await browser.newContext({
        viewport,
        hasTouch: viewport.width < 1000,
        isMobile: viewport.width < 1000,
        acceptDownloads: true,
      }),
      p = await context.newPage(),
      requests = [];
    p.on("pageerror", (e) => errors.push(String(e)));
    p.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    p.on("request", (r) => {
      if (/^https?:/.test(r.url())) requests.push(r.url());
    });
    assert.equal(
      (await p.goto(url, { waitUntil: "domcontentloaded" })).status(),
      200,
    );
    await ready(p);
    await check(p);
    assert.equal(await p.evaluate(() => report431.summary.totalRuns), 3660);
    assert.equal(
      await p.evaluate(() => document.body.dataset.path),
      "half/self/E2-S/moon",
    );
    const first = expected.cases.find(
      (c) =>
        c.taxMode === "half" &&
        c.lane === "self" &&
        c.scenario === "E2-S" &&
        c.enabled,
    );
    assert.equal(
      await p.evaluate(() => current431.body.reserveEnd.waterQ),
      first.bodies.moon.reserveEnd.waterQ,
    );
    assert.equal(
      await p.evaluate(() => current431.body.firstFill.water.maximumMonth),
      first.bodies.moon.firstFill.water.maximumMonth,
    );
    await p.screenshot({
      path: root + `/screenshots/initial-${viewport.width}.png`,
    });
    await p.locator("#tax").selectOption("full");
    await p.locator("#planet").selectOption("mars");
    const press = async (selector) =>
      viewport.width < 1000
        ? p.locator(selector).tap()
        : p.locator(selector).click();
    await press('[data-lane="relief"]');
    await press("details summary");
    await press('[data-scenario="E5-M-L70-S12-D2"]');
    assert.equal(
      await p.evaluate(() => document.body.dataset.path),
      "full/relief/E5-M-L70-S12-D2/mars",
    );
    await check(p);
    await p.locator("#scenario").selectOption("H-CUT-moon-M12-L100");
    await p.locator("#planet").selectOption("moon");
    assert.equal(await p.locator("#charts svg rect").count(), 8);
    assert.equal(
      await p.evaluate(() => current431.case.cut.normalElectrolysisU),
      0,
    );
    const want = expected.cases.find(
      (c) =>
        c.taxMode === "full" &&
        c.lane === "relief" &&
        c.scenario === "H-CUT-moon-M12-L100" &&
        c.enabled,
    );
    for (const key of [
      "waterMinimum",
      "oxygenMinimum",
      "netFiscalC",
      "populationEnd",
    ])
      assert.equal(
        await p.evaluate((k) => current431.body[k], key),
        want.bodies.moon[key],
      );
    await check(p);
    await p.screenshot({
      path: root + `/screenshots/selected-${viewport.width}.png`,
      fullPage: true,
    });
    await p.locator("#scenario").selectOption("H-CUT-CONTROL");
    assert.equal(await p.locator("#charts svg rect").count(), 0);
    await p.locator("#tax").selectOption("zero");
    await p.locator("#scenario").selectOption("E2-S");
    assert.equal(await p.evaluate(() => current431.body.taxC), 0);
    assert.ok((await p.locator("#tax-table").innerText()).includes("12.5%"));
    const downloadPromise = p.waitForEvent("download");
    await press("#export");
    const download = await downloadPromise,
      buf = await fs.readFile(await download.path()),
      exported = JSON.parse(buf);
    assert.equal(exported.body.taxC, 0);
    assert.equal(exported.rows.length, 241);
    const hash = await p.evaluate(() => report431.build);
    for (const file of [
      "summary.json",
      "run-source-manifest.json",
      "performance.json",
    ])
      assert.equal(
        hash[file],
        crypto
          .createHash("sha256")
          .update(await fs.readFile(root + "/" + file))
          .digest("hex"),
      );
    assert.deepEqual(requests, [url]);
    results.push({
      viewport,
      touch: viewport.width < 1000,
      charts: 8,
      grid: 18,
      annualRows: 20,
      selectors: true,
      pairedData: true,
      export: true,
      noRootOverflow: true,
      requests: requests.length,
    });
    await context.close();
  }
  // Deliver the saved HTML alone; refuse any other HTTP request.
  const ctx = await browser.newContext(),
    p = await ctx.newPage(),
    html = await fs.readFile(root + "/report.html");
  let external = 0;
  p.on("pageerror", (e) => errors.push(String(e)));
  await ctx.route("**/*", async (route) => {
    if (route.request().url() === "http://offline.local/report.html")
      await route.fulfill({
        status: 200,
        contentType: "text/html",
        body: html,
      });
    else {
      external++;
      await route.abort();
    }
  });
  await p.goto("http://offline.local/report.html");
  await ready(p);
  await check(p);
  assert.equal(external, 0);
  await ctx.close();
  assert.deepEqual(errors, []);
  await fs.writeFile(
    root + "/browser-verification.json",
    JSON.stringify(
      {
        browser: browser.version(),
        htmlSHA256: crypto.createHash("sha256").update(html).digest("hex"),
        results,
        offlineExternalRequests: external,
        errors,
        scope:
          "Chromium desktop/touch emulation of offline report. Game browser regression, physical devices, Safari/Firefox and native file:// policy not tested.",
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    JSON.stringify({
      passed: true,
      browser: browser.version(),
      viewports: results.length,
      offlineExternalRequests: external,
      errors,
    }),
  );
} finally {
  await browser.close();
}
