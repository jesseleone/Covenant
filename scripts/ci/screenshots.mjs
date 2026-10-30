// CI: screenshot every view of the given extensions, in light and dark.
//   node scripts/ci/screenshots.mjs <base-url> <out-dir> <slug,slug,…>
// Signs in as Jordan Reyes (analyst). A nav extension is captured at
// /x/<slug>; a deal tab on Project Larch and Project Osprey. Playwright is
// installed by the workflow for this step only (it isn't an app dependency).

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const [base, out, list] = process.argv.slice(2);
const slugs = (list ?? "").split(",").filter(Boolean);
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const shots = [];
const problems = [];
for (const scheme of ["light", "dark"]) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: scheme });
  const page = await context.newPage();
  page.on("pageerror", (e) => problems.push(`${scheme}: ${e.message}`));
  await page.request.post(`${base}/api/session`, { data: { userId: "u_jordan" } });
  for (const slug of slugs) {
    const manifest = JSON.parse(readFileSync(`extensions/${slug}/manifest.json`, "utf8"));
    const urls = manifest.placement === "nav" ? [`/x/${slug}`] : [`/deals/deal_larch/${slug}`, `/deals/deal_osprey/${slug}`];
    for (const url of urls) {
      await page.goto(base + url, { waitUntil: "networkidle" });
      await page.waitForTimeout(500);
      const file = `${slug}${url.startsWith("/deals/") ? `-${url.split("/")[2]}` : ""}-${scheme}.png`;
      await page.screenshot({ path: path.join(out, file), fullPage: true });
      if (await page.getByText(/hit a problem/).count()) problems.push(`${scheme}: ${slug} showed its error message at ${url}`);
      shots.push({ slug, url, scheme, file });
    }
  }
  await context.close();
}
await browser.close();
writeFileSync(path.join(out, "index.json"), JSON.stringify({ shots, problems }, null, 2));
console.log(`Captured ${shots.length} screenshots.`);
if (problems.length) console.log(`Problems:\n${problems.join("\n")}`);
