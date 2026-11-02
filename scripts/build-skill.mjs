// Builds the Claude skill: SKILL.md, one bundled render script, the part
// catalog and a standalone viewer, zipped as sketchy-skill-<version>.zip. The skill draws in the Claude chat without a server.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";

const root = new URL("../", import.meta.url).pathname;
const out = `${root}build/skill/sketchy`;
const scripts = `${out}/scripts`;
const pkg = JSON.parse(readFileSync(`${root}package.json`, "utf8"));

rmSync(`${root}build/skill`, { recursive: true, force: true });
mkdirSync(scripts, { recursive: true });

// Everything goes into one file: skill uploads reject paths such as
// node_modules/@iconify-json, so no package folders ship. The modules our
// code loads through createRequire are swapped for static imports.
const shim = `
import lucide from "@iconify-json/lucide/icons.json";
import simpleIcons from "@iconify-json/simple-icons/icons.json";
import elk from "elkjs/lib/elk.bundled.js";
const modules = {
  "@iconify-json/lucide/icons.json": lucide,
  "@iconify-json/simple-icons/icons.json": simpleIcons,
  "elkjs/lib/elk.bundled.js": elk,
};
export function createRequire() {
  const require = (id) => {
    if (!(id in modules)) throw new Error("Not bundled: " + id);
    return modules[id];
  };
  // sql.js loads its WebAssembly from next to the bundle.
  require.resolve = () => new URL("./sql-wasm.wasm", import.meta.url).pathname;
  return require;
}`;
await esbuild({
  entryPoints: [`${root}skill/render.ts`],
  outfile: `${scripts}/render.mjs`,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  // Bundled CommonJS (sql.js) still uses require and __dirname.
  banner: {
    js: [
      'import { createRequire as __createRequire } from "node:module";',
      "const require = __createRequire(import.meta.url);",
      'const __dirname = new URL(".", import.meta.url).pathname;',
    ].join(" "),
  },
  plugins: [
    {
      name: "bundle-runtime-requires",
      setup(build) {
        build.onResolve({ filter: /^node:module$/ }, (args) =>
          args.importer.startsWith(`${root}src/`) ? { path: "shim", namespace: "shim" } : undefined,
        );
        build.onLoad({ filter: /.*/, namespace: "shim" }, () => ({
          contents: shim,
          resolveDir: root,
          loader: "js",
        }));
      },
    },
  ],
  logLevel: "warning",
});
cpSync(`${root}node_modules/sql.js/dist/sql-wasm.wasm`, `${scripts}/sql-wasm.wasm`);

await viteBuild({
  configFile: `${root}vite.config.ts`,
  logLevel: "warn",
  build: {
    outDir: `${root}build/skill/viewer`,
    emptyOutDir: true,
    rollupOptions: { input: `${root}viewer/standalone.html` },
  },
});
cpSync(`${root}build/skill/viewer/standalone.html`, `${scripts}/viewer.html`);
rmSync(`${root}build/skill/viewer`, { recursive: true });
cpSync(`${root}build/parts.json`, `${scripts}/parts.json`);
// Widgets load the browser bundle from jsDelivr. By default the skill pins one
// exact build: a commit on the cdn branch (SKETCHY_CDN_REF, set by the release
// workflow) plus a Subresource Integrity hash of the bundle built here, so the
// browser refuses to run anything else, even if the cdn branch changes later.
// SKETCHY_CDN_CHANNEL=minor restores upstream's auto-updating behavior (no
// integrity check; every patch release reaches installed skills unreviewed).
const repo = process.env.SKETCHY_REPO ?? "ddkbs/sketchy";
const channel = process.env.SKETCHY_CDN_CHANNEL ?? "pinned";
let scriptTag;
if (channel === "minor") {
  const minor = pkg.version.split(".").slice(0, 2).join(".");
  scriptTag = `<script src="https://cdn.jsdelivr.net/gh/${repo}@cdn/${minor}/sketchy.js"></script>`;
} else if (channel === "pinned") {
  const bundle = `${root}build/web/sketchy.js`;
  if (!existsSync(bundle)) throw new Error("Run `npm run build:web` before `npm run build:skill`.");
  const ref = process.env.SKETCHY_CDN_REF ?? "cdn";
  if (!/^[0-9a-f]{40}$/.test(ref))
    console.warn(
      `skill: SKETCHY_CDN_REF is "${ref}", not a commit hash. The integrity check still ` +
        "blocks tampered code, but a changed branch breaks the skill instead of being ignored.",
    );
  const integrity = `sha384-${createHash("sha384").update(readFileSync(bundle)).digest("base64")}`;
  const src = `https://cdn.jsdelivr.net/gh/${repo}@${ref}/${pkg.version}/sketchy.js`;
  scriptTag = `<script src="${src}" integrity="${integrity}" crossorigin="anonymous"></script>`;
} else {
  throw new Error(`SKETCHY_CDN_CHANNEL must be "pinned" or "minor", not "${channel}".`);
}
writeFileSync(
  `${out}/SKILL.md`,
  readFileSync(`${root}skill/SKILL.md`, "utf8").replaceAll("{{SCRIPT}}", scriptTag),
);
cpSync(`${root}LICENSE`, `${out}/LICENSE`);

const zip = `${root}sketchy-skill-${pkg.version}.zip`;
rmSync(zip, { force: true });
execFileSync("zip", ["-qr", zip, "sketchy"], { cwd: `${root}build/skill` });
console.log(`skill: wrote ${zip}`);
