import test from "node:test";
import assert from "node:assert/strict";
import { fittedImageSize, rotatedImageBounds, rotationContainScale } from "../src/actions/image-display-size.mjs";

test("shrink contains without enlarging",()=>{
  assert.deepEqual(fittedImageSize(2000,1000,800,600,"shrink"),{width:800,height:400,scale:.4});
  assert.deepEqual(fittedImageSize(200,100,800,600,"shrink"),{width:200,height:100,scale:1});
});

test("fit modes preserve aspect ratio",()=>{
  assert.deepEqual(fittedImageSize(400,200,300,500,"width"),{width:300,height:150,scale:.75});
  assert.deepEqual(fittedImageSize(400,200,300,500,"height"),{width:1000,height:500,scale:2.5});
  assert.deepEqual(fittedImageSize(400,200,300,500,"actual"),{width:400,height:200,scale:1});
});

test("straighten containment shrinks rotated bounds so every corner remains visible",()=>{
  const width=1000,height=500,degrees=15;
  const bounds=rotatedImageBounds(width,height,degrees);
  const scale=rotationContainScale(width,height,degrees);
  assert.ok(scale < 1);
  assert.ok(bounds.width * scale <= width);
  assert.ok(bounds.height * scale <= height);
});

test("straighten containment works symmetrically and leaves axis-aligned images alone",()=>{
  assert.equal(rotationContainScale(800,600,0),1);
  assert.equal(rotationContainScale(800,600,180),1);
  assert.ok(Math.abs(rotationContainScale(1000,500,12)-rotationContainScale(1000,500,-12)) < 1e-12);
});
