import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const [html,css,workspace,toolbar]=await Promise.all([
  readFile(new URL("../src/workspace.html",import.meta.url),"utf8"),
  readFile(new URL("../src/workspace.css",import.meta.url),"utf8"),
  readFile(new URL("../src/workspace.js",import.meta.url),"utf8"),
  readFile(new URL("../src/pdf-popdowns.js",import.meta.url),"utf8")
]);

test("toolbar contains one stable accessible Margins control and reset path",()=>{
  assert.equal((html.match(/class="pdf-margins-toggle"/g)||[]).length,1);
  assert.match(html,/pdf-margins-toggle[^>]+aria-pressed="false"/);
  assert.match(html,/Show or hide PDF layout margins\. Margin rules remain active while hidden\./);
  assert.equal((html.match(/class="pdf-reset-margins"/g)||[]).length,1);
});

test("responsive enhancement always normalizes exactly three rows",()=>{
  assert.match(toolbar,/pdf-toolbar-row-primary/);
  assert.match(toolbar,/pdf-toolbar-row-formatting/);
  assert.match(toolbar,/pdf-toolbar-row-secondary/);
  assert.match(toolbar,/existingRows=.*pdf-toolbar-row/);
  assert.match(toolbar,/toolbar\.replaceChildren\(primary, formatting, secondary\)/);
});

test("guide overlay is pointer transparent and only handles are active",()=>{
  assert.match(css,/\.pdf-margin-guide-layer[^}]+pointer-events:none/);
  assert.match(css,/\.pdf-margin-guide[^}]+pointer-events:none/);
  assert.match(css,/\.pdf-margin-handle[^}]+pointer-events:auto/);
});

test("workspace persists independent margin state and uses canonical constraints",()=>{
  assert.match(workspace,/pdfLayoutMargins:structuredClone/);
  assert.match(workspace,/marginState\.guidesVisible=!runtime\.marginState\.guidesVisible/);
  assert.match(workspace,/runtime\.marginState\.constraintsEnabled/);
  assert.match(workspace,/constrainTranslationToLayoutBounds/);
  assert.match(workspace,/constrainResizeToLayoutBounds/);
  assert.match(workspace,/reconcileEditableGeometryToContentBounds/);
});
