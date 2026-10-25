import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {AVATARS} from '@sirocco/shared';
import {WorldArt,disposeGroup} from '../apps/web/components/world';
import {buildAvatar} from '../apps/web/components/avatar-models';
import {equipAvatarModel} from '../apps/web/components/avatar-equipment';
import {animateAvatarMotion} from '../apps/web/components/avatar-motion';
import {StanceMotion,firstPersonStance} from '../apps/web/components/stance-motion';

const ready={reload:0,plant:0,throwProgress:0,slash:1};
function fixture(run:(art:WorldArt)=>void){
 const documentBefore=globalThis.document,load=THREE.TextureLoader.prototype.load,ctx=new Proxy({createImageData:(w:number,h:number)=>({data:new Uint8ClampedArray(w*h*4)})},{get:(o,k)=>k in o?o[k as keyof typeof o]:()=>{}});
 globalThis.document={createElement:()=>({getContext:()=>ctx})} as unknown as Document;THREE.TextureLoader.prototype.load=function(){return new THREE.Texture();};
 const art=Object.create(WorldArt.prototype) as WorldArt;art.materials=[];art.textures=[];
 try{run(art);}finally{art.destroy();globalThis.document=documentBefore;THREE.TextureLoader.prototype.load=load;}
}
test('crouching bends both knees with planted feet and full-size torso geometry',()=>fixture(art=>{
 for(const avatar of AVATARS){
  const model=buildAvatar(art,avatar.id);equipAvatarModel(art,model,'rifle',avatar.id);
  const body=model.children.find(o=>o.name==='anatomy-Skin') as THREE.Mesh,original=Float32Array.from(body.geometry.attributes.position.array),legs=['leftLeg','rightLeg'].map(name=>model.getObjectByName(name)!),legRest=legs.map(leg=>{const g=(leg.getObjectByName('anatomy-Skin') as THREE.Mesh).geometry.toNonIndexed(),rest=Float32Array.from(g.attributes.position.array);g.dispose();return rest;});
  animateAvatarMotion(model,'rifle',ready,1/60,true,0,{crouched:true,vy:0});
  assert.deepEqual(model.scale.toArray(),[1,1,1]);assert.deepEqual(model.getObjectByName('avatarTorso')!.scale.toArray(),[1,1,1]);assert.deepEqual(body.geometry.attributes.position.array,original,'crouching must not squash or reshape the chest/head');
  const bounds=new THREE.Box3().setFromObject(model,true);assert.ok(bounds.max.y>1.0&&bounds.max.y<1.2,`${avatar.id}: crouch height ${bounds.max.y}`);
  for(const leg of legs){
   const knee=leg.localToWorld(new THREE.Vector3(0,-.43,0)),foot=new THREE.Box3().setFromObject(leg,true);assert.ok(knee.z<-.1&&leg.position.y<.35,'the knees must bend forward while the hips lower');
   assert.ok(foot.min.y>-.03&&foot.min.y<.035,`${avatar.id}: foot must stay on the ground: ${foot.min.y}`);
  }
  for(let i=0;i<70;i++)animateAvatarMotion(model,'rifle',ready,1/60,true,0,{crouched:false,vy:0});
  for(let side=0;side<2;side++){const g=(legs[side].getObjectByName('anatomy-Skin') as THREE.Mesh).geometry.toNonIndexed(),p=g.attributes.position;for(let i=0;i<p.count;i+=19)assert.ok(new THREE.Vector3().fromBufferAttribute(p,i).distanceTo(new THREE.Vector3().fromArray(legRest[side],i*3))<.0002,'standing must restore the original leg without accumulated deformation');g.dispose();}
  disposeGroup(model);
 }
}));
test('airborne bodies tuck their legs and land with bent knees before recovering',()=>fixture(art=>{
 for(const avatar of AVATARS){
  const model=buildAvatar(art,avatar.id);equipAvatarModel(art,model,'knife',avatar.id);
  animateAvatarMotion(model,'knife',ready,.1,true,0,{vy:0});
  for(let i=0;i<12;i++)animateAvatarMotion(model,'knife',ready,.1,false,0,{vy:6});
  const left=model.getObjectByName('leftLeg')!,airFoot=new THREE.Box3().setFromObject(left,true).min.y;
  assert.ok(airFoot>.10,'airborne knees must lift the feet instead of keeping a straight standing pose');
  animateAvatarMotion(model,'knife',ready,.1,false,0,{vy:-8});animateAvatarMotion(model,'knife',ready,1/60,true,0,{vy:0});
  const stance=model.userData.stance;assert.ok(stance.landing>.3,'a real landing triggers a knee compression');
  assert.ok(new THREE.Box3().setFromObject(left,true).min.y<.035,'feet must plant immediately at contact while the knees absorb the landing');
  for(let i=0;i<50;i++)animateAvatarMotion(model,'knife',ready,1/60,true,0,{vy:0});
  assert.ok(model.userData.stance.landing<.001&&model.userData.stance.air<.001,'landing and air poses must recover');
  model.traverse(o=>{if(o instanceof THREE.Mesh)assert.ok(Array.from(o.geometry.attributes.position.array).every(Number.isFinite));});disposeGroup(model);
 }
}));
test('changing equipment while crouched keeps the mirrored shoulder and wrist seams attached',()=>fixture(art=>{
 for(const avatar of AVATARS){
  const model=buildAvatar(art,avatar.id);equipAvatarModel(art,model,'rifle',avatar.id);animateAvatarMotion(model,'rifle',ready,.1,true,0,{crouched:true,vy:0});
  for(const kind of ['pistol','knife','grenade','bomb'] as const){
   const held=equipAvatarModel(art,model,kind,avatar.id);animateAvatarMotion(model,kind,{...ready,plant:.3,throwProgress:.2,slash:.36},.1,true,.2,{crouched:true,vy:0});
   const torso=model.getObjectByName('avatarTorso')!;assert.equal(held.parent,torso);
   for(const name of ['leftArm','rightArm']){
    const arm=held.getObjectByName(name)!,rig=arm.userData.ironArm,skin=rig.skin as THREE.Mesh,shape=skin.userData.anatomicalArm,p=skin.geometry.attributes.position;
    for(const i of shape.shoulderEdge){const actual=skin.localToWorld(new THREE.Vector3().fromBufferAttribute(p,i)),expected=torso.localToWorld(new THREE.Vector3().fromArray(shape.position,i*3));assert.ok(actual.distanceTo(expected)<1e-5,'the shoulder seam must follow the full-size crouched torso');}
    const wrist=rig.palm.localToWorld(new THREE.Vector3(0,0,.12)),end=arm.localToWorld(rig.forearm.position.clone());assert.ok(wrist.distanceTo(end)<1e-6,'the hand cannot detach when crouching with equipment');
   }
  }
  disposeGroup(model);
 }
}));
test('first-person stance motion is bounded, settles, and respects reduced motion',()=>{
 const motion=new StanceMotion();motion.update(1/60,true,false,0);
 const moving=motion.update(1/60,false,false,9.4);assert.ok(moving.air>0&&moving.air<1);assert.ok(firstPersonStance(moving).y<0,'hands lag slightly behind upward acceleration');
 motion.update(.1,false,false,-9);const landing=motion.update(1/60,true,false,0);assert.ok(landing.landing>.5);
 const reduced=firstPersonStance({crouch:.5,air:1,landing:1,vy:-20,grounded:false},true),quiet=firstPersonStance({crouch:.5,air:0,landing:0,vy:0,grounded:true},true);assert.deepEqual(reduced,quiet,'reduced motion must remove jump and landing shake');
 for(let i=0;i<80;i++)motion.update(1/60,true,false,0);for(const value of Object.values(firstPersonStance(motion.value)))assert.ok(Math.abs(value)<1e-8,'stance motion should settle back to rest');
});
