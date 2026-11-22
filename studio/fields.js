const labels={
  count:'圈数',minRadius:'最小半径',maxRadius:'最大半径',minStroke:'内圈描边',maxStroke:'外圈描边',
  startAngle:'起始角',arcAngle:'圆弧角度',strokeColor:'描边颜色',strokeWidth:'描边宽度',lineWidth:'线宽',
  lineColor:'线条颜色',color:'颜色',fillColor:'填充颜色',bgColor:'底色',background:'底色',angle:'角度',
  width:'宽度',height:'高度',seed:'随机种子',opacity:'不透明度',scale:'缩放',x:'横向偏移',y:'纵向偏移',
  rotation:'旋转',rotationStep:'每层旋转',spacing:'间距',radius:'半径',shape:'形状',mode:'模式',
  preset:'预设',exportScale:'导出倍率',frameMs:'预览时间（毫秒）',time:'时间（秒）',fps:'帧率',
  videoSize:'视频尺寸',videoBackground:'视频背景',rows:'行数',cols:'列数',columns:'列数',
  amplitude:'振幅',frequency:'频率',levels:'等高层数',lineCount:'线条数量',dotCount:'点数',
  segments:'分段数',sides:'边数',size:'尺寸',thickness:'粗细',gap:'间隙',margin:'边距',
  text:'文字',font:'字体',fontSize:'字号',samples:'采样值',pixels:'像素数据',speed:'速度',
  params:'图形参数',timeline:'时间轴',cameraPosition:'相机位置',cameraRotation:'相机旋转',
  paths:'路径',fills:'填充',levelStyles:'等高线样式',selection:'已选单元',majorInterval:'主刻度间隔',
  minHeight:'最小高度',maxHeight:'最大高度',dotColor:'点阵颜色',lineCap:'线端样式'
};
const choices={
  classic:'经典',pro:'三维',barcode:'条形码',spectrum:'频谱',ruler:'标尺',initial:'默认',
  preset1:'预设 1',preset2:'预设 2',circle:'圆',square:'方形',diamond:'菱形',triangle:'三角形',
  round:'圆头',butt:'平头',flat:'平头',solid:'实线',dash:'虚线',dashed:'虚线',dot:'点线',horizontal:'横向',vertical:'纵向',
  transparent:'透明',linear:'线性',radial:'放射',grid:'网格',normal:'常规',custom:'自定义'
};
const isHex=value=>/^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value);
const colorToInput=value=>value.length===4?'#'+Array.from(value.slice(1),letter=>letter.repeat(2)).join(''):value.slice(0,7);
export function element(tag,className,value){
  const node=document.createElement(tag);
  if(className)node.className=className;
  if(value!==undefined)node.textContent=value;
  return node;
}
export function button(label,action,className='text-button'){
  const node=element('button',className,label);
  node.type='button';
  node.addEventListener('click',action);
  return node;
}
export function option(value,label=value){
  const node=element('option','',label);
  node.value=value;
  return node;
}
const named=(key,item)=>key==='count'&&item.id!=='concentricCircle'?'数量':labels[key]??key;
const isObject=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);

