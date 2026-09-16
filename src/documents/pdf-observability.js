import { validateFiniteRect } from "./pdf-geometry.js";

export const PDF_DIAGNOSTIC_SCHEMA_VERSION="1.0.0";
const STATE_NAMES=Object.freeze(["idle","hover","selected","editing","committed","rerendered"]);
const round=(n,digits=3)=>Math.round(n*10**digits)/10**digits;
const cleanText=value=>String(value??"").replace(/\s+/g," ").trim().slice(0,500);

let sequence=0;
export function createPdfEditId(prefix="edit") {
  const uuid=globalThis.crypto?.randomUUID?.();
  if(uuid)return `${prefix}:${uuid}`;
  sequence+=1;
  return `${prefix}:${Date.now().toString(36)}:${sequence.toString(36)}`;
}

/** Assign identity once, at ingestion/creation. Never aliases a source ID. */
export function ensurePdfEditIdentity(edit,{idFactory=createPdfEditId}={}) {
  if(!edit||typeof edit!=="object")throw new TypeError("A PDF edit object is required");
  if(!edit.id)edit.id=idFactory("edit");
  if(edit.index>=0&&!edit.sourceObjectId)edit.sourceObjectId=`source:p${edit.page}:text:${edit.index}`;
  if(!edit.versionState)edit.versionState="current";
  return edit;
}

export function currentPdfEdits(edits=[]) {
  const bySource=new Map(),free=[];
  for(const raw of edits){
    const edit=ensurePdfEditIdentity(raw);
    if(edit.versionState==="historical"||edit.versionState==="superseded")continue;
    if(edit.sourceObjectId){
      const prior=bySource.get(edit.sourceObjectId);
      if(prior){prior.versionState="superseded";prior.supersededBy=edit.id;edit.supersedes=prior.id;}
      bySource.set(edit.sourceObjectId,edit);
    }else free.push(edit);
  }
  return [...bySource.values(),...free].sort((a,b)=>Number(a.page)-Number(b.page)||String(a.id).localeCompare(String(b.id)));
}

export function createOwnedMask({id,ownerEditId,sourceObjectIds,maskRole,pdfRect}) {
  const errors=[];
  if(!ownerEditId)errors.push("ownerEditId");
  if(!Array.isArray(sourceObjectIds)||!sourceObjectIds.length)errors.push("sourceObjectIds");
  if(!maskRole)errors.push("maskRole");
  const geometry=validateFiniteRect(pdfRect,{space:"pdf-points"});
  if(errors.length||!geometry.ok)throw new TypeError(`Invalid PDF mask: ${[...errors,...geometry.errors.map(e=>e.code+":"+e.field)].join(", ")}`);
  return Object.freeze({id:id||`mask:${ownerEditId}:${maskRole}`,kind:"erase-mask",ownerEditId:String(ownerEditId),sourceObjectIds:Object.freeze(sourceObjectIds.map(String)),maskRole:String(maskRole),pdfRect:Object.freeze({...geometry.rect})});
}

export function intersectionRecord(left,right,{space="pdf-points"}={}) {
  const a=validateFiniteRect(left.rect||left,{space}),b=validateFiniteRect(right.rect||right,{space});
  if(!a.ok||!b.ok)return {ok:false,space,errors:[...a.errors,...b.errors]};
  const x=Math.max(a.rect.x,b.rect.x),y=Math.max(a.rect.y,b.rect.y);
  const r=Math.min(a.rect.x+a.rect.width,b.rect.x+b.rect.width),t=Math.min(a.rect.y+a.rect.height,b.rect.y+b.rect.height);
  const rect={x,y,width:Math.max(0,r-x),height:Math.max(0,t-y)};
  return {ok:true,space,rect,overlapArea:round(rect.width*rect.height)};
}

