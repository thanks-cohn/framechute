/**
 * Deterministic, PDF-point semantic layout for a single page.
 *
 * This module deliberately has no PDF.js, DOM, or serializer dependency. Callers
 * adapt source items once at the model boundary; all queries then remain stable
 * across zooms and rerenders.
 */

const EPSILON = 0.01;
const OCCUPYING_KINDS = new Set([
  "source-text-run", "replacement-text", "free-text", "source-image",
  "inserted-image", "annotation", "link", "form-field", "vector-content",
  "unknown-content"
]);

const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const round = value => Math.round(number(value) * 1000) / 1000;

export function normalizeLayoutRect(rect = {}) {
  let x = number(rect.x), y = number(rect.y), width = number(rect.width), height = number(rect.height);
  if (width < 0) { x += width; width = -width; }
  if (height < 0) { y += height; height = -height; }
  return Object.freeze({ x:round(x), y:round(y), width:round(width), height:round(height) });
}

export function layoutRectsIntersect(a, b) {
  a = normalizeLayoutRect(a); b = normalizeLayoutRect(b);
  return a.x < b.x + b.width - EPSILON && a.x + a.width > b.x + EPSILON &&
    a.y < b.y + b.height - EPSILON && a.y + a.height > b.y + EPSILON;
}

export function horizontalOverlap(a, b) {
  return Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
}

export function verticalOverlap(a, b) {
  return Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
}

export function layoutDistance(a, b) {
  const dx = Math.max(a.x - (b.x + b.width), b.x - (a.x + a.width), 0);
  const dy = Math.max(a.y - (b.y + b.height), b.y - (a.y + a.height), 0);
  return Math.hypot(dx, dy);
}

function unionBounds(nodes) {
  const left = Math.min(...nodes.map(node => node.bounds.x));
  const bottom = Math.min(...nodes.map(node => node.bounds.y));
  const right = Math.max(...nodes.map(node => node.bounds.x + node.bounds.width));
  const top = Math.max(...nodes.map(node => node.bounds.y + node.bounds.height));
  return normalizeLayoutRect({ x:left, y:bottom, width:right-left, height:top-bottom });
}

function stableMemberId(prefix, page, ids) {
  // Member IDs already encode stable source identity. Length prefixes avoid
  // ambiguous concatenations without a random/hash dependency.
  return `${prefix}:p${page}:${ids.map(id => `${id.length}.${id}`).join("|")}`;
}

function sourceNode(run, index, page) {
  const sourceKey = run.sourceRef ?? run.id ?? index;
  const id = run.id || `source:p${page}:${String(sourceKey)}`;
  const angle = ((number(run.angle) % 360) + 360) % 360;
  return {
    id, page, kind:"source-text-run", bounds:normalizeLayoutRect(run.bounds),
    sourceRefs:Object.freeze([String(sourceKey)]), ownerId:null, parentId:null, childIds:Object.freeze([]),
    paintOrder:number(run.paintOrder, index), spatialOrder:null, readingOrder:null,
    provenance:"source", confidence:number(run.confidence, 1), editable:true, protected:false,
    text:String(run.text ?? ""), style:Object.freeze({ fontSize:number(run.fontSize, run.bounds?.height || 12), angle }),
    metadata:Object.freeze({ sourceIndex:number(run.sourceIndex, index), sourceRef:String(sourceKey) })
  };
}

function readingGeometry(node) {
  const angle = node.style?.angle || 0;
  const radians = angle * Math.PI / 180, ux = Math.cos(radians), uy = Math.sin(radians);
  const cx = node.bounds.x + node.bounds.width / 2, cy = node.bounds.y + node.bounds.height / 2;
  return { angle, inline:cx*ux+cy*uy, baseline:-cx*uy+cy*ux, ux, uy };
}

