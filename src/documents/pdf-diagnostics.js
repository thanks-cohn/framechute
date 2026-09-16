import { pdfRectToViewportRect, viewportRectToPdf } from "./pdf-geometry.js";

const round=value=>Math.round((Number(value)||0)*1000)/1000;
const rect=value=>value&&({left:round(value.left),top:round(value.top),width:round(value.width),height:round(value.height)});
const pdfRect=value=>value&&({x:round(value.x),y:round(value.y),width:round(value.width),height:round(value.height)});
const finiteRect=value=>value&&Object.values(value).every(Number.isFinite)&&value.width>=0&&value.height>=0;
const intersects=(a,b)=>a&&b&&a.left<b.left+b.width&&a.left+a.width>b.left&&a.top<b.top+b.height&&a.top+a.height>b.top;
const delta=(actual,expected)=>actual&&expected?rect({left:actual.left-expected.left,top:actual.top-expected.top,width:actual.width-expected.width,height:actual.height-expected.height}):null;
const union=values=>{if(!values.length)return null;const left=Math.min(...values.map(v=>v.left)),top=Math.min(...values.map(v=>v.top)),right=Math.max(...values.map(v=>v.left+v.width)),bottom=Math.max(...values.map(v=>v.top+v.height));return rect({left,top,width:right-left,height:bottom-top});};

export function observePdfTextInk(element, origin={left:0,top:0}) {
  const target=element?.querySelector?.(".pdf-edit-text")||element;
  if(!target)return {inkRects:[],unionInkRect:null,fontMetrics:null};
  const ranges=[];
  for(const node of target.childNodes||[])if(node.nodeType===3&&node.data.length){const range=document.createRange();range.selectNodeContents(node);ranges.push(...range.getClientRects());}
  const inkRects=ranges.map(value=>rect({left:value.left-origin.left,top:value.top-origin.top,width:value.width,height:value.height}));
  const style=getComputedStyle(target),metrics=measureFont(target.textContent,style);
  return {inkRects,unionInkRect:union(inkRects),fontMetrics:metrics};
}

function measureFont(text,style) {
  if(typeof document==="undefined")return null;
  const canvas=document.createElement("canvas"),context=canvas.getContext?.("2d");if(!context)return null;
  context.font=style.font;const value=context.measureText(String(text||""));
  return {actualBoundingBoxAscent:round(value.actualBoundingBoxAscent),actualBoundingBoxDescent:round(value.actualBoundingBoxDescent),width:round(value.width),font:style.font};
}

function observedRecord(element,rootRect,expected) {
  if(!element)return null;const box=element.getBoundingClientRect(),layoutRect=rect({left:box.left-rootRect.left,top:box.top-rootRect.top,width:box.width,height:box.height});
  const ink=element.matches?.(".pdf-text-item")?observePdfTextInk(element,rootRect):{inkRects:[],unionInkRect:null,fontMetrics:null};
  const style=getComputedStyle(element),clipRect=style.overflow==="visible"?null:layoutRect;
  return {...ink,layoutRect,clipRect,deltaFromExpected:delta(layoutRect,expected),overflow:Boolean(ink.unionInkRect&&(ink.unionInkRect.left<layoutRect.left||ink.unionInkRect.top<layoutRect.top||ink.unionInkRect.left+ink.unionInkRect.width>layoutRect.left+layoutRect.width||ink.unionInkRect.top+ink.unionInkRect.height>layoutRect.top+layoutRect.height)),clipped:Boolean(clipRect&&ink.unionInkRect&&!contains(clipRect,ink.unionInkRect))};
}
const contains=(outer,inner)=>inner.left>=outer.left&&inner.top>=outer.top&&inner.left+inner.width<=outer.left+outer.width&&inner.top+inner.height<=outer.top+outer.height;

export function readPdfVisualState(element,label="idle") {
  if(!element)return {[label]:null};const style=getComputedStyle(element);
  return {[label]:{classes:[...element.classList].sort(),display:style.display,visibility:style.visibility,opacity:style.opacity,position:style.position,transform:style.transform,width:style.width,height:style.height,overflow:style.overflow,clipPath:style.clipPath,zIndex:style.zIndex,pointerEvents:style.pointerEvents,font:style.font}};
}