export function classifyPdfCollision(left,right) {
  const overlap=intersectionRecord(left,right,{space:left.coordinateSpace||right.coordinateSpace||"pdf-points"});
  if(!overlap.ok||!overlap.overlapArea)return null;
  let classification="destructive-unrelated-overlap";
  const ownership=left.ownerEditId&&left.ownerEditId===right.ownerEditId;
  if(ownership)classification="owned-overlap";
  else if(left.kind==="erase-mask"||right.kind==="erase-mask")classification="intentional-overlay";
  else if([left.kind,right.kind].includes("inserted-image"))classification="image-wrap-interaction";
  else if([left.kind,right.kind].includes("unknown-content"))classification="uncertain-unknown-content-overlap";
  return {leftObjectId:left.id,rightObjectId:right.id,coordinateSpace:overlap.space,intersectionRect:overlap.rect,overlapArea:overlap.overlapArea,semanticRelationship:left.sourceObjectId&&left.sourceObjectId===right.sourceObjectId?"same-source":"unrelated",ownershipRelationship:ownership?"same-owner":"different-owner",classification};
}

export function semanticFingerprint(object,{positionQuantum=.5,sizeQuantum=.5}={}) {
  const rect=object.pdfRect||object.rect||object.bounds||{};
  const q=(value,quantum)=>Number.isFinite(value)?round(Math.round(value/quantum)*quantum):null;
  return Object.freeze({page:Number(object.page),text:cleanText(object.text).toLocaleLowerCase(),role:object.semanticRole||object.kind||"unknown",baseline:q(object.baseline??rect.y,positionQuantum),rect:{x:q(rect.x,positionQuantum),y:q(rect.y,positionQuantum),width:q(rect.width,sizeQuantum),height:q(rect.height,sizeQuantum)},fontSize:q(Number(object.fontSize??object.style?.fontSize),.25),lineId:object.sourceLineId||null});
}

function scoreCandidate(expected,actual,tolerance){
  const a=semanticFingerprint(expected),b=semanticFingerprint(actual);
  if(a.page!==b.page)return {score:Infinity,reasons:["page"]};
  const reasons=[];let score=0;
  if(a.text!==b.text){score+=100;reasons.push("text");}
  const delta=Math.hypot((a.rect.x??0)-(b.rect.x??0),(a.rect.y??0)-(b.rect.y??0));
  const size=Math.hypot((a.rect.width??0)-(b.rect.width??0),(a.rect.height??0)-(b.rect.height??0));
  if(delta>tolerance.position){score+=delta;reasons.push("position");}
  if(size>tolerance.size){score+=size;reasons.push("size");}
  if(a.fontSize!==null&&b.fontSize!==null&&Math.abs(a.fontSize-b.fontSize)>tolerance.fontSize){score+=Math.abs(a.fontSize-b.fontSize);reasons.push("font-size");}
  return {score:round(score),reasons,positionDelta:round(delta),sizeDelta:round(size)};
}

/** Deterministic one-to-one live -> reopened correspondence. Equal best scores
 * are ambiguity, never an arbitrary first candidate. */
export function comparePdfSnapshots(live,reopened,{position=2,size=2,fontSize=.75,ambiguity=.001}={}) {
  const available=new Map((reopened.objects||[]).filter(o=>o.versionState!=="historical").map(o=>[o.id,o]));
  const records=[],issues=[];
  for(const expected of (live.objects||[]).filter(o=>o.versionState!=="historical"&&["replacement","replacement-text","free-text","text"].includes(o.kind))){
    const exact=available.get(expected.id);
    if(exact){records.push({liveObjectId:expected.id,reopenedObjectId:exact.id,classification:"exact-identity-match",score:0});available.delete(exact.id);continue;}
    const ranked=[...available.values()].map(actual=>({actual,...scoreCandidate(expected,actual,{position,size,fontSize})})).sort((a,b)=>a.score-b.score||String(a.actual.id).localeCompare(String(b.actual.id)));
    if(!ranked.length||ranked[0].score>=100){records.push({liveObjectId:expected.id,reopenedObjectId:null,classification:ranked[0]?.reasons.includes("text")?"text-mismatch":"missing-current-object",score:ranked[0]?.score??null});issues.push({severity:"error",code:"MISSING_CURRENT_OBJECT",objectId:expected.id});continue;}
    if(ranked[1]&&Math.abs(ranked[0].score-ranked[1].score)<=ambiguity){records.push({liveObjectId:expected.id,reopenedObjectId:null,classification:"ambiguous-correspondence",candidateIds:ranked.filter(r=>Math.abs(r.score-ranked[0].score)<=ambiguity).map(r=>r.actual.id),score:ranked[0].score});issues.push({severity:"error",code:"AMBIGUOUS_CORRESPONDENCE",objectId:expected.id});continue;}
    const best=ranked[0],classification=best.reasons.length?"geometry-drift":"semantic-correspondence-match";
    records.push({liveObjectId:expected.id,reopenedObjectId:best.actual.id,classification,score:best.score,positionDelta:best.positionDelta,sizeDelta:best.sizeDelta});available.delete(best.actual.id);
  }
  for(const object of available.values())if(object.versionState==="historical"||object.supersededBy){issues.push({severity:"error",code:"RESURRECTED_HISTORICAL_OBJECT",objectId:object.id});records.push({liveObjectId:null,reopenedObjectId:object.id,classification:"resurrected-historical-object"});}
  return {tolerances:{position,size,fontSize,ambiguity},records,issues};
}

