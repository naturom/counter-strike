export type TrexSound='trex-roar'|'trex-bite'|'trex-step'|'trex-death';
export function trexDuration(kind:TrexSound){return kind==='trex-roar'?2.3:kind==='trex-death'?2.7:kind==='trex-step'?.45:.55;}
export function trexSignal(rate:number,kind:TrexSound,variant=0){
 const duration=trexDuration(kind),out=new Float32Array(Math.ceil(rate*duration));let seed=7451+variant*31,low=0,body=0,phase=variant*.5;
 for(let i=0;i<out.length;i++){const t=i/rate;seed=(Math.imul(seed,1664525)+1013904223)>>>0;const noise=seed/2147483648-1;low+=(1-Math.exp(-Math.PI*2*(kind==='trex-step'?160:950)/rate))*(noise-low);body+=.08*(noise-body);
  const roar=kind==='trex-roar'||kind==='trex-death',frequency=roar?(kind==='trex-death'?42:58)+19*Math.exp(-t*2):kind==='trex-step'?47:85;phase+=2*Math.PI*frequency/rate;
  const envelope=roar?(1-Math.exp(-t/.045))*Math.exp(-t/(kind==='trex-death'?.75:.65))*(.65+.35*Math.sin(t*19)**2):(1-Math.exp(-t/.003))*Math.exp(-t/(kind==='trex-step'?.08:.09));
  const tone=roar?Math.tanh(Math.sin(phase)*3)+.28*Math.sin(phase*3)+.10*Math.sin(phase*7):Math.sin(phase),sample=(tone*(roar?.45:.5)+low*(roar?.85:1.4)+body*.2)*envelope;
  out[i]=Math.tanh(sample)*.8*Math.min(1,(duration-t)/.02);
 }out[0]=out[out.length-1]=0;return out;
}