/** Build a compact one-page record. Observations are instrumentation only. */
export function buildPdfPageDiagnosticSnapshot({page,layout,viewport,edits=[],masks=[],textLayer=null,state="idle",devicePixelRatio=1,pageBoxes={}}) {
  const rootRect=textLayer?.getBoundingClientRect?.()||{left:0,top:0};
  const masksByIndex=new Map();masks.forEach((mask,index)=>{const id=`mask:p${page}:${mask.maskRole||"source"}:${mask.maskIndex??index}`;masksByIndex.set(id,mask);});
  const semantic=(layout?.nodes||[]).filter(node=>node.kind!=="page-region").map(node=>({node,id:node.id,page,kind:node.kind,pdf:pdfRect(node.bounds),sourceRefs:[...(node.sourceRefs||[])],parentId:node.parentId,childIds:[...(node.childIds||[])],readingOrder:node.readingOrder,paintOrder:node.paintOrder,provenance:node.provenance,text:String(node.text||"").slice(0,160)}));
  const records=[];
  for(const item of semantic){
    const expected=rect(pdfRectToViewportRect(viewport,item.node.bounds));
    const roundTrip=pdfRect(viewportRectToPdf(viewport,expected));
    const element=textLayer?.querySelector?.(`[data-pdf-object-id="${cssEscape(item.id)}"]`)||null;
    const edit=edits.find(value=>String(value.id)===item.id);
    const save=edit?{drawRect:pdfRect(edit),drawBaseline:round(edit.y),font:edit.fontFamily||"Helvetica",fontSize:edit.fontSize||12}:null;
    records.push({...item,node:undefined,version:edit?.version||"current",viewport:{space:"viewport-css-px",expectedRect:expected,scale:round(viewport.scale),rotation:viewport.rotation||0,roundTripPdfRect:roundTrip},observed:observedRecord(element,rootRect,expected),save,state:readPdfVisualState(element,state),relationships:{parentId:item.parentId,childIds:item.childIds,neighbors:neighborIds(layout,item.id),collisions:[]},layer:layerRecord(element,item.kind)});
  }
  for(const [id,mask] of masksByIndex){const expected=rect(pdfRectToViewportRect(viewport,mask)),element=textLayer?.querySelector?.(`[data-pdf-object-id="${cssEscape(id)}"]`)||null;records.push({id,page,kind:"mask",version:"current",provenance:"derived",sourceRefs:[],pdf:pdfRect(mask),viewport:{space:"viewport-css-px",expectedRect:expected,scale:round(viewport.scale),rotation:viewport.rotation||0},observed:observedRecord(element,rootRect,expected),save:{eraseRects:[pdfRect(mask)],ownerId:mask.maskOwnerId||null},state:readPdfVisualState(element,state),relationships:{parentId:mask.maskOwnerId||null,childIds:[],neighbors:{},collisions:[]},layer:layerRecord(element,"mask")});}
  for(const edit of edits.filter(value=>Number(value.page)===Number(page))){const id=String(edit.id||`${edit.kind||"replacement"}:p${page}:${edit.index}`);if(records.some(value=>value.id===id))continue;const expected=rect(pdfRectToViewportRect(viewport,edit)),element=textLayer?.querySelector?.(`[data-pdf-object-id="${cssEscape(id)}"]`)||null;records.push({id,page,kind:edit.kind||"replacement",version:edit.version||"current",provenance:"user-authored",sourceRefs:edit.sourceRefs||[],pdf:pdfRect(edit),viewport:{space:"viewport-css-px",expectedRect:expected,scale:round(viewport.scale),rotation:viewport.rotation||0},observed:observedRecord(element,rootRect,expected),save:{drawRect:pdfRect(edit),drawBaseline:round(edit.y),font:edit.fontFamily||"Helvetica",fontSize:edit.fontSize||12},state:readPdfVisualState(element,state),relationships:{parentId:null,childIds:[],neighbors:{},collisions:[]},layer:layerRecord(element,edit.kind)});}
  for(const item of records)item.relationships.collisions=records.filter(other=>other!==item&&intersects(item.observed?.unionInkRect||item.observed?.layoutRect||item.viewport.expectedRect,other.viewport.expectedRect)).map(other=>other.id);
  const snapshot={schemaVersion:1,page,version:"current",pageBoxes:{media:pdfRect(pageBoxes.media||layout?.bounds),crop:pdfRect(pageBoxes.crop||layout?.bounds)},viewport:{space:"viewport-css-px",width:round(viewport.width),height:round(viewport.height),scale:round(viewport.scale),rotation:viewport.rotation||0,devicePixelRatio},layers:["original-canvas","source-mask","replacement-text","inserted-image","annotation","selection-ui"],objects:records};
  snapshot.issues=validatePdfPageSnapshot(snapshot);return snapshot;
}

