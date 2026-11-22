import {createServer} from 'node:http';
import {readFile,mkdtemp,writeFile,unlink,rmdir} from 'node:fs/promises';
import {basename,extname,join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {parseArgs} from 'node:util';
import {builtins,normalizeGraphics,renderGraphics} from '../tools/graphics/index.mjs';
import {rahooGenerators} from '../tools/rahoo-release.mjs';
import {basicRahooSpec,normalizeRahooSpec,openRahooBrowser,runRahoo} from '../tools/rahoo.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const gallery=join(root,'docs','generator-status');
const examples=JSON.parse(await readFile(join(gallery,'examples.json'),'utf8'));
const labels={
  concentricCircle:'同心圆',halftone:'半调',hudLines:'HUD 线',scaleCircle:'刻度圆',barcode:'条形码',waveTexture:'波浪',
  linePattern:'重复线',dotMatrix:'点阵',polygonGrid:'多边形网格',contour:'等高线',normalShape:'常见图形',nestedPolygons:'嵌套图形',
  globeSphere:'经纬球',squareGrid:'方形网格',rays:'射线',y2kRing:'星环',ringArray:'环形排列',fakeCode:'模拟编码',
  ascii:'ASCII 字符画',dynamicLight:'流光',arcs:'分段圆弧',measurementGuides:'测量导线',gridField:'图案场',
  registrationMarks:'套准标记',geometricMask:'几何蒙版',typographyOutlines:'轮廓排版',technicalLabels:'技术标注',
  signalBars:'信号条',waveform:'数据波形'
};
const local=Object.keys(builtins).filter(id=>!rahooGenerators.includes(id));
const localSet=new Set(local);
const uploads={halftone:['自定义波点形状','轮廓图片'],linePattern:['图像蒙版'],dotMatrix:['参考图','自定义点形','裁剪图'],
  y2kRing:['自定义图章'],ringArray:['自定义阵列元素'],ascii:['字符画源图']};
const special={
  dynamicLight:{webm:{panel:'导出 WebM',text:'录制'}},
  nestedPolygons:{gif:{panel:'动画',text:'导出 GIF'},mp4:{panel:'动画',text:'导出视频'}},
  ascii:{txt:{text:'导出 TXT'}}
};
const nativeExamples={
  concentricCircle:{count:26,minRadius:18,maxRadius:217,minStroke:4.8,maxStroke:.65,startAngle:38,arcAngle:282,strokeColor:'#2240ff'},
  halftone:{spacing:32,minRadius:1,maxRadius:13,shape:'diamond',dotColor:'#2240ff',angle:45},
  hudLines:{strokeColor:'#2240ff'},scaleCircle:{color:'#2240ff'},contour:{lineColor:'#2240ff'}
};
const catalog={categories:[
  {name:'Rahoo 图元',items:rahooGenerators.map(id=>({id,label:labels[id],native:true,
    options:builtins[id].options,uploads:uploads[id]??[],exports:Object.keys(special[id]??{})}))},
  {name:'工具包 SVG 原语',items:local.map(id=>({id,label:labels[id],options:builtins[id].options}))}
]};
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8',
  '.png':'image/png','.woff2':'font/woff2','.svg':'image/svg+xml'};
const fontRoot=join(root,'examples','sinewave','web','fonts');
const files=new Map([
  ['/',join(root,'studio','index.html')],
  ...['styles.css','app.js','fields.js','mark.svg'].map(name=>['/'+name,join(root,'studio',name)]),
  ...['montserrat-latin.woff2','jetbrains-mono-latin.woff2'].map(name=>['/fonts/'+name,join(fontRoot,name)]),
  ...Object.keys(builtins).map(name=>['/thumbs/'+name+'.png',join(gallery,name+'.png')])
]);