function reconstructLines(runs, page) {
  const groups = [];
  for (const run of runs) {
    const geometry = readingGeometry(run);
    const fontSize = Math.max(1, run.style.fontSize);
    let best = null;
    for (const group of groups) {
      const angleDelta = Math.abs(group.angle - geometry.angle);
      const baselineDelta = Math.abs(group.baseline - geometry.baseline);
      const inlineGap = Math.min(...group.runs.map(other => {
        const otherGeometry=readingGeometry(other);
        const otherExtent=(other.bounds.width*Math.abs(otherGeometry.ux)+other.bounds.height*Math.abs(otherGeometry.uy))/2;
        const extent=(run.bounds.width*Math.abs(geometry.ux)+run.bounds.height*Math.abs(geometry.uy))/2;
        return Math.max(0,Math.abs(otherGeometry.inline-geometry.inline)-otherExtent-extent);
      }));
      if (Math.min(angleDelta, 360-angleDelta) <= 2 && baselineDelta <= Math.max(2, fontSize*.35, group.fontSize*.35) &&
          inlineGap <= Math.max(fontSize,group.fontSize)*4) {
        if (!best || baselineDelta < best.delta) best = { group, delta:baselineDelta };
      }
    }
    if (!best) groups.push({ angle:geometry.angle, baseline:geometry.baseline, fontSize, runs:[run] });
    else {
      const group = best.group, count = group.runs.length;
      group.baseline = (group.baseline*count + geometry.baseline)/(count+1);
      group.fontSize = (group.fontSize*count + fontSize)/(count+1);
      group.runs.push(run);
    }
  }
  return groups.map(group => {
    group.runs.sort((a, b) => readingGeometry(a).inline-readingGeometry(b).inline || a.paintOrder-b.paintOrder || a.id.localeCompare(b.id));
    const childIds = group.runs.map(run => run.id);
    let text = "";
    const separators = [];
    for (let i=0; i<group.runs.length; i++) {
      const run = group.runs[i], previous = group.runs[i-1];
      if (previous && !/\s$/.test(text) && !/^\s/.test(run.text)) {
        const prior = readingGeometry(previous), current = readingGeometry(run);
        const priorExtent = (previous.bounds.width*Math.abs(prior.ux)+previous.bounds.height*Math.abs(prior.uy))/2;
        const currentExtent = (run.bounds.width*Math.abs(current.ux)+run.bounds.height*Math.abs(current.uy))/2;
        const gap = current.inline-currentExtent-(prior.inline+priorExtent);
        const averageCharacter = previous.text ? (priorExtent*2)/previous.text.length : group.fontSize*.5;
        if (gap > Math.max(1, averageCharacter*.35)) text += " ", separators.push(" ");
        else separators.push("");
      } else if (previous) {
        separators.push("");
      }
      text += run.text;
    }
    return {
      id:stableMemberId("line", page, childIds), page, kind:"text-line", bounds:unionBounds(group.runs),
      sourceRefs:Object.freeze(childIds), ownerId:null, parentId:null, childIds:Object.freeze(childIds),
      paintOrder:Math.min(...group.runs.map(run => run.paintOrder)), spatialOrder:null, readingOrder:null,
      provenance:"derived", confidence:.9, editable:false, protected:false, text,
      style:Object.freeze({ fontSize:round(group.fontSize), angle:round(group.angle) }), metadata:Object.freeze({ separators:Object.freeze(separators) })
    };
  });
}

function reconstructBlocks(lines, page) {
  const ordered = [...lines].sort((a,b) => b.bounds.y-a.bounds.y || a.bounds.x-b.bounds.x || a.id.localeCompare(b.id));
  const blocks = [];
  for (const line of ordered) {
    let candidate = null;
    for (const block of blocks) {
      const previous = block.lines.at(-1), gap = previous.bounds.y-(line.bounds.y+line.bounds.height);
      const leftDelta = Math.abs(previous.bounds.x-line.bounds.x);
      const widthRatio = Math.min(previous.bounds.width,line.bounds.width)/Math.max(previous.bounds.width,line.bounds.width,1);
      const typography = Math.abs(previous.style.fontSize-line.style.fontSize) <= Math.max(1, previous.style.fontSize*.18);
      if (Math.abs((previous.style.angle||0)-(line.style.angle||0)) <= 2 && gap >= -2 && gap <= Math.max(previous.style.fontSize*1.5, 8) &&
          leftDelta <= Math.max(4, previous.style.fontSize*.75) && widthRatio >= .35 && typography) {
        candidate = block; break;
      }
    }
    if (candidate) candidate.lines.push(line); else blocks.push({ lines:[line] });
  }
  return blocks.map(block => {
    const childIds = block.lines.map(line => line.id);
    return {
      id:stableMemberId("block",page,childIds), page, kind:"text-block", bounds:unionBounds(block.lines),
      sourceRefs:Object.freeze(block.lines.flatMap(line=>line.sourceRefs)), ownerId:null, parentId:null,
      childIds:Object.freeze(childIds), paintOrder:Math.min(...block.lines.map(line=>line.paintOrder)),
      spatialOrder:null, readingOrder:null, provenance:"derived", confidence:.75, editable:false, protected:false,
      text:block.lines.map(line=>line.text).join("\n"), style:Object.freeze({}), metadata:Object.freeze({})
    };
  });
}

