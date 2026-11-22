import {number as n, integer as i, flag as b, choice as e, color as c, string as s, object, list, raster,
  times, lerp, clamp, sample, luminance, random, tag, line, rect, polygon, path, points, mark, esc, group, gradient, stroke, clipped, radians} from './options.mjs';

const fonts=e('Montserrat','HarmonyOS Sans','JetBrains Mono','monospace','sans-serif','serif','system-ui');
const outlineFonts={...fonts,enum:[...fonts.enum,'Amarillo USAF']};
const family = font => ({Montserrat:'Montserrat, HarmonyOS Sans, sans-serif',
  'HarmonyOS Sans':'HarmonyOS Sans, sans-serif','JetBrains Mono':'JetBrains Mono, monospace',
  'Amarillo USAF':'AmarilloUSAF, Amarillo USAF, Montserrat, HarmonyOS Sans, sans-serif'})[font]??font;
const asciiPresets={standard:' $@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/|()1{}[]?-_+~<>i!lI;:,. ',detailed:'█▓▒░@#%&8WM$*+=-:,. ',
  blocks:'█▓▒░ ',binary:'10 ',simple:'@#*:. ',beads:'●●●●●'};
const colorMode=e('single','hgradient','vgradient');
const digitWidths=['111221','221211','212221','121121','211213','231111','112113','111312','132111','111231','131112','211412','221114','311222','121322','321122'];
function barcode(p,ctx){
  const id=ctx.id('bars');
  const paint=p.colorMode==='single'?p.color:'url(#'+id+')';
  const defs=p.colorMode==='single'?'':tag('defs',{},gradient(id,p.color,p.color2,p.colorMode==='vgradient'));
  if(p.variant==='ruler'){
    const count=p.lengthCm*10+1,total=(count-1)*p.spacing;
    return times(count,j=>{
      const mode=j%10===0?'major':j%5===0?'medium':'minor';
      const w=p.complex?p[mode+'W']:p.tickWidth,h=p[mode+'H'],color=p.complex?p[mode+'Color']:p.color;
      return rect(j*p.spacing-total/2-w/2,p.symmetric?-h/2:0,w,h,{fill:color});
    });
  }
  if(p.variant==='barcode'){
    const chars=[...new TextEncoder().encode(p.text)];
    const widths=['211214',...chars.flatMap(ch=>[digitWidths[ch>>4],digitWidths[ch&15]]),'2331112'].join('');
    const sum=[...widths].reduce((total,bit)=>total+Number(bit),0),unit=Math.min(p.barWidth,ctx.w*.94/sum);
    let x=-sum*unit/2;
    const bars=[...widths].map((digit,j)=>{const w=Number(digit)*unit,origin=x;x+=w;return j%2?'':rect(origin,-p.height/2,w,p.height,{fill:paint});}).join('');
    return defs+(p.transparentBg?'':rect(-ctx.w/2,-ctx.h/2,ctx.w,ctx.h,{fill:p.bgColor}))+bars+(p.hideText?'':tag('text',
      {'text-anchor':'middle',y:p.height/2+16,fill:p.color,'font-family':family('Montserrat'),'font-size':13},esc(p.text)));
  }
  const pitch=p.barWidth+p.gap, rng=random(ctx.seed+':'+p.randomSeed);
  return defs+group({fill:paint},times(p.count,j=>{
    const h=lerp(p.minH,p.maxH,rng()),x=j*pitch-(p.count-1)*pitch/2-p.barWidth/2,y=p.mode==='symmetric'?-h/2:p.maxH/2-h;
    return p.dotted?times(Math.ceil(h/(p.dotHeight+p.dotGap)),k=>rect(x,y+k*(p.dotHeight+p.dotGap),p.barWidth,Math.max(0,Math.min(h-k*(p.dotHeight+p.dotGap),p.dotHeight)))):rect(x,y,p.barWidth,h);
  }));
}
function symbols(p,ctx){
  const style={fill:p.fillColor,stroke:p.strokeColor,'stroke-width':p.strokeWidth*(p.strokeAlign==='center'?1:2),
    'paint-order':p.strokeAlign==='outer'?'stroke fill':undefined,'stroke-linejoin':p.cornerRadius?'round':'miter'};
  if(['slant','arrow2','chevron','slashes'].includes(p.shape)){
    const skew=Math.tan(radians(p.standard?45:p.angle))*p.height, rng=random(ctx.seed+':'+p.randSeed);
    const w=p.randThickness?p.randMax:p.slantThickness,pitch=w+p.slantGap, left=-pitch*(p.repeat-1)/2;
    const content=times(p.repeat,j=>{
      const t=p.randThickness?lerp(p.randMin,p.randMax,rng()):w, x=left+j*pitch;
      return p.shape==='slant'||p.shape==='slashes'?polygon([[x-skew/2,-p.height/2],[x+t-skew/2,-p.height/2],[x+t+skew/2,p.height/2],[x+skew/2,p.height/2]],
        {...style,'stroke-linejoin':p.radius?'round':'miter'}):
        path('M '+x+' '+(-p.height/2)+' L '+(x+skew/2)+' 0 L '+x+' '+p.height/2,{...stroke(p.fillColor,t),'stroke-linejoin':p.radius?'round':'miter','stroke-linecap':p.radius?'round':'butt'});
    });
    return p.clip?clipped(ctx,rect(-ctx.w/2+p.clipInset,-p.height/2,Math.max(0,ctx.w-2*p.clipInset),p.height),content):content;
  }
  if(p.shape==='bracket'||p.shape==='brackets'){
    const width=p.variant==='cornerSquare'?p.bracketHeight:p.bracketWidth;
    const symbol=path('M '+width+' 0 H 0 V '+p.bracketHeight+(p.variant==='square'?' H '+width:''),stroke(p.fillColor,p.bracketThickness));
    return group({transform:'translate('+(-p.hGap/2)+' '+(-p.bracketHeight/2)+')'},symbol)+
      (p.symmetric?group({transform:'translate('+p.hGap/2+' '+(-p.bracketHeight/2+p.vGap)+') scale(-1 1)'},symbol):'');
  }
  if(['star4','flare','spark','star'].includes(p.shape)){
    const w=p.flareWidth/2,h=p.flareHeight/2,k=p.concavity/100,f=clamp(p.tipWidth/Math.max(1,w),0,.85);
    return p.flareMode==='arc'?path('M '+(-w)+' 0 Q '+(-w*(1-k))+' '+(-h*f)+' 0 '+(-h)+' Q '+(w*f)+' '+(-h*(1-k))+' '+w+' 0 Q '+(w*(1-k))+' '+(h*f)+' 0 '+h+' Q '+(-w*f)+' '+(h*(1-k))+' '+(-w)+' 0 Z',style):
      path('M '+(-w)+' 0 C '+(-w*f)+' '+(-h*k)+' '+(-w*k)+' '+(-h*f)+' 0 '+(-h)+
        ' C '+(w*k)+' '+(-h*f)+' '+(w*f)+' '+(-h*k)+' '+w+' 0 C '+(w*f)+' '+(h*k)+' '+(w*k)+' '+(h*f)+' 0 '+h+
        ' C '+(-w*k)+' '+(h*f)+' '+(-w*f)+' '+(h*k)+' '+(-w)+' 0 Z',style);
  }
  if(p.shape==='cross'||p.shape==='plus'){
    const cross=p.shape==='cross',r=(cross?p.crossSize:p.plusSize)/2,t=cross?p.crossThickness:p.plusThickness,gap=cross?p.crossGap:p.plusGap;
    const dash={...stroke(p.fillColor,t),'stroke-linecap':!cross&&p.plusRadius?'round':'butt'};
    const inset=Math.min(r,gap/2);
    return group({transform:cross?'rotate(45)':undefined},line(-r,0,-inset,0,dash)+line(inset,0,r,0,dash)+
      line(0,-r,0,-inset,dash)+line(0,inset,0,r,dash));
  }
  if(p.shape!=='arrow')return mark(p.shape,0,0,p.size/2,0,style);
  const r=p.size/2,t=Math.min(p.thickness/2,r),d=clamp(r-p.shaftShorten,-r,r);
  const arrow=polygon([[-d,-t],[0,-t],[0,-r],[r,0],[0,r],[0,t],[-d,t]],style);
  if(p.layout==='single')return arrow;
  if(['diverge','focus','cycle','grid'].includes(p.layout)){
    const span=(p.size+p.gap)/2;
    return [[-span,-span,225],[span,-span,315],[span,span,45],[-span,span,135]].map(([x,y,a])=>
      group({transform:'translate('+x+' '+y+') rotate('+(a+(p.layout==='focus'?180:p.layout==='cycle'?90:0))+')'},arrow)).join('');
  }
  const pitch=p.size+p.gap,a=p.layout==='vertical'?90:0;
  return group({transform:'rotate('+a+')'},group({transform:'translate('+(-pitch/2)+')'},arrow)+
    group({transform:'translate('+pitch/2+') rotate('+(p.layout==='mirror'?180:0)+')'},arrow));
}
function noiseText(p,ctx){
  const rng=random(ctx.seed+':'+p.seed),sy=p.blockRows*p.cellSize+p.lineGap, alphaRange=p.opacityMax-p.opacityMin;
  const weight=p.steps.reduce((sum,v)=>sum+v.weight,0);
  return group({fill:p.color},times(p.lines,row=>{
    const cols=Math.round(lerp(p.blockColsMin,p.blockColsMax,rng())),pitch=p.cellSize+p.cellGap,w=cols*pitch;
    const start=p.align==='center'?-w/2:p.align==='right'?ctx.w/2-w:-ctx.w/2;
    let next=Math.round(lerp(p.wordLenMin,p.wordLenMax,rng()));
    return times(cols,col=>{
      if(p.enableWordGap&&col>=next){
        if(col<next+p.wordGapWidth)return '';
        next=col+Math.round(lerp(p.wordLenMin,p.wordLenMax,rng()));
      }
      return times(p.blockRows,k=>{
        let pick=rng()*weight;
        const opacity=p.alphaMode==='steps'?(p.steps.find(v=>(pick-=v.weight)<0)?.alpha??p.steps[0]?.alpha??0):(p.opacityMin+rng()*alphaRange);
        return opacity>0?rect(start+col*pitch,(row-(p.lines-1)/2)*sy+k*p.cellSize,p.cellSize,p.cellSize,{opacity:opacity/100}):'';
      });
    });
  }));
}
function ascii(p,ctx){
  const chars=[...(p.charset||asciiPresets[p.preset])], cols=p.cols;
  const xPitch=p.fontSize*.55*p.spacing,yPitch=p.fontSize*p.lineHeight;
  const rows=Math.min(160,Math.max(1,Math.ceil(cols*ctx.h/ctx.w*xPitch/yPitch)));
  const gain=p.contrast>=0?1+p.contrast/30:1+p.contrast/110;
  return group({'font-family':family('JetBrains Mono'),'font-size':p.fontSize,'xml:space':'preserve','text-anchor':'middle','dominant-baseline':'central'},
    times(rows,j=>times(cols,k=>{
      const u=k/cols,v=j/rows,rgba=sample(p.pixels,u,v);
      const light=p.pixels.length?luminance(rgba):clamp(.5+.4*Math.sin(u*8+v*4+ctx.seed.length)+.2*Math.cos(v*17-u*6));
      if(p.pixels.length&&!rgba[3])return '';
      let t=clamp((light-.5)*gain+.5+p.brightness/100);
      if(p.invert)t=1-t;
      const ch=chars[Math.round(t*(chars.length-1))];
      if(ch===' ')return '';
      const gray=Math.round(t*255);
      const hue=p.colorMode==='gray'?'rgb('+[gray,gray,gray].join(',')+')':p.colorMode==='color'&&p.pixels.length?'rgb('+rgba.slice(0,3).join(',')+')':p.fg;
      return tag('text',{x:(k-(cols-1)/2)*xPitch,y:(j-(rows-1)/2)*yPitch,fill:hue,opacity:p.colorMode==='tint'?t:1},esc(ch));
    })));
}
export const typographic={
  barcode:{options:{variant:e('spectrum','barcode','ruler'),text:s('SIGNAL',120),height:n(40,10,200),transparentBg:b(true),hideText:b(true),bgColor:c('#fff'),
    mode:e('bottom','symmetric'),colorMode,color:c('#000'),color2:c('#ff5252'),barWidth:n(4,1,20),gap:n(3,0,20),count:i(325,1,500),
    minH:n(8,1,325),maxH:n(50,1,325),dotted:b(),dotHeight:n(4,1,50),dotGap:n(2,1,30),tickWidth:n(2,1,10),
    spacing:n(12,2,50),lengthCm:i(8,1,30),symmetric:b(),complex:b(),minorH:n(14,1,50),minorW:n(1,1,10),minorColor:c('#000'),
    mediumH:n(24,1,55),mediumW:n(2,1,10),mediumColor:c('#000'),majorH:n(36,1,55),majorW:n(3,1,10),majorColor:c('#000'),
    randomSeed:i(1,0,2147483647)},constraints:[['minH','maxH']],draw:barcode},
  normalShape:{options:{shape:e('arrow','slant','arrow2','bracket','brackets','cross','plus','star4','flare','spark','star','chevron','slashes','circle','square','triangle'),
    size:n(100,10,1200),layout:e('single','diverge','focus','cycle','vertical','horizontal','mirror','grid'),gap:n(20,0,600),thickness:n(20,5,400),
    cornerRadius:n(4,0,100),shaftShorten:n(0,0,600),fillColor:c('#ccc'),strokeWidth:n(0,0,20),strokeAlign:e('center','inner','outer'),strokeColor:c('#000'),
    angle:n(30,0,80),height:n(100,2,500),slantThickness:n(20,4,600),randThickness:b(),randMin:n(8,4,600),randMax:n(40,4,600),
    randSeed:i(1,0,2147483647),radius:n(4,0,100),slantGap:n(12,0,600),repeat:i(10,1,30),clip:b(),clipInset:n(0,0,600),standard:b(),
    variant:e('square','corner','cornerSquare'),bracketThickness:n(20,1,400),bracketHeight:n(120,10,1200),bracketWidth:n(40,1,800),
    symmetric:b(),hGap:n(40,0,800),vGap:n(40,-600,800),crossSize:n(210,6,1200),crossThickness:n(10,2,200),crossGap:n(10,0,600),
    plusSize:n(300,40,1200),plusThickness:n(40,2,600),plusGap:n(50,0,1200),plusRadius:n(20,0,100),
    flareMode:e('arc','bezier'),flareWidth:n(200,40,1200),flareHeight:n(200,40,1200),concavity:n(100,0,100),tipWidth:n(0,0,200)},
    constraints:[['randMin','randMax']],draw:symbols},
  fakeCode:{options:{lines:i(8,1,40),blockColsMin:i(20,2,1000),blockColsMax:i(100,2,1000),blockRows:i(4,1,10),enableWordGap:b(true),wordLenMin:i(16,1,40),
    wordLenMax:i(40,1,40),wordGapWidth:i(4,1,10),cellSize:n(1,1,40),cellGap:n(0,0,40),lineGap:n(4,0,60),align:e('left','center','right'),
    alphaMode:e('steps','range'),steps:list([{alpha:100,weight:60},{alpha:60,weight:10},{alpha:30,weight:10},{alpha:0,weight:20}],
      object({alpha:n(100,0,100),weight:n(25,0,100)}),25),opacityMin:n(15,0,100),opacityMax:n(90,0,100),color:c('#d0d0d0'),seed:i(20261027,0,2147483647)},
    constraints:[['blockColsMin','blockColsMax'],['wordLenMin','wordLenMax'],['opacityMin','opacityMax']],draw:noiseText},
  ascii:{options:{preset:e('standard','detailed','blocks','binary','simple','beads'),charset:s('',256),cols:i(325,20,350),fontSize:n(20,4,24),spacing:n(2,.5,2),
    lineHeight:n(1.6,.8,2),brightness:n(0,-100,100),contrast:n(0,-100,100),invert:b(),colorMode:e('color','mono','gray','tint'),fg:c('#d9e5df'),pixels:raster},
    draw:ascii},
  typographyOutlines:{options:{text:s('SINEWAVE'),font:outlineFonts,fontSize:n(100,1,400),weight:i(900,100,1000),spacing:n(-3,-40,80),
    fill:c('none'),color:c('#18212b'),strokeWidth:n(1.4,0,20),stretch:n(1,.1,8),glyphPaths:list([],{
      ...s('',18000),pattern:'^[MmZzLlHhVvCcSsQqTtAa0-9eE.,+ \\-]+$'},100)},
    draw:p=>{
      const style={...stroke(p.color,p.strokeWidth),fill:p.fill,transform:'scale('+p.stretch+' 1)'};
      return p.glyphPaths.length?group(style,p.glyphPaths.map(d=>path(d)).join('')):
        tag('text',{...style,'text-anchor':'middle','dominant-baseline':'central','font-family':family(p.font),'font-size':p.fontSize,
          'font-weight':p.weight,'letter-spacing':p.spacing},esc(p.text));
    }},
  technicalLabels:{options:{labels:list([{text:'MEASUREMENT AXIS'}],object({text:s('Label'),x:n(0,-4000,4000),y:n(0,-4000,4000),
    dx:n(0,-4000,4000),dy:n(-18,-4000,4000)}),100),font:fonts,fontSize:n(12,4,60),color:c('#20252b'),lineWidth:n(1,0,10)},
    draw:p=>p.labels.map(q=>line(q.x,q.y,q.x+q.dx,q.y+q.dy,stroke(p.color,p.lineWidth))+tag('text',{x:q.x+q.dx+4,y:q.y+q.dy,
      'font-family':family(p.font),'font-size':p.fontSize,fill:p.color},esc(q.text))).join('')}
};
