import { LAYOUTS, GRADES, SIZES, getLayout, renderCover, panelAt, bounds } from './cover.js';
import { runShot } from './shots.js';

const $=id=>document.getElementById(id);
const canvas=$('cover');
const state={layout:'collage',grade:'sunset',size:'portrait',title:'VICE\nAFTER DARK',subtitle:'THE CITY IS YOURS. THE NIGHT IS YOUNG.',selected:0,panels:Array.from({length:5},()=>({photo:null,x:0,y:0,zoom:1}))};
const photos=[];
let serial=0, queued=false, drag=null;
const status=message=>{$('status').textContent=message;};
function fitPreview(){
  const stage=$('canvas-stage'), scale=Math.min(stage.clientWidth/canvas.width,stage.clientHeight/canvas.height);
  if(scale>0){canvas.style.width=canvas.width*scale+'px';canvas.style.height=canvas.height*scale+'px';}
}
new ResizeObserver(fitPreview).observe($('canvas-stage'));
function paint(){renderCover(canvas,state,photos,{selection:!document.body.classList.contains('shot-cover')});fitPreview();}
function schedule(){if(!queued){queued=true;requestAnimationFrame(()=>{queued=false;paint();});}}
function choosePanel(index){state.selected=index;syncCrop();syncPanels();syncTray();schedule();}
function syncCrop(){const p=state.panels[state.selected];$('zoom').value=p.zoom;$('zoom-value').value=Math.round(p.zoom*100)+'%';}
function syncPanels(){
  const target=$('panels');target.replaceChildren();
  getLayout(state.layout).polygons.forEach((_,i)=>{const b=document.createElement('button');b.type='button';b.textContent=String(i+1).padStart(2,'0');b.setAttribute('aria-label',`Select frame ${i+1}`);b.setAttribute('aria-pressed',String(state.selected===i));b.addEventListener('click',()=>choosePanel(i));target.append(b);});
}
function syncTray(){
  $('photo-count').textContent=`${photos.length} LOADED`;
  $('photo-tray').replaceChildren();
  photos.forEach(photo=>{
    const button=document.createElement('button');button.type='button';button.className='photo-item';button.title=`Assign ${photo.name} to frame ${state.selected+1}`;button.setAttribute('aria-label',button.title);button.setAttribute('aria-pressed',String(state.panels[state.selected].photo===photo.id));
    const img=document.createElement('img');img.src=photo.src;img.alt='';
    const label=document.createElement('span');label.textContent=photo.name;
    button.append(img,label);button.addEventListener('click',()=>{Object.assign(state.panels[state.selected],{photo:photo.id,x:0,y:0,zoom:1});syncCrop();syncTray();schedule();status(`${photo.name} assigned to frame ${state.selected+1}. Drag to reframe.`);});$('photo-tray').append(button);
  });
}
function sync(){
  $('title').value=state.title;$('subtitle').value=state.subtitle;$('size').value=state.size;
  $('dimensions').textContent=SIZES[state.size].join(' × ')+' PX';
  document.querySelectorAll('[data-layout]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.layout===state.layout)));
  document.querySelectorAll('[data-grade]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.grade===state.grade)));
  syncPanels();syncTray();syncCrop();
}
LAYOUTS.forEach(layout=>{
  const button=document.createElement('button');button.type='button';button.className='layout-choice';button.dataset.layout=layout.id;button.title=layout.note;
  const art=document.createElement('span');art.className='layout-art';art.setAttribute('aria-hidden','true');
  layout.polygons.forEach(poly=>{const piece=document.createElement('i');piece.style.clipPath=`polygon(${poly.map(p=>p.map(n=>n*100+'%').join(' ')).join(',')})`;piece.style.transform='scale(.94)';art.append(piece);});
  const name=document.createElement('span');name.className='choice-name';name.textContent=layout.name;const check=document.createElement('b');check.textContent='✓';check.setAttribute('aria-hidden','true');name.append(check);button.append(art,name);
  button.addEventListener('click',()=>{state.layout=layout.id;state.selected=Math.min(state.selected,layout.polygons.length-1);sync();schedule();status(layout.note);});$('layouts').append(button);
});
GRADES.forEach(grade=>{
  const button=document.createElement('button');button.type='button';button.className='grade-choice';button.dataset.grade=grade.id;
  const swatch=document.createElement('span');swatch.className='grade-swatch';swatch.style.background=`linear-gradient(135deg,${grade.colors.join(',')})`;swatch.setAttribute('aria-hidden','true');
  const name=document.createElement('span');name.className='choice-name';name.textContent=grade.name;const check=document.createElement('b');check.textContent='✓';check.setAttribute('aria-hidden','true');name.append(check);button.append(swatch,name);
  button.addEventListener('click',()=>{state.grade=grade.id;sync();schedule();});$('grades').append(button);
});
function loadImage(src){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('This photo could not be decoded. Try a JPG, PNG or WebP.'));img.src=src;});}
async function samples(names=['boulevard','pier']){
  for(const name of names){
    if(photos.some(p=>p.sample===name))continue;
    const src=window.__localSamplePhotos?.[name] || `./samples/${name}.jpg`, image=await loadImage(src);
    photos.push({id:++serial,name:name==='boulevard'?'Boulevard':'Sunset pier',sample:name,src,image});
  }
  const samplePhotos=names.map(name=>photos.find(p=>p.sample===name)).filter(Boolean);
  state.panels.forEach((p,i)=>Object.assign(p,{photo:samplePhotos[i%samplePhotos.length].id,x:0,y:0,zoom:i===0?1:1.1}));
  sync();paint();status('Sample photos loaded. Make this cover yours.');
}
async function addFiles(files){
  const all=Array.from(files);if(!all.length)return;
  const loaded=[];let failed=0;
  status('Opening photos on your device…');
  for(const file of all){
    if(file.type && !file.type.startsWith('image/')){failed++;continue;}
    const src=URL.createObjectURL(file);
    try{const image=await loadImage(src);const photo={id:++serial,name:file.name,src,image};photos.push(photo);loaded.push(photo);}catch{URL.revokeObjectURL(src);failed++;}
  }
  if(loaded.length){
    const count=getLayout(state.layout).polygons.length;
    for(let i=0;i<Math.min(count,loaded.length);i++) Object.assign(state.panels[(state.selected+i)%count],{photo:loaded[i].id,x:0,y:0,zoom:1});
    state.panels.forEach(p=>{if(p.photo===null)p.photo=loaded[0].id;});
    sync();schedule();
  }
  status(`${loaded.length} photo${loaded.length===1?'':'s'} added.${failed?' '+failed+' unsupported or unreadable file(s) skipped.':' Select any frame to compose your story.'}`);
  $('upload').value='';
}
$('upload').addEventListener('change',e=>addFiles(e.target.files));
const drop=$('upload').closest('label');
['dragenter','dragover'].forEach(type=>drop.addEventListener(type,e=>{e.preventDefault();drop.classList.add('drag-over');}));
['dragleave','drop'].forEach(type=>drop.addEventListener(type,e=>{e.preventDefault();drop.classList.remove('drag-over');}));
drop.addEventListener('drop',e=>addFiles(e.dataTransfer.files));
// Stop a dropped image outside the drop zone from navigating away from the editor.
window.addEventListener('dragover',e=>e.preventDefault());window.addEventListener('drop',e=>e.preventDefault());
// A deliberate rotation of original looks, with no unseeded randomness.
const LOOKS=[
  {layout:'triptych',grade:'chrome',title:'SILVER\nESCAPES',subtitle:'FOLLOW THE GLOW. LEAVE THE CLOCK BEHIND.'},
  {layout:'duo',grade:'gold',title:'COASTAL\nALIBI',subtitle:'SALT ON THE WINDOWS. SECRETS IN THE REARVIEW.'},
  {layout:'collage',grade:'sunset',title:'LAST LIGHT\nSOCIETY',subtitle:'WE MAKE OUR OWN HOURS AT THE EDGE OF TOWN.'}
];
let nextLook=0;
$('shuffle').addEventListener('click',()=>{
  const look=LOOKS[nextLook];nextLook=(nextLook+1)%LOOKS.length;
  Object.assign(state,look,{selected:0});sync();schedule();
  status(`Look ${((nextLook+LOOKS.length-1)%LOOKS.length)+1} of ${LOOKS.length}: ${look.title.replace('\n',' ')}. Photos and crops kept.`);
});
$('demo').addEventListener('click',()=>samples().catch(error=>status(error.message)));
$('title').addEventListener('input',e=>{state.title=e.target.value;schedule();});
$('subtitle').addEventListener('input',e=>{state.subtitle=e.target.value;schedule();});
$('size').addEventListener('change',e=>{state.size=e.target.value;sync();schedule();});
function clampCrop(p){
  const photo=photos.find(photo=>photo.id===p.photo);if(!photo)return;
  const [w,h]=SIZES[state.size],b=bounds(getLayout(state.layout).polygons[state.selected]);
  const scale=Math.max(b.w*w/photo.image.naturalWidth,b.h*h/photo.image.naturalHeight)*p.zoom;
  const maxX=(photo.image.naturalWidth*scale-b.w*w)/(2*w),maxY=(photo.image.naturalHeight*scale-b.h*h)/(2*h);
  p.x=Math.max(-maxX,Math.min(maxX,p.x));p.y=Math.max(-maxY,Math.min(maxY,p.y));
}
$('zoom').addEventListener('input',e=>{const p=state.panels[state.selected];p.zoom=Number(e.target.value);clampCrop(p);syncCrop();schedule();});
$('reset-crop').addEventListener('click',()=>{Object.assign(state.panels[state.selected],{x:0,y:0,zoom:1});syncCrop();schedule();status(`Frame ${state.selected+1} crop reset.`);});
canvas.addEventListener('pointerdown',e=>{
  if(document.body.classList.contains('shot-cover'))return;
  const r=canvas.getBoundingClientRect(),i=panelAt(state.layout,(e.clientX-r.left)/r.width,(e.clientY-r.top)/r.height);
  if(i<0)return;choosePanel(i);canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);drag={id:e.pointerId,x:e.clientX,y:e.clientY};
});
canvas.addEventListener('pointermove',e=>{
  if(!drag||drag.id!==e.pointerId)return;
  const r=canvas.getBoundingClientRect(),p=state.panels[state.selected];
  p.x+=(e.clientX-drag.x)/r.width;p.y+=(e.clientY-drag.y)/r.height;clampCrop(p);drag.x=e.clientX;drag.y=e.clientY;schedule();
});
['pointerup','pointercancel','lostpointercapture'].forEach(type=>canvas.addEventListener(type,()=>{drag=null;}));
canvas.addEventListener('keydown',e=>{const dirs={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};if(!dirs[e.key])return;e.preventDefault();const p=state.panels[state.selected],step=e.shiftKey?.02:.003;p.x+=dirs[e.key][0]*step;p.y+=dirs[e.key][1]*step;clampCrop(p);schedule();});
$('export').addEventListener('click',async()=>{
  const button=$('export');button.disabled=true;status('Rendering your full-resolution cover…');
  try{
    const output=document.createElement('canvas');renderCover(output,state,photos);
    const blob=await new Promise(resolve=>output.toBlob(resolve,'image/png'));if(!blob)throw new Error('PNG export was unavailable. Please try again.');
    const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=(state.title.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'vice-poster')+'-cover.png';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);status('Your cover is ready. PNG saved at '+SIZES[state.size].join(' × ')+'.');
  }catch(error){status(error.message);}finally{button.disabled=false;}
});
window.addEventListener('pagehide',()=>photos.forEach(p=>{if(!p.sample)URL.revokeObjectURL(p.src);}));
sync();paint();
const query=new URLSearchParams(location.search);
try{
  if(['cover','editor'].includes(query.get('shot')))await runShot(query,{state,samples,sync,paint});
  else await samples();
}catch(error){status(error.message);}
