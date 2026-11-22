#!/usr/bin/env node
import {parseArgs} from 'node:util';
import {dirname,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {builtins,addGenerators,normalizeGraphics,renderGraphics} from './graphics/index.mjs';
import {validateSpec} from './specs.mjs';
import {readJson,save,writeJson,loadPrototype,buildPrototype,exportPrototype,preview,rasterize,runBrowser,serve} from './prototype.mjs';
import {defaultCache,rahooGenerators,syncRahoo} from './rahoo-release.mjs';
import {basicRahooSpec,normalizeRahooSpec,openRahooBrowser,renderRahooFile,runRahoo} from './rahoo.mjs';
import {verifyRahoo} from './rahoo-verify.mjs';

const help=`node tools/design.mjs <command>
  catalog [generator]                     List generators or parameter schemas
  validate <input.json>                   Validate a graphic or design document
  generate <spec.json> <output>          Render GraphicSpec SVG or native RahooSpec output
  preset <graphic.json> <output.json>     Save normalized generator options
  preview <graphic.json> <output.png>     Render a PNG using Chromium
  raster <image> <pixels.json>            Sample RGBA for image-driven graphics
  prototype <prototype.json> <new-dir>    Build a static interactive prototype
  serve <built-dir> [port]                Serve on loopback (default 4173)
  screenshot <prototype.json> <out-dir>   Capture viewport baselines
  test <prototype.json> <out-dir>         Exercise interactions and save evidence
  export <prototype.json> <new-dir>       Package app, specs and SHA-256 manifest
  rahoo-sync [cache-dir]                 Fetch the pinned official release once
  rahoo-inspect <generator|spec.json>    List native settings and output formats
  rahoo-verify <report.json>             Compare the native renderer with the unchanged official build
Options: --plugin <local.mjs> (repeatable)  --browser <executable>  --max-side <pixels> (raster)
  --source-cache <folder> (RahooSpec)  --help`;

async function main(){
  const {positionals:[command,input,output,...extra],values}=parseArgs({allowPositionals:true,
    options:{plugin:{type:'string',multiple:true},browser:{type:'string'},'max-side':{type:'string'},'source-cache':{type:'string'},help:{type:'boolean'}}});
  if(values.help||!command){console.log(help);return;}
  const arity={catalog:[0,1],validate:[1],generate:[2],preset:[2],preview:[2],raster:[2],prototype:[2],serve:[1,2],screenshot:[2],test:[2],export:[2],
    'rahoo-sync':[0,1],'rahoo-inspect':[1,2],'rahoo-verify':[1]};
  if(!Object.hasOwn(arity,command)||extra.length||!arity[command].includes([input,output].filter(Boolean).length))throw new Error(help);
  const cache=values['source-cache']??defaultCache;
  if(command==='rahoo-sync'){
    console.log(JSON.stringify(await syncRahoo(input??cache),null,2));
    return;
  }
  if(command==='rahoo-verify'){
    const runtime=await openRahooBrowser({cache,executable:values.browser});
    try{
      const report=await verifyRahoo(runtime,input);
      console.log(report.passed+'/'+report.total+' match, '+resolve(input));
      if(report.passed!==report.total)process.exitCode=1;
    }finally{await runtime.close();}
    return;
  }
  if(command==='rahoo-inspect'){
    const nameInput=rahooGenerators.includes(input);
    const spec=normalizeRahooSpec(nameInput?basicRahooSpec(input):await readJson(input));
    const runtime=await openRahooBrowser({cache,executable:values.browser});
    try{
      const result=await runRahoo(runtime,{...spec,download:undefined},{inspect:true,root:nameInput?process.cwd():dirname(resolve(input))});
      const {download,...inspection}=spec;
      const view={...inspection,settings:result.settings,...(result.proSettings?{proSettings:result.proSettings}:{})};
      if(output)await writeJson(output,view);
      console.log(JSON.stringify({formats:[...(result.svg?['svg']:[]),...(result.png?['png']:[])],spec:view},null,2));
    }finally{await runtime.close();}
    return;
  }
  const catalog=values.plugin?.length?addGenerators(await Promise.all(values.plugin.map(async file=>
    (await import(pathToFileURL(resolve(file)).href)).generators))):builtins;
  if(command==='catalog'){
    if(input&&!Object.hasOwn(catalog,input))throw new Error('Unknown generator '+input);
    const data=input?{origin:catalog[input].origin,options:catalog[input].options,constraints:catalog[input].constraints??[],
      nativeRahoo:rahooGenerators.includes(input)}:
      Object.entries(catalog).map(([generator,{origin,options}])=>({generator,origin,parameters:Object.keys(options).length,nativeRahoo:rahooGenerators.includes(generator)}));
    console.log(JSON.stringify(data,null,2));
    return;
  }
  if(command==='serve'){
    const port=output===undefined?4173:Number(output);
    if(!Number.isInteger(port)||port<0||port>65535)throw new Error('Invalid port');
    const server=await serve(input,port);
    console.log('Local '+server.url);
    process.once('SIGINT',()=>server.close());
    process.once('SIGTERM',()=>server.close());
    return;
  }
  if(command==='raster'){
    const limit=Number(values['max-side']??128);
    if(!Number.isInteger(limit)||limit<1||limit>384)throw new Error('--max-side must be an integer between 1 and 384');
    const pixels=await rasterize(input,limit,values.browser);
    await save(output,JSON.stringify(pixels)+'\n');
    console.log(resolve(output));
    return;
  }
  if(['prototype','screenshot','test','export'].includes(command)){
    const project=await loadPrototype(input);
    if(command==='prototype')await buildPrototype(project,output,catalog);
    else if(command==='export')await exportPrototype(project,output,catalog);
    else if(!await runBrowser(project,output,catalog,{mode:command,executable:values.browser}))process.exitCode=1;
    console.log(resolve(output));
    return;
  }
  const document=await readJson(input);
  if(document?.kind==='RahooSpec'){
    const spec=normalizeRahooSpec(document);
    if(command==='validate')console.log('Valid RahooSpec');
    else if(command==='preset')await writeJson(output,spec);
    else {
      const runtime=await openRahooBrowser({cache,executable:values.browser});
      try{await renderRahooFile(runtime,input,output);}
      finally{await runtime.close();}
      console.log(resolve(output));
    }
    return;
  }
  if(command==='validate'){
    if(document?.kind==='GraphicSpec')normalizeGraphics(document,catalog);
    else if(document?.kind==='PrototypeSpec')await loadPrototype(input);
    else validateSpec(document);
    console.log('Valid '+document.kind);
    return;
  }
  const spec=normalizeGraphics(document,catalog);
  if(command==='preset')await writeJson(output,spec);
  else {
    const svg=renderGraphics(spec,catalog);
    if(command==='preview')await preview(svg,{width:spec.width,height:spec.height},output,values.browser);
    else await save(output,svg);
  }
  console.log(resolve(output));
}

await main().catch(error=>{console.error(error.message);process.exitCode=1;});
