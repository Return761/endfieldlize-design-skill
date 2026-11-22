import Ajv from 'ajv';
import {readFile,mkdir,realpath,writeFile} from 'node:fs/promises';
import {dirname,extname,isAbsolute,relative,resolve,sep} from 'node:path';
import {launchBrowser,readJson} from './prototype.mjs';
import {defaultCache,exposeRahooSettings,loadRahoo,origin,rahooGenerators,rahooSettingGroups,release} from './rahoo-release.mjs';

const shape=(properties,required=[])=>({type:'object',properties,required,additionalProperties:false});
const text={type:'string',minLength:1,maxLength:500};
const bounded=(minimum,maximum)=>({type:'integer',minimum,maximum});
const coordinates=shape({x:{type:'number'},y:{type:'number'}},['x','y']);
const action=(name,params,required=Object.keys(params))=>shape({do:{const:name},...params},['do',...required]);
const target={selector:text,index:bounded(0,1000)};
const specSchema=shape({
  kind:{const:'RahooSpec'},version:{const:1},generator:{enum:rahooGenerators},
  width:{...bounded(400,2560),default:1200},height:{...bounded(320,2160),default:860},
  seed:{...bounded(0,2147483647),default:17},frameMs:bounded(0,3600000),
  settings:{type:'object',default:{}},proSettings:{type:'object'},
  actions:{type:'array',maxItems:200,default:[],items:{oneOf:[
    action('click',{...target,text,at:coordinates},[]),
    action('fill',{...target,value:{type:'string',maxLength:10000}},['selector','value']),
    action('press',{...target,key:text},['selector','key']),
    action('upload',{...target,file:text},['selector','file']),
    action('drag',{...target,from:coordinates,to:coordinates,steps:bounded(1,200)},['selector','from','to']),
    action('waitFor',{...target},['selector'])
  ]}},
  download:shape({...target,text,timeout:bounded(1000,180000)},[])
},['kind','version','generator']);
const ajv=new Ajv({useDefaults:true,allErrors:true});
const check=ajv.compile(specSchema);
export function normalizeRahooSpec(input){
  const spec=structuredClone(input);
  if(!check(spec))throw new Error('RahooSpec '+ajv.errorsText(check.errors));
  if(spec.frameMs!==undefined&&spec.generator!=='dynamicLight')throw new Error('frameMs applies to dynamicLight');
  if(spec.proSettings&&spec.generator!=='contour')throw new Error('proSettings apply to contour');
  if(spec.proSettings&&spec.settings.mode!=='pro')throw new Error('proSettings requires settings.mode pro');
  for(const [generator,settings] of [[spec.generator,spec.settings],['contourPro',spec.proSettings]]){
    const groups=rahooSettingGroups(generator);
    for(const key of Object.keys(settings??{}))if(!groups.includes(key))throw new Error('Unknown native setting group '+generator+'.'+key);
  }
  if(spec.generator==='barcode'&&spec.settings.mode!==undefined&&!['barcode','spectrum','ruler'].includes(spec.settings.mode)){
    throw new Error('Unknown native barcode mode');
  }
  if(spec.generator==='contour'&&spec.settings.mode!==undefined&&!['classic','pro'].includes(spec.settings.mode)){
    throw new Error('Unknown native contour mode');
  }
  for(const step of [...spec.actions,...(spec.download?[spec.download]:[])]){
    if(['click',undefined].includes(step.do)&&Number(!!step.text)+Number(!!step.selector)!==1){
      throw new Error('Rahoo click or download requires either selector or text');
    }
  }
  return spec;
}
export const basicRahooSpec=generator=>({kind:'RahooSpec',version:1,generator});

