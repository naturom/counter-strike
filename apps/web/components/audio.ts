import {explosionSignal,type ExplosionKind} from './explosion-audio';
import type {Vec3,Weapon} from '@sirocco/shared';
// Original synthesized audio. All effects are routed through one master gain and
// compressor; world sounds attenuate with distance and pan relative to the view.
export class GameAudio {
  private context?:AudioContext;private master?:GainNode;private noise?:AudioBuffer;
  private explosionBuffers=new Map<ExplosionKind,AudioBuffer>();
  private explosionSources=new Set<AudioBufferSourceNode>();
  enabled=true;listener:Vec3={x:0,y:0,z:0};yaw=0;
  unlock(){if(!this.context){const c=this.context=new AudioContext();this.master=c.createGain();this.master.gain.value=.48;const limiter=c.createDynamicsCompressor();limiter.threshold.value=-14;limiter.ratio.value=8;this.master.connect(limiter).connect(c.destination);this.noise=c.createBuffer(1,c.sampleRate*2,c.sampleRate);const d=this.noise.getChannelData(0);let last=0;for(let i=0;i<d.length;i++){last=(last+Math.random()*2-1)/1.25;d[i]=last;}setTimeout(()=>{if(c.state!=='closed'){this.explosionBuffer(c,'grenade');this.explosionBuffer(c,'bomb');}},0);}void this.context.resume();}
  setEnabled(on:boolean){this.enabled=on;if(this.master&&this.context)this.master.gain.setTargetAtTime(on?.48:0,this.context.currentTime,.03);}
  private route(at?:Vec3){if(!this.context||!this.master||!this.enabled)return;const gain=this.context.createGain(),pan=this.context.createStereoPanner();let volume=1;if(at){const dx=at.x-this.listener.x,dz=at.z-this.listener.z,d=Math.hypot(dx,dz);volume=1/(1+d*.15+d*d*.002);pan.pan.value=Math.max(-1,Math.min(1,(dx*Math.cos(this.yaw)-dz*Math.sin(this.yaw))/Math.max(2,d)));}gain.gain.value=volume;gain.connect(pan).connect(this.master);return gain;}
  private burst(duration:number,volume:number,freq:number,at?:Vec3,delay=0,type:BiquadFilterType='bandpass'){
    const c=this.context,route=this.route(at);if(!c||!route||!this.noise)return;const n=c.createBufferSource(),filter=c.createBiquadFilter(),g=c.createGain();n.buffer=this.noise;filter.type=type;filter.frequency.value=freq;filter.Q.value=.7;const t=c.currentTime+delay;g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(volume,t+.004);g.gain.exponentialRampToValueAtTime(.0001,t+duration);n.connect(filter).connect(g).connect(route);n.start(t,Math.random());n.stop(t+duration+.02);n.onended=()=>{n.disconnect();filter.disconnect();g.disconnect();route.disconnect();};
  }
  private tone(freq:number,end:number,duration:number,volume:number,at?:Vec3,delay=0){const c=this.context,route=this.route(at);if(!c||!route)return;const o=c.createOscillator(),g=c.createGain(),t=c.currentTime+delay;o.type='triangle';o.frequency.setValueAtTime(freq,t);o.frequency.exponentialRampToValueAtTime(end,t+duration);g.gain.setValueAtTime(volume,t);g.gain.exponentialRampToValueAtTime(.0001,t+duration);o.connect(g).connect(route);o.start(t);o.stop(t+duration);o.onended=()=>{o.disconnect();g.disconnect();route.disconnect();};}
  shot(weapon:Weapon,at?:Vec3){const profile={rifle:[1800,.3,145,.5],pistol:[2400,.19,190,.38],smg:[2900,.16,175,.32],marksman:[950,.6,90,.8]}[weapon];this.burst(.09,.8,profile[0],at);this.burst(profile[1],.34,450,at,.015,'lowpass');this.tone(profile[2],40,.15,profile[3],at);}
  reload(duration:number,at?:Vec3){this.burst(.1,.35,2300,at);this.tone(500,240,.06,.1,at);this.burst(.14,.3,950,at,duration*.52);this.burst(.1,.5,2700,at,duration*.86);this.tone(850,320,.06,.1,at,duration*.9);}
  step(crouched:boolean,at?:Vec3){this.burst(.14,crouched?.045:.12,1400,at,0,'lowpass');this.tone(100,42,.07,crouched?.025:.065,at);}
  knife(at?:Vec3){this.burst(.16,.22,1800,at,0,'highpass');}
  hurt(){this.burst(.18,.3,650);this.tone(90,34,.23,.4);}
  heartbeat(){this.tone(63,38,.16,.16);this.tone(58,32,.13,.1,undefined,.2);}
  pickup(){this.tone(580,950,.09,.1);this.burst(.07,.2,2400);}
  bombBeep(at:Vec3){this.tone(1800,1800,.07,.18,at);}
  bombAction(at?:Vec3){this.burst(.15,.25,1900,at);this.tone(700,1000,.08,.13,at);}
  bombPlanted(at:Vec3){this.tone(900,1400,.2,.2,at);this.tone(1400,1800,.16,.15,at,.23);}
  bombDefused(){this.tone(1100,500,.5,.3);}
  grenade(at?:Vec3){this.burst(.08,.3,3200,at);this.tone(1200,700,.08,.08,at);}
  explode(at:Vec3,kind:ExplosionKind='grenade',occluded=false){
    const c=this.context,route=this.route(at);if(!c||!route)return;
    const buffer=this.explosionBuffer(c,kind);
    while(this.explosionSources.size>=8){const oldest=this.explosionSources.values().next().value!;oldest.stop();this.explosionSources.delete(oldest);}
    const distance=Math.hypot(at.x-this.listener.x,at.y-this.listener.y,at.z-this.listener.z),source=c.createBufferSource(),filter=c.createBiquadFilter();
    filter.type='lowpass';filter.frequency.value=occluded?650:Math.max(900,15000/(1+distance*.045));filter.Q.value=.55;
    route.gain.value*=occluded?.42:1;source.buffer=buffer;this.explosionSources.add(source);source.connect(filter).connect(route);source.start(c.currentTime+Math.min(.4,distance/343));
    source.onended=()=>{this.explosionSources.delete(source);source.disconnect();filter.disconnect();route.disconnect();};
  }
  private explosionBuffer(c:AudioContext,kind:ExplosionKind){let buffer=this.explosionBuffers.get(kind);if(!buffer){const signal=explosionSignal(c.sampleRate,kind);buffer=c.createBuffer(1,signal.length,c.sampleRate);buffer.getChannelData(0).set(signal);this.explosionBuffers.set(kind,buffer);}return buffer;}
  stopExplosions(){for(const source of this.explosionSources)source.stop();this.explosionSources.clear();}
  destroy(){this.stopExplosions();this.explosionBuffers.clear();void this.context?.close();}
}
