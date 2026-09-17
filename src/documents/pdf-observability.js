import { validateFiniteRect } from "./pdf-geometry.js";

export const PDF_DIAGNOSTIC_SCHEMA_VERSION="3.0.0";
export const PDF_DIAGNOSTIC_MODES=Object.freeze({OFF:"off",DEBUG:"debug",DEEP:"deep"});
export const PDF_COORDINATE_SPACES=Object.freeze({
  PDF_POINTS:"pdf-points",
  SEMANTIC_PDF_POINTS:"semantic-pdf-points",
  VIEWPORT_CSS_PIXELS:"pdf-viewport-css",
  SURFACE_LOCAL_CSS:"pdf-surface-local-css",
  TEXT_LAYER_LOCAL_CSS:"pdf-text-layer-local-css",
  BLOCK_LOCAL_CSS:"block-local-css",
  WORKSPACE_CSS:"workspace-css",
  CLIENT_CSS_PIXELS:"client-css",
  DOCUMENT_CSS:"document-css",
  DEVICE_PIXELS:"device-pixels",
  CANVAS_BACKING_PIXELS:"canvas-backing-pixels",
  GLYPH_INK_VIEWPORT:"glyph-ink-client-css",
  EDITABLE_FIELD_CLIENT_CSS:"editable-field-client-css",
  SERIALIZED_PDF_POINTS:"serialized-pdf-points"
});
export const PDF_GEOMETRY_ISSUE_CODES=Object.freeze([
  "PDF_CANVAS_TEXT_LAYER_ORIGIN_MISMATCH","PDF_CANVAS_TEXT_LAYER_SIZE_MISMATCH","PDF_VIEWPORT_SURFACE_TRANSFORM_MISMATCH","PDF_VIEWPORT_TRANSFORM_MISMATCH",
  "PDF_OBJECT_DOM_RECT_MISMATCH","PDF_OBJECT_GLYPH_RECT_MISMATCH","POINTER_TARGET_DOES_NOT_MATCH_VISIBLE_GLYPH","EDIT_FIELD_TELEPORTED_FROM_SOURCE",
  "EDIT_FIELD_CHANGED_ON_FOCUS","EDIT_FIELD_CHANGED_ON_SELECTION","TOOLBAR_CHANGED_PAGE_COORDINATE_ORIGIN","SEARCH_BAR_CHANGED_PAGE_COORDINATE_ORIGIN",
  "TEXT_LAYER_SCROLL_DESYNCHRONIZED","UNACCOUNTED_CSS_TRANSFORM","UNEXPECTED_GEOMETRY_MUTATION","HOVER_BOX_GLYPH_MISMATCH",
  "SOURCE_DOM_SHOULD_COVER_SOURCE_GLYPH","HOVER_BOX_SHOULD_COVER_HIT_GLYPH","SELECTED_FIELD_SHOULD_REMAIN_ANCHORED_TO_SOURCE",
  "EDITABLE_FIELD_SHOULD_REMAIN_ANCHORED_TO_SELECTED_FIELD","SOURCE_MASK_SHOULD_COVER_SUPERSEDED_SOURCE_GLYPH","REPLACEMENT_GLYPH_SHOULD_FIT_REPLACEMENT_FIELD",
  "PDF_INTERACTIVE_RECT_GLYPH_MISMATCH"
]);
const STATE_NAMES=Object.freeze(["idle","hover","selected","editing","committed","rerendered","saved","reopened","pointerdown","mousedown","click","dblclick","before-focus","after-focus","before-contenteditable","after-contenteditable","selection-created","editing-active","focusout","rerender-start","rerender-complete"]);
const round=(n,digits=3)=>Number.isFinite(Number(n))?Math.round(Number(n)*10**digits)/10**digits:null;
const cleanText=value=>String(value??"").replace(/\s+/g," ").trim().slice(0,500);
const stableStrings=values=>[...new Set((values||[]).filter(Boolean).map(String))].sort();
const namedRect=(rect,space)=>rect?{rect:clientRectRecord(rect),space}:null;
const distanceToRect=(point,rect)=>Math.hypot(Math.max(rect.x-point.x,0,point.x-(rect.x+rect.width)),Math.max(rect.y-point.y,0,point.y-(rect.y+rect.height)));
const rawNamedRect=value=>value?.rect?value.rect:value;

/** One presentation-space authority for every interactive projection of a text
 * run.  PDF geometry remains immutable; an observed glyph rectangle may refine
 * the transient client hit rectangle, but is never suitable for serialization. */
export function resolvePdfInteractiveTextRect({objectId,presentationTruthKind="canvas-source-text",sourceRect=null,sourceProjectionRect=null,expectedViewportRect=null,glyphInkRect=null,domRect=null,padding=1,maxPadding=2}={}){
  const glyph=rawNamedRect(glyphInkRect),sourceProjection=rawNamedRect(sourceProjectionRect||expectedViewportRect),dom=rawNamedRect(domRect);
  const finite=rect=>rect&&[rect.x,rect.y,rect.width,rect.height].every(Number.isFinite)&&rect.width>0&&rect.height>0;
  const safePadding=Math.max(0,Math.min(Number(padding)||0,maxPadding));
  const padded=rect=>({x:rect.x-safePadding,y:rect.y-safePadding,width:rect.width+safePadding*2,height:rect.height+safePadding*2});
  const domVisible=presentationTruthKind!=="canvas-source-text";
  let chosen,derivationMethod,confidence,interactionAuthority,interactionAuthorityReason;
  if(!domVisible&&finite(sourceProjection)){
    chosen=padded(sourceProjection);derivationMethod="pdfjs-source-projection";confidence="high";interactionAuthority="pdfjs-source-projection";interactionAuthorityReason="canvas source text uses its PDF.js item projection; DOM glyph metrics are diagnostic only";
  }else if(domVisible&&finite(glyph)){
    chosen=padded(glyph);derivationMethod="observed-dom-glyph-ink";confidence="high";interactionAuthority="visible-dom-glyphs";interactionAuthorityReason="replacement/free text is visibly painted by the DOM overlay";
  }else if(finite(dom)){
    chosen={x:dom.x,y:dom.y,width:dom.width,height:dom.height};derivationMethod="normalized-dom-layout";confidence="medium";interactionAuthority="dom-layout-fallback";interactionAuthorityReason="preferred presentation projection was unavailable";
  }else if(finite(sourceProjection)){
    chosen=padded(sourceProjection);derivationMethod="pdfjs-source-projection";confidence="medium";interactionAuthority="pdfjs-source-projection";interactionAuthorityReason="source projection fallback";
  }else return {objectId:objectId||null,presentationTruthKind,interactionAuthority:"unresolved",interactionAuthorityReason:"no finite presentation rectangle",coordinateSpace:"client-css",canonicalSourceRect:sourceRect,sourceProjectionRect,domGlyphRect:glyphInkRect,interactiveRect:null,derivationMethod:"unresolved",confidence:"none",tolerances:{edgePx:1,glyphCoverage:.98,maxPaddingPx:maxPadding}};
  return {objectId:objectId||null,presentationTruthKind,interactionAuthority,interactionAuthorityReason,coordinateSpace:(domVisible?glyphInkRect?.space:null)||sourceProjectionRect?.space||expectedViewportRect?.space||domRect?.space||"client-css",canonicalSourceRect:sourceRect,sourceProjectionRect:sourceProjectionRect||expectedViewportRect,expectedViewportRect,domGlyphRect:glyphInkRect,observedGlyphInkRect:glyphInkRect,domGlyphDelta:rectangleDelta(sourceProjection,glyph),interactiveRect:{...chosen,space:(domVisible?glyphInkRect?.space:null)||sourceProjectionRect?.space||expectedViewportRect?.space||domRect?.space||"client-css"},derivationMethod,confidence,tolerances:{edgePx:1,glyphCoverage:.98,maxPaddingPx:maxPadding}};
}