function orderColumns(blocks) {
  const columns = [];
  for (const block of [...blocks].sort((a,b)=>a.bounds.x-b.bounds.x || b.bounds.y-a.bounds.y)) {
    let column = columns.find(candidate => candidate.some(other => horizontalOverlap(block.bounds, other.bounds) >= Math.min(block.bounds.width,other.bounds.width)*.25));
    if (!column) { column=[]; columns.push(column); }
    column.push(block);
  }
  columns.sort((a,b)=>Math.min(...a.map(n=>n.bounds.x))-Math.min(...b.map(n=>n.bounds.x)));
  const result=[];
  for (const column of columns) result.push(...column.sort((a,b)=>b.bounds.y-a.bounds.y || a.bounds.x-b.bounds.x || a.id.localeCompare(b.id)));
  return result;
}

function assignReadingOrder(blocks, pageBounds) {
  // First split the page at broad, spanning blocks. A heading or footer must
  // not become a bridge that joins otherwise independent columns. Each region
  // between spans is then clustered into columns independently.
  const spanWidth=Math.max(1,pageBounds.width*.6);
  const spanning=[],local=[];
  for(const block of blocks)(block.bounds.width>=spanWidth?spanning:local).push(block);
  spanning.sort((a,b)=>b.bounds.y-a.bounds.y||a.bounds.x-b.bounds.x||a.id.localeCompare(b.id));
  if(!spanning.length)return orderColumns(local);

  const regions=Array.from({length:spanning.length+1},()=>[]);
  for(const block of local){
    const center=block.bounds.y+block.bounds.height/2;
    let region=0;
    while(region<spanning.length&&center<spanning[region].bounds.y+spanning[region].bounds.height/2)region++;
    regions[region].push(block);
  }
  const result=[];
  for(let index=0;index<regions.length;index++){
    result.push(...orderColumns(regions[index]));
    if(index<spanning.length)result.push(spanning[index]);
  }
  return result;
}

function genericNode(data, page, fallbackId) {
  const provenance = data.provenance || (data.kind === "unknown-content" ? "unknown" : "user-authored");
  return {
    id:String(data.id || fallbackId), page, kind:data.kind, bounds:normalizeLayoutRect(data.bounds || data),
    sourceRefs:Object.freeze((data.sourceRefs || []).map(String)), ownerId:data.ownerId || null, parentId:data.parentId || null,
    childIds:Object.freeze((data.childIds || []).map(String)), paintOrder:number(data.paintOrder, Number.MAX_SAFE_INTEGER),
    spatialOrder:null, readingOrder:null, provenance, confidence:number(data.confidence, provenance === "unknown" ? 0 : 1),
    editable:data.editable !== false, protected:data.protected === true, text:String(data.text ?? ""),
    style:Object.freeze({ ...(data.style || {}) }), metadata:Object.freeze({ ...(data.metadata || {}) })
  };
}

function editNode(edit, page, index, sourceByIndex, lineByRun) {
  const replacement = edit.kind === "replacement" || edit.kind === "wrap" ||
    edit.sourceRunId != null || edit.sourceLineId != null || (edit.sourceRefs?.length > 0);
  const kind = edit.kind === "image" ? "inserted-image" : replacement ? "replacement-text" : "free-text";
  const sourceIndex=edit.sourceIndex ?? ((edit.kind === "replacement" || edit.kind === "wrap") ? edit.index : null);
  const source = replacement && sourceIndex != null ? sourceByIndex.get(Number(sourceIndex)) : null;
  const line = source ? lineByRun.get(source.id) : null;
  return genericNode({
    ...edit, kind, bounds:edit, id:edit.id || `edit:p${page}:${kind}:${index}`,
    sourceRefs:source ? [line?.id, source.id].filter(Boolean) : [], ownerId:line?.id || null,
    provenance:replacement ? "replacement" : "user-authored", text:edit.replacement ?? edit.text ?? "",
    metadata:{ sourceRunId:source?.id || null, sourceLineId:line?.id || null, sourceIndex:source?.metadata.sourceIndex ?? null,
      wrapText:edit.wrapText === true, detached:edit.detached === true }
  },page,`edit:p${page}:${index}`);
}

