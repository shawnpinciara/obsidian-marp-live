import esbuild from "esbuild";
import process from "process";

const prod = process.argv[2] === "production";

const context = await esbuild.context({
  banner: { js: "/* Marp Presenta - Obsidian plugin */" },
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: ["obsidian", "electron", "fs", "path", "http", "url", "os"],
  format: "cjs",
  target: "es2020",
  logLevel: "info",
  loader: { ".css": "text" },
  sourcemap: prod ? false : "inline",
  treeShaking: true,
  outfile: "main.js",
  minify: prod,
});

if (prod) {
  await context.rebuild();
  process.exit(0);
} else {
  await context.watch();
}
