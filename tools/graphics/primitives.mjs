import {number as n, integer as i, flag as b, choice as e, color as c, object, list, arc, dashes,
  times, tag, line, rect, path, polygon, polyline, circle, mark, points, stroke, clipped, esc, lerp} from './options.mjs';

export const primitives={
  arcs:{options:{radius:n(125,1,2000),start:n(-145,-720,720),sweep:n(200,-360,360),segments:i(8,1,120),
    separation:n(3,0,180),width:n(2,.1,80),color:c('#2d49ff'),lineType:e('solid','dash','dot'),dash:n(8,1,100),gap:n(6,1,100)},
    draw:p=>{
      const step=p.sweep/p.segments;
      const length=Math.sign(step)*Math.max(0,Math.abs(step)-p.separation);
      return times(p.segments,j=>path(arc(p.radius,p.start+step*j,length),{
        ...stroke(p.color,p.width),'stroke-linecap':p.lineType==='dot'?'round':'butt','stroke-dasharray':dashes(p.lineType,p.dash,p.gap)}));
    }},
  measurementGuides:{options:{length:n(500,1,4000),ticks:i(25,2,200),majorEvery:i(4,1,40),tickHeight:n(8,1,100),color:c('#273444'),
    strokeWidth:n(1,.1,20),vertical:b(),labels:b(true),start:n(0,-100000,100000),increment:n(1,-100000,100000)},
    draw:p=>{
      const a=stroke(p.color,p.strokeWidth),d=p.length/2;
      return tag('g',{transform:p.vertical?'rotate(90)':undefined},line(-d,0,d,0,a)+times(p.ticks,j=>{
        const x=lerp(-d,d,j/(p.ticks-1)),major=j%p.majorEvery===0,h=p.tickHeight*(major?1.6:1);
        return line(x,0,x,h,a)+(major&&p.labels?tag('text',{x,y:h+12,fill:p.color,'font-size':10,'font-family':'JetBrains Mono, monospace','text-anchor':'middle'},
          esc(Number((p.start+j*p.increment).toFixed(2)))):'');
      }));
    }},
  gridField:{options:{spacing:n(24,2,300),width:n(1,.1,40),pattern:e('lines','dots','checker'),color:c('#77878f'),angle:n(0,-360,360)},
    draw:(p,ctx)=>{
      const id=ctx.id('grid'),s=p.spacing;
      const q=p.pattern==='lines'?path('M 0 '+s+' V 0 H '+s,stroke(p.color,p.width)):
        p.pattern==='dots'?circle(s/2,s/2,p.width,{fill:p.color}):rect(0,0,s/2,s/2,{fill:p.color})+rect(s/2,s/2,s/2,s/2,{fill:p.color});
      return tag('defs',{},tag('pattern',{id,width:s,height:s,patternUnits:'userSpaceOnUse',patternTransform:'rotate('+p.angle+')'},q))+
        rect(-ctx.w/2,-ctx.h/2,ctx.w,ctx.h,{fill:'url(#'+id+')'});
    }},
  registrationMarks:{options:{style:e('crosshair','corners','target'),size:n(18,1,300),inset:n(18,0,300),width:n(1,.1,30),
    color:c('#304558'),center:b(false)},draw:(p,ctx)=>{
      const s=p.size/2,a=stroke(p.color,p.width),x=Math.max(0,ctx.w/2-p.inset-s),y=Math.max(0,ctx.h/2-p.inset-s);
      const at=(u,v)=>p.style==='corners'?path('M '+(u-s)+' '+v+' v '+(-s)+' h '+s,a):
        line(u-s,v,u+s,v,a)+line(u,v-s,u,v+s,a)+(p.style==='target'?circle(u,v,s*.7,a):'');
      return [[-x,-y],[x,-y],[-x,y],[x,y],...(p.center?[[0,0]]:[])].map(([u,v])=>at(u,v)).join('');
    }},
  geometricMask:{options:{shape:e('circle','square','hexagon','triangle','diamond'),radius:n(140,1,1800),
    angle:n(0,-360,360),invert:b(),fill:c('#2d49ff')},
    draw:(p,ctx)=>clipped(ctx, p.angle||!['circle','square'].includes(p.shape)?
      polygon(points({triangle:3,diamond:4,square:4,hexagon:6,circle:120}[p.shape],p.radius,p.angle)):
      p.shape==='circle'?circle(0,0,p.radius):rect(-p.radius,-p.radius,p.radius*2,p.radius*2),
      rect(-ctx.w/2,-ctx.h/2,ctx.w,ctx.h,{fill:p.fill}),p.invert)},
  signalBars:{options:{values:list([.15,.26,.49,.63,.88,.52,.31,.84,.97,.43,.27,.63],n(0,0,1),1024),gap:n(3,0,100),
    width:n(360,1,4000),height:n(80,1,3000),color:c('#2d49ff'),baseline:e('bottom','center','top'),step:i(0,0,100)},
    draw:p=>{
      const pitch=p.width/Math.max(1,p.values.length),w=Math.max(.1,pitch-p.gap);
      return p.values.map((value,j)=>{
        const h=p.height*(p.step?Math.round(value*p.step)/p.step:value);
        return rect(-p.width/2+j*pitch,-(p.baseline==='center'?h/2:p.baseline==='bottom'?h:0),w,h,{fill:p.color});
      }).join('');
    }},
  waveform:{options:{samples:list([0,.42,.25,-.6,.23,.9,-.45,.4,-.68,.58,.24,0],n(0,-1,1),8192),
    width:n(520,1,4000),height:n(180,1,3000),style:e('line','bars','area'),color:c('#2d49ff'),
    fill:c('#2d49ff33'),strokeWidth:n(2,.1,60),baseline:b(true)},draw:p=>{
      const pts=p.samples.map((value,j)=>[-p.width/2+j*p.width/Math.max(1,p.samples.length-1),-value*p.height/2]);
      const a=stroke(p.color,p.strokeWidth);
      const axis=p.baseline?line(-p.width/2,0,p.width/2,0,{stroke:p.color,opacity:.25}):'';
      if(!pts.length)return axis;
      return axis+(p.style==='bars'?pts.map(([x,y])=>line(x,0,x,y,a)).join(''):
        p.style==='area'?polygon([[-p.width/2,0],...pts,[p.width/2,0]],{...a,fill:p.fill}):polyline(pts,a));
    }}
};
