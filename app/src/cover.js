// Original polygon collage renderer. Coordinates and crop offsets use poster units.
export const SIZES = { square: [1080, 1080], portrait: [1080, 1350], landscape: [1920, 1080] };
export const LAYOUTS = [
  { id: 'collage', name: 'Collage Five', note: 'Five frames. One story.', polygons: [ [[.24,0],[.77,0],[.69,1],[.31,1]], [[0,0],[.24,0],[.2722,.46],[0,.54]], [[.77,0],[1,0],[1,.47],[.7316,.48]], [[0,.54],[.2722,.46],[.31,1],[0,1]], [[.7316,.48],[1,.47],[1,1],[.69,1]] ] },
  { id: 'triptych', name: 'Triptych', note: 'Three sides of the city.', polygons: [ [[0,0],[.38,0],[.29,1],[0,1]], [[.38,0],[.73,0],[.64,1],[.29,1]], [[.73,0],[1,0],[1,1],[.64,1]] ] },
  { id: 'duo', name: 'Duo Split', note: 'A perfect collision.', polygons: [ [[0,0],[.64,0],[.37,1],[0,1]], [[.64,0],[1,0],[1,1],[.37,1]] ] },
  { id: 'solo', name: 'Hero Solo', note: 'All eyes on you.', polygons: [ [[0,0],[1,0],[1,1],[0,1]] ] }
];
export const GRADES = [ { id:'sunset', name:'Vice Sunset', colors:['#ffb873','#e759a3'] }, { id:'neon', name:'Neon Night', colors:['#29c7c1','#c14bce'] }, { id:'gold', name:'Gold Hour', colors:['#f4d48d','#b47836'] }, { id:'chrome', name:'Midnight Chrome', colors:['#092d49','#26777c','#dfe4ed','#e8b4ce'] }, { id:'clean', name:'Clean', colors:['#bcc6d2','#586373'] } ];
export function getLayout(id) { return LAYOUTS.find(l => l.id === id) || LAYOUTS[0]; }
export function bounds(poly) {
  const xs = poly.map(p => p[0]), ys = poly.map(p => p[1]);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs)-x, h: Math.max(...ys)-y };
}
function path(ctx, poly, w, h) {
  ctx.beginPath(); poly.forEach(([x,y],i) => i ? ctx.lineTo(x*w,y*h) : ctx.moveTo(x*w,y*h)); ctx.closePath();
}
export function panelAt(layout, x, y) {
  return getLayout(layout).polygons.findIndex(poly => {
    let inside = false;
    for (let i=0,j=poly.length-1;i<poly.length;j=i++) {
      const a=poly[i], b=poly[j];
      if ((a[1]>y)!==(b[1]>y) && x < (b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]) inside=!inside;
    }
    return inside;
  });
}
function seeded(seed) {
  let n=seed>>>0;
  return () => { n^=n<<13; n^=n>>>17; n^=n<<5; return (n>>>0)/4294967296; };
}
const textures = new Map();
function grain(w,h) {
  const key=w+'x'+h;
  if(textures.has(key)) return textures.get(key);
  const c=document.createElement('canvas'); c.width=w; c.height=h;
  const ctx=c.getContext('2d'), data=ctx.createImageData(w,h), rand=seeded(19860923);
  for(let i=0;i<data.data.length;i+=4) { const v=Math.floor(rand()*256); data.data[i]=v; data.data[i+1]=v; data.data[i+2]=v; data.data[i+3]=Math.floor(rand()*15); }
  ctx.putImageData(data,0,0); textures.set(key,c); return c;
}
function grade(ctx,id,w,h) {
  if(id==='clean') return;
  const g=ctx.createLinearGradient(0,0,w*.35,h);
  if(id==='neon') { g.addColorStop(0,'#35e2c9'); g.addColorStop(.5,'#6859a7'); g.addColorStop(1,'#ed65be'); }
  else if(id==='chrome') { g.addColorStop(0,'#dfe4ed'); g.addColorStop(.28,'#e8b4ce'); g.addColorStop(.58,'#26777c'); g.addColorStop(1,'#092d49'); }
  else if(id==='gold') { g.addColorStop(0,'#ffe2a3'); g.addColorStop(1,'#be6a37'); }
  else { g.addColorStop(0,'#ffc37d'); g.addColorStop(.45,'#f28a72'); g.addColorStop(1,'#d644a7'); }
  ctx.save(); ctx.globalCompositeOperation='soft-light'; ctx.globalAlpha=.68; ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
  ctx.globalCompositeOperation='color'; ctx.globalAlpha=id==='neon'?.19:.12; ctx.fillRect(0,0,w,h); ctx.restore();
  if(id==='sunset') {
    // A broad, feathered streak of warm light across the upper city.
    const leak=ctx.createLinearGradient(0,h*.21,0,h*.39);
    leak.addColorStop(0,'#ffb57600'); leak.addColorStop(.42,'#ffd9ac12');
    leak.addColorStop(.5,'#ffe9c938'); leak.addColorStop(.58,'#ffc19112'); leak.addColorStop(1,'#ffb57600');
    ctx.save(); ctx.globalCompositeOperation='screen'; ctx.fillStyle=leak; ctx.fillRect(0,h*.21,w,h*.18); ctx.restore();
  }
}
function fitted(ctx,text,x,y,width,size,fill) {
  ctx.save(); ctx.font=`900 ${size}px Impact, 'Arial Narrow', 'Arial Black', sans-serif`;
  const measured=ctx.measureText(text).width, squeeze=Math.min(1,width/Math.max(measured,1));
  ctx.translate(x,y); ctx.scale(squeeze,1); ctx.textAlign='center'; ctx.textBaseline='alphabetic';
  ctx.lineJoin='round';
  // An outlined offset echo gives the lettering a stacked screen-print depth.
  const dx=size*.025, dy=size*.055;
  ctx.strokeStyle='#b57792'; ctx.lineWidth=size*.075; ctx.strokeText(text,dx,dy);
  ctx.fillStyle='#192435'; ctx.fillText(text,dx,dy);
  ctx.strokeStyle='#111a23'; ctx.lineWidth=size*.065; ctx.strokeText(text,0,0);
  // A slightly raised hairline catches the light above the gradient face.
  ctx.strokeStyle='#fff5df99'; ctx.lineWidth=size*.012; ctx.strokeText(text,0,-size*.006);
  ctx.fillStyle=fill; ctx.fillText(text,0,0); ctx.restore();
}
export function renderCover(canvas,state,photos,{selection=false}={}) {
  const [w,h]=SIZES[state.size] || SIZES.portrait;
  if(canvas.width!==w) canvas.width=w; if(canvas.height!==h) canvas.height=h;
  const ctx=canvas.getContext('2d'); ctx.clearRect(0,0,w,h); ctx.fillStyle='#10151e'; ctx.fillRect(0,0,w,h);
  const unit=Math.min(w,h), polygons=getLayout(state.layout).polygons;
  polygons.forEach((poly,i)=>{
    const b=bounds(poly), p=state.panels[i] || {zoom:1,x:0,y:0}, photo=photos.find(photo=>photo.id===p.photo);
    ctx.save(); path(ctx,poly,w,h); ctx.clip();
    if(photo) {
      const image=photo.image, scale=Math.max(b.w*w/image.naturalWidth,b.h*h/image.naturalHeight)*(p.zoom||1);
      const iw=image.naturalWidth*scale, ih=image.naturalHeight*scale;
      const ox=Math.max(-(iw-b.w*w)/2, Math.min((iw-b.w*w)/2,(p.x||0)*w));
      const oy=Math.max(-(ih-b.h*h)/2, Math.min((ih-b.h*h)/2,(p.y||0)*h));
      ctx.drawImage(image,(b.x+b.w/2)*w-iw/2+ox,(b.y+b.h/2)*h-ih/2+oy,iw,ih);
    } else {
      const wash=ctx.createLinearGradient(0,0,w,h); wash.addColorStop(0,'#305c67'); wash.addColorStop(.55,'#ba7883'); wash.addColorStop(1,'#263543'); ctx.fillStyle=wash; ctx.fillRect(b.x*w,b.y*h,b.w*w,b.h*h);
      ctx.fillStyle='#ffffff66'; ctx.textAlign='center'; ctx.font=`${unit*.025}px sans-serif`; ctx.fillText('ADD YOUR PHOTO',(b.x+b.w/2)*w,(b.y+b.h/2)*h);
    }
    ctx.restore();
  });
  grade(ctx,state.grade,w,h);
  // Dark seams under a fine warm edge retain separation at every export size.
  polygons.forEach(poly=>{ path(ctx,poly,w,h); ctx.strokeStyle='#111822'; ctx.lineWidth=unit*.012; ctx.stroke(); path(ctx,poly,w,h); ctx.strokeStyle='#efdfceaa'; ctx.lineWidth=unit*.0018; ctx.stroke(); });
  const vig=ctx.createRadialGradient(w*.5,h*.4,unit*.15,w*.5,h*.45,Math.max(w,h)*.73); vig.addColorStop(0,'#020a1200'); vig.addColorStop(1,'#020913b8'); ctx.fillStyle=vig; ctx.fillRect(0,0,w,h);
  const shade=ctx.createLinearGradient(0,h*.48,0,h); shade.addColorStop(0,'#0c122000'); shade.addColorStop(1,'#0c1220e8'); ctx.fillStyle=shade; ctx.fillRect(0,0,w,h);
  ctx.drawImage(grain(w,h),0,0);
  const margin=unit*.05;
  ctx.strokeStyle='#f7e9da99'; ctx.lineWidth=unit*.001; ctx.strokeRect(margin,margin,w-2*margin,h-2*margin);
  ctx.fillStyle='#fff1df'; ctx.textAlign='left'; ctx.font=`600 ${unit*.014}px 'Arial', sans-serif`; ctx.fillText('V / P     ORIGINAL CITY STORIES',margin*1.4,margin*1.65);
  ctx.textAlign='right'; ctx.fillText('VOL. 01  /  YOUR WORLD',w-margin*1.4,margin*1.65);
  const title=(state.title.trim() || 'VICE\nAFTER DARK').toUpperCase();
  let lines=title.split('\n').filter(Boolean).slice(0,2);
  if(lines.length===1 && lines[0].includes(' ')) { const words=lines[0].split(/\s+/); const mid=Math.ceil(words.length/2); lines=[words.slice(0,mid).join(' '),words.slice(mid).join(' ')]; }
  const landscape=w>h, fs=unit*(landscape?.157:.178), baseline=h-unit*.17;
  const ink=ctx.createLinearGradient(0,baseline-fs*1.6,0,baseline); ink.addColorStop(0,state.grade==='chrome'?'#f2f5fa':'#fff1c5'); ink.addColorStop(.47,state.grade==='chrome'?'#bacbd7':'#ffbd99'); ink.addColorStop(1,state.grade==='chrome'?'#e8b4ce':'#e882b7');
  lines.forEach((line,i)=>fitted(ctx,line,w*.5,baseline-(lines.length-1-i)*fs*.91,w*(landscape?.65:.85),fs,ink));
  ctx.fillStyle='#fff0dc'; ctx.textAlign='center'; ctx.font=`600 ${unit*.018}px Arial, sans-serif`;
  ctx.fillText((state.subtitle || '').toUpperCase(),w*.5,h-unit*.109,w*.84);
  ctx.fillStyle='#e6d5c6aa'; ctx.font=`${unit*.0105}px Arial, sans-serif`; ctx.fillText('AN ORIGINAL COVER BY YOU  /  VICE POSTER STUDIO',w*.5,h-unit*.067);
  if(selection && state.selected>=0) { path(ctx,polygons[state.selected],w,h); ctx.strokeStyle='#daff9d'; ctx.lineWidth=unit*.004; ctx.stroke(); }
}
