import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("PDF primary toolbar keeps secondary reader commands in More",async()=>{
  const html=await readFile(new URL("../src/workspace.html",import.meta.url),"utf8");
  const toolbar=html.match(/<div class="block-toolbar pdf-toolbar"[\s\S]*?<\/div><\/details><\/div><div class="pdf-search-box"/)?.[0]||"";
  const more=toolbar.match(/<details class="pdf-more-menu">[\s\S]*?<\/details>/)?.[0]||"";
  assert.match(more,/pdf-thumbnails/);
  assert.match(more,/pdf-outline/);
  assert.match(more,/pdf-properties/);
  assert.ok(toolbar.indexOf("pdf-search-toggle")<toolbar.indexOf("pdf-more-menu"));
});

test("PDF toolbar has a single-row narrow-block policy and contextual controls",async()=>{
  const [html,css]=await Promise.all([
    readFile(new URL("../src/workspace.html",import.meta.url),"utf8"),
    readFile(new URL("../src/workspace.css",import.meta.url),"utf8")
  ]);
  assert.match(html,/class="pdf-edit-controls" hidden/);
  assert.match(css,/\.pdf-toolbar \{[\s\S]*?flex-wrap: nowrap;/);
  assert.match(css,/@container \(max-width: 720px\)/);
  assert.match(css,/\.pdf-edit-controls\[hidden\] \{ display: none !important; \}/);
});

test("PDF toolbar enhancer normalizes on every invocation instead of trusting a dataset guard",async()=>{
  const source=await readFile(new URL("../src/pdf-popdowns.js",import.meta.url),"utf8");
  assert.doesNotMatch(source,/pdfResponsiveToolbar === "true"\) return/);
  assert.match(source,/querySelectorAll\(":scope > \.pdf-toolbar-row"\)/);
  assert.match(source,/toolbar\.replaceChildren\(primary, formatting, secondary\)/);
});

test("PDF editing uses one outline, plain Enter commit, and live field expansion",async()=>{
  const [source,css]=await Promise.all([readFile(new URL("../src/workspace.js",import.meta.url),"utf8"),readFile(new URL("../src/workspace.css",import.meta.url),"utf8")]);
  assert.match(source,/item\.classList\.contains\("is-editing"\)/);
  assert.match(source,/event\.key==="Enter"&&!event\.shiftKey/);
  assert.match(source,/Math\.ceil\(text\.scrollWidth\+4\)/);
  assert.match(css,/\.pdf-text-item\.is-editing ~ \.pdf-interactive-outline/);
});
