// Gate helper: fails if `any` appears as a type in packages/engine/src or packages/ui/src.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const roots = [
  new URL("../packages/engine/src", import.meta.url).pathname,
  new URL("../packages/ui/src", import.meta.url).pathname,
];
const offenders = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (p.endsWith(".ts") || p.endsWith(".tsx")) {
      const lines = readFileSync(p, "utf8").split("\n");
      lines.forEach((line, i) => {
        if (/(?:[:<(,|&]\s*)any\b/.test(line) || /\bas\s+any\b/.test(line)) {
          offenders.push(`${p}:${i + 1}: ${line.trim()}`);
        }
      });
    }
  }
}
for (const root of roots) walk(root);
if (offenders.length) {
  console.error("`any` found:\n" + offenders.join("\n"));
  process.exit(1);
}
console.log("no-any check: clean");
