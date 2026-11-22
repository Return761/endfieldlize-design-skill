import {createHash} from 'node:crypto';
import {mkdir,readFile,stat,writeFile} from 'node:fs/promises';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export const origin='https://rahoo.online';
export const defaultCache=fileURLToPath(new URL('../vendor/rahoo/',import.meta.url));
export const release='index-DmH-F12K.js';
const entry='index-DK0-HGj1.js';
const releaseSha='dd80e9b7c827e175fbe6159bd9de3dc7051036fd713e203dfbeb9f2802fd39c6';
const pathFor=name=>name==='index.html'?'/':name==='vite.svg'?'/'+name:'/assets/'+encodeURIComponent(name);
const browserAssets={
  'noto-serif-sc-chinese-simplified-900-normal-Czkgsjws.woff2':'8066568018a2ba73200f21ecedd000834b6cb821ffe917a60abae507a6ed0969',
  'Derlantica Beauty-DGxVk-qu.otf':'267e34cc7649e706182d641f91cea313a459d3eb568df4c3c707fa5a3f4f86fb',
  'keynote-bg-CR6mXyrT.jpg':'50fa2bcd63f479c372a33edbdf4e48cf116d9a0b092c5a8198f7c399d97c477f',
  'transparent-pattern-2g70Fw42.jpg':'147dbe5a011791329da87c2e50cf80c4f2f1f8ad0a972978e5376c2b1474d796'
};
const pinned={
  'index.html':'5e4c9dd4e5728c5662b576061420a2f5a62f354894243c1094de62cd6d3fe0ae',
  [release]:releaseSha,
  [entry]:'99e6805f6f7db990aabf9633bd94d3d7d431ba2d17daf6c5f2a8b33d6a70135c',
  'style-nxjbOybu.css':'7d179981f4367b8e0b915555a2cea8179bf394002a607320fdca3391a14125c0',
  'vite.svg':'4a748afd443918bb16591c834c401dae33e87861ab5dbad0811c3a3b4a9214fb',
  '_plugin-vue_export-helper-DlAUqK2U.js':'cb85b0f263dbe24e857338301c0627076592e9f1f1a5662929f86d2c126444aa',
  'colorConverter-QefeWFFO.js':'4c28d240534a5721bd305739b64bbe7133b3883d953fbd8cc78964b3e8ca92ba',
  'three.module-D0xdlY6t.js':'e20a8605eafee0f60fae8f69408521fb2d7b86c6657820e4d7ba0ca80d99e167',
  'Gilroy-HeavyItalic-8-B3VI8cqx.otf':'d1676fad29c337eb994b6cd0bff9f8a49ef1719b183f963c1db69a96f23efe83',
  'Radomir-Tinkov-Gilroy-Heavy-9-Bw3_jz26.otf':'5e6505de88be87466688b9b516d44ca35a9838db3c0e0625a7d9a8ec7128441b',
  'src-CAOKVyOB.js':'60bcb75bcf602a0e9bc9d24fcecae6c15a8b041de9dc0c86f96c0a3e1e31dbc5',
  '__vite-browser-external-ke9ZaMpT.js':'5f99cc47a5a551232e3490e96385e878335c58619886b588e06d959d88786746',
  ...browserAssets
};
const files=Object.keys(pinned);
const mime={html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8',
  svg:'image/svg+xml',otf:'font/otf',woff2:'font/woff2',jpg:'image/jpeg'};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