export function createPdfPageLayout({ page=1, pageBounds, sourceRuns=[], edits=[], regions=[], uncertain=false } = {}) {
  const bounds = normalizeLayoutRect(pageBounds);
  const runs = sourceRuns.map((run,index)=>sourceNode(run,index,page));
  const lines = reconstructLines(runs,page), blocks = reconstructBlocks(lines,page);
  const lineByRun = new Map();
  for (const line of lines) for (const id of line.childIds) lineByRun.set(id,line);
  const blockByLine = new Map();
  for (const block of blocks) for (const id of block.childIds) blockByLine.set(id,block);
  const sourceByIndex = new Map(runs.map(run=>[run.metadata.sourceIndex,run]));
  const editNodes = edits.filter(edit=>number(edit.page,page)===page).map((edit,index)=>editNode(edit,page,index,sourceByIndex,lineByRun));
  const regionNodes = regions.map((region,index)=>genericNode(region,page,`region:p${page}:${index}`));
  const pageNode = genericNode({ id:`page:p${page}`, kind:"page-region", bounds, provenance:"source", editable:false,
    childIds:[...blocks.map(n=>n.id),...editNodes.map(n=>n.id),...regionNodes.map(n=>n.id)] },page,`page:p${page}`);

  // Wire immutable hierarchy after reconstruction.
  for (const run of runs) run.parentId = lineByRun.get(run.id)?.id || null;
  for (const line of lines) line.parentId = blockByLine.get(line.id)?.id || null;
  for (const block of blocks) block.parentId = pageNode.id;
  for (const node of [...editNodes,...regionNodes]) node.parentId ||= pageNode.id;

  const freeTextNodes=editNodes.filter(node=>node.kind==="free-text");
  const readingBlocks = assignReadingOrder([...blocks,...freeTextNodes],bounds);
  const readingNodes=[];
  for (const block of readingBlocks) {
    block.readingOrder=readingNodes.length;
    if(block.kind==="free-text"){readingNodes.push(block);continue;}
    const blockLines=block.childIds.map(id=>lines.find(line=>line.id===id));
    for (const line of blockLines) {
      line.readingOrder=readingNodes.length; readingNodes.push(line);
      for (const id of line.childIds) runs.find(run=>run.id===id).readingOrder=line.readingOrder;
    }
  }
  // Independent free text is placed spatially; replacements retain their
  // source line slot even when physically moved or painted later.
  for (const edit of editNodes) {
    if (edit.metadata.sourceLineId) edit.readingOrder=lines.find(line=>line.id===edit.metadata.sourceLineId)?.readingOrder ?? null;
    // Free text has already participated in the same page segmentation as
    // reconstructed source blocks above.
  }
  readingNodes.forEach((node,index)=>node.readingOrder=index);

  const nodes=[pageNode,...runs,...lines,...blocks,...editNodes,...regionNodes];
  nodes.filter(node=>node!==pageNode).sort((a,b)=>a.bounds.x-b.bounds.x || a.bounds.y-b.bounds.y || a.id.localeCompare(b.id))
    .forEach((node,index)=>node.spatialOrder=index);
  const byId=new Map(nodes.map(node=>[node.id,node]));
  const api = buildQueryApi({ page, bounds, nodes, byId, readingNodes, runs, lines, blocks, editNodes, uncertain });
  return Object.freeze(api);
}

function buildQueryApi(state) {
  const {page,bounds,nodes,byId,readingNodes,runs,lines,blocks,editNodes,uncertain}=state;
  const resolve=value=>typeof value === "string" ? byId.get(value) : value;
  const queryNodes=nodes.filter(node=>node.kind!=="page-region");
  const api={
    page, bounds, nodes:Object.freeze(nodes),
    get:id=>byId.get(id) || null,
    children:id=>Object.freeze((byId.get(id)?.childIds || []).map(child=>byId.get(child)).filter(Boolean)),
    parent:id=>byId.get(byId.get(id)?.parentId) || null,
    intersections:rect=>Object.freeze(queryNodes.filter(node=>layoutRectsIntersect(node.bounds,rect))),
    containedBy:rect=>Object.freeze(queryNodes.filter(node=>node.bounds.x>=rect.x-EPSILON&&node.bounds.y>=rect.y-EPSILON&&node.bounds.x+node.bounds.width<=rect.x+rect.width+EPSILON&&node.bounds.y+node.bounds.height<=rect.y+rect.height+EPSILON)),
    containing:point=>Object.freeze(queryNodes.filter(node=>point.x>=node.bounds.x&&point.x<=node.bounds.x+node.bounds.width&&point.y>=node.bounds.y&&point.y<=node.bounds.y+node.bounds.height)),
    neighbors:rect=>neighbors(queryNodes,rect),
    classifyOverlap:(left,right)=>classifyOverlap(resolve(left),resolve(right)),
    sourceLineage:id=>sourceLineage(byId,id),
    readingOrder:()=>Object.freeze([...readingNodes]),
    nextInReadingOrder:(id,direction=1)=>{const node=resolve(id),exact=readingNodes.findIndex(item=>item.id===node?.id),index=exact>=0?exact:number(node?.readingOrder,-1);return index<0?null:readingNodes[index+Math.sign(direction)]||null;},
    freeSpace:constraints=>deriveFreeSpace(bounds,queryNodes,constraints,uncertain),
    extractText:options=>extractSemanticText({runs,lines,blocks,editNodes,readingNodes},options)
  };
  return api;
}