function cssEscape(value){return globalThis.CSS?.escape?CSS.escape(value):String(value).replace(/["\\]/g,"\\$&");}
function neighborIds(layout,id){const node=layout?.get?.(id);if(!node)return {};const value=layout.neighbors(node.bounds);return Object.fromEntries(Object.entries(value).filter(([key])=>key!=="center").map(([key,item])=>[key,item?.id||null]));}
function layerRecord(element,kind){return {logical:kind==="mask"?"source-mask":kind==="image"?"inserted-image":kind.includes?.("text")?"replacement-text":"semantic",zIndex:element?getComputedStyle(element).zIndex:null,stackingContext:Boolean(element&&getComputedStyle(element).transform!=="none")};}

export function validatePdfPageSnapshot(snapshot,{tolerance=.75}={}) {
  const issues=[],ids=new Set();const add=(code,severity,objectIds,message,expected=null,actual=null)=>issues.push({code,severity,objectIds,expected,actual,message});
  for(const object of snapshot.objects||[]){
    if(ids.has(object.id))add("DUPLICATE_STABLE_ID","error",[object.id],"Stable object ID occurs more than once.");ids.add(object.id);
    if(object.version!=="current")add(object.observed?"HISTORICAL_OBJECT_RENDERED":"CURRENT_STATE_CONTAINS_SUPERSEDED_OBJECT","error",[object.id],"Only current-version objects may participate in the active page.");
    if(!finiteRect(object.pdf))add("NON_FINITE_PDF_GEOMETRY","error",[object.id],"Object has invalid or negative PDF geometry.","finite normalized PDF rect",object.pdf);
    if(!finiteRect(object.viewport?.expectedRect))add("NON_FINITE_VIEWPORT_GEOMETRY","error",[object.id],"PDF to viewport geometry is invalid.");
    if(object.viewport?.roundTripPdfRect&&Math.max(...Object.keys(object.pdf).map(key=>Math.abs(object.pdf[key]-object.viewport.roundTripPdfRect[key])))>tolerance)add("PDF_VIEWPORT_ROUND_TRIP_MISMATCH","error",[object.id],"PDF to viewport to PDF geometry exceeds tolerance.",object.pdf,object.viewport.roundTripPdfRect);
    if(object.observed?.deltaFromExpected&&Math.max(...Object.values(object.observed.deltaFromExpected).map(Math.abs))>tolerance)add("OBSERVED_GEOMETRY_MISMATCH","warning",[object.id],"Observed DOM layout differs from canonical expected geometry.",object.viewport.expectedRect,object.observed.layoutRect);
    if(object.observed?.overflow)add("INK_OUTSIDE_OWNER","warning",[object.id],"Visible text ink extends outside its layout owner.",object.observed.layoutRect,object.observed.unionInkRect);
    if(object.observed?.clipped)add("GLYPH_INK_CLIPPED","error",[object.id],"Visible text ink is clipped by its owner.");
    if(object.kind==="mask"&&!object.save?.ownerId)add("MASK_WITHOUT_OWNER","error",[object.id],"Every erase mask must identify its owner.");
  }
  return issues;
}

export function comparePdfDiagnosticSnapshots(live,saved,{tolerance=.75}={}) {
  const issues=[],liveById=new Map((live.objects||[]).map(value=>[value.id,value])),savedById=new Map((saved.objects||[]).map(value=>[value.id,value]));
  for(const object of live.objects||[]){const other=savedById.get(object.id);if(!other){issues.push({code:"SAVE_REOPEN_MISSING_OBJECT",severity:"error",objectIds:[object.id],message:"Current live object is absent after Save + reopen."});continue;}const a=object.pdf,b=other.pdf;if(a&&b&&Math.max(...Object.keys(a).map(key=>Math.abs(a[key]-b[key])))>tolerance)issues.push({code:"LIVE_SAVE_GEOMETRY_MISMATCH",severity:"error",objectIds:[object.id],expected:a,actual:b,message:"Saved/reopened geometry differs from live canonical geometry."});}
  for(const object of saved.objects||[])if(!liveById.has(object.id)||object.version!=="current")issues.push({code:"SAVE_REOPEN_RESURRECTED_TEXT",severity:"error",objectIds:[object.id],message:"Saved/reopened page contains a non-current object."});
  return issues;
}
