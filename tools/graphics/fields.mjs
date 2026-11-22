import {number as n, integer as i, flag as b, choice as e, color as c, object, list, raster, sample, luminance,
  times, lerp, clamp, random, polygon, points, path, mark, line, rect, tag, group, circle, dashes, stroke, clipped, radians, polyline, gradient} from './options.mjs';

const shapes = e('circle','hexagon','square','diamond','triangle','plus','cross');
const ink = (color, hollow, width, align = 'center') => hollow ?
  {fill:'none',stroke:color,'stroke-width':width*(align==='center'?1:2)} : {fill:color};
const area = (ctx, x, y) => [(x+ctx.w/2)/ctx.w,(y+ctx.h/2)/ctx.h];
function field(ctx, sx, sy, layout, render, rows, cols) {
  rows ??= Math.min(240,Math.ceil(ctx.h/sy)+2);
  cols ??= Math.min(240,Math.ceil(ctx.w/sx)+2);
  return times(rows,row=>times(cols,col=>render((col-(cols-1)/2+(row%2&&layout!=='grid'?.5:0))*sx,(row-(rows-1)/2)*sy,col,row)));
}
function maskShape(type,p) {
  if(type==='circle')return circle(0,0,p.maskRadius);
  if(type==='ring'){
    const loop=r=>'M '+r+' 0 a '+r+' '+r+' 0 1 0 '+(-2*r)+' 0 a '+r+' '+r+' 0 1 0 '+(2*r)+' 0 Z';
    return path(loop(p.ringOuter)+' '+loop(p.ringInner),{'clip-rule':'evenodd','fill-rule':'evenodd'});
  }
  if(type==='rect')return rect(-p.rectWidth/2,-p.rectHeight/2,p.rectWidth,p.rectHeight,{rx:p.rectRadius});
  if(type==='polygon'){
    const corners=points(p.polySides,p.polyRadius,p.polyAngle), k=clamp(p.polyCornerRadius/Math.max(1,p.polyRadius),0,.45);
    const near=(a,b)=>a.map((v,j)=>lerp(v,b[j],k)).join(' ');
    return k?path(corners.map((a,j)=>{
      const from=corners[(j+corners.length-1)%corners.length], to=corners[(j+1)%corners.length];
      return (j?' L ':'M ')+near(a,from)+' Q '+a.join(' ')+' '+near(a,to);
    }).join('')+' Z'):polygon(corners);
  }
  if(type==='star')return polygon(Array.from({length:2*p.starPoints},(_,j)=>{
    const r=j%2?p.starInner:p.starOuter,a=radians(p.starAngle+j*180/p.starPoints);
    return [r*Math.cos(a),r*Math.sin(a)];
  }));
  if(type==='heart')return path('M 0 7 C -12 -1 -8 -10 0 -5 C 8 -10 12 -1 0 7 Z',{transform:'scale('+p.heartSize+')'});
}
function pixelRects(pixels,w,h,paint=false) {
  return pixels.map((row,j)=>times(row.length,k=>{
    const sx=w/row.length,sy=h/pixels.length,rgba=sample(pixels,(k+.5)/row.length,(j+.5)/pixels.length);
    if(paint || rgba[3]>127) return rect(-w/2+k*sx,-h/2+j*sy,sx+.01,sy+.01,
      paint?{fill:'rgb('+rgba.slice(0,3).join(',')+')',opacity:rgba[3]/255}:{});
    return '';
  })).join('');
}
export const fields = {
  halftone:{options:{beadMode:b(),beadGap:n(0,0,20),spacing:n(48,10,150),maxRadius:n(20,0,100),minRadius:n(2,0,30),
    angle:n(270,0,360),reverse:b(),transparent:b(true),bgColor:c('transparent'),dotColor:c('#38bdf8'),shape:shapes,
    pattern:e('grid','hex','diag'),ease:e('linear','exp','sin'),gradientType:e('linear','radial'),maskShape:e('full','circle','rect','polygon','image','star','heart'),
    imageScale:n(80,10,150),sampleImageColor:b(),fixedSize:b(),strokeOnly:b(),strokeWidth:n(2,.5,10),strokeAlign:e('center','inner','outer'),
    maskRadius:n(700,50,1000),rectWidth:n(1200,100,2000),rectHeight:n(1200,100,2000),rectRadius:n(120,0,1000),polySides:i(6,3,20),polyRadius:n(700,50,1000),
    polyCornerRadius:n(0,0,1000),polyAngle:n(0,-360,360),starPoints:i(5,3,24),starOuter:n(700,1,1500),starInner:n(320,0,1500),
    starAngle:n(0,-360,360),heartSize:n(45,1,120),maskInvert:b(),edgeZero:b(),pixels:raster},constraints:[['minRadius','maxRadius']],draw:(p,ctx)=>{
      const d=p.beadMode?Math.max(1,p.maxRadius*2+p.beadGap):p.spacing, a=radians(p.angle), zoom=p.imageScale/100;
      const dots=field(ctx,d,p.pattern==='hex'?d*.866:d,p.pattern,(x,y)=>{
        const [u,v]=area(ctx,x,y);
        const rgba=sample(p.pixels,(u-.5)/zoom+.5,(v-.5)/zoom+.5);
        let t=clamp(p.maskShape==='image'?luminance(rgba):p.gradientType==='radial'?Math.hypot(u-.5,v-.5)*2:.5+(u-.5)*Math.cos(a)+(v-.5)*Math.sin(a));
        if(p.reverse)t=1-t;
        if(p.ease==='exp')t*=t;
        if(p.ease==='sin')t=(1-Math.cos(t*Math.PI))/2;
        const r=p.fixedSize||p.beadMode?p.maxRadius:lerp(p.edgeZero?0:p.minRadius,p.maxRadius,t);
        const fill=p.sampleImageColor&&rgba[3]?'rgb('+rgba.slice(0,3).join(',')+')':p.dotColor;
        return r>.01?mark(p.beadMode?'circle':p.shape,x,y,r,p.pattern==='diag'?45:0,ink(fill,p.strokeOnly,p.strokeWidth,p.strokeAlign)):'';
      });
      const mask=p.maskShape==='image'?pixelRects(p.pixels,ctx.w*zoom,ctx.h*zoom):maskShape(p.maskShape,p);
      return (p.transparent?'':rect(-ctx.w/2,-ctx.h/2,ctx.w,ctx.h,{fill:p.bgColor}))+(mask===undefined?dots:clipped(ctx,mask,dots,p.maskInvert));
    }},
  waveTexture:{options:{spacing:n(16,5,80),amplitude:n(20,0,100),frequency:n(.012,.002,.05),lineWidth:n(3,.5,15),
    lineColor:c('#777'),bgColor:c('#e6e1d6'),transparentBg:b(true)},draw:(p,ctx)=>{
      const count=Math.ceil((ctx.h+2*p.amplitude)/p.spacing)+1;
      return (p.transparentBg?'':rect(-ctx.w/2,-ctx.h/2,ctx.w,ctx.h,{fill:p.bgColor}))+
        times(count,row=>polyline(Array.from({length:Math.ceil(ctx.w/5)+1},(_,k)=>{
          const x=k*5-ctx.w/2;return [x,(row-(count-1)/2)*p.spacing+p.amplitude*Math.sin(x*p.frequency+row*.08)];
        }),stroke(p.lineColor,p.lineWidth)));
    }},
  linePattern:{options:{direction:e('horizontal','vertical','diagonal','dot'),angle:n(45,0,360),lineWidth:n(1,1,100),spacing:n(12,2,300),
    lineColor:c(),transparentBg:b(true),bgColor:c('#ffffff'),range:e('all','ring','rect','image'),ringOuter:n(400,20,1000),
    ringInner:n(100,0,1000),rectW:n(800,20,2000),rectH:n(600,20,2000),imageScale:n(100,1,200),pixels:raster},
    constraints:[['ringInner','ringOuter']],draw:(p,ctx)=>{
      const reach=Math.hypot(ctx.w,ctx.h)/2,id=ctx.id('repeat'),angle=({vertical:90,diagonal:p.angle})[p.direction]??0;
      const cell=p.direction==='dot'?circle(p.spacing/2,p.spacing/2,p.lineWidth/2,{fill:p.lineColor}):line(0,p.spacing/2,p.spacing,p.spacing/2,stroke(p.lineColor,p.lineWidth));
      const def=tag('defs',{},tag('pattern',{id,width:p.spacing,height:p.spacing,patternUnits:'userSpaceOnUse',patternTransform:'rotate('+angle+')'},cell));
      const content=rect(-reach,-reach,2*reach,2*reach,{fill:'url(#'+id+')'});
      const mask=p.range==='image'?pixelRects(p.pixels,ctx.w*p.imageScale/100,ctx.h*p.imageScale/100):
        maskShape(p.range,{...p,rectWidth:p.rectW,rectHeight:p.rectH,rectRadius:0});
      return def+(p.transparentBg?'':rect(-ctx.w/2,-ctx.h/2,ctx.w,ctx.h,{fill:p.bgColor}))+
        (mask===undefined?content:clipped(ctx,mask,content));
    }},
  dotMatrix:{options:{shape:shapes,drawMode:e('click','erase','pick'),continuous:b(true),dotVisibility:e('all','hidden','ends','transit'),
    layout:e('grid','diagonal','hex'),range:e('infinite','finite'),rows:i(8,1,50),cols:i(8,1,50),dotSize:n(8,1,100),
    dotWidth:n(8,1,100),dotHeight:n(8,1,100),spacing:n(24,0,200),spacingX:n(24,0,200),spacingY:n(24,0,200),lineWidth:n(2,1,50),
    lineColor:c(),arrowOn:b(),arrowSize:n(16,2,80),cornerRadius:n(0,0,100),refImageExport:b(),dotColor:c(),randomAlpha:b(),
    alphaMin:n(20,0,100),alphaMax:n(100,0,100),alphaSeed:i(1,0,2147483647),crop:e('all','ring','rect','image'),cropRingOuter:n(400,20,1000),
    cropRingInner:n(100,0,1000),cropRectW:n(800,20,2000),cropRectH:n(600,20,2000),cropImageScale:n(.8,.1,1),livePick:b(),
    strokeOnly:b(),strokeWidth:n(2,.5,10),sizeMode:e('same','random','segment'),sizeMin:n(4,1,100),sizeMax:n(16,1,100),
    sizeSeed:i(1,0,2147483647),sizeSegments:list([{size:4,ratio:34},{size:8,ratio:33},{size:12,ratio:33}],object({size:n(4,1,100),ratio:n(25,0,100)}),25),
    pixels:raster,paths:list([],{type:'array',items:{type:'array',items:i(0,0,300),minItems:2,maxItems:2},maxItems:150},100)},
    constraints:[['alphaMin','alphaMax'],['sizeMin','sizeMax'],['cropRingInner','cropRingOuter']],draw:(p,ctx)=>{
      const sx=Math.max(4,p.layout==='grid'?p.spacingX:p.spacing),sy=Math.max(4,p.layout==='grid'?p.spacingY:p.spacing*(p.layout==='hex'?.866:1));
      const rows=p.range==='finite'?p.rows:Math.min(240,Math.ceil(ctx.h/sy)+2),cols=p.range==='finite'?p.cols:Math.min(240,Math.ceil(ctx.w/sx)+2);
      const map=([col,row])=>[(col-(cols-1)/2+(row%2&&p.layout!=='grid'?.5:0))*sx,(row-(rows-1)/2)*sy];
      const membership=new Map(),a=random(ctx.seed+':alpha:'+p.alphaSeed),r=random(ctx.seed+':size:'+p.sizeSeed);
      const attrs={...stroke(p.lineColor,p.lineWidth),'stroke-linejoin':p.cornerRadius?'round':'miter','marker-end':p.arrowOn?'url(#'+ctx.id('arrow')+')':undefined};
      const drawn=p.paths.map(coords=>{
        coords.forEach((pos,j)=>membership.set(pos.join(','),j===0||j===coords.length-1?'ends':'transit'));
        const nodes=coords.map(map);
        if(p.drawMode==='erase')return '';
        return p.continuous?polyline(nodes,attrs):times(nodes.length-1,j=>line(...nodes[j],...nodes[j+1],attrs));
      }).join('');
      const dots=field(ctx,sx,sy,p.layout,(x,y,col,row)=>{
        if(p.dotVisibility!=='all'&&membership.get(col+','+row)!==p.dotVisibility)return '';
        const [u,v]=area(ctx,x,y),rgba=sample(p.pixels,(u-.5)/p.cropImageScale+.5,(v-.5)/p.cropImageScale+.5);
        const paint=(p.livePick||p.drawMode==='pick')&&rgba[3]?'rgb('+rgba.slice(0,3).join(',')+')':p.dotColor;
        if(p.drawMode==='erase'&&membership.has(col+','+row))return '';
        let size=p.dotSize;
        if(p.sizeMode==='random')size=lerp(p.sizeMin,p.sizeMax,r());
        if(p.sizeMode==='segment'){
          let pick=r()*p.sizeSegments.reduce((sum,v)=>sum+v.ratio,0);
          size=p.sizeSegments.find(v=>(pick-=v.ratio)<0)?.size??size;
        }
        const style={...ink(paint,p.strokeOnly,p.strokeWidth),opacity:p.randomAlpha?lerp(p.alphaMin,p.alphaMax,a())/100:1};
        return p.shape==='square'&&p.sizeMode==='same'?rect(x-p.dotWidth/2,y-p.dotHeight/2,p.dotWidth,p.dotHeight,style):mark(p.shape,x,y,size/2,0,style);
      },rows,cols);
      const w=ctx.w*p.cropImageScale,h=ctx.h*p.cropImageScale;
      const mask=p.crop==='image'?pixelRects(p.pixels,w,h):
        maskShape(p.crop,{ringOuter:p.cropRingOuter,ringInner:p.cropRingInner,rectWidth:p.cropRectW,rectHeight:p.cropRectH,rectRadius:0});
      const tip=p.arrowOn?tag('defs',{},tag('marker',{id:ctx.id('arrow'),orient:'auto',markerUnits:'userSpaceOnUse',markerWidth:p.arrowSize,markerHeight:p.arrowSize,refX:9,refY:5,viewBox:'0 0 10 10'},
        polygon([[0,0],[10,5],[0,10]],{fill:p.lineColor}))):'';
      return tip+(p.refImageExport?pixelRects(p.pixels,w,h,true):'')+(mask===undefined?dots+drawn:clipped(ctx,mask,dots+drawn));
    }},
  polygonGrid:{options:{shape:e('triangle','triangleV','hexagon','hexagonV','rightTriangle','rectangle'),drawMode:e('click','drag'),side:n(60,4,160),
    rtBase:n(60,4,160),rtHeight:n(60,4,160),cellScale:n(100,4,200),fillColor:c(),fillEnabled:b(true),fillOpacity:n(100,0,100),
    strokeColor:c(),strokeWidth:n(0,0,20),strokeAlign:e('center','inner','outer'),gridColor:c('#555'),showGrid:b(true),
    cells:list([],{type:'array',items:i(0,0,500),minItems:2,maxItems:2},1500),density:n(.12,0,1)},draw:(p,ctx)=>{
      const hex=p.shape.startsWith('hex'),vertical=p.shape.endsWith('V'),triangle=p.shape.startsWith('triangle');
      const side=p.side*p.cellScale/100;
      const a=p.shape==='rightTriangle'?p.rtBase*p.cellScale/100:side,h=p.shape==='rightTriangle'?p.rtHeight*p.cellScale/100:side*.866;
      const sx=hex?side*(vertical?1.732:1.5):triangle?(vertical?h:side/2):a;
      const sy=hex?side*(vertical?1.5:1.732):triangle?(vertical?side/2:h):h;
      const selected=new Set(p.cells.map(cell=>cell.join(',')));
      return field(ctx,Math.max(5,sx),Math.max(5,sy),'grid',(x,y,col,row)=>{
        if(hex){if(vertical)x+=row%2?sx/2:0;else y+=col%2?sy/2:0;}
        const on=p.cells.length?selected.has(col+','+row):ctx.rng()<p.density;
        const attrs=on&&p.fillEnabled?{fill:p.fillColor,'fill-opacity':p.fillOpacity/100,stroke:p.strokeColor,
          'stroke-width':p.strokeWidth*(p.strokeAlign==='center'?1:2),'paint-order':p.strokeAlign==='outer'?'stroke fill':undefined}:
          {fill:'none',stroke:p.showGrid?p.gridColor:'none','stroke-width':.7};
        if(hex)return polygon(points(6,side,vertical?30:0).map(([u,v])=>[u+x,v+y]),attrs);
        if(triangle){
          const sign=(col+row)%2?1:-1, vertices=[[-side/2,sign*h/2],[0,-sign*h/2],[side/2,sign*h/2]];
          return polygon(vertices.map(([u,v])=>vertical?[x+v,y+u]:[x+u,y+v]),attrs);
        }
        return p.shape==='rightTriangle'?polygon([[x-a/2,y-h/2],[x+a/2,y+h/2],[x-a/2,y+h/2]],attrs):rect(x-a/2,y-h/2,a,h,attrs);
      });
    }},
  squareGrid:{options:{preset:e('preset1','initial','preset2'),cellSize:n(160,20,500),lineWidth:n(2,.5,50),lineStyle:e('solid','dashed'),lineDash:n(10,1,200),
    lineGap:n(6,1,200),diagonals:i(2,0,2),diagWidth:n(1,.5,50),diagColor:c('#ffffff99'),diagStyle:e('dashed','solid'),diagDash:n(10,1,200),
    diagGap:n(6,1,200),diagTrimCorner:n(20,0,300),diagTrimCenter:n(20,0,300),nodeStyle:e('plus','none','x'),nodeLength:n(40,1,200),nodeWidth:n(4,.5,50),
    nodeTrimCenter:n(0,0,100),nodeColor:c('#ffffffff'),nodeCap:e('square','round'),cornerStyle:e('tri','none','square','circle','ring','fold'),
    cornerPos:e('d2','d1','all'),cornerSize:n(6,1,100),cornerGap:n(8,0,100),color:c('#ffffffaa'),fillMode:e('none','dots','lines'),fillDotShape:e('square','circle'),
    fillDotSize:n(6,1,100),fillDotGap:n(24,4,200),fillDotColor:c('#ffffffaa'),fillLineWidth:n(1,.5,50),fillLineGap:n(16,4,200),fillLineColor:c('#ffffffaa'),
    fillCells:list([],{type:'array',items:i(0,0,300),minItems:2,maxItems:2},1000),
    fills:list([],object({column:i(0,-200,200),row:i(0,-200,200),mode:e('dots','lines','none')}),1000)},draw:(p,ctx)=>{
      const s=p.cellSize,d=s/2,diag={...stroke(p.diagColor,p.diagWidth),'stroke-dasharray':dashes(p.diagStyle,p.diagDash,p.diagGap)};
      const grid={...stroke(p.color,p.lineWidth),'stroke-dasharray':dashes(p.lineStyle,p.lineDash,p.lineGap)};
      const node={...stroke(p.nodeColor,p.nodeWidth),'stroke-linecap':p.nodeCap};
      const cellSet=new Set(p.fillCells.map(q=>q.join(',')));
      const maps=new Map();
      if(p.preset==='preset2'){
        for(const [row,col] of [[0,0],[0,1],[-1,-1],[0,3],[1,1],[2,-1]])maps.set(col+','+row,'dots');
        for(const [row,col] of [[0,2],[2,0],[-2,0],[0,-2]])maps.set(col+','+row,'lines');
      }
      for(const {column,row,mode} of p.fills)maps.set(column+','+row,mode);
      const dotPattern=tag('pattern',{id:ctx.id('dots'),width:p.fillDotGap,height:p.fillDotGap,patternUnits:'userSpaceOnUse'},
        mark(p.fillDotShape,p.fillDotGap/2,p.fillDotGap/2,p.fillDotSize/2,0,{fill:p.fillDotColor}));
      const linePattern=tag('pattern',{id:ctx.id('lines'),width:p.fillLineGap,height:p.fillLineGap,
        patternUnits:'userSpaceOnUse',patternTransform:'rotate(45)'},
        line(0,p.fillLineGap/2,p.fillLineGap,p.fillLineGap/2,stroke(p.fillLineColor,p.fillLineWidth)));
      return tag('defs',{},dotPattern+linePattern)+field(ctx,s,s,'grid',(x,y,col,row)=>{
        let content=path('M 0 '+s+' V 0 H '+s,grid);
        const edge=Math.min(d,p.diagTrimCorner/Math.SQRT2),gap=Math.min(d,p.diagTrimCenter/Math.SQRT2);
        if(p.diagonals&&p.preset!=='initial'&&edge+gap<d){
          content+=line(edge,edge,d-gap,d-gap,diag)+line(d+gap,d+gap,s-edge,s-edge,diag);
          if(p.diagonals===2)content+=line(s-edge,edge,d+gap,d-gap,diag)+line(d-gap,d+gap,edge,s-edge,diag);
        }
        if(p.nodeStyle!=='none'&&p.preset!=='initial'){
          const len=p.nodeLength/2,trim=Math.min(len,p.nodeTrimCenter/2);
          content+=group({transform:p.nodeStyle==='x'?'rotate(45)':undefined},line(-len,0,-trim,0,node)+line(trim,0,len,0,node)+line(0,-len,0,-trim,node)+line(0,trim,0,len,node));
        }
        if(p.cornerStyle!=='none'&&p.preset!=='initial'){
          for(const [u,v,j] of [[0,0,0],[s,0,1],[s,s,2],[0,s,3]]){
            if(p.cornerPos!=='all'&&(p.cornerPos==='d1'?j%2!==0:j%2===0))continue;
            const m=p.cornerSize,k=p.cornerGap;
            const symbol=p.cornerStyle==='tri'?polygon([[k,k],[k+m,k],[k,k+m]],{fill:p.color}):
              p.cornerStyle==='fold'?path('M '+k+' '+(k+m)+' V '+k+' H '+(k+m),grid):
              mark(p.cornerStyle==='square'?'square':'circle',k+m/2,k+m/2,m/2,0,p.cornerStyle==='ring'?grid:{fill:p.color});
            content+=group({transform:'translate('+u+' '+v+') rotate('+(90*j)+')'},symbol);
          }
        }
        const fill=maps.get(Math.floor(x/s+.5)+','+Math.floor(y/s+.5))??(cellSet.has(col+','+row)?p.fillMode:'none');
        return group({transform:'translate('+(x-d)+' '+(y-d)+')'},(fill!=='none'?rect(0,0,s,s,{fill:'url(#'+ctx.id(fill)+')'}):'')+content);
      });
    }},
  dynamicLight:{options:{effect:e('streak','flame'),speed:n(.2,.1,3),energyHeight:n(.6,.1,1),noiseScale:n(2,.2,4.5),streakWidth:n(1,.1,10),
    angle:n(180,0,360),colorMode:e('mono','gradient'),color1:c('#f2c40c'),color2:c('#50a0ff'),glow:n(1,.3,2.5),
    time:n(0,0,3600),loopDuration:n(5,1,10)},draw:(p,ctx)=>{
      const id=ctx.id('light'),mean=Math.hypot(ctx.w,ctx.h),w=mean/200, color=p.colorMode==='gradient'?p.color2:p.color1;
      const phase=(p.time%p.loopDuration)/p.loopDuration*2*Math.PI;
      return tag('defs',{},gradient(id,color,p.color1,true))+group({transform:'rotate('+p.angle+')'},times(200,j=>{
        const r=ctx.rng(),x=(j-100)*w,wave=.5+.5*Math.sin(phase+2*Math.PI*r+p.speed*Math.cos(phase)*p.noiseScale);
        const h=(r*.6+wave*.4)*p.energyHeight*mean,size=w*(.06+r*.25)*p.streakWidth;
        return rect(x,-h/2,size,h,{fill:'url(#'+id+')',opacity:clamp(r*wave*p.glow),rx:p.effect==='flame'?size:0,
          transform:p.effect==='flame'?'skewX('+((r-.5)*20)+')':undefined});
      }));
    }}
};