function neighbors(nodes, rect) {
  const candidates=nodes.filter(node=>node.bounds!==rect&&!layoutRectsIntersect(node.bounds,rect));
  const centerX=rect.x+rect.width/2,centerY=rect.y+rect.height/2;
  const nearest=list=>list.sort((a,b)=>layoutDistance(a.bounds,rect)-layoutDistance(b.bounds,rect)||a.id.localeCompare(b.id))[0]||null;
  return Object.freeze({
    above:nearest(candidates.filter(n=>n.bounds.y>=rect.y+rect.height-EPSILON&&n.bounds.x+n.bounds.width>=rect.x&&n.bounds.x<=rect.x+rect.width)),
    below:nearest(candidates.filter(n=>n.bounds.y+n.bounds.height<=rect.y+EPSILON&&n.bounds.x+n.bounds.width>=rect.x&&n.bounds.x<=rect.x+rect.width)),
    left:nearest(candidates.filter(n=>n.bounds.x+n.bounds.width<=rect.x+EPSILON&&n.bounds.y+n.bounds.height>=rect.y&&n.bounds.y<=rect.y+rect.height)),
    right:nearest(candidates.filter(n=>n.bounds.x>=rect.x+rect.width-EPSILON&&n.bounds.y+n.bounds.height>=rect.y&&n.bounds.y<=rect.y+rect.height)),
    center:Object.freeze({x:centerX,y:centerY})
  });
}

export function classifyOverlap(left, right) {
  if (!left || !right || !layoutRectsIntersect(left.bounds,left===right?{x:Infinity,y:Infinity,width:0,height:0}:right.bounds)) return "safe";
  if (left.ownerId && (left.ownerId===right.id || left.ownerId===right.ownerId)) return "owned";
  if (right.ownerId && (right.ownerId===left.id || right.ownerId===left.ownerId)) return "owned";
  if (left.sourceRefs?.includes(right.id) || right.sourceRefs?.includes(left.id)) return "owned";
  if (left.kind==="unknown-content" || right.kind==="unknown-content") return "unknown";
  const image=left.kind==="inserted-image"?left:right.kind==="inserted-image"?right:null;
  if (image && image.metadata.wrapText===false) return "intentional-overlay";
  if (image && image.metadata.wrapText===true) return "warning";
  if (left.kind==="annotation" || right.kind==="annotation") return "intentional-overlay";
  if (left.provenance==="replacement" || right.provenance==="replacement") return "destructive";
  return left.editable && right.editable ? "destructive" : "warning";
}

function sourceLineage(byId,id) {
  const seen=new Set(),result=[];
  const visit=current=>{
    if(!current||seen.has(current.id))return;seen.add(current.id);result.push(current);
    for(const ref of current.sourceRefs||[]) visit(byId.get(ref));
    if(current.ownerId)visit(byId.get(current.ownerId));
  };
  visit(byId.get(id)); return Object.freeze(result);
}

