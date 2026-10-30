import {readFileSync} from 'node:fs';
import {RECORDED_AUDIO,RecordedAudio} from '../apps/web/components/recorded-audio';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {combatSignal,soundDuration,spatialMix,FootstepTracker,surfaceAt,type SynthSoundKind,isRecordedKind} from '../apps/web/components/combat-audio';
import {DUST2,dustPoint,groundAt,WEAPONS,GUNS,type Motion,type Solid,type Weapon} from '@sirocco/shared';
const origin={x:0,y:1.6,z:0};
test('combat sounds have finite bounded samples, clean endpoints, distinct weapon reports and variations',()=>{
 const kinds:SynthSoundKind[]=GUNS;
 for(const kind of kinds){const a=combatSignal(12000,kind),b=combatSignal(12000,kind,1);assert.equal(a.length,Math.ceil(soundDuration(kind)*12000));assert.ok(a.every(x=>Number.isFinite(x)&&Math.abs(x)<=.821));assert.equal(Math.abs(a[0]),0);assert.equal(Math.abs(a.at(-1)!),0);assert.ok(a.some(x=>Math.abs(x)>.05));assert.notDeepEqual(a,b);}
 assert.notDeepEqual(combatSignal(12000,'rifle'),combatSignal(12000,'pistol'));
});
test('AWP reports have a strong low-bass body and a sustained tail without clipping or abrupt edges',()=>{
 for(const rate of [22050,48000])for(let variant=0;variant<4;variant++){
  const shot=combatSignal(rate,'marksman',variant),rifle=combatSignal(rate,'rifle',variant),alpha=1-Math.exp(-2*Math.PI*100/rate);let low=0,bass=0,total=0,tail=0;
  for(let i=0;i<shot.length;i++){const sample=shot[i];low+=alpha*(sample-low);bass+=low*low;total+=sample*sample;if(i>rate*.1&&i<rate*.4)tail+=sample*sample;}
  const rifleEnergy=rifle.reduce((sum,sample)=>sum+sample*sample,0);
  assert.ok(bass/total>.30,'the low-end pressure body should be clearly audible below 100 Hz');
  assert.ok(total/shot.length>rifleEnergy/rifle.length*1.5,'the AWP should carry more weight than the rifle');
  assert.ok(tail/(rate*.3)>.004,'the boom should continue after the initial crack');
  assert.ok(shot.every(sample=>Number.isFinite(sample)&&Math.abs(sample)<=.821));assert.equal(shot[0],0);assert.equal(shot.at(-1),0);
 }
});
function wav(url:string){
 const bytes=readFileSync(`apps/web/public${url}`);assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WAVE');
 let rate=0,channels=0,data:Buffer|undefined;for(let i=12;i+8<=bytes.length;){const tag=bytes.toString('ascii',i,i+4),size=bytes.readUInt32LE(i+4);if(tag==='fmt '){assert.equal(bytes.readUInt16LE(i+8),1);channels=bytes.readUInt16LE(i+10);rate=bytes.readUInt32LE(i+12);assert.equal(bytes.readUInt16LE(i+22),16);}if(tag==='data')data=bytes.subarray(i+8,i+8+size);i+=8+size+(size%2);}
 assert.ok(data);assert.equal(channels,1);assert.equal(rate,22050);const samples=Array.from({length:data.length/2},(_,i)=>data!.readInt16LE(i*2)/32768);return {samples,duration:samples.length/rate};
}
test('all bundled recordings decode as mono PCM, have clean endpoints, bounded peaks and four distinct footstep takes',()=>{
 for(const [kind,urls] of Object.entries(RECORDED_AUDIO)){
  const takes=urls.map(url=>{const {samples,duration}=wav(url);assert.equal(samples[0],0);assert.equal(samples.at(-1),0);assert.ok(samples.every(n=>Number.isFinite(n)&&Math.abs(n)<.83));assert.ok(samples.some(n=>Math.abs(n)>.4));
   if(kind.startsWith('reload-'))assert.ok(Math.abs(duration-WEAPONS[kind.slice(7) as Weapon].reload/1000)<.001);else assert.ok(duration>.05&&duration<.6);return samples;});
  if(kind.startsWith('step-')){assert.equal(takes.length,4);for(let i=1;i<4;i++)assert.notDeepEqual(takes[0],takes[i]);}
 }
});
test('recorded assets load once concurrently, preserve successes and retry failed downloads',async()=>{
 const bank=new RecordedAudio<string>();const total=Object.values(RECORDED_AUDIO).flat().length;let count=0,fail=true;
 const decode=async(url:string)=>{count++;if(fail&&url.endsWith('pistol.wav'))throw new Error('network');return url;};
 const first=bank.load(decode),second=bank.load(decode);assert.equal(first,second);assert.equal(await first,false);assert.equal(count,total);assert.ok(bank.get('step-stone',3));assert.equal(bank.get('reload-pistol',0),undefined);
 fail=false;assert.equal(await bank.load(decode),true);assert.equal(count,total+1);assert.ok(bank.get('reload-pistol',3));await bank.load(decode);assert.equal(count,total+1);bank.clear();assert.equal(bank.get('step-stone',0),undefined);
});
test('world audio pans with view direction, fades to silence, and is quieter and muffled through cover',()=>{
 const right=spatialMix(origin,0,{x:5,y:1.6,z:0},25),left=spatialMix(origin,Math.PI,{x:5,y:1.6,z:0},25),far=spatialMix(origin,0,{x:20,y:1.6,z:0},25),blocked=spatialMix(origin,0,{x:5,y:1.6,z:0},25,true);
 assert.ok(right.pan>.9&&left.pan<-.9);assert.ok(far.gain<right.gain);assert.ok(blocked.gain<right.gain*.4&&blocked.cutoff<right.cutoff);assert.equal(spatialMix(origin,0,{x:26,y:1.6,z:0},25).gain,0);assert.equal(spatialMix(origin,0,undefined,25).gain,1);assert.ok(right.delay>0);
});
const motion=(x=0,grounded=true,crouched=false):Motion=>({x,y:0,z:0,vy:0,grounded,crouched});
function walk(speed:number,hz:number,crouched=false){const steps=new FootstepTracker();let count=0,sprint=false;for(let i=0;i<=hz*3;i++){const result=steps.update(motion(speed*i/hz,true,crouched),i*1000/hz);if(result){count++;sprint=result.sprint;}}return {count,sprint};}
test('remote cadence agrees across snapshot rates, sprint is faster, crouching slower; no airborne, stationary or teleport steps',()=>{
 assert.ok(Math.abs(walk(5.5,20).count-walk(5.5,30).count)<=1);assert.ok(walk(8,30).count>walk(5.5,30).count);assert.ok(walk(8,30).sprint);assert.ok(walk(2.5,20,true).count<walk(5.5,20).count);
 const steps=new FootstepTracker();for(let i=0;i<20;i++)assert.equal(steps.update(motion(0),i*50),undefined);
 assert.equal(steps.update(motion(30),1000),undefined);for(let i=0;i<20;i++)assert.equal(steps.update(motion(30+i*.3,false),1050+i*50),undefined);
 steps.reset();assert.equal(steps.update(motion(60),2100),undefined);assert.equal(steps.update(motion(60.3),2150,false),undefined);
});
test('footstep material follows actual supporting surfaces, including crates and ramps',()=>{
 const floor:Solid={x:0,y:-.15,z:0,w:20,h:.3,d:20,kind:'floor',style:'stone'},crate:Solid={x:2,y:.5,z:0,w:2,h:1,d:2,kind:'crate'},ramp:Solid={x:-3,y:.5,z:0,w:2,h:1,d:2,kind:'floor',style:'metal',ramp:{axis:'x',from:0,to:1}};
 assert.equal(surfaceAt({x:0,y:0,z:0},[floor,crate,ramp]),'stone');assert.equal(surfaceAt({x:2,y:1,z:0},[floor,crate,ramp]),'wood');assert.equal(surfaceAt({x:-3,y:.5,z:0},[floor,crate,ramp]),'metal');assert.equal(surfaceAt({x:40,y:0,z:0},[floor]),'grit');
});

