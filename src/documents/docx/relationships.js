const PACKAGE_RELATIONSHIPS = "http://schemas.openxmlformats.org/package/2006/relationships";

export function normalizeDocxPart(ownerPart, target) {
  if (!target || /^\w+:\/\//.test(target)) return target || "";
  const base = target.startsWith("/") ? [] : ownerPart.split("/").slice(0, -1);
  for (const segment of target.replace(/^\//, "").split("/")) {
    if (!segment || segment === ".") continue;
    if (segment === "..") base.pop(); else base.push(segment);
  }
  return base.join("/");
}

export function relationshipsPath(ownerPart) {
  const bits = ownerPart.split("/");
  return [...bits.slice(0, -1), "_rels", `${bits.at(-1)}.rels`].join("/");
}

export function readPartRelationships(parts, ownerPart, parseXml, bytesToString) {
  const source = parts[relationshipsPath(ownerPart)];
  const result = new Map();
  if (!source) return result;
  const doc = parseXml(bytesToString(source));
  for (const node of [...(doc.getElementsByTagName?.("*") || [])]) {
    if ((node.localName || node.nodeName?.split(":").pop()) !== "Relationship") continue;
    const id = node.getAttribute("Id"), target = node.getAttribute("Target") || "";
    result.set(id, {
      id, target, type: node.getAttribute("Type") || "",
      external: node.getAttribute("TargetMode") === "External",
      part: node.getAttribute("TargetMode") === "External" ? "" : normalizeDocxPart(ownerPart, target)
    });
  }
  return result;
}

export { PACKAGE_RELATIONSHIPS };
