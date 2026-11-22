import {button,element,renderInspector} from './fields.js';

const byId=id=>document.getElementById(id);
const ui=Object.fromEntries(['import-spec','spec-file','export','export-options','library-toggle','library-count',
  'search','library-body','tool-title','tool-id','zoom-out','zoom-fit','zoom-in','stage','stage-inner','art-wrap','art',
  'empty-stage','status','canvas-size','inspector','example','reset','fields-tab','json-tab','fields-pane',
  'json-pane','config-source','apply-json','source-file','draw-controls','canvas-tip','clear-marks'].map(id=>[id,byId(id)]));
const narrow=matchMedia('(max-width:610px)');
const items=new Map();
const drafts=new Map();
const state={catalog:null,item:null,spec:null,assets:[],preview:null,zoom:1,layerIndex:0,revision:0,pending:false,invalid:false};
let renderTimer;
let imageURL;
let slot=0;
let pointer;

async function api(path,spec){
  const options=spec===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(spec)};
  const response=await fetch('/api/'+path,options);
  const data=await response.json();
  if(!response.ok)throw new Error(data.error??('HTTP '+response.status));
  return data;
}
function report(message,error=false){
  ui.status.textContent=message;
  ui.status.classList.toggle('error',error);
}
function begin(message){
  clearTimeout(renderTimer);
  state.pending=true;
  state.revision+=1;
  ui.stage.setAttribute('aria-busy','true');
  report(message);
  exportMenu();
  return state.revision;
}
function settle(revision,error){
  if(revision!==state.revision)return;
  state.pending=false;
  ui.stage.setAttribute('aria-busy','false');
  if(error)report(error.message,true);
  exportMenu();
}
function libraryExpanded(expanded){
  ui['library-toggle'].setAttribute('aria-expanded',String(expanded));
  ui['library-body'].hidden=!expanded;
}
function paintLibrary(){
  const term=ui.search.value.trim().toLowerCase();
  const groups=state.catalog.categories;
  let matches=0;
  ui['library-body'].replaceChildren();
  for(const group of groups){
    const filtered=group.items.filter(item=>[item.id,item.label,group.name].some(value=>value.toLowerCase().includes(term)));
    if(!filtered.length)continue;
    matches+=filtered.length;
    const section=element('section','library-group');
    section.append(element('h2','',group.name));
    const list=element('div','tool-list');
    for(const item of filtered){
      const pick=button('',()=>{
        void selectTool(item);
        if(narrow.matches)libraryExpanded(false);
      },'tool');
      pick.dataset.id=item.id;
      pick.setAttribute('aria-current',String(item===state.item));
      const thumb=element('img');
      thumb.src='/thumbs/'+item.id+'.png';
      thumb.alt='';
      thumb.loading='lazy';
      pick.append(thumb,element('span','',item.label));
      list.append(pick);
    }
    section.append(list);
    ui['library-body'].append(section);
  }
  ui['library-count'].textContent=String(matches).padStart(2,'0');
  if(!matches)ui['library-body'].append(element('p','library-empty','没有匹配的图元'));
}
function fitArt(){
  const [width,height]=state.preview?.size??[0,0];
  if(!width||!height)return;
  const stage=ui['stage-inner'];
  const fit=Math.min((stage.clientWidth-32)/width,(stage.clientHeight-32)/height);
  const wrap=ui['art-wrap'];
  wrap.style.width=Math.max(1,Math.floor(width*fit*state.zoom))+'px';
  wrap.style.height=Math.max(1,Math.floor(height*fit*state.zoom))+'px';
}
function zoom(value){
  state.zoom=Math.max(.35,Math.min(3,value));
  ui['zoom-fit'].textContent=Math.round(state.zoom*100)+'%';
  fitArt();
}
function display(blob,size){
  if(imageURL)URL.revokeObjectURL(imageURL);
  imageURL=URL.createObjectURL(blob);
  state.preview={size,blob};
  ui.art.hidden=false;
  ui.art.src=imageURL;
  ui.art.alt=state.item.label+'预览';
  ui['empty-stage'].hidden=state.item.id!=='ascii'||state.assets.length>0;
  ui['canvas-size'].textContent=size.join(' × ')+' px';
  fitArt();
}
function bytes(value){
  return Uint8Array.from(atob(value),character=>character.charCodeAt(0));
}
function setHeading(title,subtitle){
  ui['tool-title'].textContent=title;
  ui['tool-id'].textContent=subtitle;
  for(const node of ui['library-body'].querySelectorAll('[data-id]'))node.setAttribute('aria-current',String(node.dataset.id===state.item?.id));
}
function inspector(){
  renderInspector(ui['fields-pane'],{
    item:state.item,items,entry:state.spec?{spec:state.spec}:null,layerIndex:state.layerIndex,
    setLayer:index=>{state.layerIndex=index;inspector();},
    change:changeValue,assets:state.assets,
    upload:index=>{slot=index;ui['source-file'].click();},
    removeAsset:index=>{state.assets=state.assets.filter(asset=>asset.slot!==index);inspector();render();}
  });
}
function configTab(json){
  ui['fields-tab'].setAttribute('aria-pressed',String(!json));
  ui['json-tab'].setAttribute('aria-pressed',String(json));
  ui['fields-pane'].hidden=json;
  ui['json-pane'].hidden=!json;
  if(json)ui['config-source'].value=JSON.stringify(state.spec,null,2);
}
function showSpec(item,result,message,assets=state.assets){
  state.item=item;
  state.spec=result.spec;
  state.assets=assets;
  state.invalid=false;
  drafts.set(item.id,{result,assets});
  ui.inspector.hidden=false;
  setHeading(item.label,item.id);
  const blob=result.png?new Blob([bytes(result.png)],{type:'image/png'}):new Blob([result.svg],{type:'image/svg+xml'});
  display(blob,result.size);
  state.preview.svg=Boolean(result.svg);
  drawControls();
  report(message);
}
async function selectTool(item,variant){
  const revision=begin('正在载入图元');
  try{
    const draft=variant===undefined?drafts.get(item.id):null;
    const result=draft?.result??await api('editor?'+new URLSearchParams({id:item.id,example:variant==='example'?'1':'0'}));
    if(revision!==state.revision)return;
    state.layerIndex=0;
    showSpec(item,result,'预览已更新',draft?.assets??[]);
    const dark=['contour','squareGrid','nestedPolygons','globeSphere','ascii','dynamicLight'].includes(item.id);
    document.querySelector('button[data-backdrop="'+(dark?'dark':'light')+'"]').click();
    zoom(1);
    inspector();
    if(!ui['json-pane'].hidden)configTab(true);
    settle(revision);
  }catch(error){settle(revision,error);}
}
function changeValue(path,value,refresh){
  const spec=state.spec;
  const destination=path.slice(0,-1).reduce((current,key)=>current[key],spec);
  destination[path.at(-1)]=value;
  const mode=path.join('.')==='settings.mode';
  const preset=path.join('.')==='settings.preset'&&spec.generator==='squareGrid';
  if(mode&&spec.generator==='contour'){
    delete spec.proSettings;
    spec.actions=[];
  }
  if(preset){
    const {preset,exportScale}=spec.settings;
    spec.settings={preset,exportScale};
    spec.actions=[];
  }
  render(refresh||mode||preset);
}
function render(inspect=false){
  const {spec,assets}=state;
  const revision=begin('正在渲染');
  renderTimer=setTimeout(async()=>{
    try{
      const result=await api('render',{spec,assets,inspect});
      if(revision!==state.revision)return;
      showSpec(state.item,result,'预览已更新');
      if(inspect)inspector();
      settle(revision);
    }catch(error){
      if(revision===state.revision)state.invalid=true;
      settle(revision,error);
    }
  },150);
}
async function importConfig(value){
  const wrapper=value?.kind==='PrimitiveStudioPreset'&&value.version===1;
  const spec=wrapper?value.spec:value;
  const assets=wrapper?value.assets:spec?.generator===state.item?.id?state.assets:[];
  const revision=begin('正在验证配置');
  try{
    const result=await api('render',{spec,assets,inspect:true});
    if(revision!==state.revision)return;
    const item=items.get(result.spec.generator??result.spec.layers[0].generator);
    state.layerIndex=0;
    showSpec(item,result,'已应用配置',assets??[]);
    zoom(1);
    inspector();
    if(!ui['json-pane'].hidden)configTab(true);
    settle(revision);
  }catch(error){settle(revision,error);}
}
function saveFile(blob,name){
  const url=URL.createObjectURL(blob);
  const link=element('a');
  link.href=url;
  link.download=name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function pngFromSVG(preview){
  const url=URL.createObjectURL(preview.blob);
  try{
    const picture=new Image();
    picture.src=url;
    await picture.decode();
    const canvas=element('canvas');
    [canvas.width,canvas.height]=preview.size;
    canvas.getContext('2d').drawImage(picture,0,0);
    return await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('无法编码 PNG。')),'image/png'));
  }finally{URL.revokeObjectURL(url);}
}
function exportMenu(){
  const names={svg:'SVG 矢量',png:'PNG 图片',json:'JSON 配置',gif:'GIF 动画',mp4:'MP4 视频',webm:'WebM 动画',txt:'TXT 字符画'};
  const formats=state.spec?['png',...(state.preview?.svg?['svg']:[]),'json',...(state.item.exports??[])]:[];
  ui.export.hidden=!formats.length;
  ui['export-options'].replaceChildren(...formats.map(format=>{
    const action=button(names[format],()=>void exportFile(format),'');
    action.disabled=state.pending||state.invalid||(format!=='json'&&state.item.id==='ascii'&&!state.assets.length);
    return action;
  }));
}
async function exportFile(format){
  const {spec,assets,preview,item,revision}=state;
  ui.export.open=false;
  try{
    const name=item.id+'.'+format;
    if(format==='json'){
      const config=assets.length?{kind:'PrimitiveStudioPreset',version:1,spec,assets}:spec;
      saveFile(new Blob([JSON.stringify(config,null,2)+'\n'],{type:'application/json'}),name);
    }else if(item.native){
      report('正在导出 '+format.toUpperCase());
      const file=await api('render',{spec,assets,format});
      saveFile(new Blob([bytes(file.data)]),file.name);
    }else saveFile(format==='svg'?preview.blob:await pngFromSVG(preview),name);
    if(state.revision===revision)report('已导出 '+format.toUpperCase());
  }catch(error){if(state.revision===revision)report(error.message,true);}
}
function filePicker(buttonID,fileID,read){
  ui[buttonID].addEventListener('click',()=>ui[fileID].click());
  ui[fileID].addEventListener('change',async event=>{
    const file=event.target.files[0];
    event.target.value='';
    if(!file)return;
    try{await read(file);}
    catch(error){report(error.message,true);}
  });
}

