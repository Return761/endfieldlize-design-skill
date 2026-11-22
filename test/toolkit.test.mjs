import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp,realpath,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {addGenerators,builtins,normalizeGraphics,renderGraphics} from '../tools/graphics/index.mjs';
import {tag,integer} from '../tools/graphics/options.mjs';
import {exportPrototype,loadPrototype,readJson} from '../tools/prototype.mjs';
import {validateSpec} from '../tools/specs.mjs';

const doc=(name,params={},seed=17)=>({kind:'GraphicSpec',version:1,width:512,height:384,seed,layers:[{generator:name,params}]});
test('all 20 reference tools and nine primitives produce deterministic SVG',()=>{
  const refs=Object.values(builtins).filter(entry=>entry.origin==='rahoo.online');
  assert.equal(refs.length,20);
  assert.equal(Object.keys(builtins).length-refs.length,9);
  for(const name of Object.keys(builtins)){
    const input=doc(name),a=renderGraphics(input),b=renderGraphics(normalizeGraphics(input));
    assert.equal(a,b,name);
    assert.match(a,new RegExp('data-generator="'+name+'"'),'missing layer '+name);
    assert.doesNotMatch(a,/NaN|Infinity|undefined/,name);
    assert.ok(/<(?:path|circle|ellipse|polygon|line|polyline|text|pattern|filter|rect)\b/.test(a.slice(a.indexOf('data-generator='))),name);
  }
});
test('seeded generators change when the seed changes',()=>{
  for(const name of ['fakeCode','contour','barcode','polygonGrid','dynamicLight']){
    assert.notEqual(renderGraphics(doc(name,{},37)),renderGraphics(doc(name,{},28)),name);
  }
});
test('reference variants use mixed fills, custom stamps and terrain editing',()=>{
  const grid=renderGraphics(doc('squareGrid',{fills:[{column:0,row:0,mode:'dots'},{column:1,row:0,mode:'lines'}]}));
  assert.match(grid,/fill="url\(#g0-dots\)"/);
  assert.match(grid,/fill="url\(#g0-lines\)"/);
  const stamp={stampPaths:['M 0 0 L 100 25 L 25 100 Z'],stars:[{satellite:true}]};
  const ring=renderGraphics(doc('y2kRing',stamp));
  assert.equal((ring.match(/M 0 0 L 100 25 L 25 100 Z/g)??[]).length,2);
  const terrain={mode:'pro',viewMode:'profile',brushes:[{x:.4,y:.5}],brushStrength:.27};
  assert.notEqual(renderGraphics(doc('contour',{...terrain,toolMode:'raise'})),
    renderGraphics(doc('contour',{...terrain,toolMode:'lower'})));
  const dots=renderGraphics(doc('halftone',{sampleImageColor:true,maskShape:'image',pixels:[[[255,75,31,255]]]}));
  assert.match(dots,/fill="rgb\(255,75,31\)"/);
});
test('invalid values and cross-field errors fail without changing caller config',()=>{
  const invalid=doc('halftone',{spacing:'15'});
  assert.throws(()=>normalizeGraphics(invalid),/number/);
  assert.deepEqual(invalid.layers[0].params,{spacing:'15'});
  assert.throws(()=>normalizeGraphics(doc('scaleCircle',{noSuchParam:1})),/additional properties/);
  assert.throws(()=>normalizeGraphics(doc('concentricCircle',{minRadius:90,maxRadius:40})),/minRadius must be <= maxRadius/);
  assert.throws(()=>normalizeGraphics(doc('toString')),/Unknown generator/);
  assert.throws(()=>normalizeGraphics(doc('arcs',{color:'url(https://example.invalid/foo)'})),/pattern/);
});
test('independent generator modules can define options and use scoped ids',()=>{
  const plugin={name:'waveset',options:{count:integer(2,1,8)},draw:(p,ctx)=>tag('path',{id:ctx.id('layer'),'data-count':p.count,d:'M0 0 L1 1'})};
  const catalog=addGenerators([[plugin]]);
  const input=doc('waveset');
  input.layers.push({generator:'waveset',params:{count:8}});
  const svg=renderGraphics(input,catalog);
  assert.match(svg,/id="g0-layer" data-count="2"/);
  assert.match(svg,/id="g1-layer" data-count="8"/);
  assert.throws(()=>addGenerators([[plugin,plugin]]),/duplicate/);
});
test('prototype export retains input specs, generated assets and an editable source copy',async()=>{
  const temp=await mkdtemp(join(tmpdir(),'toolkit-test-'));
  try{
    const out=join(temp,'export');
    const project=await loadPrototype('examples/sinewave/prototype.json');
    await exportPrototype(project,out);
    const manifest=await readJson(join(out,'export-manifest.json'));
    assert.match(manifest.sha256['assets/dial.svg'],/^[a-f0-9]{64}$/);
    assert.equal(await realpath(join(out,manifest.entry)),await realpath(join(out,'index.html')));
    assert.match(await readFile(join(out,'assets/dial.svg'),'utf8'),/concentricCircle/);
    await loadPrototype(join(out,manifest.editableSpec));
    await assert.rejects(exportPrototype(project,out),{code:'EEXIST'});
  }finally{await rm(temp,{recursive:true,force:true});}
});
test('design schemas enforce relationship IDs and evidence classes',async()=>{
  const doc=await readJson('examples/conversation-atlas/interaction.json');
  assert.equal(validateSpec(doc).alternatives.length,3);
  assert.throws(()=>validateSpec({...doc,chosen:'missing'}),/Unknown alternative/);
  assert.throws(()=>validateSpec({kind:'EvaluationReport',version:1,target:'Test',runAt:'2026-11-22T00:00:00Z',environment:'Node',artifacts:[],
    entries:[{id:'test',kind:'reviewer',status:'passed',claim:'A claim',evidence:[]}]}),/Invalid evidence status/);
});
