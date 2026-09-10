import test from "node:test";
import assert from "node:assert/strict";
import { documentDropRange, documentImageDropEffect, moveNodeToDropRange } from "../src/document-image-drag.mjs";

test("same document image drops move while cross-container drops copy",()=>{
  const docx={},pdf={};
  assert.equal(documentImageDropEffect({kind:"image",originKind:"docx",block:docx},"docx",docx),"move");
  assert.equal(documentImageDropEffect({kind:"image",originKind:"pdf",block:pdf},"pdf",pdf),"move");
  assert.equal(documentImageDropEffect({kind:"image",originKind:"docx",block:docx},"pdf",pdf),"copy");
});

test("DOCX movement inserts the same node at the resolved caret",()=>{
  const text={nodeType:3},editor={contains:node=>node===text};
  const range={startContainer:null,offset:null,inserted:null,setStart(node,offset){this.startContainer=node;this.offset=offset;},collapse(){},insertNode(node){this.inserted=node;},setStartAfter(node){this.after=node;}};
  const documentObject={caretPositionFromPoint:()=>({offsetNode:text,offset:3}),createRange:()=>range};
  const node={contains:()=>false};
  assert.equal(documentDropRange(documentObject,editor,10,20,node),range);
  assert.equal(moveNodeToDropRange(node,range),true);
  assert.equal(range.inserted,node);assert.equal(range.after,node);assert.equal(range.offset,3);
});

test("a caret inside the moving image is rejected",()=>{
  const child={},node={contains:value=>value===child},editor={contains:()=>true};
  const range={startContainer:child,cloneRange(){return this;}};
  assert.equal(documentDropRange({caretRangeFromPoint:()=>range},editor,0,0,node),null);
});
