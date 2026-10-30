import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {explosionSignal,EXPLOSION_AUDIO_SECONDS} from '../apps/web/components/explosion-audio';
import {ExplosionEffects,EXPLOSION_VISUAL_SECONDS} from '../apps/web/components/explosions';
const textures=()=>({cloud:new THREE.DataTexture(new Uint8Array([255,255,255,255]),1,1),glow:new THREE.DataTexture(new Uint8Array([255,255,255,255]),1,1)});
function rms(signal:Float32Array,start:number,end:number){let sum=0;for(let i=start;i<end;i++)sum+=signal[i]**2;return Math.sqrt(sum/(end-start));}
test('C4 audio has a longer, decaying rumble with bounded peaks and clean endpoints',()=>{
 const rate=12000,grenade=explosionSignal(rate,'grenade'),bomb=explosionSignal(rate,'bomb');
 assert.equal(grenade.length,Math.ceil(rate*EXPLOSION_AUDIO_SECONDS.grenade));assert.equal(bomb.length,Math.ceil(rate*EXPLOSION_AUDIO_SECONDS.bomb));
 for(const sound of [grenade,bomb]){assert.ok(sound.every(n=>Number.isFinite(n)&&Math.abs(n)<=.821));assert.equal(sound[0],0);assert.equal(Math.abs(sound.at(-1)!),0);}
 assert.ok(rms(bomb,rate*4,rate*6)>.0002,'C4 retains audible energy after the grenade tail has ended');
 assert.ok(rms(bomb,rate*4,rate*6)<rms(bomb,0,rate),'tail decays below the initial pressure burst');
 assert.deepEqual(explosionSignal(rate,'bomb'),bomb,'cached generation is deterministic');
});
test('C4 smoke persists after grenade effects expire, then all transient objects are removed',()=>{
 const scene=new THREE.Scene(),effects=new ExplosionEffects(scene,false,textures());
 effects.spawn({x:0,y:.1,z:0},'grenade',0);effects.spawn({x:10,y:0,z:0},'bomb',0);
 effects.update(4500);assert.equal(effects.activeCount,1);assert.equal(scene.children.length,2);
 let visibleSmoke=0;scene.traverse(o=>{if(o instanceof THREE.Sprite&&o.visible&&o.material.opacity>0)visibleSmoke++;});assert.ok(visibleSmoke>8);
 effects.update(EXPLOSION_VISUAL_SECONDS.bomb*1000+1);assert.equal(effects.activeCount,0);assert.equal(scene.children.length,1);effects.destroy();assert.equal(scene.children.length,0);
});
test('rapid blasts stay bounded; replay and teardown clear effects and dispose owned textures',()=>{
 const scene=new THREE.Scene(),maps=textures(),effects=new ExplosionEffects(scene,false,maps);let disposed=0;maps.cloud.addEventListener('dispose',()=>disposed++);maps.glow.addEventListener('dispose',()=>disposed++);
 for(let i=0;i<24;i++)effects.spawn({x:i,y:0,z:0},i%2?'bomb':'grenade',i*50);
 assert.equal(effects.activeCount,4);assert.equal(scene.children.length,5);
 for(const time of [1500,1900,3000,5000]){effects.update(time);scene.traverse(o=>{assert.ok([...o.position,...o.scale].every(Number.isFinite));if(o instanceof THREE.Sprite)assert.ok(Number.isFinite(o.material.opacity)&&o.material.opacity>=0&&o.material.opacity<=1);});}
 effects.clear();assert.equal(scene.children.length,1);effects.destroy();assert.equal(scene.children.length,0);assert.equal(disposed,2);
});
test('overlapping explosions reuse a constant light pool and retire invisible ember work',()=>{
 const scene=new THREE.Scene(),effects=new ExplosionEffects(scene,false,textures()),lights:THREE.PointLight[]=[];scene.traverse(o=>{if(o instanceof THREE.PointLight)lights.push(o);});assert.equal(lights.length,2);
 for(let i=0;i<12;i++){effects.spawn({x:i,y:0,z:0},i%2?'bomb':'grenade',i*100);const current:THREE.PointLight[]=[];scene.traverse(o=>{if(o instanceof THREE.PointLight)current.push(o);});assert.deepEqual(current,lights);assert.ok(lights.every(l=>l.visible));}
 effects.update(3500);assert.ok(lights.every(l=>l.intensity===0&&l.visible));scene.traverse(o=>{if(o instanceof THREE.Points)assert.equal(o.visible,false);});effects.clear();assert.ok(lights.every(l=>l.intensity===0));effects.destroy();assert.equal(scene.children.length,0);
});
test('reduced motion limits the initial flash and dynamic light',()=>{
 const a=new THREE.Scene(),b=new THREE.Scene(),normal=new ExplosionEffects(a,false,textures()),reduced=new ExplosionEffects(b,true,textures());
 normal.spawn({x:0,y:0,z:0},'bomb',0);reduced.spawn({x:0,y:0,z:0},'bomb',0);
 const intensity=(s:THREE.Scene)=>{let value=0;s.traverse(o=>{if(o instanceof THREE.PointLight)value+=o.intensity;});return value;};
 assert.ok(intensity(b)<intensity(a)*.3);normal.destroy();reduced.destroy();
});