function control(path,value,schema,context){
  const key=path.at(-1),id='param-'+path.join('-');
  const title=named(key,context.item);
  const update=(next,refresh=false)=>context.change(path,next,refresh);
  if(typeof value==='boolean'){
    const row=element('label','boolean',title);
    const input=element('input');
    input.type='checkbox';
    input.checked=value;
    input.addEventListener('change',()=>update(input.checked));
    row.append(input);
    return row;
  }
  const row=element('div',typeof value==='number'?'number-field':'field');
  const label=element('label','',title);
  label.htmlFor=id;
  const input=element('input','input');
  input.id=id;
  if(typeof value==='number'){
    const heading=element('div','number-title');
    const integer=schema.type==='integer'||Number.isInteger(value)&&!/opacity|speed|stroke|scale|amplitude|frequency/i.test(key);
    const step=integer?1:/opacity/i.test(key)?.01:.1;
    input.type='number';
    input.step='any';
    input.value=String(value);
    const {minimum,maximum}=schema;
    if(Number.isFinite(minimum))input.min=minimum;
    if(Number.isFinite(maximum))input.max=maximum;
    heading.append(label,input);
    row.append(heading);
    let slider;
    if(Number.isFinite(minimum)&&Number.isFinite(maximum)&&maximum>minimum&&value>=minimum&&value<=maximum){
      slider=element('input');
      slider.type='range';
      slider.min=minimum;
      slider.max=maximum;
      slider.step=step;
      slider.value=value;
      slider.setAttribute('aria-label',title+'滑块');
      slider.addEventListener('input',()=>{
        input.value=slider.value;
        update(slider.valueAsNumber);
      });
      row.append(slider);
    }
    input.addEventListener('input',()=>{
      if(!Number.isFinite(input.valueAsNumber)||!input.validity.valid)return;
      if(slider)slider.value=input.value;
      update(input.valueAsNumber);
    });
    return row;
  }
  row.append(label);
  if(schema.enum?.length&&typeof value==='string'){
    const select=element('select','input');
    select.id=id;
    const values=[...new Set([...schema.enum,value])];
    select.append(...values.map(entry=>option(entry,choices[entry]??entry)));
    select.value=value;
    select.addEventListener('change',()=>update(select.value));
    row.append(select);
  }else if(Array.isArray(value)||isObject(value)||value===null){
    const editor=element('textarea','array-editor');
    editor.id=id;
    editor.value=JSON.stringify(value,null,2);
    const apply=button('应用此参数',()=>{
      try{
        update(JSON.parse(editor.value),true);
        editor.setCustomValidity('');
      }catch{
        editor.setCustomValidity('请输入有效的 JSON。');
        editor.reportValidity();
      }
    });
    editor.addEventListener('input',()=>editor.setCustomValidity(''));
    row.append(editor,apply);
  }else if((schema.pattern&&/#/.test(schema.pattern)||/color|background|^fg$/i.test(key))&&typeof value==='string'&&isHex(value)){
    const color=element('input');
    color.type='color';
    color.value=colorToInput(value);
    color.setAttribute('aria-label',title+'拾色器');
    input.value=value;
    color.addEventListener('input',()=>{
      input.value=color.value+(input.value.length===9?input.value.slice(7):'');
      update(input.value);
    });
    input.addEventListener('change',()=>{
      if(isHex(input.value))color.value=colorToInput(input.value);
      update(input.value);
    });
    const line=element('div','color-line');
    line.append(color,input);
    row.append(line);
  }else{
    input.value=value??'';
    input.addEventListener('change',()=>update(input.value));
    row.append(input);
  }
  return row;
}

function group(container,title){
  const details=element('details','group');
  const body=element('div','control-list');
  details.append(element('summary','',title),body);
  container.append(details);
  return body;
}
function controls(container,path,values,context,schemas={}){
  const stack=element('div','control-list');
  for(const [key,value] of Object.entries(values)){
    stack.append(control([...path,key],value,schemas[key]??{},context));
  }
  if(stack.childElementCount)container.append(stack);
}
function graphic(container,context){
  const {entry,item,layerIndex,items,setLayer}=context;
  const {spec}=entry;
  const layer=spec.layers[layerIndex];
  if(spec.layers.length>1){
    const select=element('select','input layer-picker');
    select.setAttribute('aria-label','选择图层');
    select.append(...spec.layers.map((entry,index)=>option(index,(index+1)+' / '+(items.get(entry.generator)?.label??entry.generator))));
    select.value=layerIndex;
    select.addEventListener('change',()=>setLayer(Number(select.value)));
    container.append(select);
  }
  controls(container,['layers',layerIndex,'params'],layer.params,context,items.get(layer.generator)?.options??item.options);
  const canvas=group(container,'画布');
  controls(canvas,[],{width:spec.width,height:spec.height,seed:spec.seed,background:spec.background},context,
    {width:{type:'integer',minimum:16,maximum:4096},height:{type:'integer',minimum:16,maximum:4096}});
  const transform=group(container,'图层变换');
  const {id,generator,params,...properties}=layer;
  controls(transform,['layers',layerIndex],properties,context);
}
const nativeModes={barcode:['barcode','spectrum','ruler'],contour:['classic','pro'],squareGrid:['initial','preset1','preset2']};
const nativeEnums={
  concentricCircle:{lineType:'solid dash dot'},halftone:{shape:'circle hexagon square diamond triangle plus cross',pattern:'grid hex diag',gradientType:'linear radial',maskShape:'full circle rect polygon image',strokeAlign:'inner outer center'},
  dotMatrix:{drawMode:'click erase pick',shape:'circle square diamond triangle plus cross',layout:'grid diagonal hex',crop:'all ring rect image'},
  linePattern:{direction:'horizontal vertical diagonal dot',range:'all ring rect image'},
  polygonGrid:{shape:'triangle triangleV hexagon hexagonV rightTriangle rectangle',drawMode:'click drag'},
  normalShape:{shape:'arrow slant arrow2 bracket cross plus star4',layout:'single diverge focus cycle'},
  ringArray:{shape:'circle square triangle diamond star hexagon',stepMode:'calc fixedAngle fixedSpacing',rotateMode:'radial tangent fixed'},
  y2kRing:{lineType:'solid dash dot',ringGapCap:'round butt'},ascii:{colorMode:'mono gray color tint'},
  nestedPolygons:{colorMode:'solid gradient'},dynamicLight:{effect:'streak flame',colorMode:'mono gradient'}
};
function native(container,context){
  const {item,entry:{spec},assets,upload,removeAsset}=context;
  const {settings,proSettings}=spec;
  const switchKey=item.id==='squareGrid'?'preset':'mode';
  if(nativeModes[item.id]&&settings[switchKey]!==undefined){
    const mode=control(['settings',switchKey],settings[switchKey],{enum:nativeModes[item.id]},context);
    mode.classList.add('native-mode');
    container.append(mode);
  }
  const pro=item.id==='contour'&&settings.mode==='pro';
  const active=pro?proSettings??{}:settings;
  const key=item.id==='barcode'?settings.mode:'params';
  const path=[pro?'proSettings':'settings',key];
  const parameters=active[key]??{};
  const preferred=['count','minRadius','maxRadius','minStroke','maxStroke','startAngle','arcAngle','strokeColor'];
  const keys=item.id==='concentricCircle'?[...preferred.filter(key=>key in parameters),...Object.keys(parameters).filter(key=>!preferred.includes(key))]:Object.keys(parameters);
  const visible=item.id==='concentricCircle'?8:12;
  const schema=Object.fromEntries(keys.map(key=>{
    const values=nativeEnums[item.id]?.[key];
    const hint=item.options[key]??{};
    return [key,values?{enum:values.split(' ')}:typeof parameters[key]==='number'?{minimum:hint.minimum,maximum:hint.maximum}:{}];
  }));
  const pick=keys=>Object.fromEntries(keys.map(key=>[key,parameters[key]]));
  controls(container,path,pick(keys.slice(0,visible)),context,schema);
  if(keys.length>visible)controls(group(container,'更多图形参数'),path,pick(keys.slice(visible)),context,schema);
  if(item.uploads.length){
    const files=element('div','source-field');
    item.uploads.forEach((label,slot)=>{
      files.append(button(label,()=>upload(slot),'button'));
      const asset=assets.find(asset=>asset.slot===slot);
      if(asset)files.append(element('p','',asset.name),button('移除图片',()=>removeAsset(slot)));
    });
    container.append(files);
  }
  const general=group(container,'渲染与导出');
  const refs=Object.fromEntries(Object.entries(active).filter(([name])=>!['params','barcode','spectrum','ruler',switchKey].includes(name)));
  controls(general,[path[0]],refs,context);
  controls(general,[],Object.fromEntries(['width','height','seed','frameMs'].filter(name=>name in spec).map(name=>[name,spec[name]])),context);
  if(item.id==='nestedPolygons'&&!settings.timeline?.tracks?.length){
    general.append(button('添加旋转关键帧',()=>context.change(['settings','timeline'],
      {duration:2,tracks:[{param:'rotationStep',keys:[{t:0,v:-2},{t:2,v:-14}]}]},true)));
  }
}
export function renderInspector(container,context){
  const expanded=new Set([...container.querySelectorAll('details[open]>summary')].map(node=>node.textContent));
  container.replaceChildren();
  if(!context.entry)return;
  if(context.item.native)native(container,context);
  else graphic(container,context);
  for(const details of container.querySelectorAll('details'))if(expanded.has(details.firstChild.textContent))details.open=true;
}
