import {number, integer, color, polyline, stroke} from '../../tools/graphics/options.mjs';

export const generators = [{
  name: 'orbitWeave',
  options: {threads: integer(14,1,100), spread: number(.16,0,1), color: color('#213cff')},
  draw(params, ctx) {
    return Array.from({length:params.threads},(_,index)=>{
      const phase=index*Math.PI*2/params.threads;
      const drift=(ctx.rng()-.5)*params.spread;
      const points=Array.from({length:241},(_,sample)=>{
        const a=sample*Math.PI*2/240;
        return [
          ctx.w*.4*Math.sin(3*a+phase)*Math.cos(a*2+phase*drift),
          ctx.h*.4*Math.sin(2*a+phase*.58)
        ];
      });
      return polyline(points,{...stroke(params.color,.9),opacity:.35+index/(params.threads*2)});
    }).join('');
  }
}];