/** Deterministic visual hit resolution. Containment is deliberately strict so
 * adjacent lines cannot acquire one another's clicks. */
export function resolvePdfVisualTarget(point,candidates=[]){
  const ranked=candidates.map((candidate,paintOrder)=>{
    const interactive=rawNamedRect(candidate.interactiveRect),glyph=rawNamedRect(candidate.glyphInkRect);
    return {...candidate,paintOrder,interactiveDistance:finiteDistance(point,interactive),glyphDistance:finiteDistance(point,glyph)};
  }).filter(candidate=>Number.isFinite(candidate.interactiveDistance)).sort((a,b)=>(a.interactiveDistance>0)-(b.interactiveDistance>0)||(a.glyphDistance>0)-(b.glyphDistance>0)||a.glyphDistance-b.glyphDistance||b.paintOrder-a.paintOrder||String(a.objectId).localeCompare(String(b.objectId)));
  const chosen=ranked[0];
  if(!chosen||chosen.interactiveDistance>0)return {objectId:null,reason:"no-interactive-rect",distance:null,competingCandidateIds:ranked.slice(0,5).map(item=>item.objectId)};
  return {objectId:chosen.objectId,reason:chosen.glyphDistance===0?"glyph-contained-pointer":"interactive-rect-contained-pointer",distance:chosen.glyphDistance,competingCandidateIds:ranked.slice(1,6).map(item=>item.objectId)};
}
function finiteDistance(point,rect){return rect&&[rect.x,rect.y,rect.width,rect.height,point?.x,point?.y].every(Number.isFinite)?distanceToRect(point,rect):Infinity;}

/** Compare two projections in the same coordinate space. The record is kept
 * deliberately redundant enough that an agent never has to recalculate IoU,
 * containment, edge direction, or center displacement from a JSON dossier. */
export function compareVisualRectangles(left,right,{a="a",b="b",space=null,tolerance=1,nearDistance=24}={}){
  const ar=rawNamedRect(left),br=rawNamedRect(right),av=validateFiniteRect(ar,{space:space||left?.space||"client-css",allowZeroArea:true}),bv=validateFiniteRect(br,{space:space||right?.space||"client-css",allowZeroArea:true});
  if(!av.ok||!bv.ok)return {a,b,space:space||left?.space||right?.space||"unknown",valid:false,errors:[...av.errors,...bv.errors]};
  const A=av.rect,B=bv.rect,x=Math.max(A.x,B.x),y=Math.max(A.y,B.y),rightEdge=Math.min(A.x+A.width,B.x+B.width),bottom=Math.min(A.y+A.height,B.y+B.height);
  const intersectionRect={x:round(x),y:round(y),width:round(Math.max(0,rightEdge-x)),height:round(Math.max(0,bottom-y))};
  const areaA=A.width*A.height,areaB=B.width*B.height,intersectionArea=intersectionRect.width*intersectionRect.height,unionArea=areaA+areaB-intersectionArea;
  const coverageOfA=areaA?intersectionArea/areaA:0,coverageOfB=areaB?intersectionArea/areaB:0;
  const centerDelta={x:round((B.x+B.width/2)-(A.x+A.width/2)),y:round((B.y+B.height/2)-(A.y+A.height/2))};
  const edgeDelta={left:round(B.x-A.x),top:round(B.y-A.y),right:round(B.x+B.width-A.x-A.width),bottom:round(B.y+B.height-A.y-A.height)};
  const distance=round(Math.hypot(centerDelta.x,centerDelta.y));
  let classification;
  if(intersectionArea===0)classification=distance<=nearDistance?"near-but-misaligned":"disjoint";
  else if(Math.max(...Object.values(edgeDelta).map(Math.abs))<=tolerance)classification="aligned";
  else if(coverageOfA>=.98&&areaB>areaA*1.35)classification="oversized-hitbox";
  else if(coverageOfB>=.98&&areaB<areaA*.75)classification="undersized-hitbox";
  else if(coverageOfA>=.98)classification="contains-glyphs";
  else if(distance<=nearDistance&&intersectionArea)classification="near-but-misaligned";
  else classification="partial-overlap";
  return {a,b,space:space||left?.space||right?.space||"client-css",valid:true,intersectionRect,intersectionArea:round(intersectionArea),unionArea:round(unionArea),iou:round(unionArea?intersectionArea/unionArea:0,6),coverageOfA:round(coverageOfA,6),coverageOfB:round(coverageOfB,6),centerDelta,edgeDelta,distance,classification};
}

/** A serializable, invertible chain. Matrices use DOM/CSS [a,b,c,d,e,f]. */
export function createGeometryTransformChain(from,to,steps=[]){
  const normalized=steps.map(step=>({...step,matrix:[...(step.matrix||[1,0,0,1,0,0])]}));
  return Object.freeze({from,to,steps:Object.freeze(normalized.map(Object.freeze))});
}
const applyMatrix=(point,[a,b,c,d,e,f])=>({x:a*point.x+c*point.y+e,y:b*point.x+d*point.y+f});
const invertMatrix=([a,b,c,d,e,f])=>{const det=a*d-b*c;if(!Number.isFinite(det)||Math.abs(det)<1e-12)return null;return [d/det,-b/det,-c/det,a/det,(c*f-d*e)/det,(b*e-a*f)/det];};
export function transformPointThroughChain(point,chain,{inverse=false}={}){
  const steps=inverse?[...chain.steps].reverse():chain.steps;let value={x:Number(point.x),y:Number(point.y)};
  for(const step of steps){const matrix=inverse?invertMatrix(step.matrix):step.matrix;if(!matrix)return null;value=applyMatrix(value,matrix);}return value;
}
export function verifyTransformRoundTrip(point,chain,tolerance=.01){const client=transformPointThroughChain(point,chain),back=client&&transformPointThroughChain(client,chain,{inverse:true});const error=back?Math.hypot(back.x-point.x,back.y-point.y):Infinity;return {ok:error<=tolerance,tolerance,error:round(error,6),from:{...point},through:client,back};}

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
  const geometry=validateFiniteRect(pdfRect,{space:PDF_COORDINATE_SPACES.PDF_POINTS});
  if(errors.length||!geometry.ok)throw new TypeError(`Invalid PDF mask: ${[...errors,...geometry.errors.map(e=>e.code+":"+e.field)].join(", ")}`);
  return Object.freeze({id:id||`mask:${ownerEditId}:${maskRole}`,kind:"erase-mask",ownerEditId:String(ownerEditId),sourceObjectIds:Object.freeze(sourceObjectIds.map(String)),maskRole:String(maskRole),pdfRect:Object.freeze({...geometry.rect})});
}

