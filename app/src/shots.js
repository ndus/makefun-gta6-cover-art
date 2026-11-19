import { SIZES, getLayout, GRADES } from './cover.js';

// The scene hook uses the same state and renderer as the interactive editor.
export async function runShot(query, studio) {
  const shot=query.get('shot');
  const layout=query.get('layout');
  const aliases={ 'collage-five':'collage', 'duo-split':'duo', 'hero-solo':'solo' };
  if(layout) studio.state.layout=getLayout(aliases[layout] || layout).id;
  const grade=query.get('grade');
  const gradeAliases={ 'vice-sunset':'sunset', 'neon-night':'neon', 'gold-hour':'gold' };
  const gradeId=gradeAliases[grade] || grade;
  if(GRADES.some(g=>g.id===gradeId)) studio.state.grade=gradeId;
  const size=query.get('size');
  const format=Object.keys(SIZES).find(key=>key===size || SIZES[key].join('x')===size);
  if(format) studio.state.size=format;
  if(query.has('title')) studio.state.title=query.get('title').slice(0,60).replace(/\|/g,'\n');
  if(query.has('subtitle')) studio.state.subtitle=query.get('subtitle').slice(0,80);
  if(shot==='cover') document.body.classList.add('shot-cover');
  const names=(query.get('photos') || 'boulevard,pier').split(',').filter(name=>['boulevard','pier'].includes(name));
  await studio.samples(names.length?names:['boulevard','pier']);
  studio.sync(); studio.paint();
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  window.__shotReady=true;
}
