export const sampleRate = 22050;
export const tracks = [
  {title:'Glass Current',artist:'Phase Array',bpm:96,key:'D min',seconds:20,root:146.83,texture:.56,seed:61,notes:[0,7,12,3,0,10,7,5]},
  {title:'Low Orbit',artist:'Mira Vale',bpm:72,key:'A min',seconds:25,root:110,texture:.25,seed:91,notes:[0,12,7,3,0,5,7,10]},
  {title:'Contact Print',artist:'Static Bureau',bpm:121,key:'F min',seconds:16,root:174.61,texture:.76,seed:15,notes:[0,3,8,12,3,10,7,15]},
  {title:'An Index of Unfinished Transmissions',artist:'Northline Research Ensemble',bpm:105,key:'C min',seconds:18,root:130.81,texture:.36,seed:32,notes:[0,2,7,12,10,7,5,3]},
  {title:'Carrier Bloom',artist:'Phase Array',bpm:138,key:'E min',seconds:14,root:164.81,texture:.62,seed:8,notes:[0,12,15,7,0,19,15,10]}
];

const turn=2*Math.PI;
export function synthesize(track){
  const frames=sampleRate*track.seconds;
  const buffer=new ArrayBuffer(44+frames*4),varray=new DataView(buffer);
  const text=(offset,label)=>[...label].forEach((ch,i)=>varray.setUint8(offset+i,ch.charCodeAt(0)));
  const u32=(offset,value)=>varray.setUint32(offset,value,true);
  const u16=(offset,value)=>varray.setUint16(offset,value,true);
  text(0,'RIFF');u32(4,buffer.byteLength-8);text(8,'WAVE');text(12,'fmt ');u32(16,16);
  u16(20,1);u16(22,2);u32(24,sampleRate);u32(28,sampleRate*4);u16(32,4);u16(34,16);
  text(36,'data');u32(40,frames*4);
  const samples=new Float32Array(frames),peaks=new Float32Array(100);
  let rng=track.seed;
  for(let j=0;j<frames;j++){
    const t=j/sampleRate,beats=t*track.bpm/60,step=Math.floor(beats*2),d=beats*2-step,dBeat=beats%1;
    const root=track.root*2**(track.notes[step%track.notes.length]/12);
    const leadEnv=Math.min(1,d*80)*Math.exp(-d*(5.6-track.texture*2.8));
    const lead=(Math.sin(turn*root*t)*.19+Math.sin(turn*root*2*t+.9)*.045)*leadEnv;
    const bass=Math.sin(turn*track.root/2*t)*Math.exp(-2.4*dBeat)*.13;
    const kick=Math.sin(turn*(47*dBeat+2.5*(1-Math.exp(-dBeat*23))))*Math.exp(-dBeat*16)*track.texture*.34;
    const pad=(Math.sin(turn*track.root*.503*t)+Math.sin(turn*track.root*.749*t+.4*Math.sin(t)))*.045;
    rng=(Math.imul(1664525,rng)+1013904223)>>>0;
    const hat=((rng/4294967296)-.5)*Math.exp(-d*38)*track.texture*.17;
    const fade=Math.min(1,t*4,(track.seconds-t)*2.2);
    const mono=(lead+bass+kick+pad+hat)*fade;
    const stereo=(lead*.28+pad*.18)*Math.sin(t*.55+track.seed);
    samples[j]=mono;
    const bucket=Math.floor(j*peaks.length/frames);
    peaks[bucket]=Math.max(peaks[bucket],Math.abs(mono));
    varray.setInt16(44+j*4,Math.round(Math.max(-1,Math.min(1,mono+stereo))*32767),true);
    varray.setInt16(46+j*4,Math.round(Math.max(-1,Math.min(1,mono-stereo))*32767),true);
  }
  return {samples,peaks,blob:new Blob([buffer],{type:'audio/wav'})};
}
