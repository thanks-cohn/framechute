import { constrainTranslationToLayoutBounds } from "./pdf-layout-bounds.js";

const number=value=>Number.isFinite(Number(value))?Number(value):0;
const rect=value=>({x:number(value?.x),y:number(value?.y),width:Math.max(0,number(value?.width)),height:Math.max(0,number(value?.height))});

export function unionPdfRects(values=[]) {
  const rectangles=values.filter(Boolean).map(rect);
  if(!rectangles.length)return {x:0,y:0,width:0,height:0};
  const left=Math.min(...rectangles.map(item=>item.x));
  const bottom=Math.min(...rectangles.map(item=>item.y));
  const right=Math.max(...rectangles.map(item=>item.x+item.width));
  const top=Math.max(...rectangles.map(item=>item.y+item.height));
  return {x:left,y:bottom,width:right-left,height:top-bottom};
}

export function stablePdfContentGroupId({page=1,kind="free-object-group",members=[]}={}) {
  const ids=members.map(member=>String(member.id??member.objectId??member.index)).sort();
  let hash=2166136261;
  for(const character of `${page}|${kind}|${ids.join("|")}`){hash^=character.charCodeAt(0);hash=Math.imul(hash,16777619);}
  return `pdf-group:p${page}:${kind}:${(hash>>>0).toString(36)}`;
}

export function createPdfContentGroup({id,page=1,kind="free-object-group",members=[],provenance="user-authored",confidence=1,semanticParentId=null,layoutGroupId=null,childGroupIds=[],readingOrder=null,spatialOrder=null,metadata={}}={}) {
  const normalizedMembers=members.map((member,index)=>({
    id:String(member.id??member.objectId??member.index??`member-${index}`),
    sourceObjectId:member.sourceObjectId??null,
    ownerEditId:member.ownerEditId??null,
    kind:member.kind||"object",
    rect:rect(member.rect||member)
  }));
  const bounds=unionPdfRects(normalizedMembers.map(member=>member.rect));
  const withLocal=normalizedMembers.map(member=>({...member,localRect:{...member.rect,x:member.rect.x-bounds.x,y:member.rect.y-bounds.y}}));
  const group={id:id||stablePdfContentGroupId({page,kind,members:withLocal}),page,kind,memberIds:withLocal.map(member=>member.id),members:withLocal,bounds,provenance,confidence,semanticParentId,layoutGroupId,childGroupIds:[...childGroupIds],readingOrder,spatialOrder,metadata:{...metadata}};
  return group;
}

export function translatePdfContentGroup(group,desiredDelta,contentRect) {
  const movement=constrainTranslationToLayoutBounds(group.bounds,desiredDelta,contentRect);
  if(movement.status==="overflow")return {...movement,group,translatedMembers:group.members.map(member=>({...member,rect:{...member.rect}}))};
  const {dx,dy}=movement.actualDelta;
  const bounds={...group.bounds,x:group.bounds.x+dx,y:group.bounds.y+dy};
  const translatedMembers=group.members.map(member=>({...member,rect:{x:bounds.x+member.localRect.x,y:bounds.y+member.localRect.y,width:member.localRect.width,height:member.localRect.height}}));
  return {...movement,group:{...group,bounds,members:translatedMembers},translatedMembers};
}

export function contentGroupsFromPdfLayout(layout,{includeEdits=true}={}) {
  const nodes=layout?.nodes||layout?.allNodes||[];
  const byId=new Map(nodes.map(node=>[node.id,node]));
  const groups=[];
  for(const node of nodes){
    if(node.kind!=="text-block")continue;
    const memberRefs=node.childIds||node.memberIds||node.children||[];
    const members=memberRefs
      .map(value=>typeof value==="object"?value:byId.get(value))
      .filter(Boolean)
      .map(member=>({
        id:member.id,
        sourceObjectId:member.sourceObjectId??null,
        ownerEditId:member.ownerEditId??null,
        kind:member.kind||"text-line",
        rect:member.bounds||member.rect||member
      }));
    if(members.length)groups.push(createPdfContentGroup({
      id:node.id,
      page:layout.page,
      kind:"text-block",
      members,
      provenance:node.provenance||"derived-layout",
      confidence:node.confidence??1,
      semanticParentId:node.parentId??null,
      readingOrder:node.readingOrder,
      spatialOrder:node.spatialOrder,
      metadata:{sourceRefs:[...(node.sourceRefs||[])]}
    }));
  }
  if(includeEdits){
    for(const node of nodes){
      if(node.kind!=="inserted-image")continue;
      groups.push(createPdfContentGroup({
        page:layout.page,
        kind:"image-block",
        members:[{
          id:node.id,
          sourceObjectId:node.sourceObjectId??null,
          ownerEditId:node.ownerEditId??node.id,
          kind:"image",
          rect:node.bounds||node.rect||node
        }],
        provenance:node.provenance||"user-authored",
        confidence:node.confidence??1,
        semanticParentId:node.parentId??null,
        readingOrder:node.readingOrder,
        spatialOrder:node.spatialOrder,
        metadata:{sourceRefs:[...(node.sourceRefs||[])]}
      }));
    }
  }
  return groups;
}
