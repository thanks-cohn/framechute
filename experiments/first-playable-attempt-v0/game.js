'use strict';
/* No dependencies, network calls, extension permissions or access to local files.
 * Map mode is a separate presentation; future SUBSTRATE integration must map
 * towns to stable desktop IDs without duplicating or mutating document data.
 */
(()=>{
 const canvas=document.getElementById('game'),ctx=canvas.getContext('2d');
 const label=document.getElementById('mode-label'),place=document.getElementById('place');
 const tip=document.getElementById('context-tip'),description=document.getElementById('description');
 const fade=document.getElementById('fade');
 ctx.imageSmoothingEnabled=false;
 const W=768,H=576,VIEW={width:768,height:576};
 const imgs={},sources=['town','overworld','hero','npc'];
 let ready=false,last=0,transitioning=false,toastUntil=0;
 let map='town',hero={x:384,y:432,dir:'down',frame:1},visited=false;
 let overworldLast={x:230,y:304};
 let held=new Set(),walkCounter=0,paused=false;
 const destination={town:{label:'First Desktop · Town',tip:'Walk south through the gate, or east along the road, to reach the overworld.'},overworld:{label:'Greater Canvas · Overworld',tip:'Visit the western town and press E to reenter. Eastern town = future desktop.'}};
 const safeKey='substrate-town-prototype-v1';
 try{
  const saved=JSON.parse(localStorage.getItem(safeKey)||'null');
  if(saved && (saved.map==='town'||saved.map==='overworld') && Number.isFinite(saved.hero?.x)&&Number.isFinite(saved.hero?.y)) {
   map=saved.map;hero={x:Math.max(20,Math.min(748,saved.hero.x)),y:Math.max(20,Math.min(550,saved.hero.y)),dir:'down',frame:1};visited=!!saved.visited;
  }
 }catch{}
 function save(){try{localStorage.setItem(safeKey,JSON.stringify({map,hero:{x:hero.x,y:hero.y},visited}));}catch{}}
 function toast(message,seconds=3){tip.textContent=message;toastUntil=performance.now()+seconds*1000;}
 function ui(){label.textContent=map==='town'?'Town exploration':'Overworld exploration';place.textContent=destination[map].label;description.textContent=map==='town'?'Town = one desktop · Leave through a marked road to explore the greater canvas.':'The ship and additional playable desktop towns are the next milestones.';tip.textContent=destination[map].tip;}
 function switchMap(next,x,y,message){if(transitioning||map===next)return;transitioning=true;held.clear();fade.classList.add('active');
  window.setTimeout(()=>{map=next;hero.x=x;hero.y=y;hero.dir='down';visited=true;ui();save();toast(message,4);window.setTimeout(()=>{fade.classList.remove('active');transitioning=false;canvas.focus({preventScroll:true});},130);},230);
 }
 function blockedTown(x,y){
  // Collision with buildings, trees, and the stone fountain; windows stay navigable later.
  const rects=[[301,52,423,128],[98,154,220,244],[583,167,649,254],[93,392,157,492],[587,393,653,493],
   [361,260,414,327],[20,26,48,108],[71,28,97,113],[263,33,289,119],[478,31,505,120],
   [660,26,687,112],[712,30,739,120],[14,164,40,255],[712,168,741,259],[15,408,42,500],
   [714,418,739,512],[249,461,276,554],[486,466,511,559],[25,501,53,572],[684,500,711,573]];
  return rects.some(([x1,y1,x2,y2])=>x>=x1-8&&x<=x2+8&&y>=y1-5&&y<=y2+4);
 }
 function blockedOverworld(x,y){const lake=(x-663)**2/(78**2)+(y-454)**2/(80**2)<1.03;
  return lake||y<105|| (x>=160&&x<220&&y>=174&&y<240) || (x>=463&&x<510&&y>=173&&y<240) ||(x>=549&&x<584&&y>=176&&y<253);
 }
 function move(dx,dy){if(!ready||transitioning||paused)return;
  const nx=hero.x+dx,ny=hero.y+dy;
  if(map==='town'){
   if(ny>=566 && nx>=339&&nx<=434){switchMap('overworld',230,302,'You left First Desktop through its southern gate. Walk north to reenter.');return;}
   if(nx>=759 && ny>=265&&ny<=355){switchMap('overworld',275,236,'You left First Desktop by the eastern road.');return;}
   if(nx<10||nx>758||ny<12||ny>568)return;
   if(!blockedTown(nx,ny)){hero.x=nx;hero.y=ny;}
  }else{
   if(nx<14||nx>755||ny<108||ny>558)return;
   if(!blockedOverworld(nx,ny)){hero.x=nx;hero.y=ny;}
   if(hero.x>150&&hero.x<287&&hero.y>248&&hero.y<277){toast('First Desktop is here! Approach the entrance and press E to enter.',1);}
   if(hero.x>440&&hero.x<612&&hero.y>248&&hero.y<279){toast('Future Desktop: not connected in this prototype.',2);}
  }
  walkCounter++;
  if(walkCounter%24===0)save();
 }
 function interact(){if(!ready||transitioning)return;
  if(map==='overworld'){
   if(hero.x>=135&&hero.x<=300&&hero.y>=236&&hero.y<=344){
    const east=hero.x>265;switchMap('town',east?702:383,east?304:515,'Welcome back to First Desktop. Your town is exactly where you left it.');return;
   }
   if(hero.x>=438&&hero.x<=615&&hero.y>=229&&hero.y<=349){toast('Future Desktop is a placeholder. The second real desktop connection comes after the town prototype.',5);return;}
   toast('Look for the WEST TOWN marker and press E at its entrance.');return;
  }
  if(hero.x>=325&&hero.x<=446&&hero.y>=130&&hero.y<=183){toast('Town Hall: future workspace destination. No files are opened or modified in this prototype.',4);return;}
  toast('Explore the square. Walk south through the town gate to the greater canvas.',3);
 }
 function directions(){let x=0,y=0;
  if(held.has('ArrowUp')||held.has('w')||held.has('up'))y--;
  if(held.has('ArrowDown')||held.has('s')||held.has('down'))y++;
  if(held.has('ArrowLeft')||held.has('a')||held.has('left'))x--;
  if(held.has('ArrowRight')||held.has('d')||held.has('right'))x++;
  return {x,y};
 }
 function loop(timestamp){let dt=last?Math.min((timestamp-last)/1000,.05):0;last=timestamp;
  const {x,y}=directions();
  if(x||y){if(Math.abs(x)>Math.abs(y))hero.dir=x>0?'right':'left';else hero.dir=y>0?'down':'up';
   const speed=(held.has('Shift')?210:133)*dt/(x&&y?Math.SQRT2:1);
   move(x*speed,0);move(0,y*speed);hero.frame=(Math.floor(timestamp/115)%3);
  } else hero.frame=1;
  draw(timestamp,x||y);requestAnimationFrame(loop);
 }
 function draw(timestamp,moving){ctx.clearRect(0,0,W,H);
  if(!ready){ctx.fillStyle='#101723';ctx.fillRect(0,0,W,H);ctx.fillStyle='#f2da9c';ctx.font='20px Georgia';ctx.fillText('Loading the little town…',243,283);return;}
  ctx.drawImage(imgs[map],0,0);
  if(map==='town'){
   labelAt('TOWN HALL',355,140);labelAt('SOUTH GATE ↓',385,526);
   labelAt('TO OVERWORLD →',681,318);
   for(const npc of [[268,373,1],[481,368,0],[172,276,2],[540,331,1]])drawSprite(imgs.npc,npc[2],3,npc[0],npc[1]);
  } else{
   labelAt('FIRST DESKTOP',235,162);labelAt('ENTER: E',231,273);
   labelAt('FUTURE DESKTOP',523,160);labelAt('COMING LATER',527,273);
   labelAt('WALK TO TOWN',230,395);
  }
  // Draw centered sprite at native resolution, 2x crisp pixels for legibility.
  const row={right:0,left:1,up:2,down:3}[hero.dir]??3;
  drawSprite(imgs.hero,moving?hero.frame:1,row,hero.x,hero.y);
  if(toastUntil && timestamp>toastUntil){toastUntil=0;tip.textContent=destination[map].tip;}
 }
 function labelAt(txt,x,y){ctx.font='bold 11px ui-monospace,monospace';ctx.textBaseline='middle';ctx.textAlign='center';const width=ctx.measureText(txt).width+16;
  ctx.fillStyle='#0d1e27e8';ctx.fillRect(x-width/2,y-10,width,20);ctx.strokeStyle='#e4d08a';ctx.strokeRect(x-width/2+.5,y-9.5,width-1,19);
  ctx.fillStyle='#ffe5a5';ctx.fillText(txt,x,y);ctx.textAlign='start';}
 function drawSprite(im,col,row,x,y){if(!im)return;ctx.fillStyle='#2e463e91';ctx.beginPath();ctx.ellipse(x,y+2,9,4,0,0,Math.PI*2);ctx.fill();ctx.drawImage(im,col*16,row*16,16,16,Math.round(x-16),Math.round(y-27),32,32);}
 const valid=new Set(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d','Shift','e','E']);
 window.addEventListener('keydown',ev=>{if(valid.has(ev.key)){ev.preventDefault();if((ev.key==='e'||ev.key==='E')&&!ev.repeat)interact();else held.add(ev.key);}});
 window.addEventListener('keyup',ev=>{held.delete(ev.key);});window.addEventListener('blur',()=>held.clear());
 document.querySelectorAll('.touch button').forEach(btn=>{
  const dir=btn.dataset.dir;
  const down=ev=>{ev.preventDefault();held.add(dir);btn.classList.add('pressed');try{btn.setPointerCapture(ev.pointerId)}catch{}};
  const up=ev=>{ev.preventDefault();held.delete(dir);btn.classList.remove('pressed');};
  btn.addEventListener('pointerdown',down);btn.addEventListener('pointerup',up);btn.addEventListener('pointercancel',up);btn.addEventListener('lostpointercapture',up);
 });
 document.getElementById('reset').addEventListener('click',()=>{held.clear();map='town';hero={x:385,y:431,dir:'down',frame:1};visited=false;ui();save();toast('Restarted at First Desktop’s town square.');canvas.focus({preventScroll:true});});
 Promise.all(sources.map(name=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>{imgs[name]=im;resolve()};im.onerror=()=>reject(new Error('Could not load assets/'+name+'.png'));im.src='assets/'+name+'.png';})))
  .then(()=>{ready=true;ui();toast(map==='town'?'Use WASD or arrow keys. Leave through the SOUTH GATE.':'Walk to the western village and press E to return.',6);canvas.focus({preventScroll:true});requestAnimationFrame(loop);})
  .catch(error=>{label.textContent='Asset loading failed';tip.textContent=error.message+' — Open index.html with a browser or run python -m http.server 8000.';console.error(error);});
})();
