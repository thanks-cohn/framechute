export function formatDocxNumber(value, format = "decimal") {
  const n=Math.max(1,Math.floor(Number(value)||1));
  if(/^decimalZero$/i.test(format)) return String(n).padStart(4,"0");
  if(/roman/i.test(format)) {
    const values=[[1000,"m"],[900,"cm"],[500,"d"],[400,"cd"],[100,"c"],[90,"xc"],[50,"l"],[40,"xl"],[10,"x"],[9,"ix"],[5,"v"],[4,"iv"],[1,"i"]];
    let left=n,out=""; for(const [amount,glyph] of values) while(left>=amount){out+=glyph;left-=amount;}
    return /^upper/i.test(format)?out.toUpperCase():out;
  }
  if(/letter/i.test(format)) {
    let left=n,out=""; while(left){left--;out=String.fromCharCode(97+(left%26))+out;left=Math.floor(left/26);}
    return /^upper/i.test(format)?out.toUpperCase():out;
  }
  return String(n);
}

export class DocxNumberingState {
  constructor(definitions=new Map()) { this.definitions=definitions; this.counters=new Map(); this.previousLevel=new Map(); }
  label(paragraph) {
    if(!paragraph?.list) return "";
    if(paragraph.list==="bullet") return paragraph.numberText||"•";
    const numId=Number(paragraph.numId)||0,level=Number(paragraph.level)||0,key=`${numId}:${level}`;
    const definition=this.definitions.get(key)||paragraph;
    const previous=this.previousLevel.get(numId);
    // Descending back to an outer level restarts every subordinate level.
    if(previous!=null&&level<previous) for(const counterKey of [...this.counters.keys()]) {
      const [id,itemLevel]=counterKey.split(":").map(Number); if(id===numId&&itemLevel>level)this.counters.delete(counterKey);
    }
    const value=(this.counters.get(key)??((Number(definition.start??paragraph.numberStart)||1)-1))+1;
    this.counters.set(key,value); this.previousLevel.set(numId,level);
    const template=String(definition.text||paragraph.numberText||`%${level+1}.`);
    return template.replace(/%(\d+)/g,(_,token)=>{
      const tokenLevel=Number(token)-1,tokenDef=this.definitions.get(`${numId}:${tokenLevel}`)||definition;
      const tokenValue=tokenLevel===level?value:(this.counters.get(`${numId}:${tokenLevel}`)??(Number(tokenDef.start)||1));
      return formatDocxNumber(tokenValue,tokenDef.format||"decimal");
    });
  }
}
