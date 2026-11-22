import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {dirname,resolve,join} from 'node:path';
import {basicRahooSpec,runRahoo} from './rahoo.mjs';
import {rahooGenerators,release} from './rahoo-release.mjs';

const checksum=data=>data===undefined?null:createHash('sha256').update(data).digest('hex');
const hashes=result=>({png:checksum(result.png===undefined?undefined:Buffer.from(result.png,'base64')),svg:checksum(result.svg),size:result.size});
const exact=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const viewport={width:1040,height:690};
const automatedCases={
  concentricCircle:{params:{count:12}},
  halftone:{params:{spacing:32,shape:'diamond',strokeOnly:true,strokeAlign:'outer'}},
  hudLines:{params:{shapeMode:'line',notchEnable:true,grooveWidth:70,grooveDepth:20}},
  scaleCircle:{params:{count:120,majorInterval:5,rayLength:36}},
  barcode:{mode:'spectrum',spectrum:{count:120,maxH:102}},
  waveTexture:{params:{spacing:23,amplitude:34}},
  linePattern:{params:{direction:'diagonal',angle:32,range:'ring',ringOuter:200,ringInner:65}},
  dotMatrix:{params:{range:'finite',rows:6,cols:10,shape:'square',strokeOnly:true,cornerRadius:18}},
  polygonGrid:{params:{shape:'hexagonV',side:34}},
  contour:{params:{contourLevels:13,roughness:.55}},
  normalShape:{params:{shape:'star4'},star:{mode:'bezier',width:155,height:120}},
  nestedPolygons:{params:{sides:4},timeline:{duration:2,tracks:[{param:'rotationStep',keys:[{t:0,v:-2},{t:2,v:-11}]}]},time:1.5},
  globeSphere:{params:{meridians:6,parallels:4,latTilt:13}},
  squareGrid:{preset:'preset2'},
  rays:{params:{mode:'random',count:48,startCap:'round',endCap:'pointed'}},
  y2kRing:{params:{tilt:-35}},
  ringArray:{params:{shape:'hexagon',count:64}},
  fakeCode:{params:{lines:12,blockColsMin:24,blockColsMax:90}},
  ascii:{params:{preset:'custom',charset:' .:-=+*#%@',cols:90,colorMode:'mono',fg:'#2446ff'}},
  dynamicLight:{params:{effect:'flame',angle:90,colorMode:'gradient',color1:'#fb7339',color2:'#2728f3'}}
};
const stage=(generator,extra={})=>({...basicRahooSpec(generator),...viewport,
  ...(generator==='dynamicLight'?{frameMs:700}:{}),...extra});
const fixtureImage='<svg xmlns="http://www.w3.org/2000/svg" width="200" height="140" viewBox="0 0 200 140">'+
  '<rect width="200" height="140" fill="white"/><circle cx="82" cy="70" r="49" fill="#121d32"/>'+
  '<rect x="96" y="47" width="62" height="46" fill="#2446ff"/></svg>';