ui.search.addEventListener('input',()=>{if(state.catalog){libraryExpanded(true);paintLibrary();}});
ui['library-toggle'].addEventListener('click',()=>{if(narrow.matches)libraryExpanded(ui['library-body'].hidden);});
narrow.addEventListener('change',event=>libraryExpanded(!event.matches));
libraryExpanded(!narrow.matches);
ui.example.addEventListener('click',()=>{if(state.item)void selectTool(state.item,'example');});
ui.reset.addEventListener('click',()=>{if(state.item)void selectTool(state.item,'default');});
ui['zoom-in'].addEventListener('click',()=>zoom(state.zoom*1.25));
ui['zoom-out'].addEventListener('click',()=>zoom(state.zoom/1.25));
ui['zoom-fit'].addEventListener('click',()=>zoom(1));
const backdrops=document.querySelectorAll('button[data-backdrop]');
for(const backdrop of backdrops)backdrop.addEventListener('click',()=>{
  ui.stage.dataset.backdrop=backdrop.dataset.backdrop;
  for(const item of backdrops)item.setAttribute('aria-pressed',String(item===backdrop));
});
new ResizeObserver(fitArt).observe(ui['stage-inner']);
ui['fields-tab'].addEventListener('click',()=>configTab(false));
ui['json-tab'].addEventListener('click',()=>configTab(true));
ui['apply-json'].addEventListener('click',()=>{
  try{void importConfig(JSON.parse(ui['config-source'].value));}
  catch(error){report(error.message,true);}
});
filePicker('import-spec','spec-file',async file=>{
  if(file.size>16*1024*1024)throw new Error('配置文件须小于 16 MB。');
  await importConfig(JSON.parse(await file.text()));
});
ui['source-file'].addEventListener('change',async event=>{
  const file=event.target.files[0];
  event.target.value='';
  if(!file||!state.item?.native)return;
  if(file.size>8*1024*1024){report('单张图片最多 8 MB。',true);return;}
  const item=state.item;
  const index=slot;
  const reader=new FileReader();
  reader.addEventListener('load',()=>{
    if(item!==state.item)return;
    const data=String(reader.result).split(',')[1];
    state.assets=[...state.assets.filter(asset=>asset.slot!==index),{slot:index,name:file.name,data}];
    inspector();
    render();
  });
  reader.addEventListener('error',()=>report('无法读取图片。',true));
  reader.readAsDataURL(file);
});
function drawControls(){
  const {id}=state.item;
  const active=['dotMatrix','polygonGrid','squareGrid'].includes(id)||id==='contour'&&state.spec.settings.mode==='pro';
  ui.art.dataset.draw=String(active);
  ui['draw-controls'].hidden=!active;
  ui['canvas-tip'].textContent=id==='contour'?'拖动画布以编辑地形':'点击或拖动画布以绘制';
  ui['clear-marks'].hidden=!state.spec.actions?.length;
}
function canvasPoint(event){
  const box=ui.art.getBoundingClientRect();
  const [width,height]=state.preview.size;
  return {x:Math.max(0,Math.min(width-1,Math.floor((event.clientX-box.left)*width/box.width))),
    y:Math.max(0,Math.min(height-1,Math.floor((event.clientY-box.top)*height/box.height)))};
}
ui.art.addEventListener('pointerdown',event=>{
  if(ui.art.dataset.draw!=='true'||event.button!==0||state.pending)return;
  ui.art.setPointerCapture(event.pointerId);
  pointer={from:canvasPoint(event),spec:state.spec};
});
ui.art.addEventListener('pointercancel',()=>{pointer=undefined;});
ui.art.addEventListener('pointerup',event=>{
  const start=pointer;
  pointer=undefined;
  if(!start||start.spec!==state.spec)return;
  const to=canvasPoint(event);
  const drag=Math.hypot(to.x-start.from.x,to.y-start.from.y)>5;
  if(state.spec.actions.length>=200){report('请清除绘制后继续。',true);return;}
  const selector='canvas:visible';
  state.spec.actions.push(drag?{do:'drag',selector,from:start.from,to}:{do:'click',selector,at:to});
  render();
});
ui['clear-marks'].addEventListener('click',()=>{state.spec.actions=[];render();});
addEventListener('keydown',event=>{if(event.key==='Escape')ui.export.open=false;});
addEventListener('click',event=>{if(!ui.export.contains(event.target))ui.export.open=false;});

exportMenu();
try{
  state.catalog=await api('catalog');
  for(const group of state.catalog.categories)for(const item of group.items)items.set(item.id,item);
  paintLibrary();
  await selectTool(items.get('concentricCircle'),'example');
}catch(error){report(error.message,true);}
