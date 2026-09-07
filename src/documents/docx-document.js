import { unzipSync, zipSync, strFromU8, strToU8 } from "../vendor/fflate.mjs";

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const REL = "http://schemas.openxmlformats.org/package/2006/relationships";
const IMAGE_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image";
const HYPERLINK_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink";
const CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const local = (node) => node?.localName || node?.nodeName?.split(":").pop();
const children = (node, name) => [...(node?.children || [])].filter((item) => local(item) === name);
const descendant = (node, name) => [...(node?.getElementsByTagNameNS?.(W, name) || [])];
const esc = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escAttr = (value) => esc(value).replace(/"/g, "&quot;").replace(/'/g, "&apos;");

const allDescendants = (node, name) => [...(node?.getElementsByTagName?.("*") || [])].filter((item) => local(item) === name);
const attribute = (node, namespace, plain) => node?.getAttributeNS?.(namespace, plain) || node?.getAttribute?.(`r:${plain}`) || node?.getAttribute?.(plain) || "";
const imageMime = (path) => ({ png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", bmp: "image/bmp", svg: "image/svg+xml" })[path.split(".").pop().toLowerCase()] || "application/octet-stream";
const normalizePart = (target) => `word/${String(target).replace(/^\//, "").replace(/^word\//, "")}`.replace(/\/\.\//g, "/");

function imageFromNode(node, relationships, parts) {
  const blip = allDescendants(node, "blip")[0] || allDescendants(node, "imagedata")[0];
  const relationshipId = attribute(blip, R, "embed") || attribute(blip, R, "id");
  const part = relationships.get(relationshipId);
  const extent = allDescendants(node, "extent")[0];
  const widthEmu = Number(extent?.getAttribute("cx")) || 0, heightEmu = Number(extent?.getAttribute("cy")) || 0;
  if (!relationshipId || !part) return { kind: "image", relationshipId, unsupported: true, message: "Image relationship is unavailable." };
  return { kind: "image", relationshipId, part, mime: imageMime(part), width: widthEmu ? widthEmu / 9525 : null, height: heightEmu ? heightEmu / 9525 : null, unsupported: !parts[part] };
}

function parseRun(run, relationships, parts) {
  const props = children(run, "rPr")[0];
  const text = [...run.childNodes].map((node) => {
    if (local(node) === "t") return node.textContent || "";
    if (local(node) === "tab") return "\t";
    if (local(node) === "br") return "\n";
    return "";
  }).join("");
  const images = [...run.children].filter((node) => ["drawing", "pict"].includes(local(node))).map((node) => imageFromNode(node, relationships, parts));
  const enabled = (name) => {
    const property = descendant(props, name)[0];
    const value = property?.getAttributeNS?.(W, "val") || property?.getAttribute?.("w:val") || property?.getAttribute?.("val");
    return Boolean(property) && !["0", "false", "none", "off"].includes(String(value || "").toLowerCase());
  };
  const fonts = descendant(props, "rFonts")[0], size = Number(descendant(props, "sz")[0]?.getAttributeNS(W, "val") || 0) / 2;
  return { text, images, bold: enabled("b"), italic: enabled("i"), underline: enabled("u"), fontFamily: fonts?.getAttributeNS(W, "ascii") || fonts?.getAttribute("w:ascii") || "", fontSize: size || null };
}

function parseParagraph(paragraph, relationships, parts) {
  const pPr = children(paragraph, "pPr")[0];
  const style = descendant(pPr, "pStyle")[0]?.getAttributeNS(W, "val") || descendant(pPr, "pStyle")[0]?.getAttribute("w:val") || "";
  const numPr = descendant(pPr, "numPr")[0], num = Boolean(numPr);
  const numId = Number(descendant(numPr, "numId")[0]?.getAttributeNS(W, "val") || 0);
  const alignment = descendant(pPr, "jc")[0]?.getAttributeNS(W, "val") || "left";
  const runs = [];
  for (const child of paragraph.children) {
    if (local(child) === "r") runs.push(parseRun(child, relationships, parts));
    if (local(child) === "hyperlink") for (const run of children(child, "r")) { const id=child.getAttributeNS(R, "id") || ""; runs.push({ ...parseRun(run, relationships, parts), hyperlink: relationships.get(id)?.target || "", hyperlinkId:id }); }
  }
  return { type: "paragraph", style, list: num ? (numId === 2 ? "number" : "bullet") : "", alignment, runs: runs.length ? runs : [{ text: "" }] };
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
  const blocks = [];
  for (const child of body.children) {
    if (local(child) === "p") blocks.push(parseParagraph(child, relationships, parts));
    if (local(child) === "tbl") blocks.push({ type: "table", rows: children(child, "tr").map((row) => children(row, "tc").map((cell) => descendant(cell, "p").map((p) => parseParagraph(p, relationships, parts)))) });
  }
  return { blocks, originalBlocks: structuredClone(blocks), parts, originalXml: xml, relationships };
}

function runXml(run, drawingIds) {
  const family=esc(run.fontFamily || ""), halfPoints=Math.max(2,Math.round(Number(run.fontSize)*2));
  const props = `${run.bold ? "<w:b/>" : ""}${run.italic ? "<w:i/>" : ""}${run.underline ? '<w:u w:val="single"/>' : ""}${family?`<w:rFonts w:ascii="${family}" w:hAnsi="${family}"/>`:""}${run.fontSize?`<w:sz w:val="${halfPoints}"/><w:szCs w:val="${halfPoints}"/>`:""}`;
  const pieces = String(run.text ?? "").split("\n").map((part, index) => `${index ? "<w:br/>" : ""}<w:t xml:space="preserve">${esc(part)}</w:t>`).join("");
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
  const props = `${p.style ? `<w:pStyle w:val="${esc(p.style)}"/>` : ""}${p.alignment && p.alignment !== "left" ? `<w:jc w:val="${esc(p.alignment)}"/>` : ""}${p.list ? `<w:numPr><w:ilvl w:val="0"/><w:numId w:val="${p.list === "number" ? 2 : 1}"/></w:numPr>` : ""}`;
  return `<w:p>${props ? `<w:pPr>${props}</w:pPr>` : ""}${(p.runs || []).map((run) => runXml(run, drawingIds)).join("")}</w:p>`;
}
function blockXml(block, drawingIds) {
  if (block.type === "table") return `<w:tbl>${block.rows.map((row) => `<w:tr>${row.map((cell) => `<w:tc>${cell.map((p) => paragraphXml(p, drawingIds)).join("")}<w:tcPr/></w:tc>`).join("")}</w:tr>`).join("")}</w:tbl>`;
  return paragraphXml(block, drawingIds);
}

export function serializeDocx(model) {
  if (!model?.parts) throw new Error("The original DOCX package is unavailable.");
  const parts = { ...model.parts };
  // Materialize canonical hyperlinks into ordinary external OOXML relationships.
  const relPath="word/_rels/document.xml.rels"; let rels=parts[relPath]?strFromU8(parts[relPath]):`<?xml version="1.0"?><Relationships xmlns="${REL}"></Relationships>`;
  const structure = blocks => JSON.stringify((blocks||[]).map(block=>block.type==="table"?{type:"table"}:{type:"paragraph",style:block.style||"",alignment:block.alignment||"left",list:block.list||""}));
  let nextRel=1, needsCanonicalXml=Boolean(model.originalBlocks && structure(model.originalBlocks)!==structure(model.blocks)); const ids=new Set([...rels.matchAll(/\bId=["']([^"']+)/g)].map(match=>match[1]));
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
  const collect = (blocks) => { for (const block of blocks) { if (block.type === "table") for (const row of block.rows) for (const cell of row) collect(cell); else runs.push(...(block.runs || [])); } };
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
      const retained = oldProperties.replace(/<w:(?:b|i|u|rFonts|sz|szCs)(?:\s[^>]*)?\/?>(?:<\/w:(?:b|i|u|rFonts|sz|szCs)>)?/g, "");
      const family=esc(run.fontFamily||""),halfPoints=Math.max(2,Math.round(Number(run.fontSize)*2));
      const formatting = `${retained}${run.bold ? "<w:b/>" : ""}${run.italic ? "<w:i/>" : ""}${run.underline ? '<w:u w:val="single"/>' : ""}${family?`<w:rFonts w:ascii="${family}" w:hAnsi="${family}"/>`:""}${run.fontSize?`<w:sz w:val="${halfPoints}"/><w:szCs w:val="${halfPoints}"/>`:""}`;
      const withoutProperties = body.replace(/<w:rPr>[\s\S]*?<\/w:rPr>/, "");
      return `<w:r${attrs}>${formatting ? `<w:rPr>${formatting}</w:rPr>` : ""}${withoutProperties}</w:r>`;
    });
    parts["word/document.xml"] = strToU8(xml);
  } else {
    const section = model.originalXml.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/)?.[0] || "";
    const usedDrawingIds = new Set([...model.originalXml.matchAll(/<wp:docPr\b[^>]*\bid=["'](\d+)["']/g)].map((match) => Number(match[1])));
    let nextDrawingId = 1;
    const drawingIds = { next() { while (usedDrawingIds.has(nextDrawingId)) nextDrawingId += 1; usedDrawingIds.add(nextDrawingId); return nextDrawingId++; } };
    parts["word/document.xml"] = strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="${W}" xmlns:r="${R}"><w:body>${model.blocks.map((block) => blockXml(block, drawingIds)).join("")}${section}</w:body></w:document>`);
  }
  return new Blob([zipSync(parts, { level: 6 })], { type: CONTENT_TYPE });
}

export const DOCX_MIME = CONTENT_TYPE;
