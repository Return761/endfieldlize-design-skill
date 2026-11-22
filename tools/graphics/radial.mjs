import {number as n, integer as i, flag as b, choice as e, color as c, string as s, object, list,
  arc, xy, points, polygon, path, tag, line, group, circle, rect, dashes, stroke, times, lerp, mark, fmt, radians, clamp, gradient, random} from './options.mjs';

const strokeMode=e('solid','dash','dot');
const cap=e('none','perpTick','perpTickIn','perpTickOut','dot','ring','squareDot','squareRing','arc');
const hud={
  shapeMode:e('circle','line'),radius:n(180,30,1000),sweepAngle:n(120,10,360),rotation:n(-90,-180,180),
  offsetX:n(0,-2000,2000),offsetY:n(0,-2000,2000),lineLength:n(350,10,2000),
  notchEnable:b(true),notchType:e('single','dual','double','groove'),notchWidth:n(30,5,120),notchArc:n(30,1,120),
  notchDepth:n(-18,-60,60),notchChamfer:n(4,-60,60),notchRadius:n(4,0,40),grooveWidth:n(40,0,300),
  grooveDepth:n(12,-150,150),grooveRadius:n(4,0,40),groovePos:n(0,-500,500),grooveFill:e('none','closed','closedFill','bar'),
  grooveFillGap:n(4,0,40),capStyle:{...cap,default:'dot'},capArcRadius:n(30,1,200),capArcAngle:n(90,10,180),capLength:n(8,2,40),
  capDotRadius:n(3,1,30),lineWidth:n(2,.5,15),lineCapStyle:e('round','square'),strokeColor:c('#e2e8f0'),
  dashPattern:n(0,0,30),subLineEnable:b(),subLineOffset:n(10,-100,100),subLineWidth:n(1,.5,15)
};
const ticks={
  count:i(180,1,720),radius:n(300,1,1000),rayLength:n(30,1,800),alignment:e('center','inner','outer'),arcAngle:n(360,10,360),
  rotation:n(0,-360,360),strokeWidth:n(2,.5,60),lineCap:e('butt','round'),dashGap:n(0,0,20),color:c('#fff'),
  opacity:n(1,0,1),majorInterval:i(0,0,20),majorScale:n(1.8,1,4),waveFreq:n(0,0,36),waveAmp:n(0,0,400),jitter:n(0,0,150)
};
const star={
  angle:n(-60,-180,180),gap:n(120,0,1000),width:n(90,10,600),height:n(60,10,600),rotMode:e('tangent','bisector','manual'),
  rotation:n(0,0,360),color:c('#fff'),satellite:b(),satDistance:n(50,0,200),satAngle:n(-25,-180,180),satScale:n(.4,.05,1.5)
};
const stampPath={...s('',14000),pattern:'^[MmZzLlHhVvCcSsQqTtAa0-9eE.,+ \\-]+$'};
function drawHud(p) {
  const display = (offset, width) => {
    const r=Math.max(1,p.radius+offset);
    const length=p.shapeMode==='line'?p.lineLength:p.sweepAngle;
    const start=-length/2,end=length/2;
    const coordinates=(a,d=0)=>p.shapeMode==='line'?[a,offset+d]:xy(Math.max(1,r+d),a);
    const w=p.shapeMode==='line'?p.notchWidth:p.notchArc;
    const nw=Math.min(length*.45,p.notchType==='groove'&&p.shapeMode==='line'?p.grooveWidth:w)/2;
    const pos=clamp(p.groovePos,start+nw,end-nw);
    const dep=p.notchType==='groove'?p.grooveDepth:p.notchDepth;
    const angles=p.notchEnable?(['dual','double'].includes(p.notchType)?[pos-nw*1.5,pos+nw*1.5]:[pos]):[];
    let d='M '+coordinates(start).map(fmt).join(' ');
    let cursor=start;
    const baseline=endAt=>p.shapeMode==='line'?' L '+coordinates(endAt).map(fmt).join(' '):arc(r,cursor,endAt-cursor,r,false);
    const fills=[];
    for (const a of angles) {
      const left=clamp(a-nw,cursor,end),right=clamp(a+nw,left,end);
      const bevel=clamp((p.notchChamfer+(p.notchType==='groove'?p.grooveRadius:p.notchRadius))*(p.shapeMode==='line'?1:.2),-nw*.5,nw*.8);
      const innerLeft=coordinates(left+bevel,dep),innerRight=coordinates(right-bevel,dep);
      d+=baseline(left)+' L '+innerLeft.map(fmt).join(' ')+' L '+innerRight.map(fmt).join(' ')+' L '+coordinates(right).map(fmt).join(' ');
      if(p.grooveFill!=='none') fills.push(polygon([coordinates(left),innerLeft,innerRight,coordinates(right)],{
        ...stroke(p.strokeColor,width),fill:p.grooveFill==='closedFill'?p.strokeColor:'none',
        'stroke-dasharray':p.grooveFill==='bar'?width+' '+p.grooveFillGap:undefined}));
      cursor=right;
    }
    d+=baseline(end);
    const style={...stroke(p.strokeColor,width),'stroke-linecap':p.lineCapStyle,'stroke-linejoin':p.notchRadius?'round':'miter',
      'stroke-dasharray':p.dashPattern?p.dashPattern+' '+p.dashPattern:undefined};
    const caps=[start,end].map(a=>{
      const [x,y]=coordinates(a);
      const dot=p.capStyle.includes('Dot')||p.capStyle==='dot';
      if (['dot','ring','squareDot','squareRing'].includes(p.capStyle)) return mark(p.capStyle.startsWith('square')?'square':'circle',x,y,p.capDotRadius,0,{...style,fill:dot?p.strokeColor:'none'});
      if (p.capStyle==='arc') return group({transform:'translate('+fmt(x)+' '+fmt(y)+') rotate('+a+')'},path(arc(p.capArcRadius,-p.capArcAngle/2,p.capArcAngle),style));
      if (p.capStyle.startsWith('perpTick')) {
        const [x1,y1]=coordinates(a,p.capStyle.endsWith('Out')?0:-p.capLength/2);
        const [x2,y2]=coordinates(a,p.capStyle.endsWith('In')?0:p.capLength/2);
        return line(x1,y1,x2,y2,style);
      }
      return '';
    }).join('');
    return path(d,style)+fills.join('')+caps;
  };
  return group({transform:'translate('+p.offsetX+' '+p.offsetY+') rotate('+p.rotation+')'},
    display(0,p.lineWidth)+(p.subLineEnable?group({opacity:.6},display(p.subLineOffset,p.subLineWidth)):''));
}
export const radial = {
  concentricCircle: {
    options:{count:i(20,1,100),minRadius:n(50,0,2000),maxRadius:n(400,0,2000),minStroke:n(12,0,30),maxStroke:n(.1,0,30),
      arcAngle:n(360,0,360),startAngle:n(0,0,360),lineType:strokeMode,dashLength:n(10,1,100),gapLength:n(8,1,100),strokeColor:c()},
    constraints:[['minRadius','maxRadius']],
    draw:p=>times(p.count,j=>{
      const t=j/Math.max(1,p.count-1),r=lerp(p.minRadius,p.maxRadius,t),w=lerp(p.minStroke,p.maxStroke,t);
      return r>0&&w>0&&p.arcAngle>0?path(arc(r,p.startAngle,p.arcAngle),{...stroke(p.strokeColor,w),
        'stroke-linecap':p.lineType==='dash'?'butt':'round','stroke-dasharray':dashes(p.lineType,p.dashLength,p.gapLength)}):'';
    })
  },
  hudLines:{options:{...hud,layers:list([],object({...hud,name:s('HUD Arc',80),enabled:b(true)}),12)},
    draw:p=>p.layers.length?p.layers.filter(l=>l.enabled).map(drawHud).join(''):drawHud(p)},
  scaleCircle:{options:{...ticks,layers:list([],object({...ticks,name:s('Scale',80),visible:b(true)}),12)},
    draw:(p,ctx)=>{
      const draw=q=>times(q.count,j=>{
        const angle=q.rotation-q.arcAngle/2+q.arcAngle*j/Math.max(1,q.count-(q.arcAngle===360?0:1));
        const main=q.majorInterval>0&&j%q.majorInterval===0;
        const len=Math.max(0,q.rayLength*(main?q.majorScale:1)+q.waveAmp*Math.sin(radians(angle*q.waveFreq))+(ctx.rng()-.5)*q.jitter);
        const reach={outer:0,center:len/2,inner:len}[q.alignment];
        const [x1,y1]=xy(Math.max(0,q.radius-reach),angle),[x2,y2]=xy(q.radius+len-reach,angle);
        return line(x1,y1,x2,y2,{...stroke(q.color,q.strokeWidth),'stroke-linecap':q.lineCap,
          'stroke-dasharray':q.dashGap?q.strokeWidth+' '+q.dashGap:undefined,opacity:q.opacity});
      });
      return p.layers.length?p.layers.filter(q=>q.visible).map(draw).join(''):draw(p);
    }},
  nestedPolygons:{options:{sides:i(3,3,12),maxRadius:n(300,1,2000),radiusStep:n(20,1,500),layers:i(15,1,240),
      rotationStep:n(-2,-360,360),strokeWidth:n(1,.1,30),colorMode:e('gradient','solid'),strokeColor:c(),
      gradientStart:c('#ffffffff'),gradientEnd:c('#ffffff00'),duration:n(3,.5,60),time:n(0,0,60),
      tracks:list([],object({param:e('rotationStep','sides','maxRadius','radiusStep','layers','strokeWidth'),
        keys:list([],object({time:n(0,0,60),value:n(0,-360,2000),easing:e('linear','easeIn','easeOut','easeInOut','step')}),40)}),12)},
    draw:(p,ctx)=>{
      const q={...p};
      for(const track of p.tracks){
        const keys=[...track.keys].sort((a,b)=>a.time-b.time);
        if(!keys.length)continue;
        const end=keys.findIndex(k=>k.time>=Math.min(p.time,p.duration));
        const from=keys[end>0?end-1:end<0?keys.length-1:0],to=keys[end<0?keys.length-1:end];
        let t=to.time===from.time?0:clamp((p.time-from.time)/(to.time-from.time));
        t=({easeIn:t*t,easeOut:1-(1-t)**2,easeInOut:t*t*(3-2*t),step:t===1?1:0})[to.easing]??t;
        const limits=radial.nestedPolygons.options[track.param];
        q[track.param]=clamp(lerp(from.value,to.value,t),limits.minimum,limits.maximum);
      }
      const id=ctx.id('outline');
      const paint=q.colorMode==='gradient'?'url(#'+id+')':q.strokeColor;
      return (q.colorMode==='gradient'?tag('defs',{},gradient(id,q.gradientStart,q.gradientEnd,true)):'')+
        times(Math.min(q.layers,Math.ceil(q.maxRadius/q.radiusStep)),j=>
          polygon(points(Math.round(q.sides),q.maxRadius-j*q.radiusStep,-90+j*q.rotationStep),stroke(paint,q.strokeWidth)));
    }},
  globeSphere:{options:{axisW:n(240,40,1200),axisH:n(240,40,1200),meridians:i(3,0,20),parallels:i(3,0,20),latTilt:n(0,0,30),
    lineWidth:n(2,1,40),lineColor:c('#ccc')},draw:p=>{
      const x=p.axisW/2,y=p.axisH/2,style=stroke(p.lineColor,p.lineWidth);
      return group(style,tag('ellipse',{rx:x,ry:y})+times(p.meridians,j=>{
        const a=(j+1)/(p.meridians+1)*Math.PI;
        return tag('ellipse',{rx:Math.max(.05,x*Math.abs(Math.cos(a))),ry:y});
      })+times(p.parallels,j=>{
        const a=(j+1)/(p.parallels+1)*Math.PI,py=Math.cos(a)*y,rx=Math.sin(a)*x;
        return p.latTilt?tag('ellipse',{cy:py,rx,ry:rx*p.latTilt/90}):line(-rx,py,rx,py);
      }));
    }},
  rays:{options:{count:i(60,1,500),mode:e('width','arc','random','speed'),fillCanvas:b(),innerRadius:n(0,0,1000),
    outerRadius:n(300,1,1000),lineWidth:n(4,.5,50),gapArc:n(4,0,90),randMin:n(3,0,180),randMax:n(15,0,180),
    randSeed:i(1,0,2147483647),randLen:b(),randLenMin:n(100,1,1000),randLenMax:n(300,1,1000),symmetry:e('none','lr','tb'),
    startCap:e('square','round','pointed'),endCap:e('square','round','pointed'),color:c('#ccc'),gradient:b(),
    gradColorA:c('#ccc'),gradColorB:c('#4a90ff'),speedCount:i(120,1,500),speedBlank:n(20,10,55),speedDensity:n(55,0,100),
    speedAngle:n(4,0,18),speedThickness:n(40,2,70),speedHeavy:n(25,0,80),speedEdgeClip:b(true)},
    constraints:[['randMin','randMax'],['randLenMin','randLenMax'],['innerRadius','outerRadius']],
    draw:(p,ctx)=>{
      const rng=random(ctx.seed+':'+p.randSeed),id=ctx.id('rays');
      const paint=p.gradient?'url(#'+id+')':p.color;
      const count=p.mode==='speed'?p.speedCount:p.count;
      const outer=p.fillCanvas?Math.hypot(ctx.w,ctx.h)/2:p.outerRadius;
      const sym = p.symmetry==='none'?count:Math.ceil(count/2);
      return (p.gradient?tag('defs',{},gradient(id,p.gradColorA,p.gradColorB)):'')+times(sym,j=>{
        const angle=j*360/count, inner=p.mode==='speed'?outer*p.speedBlank/100:p.innerRadius;
        if (p.mode==='speed'&&rng()*100>p.speedDensity)return '';
        const r=Math.max(inner,p.randLen?lerp(p.randLenMin,p.randLenMax,rng()):outer);
        const slot=360/count;
        const span=p.mode==='random'?lerp(p.randMin,p.randMax,rng()):Math.max(.1,slot-p.gapArc);
        const draw=a=>{
          if(p.mode==='width'||p.mode==='speed'){
            const [x,y]=xy(inner,a),[u,v]=xy(r,a+(p.mode==='speed'?p.speedAngle:0));
            const width=p.mode==='speed'?p.speedThickness*(rng()*100<p.speedHeavy?1:.28):p.lineWidth;
            const ext=p.mode==='speed'&&!p.speedEdgeClip?width:0;
            return line(x,y,u+ext*Math.cos(radians(a)),v+ext*Math.sin(radians(a)),{...stroke(paint,width),
              'stroke-linecap':p.startCap==='round'&&p.endCap==='round'?'round':'butt'})+
              [p.startCap,p.endCap].map((k,idx)=>{
                const at=idx?[u,v]:[x,y];
                if(k==='round')return circle(...at,width/2,{fill:paint});
                if(k==='pointed')return group({transform:'translate('+at.map(fmt).join(' ')+') rotate('+(a+(idx?90:270))+')'},
                  polygon([[0,-width],[-width/2,0],[width/2,0]],{fill:paint}));
                return '';
              }).join('');
          }
          if (r===inner)return '';
          const a0=a-span/2,a1=a+span/2;
          return path(arc(r,a0,span)+' L '+xy(inner,a1).map(fmt).join(' ')+(inner?arc(inner,a1,-span,inner,false):'')+' Z',
            {fill:paint,'stroke-linejoin':p.endCap==='round'?'round':undefined});
        };
        return draw(angle)+(p.symmetry==='none'?'':draw(p.symmetry==='lr'?180-angle:-angle));
      });
    }},
  y2kRing:{options:{a:n(300,10,1500),b:n(200,10,1500),tilt:n(-20,-180,180),strokeWidth:n(2,1,50),lineType:strokeMode,
    dashLength:n(10,1,100),gapLength:n(8,1,100),strokeColor:c('#fff'),ringGapCap:e('round','butt'),
    customSize:n(90,10,600),stampPaths:list([],stampPath,48),
    stampWidth:n(100,1,4000),stampHeight:n(100,1,4000),activeStar:i(0,0,63),stars:list([{}],object(star),64)},draw:p=>{
      const cuts=p.stars.map(q=>({center:(q.angle+360)%360,half:Math.min(179,q.gap/Math.max(p.a,p.b)*180/Math.PI/2)}));
      const segments=[];
      let start=null;
      for(let angle=0;angle<=360;angle++){
        const open=cuts.some(q=>Math.abs(((angle-q.center+540)%360)-180)<q.half);
        if(!open&&start===null)start=angle;
        if(start!==null&&(open||angle===360)){segments.push(arc(p.a,start,angle-start,p.b));start=null;}
      }
      const stars=p.stars.map(q=>{
        const [x,y]=xy(p.a,q.angle,p.b);
        const tangent=Math.atan2(p.b*Math.cos(radians(q.angle)),-p.a*Math.sin(radians(q.angle)))*180/Math.PI;
        const a=q.rotMode==='manual'?q.rotation:q.rotMode==='bisector'?(q.angle+tangent)/2:tangent;
        const style={fill:q.color};
        const stamp=(x,y,ratio)=>{
          if(!p.stampPaths.length)return mark('star',x,y,q.width*ratio/2,a,style,q.height*ratio/2);
          const scale=p.customSize*ratio/Math.max(p.stampWidth,p.stampHeight);
          return group({transform:'translate('+fmt(x)+' '+fmt(y)+') rotate('+fmt(a)+') scale('+fmt(scale)+') translate('+(-p.stampWidth/2)+' '+(-p.stampHeight/2)+')',
            ...style},p.stampPaths.map(d=>path(d)).join(''));
        };
        const [dx,dy]=xy(q.satDistance,q.satAngle+a);
        return stamp(x,y,1)+(q.satellite?stamp(x+dx,y+dy,q.satScale):'');
      }).join('');
      return group({transform:'rotate('+p.tilt+')'},path(segments.join(' '),{...stroke(p.strokeColor,p.strokeWidth),
        'stroke-linecap':p.lineType==='dot'?'round':p.ringGapCap,'stroke-dasharray':dashes(p.lineType,p.dashLength,p.gapLength)})+stars);
    }},
  ringArray:{options:{shape:e('triangle','circle','square','diamond','star','hexagon'),count:i(100,1,300),
    ringRadius:n(60,10,1500),itemSize:n(8,2,300),sizeOffset:n(.1,-2,2),startAngle:n(0,0,360),
    stepMode:e('fixedSpacing','calc','fixedAngle'),fixedStep:n(30,.5,180),spacing:n(32,1,600),angleOffset:n(0,-90,90),
    radiusOffset:n(2,-5,5),randomRadius:b(),radiusRandMin:n(40,10,1500),radiusRandMax:n(160,10,1500),radiusRandSeed:i(1,0,2147483647),
    rotateMode:e('tangent','radial','fixed'),itemAngle:n(0,-180,180),fillColor:c(),gradient:b(),gradColorA:c(),gradColorB:c('#4a90ff')},
    constraints:[['radiusRandMin','radiusRandMax']],draw:(p,ctx)=>{
      const rng=random(ctx.seed+':'+p.radiusRandSeed),id=ctx.id('array');
      let a=p.startAngle;
      return (p.gradient?tag('defs',{},gradient(id,p.gradColorA,p.gradColorB)):'')+times(p.count,j=>{
        const r=Math.max(1,(p.randomRadius?lerp(p.radiusRandMin,p.radiusRandMax,rng()):p.ringRadius)+j*p.radiusOffset);
        const [x,y]=xy(r,a);
        const angle=p.itemAngle+(p.rotateMode==='fixed'?0:a+(p.rotateMode==='tangent'?90:0));
        const item=mark(p.shape,x,y,Math.max(.2,p.itemSize+j*p.sizeOffset)/2,angle,{fill:p.gradient?'url(#'+id+')':p.fillColor});
        a+=p.angleOffset+({calc:360/p.count,fixedAngle:p.fixedStep,fixedSpacing:p.spacing/r*180/Math.PI})[p.stepMode];
        return item;
      });
    }}
};
