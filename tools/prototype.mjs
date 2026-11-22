import {createServer} from 'node:http';
import {createReadStream, constants} from 'node:fs';
import {access, cp, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile} from 'node:fs/promises';
import {dirname, extname, isAbsolute, join, relative, resolve, sep} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {renderGraphics} from './graphics/index.mjs';
import {validateSpec} from './specs.mjs';

export async function readJson(file){return JSON.parse((await readFile(file,'utf8')).replace(/^\uFEFF/,''));}
export async function save(file,body){
  await mkdir(dirname(file),{recursive:true});
  await writeFile(file,body);
}
export const writeJson=(file,value)=>save(file,JSON.stringify(value,null,2)+'\n');
const inside=(root,p)=>{
  const rel=relative(root,p);
  return !isAbsolute(rel)&&rel!=='..'&&!rel.startsWith('..'+sep);
};
export async function filesIn(root,sub=''){
  const listed=await readdir(join(root,sub),{withFileTypes:true});
  const out=[];
  for(const item of listed.sort((a,b)=>a.name<b.name?-1:1)){
    if(item.isSymbolicLink())throw new Error('Prototype cannot bundle a symbolic link '+item.name);
    const at=sub?sub+'/'+item.name:item.name;
    if(item.isDirectory())out.push(...await filesIn(root,at));
    else if(item.isFile())out.push(at);
    else throw new Error('Unsupported prototype file '+at);
  }
  return out;
}
export async function loadPrototype(input){
  const spec=validateSpec(await readJson(input),'PrototypeSpec');
  const root=dirname(await realpath(input));
  async function local(file){
    const full=await realpath(resolve(root,file));
    if(!inside(root,full))throw new Error('Spec path leaves prototype directory '+file);
    return full;
  }
  const source=await local(spec.sourceDir);
  const sources=await filesIn(source);
  for(const entry of [spec.entry,...spec.pages.map(page=>page.entry)]){
    if(!sources.includes(entry))throw new Error('Missing entry '+entry);
  }
  for(const [path,kind] of [[spec.interaction,'InteractionSpec'],[spec.composition,'CompositionSpec']]){
    if(path)validateSpec(await readJson(await local(path)),kind);
  }
  for(const asset of spec.graphicAssets){
    if(sources.some(file=>file.toLowerCase()===asset.output.toLowerCase())||!asset.output.endsWith('.svg'))throw new Error('Asset must have its own SVG output '+asset.output);
    await local(asset.input);
  }
  return {spec,root,source,local};
}
export async function buildPrototype(project,out,catalog){
  const {source,spec,local}=project;
  if(inside(source,resolve(out)))throw new Error('Output folder must be outside the prototype source tree');
  const rendered=await Promise.all(spec.graphicAssets.map(async asset=>[asset.output,renderGraphics(await readJson(await local(asset.input)),catalog)]));
  await mkdir(dirname(resolve(out)),{recursive:true});
  await mkdir(out);
  try{
    await cp(source,out,{recursive:true});
    for(const [output,svg] of rendered)await save(join(out,output),svg);
  }catch(error){
    // The destination was created by this invocation.
    await rm(out,{recursive:true,force:true});
    throw error;
  }
  return out;
}
export async function exportPrototype(project,out,catalog){
  await buildPrototype(project,out,catalog);
  const design=join(out,'design-data');
  await mkdir(design);
  const p=structuredClone(project.spec);
  p.sourceDir='app';
  await mkdir(join(design,'app'));
  // Include an editable, asset-free copy of the prototype sources.
  await cp(project.source,join(design,'app'),{recursive:true});
  const specs=new Set([p.interaction,p.composition,...p.graphicAssets.map(a=>a.input)].filter(Boolean));
  for(const file of specs)await save(join(design,file),await readFile(await project.local(file)));
  await writeJson(join(design,'prototype.json'),p);
  const files=await filesIn(out);
  const hashes=await Promise.all(files.map(async file=>[file,createHash('sha256').update(await readFile(join(out,file))).digest('hex')]));
  await writeJson(join(out,'export-manifest.json'),{version:1,entry:p.entry,editableSpec:'design-data/prototype.json',sha256:Object.fromEntries(hashes)});
}
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.json':'application/json','.wav':'audio/wav','.ogg':'audio/ogg','.png':'image/png','.woff2':'font/woff2'};
export async function serve(root,port=0){
  root=await realpath(root);
  const server=createServer(async (req,res)=>{
    try{
      const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/, '')||'index.html';
      const file=await realpath(resolve(root,path));
      if(!inside(root,file)||!(await lstat(file)).isFile())throw new Error('Not found');
      res.writeHead(200,{'Content-Type':mime[extname(file)]??'application/octet-stream','Cache-Control':'no-store'});
      createReadStream(file).on('error',()=>res.destroy()).pipe(res);
    }catch{
      res.writeHead(404).end('Not found');
    }
  });
  await new Promise((yes,no)=>{
    server.once('error',no);
    server.listen(port,'127.0.0.1',yes);
  });
  return {url:'http://127.0.0.1:'+server.address().port+'/',close:()=>new Promise(yes=>server.close(yes))};
}
export async function tempBuild(project,catalog,fn){
  const temp=await mkdtemp(join(tmpdir(),'design-prototype-'));
  try{
    const out=await buildPrototype(project,join(temp,'app'),catalog);
    const server=await serve(out);
    try{return await fn(server.url);}
    finally{await server.close();}
  }finally{await rm(temp,{recursive:true,force:true});}
}
export async function launchBrowser(executable,args=[]){
  let chromium;
  try{({chromium}=await import('playwright'));}
  catch(error){
    if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;
    throw new Error('Playwright unavailable. Run npm ci, use a browser manually, or run validation and SVG generation only.');
  }
  const roots=[process.env['ProgramFiles(x86)'],process.env.ProgramFiles,process.env.LOCALAPPDATA].filter(Boolean);
  const candidates=[executable??process.env.DESIGN_BROWSER,chromium.executablePath(),
    ...roots.flatMap(root=>[join(root,'Microsoft/Edge/Application/msedge.exe'),join(root,'Google/Chrome/Application/chrome.exe')]),
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/usr/bin/chromium','/usr/bin/google-chrome'].filter(Boolean);
  if(executable||process.env.DESIGN_BROWSER){
    return chromium.launch({executablePath:candidates[0],headless:true,args});
  }
  for(const path of candidates){
    try{await access(path,constants.F_OK);}catch{continue;}
    return chromium.launch({executablePath:path,headless:true,args});
  }
  throw new Error('No Chromium browser found. Run npx playwright install chromium or set DESIGN_BROWSER.');
}
export async function preview(svg,size,file,executable){
  const browser=await launchBrowser(executable);
  try{
    const page=await browser.newPage({viewport:size});
    await page.setContent('<style>body{margin:0}svg{display:block}</style>'+svg);
    await mkdir(dirname(file),{recursive:true});
    await page.screenshot({path:file,omitBackground:true,animations:'disabled'});
  }finally{await browser.close();}
}
export async function rasterize(file,limit,executable){
  const bytes=await readFile(file);
  if(bytes.length>24*1024*1024)throw new Error('Image must be at most 24 MiB');
  const type={'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif'}[extname(file).toLowerCase()];
  if(!type)throw new Error('Raster input must be a local PNG, JPEG, WebP or GIF file');
  const browser=await launchBrowser(executable);
  try{
    const page=await browser.newPage();
    return await page.evaluate(async ({url,limit})=>{
      const image=new Image();
      image.src=url;
      await image.decode();
      const factor=Math.min(1,limit/Math.max(image.naturalWidth,image.naturalHeight));
      const width=Math.max(1,Math.round(image.naturalWidth*factor)),height=Math.max(1,Math.round(image.naturalHeight*factor));
      const canvas=document.createElement('canvas');
      canvas.width=width;canvas.height=height;
      const context=canvas.getContext('2d');
      context.drawImage(image,0,0,width,height);
      const {data}=context.getImageData(0,0,width,height);
      return Array.from({length:height},(_,y)=>Array.from({length:width},(_,x)=>{
        const at=(y*width+x)*4;
        return [data[at],data[at+1],data[at+2],data[at+3]];
      }));
    },{url:'data:'+type+';base64,'+bytes.toString('base64'),limit});
  }finally{await browser.close();}
}
async function step(page,s,out,prefix){
  const target=s.selector?page.locator(s.selector):null;
  switch(s.action){
    case 'click':await target.click();return;
    case 'visible':await target.waitFor({state:'visible'});return;
    case 'press':await target.press(s.value);return;
    case 'fill':await target.fill(s.value);return;
    case 'input':await target.evaluate((element,v)=>{
      element.value=v;
      element.dispatchEvent(new Event('input',{bubbles:true}));
      element.dispatchEvent(new Event('change',{bubbles:true}));
    },s.value);return;
    case 'text':await page.waitForFunction(({selector,value})=>[...document.querySelectorAll(selector)].some(e=>e.textContent.includes(value)),s);return;
    case 'property':await page.waitForFunction(({selector,name,operator,value})=>{
      const data=document.querySelector(selector)?.[name];
      return operator==='equals'?data===value:operator==='gt'?data>value:data>=value;
    },s);return;
    case 'no-overflow':{
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth);
      if(overflow)throw new Error('Document has horizontal overflow');
      return;
    }
    case 'capture':{
      const file=prefix+'-'+s.name+'.png';
      await page.screenshot({path:join(out,file),fullPage:true,animations:'disabled'});
      return file;
    }
  }
}
export async function runBrowser(project,out,catalog,{mode='test',executable}={}){
  await mkdir(out,{recursive:true});
  const {spec}=project,entries=[],artifacts=[];
  const report={kind:'EvaluationReport',version:1,target:spec.title,runAt:new Date().toISOString(),environment:process.platform+' / Node '+process.version,entries,artifacts};
  let browser;
  try{browser=await launchBrowser(executable);}
  catch(error){
    entries.push({id:'browser',kind:'automated',status:'skipped',claim:'Chromium runtime unavailable',evidence:[error.message.slice(0,1000)]});
    await writeJson(join(out,'evaluation.json'),validateSpec(report));
    return false;
  }
  report.environment+=' / Chromium '+browser.version();
  try{
    await tempBuild(project,catalog,async url=>{
      for(const viewport of spec.viewports){
        const name=viewport.name, options={viewport:{width:viewport.width,height:viewport.height},reducedMotion:viewport.reducedMotion?'reduce':'no-preference'};
        const cases=[{id:'baseline',steps:[{action:'no-overflow'},{action:'capture',name:'initial'}]}];
        if(mode==='test')cases.push(...spec.tests.filter(test=>!test.viewports||test.viewports.includes(name)));
        for(const [index,test] of cases.entries()){
          const errors=[],evidence=[],context=await browser.newContext(options);
          const page=await context.newPage(),id=name+'-'+index;
          page.setDefaultTimeout(5000);
          page.on('pageerror',err=>errors.push(err.message));
          page.on('response',response=>{if(response.status()>=400)errors.push(response.status()+' '+new URL(response.url()).pathname);});
          let status='passed';
          try {
            const response=await page.goto(new URL(spec.entry,url).href,{waitUntil:'load',timeout:10000});
            if(!response?.ok())throw new Error('Prototype entry did not return success');
            await page.evaluate(()=>document.fonts.ready.then(()=>undefined));
            for(const s of test.steps){
              const file=await step(page,s,out,id);
              if(file){artifacts.push(file);evidence.push(file);}
              else evidence.push([s.action,s.selector,s.name,s.operator,s.value].filter(x=>x!==undefined).join(' ').slice(0,1000));
            }
            if(errors.length)throw new Error(errors.join(' / '));
          }catch(error){
            status='failed';
            evidence.push(String(error.message).slice(0,1000));
            const file=id+'-failure.png';
            try{
              await page.screenshot({path:join(out,file),fullPage:true,timeout:3000});
              artifacts.push(file);
              evidence.push(file);
            }catch{}
          }finally{await context.close();}
          entries.push({id,kind:'automated',status,claim:test.id+' at '+viewport.width+'×'+viewport.height,evidence,viewport:name});
        }
      }
    });
  }finally{await browser.close();}
  await writeJson(join(out,'evaluation.json'),validateSpec(report));
  return entries.every(entry=>entry.status==='passed');
}
