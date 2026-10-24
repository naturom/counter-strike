import {footprint,solidTop,RADIUS,type Motion,type Solid,type Vec3,type Weapon} from '@sirocco/shared';
export type Surface='asphalt'|'stone'|'grit'|'metal'|'wood';
export type SynthSoundKind=Weapon;
export type SoundKind=SynthSoundKind|'spray'|'knife'|'knife-hit'|'knife-wall'|`reload-${Weapon}`|`step-${Surface}`;
export const isRecordedKind=(kind:SoundKind):kind is Exclude<SoundKind,SynthSoundKind>=>kind==='spray'||kind.startsWith('step-')||kind.startsWith('reload-')||kind.startsWith('knife');
export function soundDuration(kind:SynthSoundKind){return kind==='marksman'?1.35:.85;}
/** Layered synthesis is used for gun reports only. Knife sounds, footsteps and
 * reloads use bundled recordings and never fall back to these oscillators. */
export function combatSignal(rate:number,kind:SynthSoundKind,variant=0){
 const duration=soundDuration(kind),out=new Float32Array(Math.ceil(rate*duration));let seed=2166136261+variant;
 for(const char of kind)seed=Math.imul(seed^char.charCodeAt(0),16777619)>>>0;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2147483648-1;};
 // Each layer has its own band and envelope: short clicks, body resonance,
 // friction, and reflected tails instead of audible oscillator sweeps.
 const layer=(start:number,length:number,level:number,cutoff:number,decay:number,resonance=0,toneMix=0,attack=.001)=>{
  let low=0,phase=random()*Math.PI;const alpha=1-Math.exp(-2*Math.PI*cutoff/rate),offset=Math.floor(start*rate);
  for(let j=0;j<length*rate&&offset+j<out.length;j++){const t=j/rate,n=random();low+=alpha*(n-low);phase+=2*Math.PI*resonance/rate;const envelope=(1-Math.exp(-t/attack))*Math.exp(-t/decay)*Math.min(1,(length-t)/.012);out[offset+j]+=(low*(1-toneMix)+Math.sin(phase)*toneMix)*level*envelope;}
 };
  const profile={rifle:[.009,.085,115,.9],pistol:[.007,.055,180,.7],smg:[.005,.045,210,.6],marksman:[.014,.14,78,1.15]}[kind as Weapon];
  layer(0,.065,2,14500,profile[0]); // muzzle crack
  layer(.002,.28,1.5,2200,profile[1]); // gas / pressure
  layer(.004,.33,profile[3],350,profile[1],profile[2],.22); // chest of the report
  layer(.022,.075,.2,6500,.017);layer(.065,.09,.12,3600,.022); // action and case
  const dry=out.slice();
  for(const [delay,gain] of [[.067,.2],[.133,.13],[.239,.07],[.37,.035]]){
   const shift=Math.floor((delay+variant*.0013)*rate);let smooth=0;
   for(let j=shift;j<out.length;j++){smooth+=.22*(dry[j-shift]-smooth);out[j]+=smooth*gain;}
  }
 let peak=0;for(let i=0;i<out.length;i++){out[i]=Math.tanh(out[i]*1.5);peak=Math.max(peak,Math.abs(out[i]));}
 const gain=.82/Math.max(.82,peak);for(let i=0;i<out.length;i++)out[i]*=gain;
 const edge=Math.ceil(rate*.001);for(let i=0;i<edge;i++){out[i]*=i/edge;out[out.length-1-i]*=i/edge;}
 return out;
}
export function surfaceAt(p:Vec3,solids:Solid[]):Surface{
 // Prefer the surface beneath the foot centre. Radius fallback is needed
 // when the player is supported by the front edge of a stair or crate.
 let selected:Solid|undefined;
 for(const radius of [0,RADIUS]){
  let top=-Infinity;
  // Equal-height floor overlaps render their first authored surface. Use the
  // same owner here rather than letting a later, hidden road override paving.
  for(const b of solids){const h=solidTop(b,p);if(Math.abs(h-p.y)<.18&&footprint(p,b,radius)&&h>top+1e-5){selected=b;top=h;}}
  if(selected)break;
 }
 if(selected?.style==='metal')return 'metal';if(selected?.kind==='crate'||selected?.style==='door')return 'wood';
 // Roads have dedicated asphalt recordings; paving keeps its stone sound.
 return !selected?'grit':selected.style==='road'?'asphalt':'stone';
}
export function spatialMix(listener:Vec3,yaw:number,at:Vec3|undefined,range:number,occluded=false){
 if(!at)return {gain:1,pan:0,cutoff:18000,delay:0};
 const dx=at.x-listener.x,dy=at.y-listener.y,dz=at.z-listener.z,d=Math.hypot(dx,dy,dz),fade=Math.max(0,1-(d/range)**2);
 return {gain:fade*fade/(1+d*.11+d*d*.003)*(occluded?.32:1),pan:Math.max(-1,Math.min(1,(dx*Math.cos(yaw)-dz*Math.sin(yaw))/Math.max(2,Math.hypot(dx,dz)))),cutoff:occluded?850:Math.max(1600,18000/(1+d*.09)),delay:Math.min(.4,d/343)};
}
/** Distance-based cadence, independent of packet/frame rate. Reset on death,
 * respawn, jump, stopping, or teleport so corrections never produce ghost steps. */