function json(res,data,status=200){
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
  res.end(JSON.stringify(data));
}
async function readInput(req){
  let bytes=0;
  const chunks=[];
  for await(const chunk of req){
    bytes+=chunk.length;
    if(bytes>16*1024*1024)throw new Error('配置和图片合计须小于 16 MB。');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
function localResult(input){
  if(input?.kind!=='GraphicSpec')throw new Error('请选择 GraphicSpec 或 RahooSpec 配置。');
  if(input.layers?.some?.(layer=>rahooGenerators.includes(layer?.generator))){
    throw new Error('请在工坊选择对应 Rahoo 图元，或导入 RahooSpec 配置。');
  }
  const spec=normalizeGraphics(input);
  return {spec,svg:renderGraphics(spec),size:[spec.width,spec.height]};
}
function svgSpec(generator,example){
  const reference=examples[generator];
  if(example&&reference&&reference.layers.every(layer=>localSet.has(layer.generator))){
    return {...structuredClone(reference),background:'transparent'};
  }
  return {kind:'GraphicSpec',version:1,width:750,height:550,seed:17,background:'transparent',
    layers:[{generator,params:{}}]};
}
function nativeSpec(generator,example){
  const settings=example&&nativeExamples[generator]?{params:nativeExamples[generator]}:{};
  return {...basicRahooSpec(generator),width:1100,height:650,settings,...(generator==='dynamicLight'?{frameMs:700}:{})};
}
async function withUploads(spec,assets,render){
  if(spec.actions.some(action=>action.do==='upload'))throw new Error('请在工坊中选择配置需要的图片。');
  if(!Array.isArray(assets)||assets.length>(uploads[spec.generator]?.length??0))throw new Error('无效的附图。');
  if(!assets.length)return render(root);
  const folder=await mkdtemp(join(tmpdir(),'primitive-studio-'));
  const paths=[];
  try{
    const actions=[];
    for(const asset of assets){
      const suffix=extname(String(asset.name)).toLowerCase();
      if(!Number.isInteger(asset.slot)||!uploads[spec.generator][asset.slot]||typeof asset.data!=='string'||
        !['.png','.jpg','.jpeg','.gif','.webp','.bmp','.svg'].includes(suffix))throw new Error('无效的附图。');
      const bytes=Buffer.from(asset.data,'base64');
      if(!bytes.length||bytes.length>8*1024*1024)throw new Error('单张图片最多 8 MB。');
      const file='source-'+paths.length+suffix;
      const path=join(folder,file);
      await writeFile(path,bytes);
      paths.push(path);
      actions.push({do:'upload',selector:'.dt-tool input[type=file]',index:asset.slot,file});
    }
    spec.actions.unshift(...actions);
    return await render(folder);
  }finally{
    await Promise.all(paths.map(path=>unlink(path)));
    await rmdir(folder);
  }
}
async function nativeResult(runtime,input,{assets=[],format,inspect=false}={}){
  const saved=normalizeRahooSpec(input);
  const spec=structuredClone(saved);
  delete spec.download;
  if(format&&format!=='svg'){
    const action=format==='png'?{text:'保存图片'}:special[spec.generator]?.[format];
    if(!action)throw new Error('原版生成器没有提供该导出格式。');
    if(action.panel)spec.actions.push({do:'click',text:action.panel});
    if(format==='webm')delete spec.frameMs;
    spec.download={text:action.text,timeout:90000};
  }
  const needsSnapshot=inspect||spec.generator==='contour'&&spec.settings.mode==='pro'&&!spec.proSettings;
  const result=await withUploads(spec,assets,async root=>runRahoo(await runtime(),spec,
    {root,inspect:needsSnapshot,svgDownload:format==='svg'}));
  if(result.download)return {name:basename(result.name),data:result.download.toString('base64')};
  const {settings,proSettings,...preview}=result;
  if(settings)saved.settings=settings;
  if(proSettings)saved.proSettings=proSettings;
  return {spec:saved,...preview};
}

export async function startStudio({port=4174}={}){
  let opening;
  const runtime=()=>opening??=openRahooBrowser().catch(error=>{opening=undefined;throw error;});
  const server=createServer(async(req,res)=>{
    try{
      const hosts=['127.0.0.1','localhost'].map(host=>host+':'+server.address().port);
      if(!hosts.includes(req.headers.host)||
        req.method==='POST'&&req.headers.origin&&req.headers.origin!=='http://'+req.headers.host){
        json(res,{error:'请通过本地工坊地址打开页面。'},403);
        return;
      }
      const url=new URL(req.url,'http://127.0.0.1');
      if(req.method==='GET'&&files.has(url.pathname)){
        const path=files.get(url.pathname);
        const content=await readFile(path);
        res.writeHead(200,{'Content-Type':mime[extname(path)],'Cache-Control':'no-store'});
        res.end(content);
        return;
      }
      if(req.method==='GET'&&url.pathname==='/api/catalog'){
        json(res,catalog);
        return;
      }
      if(req.method==='GET'&&url.pathname==='/api/editor'){
        const generator=url.searchParams.get('id');
        const example=url.searchParams.get('example')==='1';
        if(rahooGenerators.includes(generator)){
          json(res,await nativeResult(runtime,nativeSpec(generator,example),{inspect:true}));
          return;
        }
        if(!localSet.has(generator)){
          json(res,{error:'找不到图元。'},404);
          return;
        }
        json(res,localResult(svgSpec(generator,example)));
        return;
      }
      if(req.method==='POST'&&url.pathname==='/api/render'){
        const request=await readInput(req);
        json(res,request.spec?.kind==='RahooSpec'?await nativeResult(runtime,request.spec,request):localResult(request.spec));
        return;
      }
      json(res,{error:'找不到此页面。'},404);
    }catch(error){
      json(res,{error:error.message.split('\n')[0]},400);
    }
  });
  await new Promise((yes,no)=>{
    server.once('error',no);
    server.listen(port,'127.0.0.1',yes);
  });
  return {url:'http://127.0.0.1:'+server.address().port+'/',async close(){
    await new Promise(done=>server.close(done));
    const browser=await opening?.catch(()=>undefined);
    await browser?.close();
  }};
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
  try{
    const {values}=parseArgs({options:{port:{type:'string',default:'4174'}}});
    const port=Number(values.port);
    if(!Number.isInteger(port)||port<0||port>65535)throw new Error('端口须在 0–65535 之间。');
    const app=await startStudio({port});
    console.log('图元工坊 '+app.url);
    process.once('SIGINT',()=>void app.close());
    process.once('SIGTERM',()=>void app.close());
  }catch(error){console.error(error.message);process.exitCode=1;}
}
