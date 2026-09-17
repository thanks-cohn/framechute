import test from "node:test";
import assert from "node:assert/strict";
import { commandsForEditorContext } from "../src/actions/context-menu-model.mjs";
import { readFile } from "node:fs/promises";

test("PDF context menu exposes page/margin guide visibility and reset",()=>{
  const visible=commandsForEditorContext({editorKind:"pdf",selectionKind:"page",block:{dataset:{pdfEditMode:"on"}}});
  const hidden=commandsForEditorContext({editorKind:"pdf",selectionKind:"page",block:{dataset:{pdfEditMode:"on",pdfGuidesHidden:"true"}}});
  assert.equal(visible.find(item=>item.id==="toggle-page-guides")?.label,"Page / Margin Guides  [ ON ]");
  assert.equal(hidden.find(item=>item.id==="toggle-page-guides")?.label,"Page / Margin Guides  [ OFF ]");
  assert.equal(visible.find(item=>item.id==="reset-page-guides")?.label,"Reset Page / Margin Guides");
});

test("responsive PDF chrome keeps essentials visible and groups secondary tools",async()=>{
  const source=await readFile(new URL("../src/pdf-popdowns.js",import.meta.url),"utf8");
  assert.match(source,/pdf-toolbar-row-primary/);
  assert.match(source,/pdf-toolbar-row-secondary/);
  assert.match(source,/pdf-file-menu/);
  assert.match(source,/PAGE EDGE · content outside is clipped/);
  assert.match(source,/framechute:pdf-toggle-guides/);
  assert.match(source,/terminal line fragments/);
});