export class FootstepTracker {
 private previous?:Motion;private time=0;private distance=0;private last=-Infinity;
 reset(){this.previous=undefined;this.distance=0;this.last=-Infinity;}
 update(p:Motion,time:number,alive=true){
  const old=this.previous,elapsed=time-this.time;this.previous={...p};this.time=time;
  if(!old||!alive||!p.grounded||!old.grounded||elapsed<=0||elapsed>250){this.distance=0;return;}
  const d=Math.hypot(p.x-old.x,p.z-old.z),speed=d/(elapsed/1000);
  if(d>2||speed>12||speed<.3){this.distance=0;return;}
  const sprint=!p.crouched&&speed>6.5,stride=p.crouched?1.3:sprint?1.8:1.5;
  this.distance+=d;if(this.distance<stride||time-this.last<180)return;
  this.distance%=stride;this.last=time;return {crouched:!!p.crouched,sprint};
 }
}

/** Air-to-ground impacts are independent of walking distance, so standing jumps
 * also make a sound. Ignore tiny ground snaps, stale packets and teleports. */
export class LandingTracker {
 private previous?:Motion;private time=0;private airborneAt:number|null=null;private peak=0;private speed=0;
 reset(){this.previous=undefined;this.airborneAt=null;this.peak=0;this.speed=0;}
 update(p:Motion,time:number,alive=true):{strength:number}|undefined{
  const old=this.previous,oldTime=this.time,elapsed=time-oldTime;
  if(!alive){this.reset();return;}
  this.previous={...p};this.time=time;
  if(!old||elapsed<=0||elapsed>250||Math.hypot(p.x-old.x,p.z-old.z)>2||Math.abs(p.y-old.y)>3){this.airborneAt=null;this.speed=0;this.peak=p.y;return;}
  if(!p.grounded){
   if(this.airborneAt===null){this.airborneAt=oldTime;this.peak=Math.max(old.y,p.y);this.speed=0;}
   this.peak=Math.max(this.peak,p.y);this.speed=Math.max(this.speed,-p.vy,(old.y-p.y)/(elapsed/1000));return;
  }
  const flight=this.airborneAt===null?0:time-this.airborneAt,drop=this.peak-p.y,speed=Math.max(this.speed,-old.vy);
  this.airborneAt=null;this.peak=p.y;this.speed=0;
  if(old.grounded||flight<80||drop<.12||speed<1.5)return;
  return {strength:Math.min(1,Math.max(0,(speed-2)/9))*(p.crouched?.75:1)};
 }
}
