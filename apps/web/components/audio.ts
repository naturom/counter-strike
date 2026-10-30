import type {TrexSound} from './trex-audio';
import {RecordedAudio} from './recorded-audio';
import {combatSignal,spatialMix,isRecordedKind,type SoundKind,type Surface} from './combat-audio';
import {explosionSignal,type ExplosionKind} from './explosion-audio';
import type {Vec3,Weapon} from '@sirocco/shared';
// Recorded footsteps/reloads/knife Foley and synthesized gun/explosion effects. All effects are routed through one master gain and
// compressor; world sounds attenuate with distance and pan relative to the view.
export class GameAudio {
  private context?:AudioContext;private master?:GainNode;private noise?:AudioBuffer;
  private explosionBuffers=new Map<ExplosionKind,AudioBuffer>();
  private explosionSources=new Set<AudioBufferSourceNode>();
  private combatBuffers=new Map<string,AudioBuffer>();private voices=new Set<AudioBufferSourceNode>();private reloads=new Map<string,AudioBufferSourceNode>();
  private recordings=new RecordedAudio<AudioBuffer>();private recordingLoad?:Promise<boolean>;private lastVariant=-1;
  enabled=true;listener:Vec3={x:0,y:0,z:0};yaw=0;
  unlock(){if(!this.context){const c=this.context=new AudioContext();this.master=c.createGain();this.master.gain.value=.48;const limiter=c.createDynamicsCompressor();limiter.threshold.value=-14;limiter.ratio.value=8;this.master.connect(limiter).connect(c.destination);this.noise=c.createBuffer(1,c.sampleRate*2,c.sampleRate);const d=this.noise.getChannelData(0);let last=0;for(let i=0;i<d.length;i++){last=(last+Math.random()*2-1)/1.25;d[i]=last;}setTimeout(()=>{if(c.state!=='closed'){this.explosionBuffer(c,'grenade');this.explosionBuffer(c,'bomb');}},0);}const c=this.context;this.recordingLoad=this.recordings.load(async url=>{const response=await fetch(url);if(!response.ok)throw new Error(`Audio ${response.status}: ${url}`);const data=await response.arrayBuffer();if(c.state==='closed')throw new Error('Audio closed');return c.decodeAudioData(data);});void c.resume();}
  async prepare(){this.unlock();return this.recordingLoad!;}
  setEnabled(on:boolean){this.enabled=on;if(this.master&&this.context)this.master.gain.setTargetAtTime(on?.48:0,this.context.currentTime,.03);}
  private route(at?:Vec3){if(!this.context||!this.master||!this.enabled)return;const gain=this.context.createGain(),pan=this.context.createStereoPanner();let volume=1;if(at){const dx=at.x-this.listener.x,dz=at.z-this.listener.z,d=Math.hypot(dx,dz);volume=1/(1+d*.15+d*d*.002);pan.pan.value=Math.max(-1,Math.min(1,(dx*Math.cos(this.yaw)-dz*Math.sin(this.yaw))/Math.max(2,d)));}gain.gain.value=volume;gain.connect(pan).connect(this.master);return gain;}
  private burst(duration:number,volume:number,freq:number,at?:Vec3,delay=0,type:BiquadFilterType='bandpass'){
    const c=this.context,route=this.route(at);if(!c||!route||!this.noise)return;const n=c.createBufferSource(),filter=c.createBiquadFilter(),g=c.createGain();n.buffer=this.noise;filter.type=type;filter.frequency.value=freq;filter.Q.value=.7;const t=c.currentTime+delay;g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(volume,t+.004);g.gain.exponentialRampToValueAtTime(.0001,t+duration);n.connect(filter).connect(g).connect(route);n.start(t,Math.random());n.stop(t+duration+.02);n.onended=()=>{n.disconnect();filter.disconnect();g.disconnect();route.disconnect();};
  }
  private tone(freq:number,end:number,duration:number,volume:number,at?:Vec3,delay=0){const c=this.context,route=this.route(at);if(!c||!route)return;const o=c.createOscillator(),g=c.createGain(),t=c.currentTime+delay;o.type='triangle';o.frequency.setValueAtTime(freq,t);o.frequency.exponentialRampToValueAtTime(end,t+duration);g.gain.setValueAtTime(volume,t);g.gain.exponentialRampToValueAtTime(.0001,t+duration);o.connect(g).connect(route);o.start(t);o.stop(t+duration);o.onended=()=>{o.disconnect();g.disconnect();route.disconnect();};}
  private play(kind:SoundKind,at:Vec3|undefined,range:number,level:number,occluded=false,owner?:string,delay=0,playbackRate=1){
    const c=this.context;if(!c||!this.master||!this.enabled)return;
    const mix=spatialMix(this.listener,this.yaw,at,range,occluded);if(mix.gain<.001)return;
    const variant=this.lastVariant=(this.lastVariant+1+Math.floor(Math.random()*3))%4,key=`${kind}:${variant}`;let buffer:AudioBuffer|undefined;
    if(isRecordedKind(kind)){buffer=this.recordings.get(kind,variant);if(!buffer)return;}
    else{buffer=this.combatBuffers.get(key);if(!buffer){const signal=combatSignal(c.sampleRate,kind,variant);buffer=c.createBuffer(1,signal.length,c.sampleRate);buffer.getChannelData(0).set(signal);this.combatBuffers.set(key,buffer);}}
    while(this.voices.size>=48){const oldest=this.voices.values().next().value!;oldest.stop();this.voices.delete(oldest);}
    const source=c.createBufferSource(),filter=c.createBiquadFilter(),gain=c.createGain(),pan=c.createStereoPanner();
    source.buffer=buffer;source.playbackRate.value=playbackRate;filter.type='lowpass';filter.frequency.value=mix.cutoff;filter.Q.value=.5;gain.gain.value=mix.gain*level;pan.pan.value=mix.pan;
    source.connect(filter).connect(gain).connect(pan).connect(this.master);this.voices.add(source);
    if(owner){this.cancelReload(owner);this.reloads.set(owner,source);}
    source.onended=()=>{this.voices.delete(source);if(owner&&this.reloads.get(owner)===source)this.reloads.delete(owner);source.disconnect();filter.disconnect();gain.disconnect();pan.disconnect();};
    source.start(c.currentTime+mix.delay+delay);return source;
  }
  creature(kind:TrexSound,at:Vec3,occluded=false){this.play(kind,at,kind==='trex-step'?45:110,kind==='trex-step'?.7:.95,occluded);}
  spray(at?:Vec3,occluded=false){this.play('spray',at,18,.78,occluded);}
  shot(weapon:Weapon,at?:Vec3,occluded=false){this.play(weapon,at,weapon==='m4a1s'?65:140,weapon==='marksman'?1.3:weapon==='deagle'?1.15:weapon==='m4a1s'?.48:.95,occluded);}
  reload(weapon:Weapon,owner:string,at?:Vec3,occluded=false){this.play(`reload-${weapon}`,at,20,.65,occluded,owner);}
  cancelReload(owner:string){const source=this.reloads.get(owner);if(source){source.stop();this.reloads.delete(owner);}}
  syncReloads(active:Set<string>){for(const owner of this.reloads.keys())if(!active.has(owner))this.cancelReload(owner);}
  step(crouched:boolean,at?:Vec3,surface:Surface='stone',sprint=false,occluded=false){this.play(`step-${surface}`,at,crouched?7:sprint?32:25,crouched?.16:sprint?.85:.62,occluded);}
  land(strength:number,at?:Vec3,surface:Surface='stone',occluded=false){
    const impact=Math.min(1,Math.max(0,strength));
    this.play(`step-${surface}`,at,36,.64+impact*.35,occluded,undefined,0,.86);
    this.play(`step-${surface}`,at,36,.26+impact*.22,occluded,undefined,.045,.94);
  }
  knife(at?:Vec3,occluded=false,hit:'air'|'player'|'wall'='air'){
    this.play('knife',at,13,.4,occluded);
    if(hit!=='air')this.play(hit==='player'?'knife-hit':'knife-wall',at,18,hit==='player'?.75:.6,occluded,undefined,.105);
  }
  stopCombat(){for(const source of this.voices)source.stop();this.voices.clear();this.reloads.clear();}
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
  destroy(){this.stopCombat();this.combatBuffers.clear();this.recordings.clear();this.stopExplosions();this.explosionBuffers.clear();void this.context?.close();}
}
