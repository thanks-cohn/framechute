import test from "node:test";
import assert from "node:assert/strict";
import { copyContentToClipboard } from "../src/actions/content-copy.js";

test("content Copy writes supported binary data and reports what was copied",async()=>{
  const writes=[];class Item{static supports(type){return type==="application/pdf";}constructor(data){this.data=data;}}
  const result=await copyContentToClipboard({blob:new Blob(["pdf"],{type:"application/pdf"}),clipboard:{write:async value=>writes.push(value)},ClipboardItemClass:Item});
  assert.equal(result.ok,true);assert.equal(result.kind,"blob");assert.equal(writes[0][0].data["application/pdf"].size,3);assert.match(result.message,/application\/pdf content/);
});

test("content Copy truthfully falls back to useful text and never a filename",async()=>{
  let copied="";class Item{static supports(){return false;}}
  const result=await copyContentToClipboard({blob:new Blob(["pdf"],{type:"application/pdf"}),text:"Visible PDF text",clipboard:{writeText:async value=>{copied=value;}},ClipboardItemClass:Item});
  assert.equal(result.kind,"text");assert.equal(copied,"Visible PDF text");assert.match(result.message,/not supported/);
});

test("content Copy reports failure when neither binary nor text can be copied",async()=>{
  const result=await copyContentToClipboard({blob:new Blob(["x"],{type:"application/pdf"}),clipboard:{},ClipboardItemClass:null});
  assert.deepEqual(result,{ok:false,kind:"none",type:null,message:"Copy failed: this browser cannot copy this object's content, and no text fallback is available."});
});
