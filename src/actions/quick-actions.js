import { ActionRegistry, runBatch } from "./action-registry.js";
import { SelectionModel } from "./selection-model.js";
import { imageElementToBlob, alphaBounds } from "./image-operations.js";
import { saveBlobAs } from "./native-save.js";
import { zipSync } from "../vendor/fflate.mjs";
import { PDFDocument } from "../vendor/pdf-lib.mjs";
import { compareText, replaceAllText, extractDocxText, createSimpleDocx, textToPdf, readableText } from "./document-operations.js";
import { enterPaintMode, isPaintEditing, leavePaintMode, paintOverlayFor, syncPaintOverlay } from "../image-edit/paint-runtime.js";

const workspace = document.querySelector("#workspace");
const status = document.querySelector("#status");
const registry = new ActionRegistry();
const selection = new SelectionModel();
const transforms = new WeakMap();

const bar = document.createElement("aside");
bar.className = "quick-actions"; bar.hidden = true; bar.setAttribute("aria-label", "Quick Actions");
bar.innerHTML = '<strong class="quick-actions-title">Quick Actions</strong><span class="quick-actions-count"></span><div class="quick-actions-buttons"></div><button class="quick-actions-clear" type="button">Clear</button><progress hidden></progress>';
document.body.append(bar);
bar.querySelector(".quick-actions-clear").addEventListener("click", () => selection.clear());

function kind(block) {
  if (block.dataset.customKind === "image" || block.querySelector(".image-frame")) return "image";
  if (block.dataset.blockType === "pdf" || block.classList.contains("pdf-block")) return "pdf";
  if (block.dataset.customLocalKind === "video" || block.querySelector("video")) return "video";
  if (block.dataset.utilityKind) return block.dataset.utilityKind;
  return block.dataset.blockType || "file";
}
function nameOf(block) { return block.querySelector(".block-name")?.value || "result"; }
function imageOf(block) { return block.querySelector(".image-frame, .gallery-image, img"); }
function applies(type, { min = 1, max = Infinity } = {}) { return (items) => items.length >= min && items.length <= max && items.every((item) => kind(item) === type); }
function announce(message) { if (status) status.textContent = message; }
function addResult(blob, name, point) {
  window.dispatchEvent(new CustomEvent("framechute:add-result-object", { detail: { blob, name, point, kind: blob.type.startsWith("image/") ? "image" : "file" } }));
}
async function textOf(block) {
  if(kind(block)==="text")return block.querySelector(".text-editor")?.value||"";
  if(kind(block)==="docx"){const blob=await window.FrameChuteWorkspace.sourceBlob(block);return extractDocxText(blob);}
  if(kind(block)==="pdf")return [...block.querySelectorAll(".pdf-text-layer")].map(node=>node.textContent||"").join("\n").trim();
  return "";
}
const isTextDocument=(item)=>["text","docx","pdf"].includes(kind(item));
const addTextResult=(text,name)=>window.FrameChuteWorkspace.createBlock({type:"text",name,state:{text}});

