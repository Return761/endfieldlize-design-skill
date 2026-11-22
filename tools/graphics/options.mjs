export const number = (value, min, max) => ({type: 'number', minimum: min, maximum: max, default: value});
export const integer = (value, min, max) => ({...number(value, min, max), type: 'integer'});
export const flag = (value = false) => ({type: 'boolean', default: value});
export const choice = (value, ...others) => ({enum: [value, ...others], default: value});
export const string = (value = '', max = 256) => ({type: 'string', maxLength: max, default: value});
export const color = (value = '#aaa') => ({type: 'string', maxLength: 64,
  pattern: '^(?:#[0-9a-fA-F]{3,4}|#[0-9a-fA-F]{6}|#[0-9a-fA-F]{8}|transparent|none|rgba?\\([0-9.,% ]+\\))$', default: value});
export const object = (properties) => ({type: 'object', properties, additionalProperties: false});
export const list = (value, items, max = 256) => ({type: 'array', items, maxItems: max, default: value});
const {PI} = Math;
export const radians = degrees => degrees * PI / 180;
export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const fmt = value => Number(value.toFixed(4));
export const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'})[c]);
export const tag = (name, attrs, body) => {
  const attributes = Object.entries(attrs).filter(([,v]) => v !== undefined && v !== null)
    .map(([k,v]) => ' ' + k + '="' + esc(typeof v === 'number' ? fmt(v) : v) + '"').join('');
  return body === undefined ? '<' + name + attributes + '/>' : '<' + name + attributes + '>' + body + '</' + name + '>';
};
export const xy = (r, a, ry = r) => [r * Math.cos(radians(a)), ry * Math.sin(radians(a))];
export const pairs = points => points.map(pair => pair.map(fmt).join(',')).join(' ');
export const line = (x1,y1,x2,y2, attrs = {}) => tag('line',{x1,y1,x2,y2,...attrs});
export const rect = (x,y,width,height,attrs = {}) => tag('rect',{x,y,width,height,...attrs});
export const circle = (cx,cy,r,attrs = {}) => tag('circle',{cx,cy,r,...attrs});
export const polygon = (points, attrs = {}) => tag('polygon',{points:pairs(points),...attrs});
export const polyline = (points, attrs = {}) => tag('polyline',{points:pairs(points),fill:'none',...attrs});
export const path = (d, attrs = {}) => tag('path',{d,...attrs});
export const group = (attrs, contents) => tag('g',attrs,Array.isArray(contents)?contents.join(''):contents);
export const times = (n, fn) => Array.from({length: Math.max(0, Math.floor(n))}, (_, i) => fn(i)).join('');
export const stroke = (c,w) => ({stroke:c,'stroke-width':w,fill:'none'});
export const dashes = (kind, length, gap) => kind === 'dot' ? '0.1 ' + gap : ['dash','dashed'].includes(kind) ? length + ' ' + gap : undefined;
export const points = (count,r,a = -90,ry = r) => Array.from({length:count},(_,i)=>xy(r,a+i*360/count,ry));
export function arc(r, start, span, ry = r, move = true) {
  const startPoint = xy(r,start,ry).map(fmt).join(' ');
  const half = span / Math.max(1, Math.ceil(Math.abs(span) / 179.99));
  return (move ? 'M ' + startPoint : '') + times(Math.ceil(Math.abs(span)/179.99), i =>
    ' A ' + fmt(r) + ' ' + fmt(ry) + ' 0 0 ' + (span >= 0 ? 1 : 0) + ' ' + xy(r,start+half*(i+1),ry).map(fmt).join(' '));
}
export function mark(kind, x, y, r, angle = 0, attrs = {}, ry = r) {
  let shape;
  if (kind === 'circle') shape = tag('ellipse',{rx:r,ry,...attrs});
  else if (kind === 'square') shape = rect(-r,-ry,r*2,ry*2,attrs);
  else if (kind === 'plus' || kind === 'cross') {
    const b = r/3;
    shape = polygon([[-b,-ry],[b,-ry],[b,-b],[r,-b],[r,b],[b,b],[b,ry],[-b,ry],[-b,b],[-r,b],[-r,-b],[-b,-b]],attrs);
    if (kind==='cross') angle += 45;
  } else if (kind === 'star') {
    shape = polygon(Array.from({length:8},(_,i)=>xy(r*(i%2?.3:1),i*45,ry*(i%2?.3:1))),attrs);
  } else {
    shape = polygon(points({hexagon:6,triangle:3,diamond:4}[kind] ?? 4,r,-90,ry),attrs);
  }
  return group({transform:'translate('+fmt(x)+' '+fmt(y)+') rotate('+fmt(angle)+')'},shape);
}
export function random(seed) {
  let state = 2166136261;
  for (const ch of String(seed)) state = Math.imul(state ^ ch.codePointAt(0),16777619);
  return () => {
    state = (state + 0x6D2B79F5) | 0;
    let n = Math.imul(state ^ state >>> 15,state | 1);
    n ^= n + Math.imul(n ^ n >>> 7,n | 61);
    return ((n ^ n >>> 14) >>> 0) / 4294967296;
  };
}
export const pixel = {anyOf:[integer(0,0,255),{type:'array',items:integer(0,0,255),minItems:3,maxItems:4}]};
export const raster = list([], {type:'array',items:pixel,minItems:1,maxItems:384},384);
export function sample(data, x, y) {
  if (!data.length || x<0 || y<0 || x>=1 || y>=1) return [0,0,0,0];
  const row=data[Math.floor(y*data.length)];
  const v=row[Math.floor(x*row.length)];
  return Array.isArray(v) ? [v[0],v[1],v[2],v[3]??255] : [v,v,v,255];
}
export const luminance = ([r,g,b,a]) => (r*.2126+g*.7152+b*.0722)/255*(a/255);
export function gradient(id, a, b, vertical = false) {
  return tag('linearGradient',{id,x1:'0%',x2:vertical?'0%':'100%',y1:'0%',y2:vertical?'100%':'0%'},
    tag('stop',{offset:'0%','stop-color':a})+tag('stop',{offset:'100%','stop-color':b}));
}
export function clipped(ctx, mask, content, invert = false) {
  const id=ctx.id('clip');
  if (!invert) return tag('defs',{},tag('clipPath',{id},mask))+group({'clip-path':'url(#'+id+')'},content);
  const white=rect(-ctx.w/2,-ctx.h/2,ctx.w,ctx.h,{fill:'white'});
  return tag('defs',{},tag('mask',{id,maskUnits:'userSpaceOnUse',x:-ctx.w/2,y:-ctx.h/2,width:ctx.w,height:ctx.h},white+group({fill:'black'},mask)))+
    group({mask:'url(#'+id+')'},content);
}
