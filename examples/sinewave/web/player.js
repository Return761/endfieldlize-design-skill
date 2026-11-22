import {sampleRate,synthesize,tracks} from './synthesis.js';

const el=id=>document.getElementById(id);
const get=(...ids)=>ids.map(el);
const [media,play,seek,volume,elapsed,duration,trackTitle,artist,status,mode,volumeValue,error]=
  get('audio','play','seek','volume','elapsed','duration','track-title','track-artist','track-status','scope-mode','volume-value','error');
const [plot,list,overview,trace,echo,mute]=get('plot','track-list','overview','trace-line','trace-echo','mute');
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
const scopeData=new Float32Array(1024);
const svg='http://www.w3.org/2000/svg';
const format=t=>Math.floor(t/60)+':'+String(Math.floor(t%60)).padStart(2,'0');
const indexLabel=i=>String(i+1).padStart(2,'0');
let selected=0,current,sourceUrl,context,analyser,frame=0,selectionRevision=0;
let previousTrace='';

function showError(message){
  error.textContent=message;
  error.hidden=message.length===0;
}
function drawTrace(values,offset=0,step=1){
  const count=150;
  let d='';
  for(let j=0;j<count;j++){
    const v=values[Math.min(values.length-1,offset+j*step)]??0;
    d+=(j?' L ':'M ')+(j*600/(count-1)).toFixed(2)+' '+(170-v*230).toFixed(2);
  }
  trace.setAttribute('d',d);
  echo.setAttribute('d',previousTrace||d);
  previousTrace=d;
}
function buffered(){
  if(!current)return;
  const origin=Math.max(0,Math.min(current.samples.length-750,Math.floor(media.currentTime*sampleRate)+2048));
  drawTrace(current.samples,origin,5);
}
function animate(){
  if(media.paused||reducedMotion.matches){frame=0;return;}
  if(analyser){
    analyser.getFloatTimeDomainData(scopeData);
    drawTrace(scopeData,0,5);
  }else buffered();
  frame=requestAnimationFrame(animate);
}
function syncTransport(){
  const playing=!media.paused&&!media.ended;
  el('play-glyph').textContent=playing?'Ⅱ':'▶';
  play.setAttribute('aria-label',playing?'Pause':'Play');
  el('mute').setAttribute('aria-label',media.muted?'Unmute':'Mute');
  mute.setAttribute('aria-pressed',String(media.muted));
  mute.classList.toggle('muted',media.muted);
  volumeValue.textContent=media.muted?'MUTED':Math.round(media.volume*100)+'%';
  status.textContent=(playing?'PLAYING':'CUED')+' / '+indexLabel(selected);
  mode.textContent=playing&&analyser&&!reducedMotion.matches?'LIVE SIGNAL':'BUFFERED';
  if(playing&&!frame&&!reducedMotion.matches)frame=requestAnimationFrame(animate);
  if(!playing||reducedMotion.matches){
    if(frame)cancelAnimationFrame(frame);
    frame=0;
    buffered();
  }
}
function syncPosition(){
  const total=Number.isFinite(media.duration)?media.duration:tracks[selected].seconds;
  const t=Number.isFinite(media.currentTime)?media.currentTime:0;
  seek.max=String(total);
  if(document.activeElement!==seek||!seek.matches(':active'))seek.value=String(t);
  seek.setAttribute('aria-valuetext',format(t)+' of '+format(total));
  elapsed.textContent=format(t);duration.textContent=format(total);
  seek.parentElement.style.setProperty('--progress',(100*t/total)+'%');
  if(media.paused||reducedMotion.matches)buffered();
}
function renderOverview(){
  const max=Math.max(.01,...current.peaks),nodes=[];
  for(const [j,value] of current.peaks.entries()){
    const h=Math.max(1,value/max*32);
    const bar=document.createElementNS(svg,'rect');
    bar.setAttribute('x',String(j*6));bar.setAttribute('y',String((34-h)/2));
    bar.setAttribute('width','3.5');bar.setAttribute('height',String(h));
    nodes.push(bar);
  }
  overview.replaceChildren(...nodes);
}
async function start(){
  const revision=selectionRevision;
  showError('');
  try{
    if(!context&&globalThis.AudioContext){
      context=new AudioContext();
      analyser=context.createAnalyser();
      analyser.fftSize=scopeData.length;
      context.createMediaElementSource(media).connect(analyser).connect(context.destination);
    }
    if(context?.state==='suspended')await context.resume();
    if(revision===selectionRevision)await media.play();
  }catch(e){
    if(revision===selectionRevision&&e.name!=='AbortError')showError('Playback could not start. Press Play to retry.');
  }
}
function select(index,keepPlaying){
  selectionRevision++;
  selected=(index+tracks.length)%tracks.length;
  const track=tracks[selected];
  showError('');
  media.pause();
  current=synthesize(track);
  const last=sourceUrl;
  sourceUrl=URL.createObjectURL(current.blob);
  media.src=sourceUrl;
  if(last)URL.revokeObjectURL(last);
  trackTitle.textContent=track.title;
  artist.textContent=track.artist;
  el('tempo').firstChild.nodeValue=String(track.bpm).padStart(3,'0')+' ';
  el('key').textContent=track.key.toUpperCase();
  previousTrace='';
  renderOverview();
  for(const button of document.querySelectorAll('[data-track]')){
    button.setAttribute('aria-pressed',String(Number(button.dataset.track)===selected));
  }
  syncTransport();
  syncPosition();
  if(keepPlaying)void start();
}
tracks.forEach((track,index)=>{
  const trackButton=className=>{
    const btn=document.createElement('button');
    btn.type='button';btn.className=className;btn.dataset.track=index;
    btn.setAttribute('aria-label',track.title+', '+track.artist+', '+track.bpm+' beats per minute');
    btn.setAttribute('aria-pressed','false');
    btn.addEventListener('click',()=>select(index,!media.paused));
    return btn;
  };
  const marker=trackButton('map-node');
  marker.style.setProperty('--x',((track.bpm-60)/90*100)+'%');
  marker.style.setProperty('--y',((1-track.texture)*100)+'%');
  marker.title=track.title+' · '+track.bpm+' BPM';
  marker.textContent=indexLabel(index);
  plot.append(marker);
  const item=document.createElement('li'),row=trackButton('track-row');
  for(const [value,className] of [[indexLabel(index),'track-detail'],[track.title,'track-name'],
    [String(track.bpm),'track-detail'],[format(track.seconds),'track-detail']]){
    const cell=document.createElement('span');
    cell.className=className;cell.textContent=value;
    if(className==='track-name'){
      const by=document.createElement('small');by.textContent=track.artist;cell.append(by);
    }
    row.append(cell);
  }
  list.append(item);
  item.append(row);
});
el('track-count').textContent=tracks.length+' TRACKS';
el('previous').onclick=()=>select(selected-1,!media.paused);
el('next').onclick=()=>select(selected+1,!media.paused);
play.onclick=()=>media.paused?void start():media.pause();
mute.onclick=()=>{media.muted=!media.muted;syncTransport();};
volume.oninput=()=>{media.volume=Number(volume.value);media.muted=false;syncTransport();};
seek.oninput=()=>{if(Number.isFinite(media.duration))media.currentTime=Number(seek.value);syncPosition();};
media.addEventListener('ended',()=>select(selected+1,true));
media.addEventListener('error',()=>showError('This track could not be loaded. Choose another track to continue.'));
for(const event of ['play','pause','volumechange'])media.addEventListener(event,syncTransport);
for(const event of ['loadedmetadata','timeupdate','seeked'])media.addEventListener(event,syncPosition);
reducedMotion.addEventListener('change',syncTransport);
media.volume=Number(volume.value);
select(0,false);