function verifyRelease(assets){
  const current=assets.get('/assets/'+release);
  if(!current||sha(current.bytes)!==releaseSha)throw new Error('Rahoo design bundle differs from the verified release '+release);
  const html=assets.get('/')?.bytes.toString('utf8');
  if(!html?.includes('/assets/'+entry))throw new Error('Rahoo HTML does not reference the verified entry '+entry);
  const main=assets.get('/assets/'+entry)?.bytes.toString('utf8');
  if(!main?.includes('/design-tool')||!main.includes('./'+release))throw new Error('Rahoo entry does not reference the verified design bundle');
}
export async function syncRahoo(directory=defaultCache){
  const manifest={origin,release,sha256:pinned};
  const existing=await stat(directory).catch(error=>{
    if(error.code==='ENOENT')return null;
    throw error;
  });
  if(existing){
    await loadRahoo(directory);
    return JSON.parse(await readFile(join(directory,'manifest.json'),'utf8'));
  }
  const downloads=await Promise.all(files.map(async name=>{
    const path=pathFor(name),url=origin+path;
    const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(30000)});
    if(!response.ok)throw new Error('Rahoo asset '+path+' returned HTTP '+response.status);
    const type=response.headers.get('content-type')??'';
    if(name.endsWith('.js')&&!/javascript/.test(type))throw new Error('Expected JavaScript for '+path+', received '+type);
    const bytes=Buffer.from(await response.arrayBuffer());
    if(sha(bytes)!==pinned[name])throw new Error('Official Rahoo asset differs from the verified release '+path);
    return [path,{bytes,name}];
  }));
  const assets=new Map(downloads);
  verifyRelease(assets);
  await mkdir(dirname(resolve(directory)),{recursive:true});
  await mkdir(directory);
  for(const {name,bytes} of assets.values())await writeFile(join(directory,name),bytes);
  await writeFile(join(directory,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  return manifest;
}
export async function loadRahoo(directory=defaultCache){
  let manifest;
  try{manifest=JSON.parse(await readFile(join(directory,'manifest.json'),'utf8'));}
  catch(error){
    if(error.code==='ENOENT')throw new Error('Rahoo cache is missing. Run node tools/design.mjs rahoo-sync '+directory);
    throw error;
  }
  if(manifest.origin!==origin||manifest.release!==release)throw new Error('Invalid Rahoo cache manifest');
  const available=files.filter(name=>!Object.hasOwn(browserAssets,name)||Object.hasOwn(manifest.sha256??{},name));
  const assets=new Map(await Promise.all(available.map(async name=>{
    const bytes=await readFile(join(directory,name));
    if(manifest.sha256?.[name]!==pinned[name]||sha(bytes)!==pinned[name])throw new Error('Cached Rahoo asset failed its hash check '+name);
    return [pathFor(name),{bytes,type:mime[name.split('.').at(-1)]}];
  })));
  verifyRelease(assets);
  return assets;
}

// These offsets are UTF-16 source offsets in the hash-checked public release.
// The inserted expressions expose existing closure state to the private browser session.
const bindings={
  concentricCircle:[9365,{params:'f'},{exportScale:'I'}],
  halftone:[27437,{params:'y'},{exportScale:'B'}],
  hudLines:[71569,{params:'T.params'},{exportScale:'I'}],
  scaleCircle:[85784,{params:'P.params'},{exportScale:'I'}],
  barcode:[101138,{barcode:'he',spectrum:'R',ruler:'ee'},{mode:'B',barcodeScale:'Pe',spectrumScale:'I',rulerScale:'D'}],
  waveTexture:[115463,{params:'T'},{exportScale:'I'}],
  linePattern:[124447,{params:'ne'},{}],
  dotMatrix:[157309,{params:'g'},{paths:'Ie',exportScale:'N'}],
  polygonGrid:[183991,{params:'z',selection:'g'},{exportScale:'B'}],
  contourPro:[226360,{params:'I',cameraPosition:'B',cameraRotation:'N'},{exportScale:'ye'}],
  contour:[247666,{params:'W',levelStyles:'y'},{mode:'ne',exportScale:'f'}],
  normalShape:[271429,{params:'D',slant:'N',brackets:'P',cross:'Z',plus:'Ae',star:'he'},{exportScale:'W'}],
  nestedPolygons:[303911,{params:'f',timeline:'J'},{time:'ae',videoSize:'G',fps:'w',videoBackground:'l',exportScale:'I'}],
  globeSphere:[315783,{params:'f'},{exportScale:'I'}],
  squareGrid:[330088,{params:'Z'},{fills:'he',preset:'W',exportScale:'N'}],
  rays:[358378,{params:'C'},{exportScale:'B'}],
  y2kRing:[377102,{params:'P'},{exportScale:'I'}],
  ringArray:[392857,{params:'f'},{exportScale:'I'}],
  fakeCode:[405335,{params:'f'},{exportScale:'I'}],
  ascii:[416082,{params:'z'},{exportScale:'I'}],
  dynamicLight:[432847,{params:'D'},{loopDuration:'K',exportScale:'ye'}]
};
export const rahooGenerators=Object.keys(bindings).filter(name=>name!=='contourPro');
export function rahooSettingGroups(generator){
  const [,objects,refs]=bindings[generator];
  return [...Object.keys(objects),...Object.keys(refs)];
}
export function exposeRahooSettings(bytes){
  if(sha(bytes)!==releaseSha)throw new Error('Refusing to instrument an unverified Rahoo build');
  let text=bytes.toString('utf8');
  for(const [generator,[offset,objects,refs]] of Object.entries(bindings).sort((a,b)=>b[1][0]-a[1][0])){
    if(!text.startsWith('return',offset))throw new Error('Rahoo setting offset no longer matches '+generator);
    const objectFields=Object.entries(objects).map(([name,expression])=>name+':()=>'+expression);
    const refFields=Object.entries(refs).map(([name,ref])=>name+':{get:()=>'+ref+'.value,set:value=>'+ref+'.value=value}');
    const custom=generator==='squareGrid'?';globalThis.__rahooSettings.squareGrid.applyPreset=y':
      generator==='nestedPolygons'?';globalThis.__rahooSettings.nestedPolygons.applyTime=fe':
      generator==='dynamicLight'?';globalThis.__rahooSettings.dynamicLight.applyTime=value=>{g=value;C()}':'';
    text=text.slice(0,offset)+';globalThis.__rahooSettings.'+generator+'={objects:{'+objectFields+
      '},refs:{'+refFields+'}}'+custom+';'+text.slice(offset);
  }
  return Buffer.from(text);
}