test('knife swing, player hit and wall contact use distinct recordings with multiple takes',()=>{
 for(const kind of ['knife','knife-hit','knife-wall'] as const){assert.ok(isRecordedKind(kind));const files=RECORDED_AUDIO[kind]!;assert.ok(files.length>=2);assert.notDeepEqual(wav(files[0]).samples,wav(files[1]).samples);}
 assert.notDeepEqual(wav(RECORDED_AUDIO.knife![0]).samples,wav(RECORDED_AUDIO['knife-hit']![0]).samples);
 assert.notDeepEqual(wav(RECORDED_AUDIO['knife-hit']![0]).samples,wav(RECORDED_AUDIO['knife-wall']![0]).samples);
});

test('asphalt has a dedicated recording without bleeding onto adjacent stone',()=>{
 const stone:Solid={x:0,y:3.65,z:-1,w:8,h:.3,d:2,kind:'floor',style:'tile'};
 const asphalt:Solid={x:0,y:3.65,z:1,w:8,h:.3,d:2,kind:'floor',style:'road'};
 for(const z of [-1,-.03,-.001,0,.001,.03,1])assert.equal(surfaceAt({x:0,y:3.8,z},[stone,asphalt]),z<=0?'stone':'asphalt',`wrong sound at ${z}`);
 // A neighbouring metal platform must not colour the ground under the centre.
 const metal={...asphalt,style:'metal' as const};
 assert.equal(surfaceAt({x:0,y:3.8,z:-.01},[stone,metal]),'stone');
 assert.equal(surfaceAt({x:0,y:3.8,z:.01},[stone,metal]),'metal');
});

test('A Long asphalt uses dedicated footsteps while the adjacent A site stays stone',()=>{
 for(const u of [880,900,920])for(const v of [145,149.9,150,150.1,165,190,214.9,215.1,240]){
  const p=dustPoint(u,v);p.y=groundAt(p,DUST2.solids);
  assert.equal(surfaceAt(p,DUST2.solids),v<150?'stone':'asphalt',`A Long visible surface mismatch at ${u},${v}`);
 }
 for(const [u,v] of [[820,140],[820,170],[820,190]]){const p=dustPoint(u,v);p.y=groundAt(p,DUST2.solids);assert.equal(surfaceAt(p,DUST2.solids),'stone',`A paving mismatch at ${u},${v}`);}
});

test('overlapping floor audio uses the visible first-authored surface at equal heights',()=>{
 const stone:Solid={x:0,y:3.65,z:0,w:8,h:.3,d:8,kind:'floor',style:'tile'},road={...stone,style:'road' as const};
 assert.equal(surfaceAt({x:0,y:3.8,z:0},[stone,road]),'stone');
 assert.equal(surfaceAt({x:0,y:3.8,z:0},[road,stone]),'asphalt');
});

test('asphalt uses distinct recorded footfalls from both cobblestone and grit',()=>{
 assert.ok(isRecordedKind('step-asphalt'));
 for(let i=0;i<4;i++)for(const other of ['stone','grit'] as const)assert.notDeepEqual(wav(RECORDED_AUDIO['step-asphalt']![i]).samples,wav(RECORDED_AUDIO[`step-${other}`]![i]).samples);
});
