import { unzipSync, zipSync, strFromU8, strToU8 } from "../vendor/fflate.mjs";

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const REL = "http://schemas.openxmlformats.org/package/2006/relationships";
const IMAGE_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image";
const CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const local = (node) => node?.localName || node?.nodeName?.split(":").pop();
const children = (node, name) => [...(node?.children || [])].filter((item) => local(item) === name);
const descendant = (node, name) => [...(node?.getElementsByTagNameNS?.(W, name) || [])];
const esc = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

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
  return { text, images, bold: descendant(props, "b").length > 0, italic: descendant(props, "i").length > 0, underline: descendant(props, "u").length > 0 };
}

function parseParagraph(paragraph, relationships, parts) {
  const pPr = children(paragraph, "pPr")[0];
  const style = descendant(pPr, "pStyle")[0]?.getAttributeNS(W, "val") || descendant(pPr, "pStyle")[0]?.getAttribute("w:val") || "";
  const num = descendant(pPr, "numPr").length > 0;
  const alignment = descendant(pPr, "jc")[0]?.getAttributeNS(W, "val") || "left";
  const runs = [];
  for (const child of paragraph.children) {
    if (local(child) === "r") runs.push(parseRun(child, relationships, parts));
    if (local(child) === "hyperlink") for (const run of children(child, "r")) runs.push({ ...parseRun(run, relationships, parts), hyperlink: child.getAttributeNS(R, "id") || "" });
  }
  return { type: "paragraph", style, list: num, alignment, runs: runs.length ? runs : [{ text: "" }] };
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
      if (relationship.getAttribute("Type") === IMAGE_REL) relationships.set(relationship.getAttribute("Id"), normalizePart(relationship.getAttribute("Target")));
    }
  }
  const blocks = [];
  for (const child of body.children) {
    if (local(child) === "p") blocks.push(parseParagraph(child, relationships, parts));
    if (local(child) === "tbl") blocks.push({ type: "table", rows: children(child, "tr").map((row) => children(row, "tc").map((cell) => descendant(cell, "p").map((p) => parseParagraph(p, relationships, parts)))) });
  }
  return { blocks, parts, originalXml: xml, relationships };
}

function runXml(run) {
  const props = `${run.bold ? "<w:b/>" : ""}${run.italic ? "<w:i/>" : ""}${run.underline ? '<w:u w:val="single"/>' : ""}`;
  const pieces = String(run.text ?? "").split("\n").map((part, index) => `${index ? "<w:br/>" : ""}<w:t xml:space="preserve">${esc(part)}</w:t>`).join("");
  const images = (run.images || []).map((image) => imageXml(image)).join("");
  return `<w:r>${props ? `<w:rPr>${props}</w:rPr>` : ""}${pieces}${images}</w:r>`;
}
function imageXml(image) {
  const width = Math.max(1, Math.round((image.width || 320) * 9525)), height = Math.max(1, Math.round((image.height || 240) * 9525));
  return `<w:drawing><wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><wp:extent cx="${width}" cy="${height}"/><wp:docPr id="1" name="Picture"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:blipFill><a:blip r:embed="${esc(image.relationshipId)}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:ext cx="${width}" cy="${height}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing>`;
}

export function addDocxImage(model, bytes, { mime = "image/png", width = 320, height = 240 } = {}) {
  const extension = mime === "image/jpeg" ? "jpg" : mime.split("/")[1]?.replace("svg+xml", "svg") || "png";
  let number = 1; while (model.parts[`word/media/framechute${number}.${extension}`]) number += 1;
  const part = `word/media/framechute${number}.${extension}`, relationshipId = `rIdFrameChute${number}`;
  model.parts[part] = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const relPath = "word/_rels/document.xml.rels";
  let rels = model.parts[relPath] ? strFromU8(model.parts[relPath]) : `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="${REL}"></Relationships>`;
  rels = rels.replace(/<\/Relationships>\s*$/, `<Relationship Id="${relationshipId}" Type="${IMAGE_REL}" Target="media/${part.split("/").pop()}"/></Relationships>`);
  model.parts[relPath] = strToU8(rels); model.relationships?.set(relationshipId, part); model.packageDirty = true;
  const contentPath = "[Content_Types].xml";
  if (model.parts[contentPath]) { let types = strFromU8(model.parts[contentPath]); if (!new RegExp(`Extension=["']${extension}["']`, "i").test(types)) types = types.replace(/<\/Types>\s*$/, `<Default Extension="${extension}" ContentType="${mime}"/></Types>`); model.parts[contentPath] = strToU8(types); }
  return { kind: "image", relationshipId, part, mime, width, height };
}
function paragraphXml(p) {
  const props = `${p.style ? `<w:pStyle w:val="${esc(p.style)}"/>` : ""}${p.alignment && p.alignment !== "left" ? `<w:jc w:val="${esc(p.alignment)}"/>` : ""}${p.list ? '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>' : ""}`;
  return `<w:p>${props ? `<w:pPr>${props}</w:pPr>` : ""}${(p.runs || []).map(runXml).join("")}</w:p>`;
}
function blockXml(block) {
  if (block.type === "table") return `<w:tbl>${block.rows.map((row) => `<w:tr>${row.map((cell) => `<w:tc>${cell.map(paragraphXml).join("")}<w:tcPr/></w:tc>`).join("")}</w:tr>`).join("")}</w:tbl>`;
  return paragraphXml(block);
}

export function serializeDocx(model) {
  if (!model?.parts) throw new Error("The original DOCX package is unavailable.");
  const parts = { ...model.parts };
  const runs = [];
  const collect = (blocks) => { for (const block of blocks) { if (block.type === "table") for (const row of block.rows) for (const cell of row) collect(cell); else runs.push(...(block.runs || [])); } };
  collect(model.blocks);
  const originalTextCount = (model.originalXml.match(/<w:t(?:\s[^>]*)?>[\s\S]*?<\/w:t>/g) || []).length;
  const textRuns = runs.filter((run) => typeof run.text === "string" && run.text.length > 0);
  if (!model.packageDirty && originalTextCount === textRuns.length) {
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
      const retained = oldProperties.replace(/<w:(?:b|i|u)(?:\s[^>]*)?\/?>(?:<\/w:(?:b|i|u)>)?/g, "");
      const formatting = `${retained}${run.bold ? "<w:b/>" : ""}${run.italic ? "<w:i/>" : ""}${run.underline ? '<w:u w:val="single"/>' : ""}`;
      const withoutProperties = body.replace(/<w:rPr>[\s\S]*?<\/w:rPr>/, "");
      return `<w:r${attrs}>${formatting ? `<w:rPr>${formatting}</w:rPr>` : ""}${withoutProperties}</w:r>`;
    });
    parts["word/document.xml"] = strToU8(xml);
  } else {
    const section = model.originalXml.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/)?.[0] || "";
    parts["word/document.xml"] = strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="${W}" xmlns:r="${R}"><w:body>${model.blocks.map(blockXml).join("")}${section}</w:body></w:document>`);
  }
  return new Blob([zipSync(parts, { level: 6 })], { type: CONTENT_TYPE });
}

export const DOCX_MIME = CONTENT_TYPE;
