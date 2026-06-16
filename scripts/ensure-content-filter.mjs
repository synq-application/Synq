import { copyFileSync, existsSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const pairs = [
  ["src/lib/contentFilter.example.ts", "src/lib/contentFilter.ts"],
  ["functions/contentFilter.example.js", "functions/contentFilter.js"],
];

for (const [example, target] of pairs) {
  const examplePath = join(root, example);
  const targetPath = join(root, target);
  if (existsSync(targetPath)) continue;
  if (!existsSync(examplePath)) {
    console.warn(`[ensure-content-filter] missing template: ${example}`);
    continue;
  }
  copyFileSync(examplePath, targetPath);
  console.log(`[ensure-content-filter] created ${target} from ${example}`);
}

const tsPath = join(root, "src/lib/contentFilter.ts");
const jsPath = join(root, "functions/contentFilter.js");

if (!existsSync(tsPath)) {
  console.warn("[ensure-content-filter] no src/lib/contentFilter.ts — skip server sync");
  process.exit(0);
}

const tsSource = readFileSync(tsPath, "utf8");
const match = tsSource.match(/const BLOCKED_TERMS = \[([\s\S]*?)\];/);
if (!match) {
  console.warn("[ensure-content-filter] could not parse BLOCKED_TERMS from contentFilter.ts");
  process.exit(0);
}

const terms = [...match[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
const termsJs = terms.map((t) => `  "${t}"`).join(",\n");

const jsBody = `/** Server-side content filter (synced from src/lib/contentFilter.ts). */

const BLOCKED_TERMS = [
${termsJs},
];

const LEET_MAP = {
  "@": "a",
  "4": "a",
  "3": "e",
  "1": "i",
  "!": "i",
  "0": "o",
  $: "s",
  "5": "s",
  "7": "t",
};

function normalizeForFilter(input) {
  let s = String(input || "").toLowerCase();
  s = s.replace(/[\\s_\\-.*]+/g, "");
  s = s
    .split("")
    .map((ch) => LEET_MAP[ch] ?? ch)
    .join("");
  s = s.replace(/[^a-z0-9]/g, "");
  return s.replace(/(.)\\1{2,}/g, "$1$1");
}

function containsObjectionableContent(text) {
  const normalized = normalizeForFilter(text);
  if (!normalized) return false;
  return BLOCKED_TERMS.some((term) => normalized.includes(term));
}

function filterOrReject(text) {
  if (containsObjectionableContent(text)) {
    return {
      ok: false,
      reason: "This content isn't allowed on Synq. Please remove offensive language.",
    };
  }
  return { ok: true };
}

module.exports = {
  containsObjectionableContent,
  normalizeForFilter,
  filterOrReject,
};
`;

writeFileSync(jsPath, jsBody);
console.log(`[ensure-content-filter] synced ${terms.length} terms to functions/contentFilter.js`);

if (process.env.EAS_BUILD === "true" && terms.length === 0) {
  console.error(
    "[ensure-content-filter] EAS build aborted: src/lib/contentFilter.ts has an empty BLOCKED_TERMS list. " +
      "Populate the file locally before running eas build (see docs/APP_STORE_REVIEW_NOTES.md)."
  );
  process.exit(1);
}
