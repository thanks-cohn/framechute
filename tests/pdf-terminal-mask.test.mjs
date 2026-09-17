import test from "node:test";
import assert from "node:assert/strict";
import { semanticLiveSourceMasks } from "../src/documents/pdf-document.js";

function fixture() {
  const first={
    id:"source:p1:text:0",
    kind:"source-text-run",
    bounds:{x:10,y:20,width:40,height:12},
    metadata:{sourceIndex:0}
  };
  const last={
    id:"source:p1:text:1",
    kind:"source-text-run",
    bounds:{x:50,y:20,width:60,height:12},
    metadata:{sourceIndex:1}
  };
  const line={
    id:"line:p1:0",
    childIds:[first.id,last.id],
    bounds:{x:10,y:20,width:100,height:12}
  };
  return {
    line,
    layout:{nodes:[first,last],parent:id=>id===first.id||id===last.id?line:null}
  };
}

const edit=index=>({
  page:1,index,replacement:"changed",
  sourceX:index?50:10,sourceY:20,sourceWidth:index?60:40,sourceHeight:12,
  x:index?50:10,y:20,width:index?60:40,height:12,fontSize:10
});

test("terminal source mask gets bounded right-edge bleed beyond the semantic line",()=>{
  const {layout,line}=fixture();
  const [mask]=semanticLiveSourceMasks(layout,[edit(1)],1);
  const lineRight=line.bounds.x+line.bounds.width;

  assert.equal(mask.maskRole,"source-line");
  assert.equal(mask.terminalEdge,"right");
  assert.equal(mask.terminalBleed,6);
  assert.ok(mask.x+mask.width>lineRight+2.5,"terminal coverage must extend beyond ordinary line padding");
  assert.equal(mask.x+mask.width,118.5);
});

test("interior source mask stays bounded and does not borrow terminal bleed",()=>{
  const {layout}=fixture();
  const [mask]=semanticLiveSourceMasks(layout,[edit(0)],1);

  assert.equal(mask.terminalEdge,null);
  assert.equal(mask.terminalBleed,0);
  assert.equal(mask.x+mask.width,52.5,"interior coverage stops at its owned run plus ordinary padding");
});
