#!/usr/bin/env bun
/**
 * Preview a markdown file in the browser
 * Usage: bun PreviewMarkdown.ts <path-to-markdown>
 */

import { writeFile, mkdtemp, readFile } from "fs/promises";
import { join, basename } from "path";
import { tmpdir } from "os";
import { $ } from "bun";

const mdPath = process.argv[2];
if (!mdPath) {
  console.error("Usage: bun PreviewMarkdown.ts <path-to-markdown>");
  process.exit(1);
}

const content = await readFile(mdPath, "utf-8");
const title = basename(mdPath, ".md");

const tempDir = await mkdtemp(join(tmpdir(), "pai-preview-"));
const htmlPath = join(tempDir, "preview.html");

const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
  <style>
    body {
      max-width: 800px;
      margin: 40px auto;
      padding: 20px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.7;
      color: #1a1a1a;
      background: #fafafa;
    }
    h1 { color: #111; font-size: 2.2em; margin-bottom: 0.5em; }
    h2 { color: #333; border-bottom: 1px solid #ddd; padding-bottom: 0.3em; margin-top: 1.5em; }
    pre { background: #2d2d2d; color: #ccc; padding: 16px; overflow-x: auto; border-radius: 6px; }
    code { background: #e8e8e8; padding: 2px 6px; border-radius: 3px; font-size: 0.9em; }
    pre code { padding: 0; background: none; }
    blockquote { border-left: 4px solid #3b82f6; margin: 0; padding-left: 20px; color: #555; }
    strong { color: #000; }
    hr { border: none; border-top: 1px solid #ddd; margin: 2em 0; }
  </style>
</head>
<body>
  <div id="content"></div>
  <script>
    document.getElementById('content').innerHTML = marked.parse(${JSON.stringify(content)});
  </script>
</body>
</html>`;

await writeFile(htmlPath, html);
await $`open ${htmlPath}`.quiet();

console.log(JSON.stringify({
  success: true,
  url: `file://${htmlPath}`,
  path: htmlPath
}, null, 2));