/** Rebuild the active semantic boundary after a fresh PDF.js extraction. PDF
 * streams may retain an older text operator underneath a later masked draw.
 * An expected live fingerprint is the authority: once it corresponds to the
 * last geometrically compatible extracted run, earlier runs in that owned
 * source cell are explicitly quarantined as historical. */
export function reconcileReopenedPdfObjects(extracted,expectedCurrent,{position=3}={}) {
  const objects=extracted.map((object,index)=>({...object,paintOrder:object.paintOrder??index,versionState:object.versionState||"current"}));
  const issues=[];
  for(const expected of expectedCurrent){
    const ef=semanticFingerprint(expected);
    const candidates=objects.filter(object=>object.page===expected.page&&cleanText(object.text).toLocaleLowerCase()===ef.text)
      .map(object=>({object,match:scoreCandidate(expected,object,{position,size:3,fontSize:1})}))
      .filter(item=>item.match.score<100).sort((a,b)=>a.match.score-b.match.score||b.object.paintOrder-a.object.paintOrder);
    if(!candidates.length){issues.push({severity:"error",code:"MISSING_CURRENT_OBJECT",objectId:expected.id});continue;}
    if(candidates[1]&&candidates[0].match.score===candidates[1].match.score&&candidates[0].object.paintOrder===candidates[1].object.paintOrder){issues.push({severity:"error",code:"AMBIGUOUS_CORRESPONDENCE",objectId:expected.id});continue;}
    const current=candidates[0].object;current.replacementObjectId=expected.id;current.derivedFrom=expected.id;
    const expectedRect=expected.pdfRect||expected.rect||expected.bounds;
    for(const object of objects){
      if(object===current||object.page!==current.page||object.paintOrder>=current.paintOrder)continue;
      const overlap=intersectionRecord(object.pdfRect||object.rect||object.bounds,expectedRect);
      const rect=object.pdfRect||object.rect||object.bounds;
      if(overlap.ok&&overlap.overlapArea>=Math.min(rect.width*rect.height,expectedRect.width*expectedRect.height)*.5){object.versionState="historical";object.supersededBy=current.id;object.ownerEditId=expected.id;}
    }
  }
  return {current:objects.filter(o=>o.versionState==="current"),historical:objects.filter(o=>o.versionState==="historical"),objects,issues};
}

const styleValue=(style,name)=>style?.getPropertyValue?.(name)||style?.[name]||"";
export function capturePdfElementState(element,{state,viewportRect,inkRects=[],masks=[]}={}) {
  if(!STATE_NAMES.includes(state))throw new TypeError(`Unknown diagnostic state: ${state}`);
  const computed=globalThis.getComputedStyle?.(element)||element?.computedStyle||{};
  const rect=element.getBoundingClientRect();
  const local=viewportRect?{x:rect.left-viewportRect.left,y:rect.top-viewportRect.top,width:rect.width,height:rect.height}:{x:rect.left,y:rect.top,width:rect.width,height:rect.height};
  const transform=styleValue(computed,"transform"),opacity=styleValue(computed,"opacity");
  return {state,classes:[...(element.classList||[])].sort(),display:styleValue(computed,"display"),visibility:styleValue(computed,"visibility"),opacity,zIndex:styleValue(computed,"z-index")||styleValue(computed,"zIndex"),pointerEvents:styleValue(computed,"pointer-events")||styleValue(computed,"pointerEvents"),overflow:styleValue(computed,"overflow"),clipPath:styleValue(computed,"clip-path")||styleValue(computed,"clipPath"),transform,createsStackingContext:transform!=="none"||opacity!=="1"||styleValue(computed,"position")!=="static"&&styleValue(computed,"z-index")!=="auto",layoutRect:{space:"viewport-css-pixels",...local},inkRects:inkRects.map(rect=>({space:"viewport-css-pixels",...rect})),maskIds:masks.map(mask=>mask.id),ownerEditId:element.dataset?.ownerEditId||null,sourceObjectId:element.dataset?.sourceObjectId||null};
}

