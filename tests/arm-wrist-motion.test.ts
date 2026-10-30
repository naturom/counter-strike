import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import type {AvatarId,Equipment} from '@sirocco/shared';
import {WorldArt,disposeGroup} from '../apps/web/components/world';
import {buildAvatar} from '../apps/web/components/avatar-models';
import {equipAvatarModel} from '../apps/web/components/avatar-equipment';
import {animateHands,type HeldPose} from '../apps/web/components/held-equipment';
function fixture(run:(art:WorldArt)=>void){
 const previous=globalThis.document,load=THREE.TextureLoader.prototype.load,ctx=new Proxy({createImageData:(w:number,h:number)=>({data:new Uint8ClampedArray(w*h*4)})},{get:(o,k)=>k in o?o[k as keyof typeof o]:()=>{}});
 globalThis.document={createElement:()=>({getContext:()=>ctx})} as unknown as Document;THREE.TextureLoader.prototype.load=function(){return new THREE.Texture();};const art=Object.create(WorldArt.prototype) as WorldArt;art.materials=[];art.textures=[];
 try{run(art);}finally{art.destroy();globalThis.document=previous;THREE.TextureLoader.prototype.load=load;}
}
function equipped(art:WorldArt,avatar:AvatarId,kind:Equipment,third:boolean){const model=third?buildAvatar(art,avatar):undefined,held=model?equipAvatarModel(art,model,kind,avatar):art.weapon(kind,true,false,avatar);return {model,held};}
function pose(kind:Equipment,p:number,reverseSlash=false):HeldPose{return {reload:['rifle','pistol','smg','marksman'].includes(kind)?p:0,plant:kind==='bomb'?p:0,throwProgress:kind==='grenade'?p:0,slash:kind==='knife'?p:1,reverseSlash};}

test('Ultraman and Wonder Woman keep real limb lengths and attainable wrists throughout each separate action',()=>fixture(art=>{
 for(const avatar of ['ultraman','wonder-woman'] as const)for(const third of [false,true])for(const kind of ['rifle','pistol','smg','marksman','knife','grenade','bomb'] as Equipment[]){
  const {model,held}=equipped(art,avatar,kind,third);
  for(let frame=0;frame<=10;frame++){
   animateHands(held,kind,pose(kind,frame/10));held.updateWorldMatrix(true,true);
   for(const name of ['leftArm','rightArm']){
    const arm=held.getObjectByName(name)!,rig=arm.userData.ironArm,wrist=new THREE.Vector3(0,0,.12).applyMatrix4(rig.palm.matrix),elbow=rig.elbow.position as THREE.Vector3,shoulder=rig.upper.position as THREE.Vector3;
    const label=`${avatar} ${third?'mirror':'first'} ${kind} ${name} ${frame}`;
    assert.ok(Math.abs(shoulder.distanceTo(elbow)-rig.skin.userData.upperLength)<.001,label+': stretched upper arm');assert.ok(Math.abs(wrist.distanceTo(elbow)-rig.skin.userData.forearmLength)<.001,label+': stretched forearm');
    const bend=new THREE.Vector3(0,0,1).applyQuaternion(rig.palm.quaternion).angleTo(elbow.clone().sub(wrist).normalize());
    assert.ok(bend<THREE.MathUtils.degToRad(60),label+`: wrist folded ${THREE.MathUtils.radToDeg(bend)} degrees`);
    if(rig.relaxedWrist)assert.ok(bend<=rig.relaxedWrist.maxAngle+1e-6,label+': guard wrist bent back');
    if(model){const at=model.worldToLocal(arm.localToWorld(elbow.clone())),anchor=model.worldToLocal(arm.localToWorld(shoulder.clone()));assert.ok(at.y<=anchor.y+.036,label+': elbow rises above shoulder');assert.ok(at.y>=1.43||(at.x/.235)**2+(at.z/.18)**2>=1.029,label+': elbow enters torso');}
    const skin=rig.skin as THREE.Mesh,p=skin.geometry.attributes.position,toPalm=rig.palm.matrixWorld.clone().invert().multiply(skin.matrixWorld),[width,depth]=skin.userData.wristRadii;
    for(const i of skin.userData.anatomicalArm.wristEdge){const v=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(toPalm);assert.ok(Math.abs(v.z-.12)<1e-5,label+': separated cuff');assert.ok(Math.abs((v.x/width)**2+(v.y/depth)**2-1)<1e-4,label+': distorted wrist contour');}
   }
  }
  disposeGroup(model??held);
 }
}));

test('forehand and backhand knife swings preserve the grip and move the actual arms continuously',()=>fixture(art=>{
 for(const avatar of ['ultraman','wonder-woman'] as const)for(const third of [false,true]){
  const {model,held}=equipped(art,avatar,'knife',third),rig=held.userData.handRig,right=rig.right.userData.ironArm,skin=right.skin as THREE.Mesh;
  let grip:THREE.Matrix4|undefined,idle:Float32Array|undefined;
  for(const reverse of [false,true]){let previous:THREE.Vector3|undefined,vertices:Float32Array|undefined;
   for(let frame=0;frame<=60;frame++){
    animateHands(held,'knife',pose('knife',frame/60,reverse));held.updateWorldMatrix(true,true);
    const relative=rig.body.matrixWorld.clone().invert().multiply(right.palm.matrixWorld);grip??=relative.clone();assert.ok(relative.elements.every((v:number,i:number)=>Math.abs(v-grip!.elements[i])<1e-6),'the knife must stay in the gripping hand');
    const elbow=rig.right.localToWorld(right.elbow.position.clone()),p=skin.geometry.attributes.position.array as Float32Array,world=Float32Array.from(p),at=new THREE.Vector3();for(let i=0;i<p.length;i+=3){at.fromArray(p,i).applyMatrix4(skin.matrixWorld);world.set(at.toArray(),i);}
    if(previous)assert.ok(previous.distanceTo(elbow)<.04,`${avatar} ${third} ${reverse} ${frame}: elbow snapped during knife swing`);
    if(vertices){let max=0;for(let i=0;i<world.length;i+=3)max=Math.max(max,Math.hypot(world[i]-vertices[i],world[i+1]-vertices[i+1],world[i+2]-vertices[i+2]));assert.ok(max<.065,`${avatar} ${third} ${reverse} ${frame}: skin twists or snaps ${max}m`);}
    previous=elbow;vertices=world;
    if(frame===0)idle??=Float32Array.from(p);if(frame===60)assert.ok(p.every((v,i)=>Math.abs(v-idle![i])<1e-6),'opposing attacks return exactly to the ready pose');
   }
  }
  disposeGroup(model??held);
 }
}));

test('item-specific fingers share the wrist seam and C4 typing morph topology',()=>fixture(art=>{
 for(const avatar of ['ultraman','wonder-woman'] as const)for(const kind of ['knife','grenade','bomb'] as Equipment[]){
  const {held}=equipped(art,avatar,kind,false);
  for(const side of ['leftArm','rightArm']){const rig=held.getObjectByName(side)!.userData.ironArm,hand=rig.palm.children[0] as THREE.Mesh,p=hand.geometry.attributes.position;let seam=0;for(let i=0;i<p.count;i++){assert.ok(p.getZ(i)<=.120001,'no hand stub should protrude beyond the common wrist plane');if(Math.abs(p.getZ(i)-.12)<1e-6)seam++;}assert.ok(seam>20);if(kind==='bomb'&&side==='rightArm'){assert.equal(hand.geometry.morphAttributes.position![0].count,p.count);assert.equal(hand.geometry.morphAttributes.normal![0].count,p.count);}}
  disposeGroup(held);
 }
}));