async function transformed(block, overrides = {}) {
  const image = imageOf(block); if (!image?.complete) throw new Error("The image is not ready yet");
  return imageElementToBlob(image, { ...(transforms.get(block) || {}), paintOverlay: paintOverlayFor(block), ...overrides });
}
function register(action) { registry.register(action); }
function showDialog(title, content, applyLabel = "Apply") {
  return new Promise((resolve) => { const previousFocus=document.activeElement,dialog=document.createElement("dialog");dialog.className="utility-dialog";dialog.innerHTML=`<form method="dialog"><div class="utility-dialog-heading"><h2></h2><button class="utility-dialog-close" type="button" aria-label="Close">×</button></div><div class="utility-dialog-body"></div><div class="utility-dialog-actions"><button class="utility-dialog-cancel" type="button">Cancel</button><button type="submit" value="apply">${applyLabel}</button></div></form>`;dialog.querySelector("h2").textContent=title;dialog.querySelector(".utility-dialog-body").append(content);document.body.append(dialog);const cancel=()=>dialog.close("cancel");dialog.querySelector(".utility-dialog-close").onclick=cancel;dialog.querySelector(".utility-dialog-cancel").onclick=cancel;dialog.addEventListener("cancel",event=>{event.preventDefault();cancel();});dialog.onclose=()=>{const accepted=dialog.returnValue==="apply";dialog.remove();if(previousFocus instanceof HTMLElement&&previousFocus.isConnected)previousFocus.focus();resolve(accepted?content:null);};dialog.showModal(); });
}
async function resizeOptions(item) {
  const image=imageOf(item),panel=document.createElement("div");panel.className="resize-panel";panel.innerHTML=`<div class="resize-controls"><label>Width <input name="width" type="number" min="1" value="${image.naturalWidth}"></label><label>Height <input name="height" type="number" min="1" value="${image.naturalHeight}"></label><label><input name="lock" type="checkbox" checked> Preserve aspect ratio</label><label>Format <select name="format"><option value="png">PNG</option><option value="jpeg">JPEG</option><option value="webp">WebP</option></select></label><label><input name="save" type="checkbox" checked> Save As…</label><label><input name="add" type="checkbox"> Add result to Workspace</label><div><button type="button" data-scale=".5">50%</button> <button type="button" data-scale="2">200%</button></div></div><figure class="resize-preview"><img alt="Actual resized preview"><figcaption>Preparing preview…</figcaption></figure>`;
  const width=panel.querySelector('[name="width"]'),height=panel.querySelector('[name="height"]'),lock=panel.querySelector('[name="lock"]'),format=panel.querySelector('[name="format"]'),preview=panel.querySelector("img"),caption=panel.querySelector("figcaption"),ratio=image.naturalWidth/image.naturalHeight;let previewUrl="",generation=0,timer;
  const values=()=>({width:Math.max(1,Number(width.value)||1),height:Math.max(1,Number(height.value)||1),lockAspect:lock.checked,format:format.value});
  const refresh=()=>{clearTimeout(timer);const current=++generation;timer=setTimeout(async()=>{try{const options=values(),blob=await transformed(item,options);if(current!==generation)return;if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl=URL.createObjectURL(blob);preview.src=previewUrl;caption.textContent=`Actual ${options.width} × ${options.height} px preview · ${(blob.size/1024).toFixed(1)} KB`;}catch(error){caption.textContent=error.message;}},120);};
  width.oninput=()=>{if(lock.checked)height.value=Math.max(1,Math.round(Number(width.value)/ratio));refresh();};height.oninput=()=>{if(lock.checked)width.value=Math.max(1,Math.round(Number(height.value)*ratio));refresh();};panel.addEventListener("change",refresh);panel.querySelectorAll("[data-scale]").forEach(button=>button.onclick=()=>{width.value=Math.round(image.naturalWidth*button.dataset.scale);height.value=Math.round(image.naturalHeight*button.dataset.scale);refresh();});refresh();
  const accepted=await showDialog("Resize image",panel,"Create result");clearTimeout(timer);generation++;if(previewUrl)URL.revokeObjectURL(previewUrl);if(!accepted)return null;if(!panel.querySelector('[name="save"]').checked&&!panel.querySelector('[name="add"]').checked)throw new Error("Choose Save As, Add to Workspace, or both.");return{...values(),save:panel.querySelector('[name="save"]').checked,add:panel.querySelector('[name="add"]').checked};
}
async function cropOptions(image) { const panel=document.createElement("div");panel.className="crop-panel";const stage=document.createElement("div");stage.className="crop-stage";const preview=image.cloneNode();preview.removeAttribute("style");const box=document.createElement("div");box.className="crop-box";for(const edge of["nw","ne","sw","se"]){const handle=document.createElement("span");handle.className=`crop-handle crop-handle-${edge}`;handle.dataset.edge=edge;box.append(handle);}stage.append(preview,box);panel.append(stage);let rect={x:.1,y:.1,width:.8,height:.8};const paint=()=>Object.assign(box.style,{left:`${rect.x*100}%`,top:`${rect.y*100}%`,width:`${rect.width*100}%`,height:`${rect.height*100}%`});paint();box.onpointerdown=(event)=>{event.preventDefault();const bounds=stage.getBoundingClientRect(),edge=event.target.dataset.edge,start={clientX:event.clientX,clientY:event.clientY,...rect};box.setPointerCapture(event.pointerId);box.onpointermove=(move)=>{const dx=(move.clientX-start.clientX)/bounds.width,dy=(move.clientY-start.clientY)/bounds.height;if(!edge){rect.x=Math.max(0,Math.min(1-rect.width,start.x+dx));rect.y=Math.max(0,Math.min(1-rect.height,start.y+dy));}else{const left=edge.includes("w")?Math.max(0,Math.min(start.x+start.width-.02,start.x+dx)):start.x,top=edge.includes("n")?Math.max(0,Math.min(start.y+start.height-.02,start.y+dy)):start.y,right=edge.includes("e")?Math.min(1,Math.max(start.x+.02,start.x+start.width+dx)):start.x+start.width,bottom=edge.includes("s")?Math.min(1,Math.max(start.y+.02,start.y+start.height+dy)):start.y+start.height;rect={x:left,y:top,width:right-left,height:bottom-top};}paint();};box.onpointerup=()=>{box.onpointermove=null;};};if(!await showDialog("Crop image — drag or resize the crop box",panel))return null;return{x:Math.round(rect.x*image.naturalWidth),y:Math.round(rect.y*image.naturalHeight),width:Math.round(rect.width*image.naturalWidth),height:Math.round(rect.height*image.naturalHeight)}; }

