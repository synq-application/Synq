import { copyFileSync, existsSync } from "fs";
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
