import { unzipSync, zipSync, strFromU8, strToU8 } from "../vendor/fflate.mjs";

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const M = "http://schemas.openxmlformats.org/officeDocument/2006/math";
const REL = "http://schemas.openxmlformats.org/package/2006/relationships";
const IMAGE_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image";
const HYPERLINK_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink";
const CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const local = (node) => node?.localName || node?.nodeName?.split(":").pop();
const children = (node, name) => [...(node?.children || [])].filter((item) => local(item) === name);
const descendant = (node, name) => [...(node?.getElementsByTagNameNS?.(W, name) || [])];
const esc = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escAttr = (value) => esc(value).replace(/"/g, "&quot;").replace(/'/g, "&apos;");
const ooxmlColor = (value) => { const text=String(value||"").trim();if(/^#[0-9a-f]{6}$/i.test(text))return text.slice(1).toUpperCase();const rgb=/rgba?\(\s*(\d+)\D+(\d+)\D+(\d+)/i.exec(text);return rgb?rgb.slice(1,4).map(part=>Number(part).toString(16).padStart(2,"0")).join("").toUpperCase():/^[0-9a-f]{6}$/i.test(text)?text.toUpperCase():""; };

const allDescendants = (node, name) => [...(node?.getElementsByTagName?.("*") || [])].filter((item) => local(item) === name);
const attribute = (node, namespace, plain) => node?.getAttributeNS?.(namespace, plain) || node?.getAttribute?.(`r:${plain}`) || node?.getAttribute?.(plain) || "";
const imageMime = (path) => ({ png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", bmp: "image/bmp", svg: "image/svg+xml" })[path.split(".").pop().toLowerCase()] || "application/octet-stream";
const normalizePart = (target) => `word/${String(target).replace(/^\//, "").replace(/^word\//, "")}`.replace(/\/\.\//g, "/");
const wVal = (node, name = "val") => node?.getAttributeNS?.(W, name) ?? node?.getAttribute?.(`w:${name}`) ?? node?.getAttribute?.(name) ?? "";
const offValue = (value) => ["0", "false", "none", "off"].includes(String(value ?? "").toLowerCase());
const mergeDefined = (...items) => Object.assign({}, ...items.filter(Boolean));
const WORD_HIGHLIGHTS = Object.freeze({
  black:"#000000", blue:"#0000ff", cyan:"#00ffff", green:"#00ff00", magenta:"#ff00ff",
  red:"#ff0000", yellow:"#ffff00", white:"#ffffff", darkBlue:"#000080", darkCyan:"#008080",
  darkGreen:"#008000", darkMagenta:"#800080", darkRed:"#800000", darkYellow:"#808000",
  darkGray:"#808080", lightGray:"#c0c0c0"
});
function cssWordColor(value, highlight = false) {
  const raw=String(value||"").trim();
  if(!raw || /^(?:auto|none|nil)$/i.test(raw)) return "";
  if(/^#[0-9a-f]{6}$/i.test(raw)) return raw;
  if(/^[0-9a-f]{6}$/i.test(raw)) return `#${raw}`;
  if(highlight && WORD_HIGHLIGHTS[raw]) return WORD_HIGHLIGHTS[raw];
  return raw;
}
function parseRunProps(props) {
  if(!props) return {};
  const out={};
  for(const [xml,key] of [["b","bold"],["i","italic"],["strike","strike"]]) {
    const node=descendant(props,xml)[0]; if(node) out[key]=!offValue(wVal(node));
  }
  const underline=descendant(props,"u")[0]; if(underline) out.underline=!offValue(wVal(underline));
  const fonts=descendant(props,"rFonts")[0];
  if(fonts) {
    const family=wVal(fonts,"ascii")||wVal(fonts,"hAnsi")||wVal(fonts,"cs")||wVal(fonts,"eastAsia");
    if(family) out.fontFamily=family;
  }
  const size=Number(wVal(descendant(props,"sz")[0])||wVal(descendant(props,"szCs")[0]));
  if(Number.isFinite(size)&&size>0) out.fontSize=size/2;
  const color=descendant(props,"color")[0]; if(color) out.color=cssWordColor(wVal(color));
  const shading=descendant(props,"shd")[0], highlight=descendant(props,"highlight")[0];
  if(shading && wVal(shading,"fill")) out.highlight=cssWordColor(wVal(shading,"fill"),true);
  else if(highlight) out.highlight=cssWordColor(wVal(highlight),true);
  return out;
}
function parseParagraphProps(pPr) {
  if(!pPr) return {};
  const out={};
  const jc=descendant(pPr,"jc")[0]; if(jc) out.alignment=wVal(jc)||"left";
  const spacing=descendant(pPr,"spacing")[0];
  if(spacing) {
    const line=Number(wVal(spacing,"line")),before=Number(wVal(spacing,"before")),after=Number(wVal(spacing,"after"));
    if(Number.isFinite(line)&&line>0) out.lineSpacing=line/240;
    if(Number.isFinite(before)) out.spaceBefore=before/20;
    if(Number.isFinite(after)) out.spaceAfter=after/20;
  }
  const indent=descendant(pPr,"ind")[0];
  if(indent) {
    const left=Number(wVal(indent,"left")||wVal(indent,"start")),right=Number(wVal(indent,"right")||wVal(indent,"end"));
    const first=Number(wVal(indent,"firstLine")),hanging=Number(wVal(indent,"hanging"));
    if(Number.isFinite(left)) out.indentLeft=left/1440;
    if(Number.isFinite(right)) out.indentRight=right/1440;
    if(Number.isFinite(first)||Number.isFinite(hanging)) out.firstLine=((Number.isFinite(first)?first:0)-(Number.isFinite(hanging)?hanging:0))/1440;
  }
  if(descendant(pPr,"pageBreakBefore")[0]) out.pageBreak=true;
  return out;
}
function parseStyles(parts) {
  const source=parts["word/styles.xml"];
  const styles=new Map();
  let defaults={ p:{}, r:{} };
  if(!source) return { styles, defaults, resolve:()=>({p:{},r:{}}) };
  try {
    const doc=new DOMParser().parseFromString(strFromU8(source),"application/xml");
    const docDefaults=allDescendants(doc,"docDefaults")[0];
    defaults={
      p:parseParagraphProps(allDescendants(docDefaults,"pPr")[0]),
      r:parseRunProps(allDescendants(docDefaults,"rPr")[0])
    };
    for(const style of allDescendants(doc,"style")) {
      const id=wVal(style,"styleId")||style.getAttribute("styleId")||style.getAttribute("w:styleId");
      if(!id) continue;
      styles.set(id,{
        id,
        type:wVal(style,"type")||style.getAttribute("type")||style.getAttribute("w:type")||"",
        basedOn:wVal(children(style,"basedOn")[0]),
        p:parseParagraphProps(children(style,"pPr")[0]),
        r:parseRunProps(children(style,"rPr")[0])
      });
    }
  } catch(error) { console.warn("FrameChute could not parse DOCX styles.xml:",error); }
  const cache=new Map();
  const resolve=(id,seen=new Set())=>{
    if(!id) return {p:{...defaults.p},r:{...defaults.r}};
    if(cache.has(id)) return cache.get(id);
    if(seen.has(id)) return {p:{...defaults.p},r:{...defaults.r}};
    seen.add(id);
    const own=styles.get(id);
    const base=own?.basedOn ? resolve(own.basedOn,seen) : {p:{...defaults.p},r:{...defaults.r}};
    const resolved={p:mergeDefined(base.p,own?.p),r:mergeDefined(base.r,own?.r)};
    cache.set(id,resolved); return resolved;
  };
  return { styles, defaults, resolve };
}
function parsePageLayout(body) {
  const sect=[...body.children].reverse().find(node=>local(node)==="sectPr") || descendant(body,"sectPr").at(-1);
  if(!sect) return null;
  const size=descendant(sect,"pgSz")[0], margins=descendant(sect,"pgMar")[0];
  const width=Number(wVal(size,"w")),height=Number(wVal(size,"h"));
  const twips=(name,fallback)=>{const n=Number(wVal(margins,name));return Number.isFinite(n)?n/1440:fallback;};
  return {
    widthIn:Number.isFinite(width)&&width>0?width/1440:8.5,
    heightIn:Number.isFinite(height)&&height>0?height/1440:11,
    marginTopIn:twips("top",1), marginRightIn:twips("right",1),
    marginBottomIn:twips("bottom",1), marginLeftIn:twips("left",1),
    orientation:wVal(size,"orient")||"portrait"
  };
}

function mathAttr(node, name = "val") {
  if (!node) return "";
  for (const attr of [...(node.attributes || [])]) {
    if (attr.localName === name || attr.name === name || attr.name.endsWith(`:${name}`)) return attr.value || "";
  }
  return "";
}
function mathChild(node, name) {
  return [...(node?.children || [])].find(child => local(child) === name) || null;
}
function mathSequence(node) {
  const content = [...(node?.children || [])]
    .filter(child => !/Pr$/.test(local(child) || "") && !["ctrlPr","argPr"].includes(local(child)))
    .map(parseMathAst)
    .filter(Boolean);
  return content.length === 1 ? content[0] : { type:"row", children:content };
}
function parseMathAst(node) {
  if (!node) return { type:"row", children:[] };
  const kind = local(node);

  if (["oMath","oMathPara","e","num","den","sub","sup","deg","fName","lim"].includes(kind)) {
    return mathSequence(node);
  }

  if (kind === "r") {
    const text = allDescendants(node, "t").map(item => item.textContent || "").join("");
    return { type:"token", text };
  }

  if (kind === "f") {
    const pr=mathChild(node,"fPr"),type=mathAttr(mathChild(pr,"type"))||"bar";
    return {
      type:"frac",
      numerator:parseMathAst(mathChild(node,"num")),
      denominator:parseMathAst(mathChild(node,"den")),
      bar:type!=="noBar",
      fractionType:type
    };
  }

  if (kind === "sSup") return { type:"sup", base:parseMathAst(mathChild(node,"e")), sup:parseMathAst(mathChild(node,"sup")) };
  if (kind === "sSub") return { type:"sub", base:parseMathAst(mathChild(node,"e")), sub:parseMathAst(mathChild(node,"sub")) };
  if (kind === "sSubSup") return { type:"subsup", base:parseMathAst(mathChild(node,"e")), sub:parseMathAst(mathChild(node,"sub")), sup:parseMathAst(mathChild(node,"sup")) };

  if (kind === "rad") {
    const pr=mathChild(node,"radPr"),hideDeg=/^(?:1|true|on)$/i.test(mathAttr(mathChild(pr,"degHide")));
    return { type:"rad", degree:hideDeg?null:parseMathAst(mathChild(node,"deg")), body:parseMathAst(mathChild(node,"e")) };
  }

  if (kind === "nary") {
    const pr=mathChild(node,"naryPr"),chr=mathAttr(mathChild(pr,"chr"))||"∑";
    return {
      type:"nary", operator:chr,
      sub:parseMathAst(mathChild(node,"sub")),
      sup:parseMathAst(mathChild(node,"sup")),
      body:parseMathAst(mathChild(node,"e"))
    };
  }

  if (kind === "d") {
    const pr=mathChild(node,"dPr");
    const begin=mathAttr(mathChild(pr,"begChr"));
    const end=mathAttr(mathChild(pr,"endChr"));
    const separator=mathAttr(mathChild(pr,"sepChr"))||"";
    return {
      type:"delim",
      begin:begin===""?"(":begin,
      end:end===""?")":end,
      separator,
      items:children(node,"e").map(parseMathAst)
    };
  }

  if (kind === "func") return { type:"func", name:parseMathAst(mathChild(node,"fName")), body:parseMathAst(mathChild(node,"e")) };

  if (kind === "acc") {
    const pr=mathChild(node,"accPr"),chr=mathAttr(mathChild(pr,"chr"))||"ˆ";
    return { type:"accent", accent:chr, body:parseMathAst(mathChild(node,"e")) };
  }

  if (kind === "bar") {
    const pr=mathChild(node,"barPr"),pos=mathAttr(mathChild(pr,"pos"))||"top";
    return { type:"bar", position:pos, body:parseMathAst(mathChild(node,"e")) };
  }

  if (kind === "groupChr") {
    const pr=mathChild(node,"groupChrPr"),chr=mathAttr(mathChild(pr,"chr"))||"⏞",pos=mathAttr(mathChild(pr,"pos"))||"top";
    return { type:"group", character:chr, position:pos, body:parseMathAst(mathChild(node,"e")) };
  }

  if (kind === "limLow") return { type:"limlow", base:parseMathAst(mathChild(node,"e")), limit:parseMathAst(mathChild(node,"lim")) };
  if (kind === "limUpp") return { type:"limupp", base:parseMathAst(mathChild(node,"e")), limit:parseMathAst(mathChild(node,"lim")) };

  if (kind === "eqArr") return { type:"eqarr", rows:children(node,"e").map(parseMathAst) };

  if (kind === "m") {
    return {
      type:"matrix",
      rows:children(node,"mr").map(row => children(row,"e").map(parseMathAst))
    };
  }

  if (["box","borderBox"].includes(kind)) return { type:"box", body:parseMathAst(mathChild(node,"e")) };
  if (kind === "phant") return { type:"phantom", body:parseMathAst(mathChild(node,"e")) };

  const nested=[...(node.children||[])].filter(child=>!/Pr$/.test(local(child)||"")).map(parseMathAst).filter(Boolean);
  if(nested.length) return nested.length===1?nested[0]:{type:"row",children:nested};
  const text=String(node.textContent||"");
  return text?{type:"token",text}:null;
}
function serializeMathNode(node) {
  let xml=new XMLSerializer().serializeToString(node);
  if (/^<m:oMath(?:Para)?\b/.test(xml) && !/\bxmlns:m=/.test(xml)) {
    xml=xml.replace(/^<(m:oMath(?:Para)?)(\b)/, `<$1 xmlns:m="${M}"$2`);
  }
  return xml;
}

function imageFromNode(node, relationships, parts) {
  const blip = allDescendants(node, "blip")[0] || allDescendants(node, "imagedata")[0];
  const relationshipId = attribute(blip, R, "embed") || attribute(blip, R, "id");
  const part = relationships.get(relationshipId);
  const extent = allDescendants(node, "extent")[0];
  const widthEmu = Number(extent?.getAttribute("cx")) || 0, heightEmu = Number(extent?.getAttribute("cy")) || 0;
  if (!relationshipId || !part) return { kind: "image", relationshipId, unsupported: true, message: "Image relationship is unavailable." };
  return { kind: "image", relationshipId, part, mime: imageMime(part), width: widthEmu ? widthEmu / 9525 : null, height: heightEmu ? heightEmu / 9525 : null, unsupported: !parts[part] };
}

function parseRun(run, relationships, parts, inherited = {}, styles = null) {
  const props=children(run,"rPr")[0];
  const charStyle=wVal(descendant(props,"rStyle")[0]);
  const styled=charStyle&&styles ? styles.resolve(charStyle).r : {};
  const format=mergeDefined(inherited,styled,parseRunProps(props));
  const text=[...run.childNodes].map(node=>local(node)==="t"?(node.textContent||""):local(node)==="tab"?"\t":local(node)==="br"?"\n":"").join("");
  const images=[...run.children].filter(node=>["drawing","pict"].includes(local(node))).map(node=>imageFromNode(node,relationships,parts));
  return { text, images, bold:false, italic:false, underline:false, strike:false, color:"", highlight:"", fontFamily:"", fontSize:null, ...format };
}

function parseParagraph(paragraph, relationships, parts, numbering=new Map(), styles=null) {
  const pPr=children(paragraph,"pPr")[0];
  const style=wVal(descendant(pPr,"pStyle")[0]);
  const resolved=styles?.resolve(style)||{p:{},r:{}};
  const pFormat=mergeDefined(resolved.p,parseParagraphProps(pPr));
  const numPr=descendant(pPr,"numPr")[0],num=Boolean(numPr);
  const numId=Number(wVal(descendant(numPr,"numId")[0])||0),level=Number(wVal(descendant(numPr,"ilvl")[0])||0);
  const numberInfo=num ? (numbering.get(`${numId}:${level}`)||numbering.get(`${numId}:0`)||{list:"number",format:"decimal",text:"%1.",start:1}) : null;
  const runs=[];
  const walk=(node,hyperlink="")=>{
    for(const child of node.children||[]) {
      if(local(child)==="r") {
        const parsed=parseRun(child,relationships,parts,resolved.r,styles);
        if(hyperlink) { parsed.hyperlink=hyperlink; parsed.hyperlinkId=attribute(node,R,"id")||""; }
        runs.push(parsed);
      } else if(local(child)==="hyperlink") {
        const id=attribute(child,R,"id"),rel=relationships.get(id);
        walk(child,rel?.target||"");
      } else if(["oMath","oMathPara"].includes(local(child))) {
        runs.push({
          text:"",
          math:parseMathAst(child),
          mathXml:serializeMathNode(child),
          mathDisplay:local(child)==="oMathPara"
        });
      } else if(["fldSimple","smartTag","sdt","sdtContent","ins","del"].includes(local(child))) walk(child,hyperlink);
    }
  };
  walk(paragraph);
  return {
    type:"paragraph", style,
    list:numberInfo?.list||"", numId:num?numId:null, level,
    numberFormat:numberInfo?.format||"", numberText:numberInfo?.text||"", numberStart:numberInfo?.start||1,
    alignment:pFormat.alignment||"left",
    lineSpacing:pFormat.lineSpacing??null, spaceBefore:pFormat.spaceBefore??0, spaceAfter:pFormat.spaceAfter??null,
    indentLeft:pFormat.indentLeft??0, indentRight:pFormat.indentRight??0, firstLine:pFormat.firstLine??0,
    pageBreak:Boolean(pFormat.pageBreak), runs:runs.length?runs:[{text:"",...resolved.r}]
  };
}

export function parseDocx(bytes) {
  const parts = unzipSync(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
  const source = parts["word/document.xml"];
  if (!source) throw new Error("This file is not a valid DOCX document (word/document.xml is missing).");
  const xml = strFromU8(source);
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.querySelector("parsererror")) throw new Error("The DOCX document XML is malformed.");
  const body = descendant(doc, "body")[0];
  if (!body) throw new Error("The DOCX document has no body.");
  const relationships = new Map();
  const relationshipsSource = parts["word/_rels/document.xml.rels"];
  if (relationshipsSource) {
    const relationshipsDoc = new DOMParser().parseFromString(strFromU8(relationshipsSource), "application/xml");
    for (const relationship of allDescendants(relationshipsDoc, "Relationship")) {
      const type=relationship.getAttribute("Type"), id=relationship.getAttribute("Id"), target=relationship.getAttribute("Target");
      if (type === IMAGE_REL) relationships.set(id, normalizePart(target));
      if (type === HYPERLINK_REL) relationships.set(id, { target, external: relationship.getAttribute("TargetMode") === "External" });
    }
  }
  const styles=parseStyles(parts);
  const numbering=new Map(),numberingSource=parts["word/numbering.xml"];
  if(numberingSource){
    const numberingDoc=new DOMParser().parseFromString(strFromU8(numberingSource),"application/xml"),abstracts=new Map();
    for(const abstract of allDescendants(numberingDoc,"abstractNum")){
      const id=Number(wVal(abstract,"abstractNumId")||abstract.getAttribute("w:abstractNumId"));
      const levels=new Map();
      for(const lvl of children(abstract,"lvl")){
        const at=Number(wVal(lvl,"ilvl")||0),format=wVal(descendant(lvl,"numFmt")[0])||"decimal";
        levels.set(at,{list:format==="bullet"?"bullet":"number",format,text:wVal(descendant(lvl,"lvlText")[0])||(format==="bullet"?"•":"%1."),start:Number(wVal(descendant(lvl,"start")[0])||1)});
      }
      abstracts.set(id,levels);
    }
    for(const num of allDescendants(numberingDoc,"num")){
      const id=Number(wVal(num,"numId")||num.getAttribute("w:numId")),abstractId=Number(wVal(descendant(num,"abstractNumId")[0]));
      for(const [level,info] of abstracts.get(abstractId)||[]) numbering.set(`${id}:${level}`,{...info});
    }
  }
  const blocks = [];
  const originalBodyChildren = [];
  [...body.children].forEach((child, sourceIndex) => {
    const kind=local(child);
    const raw=new XMLSerializer().serializeToString(child);
    originalBodyChildren.push({ sourceIndex, kind, raw });

    if (kind === "p") {
      const block=parseParagraph(child, relationships, parts,numbering,styles);
      block.sourceIndex=sourceIndex;
      blocks.push(block);
      return;
    }

    if (kind === "tbl") {
      blocks.push({
        type: "table",
        sourceIndex,
        rows: children(child, "tr").map((row) => children(row, "tc").map((cell) => descendant(cell, "p").map((p) => parseParagraph(p, relationships, parts,numbering,styles))))
      });
      return;
    }

    if (kind !== "sectPr") {
      const previewText=String(child.textContent||"").replace(/\s+/g," ").trim();
      blocks.push({ type:"preserved", sourceIndex, preservedTag:kind||"object", previewText });
    }
  });
  const pageLayout=parsePageLayout(body);
  return { blocks, originalBlocks: structuredClone(blocks), originalBodyChildren, parts, originalXml: xml, relationships, styles, numbering, pageLayout };
}

function runXml(run, drawingIds) {
  if(run.mathXml) return run.mathXml;
  const family=esc(run.fontFamily || ""), halfPoints=Math.max(2,Math.round(Number(run.fontSize)*2));
  const color=ooxmlColor(run.color),highlight=ooxmlColor(run.highlight),props = `${run.bold ? "<w:b/>" : ""}${run.italic ? "<w:i/>" : ""}${run.underline ? '<w:u w:val="single"/>' : ""}${run.strike?"<w:strike/>":""}${color?`<w:color w:val="${color}"/>`:""}${highlight?`<w:shd w:val="clear" w:color="auto" w:fill="${highlight}"/>`:""}${family?`<w:rFonts w:ascii="${family}" w:hAnsi="${family}"/>`:""}${run.fontSize?`<w:sz w:val="${halfPoints}"/><w:szCs w:val="${halfPoints}"/>`:""}`;
  const pieces = String(run.text ?? "").split(/([\t\n])/).map(part => part==="\t"?"<w:tab/>":part==="\n"?"<w:br/>":`<w:t xml:space="preserve">${esc(part)}</w:t>`).join("");
  const images = (run.images || []).map((image) => imageXml(image, drawingIds.next())).join("");
  const xml=`<w:r>${props ? `<w:rPr>${props}</w:rPr>` : ""}${pieces}${images}</w:r>`;
  return run.hyperlinkId ? `<w:hyperlink r:id="${esc(run.hyperlinkId)}">${xml}</w:hyperlink>` : xml;
}
function imageXml(image, drawingId) {
  const width = Math.max(1, Math.round((image.width || 320) * 9525)), height = Math.max(1, Math.round((image.height || 240) * 9525));
  return `<w:drawing><wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><wp:extent cx="${width}" cy="${height}"/><wp:docPr id="${drawingId}" name="Picture ${drawingId}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${drawingId}" name="Picture ${drawingId}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${esc(image.relationshipId)}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:ext cx="${width}" cy="${height}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing>`;
}

export function addDocxImage(model, bytes, { mime = "image/png", width = 320, height = 240 } = {}) {
  const extension = mime === "image/jpeg" ? "jpg" : mime.split("/")[1]?.replace("svg+xml", "svg") || "png";
  let number = 1; while (model.parts[`word/media/framechute${number}.${extension}`]) number += 1;
  const part = `word/media/framechute${number}.${extension}`;
  model.parts[part] = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const relPath = "word/_rels/document.xml.rels";
  let rels = model.parts[relPath] ? strFromU8(model.parts[relPath]) : `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="${REL}"></Relationships>`;
  const relationshipIds = new Set([...rels.matchAll(/\bId=["']([^"']+)["']/g)].map((match) => match[1]));
  let relationshipNumber = 1;
  while (relationshipIds.has(`rIdFrameChute${relationshipNumber}`)) relationshipNumber += 1;
  const relationshipId = `rIdFrameChute${relationshipNumber}`;
  rels = rels.replace(/<\/Relationships>\s*$/, `<Relationship Id="${relationshipId}" Type="${IMAGE_REL}" Target="media/${part.split("/").pop()}"/></Relationships>`);
  model.parts[relPath] = strToU8(rels); model.relationships?.set(relationshipId, part); model.packageDirty = true;
  const contentPath = "[Content_Types].xml";
  if (model.parts[contentPath]) { let types = strFromU8(model.parts[contentPath]); if (!new RegExp(`Extension=["']${extension}["']`, "i").test(types)) types = types.replace(/<\/Types>\s*$/, `<Default Extension="${extension}" ContentType="${mime}"/></Types>`); model.parts[contentPath] = strToU8(types); }
  return { kind: "image", relationshipId, part, mime, width, height };
}
function paragraphXml(p, drawingIds) {
  const twips=value=>Math.round(Number(value||0)*1440),spacing=(p.lineSpacing||p.spaceBefore||p.spaceAfter!=null)?`<w:spacing${p.spaceBefore?` w:before="${Math.round(p.spaceBefore*20)}"`:""}${p.spaceAfter!=null?` w:after="${Math.round(p.spaceAfter*20)}"`:""}${p.lineSpacing?` w:line="${Math.round(p.lineSpacing*240)}" w:lineRule="auto"`:""}/>`:"",indent=(p.indentLeft||p.indentRight||p.firstLine)?`<w:ind${p.indentLeft?` w:left="${twips(p.indentLeft)}"`:""}${p.indentRight?` w:right="${twips(p.indentRight)}"`:""}${p.firstLine>0?` w:firstLine="${twips(p.firstLine)}"`:p.firstLine<0?` w:hanging="${twips(-p.firstLine)}"`:""}/>`:"";
  const listNumId=Number.isFinite(Number(p.numId))&&Number(p.numId)>0 ? Number(p.numId) : (p.list === "number" ? 2 : 1);
  const props = `${p.style ? `<w:pStyle w:val="${esc(p.style)}"/>` : ""}${p.alignment && p.alignment !== "left" ? `<w:jc w:val="${esc(p.alignment)}"/>` : ""}${spacing}${indent}${p.pageBreak?"<w:pageBreakBefore/>":""}${p.list ? `<w:numPr><w:ilvl w:val="${Math.max(0,Number(p.level)||0)}"/><w:numId w:val="${listNumId}"/></w:numPr>` : ""}`;
  return `<w:p>${props ? `<w:pPr>${props}</w:pPr>` : ""}${(p.runs || []).map((run) => runXml(run, drawingIds)).join("")}</w:p>`;
}
function blockXml(block, drawingIds) {
  if (block.type === "table") return `<w:tbl>${block.rows.map((row) => `<w:tr>${row.map((cell) => `<w:tc>${cell.map((p) => paragraphXml(p, drawingIds)).join("")}<w:tcPr/></w:tc>`).join("")}</w:tr>`).join("")}</w:tbl>`;
  if (block.type === "preserved") return "";
  return paragraphXml(block, drawingIds);
}

export function serializeDocx(model) {
  if (!model?.parts) throw new Error("The original DOCX package is unavailable.");
  const parts = { ...model.parts };
  const createdStyles=model.blocks.some(block=>/^Heading[1-3]$/.test(block.style||""))&&!parts["word/styles.xml"];
  if(createdStyles)parts["word/styles.xml"]=strToU8(`<?xml version="1.0"?><w:styles xmlns:w="${W}"><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>${[1,2,3].map(level=>`<w:style w:type="paragraph" w:styleId="Heading${level}"><w:name w:val="heading ${level}"/><w:basedOn w:val="Normal"/><w:pPr><w:outlineLvl w:val="${level-1}"/></w:pPr></w:style>`).join("")}</w:styles>`);
  // Materialize canonical hyperlinks into ordinary external OOXML relationships.
  const relPath="word/_rels/document.xml.rels"; let rels=parts[relPath]?strFromU8(parts[relPath]):`<?xml version="1.0"?><Relationships xmlns="${REL}"></Relationships>`;
  if(createdStyles&&!rels.includes("relationships/styles"))rels=rels.replace(/<\/Relationships>\s*$/,`<Relationship Id="rIdFrameChuteStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  if(createdStyles&&parts["[Content_Types].xml"]){let types=strFromU8(parts["[Content_Types].xml"]);if(!types.includes("word/styles.xml"))types=types.replace(/<\/Types>\s*$/,`<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`);parts["[Content_Types].xml"]=strToU8(types);}
  const structure = blocks => JSON.stringify((blocks||[]).map(block=>block.type==="table"?{type:"table",sourceIndex:block.sourceIndex??null}:block.type==="preserved"?{type:"preserved",sourceIndex:block.sourceIndex??null}:{type:"paragraph",sourceIndex:block.sourceIndex??null,style:block.style||"",alignment:block.alignment||"left",list:block.list||"",level:block.level||0,lineSpacing:block.lineSpacing||null,spaceBefore:block.spaceBefore||0,spaceAfter:block.spaceAfter??null,indentLeft:block.indentLeft||0,indentRight:block.indentRight||0,firstLine:block.firstLine||0,pageBreak:Boolean(block.pageBreak)}));
  const comparable = block => JSON.stringify(block,(key,value)=>key==="sourceIndex"?undefined:value);
  let nextRel=1, needsCanonicalXml=!model.originalBlocks || structure(model.originalBlocks)!==structure(model.blocks); const ids=new Set([...rels.matchAll(/\bId=["']([^"']+)/g)].map(match=>match[1]));
  for(const run of (()=>{const out=[];const walk=blocks=>blocks.forEach(block=>block.type==="table"?block.rows.forEach(row=>row.forEach(walk)):out.push(...(block.runs||[])));walk(model.blocks);return out;})()) if(run.hyperlink){
    if(!run.hyperlinkId){needsCanonicalXml=true;while(ids.has(`rIdFrameChuteLink${nextRel}`))nextRel++;run.hyperlinkId=`rIdFrameChuteLink${nextRel++}`;ids.add(run.hyperlinkId);rels=rels.replace(/<\/Relationships>\s*$/,`<Relationship Id="${run.hyperlinkId}" Type="${HYPERLINK_REL}" Target="${escAttr(run.hyperlink)}" TargetMode="External"/></Relationships>`);}
  }
  if(model.blocks.some(block=>block.list)){
    const numberingType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml";
    parts["word/numbering.xml"] ||= strToU8(`<?xml version="1.0" encoding="UTF-8"?><w:numbering xmlns:w="${W}"><w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/></w:lvl></w:abstractNum><w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0"><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num><w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num></w:numbering>`);
    if(!rels.includes("relationships/numbering"))rels=rels.replace(/<\/Relationships>\s*$/,`<Relationship Id="rIdFrameChuteNumbering" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/></Relationships>`);
    const typesPath="[Content_Types].xml";if(parts[typesPath]){let types=strFromU8(parts[typesPath]);if(!types.includes(numberingType))types=types.replace(/<\/Types>\s*$/,`<Override PartName="/word/numbering.xml" ContentType="${numberingType}"/></Types>`);parts[typesPath]=strToU8(types);}
  }
  parts[relPath]=strToU8(rels);
  const runs = [];
  const collect = (blocks) => { for (const block of blocks) { if (block.type === "table") for (const row of block.rows) for (const cell of row) collect(cell); else if(block.type !== "preserved") runs.push(...(block.runs || [])); } };
  collect(model.blocks);
  const originalTextCount = (model.originalXml.match(/<w:t(?:\s[^>]*)?>[\s\S]*?<\/w:t>/g) || []).length;
  const textRuns = runs.filter((run) => typeof run.text === "string" && run.text.length > 0);
  if (!model.packageDirty && !needsCanonicalXml && originalTextCount === textRuns.length) {
    // Ordinary edits take the least-destructive path: patch text/run formatting
    // in the original XML so drawings, hyperlinks, fields and unknown OOXML
    // remain byte-for-byte represented in the package.
    let index = 0;
    let xml = model.originalXml.replace(/<w:t(?:\s[^>]*)?>[\s\S]*?<\/w:t>/g, () => `<w:t xml:space="preserve">${esc(textRuns[index++].text)}</w:t>`);
    index = 0;
    xml = xml.replace(/<w:r(\s[^>]*)?>([\s\S]*?)<\/w:r>/g, (whole, attrs = "", body) => {
      if (!/<w:t(?:\s|>)/.test(body) || !textRuns[index]) return whole;
      const run = textRuns[index++];
      const oldProperties = body.match(/<w:rPr>([\s\S]*?)<\/w:rPr>/)?.[1] || "";
      const retained = oldProperties.replace(/<w:(?:b|i|u|strike|color|highlight|shd|rFonts|sz|szCs)(?:\s[^>]*)?\/?>(?:<\/w:(?:b|i|u|strike|color|highlight|shd|rFonts|sz|szCs)>)?/g, "");
      const family=esc(run.fontFamily||""),halfPoints=Math.max(2,Math.round(Number(run.fontSize)*2));
      const color=ooxmlColor(run.color),highlight=ooxmlColor(run.highlight);
      const formatting = `${retained}${run.bold ? "<w:b/>" : ""}${run.italic ? "<w:i/>" : ""}${run.underline ? '<w:u w:val="single"/>' : ""}${run.strike?"<w:strike/>":""}${color?`<w:color w:val="${color}"/>`:""}${highlight?`<w:shd w:val="clear" w:color="auto" w:fill="${highlight}"/>`:""}${family?`<w:rFonts w:ascii="${family}" w:hAnsi="${family}"/>`:""}${run.fontSize?`<w:sz w:val="${halfPoints}"/><w:szCs w:val="${halfPoints}"/>`:""}`;
      const withoutProperties = body.replace(/<w:rPr>[\s\S]*?<\/w:rPr>/, "");
      return `<w:r${attrs}>${formatting ? `<w:rPr>${formatting}</w:rPr>` : ""}${withoutProperties}</w:r>`;
    });
    parts["word/document.xml"] = strToU8(xml);
  } else {
    let section = model.originalXml.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/)?.[0] || "<w:sectPr/>";
    if(model.pageSetup){const [size="letter",orientation="portrait",top=1,right=1,bottom=1,left=1]=model.pageSetup.split(","),landscape=orientation==="landscape",dimensions=size==="a4"?[11906,16838]:[12240,15840],w=landscape?dimensions[1]:dimensions[0],h=landscape?dimensions[0]:dimensions[1];section=`<w:sectPr><w:pgSz w:w="${w}" w:h="${h}"${landscape?' w:orient="landscape"':""}/><w:pgMar w:top="${Math.round(top*1440)}" w:right="${Math.round(right*1440)}" w:bottom="${Math.round(bottom*1440)}" w:left="${Math.round(left*1440)}" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>`;}
    const usedDrawingIds = new Set([...model.originalXml.matchAll(/<wp:docPr\b[^>]*\bid=["'](\d+)["']/g)].map((match) => Number(match[1])));
    let nextDrawingId = 1;
    const drawingIds = { next() { while (usedDrawingIds.has(nextDrawingId)) nextDrawingId += 1; usedDrawingIds.add(nextDrawingId); return nextDrawingId++; } };
    const originalBySource=new Map((model.originalBlocks||[]).filter(block=>block.sourceIndex!=null).map(block=>[Number(block.sourceIndex),block]));
    const rawBySource=new Map((model.originalBodyChildren||[]).map(entry=>[Number(entry.sourceIndex),entry.raw]));
    const bodyXml=(model.blocks||[]).map(block=>{
      const sourceIndex=block.sourceIndex==null?null:Number(block.sourceIndex);
      if(sourceIndex!=null){
        const original=originalBySource.get(sourceIndex),raw=rawBySource.get(sourceIndex);
        if(block.type==="preserved"&&raw)return raw;
        if(original&&raw&&comparable(block)===comparable(original))return raw;
      }
      return blockXml(block,drawingIds);
    }).join("");
    parts["word/document.xml"] = strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="${W}" xmlns:r="${R}" xmlns:m="${M}"><w:body>${bodyXml}${section}</w:body></w:document>`);
  }
  return new Blob([zipSync(parts, { level: 6 })], { type: CONTENT_TYPE });
}

export const DOCX_MIME = CONTENT_TYPE;
