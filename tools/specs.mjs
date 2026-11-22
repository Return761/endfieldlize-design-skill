import Ajv2020 from 'ajv/dist/2020.js';
import {readFileSync} from 'node:fs';
const kinds=['InteractionSpec','CompositionSpec','PrototypeSpec','EvaluationReport'];
const ajv=new Ajv2020({strict:false,allErrors:true});
const validators=Object.fromEntries(kinds.map(kind=>[kind,ajv.compile(JSON.parse(readFileSync(
  new URL('../schemas/'+kind+'.schema.json',import.meta.url),'utf8')))]));
function unique(items,key,label){
  const seen=new Set();
  for(const item of items){
    if(seen.has(item[key]))throw new Error('Duplicate '+label+' '+item[key]);
    seen.add(item[key]);
  }
  return seen;
}
function references(set,ids,label){
  for(const id of ids)if(!set.has(id))throw new Error('Unknown '+label+' '+id);
}
export function validateSpec(doc,kind=doc?.kind){
  if(!Object.hasOwn(validators,kind))throw new Error('Unknown document kind '+kind);
  const check=validators[kind];
  if(!check(doc))throw new Error(kind+' '+ajv.errorsText(check.errors,{separator:' | '}));
  if(kind==='InteractionSpec'){
    const entities=unique(doc.entities,'id','entity');
    const states=unique(doc.states,'id','state');
    unique(doc.jobs,'id','job');
    references(entities,doc.relations.flatMap(item=>[item.from,item.to]),'entity');
    references(states,[doc.initialState,...doc.transitions.flatMap(item=>[item.from,item.to])],'state');
    references(unique(doc.alternatives,'id','alternative'),[doc.chosen],'alternative');
  }
  if(kind==='CompositionSpec')unique(doc.layers,'id','layer');
  if(kind==='PrototypeSpec'){
    const views=unique(doc.viewports,'name','viewport');
    unique(doc.pages,'id','page');
    unique(doc.graphicAssets,'output','asset output');
    unique(doc.tests,'id','test');
    for(const test of doc.tests){
      references(views,new Set(test.viewports??[]),'test viewport');
      if(test.viewports)unique(test.viewports.map(id=>({id})),'id','test viewport');
      unique(test.steps.filter(step=>step.action==='capture'),'name','capture');
    }
  }
  if(kind==='EvaluationReport'){
    unique(doc.entries,'id','entry');
    const states={automated:['passed','failed','skipped'],reviewer:['observed'],unverified:['pending']};
    for(const entry of doc.entries)if(!states[entry.kind].includes(entry.status))throw new Error('Invalid evidence status for '+entry.id);
  }
  return doc;
}
