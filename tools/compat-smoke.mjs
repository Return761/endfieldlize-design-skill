import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {join,relative,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const cwd=fileURLToPath(new URL('../',import.meta.url));
const [label,flag]=process.argv.slice(2);
if(!/^[a-z][a-z0-9-]{0,47}$/.test(label??'')||(flag&&flag!=='--no-browser')){
  console.error('Usage: node tools/compat-smoke.mjs <run-label> [--no-browser]');
  process.exit(1);
}
const out=join(cwd,'.design','compat-'+label);
mkdirSync(out,{recursive:true});
const read=file=>readFileSync(resolve(cwd,file),'utf8');
const sha=file=>createHash('sha256').update(read(file)).digest('hex');
const input='examples/sinewave/dial.json',preset=join(out,'preset.json'),original=join(out,'dial.svg');
const changed=join(out,'edited.json'),edited=join(out,'edited.svg');
const report={label,version:1,environment:process.platform+' / '+process.version,referenceReads:{},files:{},browser:'not-run'};
function cli(...args){
  return execFileSync(process.execPath,['tools/design.mjs',...args],{cwd,encoding:'utf8',timeout:75000,windowsHide:true,stdio:['ignore','pipe','pipe']});
}
for(const [name,reference] of [
  ['design-exploration','method.md'],['graphic-composition','graphics.md'],['design-evaluation','evidence.md']
]){
  const entry='.agents/skills/'+name+'/SKILL.md';
  const path='.agents/skills/'+name+'/references/'+reference;
  if(!read(entry).includes('(references/'+reference+')'))throw new Error('Missing reference link in '+entry);
  report.referenceReads[name]={skillSha256:sha(entry),referenceSha256:sha(path)};
}
cli('validate',input);
cli('preset',input,preset);
cli('generate',preset,original);
const config=JSON.parse(read(preset));
config.layers.find(l=>l.generator==='scaleCircle').params.majorInterval=7;
writeFileSync(changed,JSON.stringify(config,null,2)+'\n');
cli('validate',changed);
cli('generate',changed,edited);
report.files.dial=sha(original);
report.files.edited=sha(edited);
if(report.files.dial===report.files.edited)throw new Error('Edited configuration did not alter the SVG');
const build=join(out,'prototype');
try{
  mkdirSync(build);
  // Use a unique child on every run so the CLI can exercise creation and leave prior evidence intact.
}catch(error){if(error.code!=='EEXIST')throw error;}
const version=join(build,'run-'+Date.now()+'-'+process.pid);
cli('prototype','examples/sinewave/prototype.json',version);
report.files.prototypeDial=sha(join(version,'assets/dial.svg'));
if(report.files.prototypeDial!==report.files.dial)throw new Error('Prototype used a different graphic');
if(flag){
  report.browser='skipped by --no-browser';
}else{
  const browserOut=join(out,'browser');
  try{cli('test','examples/sinewave/prototype.json',browserOut);report.browser='passed';}
  catch(error){report.browser='failed or unavailable';report.browserError=String(error.stderr??error.message).trim();process.exitCode=1;}
  report.evaluation=relative(cwd,join(browserOut,'evaluation.json')).split('\\').join('/');
}
writeFileSync(join(out,'smoke.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
