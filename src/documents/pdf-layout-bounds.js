/** Canonical PDF-point layout-boundary math. Browser coordinates never enter here. */
export const DEFAULT_PDF_MARGINS = Object.freeze({ left:36, right:36, top:36, bottom:36 });
export const DEFAULT_MINIMUM_CONTENT_SIZE = Object.freeze({ width:72, height:72 });

const finite = (value, fallback=0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const cleanRect = (rect={}) => ({
  x:finite(rect.x), y:finite(rect.y),
  width:Math.max(0,finite(rect.width)), height:Math.max(0,finite(rect.height))
});

export function normalizePdfMargins(pageBounds, margins=DEFAULT_PDF_MARGINS, options={}) {
  const page=cleanRect(pageBounds), requested={...DEFAULT_PDF_MARGINS,...margins};
  const minimum={
    width:Math.min(page.width,Math.max(0,finite(options.minimumWidth,DEFAULT_MINIMUM_CONTENT_SIZE.width))),
    height:Math.min(page.height,Math.max(0,finite(options.minimumHeight,DEFAULT_MINIMUM_CONTENT_SIZE.height)))
  };
  let left=Math.max(0,finite(requested.left,36));
  let right=Math.max(0,finite(requested.right,36));
  let bottom=Math.max(0,finite(requested.bottom,36));
  let top=Math.max(0,finite(requested.top,36));
  const horizontalCapacity=Math.max(0,page.width-minimum.width);
  const verticalCapacity=Math.max(0,page.height-minimum.height);
  if(left+right>horizontalCapacity){
    if(options.activeEdge==="left")left=Math.max(0,horizontalCapacity-right);
    else if(options.activeEdge==="right")right=Math.max(0,horizontalCapacity-left);
    else { const ratio=(left+right)?horizontalCapacity/(left+right):0;left*=ratio;right*=ratio; }
  }
  if(top+bottom>verticalCapacity){
    if(options.activeEdge==="top")top=Math.max(0,verticalCapacity-bottom);
    else if(options.activeEdge==="bottom")bottom=Math.max(0,verticalCapacity-top);
    else { const ratio=(top+bottom)?verticalCapacity/(top+bottom):0;top*=ratio;bottom*=ratio; }
  }
  return {left,right,top,bottom};
}

export function derivePdfContentRect(pageBounds, margins, options={}) {
  const page=cleanRect(pageBounds), normalized=normalizePdfMargins(page,margins,options);
  return {
    x:page.x+normalized.left,
    y:page.y+normalized.bottom,
    width:Math.max(0,page.width-normalized.left-normalized.right),
    height:Math.max(0,page.height-normalized.top-normalized.bottom)
  };
}

export function detectLayoutBoundViolations(rect, bounds, epsilon=1e-7) {
  const value=cleanRect(rect), limit=cleanRect(bounds), edges=[];
  if(value.x<limit.x-epsilon)edges.push("left");
  if(value.x+value.width>limit.x+limit.width+epsilon)edges.push("right");
  if(value.y<limit.y-epsilon)edges.push("bottom");
  if(value.y+value.height>limit.y+limit.height+epsilon)edges.push("top");
  return {
    inside:edges.length===0, edges,
    overflow:{
      left:Math.max(0,limit.x-value.x),
      right:Math.max(0,value.x+value.width-limit.x-limit.width),
      bottom:Math.max(0,limit.y-value.y),
      top:Math.max(0,value.y+value.height-limit.y-limit.height)
    }
  };
}

export function isRectInsideLayoutBounds(rect,bounds,epsilon) {
  return detectLayoutBoundViolations(rect,bounds,epsilon).inside;
}

export function constrainRectToLayoutBounds(rect,bounds,options={}) {
  const value=cleanRect(rect),limit=cleanRect(bounds);
  if(value.width>limit.width||value.height>limit.height){
    return {status:"overflow",rect:value,changed:false,delta:{dx:0,dy:0},violations:detectLayoutBoundViolations(value,limit),reason:"object-larger-than-content-bounds"};
  }
  const x=Math.min(Math.max(value.x,limit.x),limit.x+limit.width-value.width);
  const y=Math.min(Math.max(value.y,limit.y),limit.y+limit.height-value.height);
  const next={...value,x,y};
  const delta={dx:x-value.x,dy:y-value.y};
  return {status:delta.dx||delta.dy?"constrained":"inside",rect:next,changed:Boolean(delta.dx||delta.dy),delta,violations:detectLayoutBoundViolations(next,limit),anchor:options.anchor||null};
}

export function constrainTranslationToLayoutBounds(rect,desiredDelta,bounds) {
  const value=cleanRect(rect), requested={dx:finite(desiredDelta?.dx),dy:finite(desiredDelta?.dy)};
  const result=constrainRectToLayoutBounds({...value,x:value.x+requested.dx,y:value.y+requested.dy},bounds);
  if(result.status==="overflow")return {...result,requestedDelta:requested,actualDelta:{dx:0,dy:0},constrained:true};
  const actualDelta={dx:result.rect.x-value.x,dy:result.rect.y-value.y};
  return {...result,requestedDelta:requested,actualDelta,constrained:actualDelta.dx!==requested.dx||actualDelta.dy!==requested.dy};
}

export function constrainResizeToLayoutBounds(originalRect,desiredRect,bounds,options={}) {
  const original=cleanRect(originalRect),desired=cleanRect(desiredRect),limit=cleanRect(bounds);
  const minimumWidth=Math.max(0,finite(options.minimumWidth,2));
  const minimumHeight=Math.max(0,finite(options.minimumHeight,2));
  const anchor=options.anchor||"bottom-left";
  let x=desired.x,y=desired.y,width=Math.max(minimumWidth,desired.width),height=Math.max(minimumHeight,desired.height);
  if(options.preserveAspectRatio){
    const ratio=original.width/Math.max(original.height,1e-7);
    if(width/Math.max(height,1e-7)>ratio)width=height*ratio;else height=width/ratio;
  }
  if(anchor.includes("right"))x=original.x+original.width-width;
  if(anchor.includes("top"))y=original.y+original.height-height;
  width=Math.min(width,limit.width);height=Math.min(height,limit.height);
  const constrained=constrainRectToLayoutBounds({x,y,width,height},limit,{anchor});
  return {...constrained,resized:constrained.rect.width!==desired.width||constrained.rect.height!==desired.height};
}

export function reconcileEditableGeometryToContentBounds({edits=[],contentRect,policy="translate",page=null}={}) {
  const results=[];
  for(const edit of edits){
    if(page!=null&&Number(edit.page)!==Number(page))continue;
    const result=constrainRectToLayoutBounds(edit,contentRect);
    const objectId=edit.id||String(edit.index);
    if(result.status==="overflow"){results.push({...result,objectId,kind:edit.kind});continue;}
    if(result.changed&&policy==="translate")Object.assign(edit,result.rect);
    results.push({...result,objectId,kind:edit.kind});
  }
  return {status:results.some(item=>item.status==="overflow")?"overflow":results.some(item=>item.changed)?"reconciled":"unchanged",results,changed:results.filter(item=>item.changed).length,overflows:results.filter(item=>item.status==="overflow")};
}

export function createPdfMarginState(value={}) {
  return {
    guidesVisible:value.guidesVisible===true,
    constraintsEnabled:value.constraintsEnabled!==false,
    defaultMargins:{...DEFAULT_PDF_MARGINS,...value.defaultMargins},
    perPage:value.perPage&&typeof value.perPage==="object"?structuredClone(value.perPage):{}
  };
}

export function marginsForPage(state,page,pageBounds,options={}) {
  const requested=state?.perPage?.[String(page)]||state?.defaultMargins||DEFAULT_PDF_MARGINS;
  return normalizePdfMargins(pageBounds,requested,options);
}