export function intersectionRecord(left,right,{space=PDF_COORDINATE_SPACES.PDF_POINTS}={}) {
  const a=validateFiniteRect(left.rect||left,{space}),b=validateFiniteRect(right.rect||right,{space});
  if(!a.ok||!b.ok)return {ok:false,space,errors:[...a.errors,...b.errors]};
  const x=Math.max(a.rect.x,b.rect.x),y=Math.max(a.rect.y,b.rect.y);
  const r=Math.min(a.rect.x+a.rect.width,b.rect.x+b.rect.width),t=Math.min(a.rect.y+a.rect.height,b.rect.y+b.rect.height);
  const rect={x,y,width:Math.max(0,r-x),height:Math.max(0,t-y)};
  return {ok:true,space,rect,overlapArea:round(rect.width*rect.height)};
}

export function classifyPdfCollision(left,right) {
  const overlap=intersectionRecord(left,right,{space:left.coordinateSpace||right.coordinateSpace||PDF_COORDINATE_SPACES.PDF_POINTS});
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

const isHistoricalObject=object=>object?.versionState==="historical"||object?.versionState==="superseded"||Boolean(object?.supersededBy);

/** Deterministic one-to-one live -> reopened correspondence. Equal best scores
 * are ambiguity, never an arbitrary first candidate. Historical/superseded
 * reopened records are retained separately so resurrection detection cannot be
 * made unreachable by the candidate filter. */
export function comparePdfSnapshots(live,reopened,{position=2,size=2,fontSize=.75,ambiguity=.001}={}) {
  const reopenedObjects=reopened.objects||[];
  const historical=reopenedObjects.filter(isHistoricalObject);
  const available=new Map(reopenedObjects.filter(object=>!isHistoricalObject(object)).map(object=>[object.id,object]));
  const records=[],issues=[];

  for(const object of historical){
    issues.push({severity:"error",code:"RESURRECTED_HISTORICAL_OBJECT",objectId:object.id});
    records.push({liveObjectId:null,reopenedObjectId:object.id,classification:"resurrected-historical-object"});
  }

  for(const expected of (live.objects||[]).filter(o=>!isHistoricalObject(o)&&["replacement","replacement-text","free-text","text"].includes(o.kind))){
    const exact=available.get(expected.id);
    if(exact){records.push({liveObjectId:expected.id,reopenedObjectId:exact.id,classification:"exact-identity-match",score:0});available.delete(exact.id);continue;}
    const ranked=[...available.values()].map(actual=>({actual,...scoreCandidate(expected,actual,{position,size,fontSize})})).sort((a,b)=>a.score-b.score||String(a.actual.id).localeCompare(String(b.actual.id)));
    if(!ranked.length||ranked[0].score>=100){records.push({liveObjectId:expected.id,reopenedObjectId:null,classification:ranked[0]?.reasons.includes("text")?"text-mismatch":"missing-current-object",score:ranked[0]?.score??null});issues.push({severity:"error",code:"MISSING_CURRENT_OBJECT",objectId:expected.id});continue;}
    if(ranked[1]&&Math.abs(ranked[0].score-ranked[1].score)<=ambiguity){records.push({liveObjectId:expected.id,reopenedObjectId:null,classification:"ambiguous-correspondence",candidateIds:ranked.filter(r=>Math.abs(r.score-ranked[0].score)<=ambiguity).map(r=>r.actual.id),score:ranked[0].score});issues.push({severity:"error",code:"AMBIGUOUS_CORRESPONDENCE",objectId:expected.id});continue;}
    const best=ranked[0],classification=best.reasons.length?"geometry-drift":"semantic-correspondence-match";
    records.push({liveObjectId:expected.id,reopenedObjectId:best.actual.id,classification,score:best.score,positionDelta:best.positionDelta,sizeDelta:best.sizeDelta});available.delete(best.actual.id);
  }

  for(const object of available.values()){
    records.push({liveObjectId:null,reopenedObjectId:object.id,classification:"unexpected-current-object"});
    issues.push({severity:"warning",code:"UNEXPECTED_CURRENT_OBJECT",objectId:object.id});
  }
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
    const current=candidates[0].object;current.replacementObjectId=expected.id;current.sourceObjectId=expected.sourceObjectId||null;current.derivedFrom=expected.id;
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
const clientRectRecord=rect=>({x:Number(rect?.left??rect?.x)||0,y:Number(rect?.top??rect?.y)||0,width:Number(rect?.width)||0,height:Number(rect?.height)||0});
const toViewportLocal=(rect,viewportRect)=>({x:rect.x-(viewportRect?.x??viewportRect?.left??0),y:rect.y-(viewportRect?.y??viewportRect?.top??0),width:rect.width,height:rect.height});
const unionRects=rects=>{
  if(!rects.length)return null;
  const left=Math.min(...rects.map(rect=>rect.x)),top=Math.min(...rects.map(rect=>rect.y));
  const right=Math.max(...rects.map(rect=>rect.x+rect.width)),bottom=Math.max(...rects.map(rect=>rect.y+rect.height));
  return {x:left,y:top,width:right-left,height:bottom-top};
};
export function pdfRectThroughViewportTransform(pdfRect,transform){
  if(!pdfRect||!Array.isArray(transform)||transform.length<6||!transform.every(Number.isFinite))return null;
  const [a,b,c,d,e,f]=transform;
  const points=[
    [pdfRect.x,pdfRect.y],
    [pdfRect.x+pdfRect.width,pdfRect.y],
    [pdfRect.x,pdfRect.y+pdfRect.height],
    [pdfRect.x+pdfRect.width,pdfRect.y+pdfRect.height]
  ].map(([x,y])=>({x:a*x+c*y+e,y:b*x+d*y+f}));
  const left=Math.min(...points.map(point=>point.x)),top=Math.min(...points.map(point=>point.y));
  const right=Math.max(...points.map(point=>point.x)),bottom=Math.max(...points.map(point=>point.y));
  return {space:PDF_COORDINATE_SPACES.VIEWPORT_CSS_PIXELS,x:round(left),y:round(top),width:round(right-left),height:round(bottom-top)};
}

export function rectangleDelta(expected,observed){
  if(!expected||!observed)return null;
  const delta={dx:round(observed.x-expected.x),dy:round(observed.y-expected.y),dw:round(observed.width-expected.width),dh:round(observed.height-expected.height)};
  return {...delta,maxAbs:Math.max(...Object.values(delta).map(value=>Math.abs(value??0)))};
}

function textRangeClientRects(element,{createRange=globalThis.document?.createRange?.bind(globalThis.document)}={}){
  if(!element||typeof createRange!=="function")return [];
  const target=element.querySelector?.(".pdf-edit-text")||element;
  try{
    const range=createRange();range.selectNodeContents(target);
    return [...range.getClientRects()].map(clientRectRecord).filter(rect=>rect.width||rect.height);
  }catch{return [];}
}

function textMetricsForElement(element,computed,{createCanvas=()=>globalThis.document?.createElement?.("canvas")}={}){
  if(!element||typeof createCanvas!=="function")return null;
  try{
    const canvas=createCanvas();const context=canvas?.getContext?.("2d");if(!context)return null;
    const font=styleValue(computed,"font")||`${styleValue(computed,"font-style")||"normal"} ${styleValue(computed,"font-weight")||"400"} ${styleValue(computed,"font-size")||"16px"} ${styleValue(computed,"font-family")||"sans-serif"}`;
    context.font=font;const metrics=context.measureText(element.textContent||"");
    return {font,width:round(metrics.width),actualBoundingBoxAscent:round(metrics.actualBoundingBoxAscent),actualBoundingBoxDescent:round(metrics.actualBoundingBoxDescent),actualBoundingBoxLeft:round(metrics.actualBoundingBoxLeft),actualBoundingBoxRight:round(metrics.actualBoundingBoxRight)};
  }catch{return null;}
}

export function capturePdfElementState(element,{state="idle",viewportRect,inkRects=null,masks=[],createRange,createCanvas,getComputedStyle=globalThis.getComputedStyle?.bind(globalThis)}={}) {
  if(!STATE_NAMES.includes(state))throw new TypeError(`Unknown diagnostic state: ${state}`);
  if(!element?.getBoundingClientRect)throw new TypeError("A rendered PDF element is required");
  const computed=getComputedStyle?.(element)||element?.computedStyle||{};
  const rawLayout=clientRectRecord(element.getBoundingClientRect());
  const local=viewportRect?toViewportLocal(rawLayout,viewportRect):rawLayout;
  const rawInk=Array.isArray(inkRects)?inkRects.map(clientRectRecord):textRangeClientRects(element,{createRange});
  const localInk=rawInk.map(rect=>viewportRect?toViewportLocal(rect,viewportRect):rect);
  const transform=styleValue(computed,"transform"),opacity=styleValue(computed,"opacity");
  const objectId=element.dataset?.pdfObjectId||element.dataset?.objectId||null;
  const sourceObjectId=element.dataset?.pdfSourceObjectId||element.dataset?.sourceObjectId||null;
  const ownerEditId=element.dataset?.pdfEditId||element.dataset?.ownerEditId||null;
  const versionState=element.dataset?.pdfVersionState||element.dataset?.versionState||"current";
  const presentationTruthKind=element.dataset?.presentationTruthKind||((ownerEditId||element.classList?.contains?.("pdf-text-edit"))?"dom-replacement-text":"canvas-source-text");
  const maskIds=stableStrings([...(masks||[]).map(mask=>mask.id),...(element.dataset?.maskIds||"").split(/\s+/)]);
  return {
    objectId,sourceObjectId,ownerEditId,versionState,state,presentationTruthKind,
    identity:{objectId,sourceObjectId,editId:ownerEditId,lineId:element.dataset?.pdfLineId||element.dataset?.lineId||null,blockId:element.dataset?.pdfBlockId||element.dataset?.blockId||null},
    classes:[...(element.classList||[])].sort(),
    display:styleValue(computed,"display"),visibility:styleValue(computed,"visibility"),opacity,
    zIndex:styleValue(computed,"z-index")||styleValue(computed,"zIndex"),pointerEvents:styleValue(computed,"pointer-events")||styleValue(computed,"pointerEvents"),
    overflow:styleValue(computed,"overflow"),clipPath:styleValue(computed,"clip-path")||styleValue(computed,"clipPath"),transform,
    createsStackingContext:transform&&transform!=="none"||opacity&&opacity!=="1"||(styleValue(computed,"position")!=="static"&&styleValue(computed,"z-index")!=="auto"),
    font:{family:styleValue(computed,"font-family"),size:styleValue(computed,"font-size"),lineHeight:styleValue(computed,"line-height"),weight:styleValue(computed,"font-weight"),style:styleValue(computed,"font-style")},
    textMetrics:textMetricsForElement(element,computed,{createCanvas}),
    clientRect:{space:PDF_COORDINATE_SPACES.CLIENT_CSS_PIXELS,...Object.fromEntries(Object.entries(rawLayout).map(([key,value])=>[key,round(value)]))},
    editableRect:(()=>{const editable=element.matches?.('[contenteditable="true"]')?element:element.querySelector?.('[contenteditable="true"]');if(!editable?.getBoundingClientRect)return null;return {space:PDF_COORDINATE_SPACES.EDITABLE_FIELD_CLIENT_CSS,...Object.fromEntries(Object.entries(clientRectRecord(editable.getBoundingClientRect())).map(([key,value])=>[key,round(value)]))};})(),
    layoutRect:{space:PDF_COORDINATE_SPACES.VIEWPORT_CSS_PIXELS,...Object.fromEntries(Object.entries(local).map(([key,value])=>[key,round(value)]))},
    inkRects:rawInk.map(rect=>({space:PDF_COORDINATE_SPACES.GLYPH_INK_VIEWPORT,...Object.fromEntries(Object.entries(rect).map(([key,value])=>[key,round(value)]))})),
    inkUnion:(()=>{const union=unionRects(rawInk);return union?{space:PDF_COORDINATE_SPACES.GLYPH_INK_VIEWPORT,...Object.fromEntries(Object.entries(union).map(([key,value])=>[key,round(value)]))}:null;})(),
    inkViewportRects:localInk.map(rect=>({space:PDF_COORDINATE_SPACES.VIEWPORT_CSS_PIXELS,...Object.fromEntries(Object.entries(rect).map(([key,value])=>[key,round(value)]))})),
    inkViewportUnion:(()=>{const union=unionRects(localInk);return union?{space:PDF_COORDINATE_SPACES.VIEWPORT_CSS_PIXELS,...Object.fromEntries(Object.entries(union).map(([key,value])=>[key,round(value)]))}:null;})(),
    maskIds
  };
}

/** Capture the visible/current PDF surface only. This is intentionally on-demand
 * and never installs a MutationObserver or scans other pages/documents. */
export function capturePdfPageDomObservations(root,{state="idle",masks=[],getComputedStyle,createRange,createCanvas}={}){
  if(!root?.querySelectorAll||!root.getBoundingClientRect)return [];
  const viewportRect=clientRectRecord(root.getBoundingClientRect());
  const elements=[...root.querySelectorAll("[data-pdf-object-id],[data-object-id]")];
  return elements.map((element,domOrder)=>{
    const observation=capturePdfElementState(element,{state,viewportRect,masks,getComputedStyle,createRange,createCanvas});
    return {...observation,domOrder};
  }).filter(observation=>observation.objectId).sort((a,b)=>String(a.objectId).localeCompare(String(b.objectId))||a.domOrder-b.domOrder);
}

function elementSummary(element){return element?{tag:String(element.tagName||"").toLowerCase(),classes:[...(element.classList||[])].sort(),objectId:element.dataset?.objectId||element.dataset?.pdfObjectId||null,sourceObjectId:element.dataset?.sourceObjectId||null,editId:element.dataset?.ownerEditId||null}:null;}
function cssTransform(element,getComputedStyle){const value=getComputedStyle?.(element)?.transform||"none";return value;}

/** Capture the canvas/text-layer contract and surrounding chrome in client CSS.
 * This reads one active block only and performs no ongoing observation. */
export function capturePdfPageGeometry(block,{viewport={},getComputedStyle=globalThis.getComputedStyle?.bind(globalThis)}={}){
  const query=selector=>block?.querySelector?.(selector),canvas=query(".pdf-canvas"),textLayer=query(".pdf-text-layer"),surface=query(".pdf-surface");
  if(!canvas||!textLayer||!surface)return null;
  const canvasRect=clientRectRecord(canvas.getBoundingClientRect()),textRect=clientRectRecord(textLayer.getBoundingClientRect()),surfaceRect=clientRectRecord(surface.getBoundingClientRect());
  const alignment={originDelta:{x:round(textRect.x-canvasRect.x),y:round(textRect.y-canvasRect.y)},widthDelta:round(textRect.width-canvasRect.width),heightDelta:round(textRect.height-canvasRect.height),scaleDelta:{x:round(textRect.width/(canvasRect.width||1)-1,6),y:round(textRect.height/(canvasRect.height||1)-1,6)}};
  const toolbar=query(".pdf-toolbar"),search=query(".pdf-search-box"),header=query(".block-header"),reader=query(".pdf-reader"),side=query(".pdf-side-panel");
  const textTransform=cssTransform(textLayer,getComputedStyle);
  return {
    spaces:{canvas:"client-css",textLayer:"client-css",surface:"client-css",viewport:"pdf-viewport-css"},
    canvas:{clientRect:namedRect(canvasRect,"client-css"),cssWidth:canvasRect.width,cssHeight:canvasRect.height,backingWidth:canvas.width,backingHeight:canvas.height},
    textLayer:{clientRect:namedRect(textRect,"client-css"),cssWidth:textRect.width,cssHeight:textRect.height,transform:textTransform},
    surface:{clientRect:namedRect(surfaceRect,"client-css"),scrollLeft:surface.scrollLeft||0,scrollTop:surface.scrollTop||0,padding:getComputedStyle?.(surface)?.padding||null},
    viewport:{width:viewport.width??null,height:viewport.height??null,scale:viewport.scale??null,rotation:viewport.rotation??null,transform:viewport.transform?[...viewport.transform]:null},alignment,
    chrome:{toolbar:namedRect(toolbar?.getBoundingClientRect?.(),"client-css"),toolbarRowCount:toolbar?new Set([...toolbar.children].filter(child=>!child.hidden).map(child=>round(child.getBoundingClientRect().top))).size:0,search:namedRect(search?.getBoundingClientRect?.(),"client-css"),header:namedRect(header?.getBoundingClientRect?.(),"client-css"),reader:namedRect(reader?.getBoundingClientRect?.(),"client-css"),sidePanel:namedRect(side?.getBoundingClientRect?.(),"client-css")},
    transformChain:createGeometryTransformChain("pdf-viewport-css","client-css",[{kind:"text-layer-client-origin",matrix:[1,0,0,1,textRect.x,textRect.y],cssTransform:textTransform,scrollLeft:surface.scrollLeft||0,scrollTop:surface.scrollTop||0}])
  };
}

export function evaluatePageAlignment(geometry,{tolerance=1}={}){
  if(!geometry)return [];
  const issues=[],a=geometry.alignment,v=geometry.viewport,c=geometry.canvas,t=geometry.textLayer;
  const issue=(code,expected,actual,delta,stage)=>issues.push({severity:"error",code,expected,actual,delta,coordinateSpaces:["client-css","pdf-viewport-css"],probableTransformStage:stage});
  if(Math.hypot(a.originDelta.x,a.originDelta.y)>tolerance)issue("PDF_CANVAS_TEXT_LAYER_ORIGIN_MISMATCH",c.clientRect,t.clientRect,a.originDelta,"text-layer-origin");
  if(Math.max(Math.abs(a.widthDelta),Math.abs(a.heightDelta))>tolerance)issue("PDF_CANVAS_TEXT_LAYER_SIZE_MISMATCH",{width:c.cssWidth,height:c.cssHeight},{width:t.cssWidth,height:t.cssHeight},{width:a.widthDelta,height:a.heightDelta},"text-layer-size");
  if(v?.width!=null&&[c.cssWidth,c.cssHeight,t.cssWidth,t.cssHeight].every(Number.isFinite)&&Math.max(Math.abs(c.cssWidth-v.width),Math.abs(c.cssHeight-v.height),Math.abs(t.cssWidth-v.width),Math.abs(t.cssHeight-v.height))>tolerance)issue("PDF_VIEWPORT_SURFACE_TRANSFORM_MISMATCH",{width:v.width,height:v.height},{canvas:{width:c.cssWidth,height:c.cssHeight},textLayer:{width:t.cssWidth,height:t.cssHeight}},null,"viewport-to-surface");
  if(t.transform&&!/^(none|matrix\(1, 0, 0, 1, [-\d.]+, [-\d.]+\)|translateX\(-50%\))$/.test(t.transform))issues.push({severity:"warning",code:"UNACCOUNTED_CSS_TRANSFORM",actual:t.transform,probableTransformStage:"text-layer-css-transform"});
  return issues;
}

export function capturePointerHitTest(event,root,{observations=[],document=globalThis.document}={}){
  const point={x:Number(event.clientX),y:Number(event.clientY)},stack=[...(document?.elementsFromPoint?.(point.x,point.y)||[])],direct=document?.elementFromPoint?.(point.x,point.y)||stack[0]||null;
  const candidates=observations.map(item=>{const authority=resolvePdfInteractiveTextRect({objectId:item.objectId,presentationTruthKind:item.presentationTruthKind,sourceProjectionRect:item.clientRect||item.inkUnion,glyphInkRect:item.inkUnion,domRect:item.clientRect,padding:1});const rect=authority.interactiveRect;return {objectId:item.objectId,sourceObjectId:item.sourceObjectId,presentationTruthKind:authority.presentationTruthKind,interactionAuthority:authority.interactionAuthority,interactiveRect:rect,inkRect:item.inkUnion,distance:rect?round(distanceToRect(point,rect)):Infinity};}).filter(item=>Number.isFinite(item.distance)).sort((a,b)=>a.distance-b.distance||String(a.objectId).localeCompare(String(b.objectId)));
  const target=event.target?.closest?.("[data-object-id],[data-pdf-object-id]")||event.target,chosenId=target?.dataset?.objectId||target?.dataset?.pdfObjectId||null,chosen=candidates.find(item=>String(item.objectId)===String(chosenId))||null,best=candidates[0]||null;
  const issues=chosen&&best&&chosen.objectId!==best.objectId&&chosen.distance-best.distance>1?[{severity:"error",code:"POINTER_TARGET_DOES_NOT_MATCH_VISIBLE_GLYPH",objectId:chosen.objectId,expectedObjectId:best.objectId,delta:{distance:round(chosen.distance-best.distance)},interactionEvent:event.type,probableTransformStage:"hit-test"}]:[];
  return {event:event.type,pointer:{clientX:point.x,clientY:point.y,space:"client-css"},target:elementSummary(target),elementFromPoint:elementSummary(direct),elementsFromPoint:stack.slice(0,12).map(elementSummary),candidatePdfObjects:candidates.slice(0,20),chosenObject:chosen,pointerDeltaFromChosenInk:chosen?{distance:chosen.distance}:null,issues};
}

export function createBoundedGeometryJournal(limit=40){const entries=[];return {record(event,payload={}){entries.push({sequence:++sequence,event,timestamp:Date.now(),...payload});if(entries.length>limit)entries.splice(0,entries.length-limit);return entries.at(-1);},snapshot(){return entries.map(entry=>({...entry}));},clear(){entries.length=0;}};}
export function compareGeometryFingerprints(before,after,{cause="unknown",tolerance=.5}={}){
  if(!before||!after)return {cause,classification:"UNEXPECTED_GEOMETRY_MUTATION",deltas:null};
  const rectDelta=(a,b)=>rectangleDelta(a?.rect||a,b?.rect||b),deltas={toolbar:rectDelta(before.chrome?.toolbar,after.chrome?.toolbar),reader:rectDelta(before.chrome?.reader,after.chrome?.reader),canvas:rectDelta(before.canvas?.clientRect,after.canvas?.clientRect),textLayer:rectDelta(before.textLayer?.clientRect,after.textLayer?.clientRect),alignment:{before:before.alignment,after:after.alignment},scroll:{x:round(after.surface.scrollLeft-before.surface.scrollLeft),y:round(after.surface.scrollTop-before.surface.scrollTop)}};
  const cd=deltas.canvas,td=deltas.textLayer,same=cd&&td&&Math.max(Math.abs(cd.dx-td.dx),Math.abs(cd.dy-td.dy),Math.abs(cd.dw-td.dw),Math.abs(cd.dh-td.dh))<=tolerance;
  let classification=same&&(cd.maxAbs>tolerance||td.maxAbs>tolerance)?"EXPECTED_SHARED_LAYOUT_SHIFT":cd?.maxAbs>tolerance&&!(td?.maxAbs>tolerance)?"CANVAS_ONLY_SHIFT":td?.maxAbs>tolerance&&!(cd?.maxAbs>tolerance)?"TEXT_LAYER_ONLY_SHIFT":Math.abs(deltas.scroll.x)>tolerance||Math.abs(deltas.scroll.y)>tolerance?"SCROLL_ORIGIN_CHANGED":"NO_GEOMETRY_CHANGE";
  return {cause,classification,deltas,issues:[...evaluatePageAlignment(after),...(!same&&classification!=="NO_GEOMETRY_CHANGE"?[{severity:"error",code:cause.includes("toolbar")?"TOOLBAR_CHANGED_PAGE_COORDINATE_ORIGIN":cause.includes("search")?"SEARCH_BAR_CHANGED_PAGE_COORDINATE_ORIGIN":"UNEXPECTED_GEOMETRY_MUTATION",probableTransformStage:"layout-mutation",deltas}]:[])]};
}

const diagnosticModes=new WeakMap();
export function setPdfDiagnosticMode(block,mode="off"){
  if(!Object.values(PDF_DIAGNOSTIC_MODES).includes(mode))throw new TypeError(`Unknown PDF diagnostic mode: ${mode}`);
  if(!block||typeof block!=="object")throw new TypeError("A PDF block is required");
  if(mode===PDF_DIAGNOSTIC_MODES.OFF)diagnosticModes.delete(block);else diagnosticModes.set(block,mode);
  if(block.dataset)block.dataset.pdfDiagnosticMode=mode;
  return mode;
}
export function getPdfDiagnosticMode(block){return diagnosticModes.get(block)||block?.dataset?.pdfDiagnosticMode||PDF_DIAGNOSTIC_MODES.OFF;}

function outlineProjection(observation,computed){
  const style=styleValue(computed,"outline-style"),width=Number.parseFloat(styleValue(computed,"outline-width"))||0,offset=Number.parseFloat(styleValue(computed,"outline-offset"))||0;
  if(!observation?.clientRect)return null;
  const rect=rawNamedRect(observation.clientRect),grow=width+offset;
  return {...namedRect({x:rect.x-grow,y:rect.y-grow,width:rect.width+grow*2,height:rect.height+grow*2},"hover-outline-client-css"),derivedFrom:width&&style!=="none"?"css-outline":"border-box",outline:{style:style||"none",width:round(width),offset:round(offset)},background:styleValue(computed,"background-color")||styleValue(computed,"background")};
}
function compactVisualAncestry(element,getComputedStyle){
  const ancestry=[];let node=element?.parentElement;
  while(node&&ancestry.length<16){
    const style=getComputedStyle?.(node)||{},transform=styleValue(style,"transform")||"none",overflow=styleValue(style,"overflow")||"visible",zIndex=styleValue(style,"z-index")||"auto",position=styleValue(style,"position")||"static",clipPath=styleValue(style,"clip-path")||"none";
    if(transform!=="none"||!/^visible$/.test(overflow)||zIndex!=="auto"||position!=="static"||clipPath!=="none"||node.scrollLeft||node.scrollTop){
      ancestry.push({element:elementSummary(node),clientRect:namedRect(node.getBoundingClientRect?.(),"client-css"),transform,transformOrigin:styleValue(style,"transform-origin"),overflow,clipPath,zIndex,position,scroll:{left:node.scrollLeft||0,top:node.scrollTop||0}});
    }
    node=node.parentElement;
  }
  return ancestry;
}

/** Locate the first unequal named transform step without guessing beyond the
 * available evidence. Callers may supply projection.transformChain records. */
export function firstProjectionDivergence(expected,actual,{tolerance=.5}={}){
  const expectedSteps=expected?.transformChain?.steps||[],actualSteps=actual?.transformChain?.steps||[],length=Math.max(expectedSteps.length,actualSteps.length);
  for(let index=0;index<length;index++){
    const e=expectedSteps[index],a=actualSteps[index];
    if(!e||!a||e.kind!==a.kind||Math.max(...(e.matrix||[]).map((value,i)=>Math.abs(value-(a.matrix||[])[i])))>tolerance){
      const em=e?.matrix||[1,0,0,1,0,0],am=a?.matrix||[1,0,0,1,0,0];
      return {stage:`${e?.kind||"missing"} -> ${a?.kind||"missing"}`,step:index,expectedOrigin:{x:em[4]||0,y:em[5]||0},actualOrigin:{x:am[4]||0,y:am[5]||0},delta:{x:round((am[4]||0)-(em[4]||0)),y:round((am[5]||0)-(em[5]||0))},causeCandidates:["stale-client-rect","layout-shift","transform-origin"]};
    }
  }
  const relationship=expected&&actual?compareVisualRectangles(expected,actual):null;
  return relationship?.classification!=="aligned"?{stage:"final-projection",step:length,expectedOrigin:{x:rawNamedRect(expected).x,y:rawNamedRect(expected).y},actualOrigin:{x:rawNamedRect(actual).x,y:rawNamedRect(actual).y},delta:relationship.centerDelta,causeCandidates:["unrecorded-css-transform","stale-client-rect","wrong-coordinate-space"]}:null;
}

function projectionIssue(object,projectionName,referenceName,code){
  const actual=object.projections[projectionName],reference=object.projections[referenceName];if(!actual||!reference)return null;
  const metrics=compareVisualRectangles(reference,actual,{a:referenceName,b:projectionName});
  if(["aligned","contains-glyphs"].includes(metrics.classification))return null;
  return {severity:"error",code,objectId:object.objectId,sourceObjectId:object.sourceObjectId,expected:reference,actual,coordinateSpaces:[reference.space,actual.space],relationship:metrics,firstDivergence:firstProjectionDivergence(reference,actual),interactionState:object.visualState};
}

/** Materialize a machine-readable shadow of one currently rendered page.
 * OFF returns a tiny status record and does not query layout or scan glyphs. */
export function capturePdfVisualScene(block,runtime={},options={}){
  const mode=options.mode||getPdfDiagnosticMode(block);if(mode===PDF_DIAGNOSTIC_MODES.OFF)return {schemaVersion:PDF_DIAGNOSTIC_SCHEMA_VERSION,mode,page:Number(block?.dataset?.currentPage||1),objects:[],relationships:[],issues:[]};
  const deep=mode===PDF_DIAGNOSTIC_MODES.DEEP,root=block?.querySelector?.(".pdf-text-layer"),geometry=options.pageGeometry||capturePdfPageGeometry(block,{viewport:runtime.pageData?.viewport,getComputedStyle:options.getComputedStyle});
  const observations=options.observations||capturePdfPageDomObservations(root,{state:"idle",getComputedStyle:options.getComputedStyle,createRange:deep?options.createRange:()=>null,createCanvas:deep?options.createCanvas:()=>null});
  const sharedHoverOutline=root?.querySelector?.(".pdf-interactive-outline:not([hidden])");
  const elements=new Map([...(root?.querySelectorAll?.("[data-pdf-object-id],[data-object-id]")||[])].map(element=>[String(element.dataset?.pdfObjectId||element.dataset?.objectId),element]));
  const objects=observations.map(observation=>{
    const element=elements.get(String(observation.objectId)),styleReader=options.getComputedStyle||globalThis.getComputedStyle?.bind(globalThis),computed=element?styleReader?.(element)||{}:{},hovered=options.hoveredObjectId!=null?String(options.hoveredObjectId)===String(observation.objectId):Boolean(element?.matches?.(":hover")),selected=options.selectedObjectId!=null?String(options.selectedObjectId)===String(observation.objectId):Boolean(element?.classList?.contains?.("is-selected")),editing=Boolean(element?.querySelector?.('[contenteditable="true"]'));
    const authority=resolvePdfInteractiveTextRect({objectId:observation.objectId,presentationTruthKind:observation.presentationTruthKind,sourceProjectionRect:observation.clientRect,expectedViewportRect:observation.expectedViewportRect,glyphInkRect:observation.inkUnion,domRect:observation.clientRect,padding:1});
    const interactive=authority.interactiveRect?namedRect(authority.interactiveRect,"client-css"):namedRect(rawNamedRect(observation.clientRect),"client-css");
    const domProjection=namedRect(rawNamedRect(observation.clientRect),"client-css");
    const projections={expectedViewport:observation.expectedViewportRect?namedRect(observation.expectedViewportRect,"pdf-viewport-css"):null,domLayout:domProjection,glyphInk:observation.inkUnion?namedRect(rawNamedRect(observation.inkUnion),"glyph-ink-client-css"):null,interactiveRect:interactive,hitTarget:domProjection,hoverOutline:hovered&&sharedHoverOutline?namedRect(sharedHoverOutline.getBoundingClientRect(),"hover-outline-client-css"):hovered?outlineProjection(observation,computed):null,selectedField:selected?domProjection:null,editableField:observation.editableRect?namedRect(rawNamedRect(observation.editableRect),"client-css"):null,sourceMask:null,replacementField:observation.ownerEditId?domProjection:null};
    const record={objectId:observation.objectId,presentationTruthKind:authority.presentationTruthKind,interactionAuthority:authority.interactionAuthority,interactionAuthorityReason:authority.interactionAuthorityReason,sourceProjectionRect:authority.sourceProjectionRect,domGlyphRect:authority.domGlyphRect,interactiveRect:authority.interactiveRect,domGlyphDelta:authority.domGlyphDelta,sourceObjectId:observation.sourceObjectId,ownerEditId:observation.ownerEditId,page:Number(block?.dataset?.currentPage||1),text:cleanText(element?.textContent),semantic:{kind:observation.ownerEditId?"replacement-text":"source-text-run"},interactiveGeometry:authority,visualState:{hovered,selected,editing,visible:observation.display!=="none"&&observation.visibility!=="hidden"&&observation.opacity!=="0",clipped:false,pointerReachable:observation.pointerEvents!=="none",zIndex:observation.zIndex},visualAncestry:deep?compactVisualAncestry(element,options.getComputedStyle||globalThis.getComputedStyle?.bind(globalThis)):undefined,projections};
    return record;
  });
  const relationships=[],issues=[...evaluatePageAlignment(geometry)];
  for(const object of objects){
    for(const [projection,reference,type] of [["hitTarget","glyphInk","hit-to-glyph"],["hoverOutline","glyphInk","hover-to-glyph"],["editableField","glyphInk","edit-to-glyph"],["selectedField","glyphInk","selected-to-glyph"]])if(object.projections[projection]&&object.projections[reference])relationships.push({from:object.objectId,to:`${projection}:${object.objectId}`,type,metrics:compareVisualRectangles(object.projections[reference],object.projections[projection],{a:reference,b:projection})});
    const checks=[["hitTarget","glyphInk","PDF_INTERACTIVE_RECT_GLYPH_MISMATCH"],["hoverOutline","glyphInk","HOVER_BOX_SHOULD_COVER_HIT_GLYPH"],["editableField","selectedField","EDITABLE_FIELD_SHOULD_REMAIN_ANCHORED_TO_SELECTED_FIELD"],["selectedField","glyphInk","SELECTED_FIELD_SHOULD_REMAIN_ANCHORED_TO_SOURCE"]];
    for(const check of checks){const issue=projectionIssue(object,...check);if(issue)issues.push(issue);}
  }
  const pointer=options.pointer||runtime.telemetry?.lastPointer||null;
  return {schemaVersion:PDF_DIAGNOSTIC_SCHEMA_VERSION,mode,page:Number(block?.dataset?.currentPage||1),viewport:geometry?.viewport||null,surface:geometry?.surface||null,canvas:geometry?.canvas||null,textLayer:geometry?.textLayer||null,scroll:geometry?.surface?{left:geometry.surface.scrollLeft,top:geometry.surface.scrollTop}:null,chrome:geometry?.chrome||null,objects,relationships,pointer,interaction:{hoveredObjectId:options.hoveredObjectId||null,selectedObjectId:options.selectedObjectId||null,editingObjectId:options.editingObjectId||null},issues,interactionTrace:runtime.telemetry?.interactions?.snapshot?.()||[],geometryMutationTrace:runtime.telemetry?.mutations?.snapshot?.()||[]};
}

export function findVisualObjectAtPoint(scene,point){return (scene?.objects||[]).filter(object=>{const rect=rawNamedRect(object.projections?.glyphInk||object.projections?.hitTarget);return rect&&distanceToRect(point,rect)===0;}).sort((a,b)=>Number(b.visualState?.zIndex||0)-Number(a.visualState?.zIndex||0))[0]||null;}
export function nearestVisibleGlyph(scene,point){return (scene?.objects||[]).filter(object=>object.visualState?.visible&&object.projections?.glyphInk).map(object=>({object,distance:distanceToRect(point,rawNamedRect(object.projections.glyphInk))})).sort((a,b)=>a.distance-b.distance)[0]||null;}
export function compareObjectProjection(scene,objectId,a,b){const object=(scene?.objects||[]).find(item=>String(item.objectId)===String(objectId));return object?.projections?.[a]&&object.projections[b]?compareVisualRectangles(object.projections[a],object.projections[b],{a,b}):null;}
export function objectsWhoseHitboxesDoNotMatchGlyphs(scene){return (scene?.objects||[]).filter(object=>{const metrics=compareObjectProjection(scene,object.objectId,"glyphInk","hitTarget");return metrics&&!['aligned','contains-glyphs'].includes(metrics.classification);});}
export function objectsWithUnexpectedVisualOverlap(scene){return (scene?.relationships||[]).filter(edge=>!["aligned","contains-glyphs"].includes(edge.metrics?.classification));}
export function firstGeometryDivergence(scene,objectId){const issue=(scene?.issues||[]).find(item=>String(item.objectId)===String(objectId)&&item.firstDivergence);return issue?.firstDivergence||null;}

// Compatibility bridge for PR #68's existing one-click Copy Page Diagnostics.
// The explicit API above is preferred for future callers, but the current UI
// does not yet thread its surface element through createPdfPageDiagnostics.
// Remember only a PDF diagnostics click; no continuous geometry work occurs.
let pendingDiagnosticRoot=null;
if(globalThis.document?.addEventListener){
  globalThis.document.addEventListener("click",event=>{
    const button=event.target?.closest?.(".pdf-copy-diagnostics");
    if(!button)return;
    pendingDiagnosticRoot=button.closest?.(".pdf-block")?.querySelector?.(".pdf-surface")||null;
  },true);
}
function consumeDiagnosticRoot(){const root=pendingDiagnosticRoot;pendingDiagnosticRoot=null;return root;}

export function diagnoseStateTransitions(captures) {
  const issues=[];if(!captures.length)return issues;
  const canonical=captures[0];
  for(const current of captures.slice(1)){
    const a=canonical.layoutRect,b=current.layoutRect;
    const delta=rectangleDelta(a,b);
    if(delta?.maxAbs>.25)issues.push({severity:"error",code:"STATE_CHANGED_GEOMETRY",from:canonical.state,to:current.state,delta});
    if(canonical.zIndex!==current.zIndex)issues.push({severity:"warning",code:"STATE_CHANGED_STACKING_ORDER",from:canonical.state,to:current.state});
    if(current.versionState==="historical"&&current.pointerEvents!=="none")issues.push({severity:"error",code:"STALE_OBJECT_HIT_TESTABLE",state:current.state,objectId:current.objectId});
  }return issues;
}

function enrichObservations(observations,objects,viewport,issues){
  const byId=new Map(objects.map(object=>[String(object.id),object]));
  return observations.map(observation=>{
    const canonical=byId.get(String(observation.objectId));
    if(!canonical)return observation;
    const expectedViewportRect=pdfRectThroughViewportTransform(canonical.pdfRect||canonical.rect||canonical.bounds,viewport?.transform);
    const layoutDelta=rectangleDelta(expectedViewportRect,observation.layoutRect);
    const inkDelta=rectangleDelta(expectedViewportRect,observation.inkViewportUnion||observation.inkUnion);
    if(layoutDelta?.maxAbs>1)issues.push({severity:"warning",code:"OBSERVED_LAYOUT_DRIFT",objectId:canonical.id,coordinateSpace:PDF_COORDINATE_SPACES.VIEWPORT_CSS_PIXELS,expected:expectedViewportRect,actual:observation.layoutRect,delta:layoutDelta});
    if(inkDelta?.maxAbs>2)issues.push({severity:"warning",code:"OBSERVED_INK_DRIFT",objectId:canonical.id,coordinateSpace:PDF_COORDINATE_SPACES.GLYPH_INK_VIEWPORT,expected:expectedViewportRect,actual:observation.inkUnion,delta:inkDelta});
    return {...observation,expectedViewportRect,layoutDelta,inkDelta};
  });
}

export function buildPdfDiagnosticSnapshot({page,pageBoxes={},viewport={},documentVersionId,objects=[],masks=[],observations=[],invariants=[],issues=[],pageGeometry=null,pointerHitTest=null,interactionJournal=[],mutationJournal=[],selectedObjectId=null,editingObjectId=null,visualScene=null}) {
  const allIssues=[...issues];
  const normalized=[];
  for(const object of objects){
    const rawRect=object.pdfRect||object.rect||object.bounds;
    const validation=validateFiniteRect(rawRect,{space:object.coordinateSpace||PDF_COORDINATE_SPACES.PDF_POINTS,allowZeroArea:object.kind==="replacement"&&object.text===""});
    normalized.push({...object,text:cleanText(object.text),geometry:{raw:validation.raw,canonical:validation.rect,space:validation.space,valid:validation.ok,errors:validation.errors}});
    for(const error of validation.errors)allIssues.push({severity:"error",code:`GEOMETRY_${error.code}`,objectId:object.id,field:error.field,rawValue:error.value});
  }
  for(const mask of masks){if(!mask.ownerEditId||!mask.sourceObjectIds?.length)allIssues.push({severity:"error",code:"MASK_OWNERSHIP_MISSING",objectId:mask.id});}
  const collisions=[];for(let i=0;i<normalized.length;i++)for(let j=i+1;j<normalized.length;j++){const collision=classifyPdfCollision({...normalized[i],rect:normalized[i].geometry.canonical},{...normalized[j],rect:normalized[j].geometry.canonical});if(collision)collisions.push(collision);}
  const root=!observations.length?consumeDiagnosticRoot():null;
  const observed=observations.length?observations:(root?capturePdfPageDomObservations(root,{masks}):[]);
  const enrichedObservations=enrichObservations(observed,normalized,viewport,allIssues);
  const countsByKind=Object.fromEntries([...new Set(normalized.map(o=>o.kind))].sort().map(kind=>[kind,normalized.filter(o=>o.kind===kind).length]));
  const issueCounts={};
  if(pageGeometry)allIssues.push(...evaluatePageAlignment(pageGeometry));
  if(pointerHitTest?.issues)allIssues.push(...pointerHitTest.issues);
  for(const mutation of mutationJournal)if(mutation?.issues)allIssues.push(...mutation.issues);
  for(const issue of allIssues){const key=`${issue.severity}:${issue.code}`;issueCounts[key]=(issueCounts[key]||0)+1;}
  return {schemaVersion:PDF_DIAGNOSTIC_SCHEMA_VERSION,page,pageBoxes,viewport,coordinateSpaceRegistry:PDF_COORDINATE_SPACES,documentVersionId:documentVersionId||"unknown",geometryTruthHierarchy:["raw-pdf-source","normalized-canonical-pdf","semantic","expected-viewport","observed-dom","observed-ink","hit-test","editable-field"],pageGeometry,visualScene,selectedObjectId,editingObjectId,pointerHitTest,interactionJournal,mutationJournal,objectCountsByKind:countsByKind,issueCounts:Object.fromEntries(Object.entries(issueCounts).sort()),objects:normalized.sort((a,b)=>String(a.id).localeCompare(String(b.id))),masks:[...masks].sort((a,b)=>String(a.id).localeCompare(String(b.id))),observations:enrichedObservations,collisions:collisions.sort((a,b)=>a.leftObjectId.localeCompare(b.leftObjectId)||a.rightObjectId.localeCompare(b.rightObjectId)),invariants,issues:allIssues.sort((a,b)=>a.code.localeCompare(b.code)||String(a.objectId||"").localeCompare(String(b.objectId||"")))};
}
