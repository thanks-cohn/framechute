/** Copy real object content and describe exactly what reached the clipboard. */
export async function copyContentToClipboard({blob=null,text="",clipboard=globalThis.navigator?.clipboard,ClipboardItemClass=globalThis.ClipboardItem}={}){
  if(blob&&clipboard?.write&&ClipboardItemClass){
    const type=blob.type||"application/octet-stream";
    const supported=typeof ClipboardItemClass.supports!=="function"||ClipboardItemClass.supports(type);
    if(supported){await clipboard.write([new ClipboardItemClass({[type]:blob})]);return {ok:true,kind:"blob",type,message:`Copied ${type} content to the clipboard.`};}
  }
  const useful=String(text||"").trim();
  if(useful&&clipboard?.writeText){await clipboard.writeText(useful);return {ok:true,kind:"text",type:"text/plain",message:"Binary clipboard content is not supported here; copied the object's text content instead."};}
  return {ok:false,kind:"none",type:null,message:"Copy failed: this browser cannot copy this object's content, and no text fallback is available."};
}
