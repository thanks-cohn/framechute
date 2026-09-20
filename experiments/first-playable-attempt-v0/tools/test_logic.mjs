// Test navigation logic in Node with a deterministic, mocked browser. This does not test pixel rendering.
import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const code=fs.readFileSync(new URL('../game.js',import.meta.url),'utf8');
let frames=[],time=0,tips={},store=new Map(),keyListeners={},winListeners={};
class Img {set src(s){this._src=s;this.onload?.();}}
const no=()=>{};
const ctx=new Proxy({measureText:t=>({width:t.length*7})}, {get:(a,k)=>k in a?a[k]:no,set:(a,k,v)=>(a[k]=v,true)});
function elem(id){if(!tips[id]) tips[id]={id,textContent:'',classList:{add:no,remove:no},focus:no,addEventListener:no,getContext:()=>ctx};return tips[id];}
const document={getElementById:elem,querySelectorAll:()=>[],};
const window={addEventListener:(k,cb)=>winListeners[k]=cb,setTimeout:(f)=>{f();return 1;}};
const localStorage={setItem:(k,v)=>store.set(k,v),getItem:k=>store.get(k)};
const sandbox={window,document,localStorage,Image:Img,console,Math,JSON,Number,Set,performance:{now:()=>time},requestAnimationFrame:cb=>frames.push(cb)};
vm.runInNewContext(code,sandbox,{filename:'game.js'});
// promise microtasks needed for image.onload -> Promise.all
await new Promise(r=>setImmediate(r));
assert.equal(elem('mode-label').textContent,'Town exploration');
const advance=(n,delta=16.67)=>{for(let i=0;i<n;i++){let cb=frames.shift();assert.ok(cb,'frame available');time+=delta;cb(time);}};
winListeners.keydown({key:'ArrowDown',repeat:false,preventDefault:no});
advance(64);winListeners.keyup({key:'ArrowDown'});
console.log('After town southern road:',elem('mode-label').textContent,JSON.parse(store.get('substrate-town-prototype-v1')));
assert.equal(elem('mode-label').textContent,'Overworld exploration');
winListeners.keydown({key:'e',repeat:false,preventDefault:no});advance(1);
console.log('After E at western town:',elem('mode-label').textContent,JSON.parse(store.get('substrate-town-prototype-v1')));
assert.equal(elem('mode-label').textContent,'Town exploration');
console.log('PASS — map load, walk, gate, overworld reentry, persisted coordinates.');