function deriveFreeSpace(pageBounds,nodes,constraints={},uncertain=false) {
  const minimumWidth=Math.max(0,number(constraints.minWidth)),minimumHeight=Math.max(0,number(constraints.minHeight));
  const maxCandidates=Math.max(1,Math.min(256,number(constraints.maxCandidates,64)));
  const blockers=nodes.filter(node=>OCCUPYING_KINDS.has(node.kind)||node.metadata?.spatialState==="reserved")
    .map(node=>({node,bounds:node.bounds}));
  const bottom=pageBounds.y,top=pageBounds.y+pageBounds.height,left=pageBounds.x,right=pageBounds.x+pageBounds.width;
  const events=new Map([[bottom,[]],[top,[]]]);
  for(const blocker of blockers){
    const start=Math.max(bottom,blocker.bounds.y),end=Math.min(top,blocker.bounds.y+blocker.bounds.height);
    if(end<=start)continue;
    if(!events.has(start))events.set(start,[]);if(!events.has(end))events.set(end,[]);
    events.get(start).push({type:"add",blocker});events.get(end).push({type:"remove",blocker});
  }
  const levels=[...events.keys()].sort((a,b)=>a-b),active=new Set(),free=[];
  const remember=rect=>{
    if(rect.width<minimumWidth||rect.height<minimumHeight)return;
    const prior=free.find(item=>item.x===rect.x&&item.width===rect.width&&Math.abs(item.y+item.height-rect.y)<EPSILON);
    if(prior)prior.height=round(prior.height+rect.height);else free.push({...rect});
    free.sort((a,b)=>b.width*b.height-a.width*a.height||a.x-b.x||b.y-a.y);
    if(free.length>maxCandidates)free.length=maxCandidates;
  };
  for(let index=0;index<levels.length-1;index++){
    const y=levels[index],nextY=levels[index+1];
    for(const event of events.get(y)||[])if(event.type==="remove")active.delete(event.blocker);
    for(const event of events.get(y)||[])if(event.type==="add")active.add(event.blocker);
    if(nextY-y<EPSILON)continue;
    const intervals=[...active].map(({bounds})=>[Math.max(left,bounds.x),Math.min(right,bounds.x+bounds.width)])
      .filter(([start,end])=>end>start).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
    let cursor=left;
    for(const [start,end] of intervals){if(start>cursor)remember({x:round(cursor),y:round(y),width:round(start-cursor),height:round(nextY-y)});cursor=Math.max(cursor,end);}
    if(cursor<right)remember({x:round(cursor),y:round(y),width:round(right-cursor),height:round(nextY-y)});
  }
  free.sort((a,b)=>b.width*b.height-a.width*a.height||a.x-b.x||b.y-a.y);
  const hasUnknown=uncertain||nodes.some(node=>node.kind==="unknown-content");
  return Object.freeze({ regions:Object.freeze(free.map(normalizeLayoutRect)), complete:!hasUnknown, hasUnknown });
}

function extractSemanticText({runs,lines,blocks,editNodes,readingNodes},{applyEdits=true}={}) {
  const replacements=new Map();
  for(const edit of editNodes)if(applyEdits&&edit.kind==="replacement-text"&&edit.metadata.sourceRunId)replacements.set(edit.metadata.sourceRunId,edit.text);
  const blockByLine=new Map();for(const block of blocks)for(const id of block.childIds)blockByLine.set(id,block.id);
  const output=[];
  for(const node of readingNodes){
    if(node.kind==="free-text"){if(node.text.trim())output.push({text:node.text,block:`free:${node.id}`});continue;}
    if(node.kind!=="text-line")continue;
    let text="";
    for(let index=0;index<node.childIds.length;index++){const id=node.childIds[index],run=runs.find(item=>item.id===id),value=replacements.has(id)?replacements.get(id):run.text;if(index)text+=node.metadata.separators[index-1]||"";text+=value;}
    const block=blockByLine.get(node.id);if(text.trim())output.push({text,block});
  }
  let result="",priorBlock=null;
  for(const item of output){if(result)result+=item.block===priorBlock?"\n":"\n\n";result+=item.text;priorBlock=item.block;}
  return result;
}

/** A tiny per-document LRU. It retains factories, never page bytes or canvases. */
export function createPdfLayoutCache({ maxPages=3 }={}) {
  const cache=new Map(),versions=new Map();
  return Object.freeze({
    get(page,builder){
      const existing=cache.get(page);if(existing){cache.delete(page);cache.set(page,existing);return existing.layout;}
      const layout=builder();cache.set(page,{layout,version:versions.get(page)||0});
      while(cache.size>Math.max(1,maxPages))cache.delete(cache.keys().next().value);
      return layout;
    },
    peek:page=>cache.get(page)?.layout||null,
    invalidate(page){if(page==null){cache.clear();versions.clear();return;}cache.delete(page);versions.set(page,(versions.get(page)||0)+1);},
    get size(){return cache.size;}
  });
}