register({ id: "object.rename", label: "Rename", appliesTo: (s) => s.length > 0, async run({ selection: items }) {
  if (items.length === 1) { const value = prompt("New name", nameOf(items[0])); if (value?.trim()) items[0].querySelector(".block-name").value = value.trim(); return; }
  const panel=document.createElement("div");panel.className="batch-rename-panel";panel.innerHTML='<label>Prefix <input name="prefix"></label><label>Suffix <input name="suffix"></label><label>Search <input name="search"></label><label>Replace <input name="replace"></label><label><input name="sequence" type="checkbox" checked> Add sequence number</label><ol></ol>';const preview=()=>{const data=Object.fromEntries(new FormData(panel.closest("form")||document.createElement("form")));const prefix=panel.querySelector('[name=prefix]').value,suffix=panel.querySelector('[name=suffix]').value,search=panel.querySelector('[name=search]').value,replacement=panel.querySelector('[name=replace]').value,sequence=panel.querySelector('[name=sequence]').checked;panel.querySelector("ol").replaceChildren(...items.map((item,index)=>{const li=document.createElement("li");let value=nameOf(item);if(search)value=value.split(search).join(replacement);li.textContent=`${prefix}${value}${suffix}${sequence?`-${String(index+1).padStart(String(items.length).length,"0")}`:""}`;return li;}));};panel.addEventListener("input",preview);preview();if(!await showDialog(`Rename ${items.length} objects — preview`,panel))return;[...panel.querySelectorAll("ol li")].forEach((li,index)=>items[index].querySelector(".block-name").value=li.textContent);
} });
register({ id: "object.duplicate", label: "Duplicate", appliesTo: (s) => s.length > 0, async run({ selection: items }) {
  for (const item of items) await window.FrameChuteWorkspace.duplicateBlock(item);
  announce(`${items.length} non-destructive workspace cop${items.length === 1 ? "y" : "ies"} created.`);
} });
register({id:"object.copy-to",label:"Copy To…",appliesTo:(s)=>s.length>0&&typeof window.showDirectoryPicker==="function",async run({selection:items}){let directory;try{directory=await window.showDirectoryPicker({mode:"readwrite"});}catch(error){if(error.name==="AbortError")return;throw error;}let copied=0,excluded=[];for(const item of items){const blob=imageOf(item)?await transformed(item,{format:"png"}):await window.FrameChuteWorkspace.sourceBlob(item);if(!blob){excluded.push(nameOf(item));continue;}const filename=imageOf(item)?`${nameOf(item).replace(/\.[^.]+$/,"")}.png`:nameOf(item),handle=await directory.getFileHandle(filename,{create:true}),writer=await handle.createWritable();await writer.write(blob);await writer.close();copied++;}announce(`${copied} file(s) copied. Originals were not deleted.${excluded.length?` Unsupported: ${excluded.join(", ")}.`:""}`);}});
register({ id: "image.rotate-left", label: "↶ Rotate", appliesTo: applies("image"), async run({ selection: items }) { items.forEach((item) => updateTransform(item, { rotate: (transforms.get(item)?.rotate || 0) - 90 })); } });
register({ id: "image.paint", label: "Image Editing", appliesTo: applies("image", { max: 1 }), async run({ selection: [item] }) { if(isPaintEditing(item)){leavePaintMode(item);announce("Image editing is OFF. Edits are preserved and normal object controls are restored.");}else{await enterPaintMode(item);announce("Image editing is ON. Draw on the object; turning it off preserves your edits.");} } });
register({ id: "image.rotate-right", label: "Rotate ↷", appliesTo: applies("image"), async run({ selection: items }) { items.forEach((item) => updateTransform(item, { rotate: (transforms.get(item)?.rotate || 0) + 90 })); } });
register({ id: "image.flip-x", label: "Flip Horizontal", appliesTo: applies("image"), async run({ selection: items }) { items.forEach((item) => updateTransform(item, { flipX: !transforms.get(item)?.flipX })); } });
register({ id: "image.flip-y", label: "Flip Vertical", appliesTo: applies("image"), async run({ selection: items }) { items.forEach((item) => updateTransform(item, { flipY: !transforms.get(item)?.flipY })); } });
register({ id: "image.resize", label: "Resize Image…", appliesTo: applies("image",{max:1}), async run({ selection: [item] }) {
  const options=await resizeOptions(item);if(!options)return;const blob=await transformed(item,options),extension=options.format==="jpeg"?"jpg":options.format,filename=`${nameOf(item).replace(/\.[^.]+$/,"")}-${options.width}x${options.height}.${extension}`;let saved=false;
  if(options.save){const result=await saveBlobAs({blob,filename,extension,mimeType:blob.type,description:"Resized image"});saved=result.saved;}
  if(options.add)addResult(blob,filename);
  announce(`Resized to ${options.width} × ${options.height}px.${saved?" Saved.":""}${options.add?" Added to the workspace.":""} Original unchanged.`);
} });
register({ id: "image.crop", label: "Crop", appliesTo: applies("image", { max: 1 }), async run({ selection: [item] }) {
  const crop=await cropOptions(imageOf(item));if(!crop)return;
  const blob=await transformed(item,{crop,width:crop.width,height:crop.height,lockAspect:false,format:"png"});
  const bounds=item.getBoundingClientRect(),point={x:Math.round(bounds.left+32+window.scrollX),y:Math.round(bounds.top+32+window.scrollY)};
  addResult(blob,`${nameOf(item).replace(/\.[^.]+$/,"")}-cropped.png`,point);
  announce("A cropped image object was created. The original is unchanged.");
} });
register({ id: "image.trim-alpha", label: "Trim transparency", appliesTo: applies("image", { max: 1 }), async run({ selection: [item] }) {
  const image = imageOf(item), canvas = document.createElement("canvas"); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d"); context.drawImage(image, 0, 0); const bounds = alphaBounds(context.getImageData(0,0,canvas.width,canvas.height).data, canvas.width, canvas.height);
  if (!bounds) throw new Error("The image is fully transparent"); updateTransform(item, { crop: bounds }); announce("Transparent margins trimmed non-destructively.");
} });
register({id:"image.color-transparent",label:"Make color transparent",appliesTo:applies("image"),async run({selection:items}){const panel=document.createElement("div");panel.innerHTML='<label>Color <input type="color" value="#ffffff"></label><label>Tolerance <input type="range" min="0" max="150" value="30"></label>';if(!await showDialog("Make a color transparent",panel))return;items.forEach(item=>updateTransform(item,{transparentColor:panel.querySelector('[type=color]').value,tolerance:Number(panel.querySelector('[type=range]').value)}));}});
register({id:"image.fill-background",label:"Fill background",appliesTo:applies("image"),async run({selection:items}){const color=prompt("Background color", "#ffffff");if(color)items.forEach(item=>updateTransform(item,{background:color}));}});
register({id:"image.privacy-region",label:"Blur / pixelate",appliesTo:applies("image",{max:1}),async run({selection:[item]}){const crop=await cropOptions(imageOf(item));if(!crop)return;const image=imageOf(item),effect=confirm("OK for pixelate, Cancel for blur")?"pixelate":"blur",region={x:crop.x/image.naturalWidth,y:crop.y/image.naturalHeight,width:crop.width/image.naturalWidth,height:crop.height/image.naturalHeight,effect};updateTransform(item,{regions:[...(transforms.get(item)?.regions||[]),region]});announce(`${effect} region added non-destructively.`);}});
register({id:"image.annotate",label:"Annotate",appliesTo:applies("image",{max:1}),async run({selection:[item]}){const choice=(prompt("Annotation type: text, rectangle, or arrow","text")||"").toLowerCase();if(!choice)return;let annotation;if(choice.startsWith("t")){const text=prompt("Annotation text","");if(text==null)return;annotation={type:"text",text,x:.1,y:.15,color:"#ff0000",size:28};}else if(choice.startsWith("a")||choice.startsWith("l"))annotation={type:"arrow",x:.1,y:.2,endX:.7,endY:.7,color:"#ff0000",width:4};else annotation={type:"rectangle",x:.1,y:.1,width:.5,height:.3,color:"#ff0000"};updateTransform(item,{annotations:[...(transforms.get(item)?.annotations||[]),annotation]});announce("Annotation added. It remains editable in the snapshot until Save As.");}});
register({ id: "image.straighten", label: "Straighten", appliesTo: applies("image"), async run({ selection: items }) { const degrees = Number(prompt("Straighten angle (-15 to 15 degrees)", "0")); if (!Number.isFinite(degrees)) return; items.forEach((item) => updateTransform(item, { straighten: Math.max(-15, Math.min(15, degrees)) })); } });
register({id:"image.perspective",label:"Perspective",appliesTo:applies("image",{max:1}),async run({selection:[item]}){const inset=Math.max(0,Math.min(45,Number(prompt("Basic four-corner correction: top edge inset percent", "8"))||0))/100;updateTransform(item,{perspective:[[inset,0],[1-inset,0],[1,1],[0,1]]});announce("Basic four-corner perspective correction applied non-destructively.");}});
register({ id: "image.save-as", label: "Save As", appliesTo: applies("image"), async run({ selection: items, progress }) {
  const panel=document.createElement("div");panel.className="export-panel";panel.innerHTML='<label>Format <select name="format"><option value="webp">WebP</option><option value="jpeg">JPEG</option><option value="png">PNG</option></select></label><label>Quality <input name="quality" type="range" min="10" max="100" value="86"><output>86%</output></label><label>Transparency background <input name="background" type="color" value="#ffffff"></label><p>The source remains unchanged. Encoded byte size is reported after export.</p>';panel.querySelector('[name="quality"]').oninput=e=>panel.querySelector("output").value=`${e.target.value}%`;if(!await showDialog(items.length>1?`Convert/compress ${items.length} images`:"Convert / compress image",panel,"Save As"))return;const format=panel.querySelector('[name="format"]').value,quality=Number(panel.querySelector('[name="quality"]').value)/100,background=format==="jpeg"?panel.querySelector('[name="background"]').value:undefined;
  const sizes=[],batchFiles={};await runBatch(items, async (item) => { const blob = await transformed(item, { format, quality, background });let before=null;try{const response=await fetch(imageOf(item).currentSrc||imageOf(item).src);before=Number(response.headers.get("content-length"))|| (await response.blob()).size;}catch{}sizes.push([before,blob.size]);const extension=format==="jpeg"?"jpg":format,filename=`${nameOf(item).replace(/\.[^.]+$/,"")}.${extension}`;if(items.length>1)batchFiles[filename]=new Uint8Array(await blob.arrayBuffer());else await saveBlobAs({ blob, filename, extension, mimeType: blob.type, description: "Image" }); }, { onProgress: progress });
  if(items.length>1)await saveBlobAs({blob:new Blob([zipSync(batchFiles)],{type:"application/zip"}),filename:`converted-${format}-images.zip`,extension:"zip",mimeType:"application/zip",description:"Converted image batch"});
  if(items.length===1)announce(`${sizes[0][0]?.toLocaleString()||"Unknown source size"} → ${sizes[0][1].toLocaleString()} bytes. Source unchanged.`);else announce(`${items.length} images encoded with one shared configuration.`);
} });
register({ id: "image.stitch", label: "Stitch", appliesTo: applies("image", { min: 2 }), async run({ selection: items }) {
  const direction = prompt("Stitch direction: vertical or horizontal", "vertical"); if (!direction) return;
  const images = items.map(imageOf), vertical = direction.toLowerCase() !== "horizontal", canvas = document.createElement("canvas");
  canvas.width = vertical ? Math.max(...images.map(i => i.naturalWidth)) : images.reduce((n,i) => n+i.naturalWidth,0);
  canvas.height = vertical ? images.reduce((n,i) => n+i.naturalHeight,0) : Math.max(...images.map(i => i.naturalHeight));
  const ctx = canvas.getContext("2d"); let offset = 0; for (const image of images) { ctx.drawImage(image, vertical ? 0 : offset, vertical ? offset : 0); offset += vertical ? image.naturalHeight : image.naturalWidth; }
  const blob = await new Promise(r => canvas.toBlob(r, "image/png")); addResult(blob, "stitched-images.png");
} });
register({id:"image.contact-sheet",label:"Contact sheet",appliesTo:applies("image",{min:2}),async run({selection:items}){const images=items.map(imageOf),columns=Math.ceil(Math.sqrt(images.length)),cell=220,caption=28,rows=Math.ceil(images.length/columns),canvas=document.createElement("canvas");canvas.width=columns*cell;canvas.height=rows*(cell+caption);const ctx=canvas.getContext("2d");ctx.fillStyle="#fff";ctx.fillRect(0,0,canvas.width,canvas.height);images.forEach((image,index)=>{const x=index%columns*cell,y=Math.floor(index/columns)*(cell+caption),scale=Math.min(cell/image.naturalWidth,cell/image.naturalHeight);ctx.drawImage(image,x+(cell-image.naturalWidth*scale)/2,y,image.naturalWidth*scale,image.naturalHeight*scale);ctx.fillStyle="#111";ctx.font="14px sans-serif";ctx.fillText(nameOf(items[index]).slice(0,28),x+6,y+cell+19);});const blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/png"));addResult(blob,"contact-sheet.png");}});
register({id:"image.icons",label:"Generate icons",appliesTo:applies("image",{max:1}),async run({selection:[item]}){const files={};for(const size of [16,32,48,128,192,512])files[`icon-${size}.png`]=new Uint8Array(await (await transformed(item,{width:size,height:size,lockAspect:false,format:"png"})).arrayBuffer());await saveBlobAs({blob:new Blob([zipSync(files)],{type:"application/zip"}),filename:"icons.zip",extension:"zip",mimeType:"application/zip",description:"Icon set"});}});
register({id:"image.compare",label:"Compare",appliesTo:applies("image",{min:2,max:2}),async run({selection:items}){const panel=document.createElement("div");panel.className="compare-panel";const first=imageOf(items[0]).cloneNode(),second=imageOf(items[1]).cloneNode(),range=document.createElement("input");range.type="range";range.min=0;range.max=100;range.value=50;second.style.opacity=".5";range.oninput=()=>second.style.opacity=String(Number(range.value)/100);panel.append(first,second,range);await showDialog("Compare two images — adjust opacity",panel,"Done");}});
register({id:"image.make-pdf",label:"Make PDF",appliesTo:applies("image"),async run({selection:items}){const pdf=await PDFDocument.create();for(const item of items){const blob=await transformed(item,{format:"png"}),embedded=await pdf.embedPng(await blob.arrayBuffer()),page=pdf.addPage([embedded.width,embedded.height]);page.drawImage(embedded,{x:0,y:0,width:embedded.width,height:embedded.height});}const blob=new Blob([await pdf.save()],{type:"application/pdf"});window.dispatchEvent(new CustomEvent("framechute:add-result-object",{detail:{blob,name:"images.pdf",kind:"pdf"}}));}});
register({id:"document.extract-text",label:"Extract text",appliesTo:(s)=>s.length===1&&isTextDocument(s[0]),async run({selection:[item]}){const text=await textOf(item);if(!text&&kind(item)==="pdf")throw new Error("No selectable text was found on the rendered PDF page. Scanned pages require the optional local OCR engine.");await addTextResult(text,`${nameOf(item)} text`);announce("Extracted text added as an editable workspace object.");}});
register({id:"document.compare",label:"Compare documents",appliesTo:(s)=>s.length===2&&s.every(isTextDocument),async run({selection:items}){const changes=compareText(await textOf(items[0]),await textOf(items[1]));const html=changes.map(change=>change.type==="same"?change.text:change.type==="insert"?`[+${change.text}+]`:`[-${change.text}-]`).join(" ");await addTextResult(html,`Comparison — ${nameOf(items[0])} and ${nameOf(items[1])}`);}});
register({id:"document.find-replace",label:"Find & Replace",appliesTo:(s)=>s.length===1&&["text","docx"].includes(kind(s[0])),async run({selection:[item]}){const search=prompt("Find","");if(!search)return;const replacement=prompt("Replace with","");if(replacement==null)return;if(kind(item)==="text"){const editor=item.querySelector(".text-editor"),result=replaceAllText(editor.value,search,replacement);editor.value=result.text;editor.dispatchEvent(new Event("input",{bubbles:true}));announce(`${result.count} replacement(s) made.`);}else{const editor=item.querySelector(".docx-editor"),result=replaceAllText(editor.textContent,search,replacement);editor.textContent=result.text;editor.dispatchEvent(new Event("input",{bubbles:true}));announce(`${result.count} replacement(s) made. Formatting across replaced runs may be simplified.`);}}});
register({id:"document.to-pdf",label:"Convert to PDF",appliesTo:(s)=>s.length===1&&["text","docx"].includes(kind(s[0])),async run({selection:[item]}){const text=kind(item)==="docx"?readableText(item.querySelector(".docx-editor")?.innerHTML||""):await textOf(item),blob=await textToPdf(text,{title:nameOf(item)});window.dispatchEvent(new CustomEvent("framechute:add-result-object",{detail:{blob,name:`${nameOf(item).replace(/\.[^.]+$/,"")}.pdf`,kind:"pdf"}}));}});
register({id:"document.to-docx",label:"Convert to DOCX",appliesTo:(s)=>s.length===1&&["text","pdf"].includes(kind(s[0])),async run({selection:[item]}){const blob=createSimpleDocx(await textOf(item));window.dispatchEvent(new CustomEvent("framechute:add-result-object",{detail:{blob,name:`${nameOf(item).replace(/\.[^.]+$/,"")}.docx`,kind:"docx"}}));}});
register({id:"csv.merge",label:"Merge CSVs",appliesTo:applies("csv",{min:2}),async run({selection:items}){const records=items.map(item=>window.FrameChuteWorkspace.captureBlock(item)),headers=records.map(record=>JSON.stringify(record.state.rows?.[0]||[]));if(!headers.every(header=>header===headers[0]))throw new Error("CSV headers are not compatible.");const rows=[records[0].state.rows[0],...records.flatMap(record=>record.state.rows.slice(1))];await window.FrameChuteWorkspace.createBlock({type:"csv",name:"merged.csv",state:{rows}});announce(`${items.length} compatible CSV tables merged.`);}});
register({ id: "video.extract-frame", label: "Extract Frame", appliesTo: applies("video", { max: 1 }), async run({ selection: [item] }) {
  const video = item.querySelector("video"); if (!video?.videoWidth) throw new Error("Seek to a decoded video frame first");
  const canvas = document.createElement("canvas"); canvas.width = video.videoWidth; canvas.height = video.videoHeight; canvas.getContext("2d").drawImage(video,0,0);
  const blob = await new Promise(r => canvas.toBlob(r,"image/png")); addResult(blob, `${nameOf(item)}-frame.png`); announce("Frame extracted as an editable image object.");
} });
register({ id: "selection.zip", label: "Compress to ZIP", appliesTo: (s) => s.length > 1, async run({ selection: items }) {
  const files = {}, excluded=[]; for (const item of items) { const image = imageOf(item); let blob,filename=nameOf(item);if(image){blob=await transformed(item,{format:"png"});filename=`${filename.replace(/\.[^.]+$/,"")}.png`;}else blob=await window.FrameChuteWorkspace.sourceBlob(item);if(blob)files[filename]=new Uint8Array(await blob.arrayBuffer());else excluded.push(filename); }
  if (!Object.keys(files).length) throw new Error("None of the selected objects expose safe source or result bytes.");
  await saveBlobAs({ blob: new Blob([zipSync(files)], { type: "application/zip" }), filename: "framechute-selection.zip", extension: "zip", mimeType: "application/zip", description: "ZIP archive" });
  if(excluded.length)announce(`ZIP saved. Excluded unsupported objects: ${excluded.join(", ")}.`);
} });

function updateTransform(item, patch) {
  const value = { ...(transforms.get(item) || {}), ...patch }; transforms.set(item, value);
  const image = imageOf(item); if (image) image.style.transform = `rotate(${(value.rotate || 0) + (value.straighten || 0)}deg) scaleX(${value.flipX ? -1 : 1}) scaleY(${value.flipY ? -1 : 1})`;
  syncPaintOverlay(item);
  item.dataset.utilityTransformed = "true";
}
function render() {
  const items = selection.items; workspace.querySelectorAll(".block").forEach((node) => node.classList.toggle("is-quick-selected", selection.has(node)));
  bar.hidden = !items.length; if (!items.length) return;
  bar.querySelector(".quick-actions-count").textContent = `${items.length} selected`;
  const buttons = bar.querySelector(".quick-actions-buttons"); buttons.replaceChildren();
  for (const action of registry.available(items)) { const button = document.createElement("button"); button.type="button"; button.textContent=action.id==="image.paint"?`Image Editing  [ ${isPaintEditing(items[0])?"ON":"OFF"} ]`:action.label; if(action.id==="image.paint")button.setAttribute("aria-pressed",String(isPaintEditing(items[0]))); button.addEventListener("click", async () => { try { button.disabled=true; await registry.run(action.id,{selection:items, progress:(done,total)=>{const p=bar.querySelector("progress");p.hidden=false;p.max=total;p.value=done;}}); } catch(error) { console.error(error); announce(error.message); } finally { button.disabled=false;bar.querySelector("progress").hidden=true;render(); } }); buttons.append(button); }
}
function enhanceObjectMenuControl(block) {
  if (block.querySelector(":scope > .object-menu-toggle")) return;
  const button = document.createElement("button"); button.type = "button"; button.className = "object-menu-toggle"; button.title = "Open object menu"; button.setAttribute("aria-label", "Open object menu"); button.textContent = "☰";
  button.addEventListener("click", (event) => { event.stopPropagation(); if (!selection.has(block)) selection.replace(block); window.dispatchEvent(new CustomEvent("framechute:open-object-menu", { detail: { block, clientX:event.clientX, clientY:event.clientY } })); }); block.append(button);
}
window.addEventListener("framechute:block-captured", (event) => {
  const { block, record } = event.detail; const value = transforms.get(block); if (!value) return;
  record.state.quickActionTransforms = structuredClone(value);
  if (typeof record.state.text === "string" && record.state.text.startsWith("__FLASHFRAME_CUSTOM_BLOCK_V1__")) {
    const marker = "__FLASHFRAME_CUSTOM_BLOCK_V1__"; const payload = JSON.parse(record.state.text.slice(marker.length)); payload.quickActionTransforms = value; record.state.text = marker + JSON.stringify(payload);
  }
});
function restoreTransforms(block, value) { if (!value) return; transforms.set(block, structuredClone(value)); updateTransform(block, {}); }
window.addEventListener("framechute:block-restored", (event) => restoreTransforms(event.detail.block, event.detail.record.state?.quickActionTransforms));
window.addEventListener("framechute:custom-block-ready", (event) => restoreTransforms(event.detail.block, event.detail.payload?.quickActionTransforms));
selection.addEventListener("change", () => { document.querySelectorAll(".is-paint-editing").forEach((block) => { if (!selection.has(block)) leavePaintMode(block); }); render(); });
window.addEventListener("framechute:image-edit-mode",render);
window.addEventListener("keydown", (event) => {
  if (!['Delete','Backspace'].includes(event.key) || !selection.size || event.defaultPrevented) return;
  const target=event.target;
  if (document.querySelector("dialog[open]") || (target instanceof Element && target.closest('input,textarea,select,[contenteditable="true"],button,a,.text-editor,.docx-editor,.pdf-text-layer'))) return;
  event.preventDefault();
  for (const block of [...selection.items]) block.querySelector(":scope > .block-header .remove-block")?.click();
  for (const block of [...selection.items]) if (!block.isConnected) selection.remove(block);
});
workspace.addEventListener("click", (event) => { const block=event.target.closest(".block"); if (!block || event.target.closest("button,input,textarea,[contenteditable=true]")) return; if (event.ctrlKey||event.metaKey||event.shiftKey) selection.toggle(block); else selection.replace(block); });
workspace.addEventListener("contextmenu", (event) => { const block=event.target.closest(".block"); if (!block) return; event.preventDefault(); selection.has(block) ? render() : selection.replace(block); });
new MutationObserver((mutations) => { selection.items.filter((item)=>!item.isConnected).forEach((item)=>selection.remove(item)); for (const mutation of mutations) for (const node of mutation.addedNodes) if (node instanceof HTMLElement && node.classList.contains("block")) enhanceObjectMenuControl(node); }).observe(workspace,{childList:true});
workspace.querySelectorAll(".block").forEach(enhanceObjectMenuControl);

window.FrameChuteActions = Object.freeze({ registry, selection, runBatch, addResult });

function updateQuickActionsSafeArea() {
  const toolbar=document.querySelector(".toolbar"),bottom=toolbar&&!document.body.classList.contains("toolbar-hidden")?toolbar.getBoundingClientRect().bottom:0;
  document.documentElement.style.setProperty("--quick-actions-safe-top",`${Math.max(12,Math.ceil(bottom)+12)}px`);
}
updateQuickActionsSafeArea();new ResizeObserver(updateQuickActionsSafeArea).observe(document.querySelector(".toolbar"));window.addEventListener("resize",updateQuickActionsSafeArea);new MutationObserver(updateQuickActionsSafeArea).observe(document.body,{attributes:true,attributeFilter:["class"]});
