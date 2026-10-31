import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {GUNS,isGun,type AvatarId,type Equipment} from '@sirocco/shared';
import {WorldArt,disposeGroup} from '../apps/web/components/world';
import {buildAvatar} from '../apps/web/components/avatar-models';
import {equipAvatarModel} from '../apps/web/components/avatar-equipment';
import {animateHands,type HeldPose} from '../apps/web/components/held-equipment';
import {gunGrip} from '../apps/web/components/weapon-grips';
import {boneClearsTorso} from '../apps/web/components/arm-ik';
import {firstPersonHold} from '../apps/web/components/first-person-hold';
function fixture(run:(art:WorldArt)=>void){
 const previous=globalThis.document,load=THREE.TextureLoader.prototype.load,ctx=new Proxy({createImageData:(w:number,h:number)=>({data:new Uint8ClampedArray(w*h*4)})},{get:(o,k)=>k in o?o[k as keyof typeof o]:()=>{}});
 globalThis.document={createElement:()=>({getContext:()=>ctx})} as unknown as Document;THREE.TextureLoader.prototype.load=function(){return new THREE.Texture();};const art=Object.create(WorldArt.prototype) as WorldArt;art.materials=[];art.textures=[];
 try{run(art);}finally{art.destroy();globalThis.document=previous;THREE.TextureLoader.prototype.load=load;}
}
function equipped(art:WorldArt,avatar:AvatarId,kind:Equipment,third:boolean){const model=third?buildAvatar(art,avatar):undefined,held=model?equipAvatarModel(art,model,kind,avatar):art.weapon(kind,true,false,avatar);return {model,held};}
function pose(kind:Equipment,p:number,reverseSlash=false):HeldPose{return {reload:isGun(kind)?p:0,plant:kind==='bomb'?p:0,throwProgress:kind==='grenade'?p:0,slash:kind==='knife'?p:1,reverseSlash};}

test('all hero arms keep real limb lengths and attainable wrists throughout each separate action',()=>fixture(art=>{
 for(const avatar of ['ironman','ultraman','wonder-woman'] as const)for(const third of [false,true])for(const kind of [...GUNS,'knife','grenade','bomb'] as Equipment[]){
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
    if(!third&&isGun(kind)&&name==='leftArm'){
     const at=held.worldToLocal(arm.localToWorld(elbow.clone())),anchor=held.worldToLocal(arm.localToWorld(shoulder.clone())),end=held.worldToLocal(arm.localToWorld(wrist.clone()));
     assert.ok(end.y-at.y>.02,label+': support forearm must rise from a lowered elbow to the hand');
     const hold=firstPersonHold(kind),arc=Math.sin(Math.PI*frame/10),turn=new THREE.Quaternion().setFromEuler(new THREE.Euler(hold.pitch-.3*arc,hold.yaw,-.24*arc));
     at.applyQuaternion(turn);end.applyQuaternion(turn);anchor.applyQuaternion(turn);
     assert.equal(rig.upper.visible,false,label+': detached upper-arm proxy must never appear in first-person view');
     assert.equal(rig.elbow.visible,false,label+': detached elbow proxy must never appear in first-person view');
     assert.ok(end.y-at.y>.02,label+': elbow rises in the actual first-person reload tilt');
     assert.ok(at.x<end.x-.02,label+': support elbow folds inward across the gun');
    }
    if(model){const at=model.worldToLocal(arm.localToWorld(elbow.clone())),anchor=model.worldToLocal(arm.localToWorld(shoulder.clone())),end=model.worldToLocal(arm.localToWorld(wrist.clone())),width=avatar==='ironman'?.20:avatar==='wonder-woman'?.17:.18,depth=avatar==='ironman'?.175:.16;assert.ok(at.y<=anchor.y+.036,label+': elbow rises above shoulder');assert.ok(at.y>=1.43||(at.x/.235)**2+(at.z/.18)**2>=1.029,label+': elbow enters torso');assert.ok(boneClearsTorso(anchor,at,0,width,depth)&&boneClearsTorso(at,end,0,width,depth),label+': arm crosses the chest');}
    const skin=rig.skin as THREE.Mesh,p=skin.geometry.attributes.position,toPalm=rig.palm.matrixWorld.clone().invert().multiply(skin.matrixWorld),[width,depth]=skin.userData.wristRadii;
    for(const i of skin.userData.anatomicalArm.wristEdge){const v=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(toPalm);assert.ok(Math.abs(v.z-.12)<1e-5,label+': separated cuff');assert.ok(Math.abs((v.x/width)**2+(v.y/depth)**2-1)<1e-4,label+': distorted wrist contour');}
   }
  }
  disposeGroup(model??held);
 }
}));

