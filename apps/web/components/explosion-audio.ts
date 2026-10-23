export type ExplosionKind='grenade'|'bomb';
export const EXPLOSION_AUDIO_SECONDS={grenade:3.2,bomb:8.5} as const;

/** Layered pressure crack, low-frequency body, scattering and outdoor reflections.
 * Rendered once per device and cached; no external recordings or network loads. */
export function explosionSignal(rate:number,kind:ExplosionKind):Float32Array {
  const bomb=kind==='bomb',duration=EXPLOSION_AUDIO_SECONDS[kind],length=Math.ceil(rate*duration),dry=new Float32Array(length),out=new Float32Array(length);
  let seed=bomb?0x4c3401:0x6a1d,low=0,mid=0,phase=0;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296*2-1;};
  const lowCut=1-Math.exp(-2*Math.PI*(bomb?85:140)/rate),midCut=1-Math.exp(-2*Math.PI*1700/rate);
  for(let i=0;i<length;i++){
    const t=i/rate,white=random();low+=lowCut*(white-low);mid+=midCut*(white-mid);
    phase+=2*Math.PI*((bomb?29:47)+(bomb?56:95)*Math.exp(-t/(bomb?.3:.09)))/rate;
    const crack=(white-mid)*Math.exp(-t/(bomb?.028:.012))*.7;
    const body=mid*Math.exp(-t/(bomb?.65:.16))*.75+low*Math.exp(-t/(bomb?1.5:.38))*3;
    const pressure=Math.sin(phase)*Math.exp(-t/(bomb?.75:.19))*(1-Math.exp(-t/.003))*.65;
    const rolling=low*(.5+.5*Math.sin(t*13)**2)*(1-Math.exp(-t/.025))*Math.exp(-t/(bomb?2.15:.64))*(bomb?2.7:1.3);
    const fade=Math.min(1,(duration-t)/.7);dry[i]=(crack+body+pressure+rolling)*Math.max(0,fade);
  }
  // Irregular fragments and ground impacts follow the initial shock instead of
  // turning the entire event into a sustained, tonal "laser" sound.
  for(let k=0;k<(bomb?20:11);k++){
    const start=Math.floor(rate*(.12+(k/(bomb?20:11))**1.3*(bomb?3:1.25)+Math.abs(random())*.09));
    const size=Math.floor(rate*(.018+Math.abs(random())*.055)),gain=(.06+Math.abs(random())*.08)/(1+k*.08);
    for(let j=0;j<size&&start+j<length;j++)dry[start+j]+=random()*Math.exp(-j/(rate*.012))*gain;
  }
  const echoes=bomb?[[.09,.34],[.19,.24],[.34,.19],[.58,.13],[.91,.09],[1.35,.06]]:[[.065,.28],[.145,.18],[.29,.1],[.48,.06]];
  let peak=0;
  for(let i=0;i<length;i++){
    let v=dry[i];for(const [delay,gain] of echoes){const n=i-Math.floor(delay*rate);if(n>=0)v+=dry[n]*gain;}
    out[i]=Math.tanh(v*1.2);peak=Math.max(peak,Math.abs(out[i]));
  }
  const gain=.82/Math.max(.82,peak);for(let i=0;i<length;i++)out[i]*=gain;
  // Avoid a click at either end even when the buffer begins on a noise transient.
  const edge=Math.ceil(rate*.001);for(let i=0;i<edge;i++){out[i]*=i/edge;out[length-1-i]*=i/edge;}
  return out;
}
