import Ajv from 'ajv';
import {radial} from './radial.mjs';
import {fields} from './fields.mjs';
import {contour} from './contour.mjs';
import {typographic} from './typographic.mjs';
import {primitives} from './primitives.mjs';
import {number, integer, color, list, object, random, rect, group, tag, string, esc} from './options.mjs';

const rahooNames=['concentricCircle','halftone','hudLines','scaleCircle','barcode','waveTexture','linePattern','dotMatrix','polygonGrid','contour','normalShape',
  'nestedPolygons','globeSphere','squareGrid','rays','y2kRing','ringArray','fakeCode','ascii','dynamicLight'];
const definitions={...radial,...fields,...typographic,contour,...primitives};
export const builtins=Object.freeze(Object.fromEntries([
  ...rahooNames,...Object.keys(definitions).filter(name=>!rahooNames.includes(name))
].map(name=>[name,{...definitions[name],origin:rahooNames.includes(name)?'rahoo.online':'toolkit'}])));
const seed = {anyOf:[{type:'string',maxLength:128},{type:'integer',minimum:0,maximum:2147483647}]};
const id = {type:'string',pattern:'^[a-zA-Z][a-zA-Z0-9_-]{0,63}$'};
const base = {...object({kind:{const:'GraphicSpec'},version:{const:1},width:integer(800,16,4096),height:integer(500,16,4096),
  seed:{...seed,default:1},background:color('transparent'),title:string(''),layers:{...list([],{
    ...object({id,generator:id,params:{type:'object',default:{}},x:number(0,-8192,8192),y:number(0,-8192,8192),
      rotation:number(0,-720,720),scale:number(1,.01,30),opacity:number(1,0,1),seed}),
    required:['generator']
  },48),minItems:1}}),required:['kind','version','layers']};
const ajv = new Ajv({useDefaults:true,allErrors:true,strict:false});
const validateBase=ajv.compile(base);
const optionsValidators=new WeakMap();
const validationError=(scope,fn)=>new Error(scope+' '+ajv.errorsText(fn.errors,{dataVar:'',separator:' | '}));

export function addGenerators(plugins=[]){
  const catalog={...builtins};
  for(const plugin of plugins){
    if(!Array.isArray(plugin))throw new Error('Plugin export must be an array of generator definitions');
    for(const entry of plugin){
      const {name,options,draw}=entry;
      if(!/^[a-z][a-zA-Z0-9-]{0,63}$/.test(name)||Object.hasOwn(catalog,name))throw new Error('Invalid or duplicate generator '+name);
      if(!options||typeof draw!=='function')throw new Error('Generator '+name+' needs options and draw');
      catalog[name]={...entry,origin:'local plugin'};
    }
  }
  return catalog;
}
export function normalizeGraphics(input,catalog=builtins){
  const copy=structuredClone(input);
  if(!validateBase(copy))throw validationError('GraphicSpec',validateBase);
  const ids=new Set();
  copy.layers.forEach((layer,j)=>{
    if(layer.id&&ids.has(layer.id))throw new Error('Duplicate layer id '+layer.id);
    if(layer.id)ids.add(layer.id);
    if(!Object.hasOwn(catalog,layer.generator))throw new Error('Unknown generator '+layer.generator);
    const def=catalog[layer.generator];
    if(!optionsValidators.has(def))optionsValidators.set(def,ajv.compile(object(def.options)));
    const validate=optionsValidators.get(def);
    if(!validate(layer.params))throw validationError('layers['+j+'].params',validate);
    for(const [min,max] of def.constraints??[]){
      if(layer.params[min]>layer.params[max])throw new Error(layer.generator+' '+min+' must be <= '+max);
    }
    def.validate?.(layer.params);
  });
  return copy;
}
export function renderGraphics(input,catalog=builtins){
  const doc=normalizeGraphics(input,catalog),{width:w,height:h}=doc;
  const layers=doc.layers.map((l,j)=>{
    const seed=String(l.seed??doc.seed)+':'+(l.id??j),key='g'+j+'-';
    const {draw}=catalog[l.generator];
    const svg=draw(l.params,{w,h,id:name=>key+name,seed,rng:random(seed)});
    if(typeof svg!=='string')throw new Error('Generator '+l.generator+' did not return SVG text');
    return group({'data-generator':l.generator,transform:'translate('+l.x+' '+l.y+') rotate('+l.rotation+') scale('+l.scale+')',opacity:l.opacity},svg);
  }).join('');
  const bg=rect(-w/2,-h/2,w,h,{fill:doc.background});
  return tag('svg',{xmlns:'http://www.w3.org/2000/svg',width:w,height:h,viewBox:[-w/2,-h/2,w,h].join(' '),overflow:'hidden',role:doc.title?'img':undefined},
    (doc.title?tag('title',{},esc(doc.title)):'')+bg+layers)+'\n';
}
