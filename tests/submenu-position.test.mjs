import test from "node:test";
import assert from "node:assert/strict";
import { submenuPosition } from "../src/submenu-position.mjs";

test("submenu stays attached, flips left, and clamps only vertically",()=>{
  assert.deepEqual(submenuPosition({left:20,right:120,top:30},{width:100,height:80},{width:500,height:400}),{left:124,top:30,opensLeft:false});
  assert.deepEqual(submenuPosition({left:380,right:480,top:350},{width:120,height:100},{width:500,height:400}),{left:256,top:292,opensLeft:true});
});