export async function openRahooBrowser({cache=defaultCache,executable}={}){
  const assets=await loadRahoo(cache);
  const raw=assets.get('/assets/'+release);
  const instrumented=exposeRahooSettings(raw.bytes);
  const browser=await launchBrowser(executable,['--enable-unsafe-swiftshader']);
  return {assets,instrumented,browser,close:()=>browser.close()};
}
async function setSettings(page,generator,settings){
  if(!Object.keys(settings).length)return;
  await page.waitForFunction(name=>!!globalThis.__rahooSettings?.[name],generator,{timeout:10000});
  await page.evaluate(({generator,settings})=>{
    const bindings=globalThis.__rahooSettings[generator];
    const dangerous=new Set(['__proto__','constructor','prototype']);
    function assign(current,newValue,path){
      if(current instanceof Map){
        if(!Array.isArray(newValue)||!newValue.every(pair=>Array.isArray(pair)&&pair.length===2)){
          throw new Error(path+' expects an array of key/value pairs');
        }
        return new Map(newValue);
      }
      if(current instanceof Set){
        if(!Array.isArray(newValue))throw new Error(path+' expects an array');
        return new Set(newValue);
      }
      if(Array.isArray(current)){
        if(!Array.isArray(newValue))throw new Error(path+' expects an array');
        return newValue;
      }
      if(current!==null&&typeof current==='object'){
        if(!newValue||typeof newValue!=='object'||Array.isArray(newValue))throw new Error(path+' expects an object');
        for(const [key,value] of Object.entries(newValue)){
          if(dangerous.has(key))throw new Error('Invalid setting key '+path+'.'+key);
          if(!Object.hasOwn(current,key)&&path!=='levelStyles')throw new Error('Unknown native setting '+path+'.'+key);
          current[key]=assign(current[key],value,path+'.'+key);
        }
        return current;
      }
      if(current!=null&&typeof current!==typeof newValue)throw new Error(path+' expects '+typeof current);
      return newValue;
    }
    if(Object.hasOwn(settings,'preset')&&bindings.applyPreset){
      if(!['initial','preset1','preset2'].includes(settings.preset))throw new Error('Unknown square grid preset');
      bindings.refs.preset.set(settings.preset);
      bindings.applyPreset(settings.preset);
    }
    for(const [key,value] of Object.entries(settings)){
      if(Object.hasOwn(bindings.objects,key))assign(bindings.objects[key](),value,key);
      else if(Object.hasOwn(bindings.refs,key)){
        const ref=bindings.refs[key];
        ref.set(assign(ref.get(),value,key));
      }else throw new Error('Unknown native setting group '+generator+'.'+key);
    }
    if(bindings.applyTime&&generator==='nestedPolygons'&&Object.hasOwn(settings,'time')){
      bindings.applyTime(settings.time);
    }
  },{generator,settings});
}
function locate(page,step){
  const matches=step.selector?page.locator(step.selector):page.getByText(step.text,{exact:true});
  return matches.nth(step.index??0);
}
async function localFile(root,path){
  if(isAbsolute(path))throw new Error('Rahoo upload must be relative to the spec directory');
  const base=await realpath(root);
  const full=await realpath(resolve(base,path)),part=relative(base,full);
  if(isAbsolute(part)||part==='..'||part.startsWith('..'+sep))throw new Error('Rahoo upload must stay within the spec directory');
  return full;
}
async function perform(page,step,root){
  const target=locate(page,step);
  switch(step.do){
    case 'click':return target.click({position:step.at});
    case 'fill':return target.fill(step.value);
    case 'press':return target.press(step.key);
    case 'upload':return target.setInputFiles(await localFile(root,step.file));
    case 'waitFor':return target.waitFor({state:'visible'});
    case 'drag':{
      const box=await target.boundingBox();
      if(!box)throw new Error('Rahoo drag target is hidden');
      await page.mouse.move(box.x+step.from.x,box.y+step.from.y);
      await page.mouse.down();
      try{await page.mouse.move(box.x+step.to.x,box.y+step.to.y,{steps:step.steps??12});}
      finally{await page.mouse.up();}
      return;
    }
  }
}
async function snapshot(page,generator){
  return page.evaluate(generator=>{
    function materialize(binding){
      const settings={};
      for(const [key,get] of Object.entries(binding.objects))settings[key]=get();
      for(const [key,ref] of Object.entries(binding.refs))settings[key]=ref.get();
      return settings;
    }
    const bindings=globalThis.__rahooSettings;
    const settings=materialize(bindings[generator]);
    const proSettings=generator==='contour'&&settings.mode==='pro'&&bindings.contourPro?materialize(bindings.contourPro):undefined;
    return JSON.parse(JSON.stringify({settings,proSettings},(_,v)=>v instanceof Map||v instanceof Set?[...v]:v));
  },generator);
}
async function nativeOutputs(page){
  return page.evaluate(()=>{
    const canvas=[...document.querySelectorAll('.dt-tool canvas, .dt-stage canvas, canvas')].find(node=>{
      const rect=node.getBoundingClientRect();
      return rect.width>=10&&rect.height>=10&&node.width>=10&&node.height>=10&&getComputedStyle(node).visibility==='visible';
    });
    const seen=new Set();
    const exporters=[];
    function walk(v){
      if(!v||typeof v!=='object'||seen.has(v))return;
      seen.add(v);
      const getSvg=v.props?.['get-svg']??v.props?.getSvg;
      if(typeof getSvg==='function')exporters.push(getSvg);
      walk(v.component?.subTree);
      if(Array.isArray(v.children))for(const child of v.children)walk(child);
    }
    walk(document.querySelector('#app')?._vnode);
    let svg;
    for(const exportSvg of exporters){
      const candidate=exportSvg();
      if(typeof candidate==='string'&&candidate.trim().startsWith('<svg')){svg=candidate;break;}
    }
    return {size:canvas?[canvas.width,canvas.height]:null,png:canvas?.toDataURL('image/png').split(',')[1],svg};
  });
}
export async function runRahoo(runtime,input,{root=process.cwd(),inspect=false,hook=true,svgDownload=false}={}){
  const spec=normalizeRahooSpec(input);
  const context=await runtime.browser.newContext({viewport:{width:spec.width,height:spec.height},deviceScaleFactor:1,
    locale:'zh-CN',acceptDownloads:true,serviceWorkers:'block',offline:true});
  try{
    await context.addInitScript(({seed,frameMs,generator})=>{
      globalThis.__rahooSettings=Object.create(null);
      let state=seed;
      Math.random=()=>{
        state=(state+0x6D2B79F5)|0;
        let n=Math.imul(state ^ state>>>15,state|1);
        n^=n+Math.imul(n ^ n>>>7,n|61);
        return ((n ^ n>>>14)>>>0)/4294967296;
      };
      if(frameMs!==undefined&&generator==='dynamicLight')Object.defineProperty(performance,'now',{value:()=>0,configurable:true});
    },{seed:spec.seed,frameMs:spec.frameMs,generator:spec.generator});
    await context.route('**/*',async route=>{
      const target=new URL(route.request().url());
      const path=target.pathname==='/design-tool'?'/':target.pathname;
      const asset=target.origin===origin&&route.request().method()==='GET'&&runtime.assets.get(path);
      if(!asset)return route.abort();
      const bytes=path==='/assets/'+release&&hook?runtime.instrumented:asset.bytes;
      await route.fulfill({contentType:asset.type,body:bytes});
    });
    const page=await context.newPage();
    page.setDefaultTimeout(12000);
    const errors=[];
    page.on('pageerror',err=>errors.push(err.message));
    const navigated=await page.goto(origin+'/design-tool?tab='+spec.generator,{waitUntil:'load',timeout:20000});
    if(!navigated?.ok())throw new Error('Could not load the cached Rahoo release');
    await page.locator('canvas').first().waitFor({state:'visible'});
    await setSettings(page,spec.generator,spec.settings);
    if(spec.proSettings)await setSettings(page,'contourPro',spec.proSettings);
    for(const step of spec.actions)await perform(page,step,root);
    await page.evaluate(async ({generator,frameMs,hook})=>{
      await document.fonts.ready;
      window.dispatchEvent(new Event('resize'));
      if(generator==='dynamicLight'&&frameMs!==undefined){
        if(hook)globalThis.__rahooSettings.dynamicLight.applyTime(frameMs/1000);
        else Object.defineProperty(performance,'now',{value:()=>frameMs,configurable:true});
      }
      await new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done)));
    },{generator:spec.generator,frameMs:spec.frameMs,hook});
    if(errors.length)throw new Error('Native Rahoo renderer raised '+errors.join(' / '));
    if(svgDownload||spec.download){
      let target;
      if(svgDownload){
        const menu=page.getByRole('button',{name:'导出 SVG',exact:true});
        if(!await menu.isVisible())throw new Error('Rahoo does not offer SVG export in this generator or mode.');
        await menu.click();
        target=page.locator('.svg-export-panel__save:visible');
        await target.waitFor({state:'visible'});
        if(!await target.isEnabled())throw new Error('Rahoo has no SVG content to save for this configuration.');
      }else target=locate(page,spec.download);
      const [download]=await Promise.all([
        page.waitForEvent('download',{timeout:spec.download?.timeout??60000}),target.click()
      ]);
      const path=await download.path();
      return {download:await readFile(path),name:download.suggestedFilename()};
    }
    const data=await nativeOutputs(page);
    if(!data.png&&!data.svg)throw new Error('Native Rahoo renderer produced no output for '+spec.generator);
    const settings=inspect?await snapshot(page,spec.generator):{};
    return {...data,...settings};
  }finally{await context.close();}
}
export async function renderRahooFile(runtime,specPath,outputPath){
  const spec=await readJson(specPath);
  const extension=extname(outputPath).toLowerCase();
  const result=await runRahoo(runtime,spec,{root:dirname(resolve(specPath)),svgDownload:extension==='.svg'&&!spec.download});
  if(result.download&&extname(result.name).toLowerCase()!==extname(outputPath).toLowerCase()){
    throw new Error('Output extension must match the native download '+result.name);
  }
  const body=result.download??(extension==='.png'&&result.png?Buffer.from(result.png,'base64'):undefined);
  if(body===undefined)throw new Error('Requested native format is unavailable. Choose SVG where offered, PNG, or the native download action.');
  await mkdir(dirname(resolve(outputPath)),{recursive:true});
  await writeFile(outputPath,body);
  return result;
}
