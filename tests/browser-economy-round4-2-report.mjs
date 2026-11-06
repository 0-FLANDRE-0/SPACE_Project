import assert from "node:assert/strict";
import fs from "node:fs/promises";
const { chromium } = await import(
    process.env.PLAYWRIGHT_MODULE || "playwright"
  ),
  b = await chromium.launch({
    executablePath: process.env.CHROMIUM_EXECUTABLE,
    headless: true,
    args: ["--no-sandbox"],
  });
const root = "docs/econ-sim/round4-2",
  url =
    process.env.REPORT_URL ||
    "http://127.0.0.1:5174/docs/econ-sim/round4-2/report.html",
  errors = [],
  results = [],
  expected = JSON.parse(await fs.readFile(root + "/summary.json")),
  click = (p, s) =>
    p.viewportSize().width < 1000 ? p.locator(s).tap() : p.locator(s).click();
async function check(p) {
  assert.equal(await p.locator("#charts svg").count(), 6);
  assert.equal(
    await p.evaluate(() =>
      [...document.querySelectorAll("#charts path")].some((p) =>
        /NaN|undefined|Infinity/.test(p.getAttribute("d")),
      ),
    ),
    false,
  );
  assert.ok(
    await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  );
  assert.equal(await p.locator("#grid button").count(), 18);
  const sizes = await p
    .locator("button,select,summary")
    .evaluateAll((es) =>
      es
        .filter((e) => e.getBoundingClientRect().height > 0)
        .map((e) => e.getBoundingClientRect().height),
    );
  assert.ok(sizes.every((h) => h >= 43.9));
}
try {
  await fs.mkdir(root + "/screenshots", { recursive: true });
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 844, height: 390 },
    { width: 667, height: 375 },
    { width: 390, height: 844 },
  ]) {
    const c = await b.newContext({
        viewport,
        hasTouch: viewport.width < 1000,
        isMobile: viewport.width < 1000,
        acceptDownloads: true,
      }),
      p = await c.newPage(),
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
    await p.waitForFunction(
      () => document.body.dataset.ready === "true" || window.report42Error,
      undefined,
      { timeout: 120000 },
    );
    assert.equal(await p.evaluate(() => window.report42Error ?? null), null);
    await check(p);
    assert.equal(
      await p.evaluate(() => report42.summary.selfPassing),
      expected.selfPassing,
    );
    assert.equal(
      await p.evaluate(() => report42.summary.reliefPassing),
      expected.reliefPassing,
    );
    assert.match(await p.locator("#answer").innerText(), /공통|기반/);
    await p.screenshot({
      path: `${root}/screenshots/report-initial-${viewport.width}.png`,
    });
    const choose = await p.evaluate(
      () => report42.choices.find((c) => c.baseId === "R4-N055").id,
    );
    await p.locator("#candidate").selectOption(choose);
    await click(p, '[data-lane="relief"]');
    await p.locator("#planet").selectOption("mars");
    await click(p, "details:has(#grid) summary");
    const last = "E5-M-L70-S12-D2";
    await click(p, `[data-scenario="${last}"]`);
    assert.equal(await p.locator("#scenario").inputValue(), last);
    assert.equal(
      await p.evaluate(() => document.body.dataset.path),
      choose + "/relief/" + last + "/mars",
    );
    await check(p);
    await p.locator("#scenario").selectOption("H-CUT-moon-M9-L100");
    await p.locator("#planet").selectOption("moon");
    assert.equal(await p.locator("#charts svg rect").count(), 6);
    assert.equal(await p.locator("#cut tbody tr").count(), 6);
    const before = expected.market.find(
      (r) =>
        r.id === choose &&
        r.lane === "relief" &&
        r.body === "moon" &&
        r.enabled,
    );
    const actual = await p.evaluate(
      () => currentReport42.market.find((r) => r.enabled).meanMarketPrice,
    );
    assert.ok(Math.abs(actual - before.meanMarketPrice) < 1e-12);
    await check(p);
    await p.screenshot({
      path: `${root}/screenshots/report-selected-${viewport.width}.png`,
      fullPage: true,
    });
    await p.evaluate(() =>
      window.scrollTo(0, document.documentElement.scrollHeight),
    );
    assert.ok(
      await p.evaluate(
        () =>
          scrollY + innerHeight >= document.documentElement.scrollHeight - 2,
      ),
    );
    if (viewport.width === 1440) {
      const got = p.waitForEvent("download");
      await click(p, "#export-summary");
      const download = await got;
      await download.saveAs(root + "/logs/exported-summary.json");
      const x = JSON.parse(
        await fs.readFile(root + "/logs/exported-summary.json"),
      );
      assert.equal(x.candidate.id, choose);
    }
    assert.deepEqual(requests, [url]);
    results.push({
      viewport,
      charts: 6,
      gridButtons: 18,
      touch: viewport.width < 1000,
      requests: requests.length,
      rootHorizontalOverflow: false,
      numericalDataMatches: true,
    });
    await c.close();
    console.log("PASS report", viewport.width + "×" + viewport.height);
  }
  const c = await b.newContext({
      offline: true,
      viewport: { width: 1440, height: 900 },
    }),
    p = await c.newPage(),
    requests = [];
  p.on("pageerror", (e) => errors.push(String(e)));
  p.on("request", (r) => {
    if (/^https?:/.test(r.url())) requests.push(r.url());
  });
  await p.setContent(await fs.readFile(root + "/report.html", "utf8"), {
    waitUntil: "domcontentloaded",
  });
  await p.waitForFunction(
    () => document.body.dataset.ready === "true" || window.report42Error,
    undefined,
    { timeout: 120000 },
  );
  assert.equal(await p.evaluate(() => window.report42Error ?? null), null);
  await p.locator("#scenario").selectOption("H-CUT-earth-M9-L100");
  await p.locator("#planet").selectOption("earth");
  await check(p);
  assert.deepEqual(requests, []);
  await p.screenshot({ path: root + "/screenshots/report-offline.png" });
  await c.close();
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
            "standalone HTML bytes in an offline context; native file:// and physical mobile browsers not claimed",
        },
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    "PASS self-contained offline HTML, no network dependency or runtime/console errors",
  );
} finally {
  await b.close();
}
