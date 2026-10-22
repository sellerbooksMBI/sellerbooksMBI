import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];
const pass = (message) => console.log(`PASS ${message}`);
const fail = (message) => failures.push(message);

const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const index = read("index.html");

// Check local JS/CSS resources referenced by the production HTML. External URLs are ignored.
const localReferences = [];
for (const match of index.matchAll(/<(?:script|link)\b[^>]*?(?:src|href)\s*=\s*["']([^"']+)["'][^>]*>/gi)) {
  const url = match[1];
  if (/^(?:https?:)?\/\//i.test(url) || /^(?:data:|javascript:|mailto:)/i.test(url)) continue;
  const clean = url.split(/[?#]/, 1)[0];
  if (!/\.(?:js|css)$/i.test(clean)) continue;
  localReferences.push(clean);
}
const duplicates = localReferences.filter((value, i) => localReferences.indexOf(value) !== i);
if (duplicates.length) fail(`Duplicate local asset references: ${[...new Set(duplicates)].join(", ")}`);
else pass(`No duplicate local JS/CSS references (${localReferences.length} found)`);

for (const url of localReferences) {
  const relative = url.replace(/^\/+/, "");
  if (!fs.existsSync(path.join(root, relative))) fail(`Missing local asset: ${url}`);
}
if (!failures.some((message) => message.startsWith("Missing local asset:"))) {
  pass("Every local JS/CSS reference in index.html resolves to a file");
}

// Ensure the path-only moves remain byte-for-byte identical to their rollback copies.
const movedPairs = [
  ["js/legacy-01.js", "js/modules/reports/report-filters-and-dialogs.js"],
  ["js/legacy-02.js", "js/modules/reports/report-engine-legacy.js"],
  ["js/legacy-03.js", "js/modules/sales/packing-settings.js"],
  ["js/legacy-04.js", "js/services/library-loader.js"],
  ["js/legacy-05.js", "js/modules/analytics/client-analytics.js"],
  ["js/legacy-06.js", "js/modules/receivables/piutang-language.js"],
  ["js/legacy-07.js", "js/modules/receivables/piutang-local.js"],
  ["js/legacy-08.js", "js/modules/receivables/piutang-cloud.js"],
  ["js/legacy-09.js", "js/modules/support/contact-modal.js"],
  ["css/legacy-02.css", "css/modules/reports/report-overrides.css"],
  ["css/legacy-03.css", "css/modules/reports/product-analysis.css"],
];
for (const [rollbackPath, movedPath] of movedPairs) {
  if (!fs.existsSync(path.join(root, rollbackPath)) || !fs.existsSync(path.join(root, movedPath))) {
    fail(`Missing moved/rollback pair: ${rollbackPath} -> ${movedPath}`);
    continue;
  }
  if (read(rollbackPath) !== read(movedPath)) fail(`Moved file differs from rollback copy: ${movedPath}`);
}
if (!failures.some((message) => message.startsWith("Moved file differs") || message.startsWith("Missing moved/rollback pair"))) {
  pass(`All ${movedPairs.length} moved assets match their rollback copies byte-for-byte`);
}

// The HTML should load the organized paths, not the legacy script paths.
const staleScriptRefs = [...index.matchAll(/(?:src)\s*=\s*["']\/?js\/legacy-0[1-9]\.js["']/gi)].map((m) => m[0]);
if (staleScriptRefs.length) fail(`index.html still references legacy script paths: ${staleScriptRefs.join(", ")}`);
else pass("index.html uses organized paths for legacy JS modules");

// A small, dependency-light helper extraction from the main engine.
const mainSource = read("js/main.js");
const costFormatters = read("js/modules/costs/cost-formatters.js");
for (const name of ["formatCostCurrency", "formatCostDate"]) {
  if (!new RegExp(`function\\s+${name}\\s*\\(`).test(costFormatters)) fail(`Missing cost formatter in its module: ${name}`);
  if (new RegExp(`function\\s+${name}\\s*\\(`).test(mainSource)) fail(`Cost formatter still declared in main.js: ${name}`);
}
if (!failures.some((message) => message.includes("cost formatter"))) pass("Cost formatting helpers are isolated from main.js");

if (failures.length) {
  console.error("\nSTRUCTURE AUDIT FAILED");
  for (const message of failures) console.error(`- ${message}`);
  process.exitCode = 1;
} else {
  console.log("\nSTRUCTURE AUDIT PASSED");
}
