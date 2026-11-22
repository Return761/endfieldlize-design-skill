import {number as n, integer as i, flag as b, choice as e, color as c, object, list,
  times, lerp, clamp, random, path, rect, tag, group, line, circle, dashes, stroke, clipped, radians, fmt} from './options.mjs';

const style = {color:c('#fff'),width:n(1,.5,8),isDashed:b(),dashLength:n(6,1,30),dashGap:n(6,1,30),
  fillTarget:e('higher','lower'),fillType:e('none','solid','dots','hatch'),fillColor:c('#6366f1'),fillOpacity:n(.35,.05,1),
  dotColor:c('#a5b4fc'),dotRadius:n(2,1,6),dotSpacing:n(12,6,30),hatchColor:c('#a5b4fc'),hatchAngle:n(45,0,180),
  hatchSpacing:n(8,4,30),hatchWidth:n(1,.5,4)};
const vec=(value,min,max)=>object({x:n(value[0],min,max),y:n(value[1],min,max),z:n(value[2],min,max)});
const brush=object({x:n(.5,0,1),y:n(.5,0,1),mode:{enum:['raise','lower','smooth']},pressure:n(1,0,1)});

function terrain(p,ctx){
  const pro=p.mode==='pro',cols=Math.min(150,Math.ceil(ctx.w/p.gridStep)),rows=Math.min(150,Math.ceil(ctx.h/p.gridStep));
  const peaks=Array.from({length:p.peakCount},()=>[ctx.rng(),ctx.rng(),.16+ctx.rng()*.28]);
  const waves=Array.from({length:p.octaves},()=>[ctx.rng()*6.28,ctx.rng()*6.28]);
  const values=Array.from({length:rows+1},(_,j)=>Array.from({length:cols+1},(_,k)=>{
    const u=k/cols,v=j/rows;
    let value=peaks.reduce((h,[x,y,r])=>h+Math.exp(-((u-x)**2+(v-y)**2)/r**2)*.8,0);
    for(const [o,[x,y]] of waves.entries()){
      const f=p.noiseScale*800*(2**o);
      value+=p.roughness**o*Math.sin(u*f+x)*Math.cos(v*f+y)*.29;
    }
    if(p.vignetteEffect)value*=clamp(1-Math.hypot(u-.5,v-.5));
    if(!pro)return value;
    value=lerp(p.randomHeightMin,p.randomHeightMax,clamp(value*.65+.25));
    for(const brush of p.brushes){
      const t=Math.max(0,1-Math.hypot((u-brush.x)*p.regionWidth,(v-brush.y)*p.regionHeight)/p.brushRadius);
      const amount=t*brush.pressure*p.brushStrength;
      const mode=brush.mode??p.toolMode;
      if(mode==='smooth')value*=1-amount;
      else value+=amount*(mode==='raise'?1:-1)*35;
    }
    return clamp(value,p.heightMin,p.heightMax);
  }));
  const sw=ctx.w/cols,sh=ctx.h/rows;
  const project=(x,y,z)=>{
    if(!pro||p.viewMode==='contour')return [x,y];
    const angle=radians(p.cameraRotation.z+p.cameraRotation.y*.2);
    const factor=p.cameraMode==='perspective'?clamp(1+y/ctx.h*.24-p.cameraPosition.z/1200,.35,1.4):1;
    const tilt=clamp(.5+(p.cameraPosition.y+p.cameraRotation.x)/320,.15,.95);
    return [(x*Math.cos(angle)-y*Math.sin(angle))*factor-p.cameraPosition.x*.2,
      (x*Math.sin(angle)+y*Math.cos(angle))*tilt*factor-z*3];
  };
  const cell=(j,k)=>[[k*sw-ctx.w/2,j*sh-ctx.h/2,values[j][k]],[(k+1)*sw-ctx.w/2,j*sh-ctx.h/2,values[j][k+1]],
    [(k+1)*sw-ctx.w/2,(j+1)*sh-ctx.h/2,values[j+1][k+1]],[k*sw-ctx.w/2,(j+1)*sh-ctx.h/2,values[j+1][k]]];
  const flat=values.flat(),lo=Math.min(...flat),hi=Math.max(...flat);
  const step=pro?Math.max(p.contourInterval,(hi-lo)/80):(hi-lo)/(p.contourLevels+1);
  const count=step>0?Math.min(80,Math.floor((hi-lo)/step)):0;
  const filterId=ctx.id('glow'),paintId=ctx.id('elevation');
  let background=pro&&!p.linesOnly?rect(-ctx.w/2,-ctx.h/2,ctx.w,ctx.h,{fill:p.terrainColor}):'';
  if (pro&&p.wireframe) background+=times(rows,j=>times(cols,k=>{
    const a=cell(j,k),u=project(...a[0]),v=project(...a[2]);return line(...u,...v,{...stroke(p.lineColor,.4),opacity:.3});
  }));
  const stops=tag('stop',{offset:'0%','stop-color':p.lineColorTop})+tag('stop',{offset:'100%','stop-color':p.lineColorBottom});
  const defs=tag('defs',{},tag('linearGradient',{id:paintId,x1:'0%',x2:'0%',y1:'0%',y2:'100%',gradientUnits:'userSpaceOnUse'},
    stops)+tag('filter',{id:filterId},tag('feGaussianBlur',{stdDeviation:2})));
  const content=times(count,l=>{
    const z=lo+step*(l+1),q=p.levelStyles[l]??styleDefault,major=pro&&p.majorEnabled&&(l+1)%p.majorInterval===0;
    const id=ctx.id('terrain-'+l);
    const segments=[],fills=[];
    for(let j=0;j<rows;j++)for(let k=0;k<cols;k++){
      const a=cell(j,k),hits=[];
      const high=q.fillTarget==='higher',b=[];
      for(let u=0;u<4;u++){
        const o=a[u],v=a[(u+1)%4];
        if((o[2]>=z)===high)b.push(project(...o));
        if((o[2]>=z)===(v[2]>=z))continue;
        const t=(z-o[2])/(v[2]-o[2]),pt=project(lerp(o[0],v[0],t),lerp(o[1],v[1],t),z);
        hits.push(pt);b.push(pt);
      }
      if(hits.length>=2)for(let u=0;u+1<hits.length;u+=2)segments.push('M '+hits[u].map(fmt).join(' ')+' L '+hits[u+1].map(fmt).join(' '));
      if(q.fillType!=='none'&&b.length>2)fills.push('M '+b.map(o=>o.map(fmt).join(' ')).join(' L ')+' Z');
    }
    const pattern=q.fillType==='dots'?
      tag('pattern',{id,width:q.dotSpacing,height:q.dotSpacing,patternUnits:'userSpaceOnUse'},circle(q.dotSpacing/2,q.dotSpacing/2,q.dotRadius,{fill:q.dotColor})):
      q.fillType==='hatch'?tag('pattern',{id,width:q.hatchSpacing,height:q.hatchSpacing,patternUnits:'userSpaceOnUse',patternTransform:'rotate('+q.hatchAngle+')'},
        line(0,0,q.hatchSpacing,0,stroke(q.hatchColor,q.hatchWidth))):'';
    const fill=!fills.length?'':tag('defs',{},pattern)+path(fills.join(' '),{fill:q.fillType==='solid'?q.fillColor:'url(#'+id+')',opacity:q.fillOpacity});
    const custom=p.levelStyles[l];
    const hue=custom?q.color:pro?(major?p.majorColor:p.lineGradient?'url(#'+paintId+')':p.lineColor):p.lineColor;
    const dash=custom?q.isDashed?dashes('dash',q.dashLength,q.dashGap):undefined:
      pro&&(major?p.majorDashed:p.lineDashed)?dashes('dash',major?p.majorDashLen:p.lineDashLen,major?p.majorDashGap:p.lineDashGap):undefined;
    const lines=path(segments.join(' '),{...stroke(hue,custom?q.width:pro?p.contourWidthPx:p.lineWidth),opacity:p.lineOpacity,'stroke-dasharray':dash});
    return fill+(p.glowEffect?group({filter:'url(#'+filterId+')'},lines):'')+lines;
  });
  return defs+(p.circleClip?clipped(ctx,circle(0,0,Math.min(ctx.w,ctx.h)/2),background+content):background+content);
}
const styleDefault=Object.fromEntries(Object.entries(style).map(([k,v])=>[k,v.default]));
export const contour={options:{
  mode:e('classic','pro'),peakCount:i(1,1,10),gridStep:i(6,4,16),noiseScale:n(.003,.0008,.008),contourLevels:i(18,6,35),octaves:i(3,1,5),
  roughness:n(.45,.1,.8),lineWidth:n(1,.5,3.5),lineOpacity:n(1,.1,1),vignetteEffect:b(),glowEffect:b(),lineColor:c('#fff'),
  levelStyles:list([],object(style),80),viewMode:e('contour','profile'),cameraMode:e('perspective','orthographic'),
  cameraPosition:{...vec([0,40,60],-1000,1000),default:{}},cameraRotation:{...vec([0,0,0],-180,180),default:{}},
  toolMode:e('raise','lower','smooth'),brushRadius:n(3.5,1,8),brushStrength:n(.08,.01,.3),brushes:list([],brush,80),regionWidth:n(60,10,100),
  regionHeight:n(60,10,100),contourInterval:n(.7,.2,3),contourWidthPx:n(1.5,.5,4),terrainColor:c('transparent'),
  lineGradient:b(),lineColorTop:c('#e6f2ff'),lineColorBottom:c('#e6f2ff26'),lineDashed:b(),lineDashLen:n(.8,.1,5),
  lineDashGap:n(.4,.1,5),majorEnabled:b(true),majorColor:c('#ffd94d'),majorInterval:i(5,2,20),majorDashed:b(),majorDashLen:n(.8,.1,5),
  majorDashGap:n(.4,.1,5),heightMin:n(-50,-50,50),heightMax:n(50,-50,50),randomHeightMin:n(-6,-50,50),
  randomHeightMax:n(6,-50,50),circleClip:b(),linesOnly:b(true),wireframe:b()
},constraints:[['heightMin','heightMax'],['randomHeightMin','randomHeightMax']],draw:terrain};