test('every gun reload keeps the support palm on its own magazine and returns exactly to ready',()=>fixture(art=>{
 for(const avatar of ['ironman','ultraman','wonder-woman'] as const)for(const third of [false,true])for(const kind of GUNS){
  const {model,held}=equipped(art,avatar,kind,third),rig=held.userData.handRig,mag=rig.magazine as THREE.Object3D;
  animateHands(held,kind,pose(kind,0));held.updateWorldMatrix(true,true);
  const rest=mag.position.clone(),rotation=mag.quaternion.clone(),left=rig.left.userData.ironArm.palm.matrixWorld.clone();
  animateHands(held,kind,pose(kind,.48));held.updateWorldMatrix(true,true);
  const palm=rig.left.userData.ironArm.palm.getWorldPosition(new THREE.Vector3()),contact=mag.localToWorld(new THREE.Vector3(...gunGrip(kind).magazineContact));
  assert.ok(palm.distanceTo(contact)<1e-6,`${avatar} ${third} ${kind}: supporting hand detached from extracted magazine`);
  if(kind==='p90')assert.ok(mag.position.y>rest.y+.1,'top magazine must lift clear of the receiver');
  if(kind==='m249'){assert.ok(mag.position.x<rest.x-.06,'belt box must release to the side');assert.ok(rig.body.getObjectByName('feed-cover').rotation.x<-1,'feed cover must open');}
  animateHands(held,kind,pose(kind,0));held.updateWorldMatrix(true,true);
  assert.ok(mag.position.distanceTo(rest)<1e-8&&mag.quaternion.angleTo(rotation)<1e-7,`${kind}: magazine drifted after reload`);
  assert.ok(rig.left.userData.ironArm.palm.matrixWorld.elements.every((v:number,i:number)=>Math.abs(v-left.elements[i])<1e-7),`${kind}: support grip did not return to ready`);
  disposeGroup(model??held);
 }
}));

test('P90 top-magazine reload stays compact and its elbow skin moves continuously',()=>fixture(art=>{
 for(const avatar of ['ironman','ultraman','wonder-woman'] as const){
  const held=art.weapon('p90',true,false,avatar),mount=new THREE.Group(),camera=new THREE.PerspectiveCamera(65,16/9,.025,8),hold=firstPersonHold('p90');mount.scale.setScalar(.75);mount.position.fromArray(hold.position);mount.add(held);
  const rig=held.getObjectByName('leftArm')!.userData.ironArm,skin=rig.skin as THREE.Mesh;let previous:Float32Array|undefined,older:Float32Array|undefined,idle:Float32Array|undefined,idleGrip:THREE.Quaternion|undefined;
  for(let frame=0;frame<=60;frame++){
   const p=frame/60,arc=Math.sin(Math.PI*p);mount.rotation.set(hold.pitch-.3*arc,hold.yaw,-.24*arc);animateHands(held,'p90',pose('p90',p));mount.updateWorldMatrix(true,true);
   const grip=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().extractRotation(held.matrixWorld.clone().invert().multiply(rig.palm.matrixWorld)));idleGrip??=grip.clone();assert.ok(grip.angleTo(idleGrip)<Math.PI/3,`${avatar}: P90 magazine grab unnecessarily rolls the support hand and elbow`);
   const points=skin.geometry.attributes.position,world=new Float32Array(points.count*3),at=new THREE.Vector3();for(let i=0;i<points.count;i++){at.fromBufferAttribute(points,i).applyMatrix4(skin.matrixWorld);world.set(at.toArray(),i*3);}
   if(previous){let step=0,acceleration=0;for(let i=0;i<world.length;i+=3){step=Math.max(step,Math.hypot(world[i]-previous[i],world[i+1]-previous[i+1],world[i+2]-previous[i+2]));if(older)acceleration=Math.max(acceleration,Math.hypot(world[i]-2*previous[i]+older[i],world[i+1]-2*previous[i+1]+older[i+1],world[i+2]-2*previous[i+2]+older[i+2]));}assert.ok(step<.085&&acceleration<.04,`${avatar} P90 phase ${p}: elbow surface snaps or folds (${step}m, acceleration ${acceleration}m)`);}
   if(p>=.4&&p<=.6){
    const elbow=skin.parent!.localToWorld(rig.elbow.position.clone()).project(camera),mag=held.userData.handRig.magazine.getWorldPosition(new THREE.Vector3()).project(camera);
    assert.ok(elbow.y<-.45,`${avatar}: top-magazine reach lifts the elbow into the middle of the view`);
    assert.ok(mag.y>-.65&&mag.y<.4,`${avatar}: reloading magazine must stay visible`);
   }
   if(frame===0)idle=world.slice();if(frame===60)assert.ok(world.every((value,i)=>Math.abs(value-idle![i])<1e-6),`${avatar}: reload must return to the original arm pose`);older=previous;previous=world;
  }
  disposeGroup(held);
 }
}));

test('forehand and backhand knife swings preserve the grip and move the actual arms continuously',()=>fixture(art=>{
 for(const avatar of ['ironman','ultraman','wonder-woman'] as const)for(const third of [false,true]){
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
