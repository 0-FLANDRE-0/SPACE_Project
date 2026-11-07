import assert from "node:assert/strict";
import fs from "node:fs/promises";
const { chromium } = await import(
    process.env.PLAYWRIGHT_MODULE || "playwright"
  ),
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_EXECUTABLE,
    headless: true,
    args: ["--no-sandbox"],
  }),
  root = "docs/econ-sim/round4-2-1",
  url =
    process.env.REPORT_URL ||
    "http://127.0.0.1:5174/docs/econ-sim/round4-2-1/report.html",
  expected = JSON.parse(await fs.readFile(root + "/summary.json")),
  errors = [],
  results = [];
async function ready(p) {
  await p.waitForFunction(
    () => document.body.dataset.ready === "true" || window.report421Error,
    undefined,
    { timeout: 120000 },
  );
  assert.equal(await p.evaluate(() => window.report421Error ?? null), null);
}
async function check(p) {
  assert.equal(await p.locator("#charts svg").count(), 6);
  assert.equal(
    await p.evaluate(() =>
      [...document.querySelectorAll("#charts path")].some((e) =>
        /NaN|undefined|Infinity/.test(e.getAttribute("d")),
      ),
    ),
    false,
  );
  assert.ok(
    await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  );
  assert.equal(await p.locator("#grid button").count(), 18);
  const heights = await p
    .locator("button,select,summary")
    .evaluateAll((es) =>
      es.map((e) => e.getBoundingClientRect().height).filter((h) => h > 0),
    );
  assert.ok(heights.every((h) => h >= 43.9));
}
const press = (p, s) =>
  p.viewportSize().width < 1000 ? p.locator(s).tap() : p.locator(s).click();
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
    assert.equal(
      await p.evaluate(() => report421.summary.selfPassing),
      expected.selfPassing,
    );
    await p.screenshot({
      path: `${root}/screenshots/report-initial-${viewport.width}.png`,
    });
    const choose = await p.evaluate(() => report421.choices[0].id);
    await p.locator("#candidate").selectOption(choose);
    await press(p, '[data-lane="relief"]');
    await p.locator("#planet").selectOption("mars");
    await press(p, "details:has(#grid) summary");
    await press(p, '[data-scenario="E5-M-L70-S12-D2"]');
    assert.equal(
      await p.evaluate(() => document.body.dataset.path),
      choose + "/relief/E5-M-L70-S12-D2/mars",
    );
    await check(p);
    await p.locator("#scenario").selectOption("H-CUT-earth-M12-L100");
    await p.locator("#planet").selectOption("earth");
    assert.equal(await p.locator("#charts svg rect").count(), 6);
    assert.equal(await p.locator("#cut tbody tr").count(), 6);
    const want = expected.cutSummary.find(
      (r) =>
        r.id === choose &&
        r.lane === "relief" &&
        r.body === "earth" &&
        r.duration === 12 &&
        r.loss === 1,
    );
    const got = await p.evaluate(
      () =>
        current421.cuts.find((r) => r.duration === 12 && r.loss === 1)
          .minimumOnOffRatio,
    );
    assert.ok(Math.abs(got - want.minimumOnOffRatio) < 1e-12);
    await check(p);
    await p.screenshot({
      path: `${root}/screenshots/report-selected-${viewport.width}.png`,
      fullPage: true,
    });
    await p.locator("#scenario").selectOption("H-CUT-CONTROL");
    assert.equal(await p.locator("#charts svg rect").count(), 0);
    assert.equal(await p.locator("#production tbody tr").count(), 2);
    if (viewport.width === 1440) {
      const event = p.waitForEvent("download");
      await press(p, "#export");
      const d = await event;
      await d.saveAs(root + "/logs/exported-summary.json");
      assert.equal(
        JSON.parse(await fs.readFile(root + "/logs/exported-summary.json"))
          .candidate.id,
        choose,
      );
    }
    await p.evaluate(() =>
      window.scrollTo(0, document.documentElement.scrollHeight),
    );
    assert.ok(
      await p.evaluate(
        () =>
          scrollY + innerHeight >= document.documentElement.scrollHeight - 2,
      ),
    );
    assert.deepEqual(requests, [url]);
    results.push({
      viewport,
      charts: 6,
      grid: 18,
      touch: viewport.width < 1000,
      requests: requests.length,
      horizontalOverflow: false,
      valuesMatch: true,
    });
    await context.close();
    console.log("PASS report", viewport.width + "×" + viewport.height);
  }
  const context = await browser.newContext({
      offline: true,
      viewport: { width: 1440, height: 900 },
    }),
    p = await context.newPage(),
    requests = [];
  p.on("pageerror", (e) => errors.push(String(e)));
  p.on("request", (r) => {
    if (/^https?:/.test(r.url())) requests.push(r.url());
  });
  await p.setContent(await fs.readFile(root + "/report.html", "utf8"), {
    waitUntil: "domcontentloaded",
  });
  await ready(p);
  await p.locator("#scenario").selectOption("H-CUT-mars-M6-L0");
  await p.locator("#planet").selectOption("mars");
  await check(p);
  assert.deepEqual(requests, []);
  await p.screenshot({ path: root + "/screenshots/report-offline.png" });
  await context.close();
  assert.deepEqual(errors, []);
  await fs.writeFile(
    root + "/logs/report-browser.json",
    JSON.stringify(
      {
        results,
        offline: {
          passed: true,
          externalRequests: 0,
          scope:
            "Standalone HTML bytes in network-disabled context. Native file://, physical mobile, Safari and Firefox not claimed.",
        },
        errors,
      },
      null,
      2,
    ),
  );
  console.log("PASS offline report without external dependencies");
} finally {
  await browser.close();
}