export async function verifyRahoo(runtime, reportPath){
  const folder=dirname(resolve(reportPath));
  await mkdir(folder,{recursive:true});
  const sourceFixture=join(folder,'rahoo-test-image.svg');
  await writeFile(sourceFixture,fixtureImage);
  const results=[];
  async function verify(label,fn){
    try{results.push({case:label,passed:true,...await fn()});}
    catch(error){results.push({case:label,passed:false,error:String(error.message).slice(0,1200)});}
    console.log(results.at(-1).passed?'PASS '+label:'FAIL '+label+' '+results.at(-1).error);
  }
  for(const generator of rahooGenerators){
    await verify(generator,async()=>{
      const input=stage(generator,generator==='ascii'?{actions:[{do:'upload',selector:'.dt-tool input[type=file]',file:'rahoo-test-image.svg'}]}:{});
      const original=hashes(await runRahoo(runtime,input,{hook:false,root:folder}));
      const native=hashes(await runRahoo(runtime,input,{root:folder}));
      if(!exact(original,native))throw new Error('Native stage or SVG hash differs from the original build');
      const modified=hashes(await runRahoo(runtime,{...input,settings:automatedCases[generator]},{root:folder}));
      if(exact(modified,native))throw new Error('Changed settings produced identical output');
      return {original,native,modified,nativeFormats:[...(native.svg?['svg']:[]),...(native.png?['png']:[])]};
    });
  }
  await verify('contour-pro-native-3d',async()=>{
    const ui=stage('contour',{actions:[{do:'click',text:'3D地形'}]});
    const original=await runRahoo(runtime,ui,{hook:false});
    const native=await runRahoo(runtime,stage('contour',{settings:{mode:'pro'}}));
    if(!exact(hashes(original),hashes(native)))throw new Error('3D projection differs from selecting 3D terrain in the original controls');
    await writeFile(join(folder,'contour-pro.png'),Buffer.from(native.png,'base64'));
    return {original:hashes(original),native:hashes(native)};
  });
  await verify('barcode-spectrum-ui-equivalence',async()=>{
    const original=hashes(await runRahoo(runtime,stage('barcode',{actions:[{do:'click',text:'频谱线'}]}),{hook:false}));
    const native=hashes(await runRahoo(runtime,stage('barcode',{settings:{mode:'spectrum'}})));
    if(!exact(original,native))throw new Error('Spectrum mode differs from selecting it in the original controls');
    return {original,native};
  });
  await verify('barcode-ruler-ui-equivalence',async()=>{
    const original=hashes(await runRahoo(runtime,stage('barcode',{actions:[{do:'click',text:'尺规刻度'}]}),{hook:false}));
    const native=hashes(await runRahoo(runtime,stage('barcode',{settings:{mode:'ruler'}})));
    if(!exact(original,native))throw new Error('Ruler mode differs from selecting it in the original controls');
    return {original,native};
  });
  await verify('concentric-circle-ui-equivalence',async()=>{
    const count='.dt-sidebar .el-input-number input';
    const original=hashes(await runRahoo(runtime,stage('concentricCircle',{actions:[
      {do:'fill',selector:count,value:'12'},{do:'press',selector:count,key:'Tab'}]}),{hook:false}));
    const native=hashes(await runRahoo(runtime,stage('concentricCircle',{settings:{params:{count:12}}})));
    if(!exact(original,native))throw new Error('Native count differs from editing the original count control');
    return {original,native};
  });
  await verify('dynamic-light-time',async()=>{
    const late=await runRahoo(runtime,stage('dynamicLight',{frameMs:1230}));
    const original=await runRahoo(runtime,stage('dynamicLight',{frameMs:1230}),{hook:false});
    if(!exact(hashes(late),hashes(original)))throw new Error('Fixed time differs from the original WebGL canvas');
    const early=await runRahoo(runtime,stage('dynamicLight',{frameMs:700}));
    if(late.png===early.png)throw new Error('Changing time produced the same WebGL frame');
    await writeFile(join(folder,'dynamic-light.png'),Buffer.from(late.png,'base64'));
    return {original:hashes(original),native:hashes(late)};
  });
  await verify('dynamic-light-webm-export',async()=>{
    const result=await runRahoo(runtime,stage('dynamicLight',{frameMs:undefined,settings:{loopDuration:1},
      actions:[{do:'click',text:'导出 WebM'}],download:{text:'录制',timeout:30000}}));
    if(result.download.subarray(0,4).toString('hex')!=='1a45dfa3')throw new Error('Invalid WebM container');
    return {filename:result.name,bytes:result.download.length,sha256:checksum(result.download)};
  });
  const animated=stage('nestedPolygons',{settings:{params:{sides:4,maxRadius:86,radiusStep:7,layers:12},
    timeline:{duration:.5,tracks:[{param:'rotationStep',keys:[{t:0,v:-2},{t:.5,v:-18}]}]},
    videoSize:240,fps:12,videoBackground:'#152233'},actions:[{do:'click',text:'动画'}]});
  await verify('nested-polygons-gif-export',async()=>{
    const baseline=await runRahoo(runtime,{...animated,download:{text:'导出 GIF',timeout:35000}});
    const repeat=await runRahoo(runtime,{...animated,download:{text:'导出 GIF',timeout:35000}});
    if(!/^GIF8[79]a$/.test(baseline.download.subarray(0,6).toString()))throw new Error('Invalid GIF header');
    if(!baseline.download.equals(repeat.download))throw new Error('Native GIF export changed with identical keyframes');
    return {filename:baseline.name,bytes:baseline.download.length,sha256:checksum(baseline.download)};
  });
  await verify('nested-polygons-mp4-export',async()=>{
    const result=await runRahoo(runtime,{...animated,download:{text:'导出视频',timeout:35000}});
    if(result.download.subarray(4,8).toString()!=='ftyp')throw new Error('Invalid MP4 container');
    return {filename:result.name,bytes:result.download.length,sha256:checksum(result.download)};
  });
  await verify('ascii-native-text-export',async()=>{
    const input=stage('ascii',{actions:[{do:'upload',selector:'.dt-tool input[type=file]',file:'rahoo-test-image.svg'}],
      download:{text:'导出 TXT',timeout:20000}});
    const result=await runRahoo(runtime,input,{root:folder});
    const original=await runRahoo(runtime,input,{root:folder,hook:false});
    if(!result.download.toString('utf8').trim()||!result.download.equals(original.download))throw new Error('ASCII export differs from the original');
    return {filename:result.name,bytes:result.download.length,sha256:checksum(result.download)};
  });
  const report={release,browser:runtime.browser.version(),platform:process.platform,viewport,
    verifiedAt:new Date().toISOString(),passed:results.filter(result=>result.passed).length,total:results.length,results};
  await writeFile(reportPath,JSON.stringify(report,null,2)+'\n');
  return report;
}
