// Offline capture runner: local files and null-delimited CDP over Chromium pipes.
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const root=fileURLToPath(new URL('../',import.meta.url));
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const children=[];
function start(label,command,args){
  const child=spawn(command,args,{cwd:root,stdio:['ignore','pipe','pipe','pipe','pipe']});
  const item={label,child,log:'',error:null};children.push(item);
  child.on('error',error=>{item.error=error;});
  for(const stream of [child.stdout,child.stderr])stream.on('data',bytes=>{item.log=(item.log+bytes).slice(-8000);});
  return item;
}
function checkProcess(item){
  if(item.error)throw new Error(`${item.label} could not start: ${item.error.message}`);
  if(item.child.exitCode!==null||item.child.signalCode!==null)throw new Error(`${item.label} exited (${item.child.exitCode??item.child.signalCode}):\n${item.log}`);
}
function connect(item){
  const pending=new Map();let serial=0,buffer=Buffer.alloc(0),closed=false;
  function fail(error){
    closed=true;
    for(const p of pending.values()){clearTimeout(p.timer);p.reject(error);}
    pending.clear();
  }
  item.child.stdio[4].on('data',chunk=>{
    buffer=Buffer.concat([buffer,chunk]);
    let end;
    while((end=buffer.indexOf(0))!==-1){
      const frame=buffer.subarray(0,end);buffer=buffer.subarray(end+1);
      if(!frame.length)continue;
      let message;
      try{message=JSON.parse(frame.toString());}catch(error){fail(error);return;}
      const waiter=pending.get(message.id);
      if(!waiter)continue;
      pending.delete(message.id);clearTimeout(waiter.timer);
      if(message.error)waiter.reject(new Error(JSON.stringify(message.error)));else waiter.resolve(message.result);
    }
  });
  item.child.stdio[3].on('error',fail);
  item.child.stdio[4].on('error',fail);
  item.child.stdio[4].on('end',()=>fail(new Error(`DevTools pipe closed:\n${item.log}`)));
  item.child.on('error',fail);
  item.child.on('exit',(code,signal)=>fail(new Error(`Chromium exited (${code??signal}):\n${item.log}`)));
  return {
    send(method,params={},sessionId){return new Promise((resolve,reject)=>{
      if(closed){reject(new Error(`DevTools pipe is closed:\n${item.log}`));return;}
      const id=++serial,timer=setTimeout(()=>{pending.delete(id);reject(new Error(`DevTools timed out: ${method}\n${item.log}`));},30000);
      pending.set(id,{resolve,reject,timer});
      item.child.stdio[3].write(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})})+'\0',error=>{if(error)fail(error);});
    });}
  };
}
async function evaluate(cdp,expression){
  const result=await cdp.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
  if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);
  return result.result.value;
}
function jpegSize(bytes){
  assert.equal(bytes.readUInt16BE(0),0xffd8,'JPEG SOI signature');
  assert.equal(bytes.readUInt16BE(bytes.length-2),0xffd9,'JPEG EOI signature');
  let offset=2;
  while(offset<bytes.length){
    assert.equal(bytes[offset++],0xff,'JPEG marker');
    while(bytes[offset]===0xff)offset++;
    const marker=bytes[offset++],length=bytes.readUInt16BE(offset);
    if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker))return {w:bytes.readUInt16BE(offset+5),h:bytes.readUInt16BE(offset+3)};
    if(marker===0xda)break;
    assert(length>=2);offset+=length;
  }
  throw new Error('JPEG has no dimensions');
}
async function stop(item){
  const child=item.child;if(!child.pid||child.exitCode!==null||child.signalCode!==null)return;
  const exited=once(child,'exit').catch(()=>{});child.kill('SIGTERM');
  const timer=setTimeout(()=>child.kill('SIGKILL'),3000);
  await exited;clearTimeout(timer);
}
let work;
try{
  const scenes=JSON.parse(await readFile(join(root,'shots.json'),'utf8'));
  assert.deepEqual(scenes.map(s=>s.name),['1-cover.jpg','2-editor.jpg','3-cover.jpg','4-cover.jpg']);
  await mkdir(join(root,'.makefun'),{recursive:true});
  work=await mkdtemp(join(root,'.makefun','capture-'));
  const chrome=start('Chromium','/home/hatch/.cache/puppeteer/chrome-headless-shell/linux-157.0.8103.50/chrome-headless-shell-linux64/chrome-headless-shell',[
    '--headless=new','--no-sandbox','--disable-setuid-sandbox','--disable-gpu','--disable-dev-shm-usage','--remote-debugging-pipe','--disable-crashpad','--disable-crash-reporter','--no-crashpad',
    '--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--disable-sync',
    '--host-resolver-rules=MAP * ~NOTFOUND',
    `--user-data-dir=${join(work,'profile')}`,'about:blank'
  ]);
  const browser=connect(chrome);
  await browser.send('Browser.getVersion');
  const report=[];
  for(const scene of scenes){
    assert(Math.max(scene.w,scene.h)<=1280&&Math.min(scene.w,scene.h)>=480);
    const {targetId}=await browser.send('Target.createTarget',{url:'about:blank'});
    const {sessionId}=await browser.send('Target.attachToTarget',{targetId,flatten:true});
    const cdp={send:(method,params)=>browser.send(method,params,sessionId)};
    try{
      await cdp.send('Page.enable');await cdp.send('Runtime.enable');
      await cdp.send('Emulation.setDeviceMetricsOverride',{width:scene.w,height:scene.h,deviceScaleFactor:1,mobile:false});
      await cdp.send('Page.navigate',{url:`${pathToFileURL(join(root,'app','index.html')).href}${scene.query}`});
      const deadline=Date.now()+30000;let loaded=false;
      while(Date.now()<deadline){
        checkProcess(chrome);
        if(await evaluate(cdp,'window.__shotReady === true')){loaded=true;break;}
        await sleep(100);
      }
      if(!loaded)throw new Error(`${scene.name}: __shotReady timed out after 30 seconds. Status: ${await evaluate(cdp,'document.getElementById("status")?.textContent')}`);
      let bytes,quality=82;
      for(;;){
        const shot=await cdp.send('Page.captureScreenshot',{format:'jpeg',quality,captureBeyondViewport:false});
        bytes=Buffer.from(shot.data,'base64');
        if(bytes.length<=262144)break;
        if(quality===60)throw new Error(`${scene.name}: ${bytes.length} bytes still exceeds cap at quality 60`);
        quality=Math.max(60,quality-4);
      }
      assert.deepEqual(jpegSize(bytes),{w:scene.w,h:scene.h});
      await writeFile(join(work,scene.name),bytes);
      report.push({name:scene.name,bytes:bytes.length,...jpegSize(bytes),quality});
      if(scene.query.includes('shot=editor')){
        const checks=await evaluate(cdp,`(async()=>{
          const $=id=>document.getElementById(id),frame=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
          const rect=$('cover').getBoundingClientRect(),stage=$('canvas-stage').getBoundingClientRect();
          if(rect.top<stage.top-1||rect.bottom>stage.bottom+1||rect.left<stage.left-1||rect.right>stage.right+1||document.documentElement.scrollHeight>innerHeight)throw Error('Editor preview does not fit viewport');
          const looks=[];for(let i=0;i<4;i++){$('shuffle').click();await frame();looks.push({title:$('title').value,grade:document.querySelector('[data-grade][aria-pressed=true]').dataset.grade,layout:document.querySelector('[data-layout][aria-pressed=true]').dataset.layout});}
          if(new Set(looks.slice(0,3).map(x=>x.title)).size!==3||JSON.stringify(looks[0])!==JSON.stringify(looks[3]))throw Error('Curated rotation failed');
          const before=$('cover').toDataURL();$('title').dispatchEvent(new Event('input'));await frame();if(before!==$('cover').toDataURL())throw Error('Non-deterministic rendering');
          let filename;HTMLAnchorElement.prototype.click=function(){filename=this.download;};
          $('title').value='Vice\\nAfter Dark';$('title').dispatchEvent(new Event('input'));$('export').click();
          for(let i=0;i<150&&!filename;i++)await new Promise(r=>setTimeout(r,20));
          if(filename!=='vice-after-dark-cover.png')throw Error('Unexpected export filename: '+filename);
          return {preview:{w:rect.width,h:rect.height},looks,filename,deterministic:true};
        })()`);
        console.log('Editor checks:',JSON.stringify(checks));
      }
    }finally{await browser.send('Target.closeTarget',{targetId}).catch(()=>{});}
  }
  // Replace the starter images only after all four real browser captures succeed.
  const destination=join(root,'screenshots');await mkdir(destination,{recursive:true});
  for(const scene of scenes)await rename(join(work,scene.name),join(destination,scene.name));
  for(const name of await readdir(destination))if(!scenes.some(s=>s.name===name))await rm(join(destination,name),{recursive:true,force:true});
  assert.deepEqual((await readdir(destination)).sort(),scenes.map(s=>s.name).sort());
  // Read final files, checking the bytes that will actually be packaged.
  for(const scene of scenes){const b=await readFile(join(destination,scene.name));assert(b.length<=262144);assert.deepEqual(jpegSize(b),{w:scene.w,h:scene.h});}
  console.log(JSON.stringify(report,null,2));
}catch(error){console.error(error.stack||String(error));process.exitCode=1;}
finally{
  await Promise.all(children.reverse().map(stop));
  if(work)await rm(work,{recursive:true,force:true});
}