export function diagnoseStateTransitions(captures) {
  const issues=[];if(!captures.length)return issues;
  const canonical=captures[0];
  for(const current of captures.slice(1)){
    const a=canonical.layoutRect,b=current.layoutRect;
    if(Math.hypot(a.x-b.x,a.y-b.y,a.width-b.width,a.height-b.height)>.25)issues.push({severity:"error",code:"STATE_CHANGED_GEOMETRY",from:canonical.state,to:current.state});
    if(canonical.zIndex!==current.zIndex)issues.push({severity:"warning",code:"STATE_CHANGED_STACKING_ORDER",from:canonical.state,to:current.state});
    if(current.versionState==="historical"&&current.pointerEvents!=="none")issues.push({severity:"error",code:"STALE_OBJECT_HIT_TESTABLE",state:current.state});
  }return issues;
}

export function buildPdfDiagnosticSnapshot({page,pageBoxes={},viewport={},documentVersionId,objects=[],masks=[],observations=[],invariants=[],issues=[]}) {
  const allIssues=[...issues];
  const normalized=[];
  for(const object of objects){
    const rawRect=object.pdfRect||object.rect||object.bounds;
    const validation=validateFiniteRect(rawRect,{space:object.coordinateSpace||"pdf-points",allowZeroArea:object.kind==="replacement"&&object.text===""});
    normalized.push({...object,text:cleanText(object.text),geometry:{raw:validation.raw,canonical:validation.rect,space:validation.space,valid:validation.ok,errors:validation.errors}});
    for(const error of validation.errors)allIssues.push({severity:"error",code:`GEOMETRY_${error.code}`,objectId:object.id,field:error.field,rawValue:error.value});
  }
  for(const mask of masks){if(!mask.ownerEditId||!mask.sourceObjectIds?.length)allIssues.push({severity:"error",code:"MASK_OWNERSHIP_MISSING",objectId:mask.id});}
  const collisions=[];for(let i=0;i<normalized.length;i++)for(let j=i+1;j<normalized.length;j++){const collision=classifyPdfCollision({...normalized[i],rect:normalized[i].geometry.canonical},{...normalized[j],rect:normalized[j].geometry.canonical});if(collision)collisions.push(collision);}
  const countsByKind=Object.fromEntries([...new Set(normalized.map(o=>o.kind))].sort().map(kind=>[kind,normalized.filter(o=>o.kind===kind).length]));
  const issueCounts={};for(const issue of allIssues){const key=`${issue.severity}:${issue.code}`;issueCounts[key]=(issueCounts[key]||0)+1;}
  return {schemaVersion:PDF_DIAGNOSTIC_SCHEMA_VERSION,page,pageBoxes,viewport,documentVersionId:documentVersionId||"unknown",geometryTruthHierarchy:["raw-pdf-source","normalized-canonical-pdf","semantic","expected-viewport","observed-dom","observed-ink"],objectCountsByKind:countsByKind,issueCounts:Object.fromEntries(Object.entries(issueCounts).sort()),objects:normalized.sort((a,b)=>String(a.id).localeCompare(String(b.id))),masks:[...masks].sort((a,b)=>String(a.id).localeCompare(String(b.id))),observations,collisions:collisions.sort((a,b)=>a.leftObjectId.localeCompare(b.leftObjectId)||a.rightObjectId.localeCompare(b.rightObjectId)),invariants,issues:allIssues.sort((a,b)=>a.code.localeCompare(b.code)||String(a.objectId||"").localeCompare(String(b.objectId||"")))};
}
